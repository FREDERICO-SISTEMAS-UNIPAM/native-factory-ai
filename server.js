const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 3000;
const STORES_FILE = path.join(__dirname, 'data', 'stores.json');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// In-Memory State
let stores = [];
let driverGps = { lat: null, lng: null, accuracy: null, active: false, updatedAt: 0 };
let armedStores = new Map(); // senderPhone -> { store, distanceKm, armedAt, groupJid }
let waSock = null;
let waStatus = { connected: false, qr: null, user: null };

// Load stores database
function loadStores() {
    try {
        if (fs.existsSync(STORES_FILE)) {
            const data = fs.readFileSync(STORES_FILE, 'utf8');
            stores = JSON.parse(data);
        } else {
            stores = [];
        }
    } catch (err) {
        console.error('[SERVER] Erro ao carregar stores.json:', err);
        stores = [];
    }
}

function saveStores() {
    try {
        fs.writeFileSync(STORES_FILE, JSON.stringify(stores, null, 2), 'utf8');
    } catch (err) {
        console.error('[SERVER] Erro ao salvar stores.json:', err);
    }
}

loadStores();

// Utility: Clean phone number
function cleanNumber(numStr) {
    if (!numStr) return '';
    return numStr.toString().replace(/\D/g, '');
}

// Utility: Flexible phone number matching
function matchPhoneNumber(num1, num2) {
    const c1 = cleanNumber(num1);
    const c2 = cleanNumber(num2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.endsWith(c2) || c2.endsWith(c1)) return true;
    if (c1.length >= 8 && c2.length >= 8) {
        return c1.slice(-8) === c2.slice(-8);
    }
    return false;
}

