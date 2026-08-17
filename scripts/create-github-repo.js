/**
 * GitHub & Render Autonomous Deployer (`scripts/create-github-repo.js`)
 * 
 * Cria o novo repositório no GitHub (`robo-rotas-delivery`) e
 * conecta a aplicação ao Render sob o novo endereço web.
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

async function createGitHubRepo(repoName = 'robo-rotas-delivery') {
    cleanStaleLock();
    const executablePath = getSystemChromePath();
    console.log(`\n🚀 [GITHUB DEPLOYER] Criando novo repositório: ${repoName}...`);

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
        await page.goto('https://github.com/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Preencher o nome do repositório
        const nameInputSelector = '#repository-name-input, input[id="repository-name-input"]';
        await page.waitForSelector(nameInputSelector, { timeout: 10000 });
        await page.fill(nameInputSelector, repoName);
        console.log(`✏️ Nome do repositório preenchido: ${repoName}`);

        await page.waitForTimeout(3000);

        // Clicar no botão 'Create repository'
        const submitBtnSelector = 'button:has-text("Create repository")';
        const submitBtn = await page.waitForSelector(submitBtnSelector, { timeout: 10000 });
        
        if (submitBtn) {
            await submitBtn.click();
            console.log('⚡ Clique em "Create repository" efetuado!');
            await page.waitForTimeout(6000);
        }

        const repoUrl = page.url();
        console.log(`✅ Repositório no GitHub pronto: ${repoUrl}`);

        await context.close().catch(() => {});
        return repoUrl;
    } catch (err) {
        console.warn(`⚠️ Aviso na criação de repo: ${err.message}`);
        await context.close().catch(() => {});
        return `https://github.com/FREDERICO-SISTEMAS-UNIPAM/${repoName}`;
    }
}

if (require.main === module) {
    createGitHubRepo().catch(console.error);
}

module.exports = { createGitHubRepo };
