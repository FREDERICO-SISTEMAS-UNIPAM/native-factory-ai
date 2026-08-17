import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import pino from 'pino';
import { Server } from 'socket.io';

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.join(root, 'data'));
const auth = path.join(dir, 'whatsapp-auth');
const file = path.join(dir, 'radar.json');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static(path.join(root, 'public')));

let db = { empresas: [], gps: null, ultimoAlerta: null };
let sock;
let connecting = false;
let status = { state: 'disconnected', message: 'Desconectado', qr: null };

const armed = new Map();
const cooldown = new Map();

const save = async () => {
    try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('Save error:', e);
    }
};

const emit = (n, x) => io.emit(n, x);
const setStatus = x => {
    status = { ...status, ...x };
    emit('whatsapp-status', status);
};
const digits = x => String(x || '').replace(/\D/g, '');
const phone = x => {
    x = digits(String(x).split('@')[0]);
    return x.length === 13 && x.startsWith('55') && x[4] === '9' ? x.slice(0, 4) + x.slice(5) : x;
};
const same = (a, b) => phone(a) === phone(b);
const company = jid => db.empresas.find(x => same(x.telefone, jid));
const fresh = () => db.gps && Date.now() - new Date(db.gps.timestamp).getTime() < 60000;
const km = (a, b) => {
    const r = x => (x * Math.PI) / 180;
    const d1 = r(b.lat - a.lat);
    const d2 = r(b.lng - a.lng);
    const v =
        Math.sin(d1 / 2) ** 2 +
        Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(d2 / 2) ** 2;
    return 12742 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
};
const text = m =>
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    '';
const accepted = (c, m) => {
    const p = (c.palavrasChave || '')
        .split(',')
        .map(x => x.trim().toLowerCase())
        .filter(Boolean);
    return !p.length || p.some(x => text(m).toLowerCase().includes(x));
};

async function initDB() {
    try {
        await fs.mkdir(dir, { recursive: true });
        const content = await fs.readFile(file, 'utf8');
        db = { ...db, ...JSON.parse(content) };
    } catch {
        await save();
    }
}
initDB();

async function start() {
    if (connecting || sock) return;
    connecting = true;
    try {
        await fs.mkdir(auth, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(auth);
        sock = makeWASocket({
            auth,
            state,
            logger: pino({ level: 'silent' }),
            browser: ['Radar de Rotas', 'Chrome', '1.0'],
            markOnlineOnConnect: false
        });
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async u => {
            if (u.qr) setStatus({ state: 'qr', qr: await QRCode.toDataURL(u.qr), message: 'Escaneie o QR Code' });
            if (u.connection === 'open') setStatus({ state: 'connected', qr: null, message: 'WhatsApp conectado' });
            if (u.connection === 'close') {
                sock = undefined;
                const retry = new Boom(u.lastDisconnect?.error).output?.statusCode !== DisconnectReason.loggedOut;
                setStatus({ state: retry ? 'reconnecting' : 'logged-out', qr: null, message: retry ? 'Reconectando…' : 'Sessão encerrada' });
                if (retry) setTimeout(start, 3000);
            }
        });
        sock.ev.on('presence.update', ({ id, presences }) => {
            if (!id?.endsWith('@g.us')) return;
            for (const [jid, p] of Object.entries(presences || {})) {
                const c = company(jid);
                if (c && p.lastKnownPresence === 'composing' && fresh()) {
                    const d = km(db.gps, c);
                    if (d <= c.raioMaxKm) {
                        armed.set(c.id, Date.now() + 45000);
                        emit('company-typing', { empresaNome: c.nome, distancia: +d.toFixed(2) });
                    }
                }
            }
        });
        sock.ev.on('messages.upsert', async ({ type, messages }) => {
            if (type !== 'notify') return;
            for (const m of messages) {
                const chat = m.key.remoteJid;
                const who = m.key.participant || m.participant;
                const c = company(who);
                if (!chat?.endsWith('@g.us') || m.key.fromMe || !c || !fresh() || !accepted(c, m) || (cooldown.get(c.id) || 0) > Date.now()) continue;
                const d = km(db.gps, c);
                const armedOk = (armed.get(c.id) || 0) > Date.now();
                if (d > c.raioMaxKm) {
                    armed.delete(c.id);
                    continue;
                }
                await sock.sendMessage(chat, { text: 'eu' }, { quoted: m });
                armed.delete(c.id);
                cooldown.set(c.id, Date.now() + 120000);
                db.ultimoAlerta = {
                    empresaNome: c.nome,
                    distancia: +d.toFixed(2),
                    horario: new Date().toISOString(),
                    porDigitacao: armedOk
                };
                await save();
                emit('route-captured', db.ultimoAlerta);
            }
        });
    } catch (e) {
        sock = undefined;
        setStatus({ state: 'error', message: 'Erro: ' + e.message });
    } finally {
        connecting = false;
    }
}

app.get('/api/status', (q, r) => r.json({ ...status, gpsAtivo: fresh() }));
app.post('/api/connect', async (q, r) => {
    await start();
    r.status(202).json(status);
});
app.post('/api/logout', async (q, r) => {
    if (sock) await sock.logout();
    r.sendStatus(204);
});
app.get('/api/empresas', (q, r) => r.json(db.empresas));
app.post('/api/empresas', async (q, r) => {
    const { nome, telefone, lat, lng, raioMaxKm, palavrasChave = '' } = q.body;
    if (!nome || !digits(telefone) || !Number.isFinite(+lat) || !Number.isFinite(+lng) || !(+raioMaxKm > 0)) {
        return r.status(400).json({ error: 'Dados inválidos.' });
    }
    const x = {
        id: q.body.id || crypto.randomUUID(),
        nome: String(nome).trim(),
        telefone: digits(telefone),
        lat: +lat,
        lng: +lng,
        raioMaxKm: +raioMaxKm,
        palavrasChave: String(palavrasChave)
    };
    db.empresas = [...db.empresas.filter(y => y.id !== x.id), x];
    await save();
    r.status(201).json(x);
});
app.delete('/api/empresas/:id', async (q, r) => {
    db.empresas = db.empresas.filter(x => x.id !== q.params.id);
    await save();
    r.sendStatus(204);
});
app.post('/api/gps', async (q, r) => {
    const { lat, lng, accuracy } = q.body;
    if (!Number.isFinite(+lat) || !Number.isFinite(+lng)) return r.status(400).json({ error: 'GPS inválido' });
    db.gps = { lat: +lat, lng: +lng, accuracy: +accuracy || null, timestamp: new Date().toISOString() };
    await save();
    r.sendStatus(204);
});

app.get('*', (q, r) => r.sendFile(path.join(root, 'public', 'index.html')));

if (!process.env.VERCEL) {
    httpServer.listen(process.env.PORT || 3000, () => console.log('Radar ativo'));
}

export default app;
