// RADAR DE ROTAS AUTOMÁTICO - ENGINE CLIENTE JAVASCRIPT
document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO LOCAL ---
    let isRadarActive = false;
    let ws = null;
    let watchGpsId = null;
    let currentGps = { lat: -18.5790, lng: -46.5210, accuracy: null };
    let storesList = [];
    let map = null;
    let driverMarker = null;
    let driverAccuracyCircle = null;
    let storeMapMarkers = {};
    let audioCtx = null;
    let alarmInterval = null;

    // --- ELEMENTOS DOM ---
    const btnToggleRadar = document.getElementById('btn-toggle-radar');
    const radarStatusText = document.getElementById('radar-status-text');
    const gpsBadge = document.getElementById('gps-badge');
    const gpsText = document.getElementById('gps-text');
    const waBadge = document.getElementById('wa-badge');
    const waText = document.getElementById('wa-text');
    const driverDistInfo = document.getElementById('driver-dist-info');
    const storesListContainer = document.getElementById('stores-list');
    const storesCountPill = document.getElementById('stores-count');
    const capturedRoutesList = document.getElementById('captured-routes-list');

    // Modais
    const modalStore = document.getElementById('modal-store');
    const btnAddStore = document.getElementById('btn-add-store');
    const btnCloseStoreModal = document.getElementById('btn-close-store-modal');
    const btnCancelStore = document.getElementById('btn-cancel-store');
    const formAddStore = document.getElementById('form-add-store');
    const storeRadiusInput = document.getElementById('store-radius');
    const storeRadiusVal = document.getElementById('store-radius-val');
    const btnGeocode = document.getElementById('btn-geocode');

    const modalQr = document.getElementById('modal-qr');
    const btnShowQr = document.getElementById('btn-show-qr');
    const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
    const qrContainer = document.getElementById('qr-container');

    const btnTestSimulation = document.getElementById('btn-test-simulation');
    const btnClearHistory = document.getElementById('btn-clear-history');

    // Overlay de Alarme
    const alertOverlay = document.getElementById('captured-alert-overlay');
    const alertStoreName = document.getElementById('alert-store-name');
    const alertDistVal = document.getElementById('alert-dist-val');
    const alertMsgText = document.getElementById('alert-msg-text');
    const btnStopAlarm = document.getElementById('btn-stop-alarm');

    // --- 1. INICIALIZAÇÃO DO MAPA LEAFLET ---
    function initMap() {
        if (map) return;
        map = L.map('radar-map', { zoomControl: false }).setView([currentGps.lat, currentGps.lng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Ícone da Moto do Motorista
        const driverIcon = L.divIcon({
            className: 'driver-map-pin',
            html: `<div style="background:#10b981; color:#000; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.2rem; border:3px solid #fff; box-shadow:0 0 15px rgba(16,185,129,0.8);">🛵</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        driverMarker = L.marker([currentGps.lat, currentGps.lng], { icon: driverIcon }).addTo(map);
        driverAccuracyCircle = L.circle([currentGps.lat, currentGps.lng], {
            radius: 50,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(map);
    }

    initMap();

    // --- 2. WEBSOCKET ENGINE ---
    function initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[WEBSOCKET] Conectado ao backend no Render!');
            if (isRadarActive && currentGps.lat) {
                sendGpsUpdate();
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'whatsapp_status') {
                    updateWhatsAppStatus(data.status);
                } else if (data.type === 'stores_list') {
                    storesList = data.stores || [];
                    renderStores();
                    renderMapStoreMarkers();
                } else if (data.type === 'store_typing_armed') {
                    handleTypingArmed(data);
                } else if (data.type === 'route_captured') {
                    handleRouteCaptured(data);
                } else if (data.type === 'log_event') {
                    console.log('[RADAR LOG]', data.message);
                }
            } catch (err) {
                console.error('[WEBSOCKET] Erro ao ler mensagem:', err);
            }
        };

        ws.onclose = () => {
            console.log('[WEBSOCKET] Desconectado. Reconectando em 3s...');
            setTimeout(initWebSocket, 3000);
        };
    }

    initWebSocket();

    // --- 3. CONTROLE MASTER DO RADAR & GPS CELULAR ---
    btnToggleRadar.addEventListener('click', () => {
        isRadarActive = !isRadarActive;

        if (isRadarActive) {
            btnToggleRadar.classList.remove('off');
            btnToggleRadar.classList.add('on');
            radarStatusText.textContent = 'RADAR ATIVO';
            startGpsTracking();
            initAudioContext();
        } else {
            btnToggleRadar.classList.remove('on');
            btnToggleRadar.classList.add('off');
            radarStatusText.textContent = 'LIGAR RADAR';
            stopGpsTracking();
        }
    });

    function startGpsTracking() {
        if (!navigator.geolocation) {
            alert('Geolocalização não suportada neste celular.');
            return;
        }

        gpsText.textContent = 'Obtendo GPS...';
        gpsBadge.className = 'status-badge warning';

        watchGpsId = navigator.geolocation.watchPosition(
            (pos) => {
                currentGps.lat = pos.coords.latitude;
                currentGps.lng = pos.coords.longitude;
                currentGps.accuracy = pos.coords.accuracy;

                gpsText.textContent = `Ativo (Precisão: ±${Math.round(pos.coords.accuracy)}m)`;
                gpsBadge.className = 'status-badge success';

                driverDistInfo.textContent = `Sua Posição: ${currentGps.lat.toFixed(4)}, ${currentGps.lng.toFixed(4)}`;

                // Atualiza Mapa
                if (driverMarker && map) {
                    driverMarker.setLatLng([currentGps.lat, currentGps.lng]);
                    driverAccuracyCircle.setLatLng([currentGps.lat, currentGps.lng]);
                    driverAccuracyCircle.setRadius(pos.coords.accuracy || 50);
                    map.panTo([currentGps.lat, currentGps.lng]);
                }

                // Envia para o backend
                sendGpsUpdate();
                renderStores(); // Atualiza distâncias relativas das lojas
            },
            (err) => {
                console.error('[GPS ERRO]', err);
                gpsText.textContent = 'Erro de GPS (Ativar Localização)';
                gpsBadge.className = 'status-badge error';
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000
            }
        );
    }

    function stopGpsTracking() {
        if (watchGpsId !== null) {
            navigator.geolocation.clearWatch(watchGpsId);
            watchGpsId = null;
        }
        gpsText.textContent = 'Radar Desligado';
        gpsBadge.className = 'status-badge error';
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'gps_update', active: false }));
        }
    }

    function sendGpsUpdate() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'gps_update',
                lat: currentGps.lat,
                lng: currentGps.lng,
                accuracy: currentGps.accuracy,
                active: true
            }));
        }
    }

    // --- 4. ATUALIZAÇÕES DO WHATSAPP & QR CODE ---
    function updateWhatsAppStatus(status) {
        if (status.connected) {
            waText.textContent = `Conectado (${status.user || 'OK'})`;
            waBadge.className = 'status-badge success';
            qrContainer.innerHTML = `<div style="color:#10b981; font-weight:800; padding:20px;"><i class="fa-solid fa-circle-check" style="font-size:3rem;"></i><p style="margin-top:10px;">WhatsApp Conectado com Sucesso!</p></div>`;
        } else if (status.qr) {
            waText.textContent = 'Escanear QR Code';
            waBadge.className = 'status-badge warning';
            qrContainer.innerHTML = `<img src="${status.qr}" alt="QR Code WhatsApp">`;
        } else {
            waText.textContent = 'Aguardando Servidor...';
            waBadge.className = 'status-badge error';
            qrContainer.innerHTML = `<i class="fa-solid fa-spinner fa-spin qr-spinner"></i><p>Conectando...</p>`;
        }
    }

    // Modais QR Code
    btnShowQr.addEventListener('click', () => modalQr.classList.remove('hidden'));
    waBadge.addEventListener('click', () => modalQr.classList.remove('hidden'));
    btnCloseQrModal.addEventListener('click', () => modalQr.classList.add('hidden'));

    // --- 5. RENDERIZAÇÃO DE LOJAS & MARCADORES DE MAPA ---
    function calculateDistance(lat1, lon1, lat2, lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    function renderStores() {
        storesCountPill.textContent = `${storesList.length} ${storesList.length === 1 ? 'Loja' : 'Lojas'}`;

        if (storesList.length === 0) {
            storesListContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-store-slash"></i>
                    <p>Nenhuma loja cadastrada. Clique em <strong>+ Cadastrar Loja</strong> para adicionar!</p>
                </div>
            `;
            return;
        }

        storesListContainer.innerHTML = storesList.map(store => {
            const dist = calculateDistance(currentGps.lat, currentGps.lng, store.latitude, store.longitude);
            const distText = isFinite(dist) ? `${dist.toFixed(1)} km de você` : 'Distância n/a';
            const isWithin = dist <= store.maxRadiusKm;

            return `
                <div class="store-card" id="store-card-${store.id}">
                    <div class="store-icon">
                        <i class="fa-solid fa-store"></i>
                    </div>
                    <div class="store-details">
                        <span class="store-name">${store.name}</span>
                        <span class="store-phone"><i class="fa-brands fa-whatsapp"></i> +${store.whatsappNumber}</span>
                        <div class="store-meta">
                            <span class="meta-radius"><i class="fa-solid fa-circle-dot"></i> Raio: até ${store.maxRadiusKm} km</span>
                            <span class="meta-dist" style="color: ${isWithin ? '#10b981' : '#94a3b8'}">📍 ${distText}</span>
                        </div>
                    </div>
                    <div class="store-actions">
                        <button class="btn-delete-store" onclick="deleteStore('${store.id}')" title="Excluir Loja">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.deleteStore = (id) => {
        if (confirm('Deseja realmente remover esta empresa do radar?')) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'store_delete', id }));
            }
        }
    };

    function renderMapStoreMarkers() {
        if (!map) return;

        // Limpa marcadores anteriores
        Object.values(storeMapMarkers).forEach(({ marker, circle }) => {
            map.removeLayer(marker);
            map.removeLayer(circle);
        });
        storeMapMarkers = {};

        storesList.forEach(store => {
            const storeIcon = L.divIcon({
                className: 'store-map-pin',
                html: `<div style="background:#3b82f6; color:#fff; width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; border:2px solid #fff; box-shadow:0 0 10px rgba(59,130,246,0.6);">🏪</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon })
                .bindPopup(`<b>${store.name}</b><br>Raio Máx: ${store.maxRadiusKm} km`)
                .addTo(map);

            const circle = L.circle([store.latitude, store.longitude], {
                radius: store.maxRadiusKm * 1000,
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.08,
                weight: 1,
                dashArray: '4, 4'
            }).addTo(map);

            storeMapMarkers[store.id] = { marker, circle };
        });
    }

    // --- 6. GESTÃO DE DISPAROS & EVENTOS DO RADAR ---
    function handleTypingArmed(data) {
        const card = document.getElementById(`store-card-${data.storeId}`);
        if (card) {
            card.classList.add('typing-armed');
            setTimeout(() => card.classList.remove('typing-armed'), 5000);
        }

        if (storeMapMarkers[data.storeId]) {
            const circle = storeMapMarkers[data.storeId].circle;
            circle.setStyle({ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.3 });
            setTimeout(() => {
                circle.setStyle({ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08 });
            }, 5000);
        }
    }

    function handleRouteCaptured(data) {
        // Exibe Overlay de Alarme
        alertStoreName.textContent = data.storeName;
        alertDistVal.textContent = `a ${data.distanceKm} km de você`;
        alertMsgText.textContent = `"${data.messageText}"`;
        alertOverlay.classList.remove('hidden');

        // Toca Alarme Sonoro Alto + Vibração
        startLoudAlarm();
        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500, 200, 1000]);
        }

        // Adiciona ao Histórico
        const historyItem = document.createElement('div');
        historyItem.className = 'history-card';
        historyItem.innerHTML = `
            <div class="history-header">
                <span class="history-store">🎯 ${data.storeName} (${data.distanceKm} km)</span>
                <span class="history-time">${data.timestamp || 'Agora'}</span>
            </div>
            <p class="history-msg">${data.messageText}</p>
        `;

        const emptyHist = capturedRoutesList.querySelector('.empty-history');
        if (emptyHist) emptyHist.remove();
        capturedRoutesList.prepend(historyItem);
    }

    // --- 7. SINTETIZADOR DE ALARME SONORO (WEB AUDIO API) ---
    function initAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function startLoudAlarm() {
        initAudioContext();
        stopLoudAlarm(); // Limpa alarmes anteriores se houver

        let step = 0;
        alarmInterval = setInterval(() => {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sawtooth';
            // Alterna frequências para sirene marcante
            osc.frequency.value = (step % 2 === 0) ? 880 : 1200; // Frequências audíveis altas

            gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);

            step++;
        }, 300);
    }

    function stopLoudAlarm() {
        if (alarmInterval) {
            clearInterval(alarmInterval);
            alarmInterval = null;
        }
    }

    btnStopAlarm.addEventListener('click', () => {
        stopLoudAlarm();
        alertOverlay.classList.add('hidden');
    });

    // --- 8. FORMULÁRIO DE ADICIONAR LOJA ---
    btnAddStore.addEventListener('click', () => {
        initAudioContext();
        modalStore.classList.remove('hidden');
    });
    btnCloseStoreModal.addEventListener('click', () => modalStore.classList.add('hidden'));
    btnCancelStore.addEventListener('click', () => modalStore.classList.add('hidden'));

    storeRadiusInput.addEventListener('input', (e) => {
        storeRadiusVal.textContent = `${parseFloat(e.target.value).toFixed(1)} km`;
    });

    // Geocodificador Nominatim (Patos de Minas - MG)
    btnGeocode.addEventListener('click', async () => {
        const address = document.getElementById('store-address').value;
        if (!address) {
            alert('Digite um endereço antes de buscar.');
            return;
        }

        const query = `${address}, Patos de Minas, MG, Brasil`;
        try {
            btnGeocode.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data && data.length > 0) {
                document.getElementById('store-lat').value = parseFloat(data[0].lat).toFixed(6);
                document.getElementById('store-lng').value = parseFloat(data[0].lon).toFixed(6);
                alert(`Endereço localizado!\nLatitude: ${data[0].lat}, Longitude: ${data[0].lon}`);
            } else {
                alert('Endereço não localizado automaticamente. Insira a lat/lng manualmente ou tente simplificar o texto.');
            }
        } catch (err) {
            console.error('Erro na geocodificação:', err);
            alert('Erro ao consultar serviço de geocodificação.');
        } finally {
            btnGeocode.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i>';
        }
    });

    formAddStore.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('store-name').value;
        const phone = document.getElementById('store-phone').value;
        const address = document.getElementById('store-address').value;
        const lat = parseFloat(document.getElementById('store-lat').value);
        const lng = parseFloat(document.getElementById('store-lng').value);
        const radius = parseFloat(document.getElementById('store-radius').value);

        if (isNaN(lat) || isNaN(lng)) {
            alert('Coordenadas Latitude e Longitude são obrigatórias.');
            return;
        }

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'store_add',
                name,
                whatsappNumber: phone,
                address,
                latitude: lat,
                longitude: lng,
                maxRadiusKm: radius
            }));
        }

        modalStore.classList.add('hidden');
        formAddStore.reset();
        storeRadiusVal.textContent = '3.0 km';
    });

    // --- 9. BOTÃO DE SIMULAÇÃO DE TESTE ---
    btnTestSimulation.addEventListener('click', () => {
        initAudioContext();
        if (storesList.length === 0) {
            alert('Cadastre pelo menos uma loja para simular.');
            return;
        }

        const selectedStore = storesList[0];
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'simulate_typing_and_route',
                storeId: selectedStore.id,
                distanceKm: 1.5
            }));
        }
    });

    btnClearHistory.addEventListener('click', () => {
        capturedRoutesList.innerHTML = `<div class="empty-history"><p>Nenhuma rota capturada até o momento. Ligue o radar!</p></div>`;
    });
});
