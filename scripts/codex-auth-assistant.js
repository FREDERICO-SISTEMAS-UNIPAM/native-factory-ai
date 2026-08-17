/**
 * Codex Auth Assistant (`scripts/codex-auth-assistant.js`)
 * 
 * Módulo que permite ao Codex do ChatGPT e assistentes de IA realizarem leituras e 
 * ações em páginas da web privadas usando a sessão de usuário autenticada do Chrome.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '.user_browser_data');
const LOCK_FILE = path.join(DATA_DIR, 'SingletonLock');

// Garante que a pasta de perfil de navegação exista
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Limpa travas antigas se o navegador tiver sido fechado abruptamente
function cleanStaleLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            fs.unlinkSync(LOCK_FILE);
            console.log('🧹 Trava de perfil (SingletonLock) higienizada.');
        } catch (e) {}
    }
}

// Tenta localizar o executável do Chrome do sistema
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

/**
 * Garante que a sessão do usuário está válida no site.
 * Se o site redirecionar para a tela de login, abre a janela interativa para o usuário logar.
 */
async function ensureAuthenticated(targetUrl) {
    cleanStaleLock();
    const executablePath = getSystemChromePath();
    console.log(`[AUTH CHECK] Verificando acesso autenticado para: ${targetUrl}`);

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
        console.warn(`[AUTH CHECK] Perfil em uso ou não foi possível abrir em headless: ${err.message}`);
        return true;
    }

    const page = context.pages()[0] || await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    let isAuthenticated = false;
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        const isLoginRedirect = currentUrl.includes('/login') || currentUrl.includes('/sign-in') || currentUrl.includes('/auth') || currentUrl.includes('accounts.google');

        if (!isLoginRedirect) {
            console.log(`✅ [AUTH CHECK] Sessão ativa e autenticada em ${currentUrl}`);
            isAuthenticated = true;
        } else {
            console.log(`⚠️ [AUTH CHECK] Sessão expirada ou não encontrada (Redirecionado para ${currentUrl})`);
        }
    } catch (err) {
        console.warn(`[AUTH CHECK] Erro na checagem rápida: ${err.message}`);
    }

    await context.close().catch(() => {});

    if (!isAuthenticated) {
        console.log('\n======================================================');
        console.log(' 🔐 LOGIN NECESSÁRIO NO NAVEGADOR');
        console.log('======================================================');
        console.log('Abrindo janela do navegador para você efetuar o login 1 vez...');
        console.log('Assim que concluir o login, feche a janela do navegador para o Codex continuar a tarefa.\n');

        context = await chromium.launchPersistentContext(DATA_DIR, {
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

        const setupPage = context.pages()[0] || await context.newPage();
        await setupPage.goto(targetUrl).catch(() => {});

        // Aguarda o usuário fechar o navegador
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (context.pages().length === 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });

        console.log('✅ Janela fechada pelo usuário. Retomando automação...');
    }

    return true;
}

/**
 * Busca o conteúdo de uma página privada/autenticada em nome do Codex.
 */
async function fetchAuthenticatedPage(url, options = {}) {
    const { waitForSelector, screenshotPath = null } = options;

    await ensureAuthenticated(url);
    cleanStaleLock();

    const executablePath = getSystemChromePath();
    console.log(`\n🤖 [CODEX AUTH ASSISTANT] Acessando em nome do Codex: ${url}`);

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
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
            await page.waitForLoadState('domcontentloaded');
        });

        if (waitForSelector) {
            await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {});
        }

        const title = await page.title();
        const finalUrl = page.url();
        const bodyText = await page.innerText('body').catch(() => '');
        
        // Extrai links relevantes da página para auxiliar o Codex na navegação
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
                .slice(0, 30)
                .map(a => ({ text: a.innerText.trim().substring(0, 50), href: a.href }))
                .filter(l => l.text.length > 0 && !l.href.startsWith('javascript:'));
        }).catch(() => []);

        let screenshotFile = null;
        if (screenshotPath) {
            const absolutePath = path.resolve(screenshotPath);
            await page.screenshot({ path: absolutePath, fullPage: true });
            screenshotFile = absolutePath;
            console.log(`📸 Screenshot salvo para o Codex em: ${absolutePath}`);
        }

        await context.close().catch(() => {});

        console.log(`✅ Página lida com sucesso ("${title}"). Tamanho do texto: ${bodyText.length} caracteres.`);

        return {
            success: true,
            url: finalUrl,
            title,
            textSnippet: bodyText.substring(0, 4000).replace(/\s+/g, ' '),
            fullTextLength: bodyText.length,
            links,
            screenshotFile
        };
    } catch (err) {
        await context.close().catch(() => {});
        console.error(`❌ Erro ao ler página autenticada: ${err.message}`);
        return {
            success: false,
            url,
            error: err.message
        };
    }
}

/**
 * Executa uma série de ações (cliques, preenchimentos) em uma página autenticada em nome do Codex.
 */
async function executeAuthenticatedActions(url, steps = []) {
    await ensureAuthenticated(url);
    cleanStaleLock();

    const executablePath = getSystemChromePath();
    console.log(`\n🤖 [CODEX AUTH ASSISTANT] Executando ${steps.length} ações em ${url}`);

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

    const executionLog = [];

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            console.log(` ⚡ [Passo ${i + 1}/${steps.length}] ${step.action} (${step.selector || step.value || ''})`);

            if (step.action === 'click') {
                await page.click(step.selector, { timeout: 10000 });
                executionLog.push(`Cliquei em '${step.selector}'`);
            } else if (step.action === 'fill') {
                await page.fill(step.selector, step.value);
                executionLog.push(`Preenchi '${step.selector}' com '${step.value}'`);
            } else if (step.action === 'wait') {
                await page.waitForTimeout(step.ms || 2000);
                executionLog.push(`Aguardei ${step.ms || 2000}ms`);
            } else if (step.action === 'screenshot') {
                const shotPath = path.resolve(step.path || `step_${i + 1}.png`);
                await page.screenshot({ path: shotPath, fullPage: true });
                executionLog.push(`Screenshot salvo em ${shotPath}`);
            }
        }

        const finalTitle = await page.title();
        const finalUrl = page.url();
        const finalContent = await page.innerText('body').catch(() => '');

        await context.close().catch(() => {});

        return {
            success: true,
            url: finalUrl,
            title: finalTitle,
            executionLog,
            resultSnippet: finalContent.substring(0, 3000).replace(/\s+/g, ' ')
        };
    } catch (err) {
        await context.close().catch(() => {});
        console.error(`❌ Erro durante execução de passos: ${err.message}`);
        return {
            success: false,
            error: err.message,
            executionLog
        };
    }
}

module.exports = {
    ensureAuthenticated,
    fetchAuthenticatedPage,
    executeAuthenticatedActions
};