// Haversine Distance Formula in Kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Broadcast JSON message to all connected WebSocket clients
function broadcastToClients(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// ----------------------------------------------------
// WHATSAPP BAILEYS BOT ENGINE
// ----------------------------------------------------
async function connectToWhatsApp() {
    const authDir = path.join(__dirname, 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`[WHATSAPP] Iniciando Baileys v${version.join('.')}...`);

    waSock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Radar de Rotas Patos', 'Chrome', '1.0.0']
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                waStatus = { connected: false, qr: qrDataUrl, user: null };
                console.log('[WHATSAPP] Novo QR Code gerado!');
                broadcastToClients({ type: 'whatsapp_status', status: waStatus });
            } catch (err) {
                console.error('[WHATSAPP] Erro ao gerar DataURL do QRCode:', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('[WHATSAPP] Conexão fechada. Reconectar?:', shouldReconnect);
            waStatus = { connected: false, qr: null, user: null };
            broadcastToClients({ type: 'whatsapp_status', status: waStatus });

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            console.log('[WHATSAPP] Conexão estabelecida com sucesso!');
            waStatus = {
                connected: true,
                qr: null,
                user: waSock.user ? (waSock.user.name || waSock.user.id.split(':')[0]) : 'Conectado'
            };
            broadcastToClients({ type: 'whatsapp_status', status: waStatus });
        }
    });

    // PASSO 1: MONITORAMENTO DE DIGITAÇÃO (composing)
    waSock.ev.on('presence.update', async (update) => {
        const { id: groupJid, presences } = update;
        if (!presences) return;

        for (const [participantJid, pres] of Object.entries(presences)) {
            if (pres.lastKnownPresence === 'composing' || pres.lastKnownPresence === 'recording') {
                const senderPhone = cleanNumber(participantJid);

                // Check against active registered stores
                const matchingStore = stores.find(s => s.active && matchPhoneNumber(s.whatsappNumber, senderPhone));

                if (matchingStore) {
                    if (!driverGps || !driverGps.active || driverGps.lat == null) {
                        console.log(`[RADAR] Empresa ${matchingStore.name} está digitando, mas GPS da moto está desligado.`);
                        broadcastToClients({
                            type: 'log_event',
                            message: `⚠️ ${matchingStore.name} digitando, mas seu GPS está desligado.`
                        });
                        continue;
                    }

                    const distKm = calculateDistanceKm(driverGps.lat, driverGps.lng, matchingStore.latitude, matchingStore.longitude);
                    const formattedDist = parseFloat(distKm.toFixed(2));

                    if (distKm <= matchingStore.maxRadiusKm) {
                        // ENGATILHA A RESPOSTA!
                        armedStores.set(senderPhone, {
                            store: matchingStore,
                            distanceKm: formattedDist,
                            armedAt: Date.now(),
                            groupJid,
                            participantJid
                        });

                        console.log(`[RADAR 🎯 ENGATILHADO] ${matchingStore.name} está digitando a ${formattedDist} km (Limite: ${matchingStore.maxRadiusKm} km). Aguardando envio!`);

                        broadcastToClients({
                            type: 'store_typing_armed',
                            storeId: matchingStore.id,
                            storeName: matchingStore.name,
                            distanceKm: formattedDist,
                            maxRadiusKm: matchingStore.maxRadiusKm,
                            groupJid
                        });
                    } else {
                        console.log(`[RADAR 🛡️ IGNORADO] ${matchingStore.name} digitando a ${formattedDist} km (Acima do raio de ${matchingStore.maxRadiusKm} km).`);
                        broadcastToClients({
                            type: 'log_event',
                            message: `🛡️ ${matchingStore.name} digitando a ${formattedDist} km (Fora do limite de ${matchingStore.maxRadiusKm} km). Ignorado.`
                        });
                    }
                }
            }
        }
    });

    // PASSO 2 E PASSO 3: MENSAGEM RECEBIDA & RESPOSTA ULTRA-RÁPIDA "eu"
    waSock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const groupJid = msg.key.remoteJid;
            const participantJid = msg.key.participant || msg.participant || groupJid;
            const senderPhone = cleanNumber(participantJid);

            // PASSO 3: Proteção contra empresas distantes
            let armedSenderKey = null;
            let armedInfo = null;

            for (const [key, info] of armedStores.entries()) {
                if (matchPhoneNumber(key, senderPhone) || matchPhoneNumber(info.store.whatsappNumber, senderPhone)) {
                    armedSenderKey = key;
                    armedInfo = info;
                    break;
                }
            }

            if (!armedInfo) {
                // Se a mensagem veio de alguém não engatilhado (distante ou não cadastrado), ignora!
                continue;
            }

            // Verifica expiração do engatilhamento (timeout de 45 segundos)
            if (Date.now() - armedInfo.armedAt > 45000) {
                if (armedSenderKey) armedStores.delete(armedSenderKey);
                console.log(`[RADAR] Engatilhamento de ${armedInfo.store.name} expirou.`);
                continue;
            }

            // PASSO 2: RESPONDER INSTANTANEAMENTE "eu"
            try {
                await waSock.sendMessage(groupJid, {
                    text: 'eu'
                }, {
                    quoted: msg
                });

                console.log(`[RADAR 🚀 ROTA PEGA] "eu" enviado para ${armedInfo.store.name} no grupo ${groupJid}!`);

                // Remove do estado engatilhado
                if (armedSenderKey) armedStores.delete(armedSenderKey);

                const msgText = msg.message.conversation ||
                                msg.message.extendedTextMessage?.text ||
                                msg.message.imageMessage?.caption ||
                                'Nova Rota Solicitada';

                // NOTIFICA CELULAR PARA TOCAR ALARME E VIBRAR
                broadcastToClients({
                    type: 'route_captured',
                    storeName: armedInfo.store.name,
                    distanceKm: armedInfo.distanceKm,
                    messageText: msgText,
                    groupJid,
                    timestamp: new Date().toLocaleTimeString('pt-BR')
                });

            } catch (err) {
                console.error(`[RADAR ❌ ERRO DE ENVIO] Falha ao enviar "eu":`, err);
            }
        }
    });
}

// Start WhatsApp Engine
connectToWhatsApp().catch(err => {
    console.error('[WHATSAPP] Erro ao iniciar motor Baileys:', err);
});

