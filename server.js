const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const STORES_FILE = path.join(__dirname, 'data', 'stores.json');

app.get('/radar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'radar.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'radar.html'));
});

app.get('/api/stores', (req, res) => {
    if (fs.existsSync(STORES_FILE)) {
        res.json(JSON.parse(fs.readFileSync(STORES_FILE, 'utf8')));
    } else {
        res.json([]);
    }
});

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
});

function broadcastMessage(type, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, data }));
        }
    });
}

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            broadcastMessage('qr', qr);
        }
        
        if (connection === 'close') {
            console.log('Connection closed, reconnecting...');
            startWhatsApp();
        } else if (connection === 'open') {
            console.log('WhatsApp connected!');
            broadcastMessage('status', 'connected');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (text) {
            console.log('New message:', text);
            broadcastMessage('new_delivery', {
                from: msg.key.remoteJid,
                text: text,
                timestamp: msg.messageTimestamp
            });
        }
    });
}

startWhatsApp();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
