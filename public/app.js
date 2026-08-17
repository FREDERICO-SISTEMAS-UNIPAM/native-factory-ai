const $ = s => document.querySelector(s);

// Tab Navigation - Always set up listeners first so UI tabs work unconditionally
document.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => {
        document.querySelectorAll('[data-tab],.tab').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const target = $('#' + b.dataset.tab);
        if (target) target.classList.add('active');
    };
});

let socket = null;
try {
    if (typeof io === 'function') {
        socket = io({ autoConnect: true, reconnectionAttempts: 5 });
    }
} catch (e) {
    console.warn('Socket.io client notice:', e);
}

let watchId, wakeLock, audio;

async function api(url, opt) {
    const r = await fetch(url, opt);
    if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ' + r.status);
    }
    return r.status === 204 ? null : r.json();
}

async function status() {
    try {
        const s = await api('/api/status');
        if ($('#status')) $('#status').textContent = s.message || 'Pronto';
        if ($('#qr')) {
            $('#qr').hidden = !s.qr;
            if (s.qr) $('#qr').src = s.qr;
        }
        if ($('#connectMessage')) {
            $('#connectMessage').textContent = s.state === 'connected' ? '✅ Conectado e monitorando grupos.' : '';
        }
    } catch (err) {
        if ($('#status')) $('#status').textContent = 'Desconectado';
        console.error('Status fetch error:', err);
    }
}

const connectBtn = $('#connectButton');
if (connectBtn) {
    connectBtn.onclick = async () => {
        try {
            await api('/api/connect', { method: 'POST' });
            status();
        } catch (e) {
            alert('Falha ao conectar: ' + e.message);
        }
    };
}

const logoutBtn = $('#logoutButton');
if (logoutBtn) {
    logoutBtn.onclick = () => api('/api/logout', { method: 'POST' }).then(status).catch(e => alert(e.message));
}

function gps(p) {
    const { latitude: lat, longitude: lng, accuracy } = p.coords;
    if ($('#gps')) {
        $('#gps').textContent = 'GPS ativo: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' (±' + Math.round(accuracy) + 'm)';
    }
    api('/api/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, accuracy })
    }).catch(console.error);
}

const radarBtn = $('#radarButton');
if (radarBtn) {
    radarBtn.onclick = async () => {
        try {
            wakeLock = await navigator.wakeLock?.request('screen');
        } catch {}
        audio = new Audio('/alarm.mp3');
        audio.loop = true;
        audio.play().catch(() => {});
        audio.pause();
        navigator.vibrate?.(1);
        watchId ??= navigator.geolocation.watchPosition(
            gps,
            e => { if ($('#gps')) $('#gps').textContent = 'Erro no GPS: ' + e.message; },
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );
        radarBtn.textContent = 'Radar ativo';
    };
}

const useLocBtn = $('#useLocation');
if (useLocBtn) {
    useLocBtn.onclick = () => navigator.geolocation.getCurrentPosition(
        p => {
            const latInput = $('#companyForm [name=lat]');
            const lngInput = $('#companyForm [name=lng]');
            if (latInput) latInput.value = p.coords.latitude;
            if (lngInput) lngInput.value = p.coords.longitude;
        },
        e => alert(e.message),
        { enableHighAccuracy: true }
    );
}

async function companies() {
    try {
        const list = await api('/api/empresas');
        const container = $('#companyList');
        if (!container) return;
        container.innerHTML = (list || []).map(c =>
            '<article><b>' + c.nome + '</b><br>' +
            c.telefone + ' · até ' + c.raioMaxKm + ' km<br>' +
            '<small>' + c.lat + ', ' + c.lng + '</small><br>' +
            '<button class="secondary" data-del="' + c.id + '">Excluir</button></article>'
        ).join('') || '<p>Nenhuma empresa cadastrada.</p>';

        document.querySelectorAll('[data-del]').forEach(b => {
            b.onclick = async () => {
                await api('/api/empresas/' + b.dataset.del, { method: 'DELETE' });
                companies();
            };
        });
    } catch (e) {
        console.error('Companies error:', e);
    }
}

const companyForm = $('#companyForm');
if (companyForm) {
    companyForm.onsubmit = async e => {
        e.preventDefault();
        try {
            await api('/api/empresas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
            });
            e.target.reset();
            companies();
        } catch (err) {
            alert('Erro ao salvar empresa: ' + err.message);
        }
    };
}

function alertRoute(x) {
    if ($('#alert')) $('#alert').hidden = false;
    if ($('#alertText')) $('#alertText').textContent = x.empresaNome + ' · ' + x.distancia + ' km';
    audio ??= new Audio('/alarm.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    navigator.vibrate?.([500, 250, 500, 250, 500]);
}

const silenceBtn = $('#silence');
if (silenceBtn) {
    silenceBtn.onclick = () => {
        audio?.pause();
        if ($('#alert')) $('#alert').hidden = true;
    };
}

if (socket) {
    socket.on('whatsapp-status', status);
    socket.on('route-captured', alertRoute);
    socket.on('company-typing', x => {
        if ($('#typing')) $('#typing').textContent = x.empresaNome + ' está digitando (' + x.distancia + ' km)';
    });
}

// Initial calls
status();
companies();
