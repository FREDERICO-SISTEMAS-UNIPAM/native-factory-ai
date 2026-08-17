const $ = s => document.querySelector(s);
const socket = io();
let watchId, wakeLock, audio;

document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-tab],.tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('#' + b.dataset.tab).classList.add('active');
});

async function api(url, opt) {
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erro');
    return r.status === 204 ? null : r.json();
}

async function status() {
    const s = await api('/api/status');
    $('#status').textContent = s.message;
    $('#qr').hidden = !s.qr;
    if (s.qr) $('#qr').src = s.qr;
    $('#connectMessage').textContent = s.state === 'connected' ? '✅ Conectado e monitorando grupos.' : '';
}

$('#connectButton').onclick = async () => {
    await api('/api/connect', { method: 'POST' });
    status();
};

$('#logoutButton').onclick = () => api('/api/logout', { method: 'POST' }).then(status);

function gps(p) {
    const { latitude: lat, longitude: lng, accuracy } = p.coords;
    $('#gps').textContent = 'GPS ativo: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ' (±' + Math.round(accuracy) + 'm)';
    api('/api/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, accuracy })
    }).catch(console.error);
}

$('#radarButton').onclick = async () => {
    try {
        wakeLock = await navigator.wakeLock?.request('screen');
    } catch {}
    audio = new Audio('/alarm.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    audio.pause();
    navigator.vibrate?.(1);
    watchId ??= navigator.geolocation.watchPosition(gps, e => $('#gps').textContent = 'Erro no GPS: ' + e.message, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    $('#radarButton').textContent = 'Radar ativo';
};

$('#useLocation').onclick = () => navigator.geolocation.getCurrentPosition(p => {
    $('#companyForm [name=lat]').value = p.coords.latitude;
    $('#companyForm [name=lng]').value = p.coords.longitude;
}, e => alert(e.message), { enableHighAccuracy: true });

async function companies() {
    const list = await api('/api/empresas');
    $('#companyList').innerHTML = list.map(c => '<article><b>' + c.nome + '</b><br>' + c.telefone + ' · até ' + c.raioMaxKm + ' km<br><small>' + c.lat + ', ' + c.lng + '</small><br><button class="secondary" data-del="' + c.id + '">Excluir</button></article>').join('') || '<p>Nenhuma empresa cadastrada.</p>';
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        await api('/api/empresas/' + b.dataset.del, { method: 'DELETE' });
        companies();
    });
}

$('#companyForm').onsubmit = async e => {
    e.preventDefault();
    await api('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
    });
    e.target.reset();
    companies();
};

function alertRoute(x) {
    $('#alert').hidden = false;
    $('#alertText').textContent = x.empresaNome + ' · ' + x.distancia + ' km';
    audio ??= new Audio('/alarm.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    navigator.vibrate?.([500, 250, 500, 250, 500]);
}

$('#silence').onclick = () => {
    audio?.pause();
    $('#alert').hidden = true;
};

socket.on('whatsapp-status', status);
socket.on('route-captured', alertRoute);
socket.on('company-typing', x => $('#typing').textContent = x.empresaNome + ' está digitando (' + x.distancia + ' km)');

status();
companies();
