/**
 * AutoBrowser & Auth Assistant (`browser-auth.js`) - Versão Definitiva
 * 
 * Permite que a IA e o Usuário compartilhem sessões autenticadas de forma transparente e segura.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const CDP_PORT = 9222;
const CDP_URL = `http://localhost:${CDP_PORT}`;
const DATA_DIR = path.join(__dirname, '..', '.user_browser_data');
const STORAGE_STATE_PATH = path.join(__dirname, '..', 'storageState.json');
const LOCK_FILE = path.join(DATA_DIR, 'SingletonLock');

// Garante que a pasta de perfil exista
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Limpa trava SingletonLock se o processo anterior tiver sido finalizado
function cleanStaleLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            fs.unlinkSync(LOCK_FILE);
            console.log('🧹 Trava de perfil antiga (SingletonLock) removida com sucesso.');
        } catch (e) {
            // Arquivo pode estar em uso se o Chrome estiver aberto
        }
    }
}

// Localiza o executável do Chrome do sistema
function getSystemChromePath() {
    const candidates = [
        '/home/deliveryboy/.local/bin/google-chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return undefined;
}

// Verifica se o Chrome CDP está ativo na porta 9222
function isCdpActive() {
    return new Promise((resolve) => {
        const req = http.get(`${CDP_URL}/json/version`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1500, () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * MODO SETUP: Abre o navegador para o usuário fazer login
 */
async function runSetup(targetUrl = 'https://vercel.com/login') {
    console.log('\n======================================================');
    console.log(' 🌐 AUTOBROWSER AUTH ASSISTANT - MODO DE CONFIGURAÇÃO');
    console.log('======================================================');
    console.log('💡 INSTRUÇÃO IMPORTANTE DE LOGIN:');
    console.log('📌 O Google bloqueia o botão "Fazer Login com Google" em perfis isolados.');
    console.log('📌 PARA LOGAR COM SUCESSO: Digite seu E-mail e Senha diretos do site, ou escolha "Fazer Login com GitHub"!');
    console.log('📌 Se o site for a Vercel ou Render, faça login usando sua conta do GitHub.\n');

    cleanStaleLock();

    const executablePath = getSystemChromePath();
    console.log('[SETUP] Iniciando navegador...');

    const context = await chromium.launchPersistentContext(DATA_DIR, {
        headless: false,
        executablePath,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ]
    });

    const page = context.pages()[0] || await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log(`[SETUP] Navegando para: ${targetUrl}`);
    await page.goto(targetUrl).catch(err => console.log('[SETUP] Aguardando ação do usuário...', err.message));

    // Manter o processo rodando enquanto houver páginas visíveis abertas
    await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (context.pages().length === 0) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 1000);
    });

    try {
        await context.storageState({ path: STORAGE_STATE_PATH });
        console.log(`✅ Estado de autenticação salvo em: ${STORAGE_STATE_PATH}`);
    } catch (e) {}

    console.log('✅ Modo Setup finalizado com sucesso!\n');
}

/**
 * MODO STATUS: Verifica status das sessões salvas
 */
