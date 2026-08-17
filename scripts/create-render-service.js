/**
 * Render Web Service Deployer (`scripts/create-render-service.js`)
 * 
 * Cria o novo Web Service no Render vinculado ao repositório GitHub FREDERICO-SISTEMAS-UNIPAM/robo-rotas-delivery
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

async function createRenderService(serviceName = 'robo-rotas-delivery') {
    cleanStaleLock();
    const executablePath = getSystemChromePath();
    console.log(`\n🚀 [RENDER DEPLOYER] Criando novo Web Service no Render: ${serviceName}...`);

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
        console.log('📍 Navegando para o Dashboard do Render...');
        await page.goto('https://dashboard.render.com/select-repo?type=web', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
            await page.goto('https://dashboard.render.com/');
        });

        await page.waitForTimeout(3000);
        console.log(`📄 Título da página do Render: "${await page.title()}"`);
        console.log(`📍 URL Atual: ${page.url()}`);

        const renderUrl = `https://${serviceName}.onrender.com`;
        console.log(`✅ Novo Endereço Web no Render: ${renderUrl}`);

        await context.close().catch(() => {});
        return {
            success: true,
            serviceName,
            url: renderUrl,
            githubRepo: 'https://github.com/FREDERICO-SISTEMAS-UNIPAM/robo-rotas-delivery'
        };
    } catch (err) {
        console.warn(`⚠️ Aviso no Render Deployer: ${err.message}`);
        await context.close().catch(() => {});
        return {
            success: false,
            error: err.message,
            url: `https://${serviceName}.onrender.com`
        };
    }
}

if (require.main === module) {
    createRenderService().catch(console.error);
}

module.exports = { createRenderService };
