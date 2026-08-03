/* ==========================================================================
   NativeBuilder AI Ecosystem Suite — Application Engine
   Apps: 1. NativeFactory AI | 2. OmniInsight AI | 3. CanvasMind AI
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
                version: "3.0.0",
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
);`,
            api: `{"openapi": "3.0.0", "info": {"title": "FinTech AI Copilot API", "version": "1.0.0"}}`,
            components: `AppLayout -> Header -> AnalyticsOverview -> InvoiceManager -> AIChatDrawer`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FinTech AI Copilot</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans',sans-serif;}body{background:#0b0f19;color:#f8fafc;padding:24px;}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:24px;}.card{background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;}.card-val{font-size:28px;font-weight:700;margin:8px 0;color:#38bdf8;}.tag{font-size:11px;background:rgba(52,211,153,0.15);color:#34d399;padding:4px 8px;border-radius:6px;}.ai-banner{background:linear-gradient(135deg,rgba(56,189,248,0.15),rgba(168,85,247,0.15));border:1px solid #38bdf8;border-radius:12px;padding:20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;}.btn{background:#38bdf8;color:#000;font-weight:700;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;}</style></head><body><div class="header"><h2><i class="fa-solid fa-chart-pie" style="color:#38bdf8"></i> FinTech AI Copilot</h2><span class="tag"><i class="fa-solid fa-robot"></i> AI Forecast Agent Active</span></div><div class="ai-banner"><div><h3><i class="fa-solid fa-sparkles" style="color:#a855f7"></i> AI Insight Alert</h3><p style="font-size:13px;color:#cbd5e1;margin-top:4px;">Previsão de entrada de R$ 14.500 nos próximos 15 dias.</p></div><button class="btn" onclick="alert('Ação executada!')">Executar Ação</button></div><div class="grid"><div class="card"><span style="color:#94a3b8;font-size:12px;">Saldo Atual</span><div class="card-val">R$ 42.850,00</div></div><div class="card"><span style="color:#94a3b8;font-size:12px;">Fluxo Previsto</span><div class="card-val">R$ 58.200,00</div></div><div class="card"><span style="color:#94a3b8;font-size:12px;">Faturas a Receber</span><div class="card-val">R$ 15.350,00</div></div></div></body></html>`
        },
        saas: {
            title: "Workflow Automator SaaS",
            prompt: "Plataforma de automação de fluxos estilo Zapier / n8n com agentes autônomos e webhooks.",
            spec: { projectName: "Workflow Automator SaaS", version: "1.8.2" },
            schema: `CREATE TABLE workflows ( id UUID PRIMARY KEY, title VARCHAR(100) );`,
            api: `{"endpoints": ["/api/v1/trigger"]}`,
            components: `WorkflowCanvas -> NodeCard -> TriggerSocket`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Workflow Engine</title><style>body{background:#090d16;color:#fff;font-family:sans-serif;padding:24px;}.box{background:#1e293b;padding:16px;border-radius:8px;border:1px solid #38bdf8;}</style></head><body><h2><i class="fa-solid fa-diagram-next"></i> Workflow Automator</h2><div class="box"><h4 style="color:#38bdf8">Trigger: Webhook Inbound</h4><p style="font-size:12px;color:#94a3b8;">Status: Active</p></div></body></html>`
        },
        ecommerce: {
            title: "Hyper-Personalized Store",
            prompt: "E-Commerce com IA nativa e recomendação em tempo real.",
            spec: { projectName: "Hyper-Personalized Store", version: "3.1.0" },
            schema: `CREATE TABLE products ( id UUID PRIMARY KEY, name VARCHAR(255) );`,
            api: `{"endpoints": ["/api/v1/recommendations"]}`,
            components: `StoreLayout -> HeroBanner -> ProductGrid`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Storefront</title><style>body{background:#0f172a;color:#fff;font-family:sans-serif;padding:24px;}.card{background:#1e293b;padding:16px;border-radius:8px;}</style></head><body><h2>AI Storefront</h2><div class="card"><h3>Headset Wireless Pro AI</h3><p style="color:#34d399;font-weight:bold;">R$ 899,00</p></div></body></html>`
        },
        health: {
            title: "HealthTech Diagnostic Hub",
            prompt: "Plataforma de triagem médica com assistente de IA.",
            spec: { projectName: "HealthTech Diagnostic Hub", version: "1.0.0" },
            schema: `CREATE TABLE appointments ( id UUID PRIMARY KEY );`,
            api: `{"endpoints": ["/api/v1/triage"]}`,
            components: `HealthDashboard -> SymptomChecker`,
            htmlCode: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>HealthTech Hub</title><style>body{background:#090d16;color:#fff;font-family:sans-serif;padding:24px;}</style></head><body><h2>HealthTech AI Triage</h2></body></html>`
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
        // Product Switcher (Factory vs OmniInsight vs CanvasMind)
        document.querySelectorAll('.product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const appTarget = btn.dataset.app;
                switchApp(appTarget);
            });
        });

        document.querySelectorAll('.template-card[data-app-select]').forEach(card => {
            card.addEventListener('click', () => {
                const appTarget = card.dataset.appSelect;
                switchApp(appTarget);
            });
        });

        // Sub Navigation Items
        document.querySelectorAll('.sub-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetTab = item.dataset.tab;
                document.querySelectorAll('.sub-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Find active app view
                const activeAppView = document.querySelector('.app-view.active');
                activeAppView.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const targetContent = activeAppView.querySelector(`#tab-${targetTab}`);
                if (targetContent) targetContent.classList.add('active');

                if (targetTab === 'sandbox') renderSandbox();
                if (targetTab === 'architecture') renderArchView();
                if (targetTab === 'pipeline') renderNodes();
            });
        });

        // Launch Pipeline Button
        document.getElementById('btn-generate').addEventListener('click', launchFactoryPipeline);

        // Run Test Suite Button
        const btnRunTests = document.getElementById('btn-run-tests');
        if (btnRunTests) {
            btnRunTests.addEventListener('click', () => {
                btnRunTests.innerText = 'Running Test Suite...';
                setTimeout(() => {
                    btnRunTests.innerText = 'Run All Automated Tests';
                    alert('✅ Todos os 4 testes automatizados passaram com 100% de sucesso!');
                }, 800);
            });
        }

        // OmniInsight Natural Language Query
        const btnRunQuery = document.getElementById('btn-run-query');
        if (btnRunQuery) {
            btnRunQuery.addEventListener('click', () => {
                const queryText = document.getElementById('query-input').value || "Qual a previsão de receita?";
                const outputCard = document.getElementById('query-output-card');
                const outputText = document.getElementById('query-output-text');

                outputCard.classList.remove('hidden');
                outputText.innerText = `[PROCESSED BY OMNIINSIGHT AI] Análise gerada para: "${queryText}":\n\n- Previsão de Crescimento Q3: +24.5%\n- Risco de Churn Identificado: 3 clientes com baixa retenção no segmento SaaS.\n- Recomendação Autônoma: Disparar fluxo de reengajamento via NativeBuilder Webhook.`;
            });
        }

        // CanvasMind Spatial Card Generator
        const btnCmAddCard = document.getElementById('btn-cm-add-card');
        if (btnCmAddCard) {
            btnCmAddCard.addEventListener('click', () => {
                const workspace = document.getElementById('spatial-workspace');
                const card = document.createElement('div');
                card.className = 'spatial-card';
                card.style.left = `${100 + Math.random() * 300}px`;
                card.style.top = `${100 + Math.random() * 200}px`;
                card.innerHTML = `
                    <div class="sp-header"><i class="fa-solid fa-cubes"></i> Dynamic UI Block</div>
                    <div class="sp-body">
                        <div class="sp-mockup glow">
                            <span class="sp-badge">AI Component</span>
                            <p style="font-size:11px; color:#cbd5e1;">Componente sintetizado com tokens Dark Mode WCAG AAA.</p>
                        </div>
                    </div>
                `;
                workspace.appendChild(card);
            });
        }

        // Architecture Sub-Tabs
        document.querySelectorAll('.arch-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.arch-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.currentArchView = tab.dataset.arch;
                renderArchView();
            });
        });

        // Export Modal Events
        document.getElementById('btn-export-native').addEventListener('click', openExportModal);
        document.getElementById('btn-close-modal').addEventListener('click', closeExportModal);
        
        document.getElementById('btn-dl-zip').addEventListener('click', () => {
            alert('📁 Baixando pacote Blueprint Zip completo para o NativeBuilder!');
        });

        document.getElementById('btn-push-native').addEventListener('click', () => {
            alert('🚀 Projeto publicado com sucesso na sua conta Natively.builder!');
        });

        document.getElementById('btn-copy-json').addEventListener('click', () => {
            const code = document.getElementById('modal-json-preview').innerText;
            navigator.clipboard.writeText(code);
            alert('📋 Manifest JSON copiado!');
        });

        document.getElementById('btn-copy-spec').addEventListener('click', () => {
            const code = document.getElementById('arch-code-content').innerText;
            navigator.clipboard.writeText(code);
            alert('📋 Código copiado!');
        });
    }

    // Switch Main App View
    function switchApp(appKey) {
        state.currentApp = appKey;

        document.querySelectorAll('.product-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.product-btn[data-app="${appKey}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`app-view-${appKey}`).classList.add('active');

        document.querySelectorAll('.sub-nav-group').forEach(g => g.classList.remove('active'));
        document.getElementById(`sub-nav-${appKey}`).classList.add('active');

        if (appKey === 'omni') {
            setTimeout(initRevenueChart, 200);
        }
    }

    // Initialize Chart.js for OmniInsight AI
    function initRevenueChart() {
        const ctx = document.getElementById('chart-revenue');
        if (!ctx || state.revenueChart) return;

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

        document.getElementById('prompt-input').value = data.prompt;
        document.getElementById('sandbox-app-name').innerText = data.title;
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
        statusChip.className = 'status-chip running';
        statusChip.innerText = 'Pipeline Active';

        const promptText = document.getElementById('prompt-input').value;
        appendLog(`[PROMPT] Received factory request: "${promptText.substring(0, 60)}..."`, 'info');

        setTimeout(() => {
            appendLog('[Spec Analyst Agent] Generating OpenAPI blueprint...', 'agent');
            setTimeout(() => {
                appendLog('[UI/UX Architect Agent] Synthesizing glassmorphism design tokens...', 'agent');
                setTimeout(() => {
                    appendLog('[QA & Security Inspector] Vulnerability audit... PASS 100%', 'success');
                    setTimeout(() => {
                        statusChip.className = 'status-chip done';
                        statusChip.innerText = 'Completed';
                        appendLog('🎉 [FACTORY SUCCESS] Multi-agent synthesis completed!', 'success');
                        state.isGenerating = false;
                    }, 800);
                }, 800);
            }, 800);
        }, 800);
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

            container.appendChild(el);
        });
    }

    // Export Modal Controls
    function openExportModal() {
        const modal = document.getElementById('export-modal');
        const jsonPreview = document.getElementById('modal-json-preview');
        
        const manifest = {
            suiteName: "NativeBuilder 3-in-1 AI Ecosystem",
            creator: "Frederico Alves",
            applications: ["NativeFactory AI", "OmniInsight AI", "CanvasMind AI"],
            exportTimestamp: new Date().toISOString(),
            vercelUrl: "https://gallant-borg.vercel.app"
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
