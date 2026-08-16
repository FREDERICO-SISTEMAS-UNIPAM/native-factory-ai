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

        // Ícone da Moto do Motorista (Arrastável no mapa!)
        const driverIcon = L.divIcon({
            className: 'driver-map-pin',
            html: `<div style="background:#10b981; color:#000; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.3rem; border:3px solid #fff; box-shadow:0 0 15px rgba(16,185,129,0.8); cursor:grab;" title="Arraste a moto para sua posição exata!">🛵</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        driverMarker = L.marker([currentGps.lat, currentGps.lng], { icon: driverIcon, draggable: true }).addTo(map);
        driverAccuracyCircle = L.circle([currentGps.lat, currentGps.lng], {
            radius: 50,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(map);

        // Permite mover a moto arrastando ou clicando no mapa
        function updateManualPosition(lat, lng) {
            currentGps.lat = lat;
            currentGps.lng = lng;
            driverMarker.setLatLng([lat, lng]);
            driverAccuracyCircle.setLatLng([lat, lng]);
            driverDistInfo.textContent = `Posição Manual: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            gpsText.textContent = `Definido no Mapa (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
            gpsBadge.className = 'status-badge success';
            sendGpsUpdate();
            renderStores();
        }

        driverMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            updateManualPosition(pos.lat, pos.lng);
        });

        map.on('click', (e) => {
            updateManualPosition(e.latlng.lat, e.latlng.lng);
        });
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
                    if (data.stores && data.stores.length > 0) {
                        storesList = data.stores;
                        saveLocalStores();
                        renderStores();
                        renderMapStoreMarkers();
                    }
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
            if (marker && map.hasLayer(marker)) map.removeLayer(marker);
            if (circle && map.hasLayer(circle)) map.removeLayer(circle);
        });
        storeMapMarkers = {};

        storesList.forEach(store => {
            if (store.latitude == null || store.longitude == null) return;

            const storeIcon = L.divIcon({
                className: 'store-map-pin',
                html: `<div style="background:#3b82f6; color:#fff; width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; border:2px solid #fff; box-shadow:0 0 10px rgba(59,130,246,0.6); cursor:pointer;" title="${store.name}">🏪</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon })
                .bindPopup(`<b>${store.name}</b><br>📍 ${store.address || 'Patos de Minas - MG'}<br>🎯 Raio Máx: ${store.maxRadiusKm} km`)
                .addTo(map);

            storeMapMarkers[store.id] = { marker, circle: null, store };
        });
    }

    // --- 6. GESTÃO DE DISPAROS & EVENTOS DO RADAR ---
    function handleTypingArmed(data) {
        const card = document.getElementById(`store-card-${data.storeId}`);
        if (card) {
            card.classList.add('typing-armed');
            setTimeout(() => card.classList.remove('typing-armed'), 6000);
        }

        const storeEntry = storeMapMarkers[data.storeId];
        if (storeEntry && storeEntry.store) {
            // Remove destaque anterior se existir
            if (storeEntry.circle && map.hasLayer(storeEntry.circle)) {
                map.removeLayer(storeEntry.circle);
            }

            // Destaque dinâmico apenas para a loja engatilhada/digitando
            const circle = L.circle([storeEntry.store.latitude, storeEntry.store.longitude], {
                radius: (data.maxRadiusKm || storeEntry.store.maxRadiusKm) * 1000,
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '6, 6'
            }).addTo(map);

            storeEntry.circle = circle;

            setTimeout(() => {
                if (circle && map.hasLayer(circle)) {
                    map.removeLayer(circle);
                    storeEntry.circle = null;
                }
            }, 6000);
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

    // --- LOCAL STORAGE PERSISTENCE (Salva no Celular) ---
    const DEFAULT_STORES_DATABASE = [
  {
    "id": "store-king-adega",
    "name": "King Adega",
    "whatsappNumber": "5534999990001",
    "address": "Rua Major Gote, 1200, Centro, Patos de Minas - MG",
    "latitude": -18.5833,
    "longitude": -46.5167,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-orla-bar",
    "name": "Orla Bar & Resto",
    "whatsappNumber": "5534999990002",
    "address": "Av. Fátima Porto, 850, Patos de Minas - MG",
    "latitude": -18.579,
    "longitude": -46.521,
    "maxRadiusKm": 2.5,
    "active": true
  },
  {
    "id": "store-rei-da-batata",
    "name": "Rei da Batata",
    "whatsappNumber": "5534999990003",
    "address": "Rua Alaor de Mello Ribeiro, 225, Patos de Minas - MG",
    "latitude": -18.5912,
    "longitude": -46.5105,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-1786882497501",
    "name": "meu celular ",
    "whatsappNumber": "5534933001413",
    "address": "rua vereador manoel machado 239",
    "latitude": -18.600207,
    "longitude": -46.5213,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-005",
    "name": "Sushi Motto",
    "whatsappNumber": "5534900000005",
    "address": "rua vereador João Pacheco 1679 lagoa grande, Patos de Minas - MG",
    "latitude": -18.583,
    "longitude": -46.515,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-006",
    "name": "Bar Elaine",
    "whatsappNumber": "5534900000006",
    "address": "Bar Elaine, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-007",
    "name": "+55 34 9109-5564",
    "whatsappNumber": "553491095564",
    "address": "Av das quaresmeiras 710 jardim esperança, Patos de Minas - MG",
    "latitude": -18.5695,
    "longitude": -46.5032,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-008",
    "name": "Paola Pereira - Dom Pizzaria",
    "whatsappNumber": "5534900000008",
    "address": "Avenida dilermando Gomes de Deus 1660 loja 01 Jardim Panorâmico, Patos de Minas - MG",
    "latitude": -18.5912,
    "longitude": -46.5089,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-009",
    "name": "Padaria Bella Mineira",
    "whatsappNumber": "5534900000009",
    "address": "Padaria Bella Mineira, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-010",
    "name": "Bolos Biga",
    "whatsappNumber": "5534900000010",
    "address": "Rua Piracicaba 195 jardim esperança É uma sacola que está amarrado no portão, Patos de Minas - MG",
    "latitude": -18.5695,
    "longitude": -46.5032,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-011",
    "name": "+55 34 9678-6053",
    "whatsappNumber": "553496786053",
    "address": "R. Vicentina Rodrigues, 549 - Jardim Panorâmico, Patos de Minas - MG",
    "latitude": -18.5912,
    "longitude": -46.5089,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-012",
    "name": "+55 34 9810-3795",
    "whatsappNumber": "553498103795",
    "address": "rua Mauro Moreira Maciel n 90 sorriso, Patos de Minas - MG",
    "latitude": -18.6189,
    "longitude": -46.5142,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-013",
    "name": "Priscila - Só Na Brasa",
    "whatsappNumber": "5534900000013",
    "address": "Rua Jequitaí 25 Jardim Esperança, Patos de Minas - MG",
    "latitude": -18.569,
    "longitude": -46.503,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-014",
    "name": "+55 34 9804-4148",
    "whatsappNumber": "553498044148",
    "address": "Rua Santa Terezinha 51A Campos Eliseos, Patos de Minas - MG",
    "latitude": -18.565,
    "longitude": -46.512,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-015",
    "name": "Scarlat - Tortas",
    "whatsappNumber": "5534900000015",
    "address": "na rua dos Pinheiros 643, Patos de Minas - MG",
    "latitude": -18.5705,
    "longitude": -46.524,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-016",
    "name": "+55 34 9718-8925",
    "whatsappNumber": "553497188925",
    "address": "+55 34 9718-8925, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-017",
    "name": "California Acougue e Hortifruti",
    "whatsappNumber": "5534900000017",
    "address": "California Acougue e Hortifruti, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-018",
    "name": "Lohany Santos - Point Do Sorvete",
    "whatsappNumber": "5534900000018",
    "address": "de av Edson Nunes de paula barreiro 763, Patos de Minas - MG",
    "latitude": -18.595,
    "longitude": -46.515,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-019",
    "name": "AÇAI TOP10",
    "whatsappNumber": "5534900000019",
    "address": "av Brasil 1488, Patos de Minas - MG",
    "latitude": -18.597896,
    "longitude": -46.528107,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-020",
    "name": "Spetto House Patos",
    "whatsappNumber": "5534900000020",
    "address": "av José Francisco de Brito 82 panorâmico spetto house, Patos de Minas - MG",
    "latitude": -18.591,
    "longitude": -46.508,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-021",
    "name": "Rei da Batata | Patos de Minas",
    "whatsappNumber": "5534900000021",
    "address": "Rei da Batata | Patos de Minas, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-022",
    "name": "Julia Perfumaria",
    "whatsappNumber": "5534900000022",
    "address": "na rua dos benvindos n90 apartamento 402caiçaras, Patos de Minas - MG",
    "latitude": -18.571,
    "longitude": -46.525,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-023",
    "name": "Drogaria Visão",
    "whatsappNumber": "5534900000023",
    "address": "bairro guanabara drogaria visao, Patos de Minas - MG",
    "latitude": -18.565,
    "longitude": -46.518,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-024",
    "name": "Açaí Du Pato",
    "whatsappNumber": "5534900000024",
    "address": "Ipanema, Patos de Minas - MG",
    "latitude": -18.622724,
    "longitude": -46.508517,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-025",
    "name": "João Victor - Líder Do Ifood Patos De Minas",
    "whatsappNumber": "5534900000025",
    "address": "Itamaraty, Patos de Minas - MG",
    "latitude": -18.560077,
    "longitude": -46.520486,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-026",
    "name": "+55 34 9968-5054",
    "whatsappNumber": "553499685054",
    "address": "+55 34 9968-5054, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-027",
    "name": "Nathália DP/RH - MP Caminhões",
    "whatsappNumber": "5534900000027",
    "address": "Nathália DP/RH - MP Caminhões, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-028",
    "name": "+55 34 8825-0215",
    "whatsappNumber": "553488250215",
    "address": "solidonio medeiros pena 122, cidade nova, Patos de Minas - MG",
    "latitude": -18.594,
    "longitude": -46.518,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-029",
    "name": "Thais Kelen Beauty",
    "whatsappNumber": "5534900000029",
    "address": "Rua Antônio Marcílio Soares 240 planalto, Patos de Minas - MG",
    "latitude": -18.598,
    "longitude": -46.526,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-030",
    "name": "+55 34 9661-0410",
    "whatsappNumber": "553496610410",
    "address": "Rua Mariana Rosa de Sousa-64 Alto Limoeiro, Patos de Minas - MG",
    "latitude": -18.6015,
    "longitude": -46.5198,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-031",
    "name": "+55 34 9654-4238",
    "whatsappNumber": "553496544238",
    "address": "novo horizonte, Patos de Minas - MG",
    "latitude": -18.582797,
    "longitude": -46.493734,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-032",
    "name": "+55 34 9732-2814",
    "whatsappNumber": "553497322814",
    "address": "+55 34 9732-2814, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-033",
    "name": "Trindade Eletrônicos",
    "whatsappNumber": "5534900000033",
    "address": "São Geraldo 796 loja 01 Padre Eustáquio Trindade Eletrônicos, Patos de Minas - MG",
    "latitude": -18.5684,
    "longitude": -46.519,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-034",
    "name": "Casa de Carne Bom Sabor",
    "whatsappNumber": "5534900000034",
    "address": "R José Gomes Ferreira N 225, Ipanema, Patos de Minas - MG",
    "latitude": -18.6225,
    "longitude": -46.508,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-035",
    "name": "+55 34 9988-9429",
    "whatsappNumber": "553499889429",
    "address": "Itagiba Gonçalves 853 novo horizonte, Patos de Minas - MG",
    "latitude": -18.5721,
    "longitude": -46.5312,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-036",
    "name": "+55 34 9689-8546",
    "whatsappNumber": "553496898546",
    "address": "+55 34 9689-8546, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-037",
    "name": "+55 34 9221-7494",
    "whatsappNumber": "553492217494",
    "address": "+55 34 9221-7494, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-038",
    "name": "+55 34 9953-5202",
    "whatsappNumber": "553499535202",
    "address": "Laio Porto 201, Patos de Minas - MG",
    "latitude": -18.572194,
    "longitude": -46.502344,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-039",
    "name": "+55 34 9126-0634",
    "whatsappNumber": "553491260634",
    "address": "rua Kaká Duarte, 20 Boa Vista, Patos de Minas - MG",
    "latitude": -18.5756,
    "longitude": -46.5123,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-040",
    "name": "+55 34 9693-6955",
    "whatsappNumber": "553496936955",
    "address": "Aurélio caixeta, Patos de Minas - MG",
    "latitude": -18.577933,
    "longitude": -46.512676,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-041",
    "name": "+55 34 9970-3260",
    "whatsappNumber": "553499703260",
    "address": "olegario maciel e, Patos de Minas - MG",
    "latitude": -18.58967,
    "longitude": -46.513828,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-042",
    "name": "+55 34 9660-4850",
    "whatsappNumber": "553496604850",
    "address": "Rua Eufrásio Rodrigues, 315 - Jardim Centro, Patos de Minas - MG",
    "latitude": -18.5794,
    "longitude": -46.5181,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-043",
    "name": "Benaturalle",
    "whatsappNumber": "5534900000043",
    "address": "rua joaquim das chagas 1536, Patos de Minas - MG",
    "latitude": -18.581,
    "longitude": -46.517,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-044",
    "name": "Nicolli Magalhães 💕 - Dondokas",
    "whatsappNumber": "5534900000044",
    "address": "Leonides José fransisco 61 Ipanema, Patos de Minas - MG",
    "latitude": -18.622724,
    "longitude": -46.508517,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-045",
    "name": "Hyanne Cristina",
    "whatsappNumber": "5534900000045",
    "address": "vereador Filadélfia José da Fonseca 862 nova floresta, Patos de Minas - MG",
    "latitude": -18.564,
    "longitude": -46.498,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-046",
    "name": "+55 61 8164-9403",
    "whatsappNumber": "556181649403",
    "address": "+55 61 8164-9403, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-047",
    "name": "Thamara Castro Confeitaria",
    "whatsappNumber": "5534900000047",
    "address": "centro, Patos de Minas - MG",
    "latitude": -18.588349,
    "longitude": -46.514569,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-048",
    "name": "+55 34 8441-4536",
    "whatsappNumber": "553484414536",
    "address": "+55 34 8441-4536, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-049",
    "name": "Orla Bar E Espetaria",
    "whatsappNumber": "5534900000049",
    "address": "avenida doutor ivan clementino de santana 176 lagoa grande, Patos de Minas - MG",
    "latitude": -18.5833,
    "longitude": -46.5155,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-050",
    "name": "+55 34 9639-5440",
    "whatsappNumber": "553496395440",
    "address": "caramuru e, Patos de Minas - MG",
    "latitude": -18.567247,
    "longitude": -46.525754,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-051",
    "name": "+55 34 9777-4731",
    "whatsappNumber": "553497774731",
    "address": "+55 34 9777-4731, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-052",
    "name": "Pamonhas Tia Vani",
    "whatsappNumber": "5534900000052",
    "address": "Rua Rita Rodrigues Nogueira 27 bairro Boa vista, Patos de Minas - MG",
    "latitude": -18.5756,
    "longitude": -46.5123,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-053",
    "name": "Loja - ‎Bendita Seja Seja",
    "whatsappNumber": "5534900000053",
    "address": "rua general Osório 3 Loja bendita seja, Patos de Minas - MG",
    "latitude": -18.5785,
    "longitude": -46.5185,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-054",
    "name": "+55 34 9712-8761",
    "whatsappNumber": "553497128761",
    "address": "nova floresta, Patos de Minas - MG",
    "latitude": -18.564,
    "longitude": -46.498,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-055",
    "name": "+55 34 3825-3665",
    "whatsappNumber": "553438253665",
    "address": "General Osório 187, Patos de Minas - MG",
    "latitude": -18.588747,
    "longitude": -46.515501,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-056",
    "name": "+55 34 9866-9447",
    "whatsappNumber": "553498669447",
    "address": "vereador jose caixeta Magalhães 174, Patos de Minas - MG",
    "latitude": -18.626759,
    "longitude": -46.511825,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-057",
    "name": "Pizzaria Di Roma",
    "whatsappNumber": "5534900000057",
    "address": "Pizzaria Di Roma, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-058",
    "name": "Paulo - Entregador Tá na Mão",
    "whatsappNumber": "5534900000058",
    "address": "Paulo - Entregador Tá na Mão, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-059",
    "name": "+55 34 9773-0931",
    "whatsappNumber": "553497730931",
    "address": "+55 34 9773-0931, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-060",
    "name": "+55 34 9888-5260",
    "whatsappNumber": "553498885260",
    "address": "Rua João de Aquino Nunes, 180 Jardim Panoramico II, Patos de Minas - MG",
    "latitude": -18.5912,
    "longitude": -46.5089,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-061",
    "name": "Elivane Aparecida Rodrigues",
    "whatsappNumber": "5534900000061",
    "address": "Elivane Aparecida Rodrigues, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-062",
    "name": "+55 34 9780-6038",
    "whatsappNumber": "553497806038",
    "address": "rua Carmo do aranaiba 851 Santa Terezinha e, Patos de Minas - MG",
    "latitude": -18.565,
    "longitude": -46.512,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-063",
    "name": "Ana Flávia - Pipokitas",
    "whatsappNumber": "5534900000063",
    "address": "Ana Flávia - Pipokitas, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-064",
    "name": "+55 94 8143-1751",
    "whatsappNumber": "559481431751",
    "address": "+55 94 8143-1751, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-065",
    "name": "Hakuna VENDAS",
    "whatsappNumber": "5534900000065",
    "address": "Hakuna VENDAS, Patos de Minas - MG",
    "latitude": -18.5825,
    "longitude": -46.516,
    "maxRadiusKm": 3,
    "active": true
  },
  {
    "id": "store-auto-066",
    "name": "+55 34 8437-7963",
    "whatsappNumber": "553484377963",
    "address": "Ipanema, Patos de Minas - MG",
    "latitude": -18.622724,
    "longitude": -46.508517,
    "maxRadiusKm": 3,
    "active": true
  }
];

    function loadLocalStores() {
        try {
            const saved = localStorage.getItem("radar_stores");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    storesList = parsed;
                    renderStores();
                    renderMapStoreMarkers();
                    return;
                }
            }
        } catch (e) {
            console.error("Erro ao ler localStorage:", e);
        }
        storesList = DEFAULT_STORES_DATABASE;
        saveLocalStores();
        renderStores();
        renderMapStoreMarkers();
    }

    function saveLocalStores() {
        try {
            localStorage.setItem('radar_stores', JSON.stringify(storesList));
        } catch (e) {
            console.error('Erro ao salvar localStorage:', e);
        }
    }

    loadLocalStores();

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

        const newStore = {
            id: 'store-' + Date.now(),
            name,
            whatsappNumber: phone,
            address,
            latitude: lat,
            longitude: lng,
            maxRadiusKm: radius,
            active: true
        };

        // Adiciona localmente e salva no celular!
        storesList.push(newStore);
        saveLocalStores();
        renderStores();
        renderMapStoreMarkers();

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'store_add',
                ...newStore
            }));
        }

        modalStore.classList.add('hidden');
        formAddStore.reset();
        storeRadiusVal.textContent = '3.0 km';
    });

    window.deleteStore = (id) => {
        if (confirm('Deseja realmente remover esta empresa do radar?')) {
            storesList = storesList.filter(s => s.id !== id);
            saveLocalStores();
            renderStores();
            renderMapStoreMarkers();
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'store_delete', id }));
            }
        }
    };

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
        } else {
            // Fallback de Simulação direta no cliente
            handleTypingArmed({ storeId: selectedStore.id, storeName: selectedStore.name, distanceKm: 1.5 });
            setTimeout(() => {
                handleRouteCaptured({
                    storeName: selectedStore.name,
                    distanceKm: 1.5,
                    messageText: 'Solicitação de Entrega - 1 Corrida para o Bairro Gramado (R$ 12,00)',
                    timestamp: new Date().toLocaleTimeString('pt-BR')
                });
            }, 1200);
        }
    });

    btnClearHistory.addEventListener('click', () => {
        capturedRoutesList.innerHTML = `<div class="empty-history"><p>Nenhuma rota capturada até o momento. Ligue o radar!</p></div>`;
    });
});
