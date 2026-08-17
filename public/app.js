let map;
let userMarker;
let audioContext;

function initMap() {
    map = L.map('map').setView([-23.550520, -46.633308], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    fetchStores();
    startGPS();
}

async function fetchStores() {
    try {
        const response = await fetch('/api/stores');
        const stores = await response.json();
        stores.forEach(store => {
            L.marker([store.lat, store.lng]).addTo(map)
             .bindPopup(`<b>${store.name}</b>`);
        });
    } catch (error) {
        console.error('Error fetching stores:', error);
    }
}

function startGPS() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (!userMarker) {
                    userMarker = L.circleMarker([latitude, longitude], {
                        color: 'red',
                        fillColor: '#f03',
                        fillOpacity: 0.5,
                        radius: 8
                    }).addTo(map);
                    map.setView([latitude, longitude], 15);
                } else {
                    userMarker.setLatLng([latitude, longitude]);
                }
            },
            (error) => console.error('GPS error:', error),
            { enableHighAccuracy: true }
        );
    }
}

function playAlarm() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event) => {
        const { type, data } = JSON.parse(event.data);

        if (type === 'qr') {
            const qrContainer = document.getElementById('qr-container');
            qrContainer.innerHTML = '';
            QRCode.toCanvas(data, { width: 250 }, (err, canvas) => {
                if (!err) qrContainer.appendChild(canvas);
            });
        } else if (type === 'status') {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = 'Conectado';
            statusDiv.className = 'connected';
            document.getElementById('qr-container').style.display = 'none';
        } else if (type === 'new_delivery') {
            playAlarm();
            addDeliveryCard(data);
        }
    };

    ws.onclose = () => {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'Desconectado';
        statusDiv.className = '';
        setTimeout(connectWebSocket, 3000);
    };
}

function addDeliveryCard(delivery) {
    const container = document.getElementById('deliveries');
    const card = document.createElement('div');
    card.className = 'delivery-card';
    card.innerHTML = `
        <small>${new Date(delivery.timestamp * 1000).toLocaleTimeString()}</small>
        <p><b>Mensagem:</b> ${delivery.text}</p>
        <small>De: ${delivery.from}</small>
    `;
    container.prepend(card);
}

// User interaction needed to start audio context
document.body.addEventListener('click', () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}, { once: true });

initMap();
connectWebSocket();
