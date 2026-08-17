#!/usr/bin/env node

/**
 * Codex CLI Assistant (`scripts/codex-cli.js`)
 * 
 * Interface de linha de comando para delegar tarefas ao Codex do ChatGPT
 * e permitir que a IA acesse páginas privadas logadas no seu navegador.
 */

const { runCodexTask } = require('./codex-bridge');
const { ensureAuthenticated, fetchAuthenticatedPage } = require('./codex-auth-assistant');
const { checkStatus } = require('./browser-auth');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    if (command === 'run' || command === 'task') {
        const taskPrompt = args.slice(1).join(' ');
        if (!taskPrompt) {
            console.error('❌ Por favor, informe a tarefa para o Codex. Exemplo:\n   npm run codex "Verifique minhas rotas e logs na Vercel https://vercel.com/dashboard"');
            process.exit(1);
        }
        await runCodexTask(taskPrompt);
    } else if (command === 'setup' || command === 'login') {
        const targetUrl = args[1] || 'https://vercel.com/login';
        console.log(`\n🔐 Abrindo ambiente de login para: ${targetUrl}`);
        await ensureAuthenticated(targetUrl);
    } else if (command === 'inspect') {
        const targetUrl = args[1];
        if (!targetUrl) {
            console.error('❌ Informe a URL. Exemplo:\n   node scripts/codex-cli.js inspect https://vercel.com/dashboard');
            process.exit(1);
        }
        const result = await fetchAuthenticatedPage(targetUrl, { screenshotPath: 'page_inspect.png' });
        console.log('\n📄 Resultado da Inspeção Autenticada:', JSON.stringify(result, null, 2));
    } else if (command === 'status') {
        await checkStatus();
    } else {
        console.log(`
======================================================
 🛠️ CODEX CHATGPT & AUTH ASSISTANT CLI
======================================================

Uso do sistema:
  npm run codex "sua tarefa aqui"               Envia uma tarefa ao Codex ChatGPT
  npm run codex:setup [URL]                      Abre o navegador para você efetuar login 1x
  npm run codex:status                         Verifica o status das sessões salvas nos sites

Exemplos:
  npm run codex "Consulte minhas aplicações em https://vercel.com/dashboard e verifique os logs de erro"
  npm run codex "Verifique meu status de deploy no Render https://dashboard.render.com/"
  npm run codex:setup https://github.com/login
`);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal Error:', err);
        process.exit(1);
    });
}
