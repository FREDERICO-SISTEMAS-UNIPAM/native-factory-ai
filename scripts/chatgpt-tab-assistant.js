/**
 * ChatGPT Web Tab Assistant (`scripts/chatgpt-tab-assistant.js`)
 * 
 * Envia mensagens e tarefas diretamente para a interface WEB do ChatGPT (chatgpt.com)
 * utilizando a conta logada do usuário.
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

/**
 * Envia uma mensagem/tarefa diretamente para o campo de texto do ChatGPT web (chatgpt.com)
 */
async function sendToChatGPTWeb(promptText) {
    cleanStaleLock();
    const executablePath = getSystemChromePath();
    console.log(`\n💬 [CHATGPT WEB INTEGRATION] Enviando solicitação para a aba do ChatGPT...`);
    console.log(`📝 Texto: "${promptText.substring(0, 100)}..."`);

    const context = await chromium.launchPersistentContext(DATA_DIR, {
        headless: false, // Abre a janela para o usuário visualizar se desejar
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
        console.log('📍 Abrindo https://chatgpt.com/ ...');
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        console.log(`📄 Título da página: "${await page.title()}"`);
        console.log(`📍 URL Atual: ${page.url()}`);

        // Localizadores do campo de entrada de texto do ChatGPT Web
        const promptSelectors = [
            '#prompt-textarea',
            'div[contenteditable="true"]',
            'textarea[placeholder*="Message"]',
            'p[data-placeholder]'
        ];

        let filled = false;
        for (const selector of promptSelectors) {
            try {
                const el = await page.$(selector);
                if (el) {
                    await el.click();
                    await page.waitForTimeout(500);
                    await page.keyboard.insertText(promptText);
                    console.log(`✏️ Mensagem inserida com sucesso no seletor '${selector}'!`);
                    filled = true;
                    break;
                }
            } catch (e) {}
        }

        if (!filled) {
            console.warn('⚠️ Campo de texto não encontrado de forma direta. Tentando focar e digitar via teclado...');
            await page.keyboard.press('Tab');
            await page.keyboard.insertText(promptText);
        }

        await page.waitForTimeout(1000);

        // Clicar no botão de enviar ou pressionar Enter
        const sendBtnSelector = 'button[aria-label="Send prompt"], button[data-testid="send-button"], button[aria-label*="Enviar"]';
        const sendBtn = await page.$(sendBtnSelector);
        if (sendBtn) {
            await sendBtn.click();
            console.log('⚡ Clique no botão Enviar efetuado!');
        } else {
            await page.keyboard.press('Enter');
            console.log('⚡ Tecla Enter pressionada!');
        }

        await page.waitForTimeout(5000);

        const shotPath = path.join(__dirname, '..', 'chatgpt_tab_result.png');
        await page.screenshot({ path: shotPath, fullPage: true });
        console.log(`📸 Captura da tela da sua aba do ChatGPT salva em: ${shotPath}`);

        // Manter a janela aberta por 15 segundos para o usuário ver ou manter contexto
        console.log('✅ Solicitação enviada com sucesso para o ChatGPT!');

        return {
            success: true,
            chatUrl: page.url(),
            screenshotPath: shotPath
        };
    } catch (err) {
        console.error(`❌ Erro ao interagir com a aba do ChatGPT: ${err.message}`);
        return {
            success: false,
            error: err.message
        };
    }
}

if (require.main === module) {
    const prompt = process.argv.slice(2).join(' ') || 'Criar a aplicação do robô de rotas de entrega, subir o repositório no GitHub https://github.com/FREDERICO-SISTEMAS-UNIPAM/robo-rotas-delivery e realizar o deploy no Render';
    sendToChatGPTWeb(prompt).catch(console.error);
}

module.exports = { sendToChatGPTWeb };