async function checkStatus() {
    console.log('\n🔍 Verificando status das sessões salvas...');
    cleanStaleLock();

    const executablePath = getSystemChromePath();
    let context;
    try {
        context = await chromium.launchPersistentContext(DATA_DIR, {
            headless: true,
            executablePath,
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
    } catch (err) {
        console.error('⚠️ Não foi possível abrir o perfil (verifique se já existe uma janela aberta):', err.message);
        return;
    }

    const sitesToCheck = [
        { name: 'Vercel', url: 'https://vercel.com/dashboard' },
        { name: 'Render', url: 'https://dashboard.render.com/' },
        { name: 'GitHub', url: 'https://github.com/' }
    ];

    const results = {};
    const page = context.pages()[0] || await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    for (const site of sitesToCheck) {
        try {
            console.log(`[STATUS] Checando ${site.name}...`);
            await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(2000);
            
            const pageUrl = page.url();
            const isLoginRedirect = pageUrl.includes('/login') || pageUrl.includes('/sign-in') || pageUrl.includes('/auth');
            
            if (!isLoginRedirect) {
                results[site.name] = { status: 'AUTENTICADO ✅', currentUrl: pageUrl };
            } else {
                results[site.name] = { status: 'NÃO AUTENTICADO ❌', currentUrl: pageUrl };
            }
        } catch (err) {
            results[site.name] = { status: 'ERRO / NÃO VERIFICADO ⚠️', error: err.message };
        }
    }

    await context.close().catch(() => {});

    console.log('\n======================================================');
    console.log(' 📊 RELATÓRIO DE SESSÕES DO NAVEGADOR');
    console.log('======================================================');
    console.table(results);
    console.log('\n💡 Para conectar novos sites, rode `auth-setup` no terminal!\n');
}

/**
 * MODO RUN: Executa automações em background
 */
async function runNavigation(url, options = {}) {
    const { action = 'inspect', scriptJson = null } = options;
    console.log(`\n🚀 [AUTOBROWSER RUN] Acessando URL: ${url} (Ação: ${action})`);

    cleanStaleLock();
    const executablePath = getSystemChromePath();
    const context = await chromium.launchPersistentContext(DATA_DIR, {
        headless: true,
        executablePath,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = context.pages()[0] || await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        console.log(`📍 URL Final: ${page.url()}`);
        console.log(`📄 Título da Página: "${await page.title()}"`);

        const result = {
            url: page.url(),
            title: await page.title(),
            contentSnippet: ''
        };

        if (action === 'inspect' || action === 'text') {
            const bodyText = await page.innerText('body');
            result.contentSnippet = bodyText.substring(0, 1500).replace(/\s+/g, ' ');
            console.log('\n--- SNIPPET DO CONTEÚDO DA PÁGINA ---');
            console.log(result.contentSnippet);
            console.log('-------------------------------------\n');
        }

        if (scriptJson) {
            try {
                const steps = JSON.parse(scriptJson);
                for (const step of steps) {
                    console.log(`⚡ Executando passo: ${step.type} (${step.selector || step.value || ''})`);
                    if (step.type === 'click') {
                        await page.click(step.selector, { timeout: 10000 });
                    } else if (step.type === 'fill') {
                        await page.fill(step.selector, step.value);
                    } else if (step.type === 'wait') {
                        await page.waitForTimeout(step.ms || 2000);
                    } else if (step.type === 'screenshot') {
                        const shotPath = path.join(__dirname, '..', step.path || 'last_action.png');
                        await page.screenshot({ path: shotPath, fullPage: true });
                        console.log(`📸 Screenshot de depuração salvo em: ${shotPath}`);
                    }
                }
            } catch (errStep) {
                console.error('⚠️ Erro ao executar passos do scriptJson:', errStep.message);
            }
        }

        await context.close().catch(() => {});
        return result;
    } catch (err) {
        console.error('❌ Erro na navegação:', err.message);
        await context.close().catch(() => {});
        throw err;
    }
}

// INTERFACE CLI
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    if (command === 'setup') {
        const target = args[1] || 'https://vercel.com/login';
        await runSetup(target);
    } else if (command === 'status') {
        await checkStatus();
    } else if (command === 'run') {
        const urlArgIndex = args.indexOf('--url');
        const url = urlArgIndex !== -1 ? args[urlArgIndex + 1] : args[1];
        const scriptArgIndex = args.indexOf('--steps');
        const scriptJson = scriptArgIndex !== -1 ? args[scriptArgIndex + 1] : null;

        if (!url) {
            console.error('❌ Informe a URL. Exemplo: node scripts/browser-auth.js run --url https://vercel.com/dashboard');
            process.exit(1);
        }
        await runNavigation(url, { scriptJson });
    } else {
        console.log(`
Uso do AutoBrowser Auth Assistant:
  auth-setup [URL]                       Abre o Chrome para você fazer login no Vercel/Render/GitHub
  auth-status                            Verifica se as sessões salvas nos sites estão válidas
`);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal Error:', err);
        process.exit(1);
    });
}

module.exports = { runSetup, checkStatus, runNavigation };
