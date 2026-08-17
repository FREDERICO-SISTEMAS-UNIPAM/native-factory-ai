/**
 * Codex Target Assistant (`scripts/find-codex-tab.js`)
 * 
 * Localiza e interage com a interface do CODEX / CANVAS da OpenAI no navegador.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '.user_browser_data');
const LOCK_FILE = path.join(DATA_DIR, 'SingletonLock');

function cleanStaleLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try { fs.unlinkSync(LOCK_FILE); } catch (e) {}
    }
}

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

async function sendTaskToCodexInterface(promptText) {
    cleanStaleLock();
    const executablePath = getSystemChromePath();
    console.log(`\n👨‍💻 [CODEX INTERFACE ASSISTANT] Direcionando tarefa para a aba do CODEX...`);

    const context = await chromium.launchPersistentContext(DATA_DIR, {
        headless: false, // Abre a janela visível no monitor do usuário
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

    try {
        // Tenta abrir o modelo Canvas / Codex diretamente no ChatGPT
        const codexUrl = 'https://chatgpt.com/?model=gpt-4o-canvases';
        console.log(`📍 Abrindo interface do Codex em: ${codexUrl}`);
        await page.goto(codexUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(3000);

        console.log(`📄 Título da página: "${await page.title()}"`);
        console.log(`📍 URL Final: ${page.url()}`);

        // Localizar a entrada de texto do Codex
        const inputSelectors = [
            '#prompt-textarea',
            'div[contenteditable="true"]',
            'textarea[aria-label*="Codex"]',
            'textarea[placeholder*="Code"]',
            'textarea'
        ];

        let filled = false;
        for (const selector of inputSelectors) {
            try {
                const el = await page.$(selector);
                if (el) {
                    await el.click();
                    await page.waitForTimeout(500);
                    await page.keyboard.insertText(promptText);
                    console.log(`✏️ Tarefa inserida com sucesso no painel do Codex ('${selector}')!`);
                    filled = true;
                    break;
                }
            } catch (e) {}
        }

        if (!filled) {
            await page.keyboard.insertText(promptText);
            console.log('✏️ Digitado via teclado direto.');
        }

        await page.waitForTimeout(1000);

        // Enviar
        const sendBtnSelector = 'button[aria-label="Send prompt"], button[data-testid="send-button"], button[aria-label*="Enviar"]';
        const sendBtn = await page.$(sendBtnSelector);
        if (sendBtn) {
            await sendBtn.click();
            console.log('⚡ Enviado para o Codex com sucesso!');
        } else {
            await page.keyboard.press('Enter');
            console.log('⚡ Pressionado Enter!');
        }

        console.log('✅ Solicitação entregue ao Codex!');
        return { success: true, url: page.url() };
    } catch (err) {
        console.error(`❌ Erro ao enviar para o Codex: ${err.message}`);
        return { success: false, error: err.message };
    }
}

if (require.main === module) {
    const prompt = process.argv.slice(2).join(' ') || 'Criar a aplicação do robô de rotas de entrega, subir o repositório no GitHub https://github.com/FREDERICO-SISTEMAS-UNIPAM/robo-rotas-delivery e realizar o deploy no Render https://robo-rotas-delivery.onrender.com';
    sendTaskToCodexInterface(prompt).catch(console.error);
}

module.exports = { sendTaskToCodexInterface };
