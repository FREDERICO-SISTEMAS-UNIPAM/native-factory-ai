/* ==========================================================================
   NativeBuilder AI Ecosystem Suite — Application Engine v3.5
   Author: Frederico Alves
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // State Store
    const state = {
        currentApp: 'factory',
        currentTab: 'studio',
        currentTemplate: 'fintech',
        currentArchView: 'spec',
        isGenerating: false,
        nodes: [],
        revenueChart: null
    };

    // Pre-loaded Application Blueprints
    const TEMPLATES = {
        fintech: {
            title: "FinTech AI Copilot Dashboard",
            prompt: "Crie um SaaS de Gestão Financeira para Freelancers e PMEs com IA que prevê fluxo de caixa para 90 dias, analisa faturas pendentes, gera relatórios automáticos e recomenda investimentos em renda fixa com envio via WhatsApp.",
            spec: {
                projectName: "FinTech AI Copilot",
                version: "3.5.0",
                targetFramework: "NativeBuilder Web App",
                architecture: "Microservices + Multi-Agent Orchestrator",
                database: "PostgreSQL + PGVector for AI Embeddings",
                agents: [
                    { name: "CashflowPredictorAgent", role: "Time Series & AI Financial Forecast" },
                    { name: "InvoiceInspectorAgent", role: "OCR Invoice Parser & Risk Assessment" },
                    { name: "WhatsAppNotifierAgent", role: "Twilio / WhatsApp Business API Trigger" }
                ],
                userStories: [
                    "Como usuário, quero visualizar meu saldo projetado para os próximos 3 meses.",
                    "Como usuário, quero receber alertas de clientes inadimplentes automaticamente."
                ]
            },
            schema: `-- PostgreSQL Database Schema for FinTech Copilot
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('INCOME', 'EXPENSE')),
    category VARCHAR(50) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING'
);

CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    predicted_balance DECIMAL(12,2),
    confidence_score FLOAT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`,
            api: `{
  "openapi": "3.0.0",
  "info": {
    "title": "FinTech AI Copilot API",
    "version": "3.5.0"
  },
  "paths": {
    "/api/v1/forecast": {
      "post": {
        "summary": "Generate AI Cashflow Prediction",
        "responses": {
          "200": { "description": "Returns 90-day predicted financial trend" }
        }
      }
    },
    "/api/v1/invoices/scan": {
      "post": {
        "summary": "Scan & Extract Invoice PDF data via OCR Agent",
        "responses": {
          "200": { "description": "Structured invoice JSON payload" }
        }
      }
    }
  }
}`,
            components: `AppLayout\n├── Header (Brand, UserProfile, AgentStatus)\n├── AnalyticsOverview (MetricCards, CashflowChart)\n├── InvoiceManager (DataTable, AI RiskBadge, RemindBtn)\n└── AIChatAssistantDrawer (StreamingLLM, ActionExecutor)`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FinTech AI Copilot</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans',sans-serif;}body{background:#0b0f19;color:#f8fafc;padding:24px;}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:24px;}.card{background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;}.card-val{font-size:28px;font-weight:700;margin:8px 0;color:#38bdf8;}.tag{font-size:11px;background:rgba(52,211,153,0.15);color:#34d399;padding:4px 8px;border-radius:6px;}.ai-banner{background:linear-gradient(135deg,rgba(56,189,248,0.15),rgba(168,85,247,0.15));border:1px solid #38bdf8;border-radius:12px;padding:20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;}.btn{background:#38bdf8;color:#000;font-weight:700;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;}.btn:hover{background:#7dd3fc;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{text-align:left;padding:12px;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;}th{color:#94a3b8;}</style></head><body><div class="header"><h2><i class="fa-solid fa-chart-pie" style="color:#38bdf8"></i> FinTech AI Copilot</h2><span class="tag"><i class="fa-solid fa-robot"></i> AI Forecast Agent Active</span></div><div class="ai-banner"><div><h3><i class="fa-solid fa-sparkles" style="color:#a855f7"></i> AI Insight Alert</h3><p style="font-size:13px;color:#cbd5e1;margin-top:4px;">Previsão de entrada de R$ 14.500 nos próximos 15 dias. Recomendado alocar R$ 4.000 em Reserva de Emergência.</p></div><button class="btn" onclick="alert('Ação executada com sucesso!')">Executar Ação</button></div><div class="grid"><div class="card"><span style="color:#94a3b8;font-size:12px;">Saldo Atual</span><div class="card-val">R$ 42.850,00</div><span style="color:#34d399;font-size:12px;"><i class="fa-solid fa-arrow-up"></i> +12.4% este mês</span></div><div class="card"><span style="color:#94a3b8;font-size:12px;">Fluxo Previsto (30 dias)</span><div class="card-val">R$ 58.200,00</div><span style="color:#38bdf8;font-size:12px;"><i class="fa-solid fa-brain"></i> Confiança de 96%</span></div><div class="card"><span style="color:#94a3b8;font-size:12px;">Faturas a Receber</span><div class="card-val">R$ 15.350,00</div><span style="color:#fb923c;font-size:12px;"><i class="fa-solid fa-triangle-exclamation"></i> 2 em atraso</span></div></div><div class="card"><h3><i class="fa-solid fa-list-check"></i> Faturas Recentes & Risco AI</h3><table><thead><tr><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação AI</th></tr></thead><tbody><tr><td>Acme Corp Brasil</td><td>10/08/2026</td><td>R$ 8.500,00</td><td><span style="color:#34d399;">Pago</span></td><td>-</td></tr><tr><td>Studio Design Ltda</td><td>01/08/2026</td><td>R$ 4.200,00</td><td><span style="color:#fb923c;">Atrasado (2 dias)</span></td><td><button class="btn" style="padding:4px 10px;font-size:11px;" onclick="alert('Lembrete WhatsApp enviado via AI Agent!')">Cobrar via WhatsApp</button></td></tr></tbody></table></div></body></html>`
        },
        saas: {
            title: "Workflow Automator SaaS",
            prompt: "Plataforma de automação de fluxos estilo Zapier / n8n onde agentes autônomos escutam webhooks, processam dados com LLM e disparam chamadas de API externas.",
            spec: { projectName: "Workflow Automator SaaS", version: "1.8.2" },
            schema: `CREATE TABLE workflows ( id UUID PRIMARY KEY, title VARCHAR(100), trigger_type VARCHAR(50), active_agents INTEGER DEFAULT 1 );`,
            api: `{"endpoints": ["/api/v1/trigger", "/api/v1/agents/run"]}`,
            components: `WorkflowCanvas -> NodeCard -> TriggerSocket -> AgentAction`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Workflow Engine</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>body{background:#090d16;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;padding:24px;}.node-box{background:rgba(30,41,59,0.8);border:1px solid #38bdf8;border-radius:12px;padding:16px;margin-bottom:16px;width:300px;}.node-title{font-weight:700;color:#38bdf8;display:flex;align-items:center;gap:8px;}.btn-run{background:#a855f7;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer;}</style></head><body><h2><i class="fa-solid fa-diagram-next" style="color:#a855f7"></i> Live Workflow Engine</h2><p style="color:#94a3b8;margin-bottom:20px;">Orquestração de Agentes Autônomos em Tempo Real</p><div class="node-box"><div class="node-title"><i class="fa-solid fa-bolt"></i> Trigger: Webhook Inbound</div><p style="font-size:12px;color:#cbd5e1;margin-top:6px;">Escutando evento: <code>order.created</code></p></div><div style="margin-left:40px;border-left:2px dashed #a855f7;height:30px;"></div><div class="node-box"><div class="node-title"><i class="fa-solid fa-brain"></i> AI Agent: Summarizer</div><p style="font-size:12px;color:#cbd5e1;margin-top:6px;">Processando payload com Gemini 3.6</p></div><button class="btn-run" onclick="alert('Fluxo executado com sucesso!')"><i class="fa-solid fa-play"></i> Testar Execução</button></body></html>`
        },
        ecommerce: {
            title: "Hyper-Personalized Store",
            prompt: "E-Commerce com IA nativa que recomenda produtos personalizados em tempo real com base no comportamento do usuário e checkout simplificado Pix.",
            spec: { projectName: "Hyper-Personalized Store", version: "3.1.0" },
            schema: `CREATE TABLE products ( id UUID PRIMARY KEY, name VARCHAR(255), price DECIMAL(10,2) );`,
            api: `{"endpoints": ["/api/v1/recommendations"]}`,
            components: `StoreLayout -> HeroBanner -> ProductGrid -> AICartDrawer`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Storefront</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>body{background:#0f172a;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;padding:24px;}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:20px;}.card{background:#1e293b;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.1);}.price{font-size:20px;font-weight:700;color:#34d399;margin:8px 0;}.buy-btn{background:#34d399;color:#000;font-weight:700;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;width:100%;}</style></head><body><h2><i class="fa-solid fa-bag-shopping" style="color:#34d399"></i> AI Storefront</h2><p style="color:#94a3b8;">Recomendações em tempo real alimentadas por NativeBuilder AI</p><div class="grid"><div class="card"><h3>Headset Wireless Pro AI</h3><p style="font-size:12px;color:#94a3b8;">Recomendado para o seu perfil</p><div class="price">R$ 899,00</div><button class="buy-btn" onclick="alert('Item adicionado ao carrinho com desconto AI!')">Comprar Agora</button></div><div class="card"><h3>Teclado Mecânico Ergostep</h3><p style="font-size:12px;color:#94a3b8;">98% de afinidade</p><div class="price">R$ 549,00</div><button class="buy-btn" onclick="alert('Item adicionado ao carrinho!')">Comprar Agora</button></div></div></body></html>`
        },
        health: {
            title: "HealthTech Diagnostic Hub",
            prompt: "Plataforma de triagem médica e acompanhamento de pacientes com agente de IA em conformidade com a LGPD e agendamento automático.",
            spec: { projectName: "HealthTech Diagnostic Hub", version: "1.0.0" },
            schema: `CREATE TABLE appointments ( id UUID PRIMARY KEY, patient_name VARCHAR(255) );`,
            api: `{"endpoints": ["/api/v1/triage"]}`,
            components: `HealthDashboard -> SymptomChecker -> AppointmentCalendar`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HealthTech Hub</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>body{background:#090d16;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;padding:24px;}.box{background:#1e293b;padding:20px;border-radius:12px;border:1px solid #f472b6;}</style></head><body><h2><i class="fa-solid fa-heart-pulse" style="color:#f472b6"></i> HealthTech AI Triage</h2><div class="box" style="margin-top:20px;"><h3>Triagem Médica Assistida</h3><p style="font-size:13px;color:#cbd5e1;margin-top:8px;">O assistente de IA identificou baixa prioridade. Recomendado agendamento de teleconsulta.</p><button style="background:#f472b6;color:#000;font-weight:700;border:none;padding:10px 18px;border-radius:8px;margin-top:12px;cursor:pointer;" onclick="alert('Teleconsulta agendada!')">Agendar Teleconsulta</button></div></body></html>`
        }
    };

    // Initialize Canvas Agent Nodes
    const INITIAL_NODES = [
        { id: 'node-spec', title: 'Spec Analyst Agent', role: 'Requirements & Blueprint', icon: 'fa-brain', x: 50, y: 100 },
        { id: 'node-ux', title: 'UI/UX Architect', role: 'Design System & Token Synth', icon: 'fa-palette', x: 320, y: 80 },
        { id: 'node-dev', title: 'Code Synthesis Dev', role: 'HTML/CSS/JS Engine', icon: 'fa-code', x: 590, y: 160 },
        { id: 'node-qa', title: 'QA & Security Guard', role: 'Linter & Vulnerability Scan', icon: 'fa-shield-halved', x: 860, y: 100 },
        { id: 'node-native', title: 'NativeBuilder Publisher', role: 'Natively.builder Deployer', icon: 'fa-cloud-arrow-up', x: 1130, y: 140 }
    ];

    // Initialize App
    function init() {
        state.nodes = [...INITIAL_NODES];
        bindEvents();
        loadTemplate('fintech');
        renderNodes();
    }

    // Event Binds
    function bindEvents() {
        // 1. Top Level Product Switcher (Factory vs OmniInsight vs CanvasMind)
        document.querySelectorAll('.product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const appTarget = btn.dataset.app;
                switchApp(appTarget);
            });
        });

        // 2. Sidebar App Selectors
        document.querySelectorAll('.template-card[data-app-select]').forEach(card => {
            card.addEventListener('click', () => {
                const appTarget = card.dataset.appSelect;
                switchApp(appTarget);
            });
        });

        // 3. Sub Navigation Buttons
        document.querySelectorAll('.sub-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.dataset.tab;
                switchSubTab(targetTab);
            });
        });

        // 4. Launch Factory Pipeline Button
        const btnGenerate = document.getElementById('btn-generate');
        if (btnGenerate) {
            btnGenerate.addEventListener('click', launchFactoryPipeline);
        }

        // 5. Run Test Suite Button
        const btnRunTests = document.getElementById('btn-run-tests');
        if (btnRunTests) {
            btnRunTests.addEventListener('click', () => {
                btnRunTests.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running Test Suite...';
                setTimeout(() => {
                    btnRunTests.innerHTML = '<i class="fa-solid fa-play"></i> Run All Automated Tests';
                    alert('✅ Todos os 4 testes automatizados executaram e passaram com 100% de sucesso!');
                }, 800);
            });
        }

        // 6. OmniInsight Natural Language Query Button
        const btnRunQuery = document.getElementById('btn-run-query');
        if (btnRunQuery) {
            btnRunQuery.addEventListener('click', () => {
                const queryText = document.getElementById('query-input').value || "Qual a previsão de receita para o próximo trimestre?";
                const outputCard = document.getElementById('query-output-card');
                const outputText = document.getElementById('query-output-text');

                outputCard.classList.remove('hidden');
                outputText.innerHTML = `<strong>[OMNIINSIGHT AI ANALYSIS FOR: "${queryText}"]</strong><br><br>
                • <strong>Previsão de Crescimento Q3:</strong> +24.5% de incremento no MRR.<br>
                • <strong>Score de Saúde dos Clientes:</strong> 94% de retenção ativa no segmento PME.<br>
                • <strong>Ação Recomendada:</strong> Ativar fluxo automático de cobrança via Pix para 3 faturas pendentes.<br>
                • <strong>Integração Natively:</strong> Webhook <code>omni.mrr.forecast</code> disparado com sucesso!`;
            });
        }

        // 7. OmniInsight Sync Button
        const btnSyncOmni = document.getElementById('btn-sync-omni');
        if (btnSyncOmni) {
            btnSyncOmni.addEventListener('click', () => {
                alert('🔄 Dados sincronizados em tempo real com Natively.builder!');
                initRevenueChart();
            });
        }

        // 8. CanvasMind Spatial Card Buttons
        const btnCmAddCard = document.getElementById('btn-cm-add-card');
        if (btnCmAddCard) {
            btnCmAddCard.addEventListener('click', () => {
                const workspace = document.getElementById('spatial-workspace');
                const card = document.createElement('div');
                card.className = 'spatial-card';
                card.style.left = `${80 + Math.random() * 320}px`;
                card.style.top = `${80 + Math.random() * 220}px`;
                card.innerHTML = `
                    <div class="sp-header"><i class="fa-solid fa-cubes"></i> Wireframe Card #${document.querySelectorAll('.spatial-card').length + 1}</div>
                    <div class="sp-body">
                        <div class="sp-mockup glow">
                            <span class="sp-badge">AI Component</span>
                            <p style="font-size:11px; color:#cbd5e1;">Componente sintetizado com tokens Dark Mode WCAG AAA.</p>
                        </div>
                    </div>
                `;
                makeCardDraggable(card);
                workspace.appendChild(card);
            });
        }

        const btnCmGenerateUi = document.getElementById('btn-cm-generate-ui');
        if (btnCmGenerateUi) {
            btnCmGenerateUi.addEventListener('click', () => {
                const compPrompt = prompt("Descreva o componente UI que deseja gerar com IA:", "Card de Checkout Pix com Dark Mode");
                if (compPrompt) {
                    alert(`✨ Componente "${compPrompt}" sintetizado e adicionado ao Canvas Spatial!`);
                    const btnAdd = document.getElementById('btn-cm-add-card');
                    if (btnAdd) btnAdd.click();
                }
            });
        }

        // 9. Architecture Sub-Tabs
        document.querySelectorAll('.arch-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.arch-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentArchView = tab.dataset.arch;
                renderArchView();
            });
        });

        // 10. Device Viewport Toggles in Sandbox
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const device = btn.dataset.device;
                const wrapper = document.getElementById('sandbox-wrapper');
                if (wrapper) wrapper.className = `sandbox-frame-wrapper ${device}`;
            });
        });

        // 11. Refresh Sandbox Button
        const btnRefreshSandbox = document.getElementById('btn-refresh-sandbox');
        if (btnRefreshSandbox) {
            btnRefreshSandbox.addEventListener('click', () => {
                renderSandbox();
                alert('🔄 Sandbox atualizado!');
            });
        }

        // 12. Export Modal Controls
        const btnExportNative = document.getElementById('btn-export-native');
        if (btnExportNative) btnExportNative.addEventListener('click', openExportModal);

        const btnCloseModal = document.getElementById('btn-close-modal');
        if (btnCloseModal) btnCloseModal.addEventListener('click', closeExportModal);
        
        const btnDlZip = document.getElementById('btn-dl-zip');
        if (btnDlZip) {
            btnDlZip.addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                    appName: "NativeBuilder 3-in-1 Ecosystem Suite",
                    author: "Frederico Alves",
                    github: "https://github.com/FREDERICO-SISTEMAS-UNIPAM/native-factory-ai",
                    vercel: "https://gallant-borg.vercel.app",
                    nativeBuilderSpecVersion: "3.5.0"
                }, null, 2));
                const dlAnchor = document.createElement('a');
                dlAnchor.setAttribute("href", dataStr);
                dlAnchor.setAttribute("download", "NativeBuilder-Blueprint-Bundle.json");
                document.body.appendChild(dlAnchor);
                dlAnchor.click();
                dlAnchor.remove();
                alert('📁 Download do arquivo Blueprint Bundle JSON iniciado com sucesso!');
            });
        }

        const btnPushNative = document.getElementById('btn-push-native');
        if (btnPushNative) {
            btnPushNative.addEventListener('click', () => {
                btnPushNative.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deploying...';
                setTimeout(() => {
                    btnPushNative.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Deploy Project';
                    alert('🚀 Projeto publicado e sincronizado com sucesso na sua conta Natively.builder!');
                }, 900);
            });
        }

        const btnCopyJson = document.getElementById('btn-copy-json');
        if (btnCopyJson) {
            btnCopyJson.addEventListener('click', () => {
                const code = document.getElementById('modal-json-preview').innerText;
                navigator.clipboard.writeText(code);
                alert('📋 Manifest JSON copiado para a área de transferência!');
            });
        }

        const btnCopySpec = document.getElementById('btn-copy-spec');
        if (btnCopySpec) {
            btnCopySpec.addEventListener('click', () => {
                const code = document.getElementById('arch-code-content').innerText;
                navigator.clipboard.writeText(code);
                alert('📋 Código da especificação copiado!');
            });
        }

        // 13. Canvas Toolbar Buttons
        const btnAddAgent = document.getElementById('btn-add-agent');
        if (btnAddAgent) {
            btnAddAgent.addEventListener('click', () => {
                const customTitle = prompt("Nome do Novo Agente de IA:", "Custom Security Auditor");
                if (customTitle) {
                    const newNode = {
                        id: `node-${Date.now()}`,
                        title: customTitle,
                        role: 'Custom Workflow Agent',
                        icon: 'fa-robot',
                        x: 350 + Math.random() * 250,
                        y: 120 + Math.random() * 120
                    };
                    state.nodes.push(newNode);
                    renderNodes();
                }
            });
        }

        const btnRunCanvas = document.getElementById('btn-run-canvas');
        if (btnRunCanvas) {
            btnRunCanvas.addEventListener('click', () => {
                simulateCanvasExecution();
            });
        }

        const btnResetCanvas = document.getElementById('btn-reset-canvas');
        if (btnResetCanvas) {
            btnResetCanvas.addEventListener('click', () => {
                state.nodes = [...INITIAL_NODES];
                renderNodes();
            });
        }

        // Make Spatial Cards Draggable
        document.querySelectorAll('.spatial-card').forEach(card => {
            makeCardDraggable(card);
        });
    }

    // Switch Main App View (Factory vs Omni vs Canvas)
    function switchApp(appKey) {
        state.currentApp = appKey;

        // Header product buttons
        document.querySelectorAll('.product-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.app === appKey) b.classList.add('active');
        });

        // Sidebar template cards
        document.querySelectorAll('.template-card[data-app-select]').forEach(c => {
            c.classList.remove('active');
            if (c.dataset.appSelect === appKey) c.classList.add('active');
        });

        // App views
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`app-view-${appKey}`);
        if (targetView) targetView.classList.add('active');

        // Sub nav groups
        document.querySelectorAll('.sub-nav-group').forEach(g => g.classList.remove('active'));
        const targetNavGroup = document.getElementById(`sub-nav-${appKey}`);
        if (targetNavGroup) {
            targetNavGroup.classList.add('active');
            // Trigger click on first sub-nav item
            const firstItem = targetNavGroup.querySelector('.sub-nav-item');
            if (firstItem) {
                document.querySelectorAll('.sub-nav-item').forEach(i => i.classList.remove('active'));
                firstItem.classList.add('active');
                switchSubTab(firstItem.dataset.tab);
            }
        }

        if (appKey === 'omni') {
            setTimeout(initRevenueChart, 200);
        }
    }

    // Switch Sub-Tab inside Active App View
    function switchSubTab(tabKey) {
        state.currentTab = tabKey;

        const activeAppView = document.querySelector('.app-view.active');
        if (!activeAppView) return;

        // Sub nav button active state
        document.querySelectorAll('.sub-nav-group.active .sub-nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.tab === tabKey) item.classList.add('active');
        });

        // Tab content active state
        activeAppView.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetTabContent = activeAppView.querySelector(`#tab-${tabKey}`);
        if (targetTabContent) targetTabContent.classList.add('active');

        if (tabKey === 'sandbox') renderSandbox();
        if (tabKey === 'architecture') renderArchView();
        if (tabKey === 'pipeline') renderNodes();
        if (tabKey === 'bi-dashboard') setTimeout(initRevenueChart, 100);
    }

    // Initialize Chart.js for OmniInsight AI
    function initRevenueChart() {
        const ctx = document.getElementById('chart-revenue');
        if (!ctx) return;

        if (state.revenueChart) {
            state.revenueChart.destroy();
            state.revenueChart = null;
        }

        state.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul (AI Forecast)', 'Ago (AI Forecast)'],
                datasets: [
                    {
                        label: 'Receita Realizada (R$)',
                        data: [65000, 72000, 84000, 91000, 105000, 128450, null, null],
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Previsão AI OmniInsight (R$)',
                        data: [null, null, null, null, null, 128450, 145000, 168000],
                        borderColor: '#a855f7',
                        borderDash: [5, 5],
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } } }
                },
                scales: {
                    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // Load Template Data
    function loadTemplate(templateKey) {
        state.currentTemplate = templateKey;
        const data = TEMPLATES[templateKey];
        if (!data) return;

        const promptInput = document.getElementById('prompt-input');
        if (promptInput) promptInput.value = data.prompt;

        const appNameEl = document.getElementById('sandbox-app-name');
        if (appNameEl) appNameEl.innerText = data.title;

        renderSandbox();
        renderArchView();
    }

    // Log to Telemetry Terminal
    function appendLog(message, type = 'info') {
        const terminal = document.getElementById('terminal-logs');
        if (!terminal) return;
        const line = document.createElement('div');
        line.className = `log-line ${type}`;

        const timestamp = new Date().toLocaleTimeString();
        line.innerText = `[${timestamp}] ${message}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Pipeline Execution Engine
    function launchFactoryPipeline() {
        if (state.isGenerating) return;
        state.isGenerating = true;

        const statusChip = document.getElementById('pipeline-status');
        if (statusChip) {
            statusChip.className = 'status-chip running';
            statusChip.innerText = 'Pipeline Active';
        }

        const promptText = document.getElementById('prompt-input').value;
        appendLog(`[PROMPT] Received factory request: "${promptText.substring(0, 60)}..."`, 'info');

        setTimeout(() => {
            appendLog('[Spec Analyst Agent] Generating OpenAPI blueprint...', 'agent');
            setTimeout(() => {
                appendLog('[UI/UX Architect Agent] Synthesizing glassmorphism design tokens...', 'agent');
                setTimeout(() => {
                    appendLog('[QA & Security Inspector] Vulnerability audit... PASS 100%', 'success');
                    setTimeout(() => {
                        if (statusChip) {
                            statusChip.className = 'status-chip done';
                            statusChip.innerText = 'Completed';
                        }
                        appendLog('🎉 [FACTORY SUCCESS] Multi-agent synthesis completed!', 'success');
                        state.isGenerating = false;
                        switchSubTab('sandbox');
                    }, 600);
                }, 600);
            }, 600);
        }, 600);
    }

    // Render Sandbox Iframe
    function renderSandbox() {
        const data = TEMPLATES[state.currentTemplate];
        if (!data) return;

        const iframe = document.getElementById('sandbox-iframe');
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(data.htmlCode);
        doc.close();
    }

    // Render Architecture Code Viewer
    function renderArchView() {
        const data = TEMPLATES[state.currentTemplate];
        if (!data) return;

        const titleEl = document.getElementById('arch-file-title');
        const codeEl = document.getElementById('arch-code-content');
        if (!titleEl || !codeEl) return;

        if (state.currentArchView === 'spec') {
            titleEl.innerText = 'requirements_specification.json';
            codeEl.innerText = JSON.stringify(data.spec, null, 2);
        } else if (state.currentArchView === 'schema') {
            titleEl.innerText = 'database_schema.sql';
            codeEl.innerText = data.schema;
        } else if (state.currentArchView === 'api') {
            titleEl.innerText = 'openapi_specification.json';
            codeEl.innerText = typeof data.api === 'string' ? data.api : JSON.stringify(data.api, null, 2);
        } else if (state.currentArchView === 'components') {
            titleEl.innerText = 'component_tree.txt';
            codeEl.innerText = data.components;
        }
    }

    // Render Canvas Agent Nodes & Lines
    function renderNodes() {
        const container = document.getElementById('nodes-container');
        const svg = document.getElementById('canvas-connections');
        if (!container || !svg) return;
        container.innerHTML = '';
        svg.innerHTML = '';

        state.nodes.forEach((node) => {
            const el = document.createElement('div');
            el.className = 'agent-node';
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;

            el.innerHTML = `
                <div class="node-header">
                    <div class="node-icon"><i class="fa-solid ${node.icon}"></i></div>
                    <div>
                        <div class="node-title">${node.title}</div>
                        <div class="node-role">${node.role}</div>
                    </div>
                </div>
            `;

            makeCardDraggable(el);
            container.appendChild(el);
        });

        drawConnections();
    }

    // Draw SVG Connector Lines between Nodes
    function drawConnections() {
        const svg = document.getElementById('canvas-connections');
        if (!svg) return;
        svg.innerHTML = '';

        for (let i = 0; i < state.nodes.length - 1; i++) {
            const source = state.nodes[i];
            const target = state.nodes[i + 1];

            const x1 = source.x + 220;
            const y1 = source.y + 40;
            const x2 = target.x;
            const y2 = target.y + 40;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const dx = (x2 - x1) * 0.5;
            const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            path.setAttribute('d', d);
            path.setAttribute('stroke', '#38bdf8');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-dasharray', '4 4');

            svg.appendChild(path);
        }
    }

    // Canvas Execution Animation
    function simulateCanvasExecution() {
        const nodesEls = document.querySelectorAll('.agent-node');
        nodesEls.forEach((el, idx) => {
            setTimeout(() => {
                el.classList.add('active-exec');
                setTimeout(() => {
                    el.classList.remove('active-exec');
                }, 800);
            }, idx * 600);
        });
    }

    // Make Any Card Draggable
    function makeCardDraggable(el) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        el.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(el.style.left, 10) || 0;
            initialY = parseInt(el.style.top, 10) || 0;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${initialX + dx}px`;
            el.style.top = `${initialY + dy}px`;
            drawConnections();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Export Modal Controls
    function openExportModal() {
        const modal = document.getElementById('export-modal');
        const jsonPreview = document.getElementById('modal-json-preview');
        
        const manifest = {
            suiteName: "NativeBuilder 3-in-1 AI Ecosystem Suite",
            creator: "Frederico Alves",
            applications: ["NativeFactory AI", "OmniInsight AI", "CanvasMind AI"],
            exportTimestamp: new Date().toISOString(),
            vercelUrl: "https://gallant-borg.vercel.app",
            github: "https://github.com/FREDERICO-SISTEMAS-UNIPAM/native-factory-ai"
        };

        jsonPreview.innerText = JSON.stringify(manifest, null, 2);
        modal.classList.remove('hidden');
    }

    function closeExportModal() {
        document.getElementById('export-modal').classList.add('hidden');
    }

    // Start App
    init();
});
