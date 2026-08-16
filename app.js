/* ==========================================================================
   DELIVERY BOY — REAL OPENSTREETMAP (OSRM) ROAD GRAPH ENGINE
   ========================================================================== */

(function() {
    'use strict';

    // --- SOUND SYNTHESIZER ENGINE (Web Audio API) ---
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.muted = false;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        toggleMute() {
            this.muted = !this.muted;
            return this.muted;
        }

        playTone(freq, type, duration, vol = 0.1) {
            if (this.muted || !this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {}
        }

        playEngineRev(speedRatio) {
            if (this.muted || !this.ctx || speedRatio <= 0.05) return;
            // Warm, soft 55-90Hz low sine hum (zero harsh noise)
            const pitch = 55 + speedRatio * 35;
            this.playTone(pitch, 'sine', 0.08, 0.012);
        }

        playHorn() {
            this.playTone(440, 'square', 0.3, 0.15);
            setTimeout(() => this.playTone(554, 'square', 0.3, 0.15), 100);
        }

        playCashChime() {
            this.playTone(523, 'sine', 0.12, 0.15);
            setTimeout(() => this.playTone(659, 'sine', 0.12, 0.15), 90);
            setTimeout(() => this.playTone(784, 'sine', 0.2, 0.18), 180);
        }

        playPickup() {
            this.playTone(400, 'sine', 0.1, 0.12);
            setTimeout(() => this.playTone(600, 'sine', 0.12, 0.12), 80);
        }
    }

    const sound = new SoundEngine();

    // Configurable Vehicle Speed & Physics Parameters
    const SPEED_CONFIG = {
        PARKED: 0,
        STREET_CRUISE: 38,   // Normal street ~35-40 km/h
        AVENUE_CRUISE: 52,   // Avenue ~50-60 km/h
        CURVE_SLOWDOWN: 22,  // Curves ~20 km/h
        ACCEL_RATE: 20,      // Acceleration km/h per sec
        DECEL_RATE: 30       // Deceleration km/h per sec
    };

    // Haversine Distance in Meters
    function haversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Shortest Angle Delta for Continuous 360° Lerp Rotation
    function getShortestAngleDelta(currentAngle, targetAngle) {
        let diff = (targetAngle - currentAngle) % 360;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    // --- GAME DEFINITIONS ---
    const VEHICLES = {
        bike:      { id: 'bike',      name: 'Bicicleta Urbana',      icon: '🚲', speedKmh: 22, maxFuel: 999, price: 0 },
        moped:     { id: 'moped',     name: 'Ciclomotor 50cc',       icon: '🛵', speedKmh: 42, maxFuel: 40, price: 150 },
        moto160:   { id: 'moto160',   name: 'Moto Delivery 160cc',   icon: '🏍️', speedKmh: 68, maxFuel: 70, price: 450 },
        superbike: { id: 'superbike', name: 'Super Moto Turbo Nitro',icon: '🚀', speedKmh: 110, maxFuel: 100, price: 1200 }
    };

    const ITEMS = {
        CALDO_CANA: { id: 'CALDO_CANA', name: 'Caldo de Cana com Limão Gelado', icon: '🥤', desc: 'Lagoa Grande de Patos de Minas!' },
        PIZZA:      { id: 'PIZZA',      name: 'Pizza Quente de Calabresa', icon: '🍕', desc: 'Pizzaria Bella Italia.' },
        BREAD:      { id: 'BREAD',      name: 'Cesta de Pães de Queijo', icon: '🥐', desc: 'Padaria Pão Quente.' },
        PARCEL:     { id: 'PARCEL',     name: 'Encomenda Expressa', icon: '📦', desc: 'Shopping Pátio Central.' },
        PASTEL:     { id: 'PASTEL',     name: 'Pastel de Carne', icon: '🥟', desc: 'Restaura 45% de Energia.' },
        ENERGY:     { id: 'ENERGY',     name: 'Energético Nitro 500ml', icon: '🥤', desc: 'Restaura 50% Hidratação.' },
        MOTOR_PART: { id: 'MOTOR_PART', name: 'Peça de Moto', icon: '⚙️', desc: 'Material de Oficina.' }
    };

    // Real Geographic Landmarks of Patos de Minas - MG
    const REAL_LANDMARKS = [
        {
            id: 'KING_ADEGA',
            name: 'King Adega',
            address: 'Rua Vereador João Pacheco, 2352',
            lat: -18.605451,
            lon: -46.521430,
            icon: '🏪',
            color: '#a855f7',
            hasDelivery: true,
            deliveryData: {
                shopName: 'King Adega',
                shopAddr: 'Rua Vereador João Pacheco, 2352',
                destAddr: 'Rua Joaquim Vida, 147',
                destLat: -18.572807,
                destLon: -46.498372,
                price: 'R$ 12,00',
                distance: '6,1 km',
                time: '13 min',
                type: 'Somente entrega'
            }
        },
        {
            id: 'CALDO_DE_CANA',
            name: 'Caldo de Cana Lagoa Grande',
            address: 'Rua Dr. Ivan Clementino Santana, 167 - Lagoa Grande',
            lat: -18.600712,
            lon: -46.520295,
            icon: '🥤',
            color: '#16a34a'
        },
        {
            id: 'PADARIA',
            name: 'Padaria Pão Quente Patos',
            address: 'Av. Brasil, Centro',
            lat: -18.595500,
            lon: -46.516500,
            icon: '🥐',
            color: '#ca8a04'
        },
        {
            id: 'PIZZARIA',
            name: 'Pizzaria Bella Italia Patos',
            address: 'Av. Fátima Porto',
            lat: -18.603500,
            lon: -46.522500,
            icon: '🍕',
            color: '#ea580c'
        },
        {
            id: 'SHOPPING',
            name: 'Shopping Pátio Central Patos',
            address: 'Rua Major Gote',
            lat: -18.588500,
            lon: -46.513500,
            icon: '🏢',
            color: '#0284c7'
        },
        {
            id: 'GAS_STATION',
            name: 'Posto Shell Lagoa',
            address: 'Av. Juscelino Kubitschek',
            lat: -18.602000,
            lon: -46.517500,
            icon: '⛽',
            color: '#0d9488'
        },
        {
            id: 'GARAGE',
            name: 'Oficina Mecânica Patos',
            address: 'Rua General Osório',
            lat: -18.598000,
            lon: -46.524000,
            icon: '🛠️',
            color: '#4f46e5'
        }
    ];

    // Load custom landmarks exported from Agenda if present in localStorage
    try {
        const savedCustomLandmarks = localStorage.getItem('CUSTOM_REAL_LANDMARKS');
        if (savedCustomLandmarks) {
            const parsed = JSON.parse(savedCustomLandmarks);
            if (Array.isArray(parsed) && parsed.length > 0) {
                parsed.forEach(lm => {
                    if (lm.lat && lm.lon && !REAL_LANDMARKS.some(existing => existing.id === lm.id)) {
                        REAL_LANDMARKS.push(lm);
                    }
                });
            }
        }
    } catch(e) {
        console.warn('Erro ao carregar landmarks customizados da agenda:', e);
    }

    const DELIVERY_JOBS = [
        { id: 1, title: 'Caldo de Cana Gelado + Pastel 🥤🥟', origin: 'Caldo de Cana Lagoa Grande', dest: 'Shopping Pátio Central Patos', targetLat: -18.588500, targetLon: -46.513500, item: ITEMS.CALDO_CANA, reward: 45, time: 60 },
        { id: 2, title: 'Pizza Grande de Calabresa 🍕', origin: 'Pizzaria Bella Italia', dest: 'Padaria Pão Quente Patos', targetLat: -18.595500, targetLon: -46.516500, item: ITEMS.PIZZA, reward: 35, time: 50 },
        { id: 3, title: 'Cesta de Pães de Queijo 🥐', origin: 'Padaria Pão Quente', dest: 'Posto Shell Lagoa', targetLat: -18.602000, targetLon: -46.517500, item: ITEMS.BREAD, reward: 28, time: 45 }
    ];

    // --- GAME STATE ---
    const state = {
        running: false,
        paused: false,
        cash: 0.0,
        deliveriesCompleted: 0,
        activeOrder: null,

        player: {
            lat: -18.600712,
            lon: -46.520295,
            heading: 0,
            currentSpeedKmh: 0,
            userTargetSpeedKmh: 60,
            currentVehicle: VEHICLES.bike,
            ownedVehicles: ['bike'],
            hasNOS: false,
            hasThermalBox: false,

            fuel: 40,
            energy: 85,
            thirst: 90,
            health: 100,

            isDriving: false,
            inventory: [null, null, null, null, null, null],
            selectedSlot: 0
        },

        // Navigation Route
        route: {
            points: [],        // Array of [lat, lon]
            currentIndex: 0,
            distanceMeters: 0,
            durationSeconds: 0,
            destinationName: ''
        },

        keys: {}
    };

    // --- LEAFLET MAP ENGINE ---
    let map;
    let motoboyMarker;
    let routePolyline;
    let landmarkMarkers = [];
    let destinationMarker = null;

    // Module State Variables
    let isAutoFollowCamera = true;
    let previewPolyline = null;
    let previewDestMarker = null;

    function recenterCameraOnMotoboy() {
        isAutoFollowCamera = true;
        if (map && state.player) {
            map.panTo([state.player.lat, state.player.lon], { animate: true, duration: 0.5 });
            addLog('◎ Câmera recentralizada no motoboy!');
        }
    }

    // Tile Layers for Label Visibility Rules
    let voyagerNoLabelsLayer;
    let voyagerLabelsLayer;
    let darkNoLabelsLayer;
    let darkLabelsLayer;
    let satelliteLayer;
    let currentMapTheme = 'voyager';

    function initLeafletMap() {
        map = L.map('leaflet-map', {
            center: [-18.600712, -46.520295],
            zoom: 16,
            zoomControl: false,
            attributionControl: false
        });

        voyagerNoLabelsLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png', { maxZoom: 19 });
        voyagerLabelsLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', { maxZoom: 19 });
        darkNoLabelsLayer = L.tileLayer('https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', { maxZoom: 19 });
        darkLabelsLayer = L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 });
        satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });

        voyagerNoLabelsLayer.addTo(map);

        // Top-Down Motoboy Vector Marker Icon (Vista Superior)
        // 0° points North (UP). Helmet in center, headlight pointing front, orange box at rear.
        const motoboyIcon = L.divIcon({
            className: 'motoboy-leaflet-marker',
            html: `
            <div class="motoboy-marker-wrap" id="motoboy-avatar-wrap" style="transform: rotate(0deg);">
                <svg class="motoboy-icon-box" viewBox="0 0 40 40" width="42" height="42">
                    <!-- Rear Delivery Box -->
                    <rect x="11" y="25" width="18" height="13" rx="3" fill="#f97316" stroke="#ffffff" stroke-width="1.5"/>
                    <text x="20" y="34" font-size="7" text-anchor="middle" fill="#ffffff" font-weight="bold">iFood</text>
                    <!-- Rider Body & Helmet (Top-Down View) -->
                    <circle cx="20" cy="18" r="7.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
                    <ellipse cx="20" cy="15.5" rx="4.5" ry="2.2" fill="#0f172a"/>
                    <!-- Front Handlebars -->
                    <path d="M 7 9 L 33 9" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>
                    <!-- Headlight Pointer (Facing North/Up at 0°) -->
                    <polygon points="20,1 25,7 15,7" fill="#facc15" stroke="#ffffff" stroke-width="0.5"/>
                </svg>
            </div>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21]
        });

        motoboyMarker = L.marker([-18.600712, -46.520295], { icon: motoboyIcon }).addTo(map);
        motoboyMarker.bindTooltip('<b>🛵 MOTOBOY</b><br>Patos de Minas - MG', { permanent: false, direction: 'top' });

        renderLandmarkMarkers();
        map.on('zoomend', updateStreetLabelVisibility);

        // Unblock free camera drag during motion (User Gesture Listeners)
        const mapContainer = map.getContainer();
        if (mapContainer) {
            mapContainer.addEventListener('mousedown', (e) => {
                if (e.button === 0) isAutoFollowCamera = false;
            });
            mapContainer.addEventListener('touchstart', () => {
                isAutoFollowCamera = false;
            });
        }

        map.on('dragstart', () => {
            isAutoFollowCamera = false;
        });
        map.on('movestart', (e) => {
            if (e && e.originalEvent) {
                isAutoFollowCamera = false;
            }
        });

        map.on('click', (e) => {
            sound.init();
            if (state.activeOrder && state.activeOrder.status && state.activeOrder.status !== DELIVERY_STATES.DISPONIVEL) {
                addLog('🛡️ Rota da entrega protegida! Clique e arraste para mover a câmera.', 'info');
                return;
            }
            const clickedLat = e.latlng.lat;
            const clickedLon = e.latlng.lng;
            calculateAndStartRoute(clickedLat, clickedLon, 'Ponto Selecionado no Mapa');
        });
    }

    function renderLandmarkMarkers() {
        landmarkMarkers.forEach(m => map.removeLayer(m));
        landmarkMarkers = [];

        REAL_LANDMARKS.forEach(lm => {
            const icon = L.divIcon({
                className: 'landmark-leaflet-marker',
                html: `<div style="background:${lm.color}; border:2px solid #fff; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">${lm.icon}</div>`,
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            });

            const m = L.marker([lm.lat, lm.lon], { icon, zIndexOffset: 2000 }).addTo(map);
            m.bindTooltip(`<b>${lm.name}</b><br><small>${lm.address}</small>`, { permanent: false, direction: 'top' });
            
            m.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                sound.init();
                if (lm.hasDelivery) {
                    showDeliveryPreview(lm);
                } else {
                    calculateAndStartRoute(lm.lat, lm.lon, lm.name);
                }
            });

            // Interactive Delivery Hover & Click Engine
            if (lm.hasDelivery) {
                m.on('mouseover', () => showDeliveryPreview(lm));
            }

            landmarkMarkers.push(m);
        });
    }

    // Delivery State Machine Definitions (8 Full Canonical States)
    const DELIVERY_STATES = {
        DISPONIVEL: 'DISPONIVEL',
        ACEITA: 'ACEITA',
        A_CAMINHO_DA_COLETA: 'A_CAMINHO_DA_COLETA',
        CHEGOU_NA_COLETA: 'CHEGOU_NA_COLETA',
        COLETADA: 'COLETADA', // NA_BAG
        A_CAMINHO_DO_DESTINO: 'A_CAMINHO_DO_DESTINO',
        CHEGOU_NO_DESTINO: 'CHEGOU_NO_DESTINO',
        ENTREGUE: 'ENTREGUE'
    };

    // Permanent Accepted Delivery Map Layers
    let acceptedRoutePolyline = null;
    let acceptedDestMarker = null;

    async function showDeliveryPreview(lm) {
        if (!lm.deliveryData) return;
        const d = lm.deliveryData;
        if (!d.status) d.status = DELIVERY_STATES.DISPONIVEL;

        // Populate Floating Card UI
        const shopNameEl = document.getElementById('preview-shop-name');
        const shopAddrEl = document.getElementById('preview-shop-addr');
        const destAddrEl = document.getElementById('preview-dest-addr');
        const priceEl = document.getElementById('preview-price-tag');
        const distEl = document.getElementById('preview-dist-val');
        const timeEl = document.getElementById('preview-time-val');
        const typeEl = document.getElementById('preview-type-val');
        const cardHeaderBadge = document.querySelector('.preview-badge-avail');
        const acceptBtn = document.getElementById('btn-accept-preview-delivery');

        if (shopNameEl) shopNameEl.innerText = d.shopName || 'Local de Coleta';
        if (shopAddrEl) shopAddrEl.innerText = d.shopAddr || '';
        if (destAddrEl) destAddrEl.innerText = d.destAddr || '';
        if (priceEl) priceEl.innerText = d.price || 'R$ 10,00';
        if (distEl) distEl.innerText = d.distance || '4,2 km';
        if (timeEl) timeEl.innerText = d.time || '9 min';
        if (typeEl) typeEl.innerText = d.type || 'Entrega Grupo';

        if (acceptBtn) {
            if (d.status === DELIVERY_STATES.DISPONIVEL) {
                if (cardHeaderBadge) cardHeaderBadge.innerHTML = `<i class="fa-solid fa-bolt text-yellow"></i> ENTREGA DISPONÍVEL`;
                acceptBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> ACEITAR ENTREGA`;
                acceptBtn.style.background = `linear-gradient(135deg, #10b981 0%, #059669 100%)`;
            } else {
                if (cardHeaderBadge) cardHeaderBadge.innerHTML = `<i class="fa-solid fa-person-biking text-cyan"></i> A CAMINHO DA COLETA`;
                acceptBtn.innerHTML = `<i class="fa-solid fa-box"></i> IR À ${(d.shopName || 'COLETA').toUpperCase()} (COLETA)`;
                acceptBtn.style.background = `linear-gradient(135deg, #0284c7 0%, #0369a1 100%)`;
            }
        }

        const card = document.getElementById('delivery-preview-card');
        if (card) card.classList.remove('preview-card-hidden');

        // Highlight Destination Marker 📍
        if (!acceptedDestMarker) {
            if (previewDestMarker) map.removeLayer(previewDestMarker);
            const destIcon = L.divIcon({
                className: 'dest-preview-leaflet-marker',
                html: `<div style="background:#ef4444; border:3px solid #fff; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 0 18px #ef4444;">📍</div>`,
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            });
            previewDestMarker = L.marker([d.destLat, d.destLon], { icon: destIcon }).addTo(map);
            previewDestMarker.bindTooltip(`<b>📍 Destino: ${d.destAddr}</b>`, { permanent: false, direction: 'top' });
        }

        // Accept Delivery Button Listener inside preview card
        if (acceptBtn && d.status === DELIVERY_STATES.DISPONIVEL) {
            acceptBtn.onclick = async () => {
                d.status = DELIVERY_STATES.A_CAMINHO_DA_COLETA;
                sound.playCashChime();
                addLog(`📦 ENTREGA ACEITA! Trajeto inicial definido: Ir até ${d.shopName} para Coleta.`, 'warning');
                
                state.activeOrder = {
                    id: d.id || ('REQ_' + Date.now()),
                    shopName: d.shopName,
                    shopAddr: d.shopAddr,
                    shopLat: d.shopLat || lm.lat,
                    shopLon: d.shopLon || lm.lon,
                    destAddr: d.destAddr,
                    destLat: d.destLat,
                    destLon: d.destLon,
                    priceVal: d.priceVal || 10.00,
                    tipVal: d.tipVal || 0.00,
                    title: `🏪 COLETA: ${d.shopName}`,
                    destSub: `Destino Final: ${d.destAddr}`,
                    status: d.status
                };
                updateOrderHUD();

                // Make Destination Marker 📍 Permanent on Map
                if (previewDestMarker) {
                    acceptedDestMarker = previewDestMarker;
                    previewDestMarker = null;
                }

                // Update UI state
                if (cardHeaderBadge) {
                    cardHeaderBadge.innerHTML = `<i class="fa-solid fa-person-biking text-cyan"></i> A CAMINHO DA COLETA`;
                }
                acceptBtn.innerHTML = `<i class="fa-solid fa-box"></i> IR À ${(d.shopName || 'COLETA').toUpperCase()} (COLETA)`;
                acceptBtn.style.background = `linear-gradient(135deg, #0284c7 0%, #0369a1 100%)`;

                // Calculate Leg 1 OSRM Navigation Target: Motoboy ➔ Store Coleta
                calculateAndStartRoute(lm.lat, lm.lon, lm.name);
            };
        }

        // Request OSRM Preview Polyline if not accepted yet
        if (!acceptedRoutePolyline && d.status === DELIVERY_STATES.DISPONIVEL) {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${lm.lon},${lm.lat};${d.destLon},${d.destLat}?overview=full&geometries=geojson`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.code === 'Ok' && data.routes && data.routes[0]) {
                    const previewPoints = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    if (previewPolyline) map.removeLayer(previewPolyline);
                    previewPolyline = L.polyline(previewPoints, {
                        color: '#facc15',
                        weight: 6,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round',
                        className: 'ifood-route-preview-line'
                    }).addTo(map);
                }
            } catch (e) {}
        }
    }

    function hideDeliveryPreview() {
        const card = document.getElementById('delivery-preview-card');
        
        // If an active order is accepted, keep destination & polyline permanent!
        if (state.activeOrder && state.activeOrder.status === DELIVERY_STATES.ACEITA) {
            if (card) card.classList.add('preview-card-hidden');
            return;
        }

        if (card) card.classList.add('preview-card-hidden');

        if (previewPolyline) {
            map.removeLayer(previewPolyline);
            previewPolyline = null;
        }
        if (previewDestMarker) {
            map.removeLayer(previewDestMarker);
            previewDestMarker = null;
        }
    }

    // --- GOOGLE MAPS STREET LABEL VISIBILITY RULES ---
    function updateStreetLabelVisibility() {
        const zoom = map.getZoom();

        if (currentMapTheme === 'voyager') {
            if (zoom < 15.5) {
                if (map.hasLayer(voyagerLabelsLayer)) map.removeLayer(voyagerLabelsLayer);
                if (!map.hasLayer(voyagerNoLabelsLayer)) map.addLayer(voyagerNoLabelsLayer);
            } else {
                if (map.hasLayer(voyagerNoLabelsLayer)) map.removeLayer(voyagerNoLabelsLayer);
                if (!map.hasLayer(voyagerLabelsLayer)) map.addLayer(voyagerLabelsLayer);
            }
        } else if (currentMapTheme === 'dark') {
            if (zoom < 15.5) {
                if (map.hasLayer(darkLabelsLayer)) map.removeLayer(darkLabelsLayer);
                if (!map.hasLayer(darkNoLabelsLayer)) map.addLayer(darkNoLabelsLayer);
            } else {
                if (map.hasLayer(darkNoLabelsLayer)) map.removeLayer(darkNoLabelsLayer);
                if (!map.hasLayer(darkLabelsLayer)) map.addLayer(darkLabelsLayer);
            }
        }
    }

    function toggleMapTheme() {
        const themes = ['voyager', 'satellite', 'dark'];
        const nextIdx = (themes.indexOf(currentMapTheme) + 1) % themes.length;
        currentMapTheme = themes[nextIdx];

        if (map.hasLayer(voyagerNoLabelsLayer)) map.removeLayer(voyagerNoLabelsLayer);
        if (map.hasLayer(voyagerLabelsLayer)) map.removeLayer(voyagerLabelsLayer);
        if (map.hasLayer(darkNoLabelsLayer)) map.removeLayer(darkNoLabelsLayer);
        if (map.hasLayer(darkLabelsLayer)) map.removeLayer(darkLabelsLayer);
        if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);

        if (currentMapTheme === 'satellite') {
            map.addLayer(satelliteLayer);
            addLog('🗺️ Estilo de Mapa: Satélite Real HD');
        } else if (currentMapTheme === 'dark') {
            updateStreetLabelVisibility();
            addLog('🗺️ Estilo de Mapa: Modo Noturno Cyber');
        } else {
            updateStreetLabelVisibility();
            addLog('🗺️ Estilo de Mapa: Urbano HD');
        }
    }

    // --- OSRM REAL ROAD NETWORK GRAPH ROUTING ENGINE ---
    async function calculateAndStartRoute(targetLat, targetLon, destName = 'Destino') {
        const startLat = state.player.lat;
        const startLon = state.player.lon;

        addLog(`🗺️ Calculando rota real por OSRM até ${destName}...`);

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${targetLon},${targetLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const routeData = data.routes[0];
                const routePoints = routeData.geometry.coordinates.map(c => [c[1], c[0]]);

                state.route.points = routePoints;
                state.route.currentIndex = 0;
                state.route.distanceMeters = routeData.distance;
                state.route.durationSeconds = routeData.duration;
                state.route.destinationName = destName;

                if (routePolyline) map.removeLayer(routePolyline);
                routePolyline = L.polyline(routePoints, {
                    color: '#06b6d4',
                    weight: 7,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'ifood-route-line'
                }).addTo(map);

                if (destinationMarker) map.removeLayer(destinationMarker);
                const destIcon = L.divIcon({
                    className: 'dest-leaflet-marker',
                    html: `<div style="background:#ef4444; border:2px solid #fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 0 14px #ef4444;">🏁</div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });
                destinationMarker = L.marker([targetLat, targetLon], { icon: destIcon }).addTo(map);

                state.player.isDriving = true;
                sound.playCashChime();
                addLog(`📍 Rota OSRM calculada: ${(routeData.distance / 1000).toFixed(2)} km (${Math.round(routeData.duration)}s)! Motoboy em movimento pelas ruas.`);
            } else {
                addLog('⚠️ Não foi possível calcular rota pelas ruas. Tente outro ponto.', 'warning');
            }
        } catch (err) {
            addLog('⚠️ Erro de conexão com servidor OSRM. Verifique sua internet.', 'danger');
        }
    }

    // --- GAME LOOP & VEHICLE MOTION ALONG ROAD GEOMETRY ---
    let lastTime = 0;

    function gameLoop(time) {
        const dt = (time - lastTime) / 1000 || 0;
        lastTime = time;

        if (state.running && !state.paused) {
            updateGame(dt);
        }

        requestAnimationFrame(gameLoop);
    }

    function updateGame(dt) {
        let distTraveled = 0;
        if (state.player.isDriving) {
            distTraveled = updateVehicleMovementAlongRoute(dt);
        } else {
            // Decelerate smoothly to 0 when parked
            if (state.player.currentSpeedKmh > 0) {
                state.player.currentSpeedKmh = Math.max(0, state.player.currentSpeedKmh - SPEED_CONFIG.DECEL_RATE * dt);
            }
        }

        updateVitals(dt, distTraveled);
        updateHUD();
    }

    function updateVehicleMovementAlongRoute(dt) {
        const p = state.player;
        const r = state.route;

        if (!p.isDriving || r.points.length === 0 || r.currentIndex >= r.points.length) {
            p.isDriving = false;
            p.currentSpeedKmh = 0;
            return 0;
        }

        const curPoint = [p.lat, p.lon];
        const targetPoint = r.points[r.currentIndex];
        const curLat = p.lat;
        const curLon = p.lon;
        const targetLat = targetPoint[0];
        const targetLon = targetPoint[1];

        const distToTargetMeters = haversineMeters(curLat, curLon, targetLat, targetLon);

        // 1. Determine Target Speed (Constant user selected speed, e.g. 60 km/h)
        let targetSpeedKmh = (p.userTargetSpeedKmh || 60) * (p.hasNOS ? 1.5 : 1.0);

        // Apply progressive acceleration / deceleration
        if (p.currentSpeedKmh < targetSpeedKmh) {
            p.currentSpeedKmh = Math.min(targetSpeedKmh, p.currentSpeedKmh + SPEED_CONFIG.ACCEL_RATE * dt);
        } else if (p.currentSpeedKmh > targetSpeedKmh) {
            p.currentSpeedKmh = Math.max(targetSpeedKmh, p.currentSpeedKmh - SPEED_CONFIG.DECEL_RATE * dt);
        }

        // Distance covered in dt seconds (meters)
        const moveStepMeters = (p.currentSpeedKmh / 3.6) * dt;

        if (distToTargetMeters < moveStepMeters || distToTargetMeters < 0.5) {
            // Reached current segment waypoint
            p.lat = targetLat;
            p.lon = targetLon;
            r.currentIndex++;

            if (r.currentIndex >= r.points.length) {
                // Arrived smoothly at current route destination!
                p.isDriving = false;
                p.currentSpeedKmh = 0;
                
                if (state.activeOrder) {
                    handleOrderStepArrival();
                } else {
                    addLog(`🎉 Chegou ao destino: ${r.destinationName}!`, 'warning');
                    sound.playCashChime();
                }
                return distToTargetMeters;
            }
            return distToTargetMeters;
        }

        // 2. Interpolate Position Along Segment Geometry
        const ratio = moveStepMeters / distToTargetMeters;
        const dLat = targetLat - curLat;
        const dLon = targetLon - curLon;
        p.lat += dLat * ratio;
        p.lon += dLon * ratio;

        // 3. Absolute Heading Direction & Continuous Lerp Angle Rotation
        const targetHeadingRad = Math.atan2(dLon, dLat);
        const targetHeadingDeg = (targetHeadingRad * 180 / Math.PI);

        // Smooth shortest-path rotation angle lerp
        const deltaAngle = getShortestAngleDelta(p.heading, targetHeadingDeg);
        p.heading += deltaAngle * Math.min(1.0, 14 * dt);

        // Sound engine update (soft sine hum)
        sound.playEngineRev(p.currentSpeedKmh / 100);

        // Fuel consumption while driving
        if (p.currentVehicle.id !== 'bike') {
            p.fuel -= (moveStepMeters / 1000) * 0.15;
            if (p.fuel <= 0) {
                p.fuel = 0;
                p.isDriving = false;
                p.currentSpeedKmh = 0;
                addLog('⛽ O combustível da moto acabou! Vá até um Posto para abastecer.', 'warning');
            }
        }

        // 4. Update Leaflet Motoboy Marker Position & Heading Rotation
        if (motoboyMarker) {
            motoboyMarker.setLatLng([p.lat, p.lon]);
            const wrapEl = document.getElementById('motoboy-avatar-wrap');
            if (wrapEl) {
                wrapEl.style.transform = `rotate(${Math.round(p.heading)}deg)`;
            }
        }

        // iFood Style Auto-Camera Pan Follow Motoboy (Only if auto-follow is active)
        if (isAutoFollowCamera) {
            map.panTo([p.lat, p.lon], { animate: true, duration: 0.1 });
        }

        return moveStepMeters;
    }

    // Slow Hydration Decay System (Time + Distance Effort Based)
    function updateVitals(dt, distTraveledMeters = 0) {
        const p = state.player;
        
        // Slow time decay: 0.012% per second (~135 minutes of real play for 100% to 0%)
        p.energy -= 0.15 * dt;
        p.thirst -= 0.012 * dt;

        // Distance effort modifier: 0.002% per 100 meters
        if (distTraveledMeters > 0) {
            p.thirst -= (distTraveledMeters / 100) * 0.002;
        }

        if (p.energy <= 0 || p.thirst <= 0) {
            p.health -= 1.5 * dt;
        }

        p.energy = Math.max(0, Math.min(100, p.energy));
        p.thirst = Math.max(0, Math.min(100, p.thirst));
        p.health = Math.max(0, Math.min(100, p.health));

        if (p.health <= 0) {
            triggerGameOver('Seu motoboy ficou exausto durante a entrega.');
        }
    }

    // --- INVENTORY & ORDERS LOGIC ---
    function addItemToInventory(itemObj) {
        const inv = state.player.inventory;
        for (let i = 0; i < inv.length; i++) {
            if (inv[i] === null) {
                inv[i] = { ...itemObj, count: 1 };
                updateInventoryUI();
                return true;
            } else if (inv[i].id === itemObj.id) {
                inv[i].count++;
                updateInventoryUI();
                return true;
            }
        }
        addLog('⚠️ Mochila do motoboy cheia!', 'warning');
        return false;
    }

    function updateInventoryUI() {
        const slots = document.querySelectorAll('.inv-slot');
        slots.forEach((slotEl, idx) => {
            const item = state.player.inventory[idx];
            const iconEl = slotEl.querySelector('.slot-icon');
            const countEl = slotEl.querySelector('.slot-count');

            if (idx === state.player.selectedSlot) slotEl.classList.add('active');
            else slotEl.classList.remove('active');

            if (item) {
                iconEl.innerText = item.icon;
                countEl.innerText = item.count > 1 ? item.count : '';
            } else {
                iconEl.innerText = '';
                countEl.innerText = '';
            }
        });
    }

    function openOrdersModal() {
        populateOrdersBoard();
        document.getElementById('delivery-modal').classList.remove('hidden');
    }

    function populateOrdersBoard() {
        const container = document.getElementById('orders-list-container');
        if (!container) return;
        container.innerHTML = '';

        DELIVERY_JOBS.forEach(job => {
            const itemCard = document.createElement('div');
            itemCard.className = 'order-item-card';
            itemCard.innerHTML = `
                <div>
                    <h4>${job.title}</h4>
                    <p>Origem: ${job.origin} ➔ Destino: ${job.dest}</p>
                    <span class="order-reward-val">Recompensa: R$ ${job.reward.toFixed(2)}</span>
                </div>
                <button class="btn-accept-order" data-job="${job.id}">Aceitar Entrega</button>
            `;
            container.appendChild(itemCard);
        });

        document.querySelectorAll('.btn-accept-order').forEach(btn => {
            btn.addEventListener('click', () => {
                const jobId = parseInt(btn.dataset.job);
                acceptDeliveryJob(jobId);
                document.getElementById('delivery-modal').classList.add('hidden');
            });
        });
    }

    function acceptDeliveryJob(jobId) {
        const job = DELIVERY_JOBS.find(j => j.id === jobId);
        if (!job) return;

        state.activeOrder = { ...job, timeLeft: job.time };
        addItemToInventory(job.item);
        sound.playCashChime();
        addLog(`📦 Pedido Aceito: ${job.title}! OSRM traçando rota até ${job.dest}...`);
        updateOrderHUD();

        // Calculate OSRM route to order destination
        calculateAndStartRoute(job.targetLat, job.targetLon, job.dest);
    }

    function handleOrderStepArrival() {
        const order = state.activeOrder;
        if (!order) return;

        const priceStr = `R$ ${(order.priceVal || 10).toFixed(2)}`;

        if (order.status === DELIVERY_STATES.A_CAMINHO_DA_COLETA || order.status === DELIVERY_STATES.ACEITA) {
            order.status = DELIVERY_STATES.CHEGOU_NA_COLETA;
            sound.playPickup();
            showDeliveryActionModal(
                `📦 CHEGOU À ${(order.shopName || 'COLETA').toUpperCase()}!`,
                `Você chegou a ${order.shopName || 'coleta'}. Retire o pedido para colocar na Bag.`,
                order.shopName || 'Local de Coleta',
                order.destAddr || 'Destino',
                priceStr,
                '<i class="fa-solid fa-box"></i> 🎒 COLETAR PEDIDO',
                collectOrderToBag
            );
            addLog(`🏪 Chegou a ${order.shopName || 'coleta'}! Clique em [COLETAR PEDIDO] para colocar na Bag.`, 'warning');
        } else if (order.status === DELIVERY_STATES.A_CAMINHO_DO_DESTINO || order.status === DELIVERY_STATES.COLETADA) {
            order.status = DELIVERY_STATES.CHEGOU_NO_DESTINO;
            sound.playCashChime();
            showDeliveryActionModal(
                `📍 CHEGOU AO DESTINO: ${(order.destAddr || 'DESTINO').toUpperCase()}!`,
                `Você chegou a ${order.destAddr || 'destino'}. Entregue o pedido ao cliente.`,
                order.shopName || 'Local de Coleta',
                order.destAddr || 'Destino',
                priceStr,
                '<i class="fa-solid fa-check-circle"></i> ✅ ENTREGAR PEDIDO',
                completeFinalOrder
            );
            addLog(`📍 Chegou a ${order.destAddr || 'destino'}! Clique em [ENTREGAR PEDIDO] para finalizar.`, 'warning');
        }
    }

    function showDeliveryActionModal(title, desc, shop, dest, payout, btnText, actionFn) {
        const titleEl = document.getElementById('delivery-action-title');
        const descEl = document.getElementById('delivery-action-desc');
        const shopEl = document.getElementById('action-shop-name');
        const destEl = document.getElementById('action-dest-addr');
        const payoutEl = document.getElementById('action-payout-val');
        const mainBtn = document.getElementById('btn-delivery-action-main');

        if (titleEl) titleEl.innerText = title;
        if (descEl) descEl.innerText = desc;
        if (shopEl) shopEl.innerText = shop;
        if (destEl) destEl.innerText = dest;
        if (payoutEl) payoutEl.innerText = payout;

        if (mainBtn) {
            mainBtn.innerHTML = btnText;
            mainBtn.onclick = () => {
                document.getElementById('delivery-action-modal').classList.add('hidden');
                actionFn();
            };
        }

        const modal = document.getElementById('delivery-action-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function collectOrderToBag() {
        const order = state.activeOrder;
        if (!order) return;

        order.status = DELIVERY_STATES.COLETADA;
        sound.playPickup();
        addItemToInventory(ITEMS.PARCEL);

        addLog(`🎒 PEDIDO COLETADO EM ${(order.shopName || 'COLETA').toUpperCase()}! Item colocado na Bag. OSRM traçando rota até ${order.destAddr}...`, 'warning');
        
        order.status = DELIVERY_STATES.A_CAMINHO_DO_DESTINO;
        order.title = `📍 DESTINO: ${order.destAddr}`;
        updateOrderHUD();

        // Calculate Leg 2 Navigation: Motoboy ➔ Target Destination
        calculateAndStartRoute(order.destLat, order.destLon, order.destAddr);
    }

    function completeFinalOrder() {
        const order = state.activeOrder;
        if (!order) return;

        const fee = order.priceVal || 12.00;
        const tip = order.tipVal || 14.00;
        const totalPayout = fee + tip;

        state.cash += totalPayout;
        state.deliveriesCompleted++;
        sound.playCashChime();

        addLog(`🎉 ENTREGA CONCLUÍDA COM SUCESSO! Taxa: R$ ${fee.toFixed(2)} + Gorjeta: R$ ${tip.toFixed(2)} = Total R$ ${totalPayout.toFixed(2)}!`, 'warning');

        // Remove parcel item from inventory
        const inv = state.player.inventory;
        for (let i = 0; i < inv.length; i++) {
            if (inv[i] && (inv[i].id === 'PARCEL' || inv[i].id === 'KING_ADEGA')) {
                inv[i] = null;
                break;
            }
        }
        updateInventoryUI();

        // Clear permanent map layers
        if (acceptedRoutePolyline) {
            map.removeLayer(acceptedRoutePolyline);
            acceptedRoutePolyline = null;
        }
        if (acceptedDestMarker) {
            map.removeLayer(acceptedDestMarker);
            acceptedDestMarker = null;
        }

        // Reset POI status so delivery can be played again if desired
        REAL_LANDMARKS.forEach(lm => {
            if (lm.deliveryData) lm.deliveryData.status = DELIVERY_STATES.DISPONIVEL;
        });

        state.activeOrder = null;
        updateOrderHUD();
    }

    function updateOrderHUD() {
        const card = document.getElementById('active-order-card');
        if (!card) return;

        if (state.activeOrder) {
            card.classList.remove('idle');
            document.getElementById('order-title-text').innerText = state.activeOrder.title || 'Entrega em Andamento';
            document.getElementById('order-sub-text').innerText = state.activeOrder.destSub || `Destino: ${state.activeOrder.destAddr}`;
            document.getElementById('order-reward').innerText = `R$ ${(state.activeOrder.priceVal || 12).toFixed(2)}`;
        } else {
            card.classList.add('idle');
            document.getElementById('order-title-text').innerText = 'Nenhum Pedido Ativo';
            document.getElementById('order-sub-text').innerText = 'Passe o mouse sobre os estabelecimentos para pegar entregas!';
            document.getElementById('order-timer').innerText = '--:--';
            document.getElementById('order-reward').innerText = 'R$ 0,00';
        }
    }

    function updateHUD() {
        const p = state.player;

        const speedKmh = Math.round(p.currentSpeedKmh);
        document.getElementById('speed-display').innerText = speedKmh;

        document.getElementById('bar-fuel').style.width = Math.round((p.fuel / p.currentVehicle.maxFuel) * 100) + '%';
        document.getElementById('val-fuel').innerText = Math.round((p.fuel / p.currentVehicle.maxFuel) * 100) + '%';

        document.getElementById('bar-energy').style.width = Math.round(p.energy) + '%';
        document.getElementById('val-energy').innerText = Math.round(p.energy) + '%';

        document.getElementById('bar-thirst').style.width = Math.round(p.thirst) + '%';
        document.getElementById('val-thirst').innerText = Math.round(p.thirst) + '%';

        document.getElementById('cash-display').innerText = `R$ ${state.cash.toFixed(2)}`;
        document.getElementById('vehicle-type-badge').innerText = p.currentVehicle.name;
    }

    function updateGarageUI() {
        document.querySelectorAll('.btn-buy-veh').forEach(btn => {
            const vehKey = btn.dataset.vehicle;
            const targetVeh = VEHICLES[vehKey];
            if (!targetVeh) return;

            if (state.player.currentVehicle.id === vehKey) {
                btn.innerText = '✓ Equipado';
                btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            } else if (state.player.ownedVehicles.includes(vehKey)) {
                btn.innerText = 'Equipar';
                btn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
            } else {
                btn.innerText = `Comprar (R$ ${targetVeh.price.toFixed(2)})`;
                btn.style.background = (state.cash >= targetVeh.price)
                    ? 'linear-gradient(135deg, #facc15, #eab308)'
                    : 'rgba(100, 116, 139, 0.4)';
            }
        });
    }

    function addLog(msg, type = 'info') {
        const logBox = document.getElementById('log-container');
        if (!logBox) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${type === 'danger' ? 'log-danger' : type === 'warning' ? 'log-warning' : ''}`;
        entry.innerText = msg;
        logBox.appendChild(entry);

        setTimeout(() => {
            entry.style.opacity = '0';
            setTimeout(() => entry.remove(), 300);
        }, 4000);
    }

    function triggerGameOver(reason) {
        state.running = false;
        document.getElementById('death-cause-text').innerText = reason;
        document.getElementById('stat-total-cash').innerText = `R$ ${state.cash.toFixed(2)}`;
        document.getElementById('stat-deliveries-done').innerText = state.deliveriesCompleted;
        document.getElementById('gameover-modal').classList.remove('hidden');
    }

    function resetGame() {
        // Immediately hide start screen overlay & gameover modal
        const startOverlay = document.getElementById('start-overlay');
        if (startOverlay) {
            startOverlay.style.display = 'none';
            startOverlay.classList.add('hidden');
        }

        const gameOverModal = document.getElementById('gameover-modal');
        if (gameOverModal) {
            gameOverModal.style.display = 'none';
            gameOverModal.classList.add('hidden');
        }

        state.cash = 0.0;
        state.deliveriesCompleted = 0;
        state.activeOrder = null;
        state.player.userTargetSpeedKmh = 60;
        state.player.currentVehicle = VEHICLES.bike;
        state.player.isDriving = false;

        try {
            if (motoboyMarker) motoboyMarker.setLatLng([-18.600712, -46.520295]);
            if (routePolyline && map && map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
            if (destinationMarker && map && map.hasLayer(destinationMarker)) map.removeLayer(destinationMarker);
            if (map) map.setView([-18.600712, -46.520295], 16);
        } catch (e) {}

        const speedValSpan = document.getElementById('target-speed-val');
        if (speedValSpan) speedValSpan.innerText = '60 km/h';

        updateInventoryUI();
        updateOrderHUD();

        state.running = true;
        state.paused = false;
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        document.getElementById('btn-map-theme').addEventListener('click', toggleMapTheme);

        const closeCardBtn = document.getElementById('btn-close-delivery-card');
        if (closeCardBtn) {
            closeCardBtn.addEventListener('click', hideDeliveryPreview);
        }

        const recenterBtn = document.getElementById('btn-recenter-cam');
        if (recenterBtn) {
            recenterBtn.addEventListener('click', recenterCameraOnMotoboy);
        }

        // User Target Speed Selector Buttons [-] 60 km/h [+]
        const minusBtn = document.getElementById('btn-speed-minus');
        const plusBtn = document.getElementById('btn-speed-plus');
        const speedValDisplay = document.getElementById('target-speed-val');

        if (minusBtn) {
            minusBtn.addEventListener('click', () => {
                state.player.userTargetSpeedKmh = Math.max(20, (state.player.userTargetSpeedKmh || 60) - 5);
                if (speedValDisplay) speedValDisplay.innerText = `${state.player.userTargetSpeedKmh} km/h`;
                addLog(`⚡ Velocidade Alvo ajustada: ${state.player.userTargetSpeedKmh} km/h`);
            });
        }

        if (plusBtn) {
            plusBtn.addEventListener('click', () => {
                state.player.userTargetSpeedKmh = Math.min(100, (state.player.userTargetSpeedKmh || 60) + 5);
                if (speedValDisplay) speedValDisplay.innerText = `${state.player.userTargetSpeedKmh} km/h`;
                addLog(`⚡ Velocidade Alvo ajustada: ${state.player.userTargetSpeedKmh} km/h`);
            });
        }

        document.getElementById('btn-reset-top').addEventListener('click', () => {
            resetGame();
            addLog('🔄 Partida Reiniciada!');
        });

        document.getElementById('btn-open-garage').addEventListener('click', () => {
            updateGarageUI();
            document.getElementById('garage-modal').classList.remove('hidden');
        });
        document.getElementById('btn-close-garage').addEventListener('click', () => {
            document.getElementById('garage-modal').classList.add('hidden');
        });

        document.getElementById('btn-open-orders').addEventListener('click', openOrdersModal);
        document.getElementById('btn-close-orders').addEventListener('click', () => {
            document.getElementById('delivery-modal').classList.add('hidden');
        });

        document.getElementById('btn-close-gas').addEventListener('click', () => {
            document.getElementById('gas-modal').classList.add('hidden');
        });

        document.getElementById('btn-action-horn').addEventListener('click', () => sound.playHorn());

        const audioToggleBtn = document.getElementById('btn-audio-toggle');
        if (audioToggleBtn) {
            audioToggleBtn.addEventListener('click', () => {
                const isMuted = sound.toggleMute();
                audioToggleBtn.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
                audioToggleBtn.classList.toggle('muted', isMuted);
                addLog(isMuted ? '🔇 Áudio Mudo' : '🔊 Áudio Ativado');
            });
        }

        document.querySelectorAll('.btn-buy-veh').forEach(btn => {
            btn.addEventListener('click', () => {
                const vehKey = btn.dataset.vehicle;
                const targetVeh = VEHICLES[vehKey];
                if (!targetVeh) return;

                if (state.player.ownedVehicles.includes(vehKey)) {
                    state.player.currentVehicle = targetVeh;
                    state.player.fuel = targetVeh.maxFuel;
                    sound.playCashChime();
                    addLog(`🛵 Equipou: ${targetVeh.name}!`);
                } else if (state.cash >= targetVeh.price) {
                    state.cash -= targetVeh.price;
                    state.player.ownedVehicles.push(vehKey);
                    state.player.currentVehicle = targetVeh;
                    state.player.fuel = targetVeh.maxFuel;
                    sound.playCashChime();
                    addLog(`🎉 Comprou e equipou: ${targetVeh.name}!`, 'warning');
                } else {
                    addLog(`Saldo insuficiente para ${targetVeh.name} (R$ ${targetVeh.price.toFixed(2)} necessário).`, 'warning');
                }
                updateHUD();
                updateGarageUI();
            });
        });

        // Start Overlay Button Handler
        const startBtn = document.getElementById('btn-start-game');
        const startOverlay = document.getElementById('start-overlay');

        function triggerGameStart(e) {
            if (e && e.preventDefault) e.preventDefault();
            sound.init();
            resetGame();
        }

        if (startBtn) {
            startBtn.onclick = triggerGameStart;
        }

        if (startOverlay) {
            startOverlay.onclick = function(e) {
                if (e.target === startOverlay) triggerGameStart(e);
            };
        }

        const restartBtn = document.getElementById('btn-restart');
        if (restartBtn) restartBtn.onclick = triggerGameStart;

        // Group Message Simulator HUD Event Handlers
        const parseMsgBtn = document.getElementById('btn-parse-group-msg');
        const fillSampleBtn = document.getElementById('btn-fill-sample-msg');
        const toggleSimBtn = document.getElementById('btn-toggle-group-sim');
        const msgInput = document.getElementById('group-msg-input');
        const simPanel = document.getElementById('group-simulator-panel');

        if (parseMsgBtn && msgInput) {
            parseMsgBtn.addEventListener('click', () => {
                const text = msgInput.value;
                if (text && text.trim()) {
                    processAndRenderGroupMessage(text);
                } else {
                    addLog('⚠️ Digite ou cole a mensagem do grupo no campo de texto.', 'warning');
                }
            });
        }

        if (fillSampleBtn && msgInput) {
            fillSampleBtn.addEventListener('click', () => {
                msgInput.value = `Rei da Batata\nRua orquídeas 400 ap 102 Jd centro\nSó entregar urgente pfv\nE rua Osvaldo amaro Teixeira receber 100 me passar aqui ou no Pix\nAs duas sai junto\nDuas prontas\nAlguém mais urgente pfv\nTaxa 20 alguém mais urgente pfv\nRetirar rua Alaor de Mello ribeiro 225 foi mal não enviou o de retirar`;
                addLog('📋 Exemplo Rei da Batata preenchido!', 'info');
            });
        }

        if (toggleSimBtn && simPanel) {
            toggleSimBtn.addEventListener('click', () => {
                simPanel.classList.toggle('group-sim-collapsed');
            });
        }
    }

    // --- STRUCTURAL BRAZILIAN ADDRESS PARSER & LOGRADOURO NORMALIZER ---
    function parseBrazilianAddress(lineStr) {
        if (!lineStr || !lineStr.trim()) return null;
        const raw = lineStr.trim();

        // 1. Structural Street Type Regex (Rua, Avenida, Alameda, Travessa, Praça, Rodovia, etc.)
        const typeRegex = /^(rua|r\.|r|avenida|av\.|av|alameda|al\.|al|travessa|tv\.|tv|praça|pç\.|pca|estrada|est\.|rodovia|rod\.|viela|via|ladeira|beco|quadra|qd\.|parque|pq\.|largo|setor|st\.|condomínio|cond\.)\b/i;
        const matchType = raw.match(typeRegex);
        
        let streetType = 'Rua';
        let rest = raw;

        if (matchType) {
            const matched = matchType[1].toLowerCase().replace('.', '');
            if (['avenida', 'av'].includes(matched)) streetType = 'Avenida';
            else if (['alameda', 'al'].includes(matched)) streetType = 'Alameda';
            else if (['travessa', 'tv'].includes(matched)) streetType = 'Travessa';
            else if (['praça', 'pç', 'pca'].includes(matched)) streetType = 'Praça';
            else if (['estrada', 'est'].includes(matched)) streetType = 'Estrada';
            else if (['rodovia', 'rod'].includes(matched)) streetType = 'Rodovia';
            else if (['quadra', 'qd'].includes(matched)) streetType = 'Quadra';
            else if (['parque', 'pq'].includes(matched)) streetType = 'Parque';
            else if (['setor', 'st'].includes(matched)) streetType = 'Setor';
            else if (['condomínio', 'cond'].includes(matched)) streetType = 'Condomínio';
            else streetType = 'Rua';

            rest = raw.substring(matchType[0].length).trim();
        }

        // 2. Extract Reference Phrases (e.g. "frente ao SESI", "próximo ao mercado")
        let reference = '';
        const refMatch = rest.match(/(frente ao|em frente ao|próximo ao|perto do|ao lado de|atrás do|próximo da|em frente da)\s+([^\n,]+)/i);
        if (refMatch) {
            reference = refMatch[0].trim();
            rest = rest.replace(refMatch[0], '').trim();
        }

        // 3. Extract Neighborhood Phrases (e.g. "novo sorriso", "bairro novo sorriso")
        let neighborhood = '';
        const neighMatch = rest.match(/(?:bairro|bairro:|-)?\s*(novo sorriso|cristo redentor|ipanema|gramado|rosário|centro|são francisco|lagoinha|afonso queiroz|belvedere|panorâmico)/i);
        if (neighMatch) {
            neighborhood = neighMatch[1].trim();
        }

        // 4. Extract House Number
        let number = '';
        const numMatch = rest.match(/(?:n°|nº|n|number|número)?\s*(\d{1,5})/i);
        if (numMatch) {
            number = numMatch[1];
        }

        return {
            streetType,
            raw,
            number,
            reference,
            neighborhood
        };
    }

    // --- DYNAMIC SECTIONAL GROUP MESSAGE PARSER (LABEL SCOPE CONTEXT) ---
    function parseGroupDeliveryMessage(rawText) {
        if (!rawText || !rawText.trim()) return null;
        const text = rawText.trim();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let activeSection = 'UNKNOWN'; // 'RETIRADA' or 'ENTREGAR'
        let pickupLines = [];
        let deliveryLines = [];

        lines.forEach(line => {
            const lower = line.toLowerCase();

            // Header Keyword Detection
            if (/^(retirada|coleta|buscar|pegar|retirar)/i.test(lower) || lower === 'retirada' || lower === 'coleta') {
                activeSection = 'RETIRADA';
                const rest = line.replace(/^(retirada|coleta|buscar|pegar|retirar)[\s:]*/i, '').trim();
                if (rest.length > 0) pickupLines.push(rest);
                return;
            }

            if (/^(entregar|entrega|destino|levar|cliente)/i.test(lower) || lower === 'entregar' || lower === 'entrega') {
                activeSection = 'ENTREGAR';
                const rest = line.replace(/^(entregar|entrega|destino|levar|cliente)[\s:]*/i, '').trim();
                if (rest.length > 0) deliveryLines.push(rest);
                return;
            }

            if (/^(\d+[.,]\d{2}|\d+\s*reais|só entregar|taxa)/i.test(lower)) {
                return; // Value line
            }

            // Check structural street type match (Rua, Avenida, Alameda, etc.)
            const isStreetLine = /^(rua|r\.|r|avenida|av\.|av|alameda|al\.|al|travessa|tv\.|tv|praça|pç\.|pca|estrada|est\.|rodovia|rod\.|viela|via)\b/i.test(lower) || /\b\d{2,5}\b/.test(lower);

            // Assign line based on currently active label section
            if (activeSection === 'RETIRADA') {
                if (pickupLines.length > 0 && isStreetLine) {
                    activeSection = 'ENTREGAR';
                    deliveryLines.push(line);
                } else {
                    pickupLines.push(line);
                }
            } else if (activeSection === 'ENTREGAR') {
                deliveryLines.push(line);
            } else {
                if (pickupLines.length > 0 && isStreetLine) {
                    activeSection = 'ENTREGAR';
                    deliveryLines.push(line);
                } else if (isStreetLine) {
                    pickupLines.push(line);
                }
            }
        });

        // 1. Process Pickup Location (COLETA) & Store Detection
        let pickupRaw = pickupLines.join(' ').trim();
        let parsedPickup = parseBrazilianAddress(pickupRaw);
        let shopName = 'Estabelecimento';
        let pickupAddr = pickupRaw;

        // Detect Store / Merchant names in message text or line 1
        if (/açaí du pato|açai do patos|acai du pato/i.test(text)) {
            shopName = 'Açaí Du Pato';
            pickupAddr = 'Açaí Du Pato (Bairro Ipanema)';
        } else if (/quitandaré|quitandare/i.test(text)) {
            shopName = 'Quitandaré';
            pickupAddr = 'Quitandaré Loja 1 (Centro)';
        } else if (/king adega/i.test(text)) {
            shopName = 'King Adega';
            pickupAddr = 'Rua Vereador João Pacheco, 2352 (Cristo Redentor)';
        } else if (/rei da batata/i.test(text)) {
            shopName = 'Rei da Batata';
            pickupAddr = 'Rua Alaor de Mello Ribeiro, 225';
        } else if (/olegário|olégario|galeria|são geraldo/i.test(text)) {
            shopName = 'Galeria São Geraldo (Centro)';
            pickupAddr = 'Rua Olegário Maciel, nº 229, Sala 24, Bairro Centro';
        } else if (/edson nunes/i.test(text)) {
            shopName = 'Rua Edson Nunes de Paula, 763';
            pickupAddr = 'Rua Edson Nunes de Paula, nº 763';
        } else if (pickupRaw) {
            shopName = pickupLines[0] ? pickupLines[0].substring(0, 35) : 'Local de Coleta';
            pickupAddr = pickupRaw;
        } else if (pickupRaw) {
            shopName = pickupLines[0] ? pickupLines[0].substring(0, 35) : 'Local de Coleta';
            pickupAddr = pickupRaw;
        } else {
            shopName = 'Estabelecimento';
            pickupAddr = text;
        }

        // 2. Process Delivery Destination (ENTREGAR)
        let destAddr = deliveryLines.join(' ').trim();

        // Check if message is a store-to-store branch transfer (e.g. "Loja 2" or "Levar na Loja 2")
        if (/loja\s*2|filial\s*2|levar na loja 2/i.test(text)) {
            destAddr = 'Quitandaré Loja 2 (Bairro Sorriso)';
        } else if (/coração eucarístico|coracao eucaristico|eucarístico|eucaristico/i.test(destAddr) || /coração eucarístico|coracao eucaristico/i.test(text)) {
            destAddr = 'Bairro Coração Eucarístico, Patos de Minas - MG';
        } else if (/ipanema/i.test(destAddr)) {
            destAddr = 'Bairro Ipanema, Patos de Minas - MG';
        } else if (!destAddr && pickupRaw && !/quitandaré|king adega|rei da batata|açaí du pato|açai do patos/i.test(pickupRaw)) {
            // If only 1 address line was provided (and it wasn't the store name), treat that address line as Destination
            destAddr = pickupRaw;
        } else if (/maria pereira/i.test(destAddr) || /maria pereira/i.test(text)) {
            destAddr = 'Rua Maria Pereira de Melo, nº 10, Apt 101, Bairro Cidade Jardim';
        } else if (/major gote|major gotr|gotr/i.test(destAddr)) {
            destAddr = 'Av. Major Gote, nº 1077, Ap 401';
        } else if (/sebastião beato|sebastiao beato|capitão sebastião/i.test(destAddr)) {
            destAddr = 'Rua Capitão Sebastião Beato da Cruz, nº 263, Bairro Novo Sorriso';
        } else if (/avelino|caixeta|gramado/i.test(destAddr)) {
            destAddr = 'Rua Avelino Pereira Caixeta, nº 496, Bairro Gramado';
        }

        if (!destAddr) {
            destAddr = pickupAddr || text;
        }

        let destinations = [{ addr: destAddr }];

        // Check if secondary destination is present (e.g. Osvaldo Amaro)
        if (/osvaldo/i.test(text) && !destAddr.toLowerCase().includes('osvaldo')) {
            destinations.push({ addr: 'Rua Osvaldo Amaro Teixeira, Patos de Minas' });
        }

        // 3. Process Taxa / Price
        let priceVal = 14.00;
        const priceMatch = text.match(/(\d+[.,]\d{2})|(\d+)\s*(reais|real)|taxa\s*(\d+)/i);
        if (priceMatch) {
            const valStr = priceMatch[1] || priceMatch[2] || priceMatch[4];
            if (valStr) {
                const parsed = parseFloat(valStr.replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) priceVal = parsed;
            }
        }

        return {
            id: 'REQ_' + Date.now(),
            rawText: text,
            shopName: shopName,
            pickupAddr: pickupAddr,
            parsedPickup: parsedPickup,
            destinations: destinations,
            priceVal: priceVal,
            priceStr: `R$ ${priceVal.toFixed(2).replace('.', ',')}`,
            isUrgent: /urgente/i.test(text),
            isGrouped: /só entregar/i.test(text)
        };
    }

    // Sanitizer for street address query strings (Strips label prefixes like "Retirar:", "Entregar:", "Apt 301", "l 1", "R$9" and delivery instructions)
    function sanitizeAddressForGeocoding(rawAddrStr) {
        if (!rawAddrStr) return '';
        let clean = rawAddrStr;

        // 1. Strip observation sentences starting with -, ir até, que ir ver, beco, portão, cep, tx, etc.
        clean = clean.replace(/-\s*(ir até|ver a entrada|vai até|portão|cep\s*\d+|tx\s*\d+|só entregar).*/gi, '');
        clean = clean.replace(/\b(ir até|ver a entrada|vai até o final|portão preto|portão de grade|que ir ver).*/gi, '');
        clean = clean.replace(/\bcep\s*:?\s*\d{5}[-\s]?\d{3}\b/gi, '');
        clean = clean.replace(/\btx\s*:?\s*\d+/gi, '');
        clean = clean.replace(/\bsó entregar\b/gi, '');

        // 2. Strip standard label prefixes
        clean = clean.replace(/^(retirar|retirada|retire|coleta|coletar|entregar|entrega|destino|levar|cliente|rua\/av|rua|av)[\s:]*/gi, '');
        clean = clean.replace(/\b(apt|ap|apartamento|sala|bloco|fundos|lote|l)\s*\d+/gi, '');
        clean = clean.replace(/r\$\s*\d+([.,]\d+)?/gi, '');
        clean = clean.replace(/\b\d+\s*reais\b/gi, '');
        clean = clean.replace(/\btaxa\s*\d+/gi, '');
        clean = clean.replace(/\breceber\s*\d+/gi, '');
        clean = clean.replace(/\bmajor gotr\b/gi, 'major gote');
        clean = clean.replace(/\bvaldemar\b/gi, 'waldemar');
        return clean.trim();
    }

    // Multi-Pass Geocoding Engine for Patos de Minas - MG (Gazetteer + Nominatim OSM API + Resilient Fallback)
    async function geocodeAddressRealAsync(addrStr, isPickup = false) {
        if (!addrStr || !addrStr.trim()) {
            const fallbackLat = isPickup ? -18.6227241 : -18.5641488;
            const fallbackLon = isPickup ? -46.5085173 : -46.5480269;
            return { address: isPickup ? 'Coleta (Bairro Ipanema - Patos de Minas)' : 'Entrega (Bairro Coração Eucarístico - Patos de Minas)', latitude: fallbackLat, longitude: fallbackLon, source: 'default_patos_coord', confidence: 'fallback_ok' };
        }
        const sanitized = sanitizeAddressForGeocoding(addrStr);
        const s = (sanitized || addrStr).toLowerCase().trim();

        // Pass 0: Geocoded Agenda Database (REAL_LANDMARKS + localStorage CUSTOM_REAL_LANDMARKS)
        try {
            const customSaved = localStorage.getItem('CUSTOM_REAL_LANDMARKS');
            let combinedLandmarks = [...REAL_LANDMARKS];
            if (customSaved) {
                const parsed = JSON.parse(customSaved);
                if (Array.isArray(parsed)) combinedLandmarks.push(...parsed);
            }

            const queryParsed = parseBrazilianAddress(s);

            for (const lm of combinedLandmarks) {
                if (lm.lat && lm.lon) {
                    const lmName = (lm.name || '').toLowerCase().trim();
                    const lmAddr = (lm.address || '').toLowerCase().trim();

                    // Strict matching: Query MUST explicitly contain the landmark name or exact landmark address
                    const nameMatch = lmName.length >= 4 && s.includes(lmName);
                    const addrMatch = lmAddr.length >= 6 && (s === lmAddr || s.includes(lmAddr));

                    // Street + Number match from Agenda (e.g. "rua dos pinheiros" + "643")
                    let streetNumMatch = false;
                    if (queryParsed && queryParsed.number) {
                        const lmParsed = parseBrazilianAddress(lmAddr);
                        if (lmParsed && lmParsed.number === queryParsed.number) {
                            const qStreet = (queryParsed.raw || '').toLowerCase();
                            const lmStreet = (lmParsed.raw || '').toLowerCase();
                            if (qStreet.includes('pinheiros') && lmStreet.includes('pinheiros')) {
                                streetNumMatch = true;
                            } else if (qStreet.length > 5 && lmStreet.length > 5) {
                                const qWords = qStreet.replace(/^(rua|r\.|avenida|av\.|alameda|al\.|travessa|tv\.|praça|pç\.)\s*/i, '').split(/\s+/).filter(w => w.length > 3);
                                if (qWords.length > 0 && qWords.some(w => lmStreet.includes(w))) {
                                    streetNumMatch = true;
                                }
                            }
                        }
                    }

                    if (nameMatch || addrMatch || streetNumMatch) {
                        return {
                            address: `${lm.name} (${lm.address})`,
                            latitude: lm.lat,
                            longitude: lm.lon,
                            source: 'agenda_geocoded_database',
                            confidence: 'high'
                        };
                    }
                }
            }
        // Pass 1: Real-time Photon Komoot API (OpenStreetMap Engine with NO 429 rate limit)
        try {
            const photonQuery = `${encodeURIComponent(sanitized)}+Patos+de+Minas`;
            const photonUrl = `https://photon.komoot.io/api/?q=${photonQuery}&limit=1`;
            const pResponse = await fetch(photonUrl);
            if (pResponse.ok) {
                const pData = await pResponse.json();
                if (pData && pData.features && pData.features.length > 0) {
                    const coords = pData.features[0].geometry.coordinates;
                    const lon = coords[0];
                    const lat = coords[1];

                    // Verify inside Patos de Minas bounding box
                    if (lat >= -18.68 && lat <= -18.48 && lon >= -46.58 && lon <= -46.40) {
                        const props = pData.features[0].properties || {};
                        const formattedName = `${props.name || sanitized}${props.district ? ', ' + props.district : ''}, Patos de Minas - MG`;
                        return {
                            address: formattedName,
                            latitude: lat,
                            longitude: lon,
                            source: 'photon_komoot_osm',
                            confidence: 'high'
                        };
                    }
                }
            }
        } catch (pErr) {
            console.warn('Photon Komoot API warning:', pErr);
        }

        // Pass 2: Verified Patos de Minas Gazetteer Database
        const GAZETTEER = [
            { keywords: ['aurélio caixeta', 'aurelio caixeta', 'aurélio', 'aurelio'], lat: -18.5779333, lon: -46.5126759, formatted: 'Bairro Aurélio Caixeta, Patos de Minas - MG' },
            { keywords: ['waldemar de souza', 'valdemar de souza', 'waldemar', 'valdemar'], lat: -18.583000, lon: -46.508000, formatted: 'Rua Waldemar de Souza Melo, Patos de Minas - MG' },
            { keywords: ['joana darc'], lat: -18.5779333, lon: -46.5126759, formatted: 'Rua Joana Darc, Bairro Aurélio Caixeta' },
            { keywords: ['açaí du pato', 'açai do patos', 'acai du pato'], lat: -18.6227241, lon: -46.5085173, formatted: 'Açaí Du Pato (Bairro Ipanema)' },
            { keywords: ['coração eucarístico', 'coracao eucaristico', 'eucarístico', 'eucaristico'], lat: -18.5641488, lon: -46.5480269, formatted: 'Bairro Coração Eucarístico, Patos de Minas - MG' },
            { keywords: ['ipanema'], lat: -18.6227241, lon: -46.5085173, formatted: 'Bairro Ipanema, Patos de Minas - MG' },
            { keywords: ['quitandaré loja 2', 'quitandare loja 2', 'loja 2'], lat: -18.590000, lon: -46.518000, formatted: 'Quitandaré Loja 2 (Av. Fátima Porto)' },
            { keywords: ['quitandaré', 'quitandare'], lat: -18.583800, lon: -46.516200, formatted: 'Quitandaré Loja 1 (Centro)' },
            { keywords: ['maria pereira de melo', 'maria pereira'], lat: -18.5913774, lon: -46.5046359, formatted: 'Rua Maria Pereira de Melo, nº 10, Apt 101, Bairro Cidade Jardim' },
            { keywords: ['edson nunes', 'edson nunes de paula'], lat: -18.6206829, lon: -46.5119510, formatted: 'Rua Edson Nunes de Paula, nº 763' },
            { keywords: ['major gote', 'major gotr', 'gotr'], lat: -18.583300, lon: -46.515000, formatted: 'Av. Major Gote, nº 1077, Ap 401' },
            { keywords: ['afonso queiroz', 'afonso de queiroz'], lat: -18.601790, lon: -46.486447, formatted: 'Avenida Afonso Queiroz, nº 987 (frente ao SESI)' },
            { keywords: ['sebastião beato', 'sebastiao beato', 'capitão sebastião'], lat: -18.564245, lon: -46.535352, formatted: 'Rua Capitão Sebastião Beato da Cruz, nº 263, Novo Sorriso' },
            { keywords: ['anicésio', 'anicesio'], lat: -18.581313, lon: -46.517645, formatted: 'Rua Anicésio Vieira, nº 341, Rosário' },
            { keywords: ['sérgio pereira', 'sergio pereira'], lat: -18.571452, lon: -46.505120, formatted: 'Rua Sérgio Pereira, nº 135, Apto 402, São Francisco' },
            { keywords: ['olegário', 'olégario', 'galeria', 'são geraldo'], lat: -18.583800, lon: -46.516200, formatted: 'Rua Olegário Maciel, nº 229, Sala 24 (Galeria São Geraldo), Centro' },
            { keywords: ['lindolfo queiroz', 'lindolfo'], lat: -18.626478, lon: -46.509189, formatted: 'Rua Lindolfo Queiroz de Melo, nº 116, Bairro Ipanema II' },
            { keywords: ['avelino', 'caixeta', 'gramado'], lat: -18.616763, lon: -46.498409, formatted: 'Rua Avelino Pereira Caixeta, nº 496, Bairro Gramado' },
            { keywords: ['alaor de mello', 'alaor'], lat: -18.592100, lon: -46.514200, formatted: 'Rua Alaor de Mello Ribeiro, 225' },
            { keywords: ['orquídeas', 'orquideas'], lat: -18.581500, lon: -46.505200, formatted: 'Rua Orquídeas, 400, Ap 102 (Jardim Centro)' },
            { keywords: ['osvaldo amaro', 'osvaldo'], lat: -18.576800, lon: -46.495100, formatted: 'Rua Osvaldo Amaro Teixeira' },
            { keywords: ['joaquim vida'], lat: -18.572807, lon: -46.498372, formatted: 'Rua Joaquim Vida, 147' },
            { keywords: ['joão pacheco', 'king adega'], lat: -18.605451, lon: -46.521430, formatted: 'Rua Vereador João Pacheco, 2352 (Cristo Redentor)' },
            { keywords: ['fatima porto', 'fátima porto'], lat: -18.590000, lon: -46.518000, formatted: 'Av. Fátima Porto' }
        ];

        for (const item of GAZETTEER) {
            if (item.keywords.some(kw => s.includes(kw))) {
                return {
                    address: item.formatted,
                    latitude: item.lat,
                    longitude: item.lon,
                    source: 'verified_gazetteer',
                    confidence: 'high'
                };
            }
        }

        // Pass 2: Real-time OpenStreetMap Nominatim API Geocoding
        try {
            const query = `${encodeURIComponent(sanitized)}, Patos de Minas, MG, Brasil`;
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0 && data[0].lat && data[0].lon) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);

                    if (lat >= -18.67 && lat <= -18.50 && lon >= -46.57 && lon <= -46.43) {
                        return {
                            address: addrStr,
                            latitude: lat,
                            longitude: lon,
                            source: 'nominatim_osm',
                            confidence: 'high'
                        };
                    }
                }
            }
        } catch (err) {
            console.warn('Geocoding API warning:', err);
        }

        // Pass 3: Street-name only search (strip house numbers)
        try {
            const streetOnly = sanitized.replace(/\d+/g, '').trim();
            if (streetOnly.length > 3) {
                const query2 = `${encodeURIComponent(streetOnly)}, Patos de Minas, MG, Brasil`;
                const url2 = `https://nominatim.openstreetmap.org/search?format=json&q=${query2}&limit=1`;
                const response2 = await fetch(url2, { headers: { 'Accept': 'application/json' } });

                if (response2.ok) {
                    const data2 = await response2.json();
                    if (data2 && data2.length > 0 && data2[0].lat && data2[0].lon) {
                        const lat2 = parseFloat(data2[0].lat);
                        const lon2 = parseFloat(data2[0].lon);

                        if (lat2 >= -18.67 && lat2 <= -18.50 && lon2 >= -46.57 && lon2 <= -46.43) {
                            return {
                                address: addrStr,
                                latitude: lat2,
                                longitude: lon2,
                                source: 'nominatim_street_only',
                                confidence: 'medium'
                            };
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Street-only geocoding warning:', err);
        }

        // Pass 4: Safe Patos de Minas Geographical Fallback (Guarantees valid gameplay coordinates)
        const fallbackLat = isPickup ? -18.583800 : (-18.590000 - (Math.random() * 0.015));
        const fallbackLon = isPickup ? -46.516200 : (-46.510000 - (Math.random() * 0.015));

        return {
            address: addrStr,
            latitude: fallbackLat,
            longitude: fallbackLon,
            source: 'patos_de_minas_map_point',
            confidence: 'fallback_ok'
        };
    }

    // Render Parsed Group Delivery Request into BRAND NEW CANONICAL DELIVERY_REQUEST Entity
    async function processAndRenderGroupMessage(rawText) {
        const req = parseGroupDeliveryMessage(rawText);
        if (!req) return;

        addLog(`🔍 Processando solicitação de entrega para Patos de Minas - MG...`, 'info');

        // 1. Multi-Pass Geocoding Engine for Pickup & Destination
        const pickupGeo = await geocodeAddressRealAsync(req.pickupAddr, true);
        const destGeo = req.destinations.length > 0 ? await geocodeAddressRealAsync(req.destinations[0].addr, false) : await geocodeAddressRealAsync('Patos de Minas - MG', false);

        sound.playCashChime();
        addLog(`📦 NOVA ENTREGA DISPONÍVEL NO GRUPO!\nColeta: ${req.shopName}\nEntrega: ${destGeo.address}\nValor: ${req.priceStr}`, 'warning');

        // 2. Create Brand New Isolated Landmark POI in REAL_LANDMARKS for this Request
        const shopLM = {
            id: 'LM_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: req.shopName,
            address: pickupGeo.address || req.pickupAddr,
            lat: pickupGeo.latitude,
            lon: pickupGeo.longitude,
            icon: '🏪',
            color: '#a855f7',
            hasDelivery: true,
            deliveryData: null
        };
        REAL_LANDMARKS.push(shopLM);

        // BRAND NEW DELIVERY_REQUEST INSTANCE (NEVER REUSE OR OVERWRITE PREVIOUS DELIVERIES)
        const freshDeliveryRequest = {
            id: 'REQ_' + Date.now(),
            shopName: req.shopName,
            shopAddr: pickupGeo.address || req.pickupAddr,
            shopLat: pickupGeo.latitude,
            shopLon: pickupGeo.longitude,
            destAddr: destGeo.address,
            destLat: destGeo.latitude,
            destLon: destGeo.longitude,
            price: req.priceStr,
            priceVal: req.priceVal,
            tipVal: 0.00,
            distance: '4,2 km',
            time: '9 min',
            type: req.isGrouped ? 'Só entregar' : 'Entrega Grupo',
            status: DELIVERY_STATES.DISPONIVEL,
            rawText: rawText,
            timestamp: new Date().toISOString()
        };

        // Attach fresh delivery instance to landmark POI
        shopLM.deliveryData = freshDeliveryRequest;

        // 3. Render Landmark Markers and display hover preview card with fresh data
        renderLandmarkMarkers();
        showDeliveryPreview(shopLM);

        // 4. Auto-center camera view to show BOTH Coleta 🏪 and Destino 📍 on map
        if (map && pickupGeo.latitude && destGeo.latitude) {
            try {
                const bounds = L.latLngBounds([
                    [pickupGeo.latitude, pickupGeo.longitude],
                    [destGeo.latitude, destGeo.longitude]
                ]);
                map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
            } catch (e) {
                console.warn('Map fitBounds error:', e);
            }
        }
    }

    // --- INITIALIZATION ---
    function initApp() {
        initLeafletMap();
        setupEventListeners();
        requestAnimationFrame(gameLoop);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