// ----------------------------------------------------
// WEBSOCKET CLIENT HANDLER
// ----------------------------------------------------
wss.on('connection', (ws) => {
    console.log('[WEBSOCKET] Cliente celular conectado.');

    // Send initial status
    ws.send(JSON.stringify({ type: 'whatsapp_status', status: waStatus }));
    ws.send(JSON.stringify({ type: 'stores_list', stores }));
    ws.send(JSON.stringify({ type: 'driver_gps', gps: driverGps }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'gps_update') {
                driverGps = {
                    lat: data.lat,
                    lng: data.lng,
                    accuracy: data.accuracy || 10,
                    active: data.active !== false,
                    updatedAt: Date.now()
                };
                broadcastToClients({ type: 'driver_gps', gps: driverGps });
            } else if (data.type === 'store_add') {
                const newStore = {
                    id: 'store-' + Date.now(),
                    name: data.name || 'Nova Loja',
                    whatsappNumber: cleanNumber(data.whatsappNumber),
                    address: data.address || '',
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude),
                    maxRadiusKm: parseFloat(data.maxRadiusKm || 3.0),
                    active: true
                };
                stores.push(newStore);
                saveStores();
                broadcastToClients({ type: 'stores_list', stores });
            } else if (data.type === 'store_update') {
                const idx = stores.findIndex(s => s.id === data.id);
                if (idx !== -1) {
                    stores[idx] = {
                        ...stores[idx],
                        name: data.name ?? stores[idx].name,
                        whatsappNumber: data.whatsappNumber ? cleanNumber(data.whatsappNumber) : stores[idx].whatsappNumber,
                        address: data.address ?? stores[idx].address,
                        latitude: data.latitude != null ? parseFloat(data.latitude) : stores[idx].latitude,
                        longitude: data.longitude != null ? parseFloat(data.longitude) : stores[idx].longitude,
                        maxRadiusKm: data.maxRadiusKm != null ? parseFloat(data.maxRadiusKm) : stores[idx].maxRadiusKm,
                        active: data.active ?? stores[idx].active
                    };
                    saveStores();
                    broadcastToClients({ type: 'stores_list', stores });
                }
            } else if (data.type === 'store_delete') {
                stores = stores.filter(s => s.id !== data.id);
                saveStores();
                broadcastToClients({ type: 'stores_list', stores });
            } else if (data.type === 'simulate_typing_and_route') {
                // FERRAMENTA DE TESTE: Simula empresa digitando e enviando rota
                handleSimulatedTrigger(data.storeId, data.distanceKm);
            }
        } catch (err) {
            console.error('[WEBSOCKET] Erro ao processar mensagem do cliente:', err);
        }
    });

    ws.on('close', () => {
        console.log('[WEBSOCKET] Cliente desconectado.');
    });
});

// REST API Endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), driverGps, waStatus });
});

app.get('/api/stores', (req, res) => {
    res.json(stores);
});

app.post('/api/stores', (req, res) => {
    const newStore = {
        id: 'store-' + Date.now(),
        name: req.body.name || 'Nova Loja',
        whatsappNumber: cleanNumber(req.body.whatsappNumber),
        address: req.body.address || '',
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        maxRadiusKm: parseFloat(req.body.maxRadiusKm || 3.0),
        active: req.body.active !== false
    };
    stores.push(newStore);
    saveStores();
    broadcastToClients({ type: 'stores_list', stores });
    res.json({ success: true, store: newStore });
});

app.delete('/api/stores/:id', (req, res) => {
    stores = stores.filter(s => s.id !== req.params.id);
    saveStores();
    broadcastToClients({ type: 'stores_list', stores });
    res.json({ success: true });
});

// SIMULAÇÃO DE TESTE PARA REVISÃO E DEMONSTRAÇÃO
function handleSimulatedTrigger(storeId, forceDistanceKm) {
    const targetStore = stores.find(s => s.id === storeId) || stores[0];
    if (!targetStore) return;

    const dist = forceDistanceKm || 1.5;
    console.log(`[SIMULAÇÃO] Simulando digitação de ${targetStore.name} a ${dist} km...`);

    // Broadcast arming
    broadcastToClients({
        type: 'store_typing_armed',
        storeId: targetStore.id,
        storeName: targetStore.name,
        distanceKm: dist,
        maxRadiusKm: targetStore.maxRadiusKm,
        groupJid: 'grupo-simulado@g.us'
    });

    // Simula resposta instantânea após 1.2 segundos (empresa apertou enviar)
    setTimeout(() => {
        console.log(`[SIMULAÇÃO] Mensagem enviada! "eu" disparado para ${targetStore.name}!`);
        broadcastToClients({
            type: 'route_captured',
            storeName: targetStore.name,
            distanceKm: dist,
            messageText: 'Solicitação de Entrega - 1 Corrida para o Bairro Gramado (R$ 12,00)',
            groupJid: 'grupo-simulado@g.us',
            timestamp: new Date().toLocaleTimeString('pt-BR')
        });
    }, 1200);
}

app.post('/api/simulate', (req, res) => {
    handleSimulatedTrigger(req.body.storeId, req.body.distanceKm);
    res.json({ success: true, message: 'Simulação de radar iniciada!' });
});

// Redirect root route to public/radar.html if opened
app.get('/radar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'radar.html'));
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 RADAR DE ROTAS AUTOMÁTICO RODANDO NA PORTA ${PORT}`);
    console.log(`📍 Web Dashboard: http://localhost:${PORT}/public/radar.html`);
    console.log(`====================================================`);
});
