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
const AUTH_DIR = process.env.WA_AUTH_DIR || path.join(__dirname, 'auth_info_baileys');
const ALLOW_FROM_ME_TEST_STORES = process.env.ALLOW_FROM_ME_TEST_STORES !== 'false';

const app = express();
app.use(express.json());
// HARDENING: Servir estaticamente APENAS o diretório public
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
let processedMessageIds = new Map(); // msg.key.id -> timestamp
let waSock = null;
let waStatus = { connected: false, qr: null, user: null };
let isConnectingWa = false;
let reconnectWaTimer = null;

// HARDENING: Pruning periódico de armedStores por TTL (a cada 15s)
setInterval(() => {
    const now = Date.now();
    for (const [key, info] of armedStores.entries()) {
        if (now - info.armedAt > 45000) {
            armedStores.delete(key);
        }
    }
}, 15000).unref?.();

// HARDENING: Limpeza de cache de mensagens processadas (TTL 5m, a cada 2m)
setInterval(() => {
    const now = Date.now();
    for (const [id, timestamp] of processedMessageIds.entries()) {
        if (now - timestamp > 300000) {
            processedMessageIds.delete(id);
        }
    }
}, 120000).unref?.();

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

// HARDENING: Validador estrito de Coordenadas e Raios (impede NaN e Infinity)
function parseCoordinate(val, min, max) {
    const parsed = Number.parseFloat(val);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseRadius(val) {
    const parsed = Number.parseFloat(val);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 50 ? parsed : 3.0;
}

// Utility: Clean phone number (handles Baileys multi-device suffix like :12@s.whatsapp.net)
function cleanNumber(numStr) {
    if (!numStr) return '';
    const withoutDevice = numStr.toString().split(':')[0].split('@')[0];
    return withoutDevice.replace(/\D/g, '');
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

// HARDENING: Verificador de GPS Ativo e Recente
function hasFreshGps(maxAgeMs = 60000) {
    return (
        driverGps &&
        driverGps.active &&
        Number.isFinite(driverGps.lat) &&
        Number.isFinite(driverGps.lng) &&
        (Date.now() - (driverGps.updatedAt || 0)) <= maxAgeMs
    );
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

// HARDENING: Envio seguro WebSocket com validação de estado e backpressure
function safeSend(client, payload) {
    if (!client || client.readyState !== WebSocket.OPEN) return;
    if (client.bufferedAmount > 1024 * 1024) {
        client.terminate();
        return;
    }
    client.send(payload, (err) => {
        if (err) try { client.terminate(); } catch (_) {}
    });
}

function broadcastToClients(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach(client => {
        safeSend(client, payload);
    });
}

// ----------------------------------------------------
// WHATSAPP BAILEYS BOT ENGINE
// ----------------------------------------------------
async function connectToWhatsApp() {
    if (isConnectingWa) return;
    isConnectingWa = true;

    if (reconnectWaTimer) {
        clearTimeout(reconnectWaTimer);
        reconnectWaTimer = null;
    }

    // HARDENING: Limpa socket e ouvintes anteriores para impedir duplicação
    if (waSock) {
        try {
            waSock.ev.removeAllListeners('connection.update');
            waSock.ev.removeAllListeners('creds.update');
            waSock.ev.removeAllListeners('presence.update');
            waSock.ev.removeAllListeners('messages.upsert');
            waSock.end?.();
        } catch (_) {}
        waSock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`[WHATSAPP] Iniciando Baileys v${version.join('.')}...`);

    waSock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Radar de Rotas Patos', 'Chrome', '1.0.0']
    });

    isConnectingWa = false;

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
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (statusCode !== DisconnectReason.loggedOut);
            console.log(`[WHATSAPP] Conexão fechada (${statusCode}). Reconectar?: ${shouldReconnect}`);
            waStatus = { connected: false, qr: null, user: null };
            broadcastToClients({ type: 'whatsapp_status', status: waStatus });

            if (shouldReconnect) {
                reconnectWaTimer = setTimeout(connectToWhatsApp, 5000);
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
                const matchingStore = stores.find(s => s.active && matchPhoneNumber(s.whatsappNumber, senderPhone));

                if (matchingStore) {
                    if (!hasFreshGps()) {
                        console.log(`[RADAR] Empresa ${matchingStore.name} está digitando, mas GPS da moto está ausente ou desatualizado.`);
                        broadcastToClients({
                            type: 'log_event',
                            message: `⚠️ ${matchingStore.name} digitando, mas seu GPS está desatualizado.`
                        });
                        continue;
                    }

                    const distKm = calculateDistanceKm(driverGps.lat, driverGps.lng, matchingStore.latitude, matchingStore.longitude);
                    const formattedDist = parseFloat(distKm.toFixed(2));

                    if (distKm <= matchingStore.maxRadiusKm) {
                        armedStores.set(senderPhone, {
                            store: matchingStore,
                            distanceKm: formattedDist,
                            armedAt: Date.now(),
                            groupJid,
                            participantJid
                        });

                        console.log(`[RADAR 🎯 ENGATILHADO] ${matchingStore.name} digitando a ${formattedDist} km (Limite: ${matchingStore.maxRadiusKm} km).`);

                        broadcastToClients({
                            type: 'store_typing_armed',
                            storeId: matchingStore.id,
                            storeName: matchingStore.name,
                            distanceKm: formattedDist,
                            maxRadiusKm: matchingStore.maxRadiusKm,
                            groupJid
                        });
                    } else {
                        console.log(`[RADAR 🛡️ IGNORADO] ${matchingStore.name} digitando a ${formattedDist} km (Fora do limite de ${matchingStore.maxRadiusKm} km).`);
                        broadcastToClients({
                            type: 'log_event',
                            message: `🛡️ ${matchingStore.name} digitando a ${formattedDist} km (Fora do limite). Ignorado.`
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
            if (!msg.message) continue;

            const msgId = msg.key?.id;
            // HARDENING: Idempotência por ID de mensagem (evita envios múltiplos)
            if (msgId && processedMessageIds.has(msgId)) continue;

            const groupJid = msg.key.remoteJid;
            const participantJid = msg.key.participant || msg.participant || groupJid;
            const senderPhone = cleanNumber(participantJid);

            const isRegisteredStore = stores.some(s => s.active && matchPhoneNumber(s.whatsappNumber, senderPhone));
            if (msg.key.fromMe && !(ALLOW_FROM_ME_TEST_STORES && isRegisteredStore)) continue;

            let armedSenderKey = null;
            let armedInfo = null;

            for (const [key, info] of armedStores.entries()) {
                if (matchPhoneNumber(key, senderPhone) || matchPhoneNumber(info.store.whatsappNumber, senderPhone)) {
                    armedSenderKey = key;
                    armedInfo = info;
                    break;
                }
            }

            // FALLBACK RESILIENTE COM VALIDAÇÃO DE GPS FRESCO
            if (!armedInfo) {
                const matchingStore = stores.find(s => s.active && matchPhoneNumber(s.whatsappNumber, senderPhone));
                if (matchingStore) {
                    if (!hasFreshGps()) {
                        console.log(`[RADAR ⚠️ REJEITADO] Mensagem de ${matchingStore.name} ignorada pois GPS da moto não está ativo/atualizado.`);
                        continue;
                    }

                    const distKm = calculateDistanceKm(driverGps.lat, driverGps.lng, matchingStore.latitude, matchingStore.longitude);
                    const formattedDist = parseFloat(distKm.toFixed(2));

                    if (distKm <= matchingStore.maxRadiusKm) {
                        armedInfo = {
                            store: matchingStore,
                            distanceKm: formattedDist,
                            armedAt: Date.now(),
                            groupJid,
                            participantJid
                        };
                        console.log(`[RADAR 🎯 DISPARADO DIRETO] ${matchingStore.name} enviou mensagem a ${formattedDist} km (Limite: ${matchingStore.maxRadiusKm} km).`);
                    } else {
                        console.log(`[RADAR 🛡️ MENSAGEM IGNORADA] ${matchingStore.name} enviou mensagem a ${formattedDist} km (Acima do raio de ${matchingStore.maxRadiusKm} km).`);
                    }
                }
            }

            if (!armedInfo || !armedInfo.store.active) {
                continue;
            }

            // Verifica expiração do engatilhamento (timeout de 45 segundos)
            if (Date.now() - armedInfo.armedAt > 45000) {
                if (armedSenderKey) armedStores.delete(armedSenderKey);
                console.log(`[RADAR] Engatilhamento de ${armedInfo.store.name} expirou.`);
                continue;
            }

            // HARDENING: Marca mensagem como processada imediatamente antes de enviar
            if (msgId) processedMessageIds.set(msgId, Date.now());

            // PASSO 2: RESPONDER INSTANTANEAMENTE "eu"
            try {
                await waSock.sendMessage(groupJid, {
                    text: 'eu'
                }, {
                    quoted: msg
                });

                console.log(`[RADAR 🚀 ROTA PEGA] "eu" enviado para ${armedInfo.store.name} no grupo ${groupJid}!`);

                if (armedSenderKey) armedStores.delete(armedSenderKey);

                const msgText = msg.message.conversation ||
                                msg.message.extendedTextMessage?.text ||
                                msg.message.imageMessage?.caption ||
                                'Nova Rota Solicitada';

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
    console.log('[WEBSOCKET] Cliente conectado.');

    safeSend(ws, JSON.stringify({ type: 'whatsapp_status', status: waStatus }));
    safeSend(ws, JSON.stringify({ type: 'stores_list', stores }));
    safeSend(ws, JSON.stringify({ type: 'driver_gps', gps: driverGps }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'gps_update') {
                const incomingAccuracy = parseFloat(data.accuracy) || 9999;
                const existingAccuracy = parseFloat(driverGps.accuracy) || 9999;
                const isExpired = (Date.now() - (driverGps.updatedAt || 0)) > 60000;

                const lat = parseCoordinate(data.lat, -90, 90);
                const lng = parseCoordinate(data.lng, -180, 180);

                if (data.active !== false && lat != null && lng != null && (incomingAccuracy <= 150 || incomingAccuracy <= existingAccuracy || isExpired)) {
                    driverGps = {
                        lat,
                        lng,
                        accuracy: incomingAccuracy,
                        active: true,
                        updatedAt: Date.now()
                    };
                    console.log(`[GPS ACEITO] Posição atualizada: (${driverGps.lat.toFixed(4)}, ${driverGps.lng.toFixed(4)}) - Precisão: ±${Math.round(incomingAccuracy)}m`);
                    broadcastToClients({ type: 'driver_gps', gps: driverGps });
                } else if (data.active === false) {
                    driverGps.active = false;
                    broadcastToClients({ type: 'driver_gps', gps: driverGps });
                } else {
                    console.log(`[GPS REJEITADO] Posição imprecisa do PC (±${Math.round(incomingAccuracy)}m) rejeitada em favor do GPS do celular (±${Math.round(existingAccuracy)}m).`);
                }
            } else if (data.type === 'store_add') {
                const lat = parseCoordinate(data.latitude, -90, 90);
                const lng = parseCoordinate(data.longitude, -180, 180);
                if (lat == null || lng == null) return;

                const newStore = {
                    id: 'store-' + Date.now(),
                    name: (data.name || 'Nova Loja').trim(),
                    whatsappNumber: cleanNumber(data.whatsappNumber),
                    address: (data.address || '').trim(),
                    latitude: lat,
                    longitude: lng,
                    maxRadiusKm: parseRadius(data.maxRadiusKm),
                    active: true
                };
                stores.push(newStore);
                saveStores();
                broadcastToClients({ type: 'stores_list', stores });
            } else if (data.type === 'store_update') {
                const idx = stores.findIndex(s => s.id === data.id);
                if (idx !== -1) {
                    const lat = data.latitude != null ? parseCoordinate(data.latitude, -90, 90) : stores[idx].latitude;
                    const lng = data.longitude != null ? parseCoordinate(data.longitude, -180, 180) : stores[idx].longitude;

                    stores[idx] = {
                        ...stores[idx],
                        name: data.name ? data.name.trim() : stores[idx].name,
                        whatsappNumber: data.whatsappNumber ? cleanNumber(data.whatsappNumber) : stores[idx].whatsappNumber,
                        address: data.address != null ? data.address.trim() : stores[idx].address,
                        latitude: lat != null ? lat : stores[idx].latitude,
                        longitude: lng != null ? lng : stores[idx].longitude,
                        maxRadiusKm: data.maxRadiusKm != null ? parseRadius(data.maxRadiusKm) : stores[idx].maxRadiusKm,
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
                handleSimulatedTrigger(data.storeId, data.distanceKm);
            }
        } catch (err) {
            console.error('[WEBSOCKET] Erro ao processar mensagem do cliente:', err);
        }
    });

    ws.on('error', (err) => {
        console.error('[WEBSOCKET ERRO]', err);
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
    const lat = parseCoordinate(req.body.latitude, -90, 90);
    const lng = parseCoordinate(req.body.longitude, -180, 180);
    if (lat == null || lng == null) {
        return res.status(400).json({ error: 'Coordenadas de Latitude e Longitude inválidas' });
    }

    const newStore = {
        id: 'store-' + Date.now(),
        name: (req.body.name || 'Nova Loja').trim(),
        whatsappNumber: cleanNumber(req.body.whatsappNumber),
        address: (req.body.address || '').trim(),
        latitude: lat,
        longitude: lng,
        maxRadiusKm: parseRadius(req.body.maxRadiusKm),
        active: req.body.active !== false
    };
    stores.push(newStore);
    saveStores();
    broadcastToClients({ type: 'stores_list', stores });
    res.json({ success: true, store: newStore });
});

app.patch('/api/stores/:id', (req, res) => {
    const idx = stores.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Loja não encontrada' });

    const lat = req.body.latitude != null ? parseCoordinate(req.body.latitude, -90, 90) : stores[idx].latitude;
    const lng = req.body.longitude != null ? parseCoordinate(req.body.longitude, -180, 180) : stores[idx].longitude;

    stores[idx] = {
        ...stores[idx],
        name: req.body.name ? req.body.name.trim() : stores[idx].name,
        whatsappNumber: req.body.whatsappNumber ? cleanNumber(req.body.whatsappNumber) : stores[idx].whatsappNumber,
        address: req.body.address != null ? req.body.address.trim() : stores[idx].address,
        latitude: lat != null ? lat : stores[idx].latitude,
        longitude: lng != null ? lng : stores[idx].longitude,
        maxRadiusKm: req.body.maxRadiusKm != null ? parseRadius(req.body.maxRadiusKm) : stores[idx].maxRadiusKm,
        active: req.body.active ?? stores[idx].active
    };
    saveStores();
    broadcastToClients({ type: 'stores_list', stores });
    res.json({ success: true, store: stores[idx] });
});

app.delete('/api/stores/:id', (req, res) => {
    stores = stores.filter(s => s.id !== req.params.id);
    saveStores();
    broadcastToClients({ type: 'stores_list', stores });
    res.json({ success: true });
});

function handleSimulatedTrigger(storeId, forceDistanceKm) {
    const targetStore = stores.find(s => s.id === storeId) || stores[0];
    if (!targetStore) return;

    const dist = forceDistanceKm || 1.5;
    console.log(`[SIMULAÇÃO] Simulando digitação de ${targetStore.name} a ${dist} km...`);

    broadcastToClients({
        type: 'store_typing_armed',
        storeId: targetStore.id,
        storeName: targetStore.name,
        distanceKm: dist,
        maxRadiusKm: targetStore.maxRadiusKm,
        groupJid: 'grupo-simulado@g.us'
    });

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

app.get('/radar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'radar.html'));
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 RADAR DE ROTAS AUTOMÁTICO RODANDO NA PORTA ${PORT}`);
    console.log(`📍 Web Dashboard: http://localhost:${PORT}/public/radar.html`);
    console.log(`====================================================`);
});
