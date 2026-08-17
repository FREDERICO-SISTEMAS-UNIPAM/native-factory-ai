/**
 * Codex Bridge (`scripts/codex-bridge.js`)
 * 
 * Orquestrador de tarefas do Codex do ChatGPT com suporte a auxílio de autenticação web
 * e integração direta com a aba Web do ChatGPT (chatgpt.com).
 */

const { fetchAuthenticatedPage, executeAuthenticatedActions } = require('./codex-auth-assistant');
const { sendToChatGPTWeb } = require('./chatgpt-tab-assistant');

/**
 * Extrai URLs da instrução do usuário
 */
function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    return matches.map(u => u.replace(/[.,;)]+$/, ''));
}

/**
 * Executa uma tarefa orquestrada entre o Codex e a Aba Web do ChatGPT
 */
async function runCodexTask(userTaskPrompt) {
    console.log('\n======================================================');
    console.log(' 🚀 CODEX TASK MANAGER & CHATGPT WEB INTEGRATION');
    console.log('======================================================');
    console.log(`📋 Tarefa Recebida: "${userTaskPrompt}"\n`);

    // 1. Injetar e enviar a solicitação diretamente na aba logada do ChatGPT (chatgpt.com)
    console.log('💬 [BRIDGE] Enviando solicitação para a sua aba logada do ChatGPT Web...');
    await sendToChatGPTWeb(userTaskPrompt);

    const detectedUrls = extractUrls(userTaskPrompt);
    const pageContexts = [];

    // 2. Se houver URLs na mensagem, busca os dados de acesso autenticado
    if (detectedUrls.length > 0) {
        console.log(`🔍 [BRIDGE] Detectadas ${detectedUrls.length} URL(s) na tarefa. Buscando acesso autenticado...`);
        for (const url of detectedUrls) {
            try {
                const pageData = await fetchAuthenticatedPage(url);
                if (pageData.success) {
                    pageContexts.push(pageData);
                }
            } catch (err) {
                console.error(`⚠️ Não foi possível acessar a URL ${url}: ${err.message}`);
            }
        }
    }

    const resultReport = [];
    resultReport.push(`### Relatório da Integração Codex ChatGPT Web`);
    resultReport.push(`**Instrução enviada para a aba do ChatGPT**: ${userTaskPrompt}\n`);
    resultReport.push(`✅ **Aba do ChatGPT**: A solicitação foi digitada e enviada com sucesso no campo de chat do ChatGPT logado.`);

    if (pageContexts.length > 0) {
        resultReport.push(`\n#### Páginas Autenticadas Consultadas (${pageContexts.length}):`);
        for (const p of pageContexts) {
            resultReport.push(`- **Título**: ${p.title}`);
            resultReport.push(`- **URL Final**: ${p.url}`);
        }
    }

    const finalReportText = resultReport.join('\n');

    console.log('======================================================');
    console.log(' 📊 RELATÓRIO FINAL');
    console.log('======================================================');
    console.log(finalReportText);
    console.log('======================================================\n');

    return finalReportText;
}

module.exports = { runCodexTask, extractUrls };
