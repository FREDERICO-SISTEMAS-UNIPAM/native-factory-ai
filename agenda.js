/* ==========================================================================
   DELIVERY BOY — AGENDA GEOCODER & REAL_LANDMARKS GENERATOR ENGINE
   ========================================================================== */

(function() {
    'use strict';

    // Global State for Agenda Items
    let agendaItems = [];
    let selectedItemIndex = -1;

    // Leaflet Map & Markers
    let map = null;
    let mapMarkers = [];

    // Patos de Minas Center Coordinates
    const PATOS_CENTER = { lat: -18.595500, lon: -46.516500 };

    // Initialize Map on Load
    function initMap() {
        if (map) return;
        map = L.map('agenda-map').setView([PATOS_CENTER.lat, PATOS_CENTER.lon], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Map Click Listener to Update Selected Item Location
        map.on('click', function(e) {
            if (selectedItemIndex >= 0 && selectedItemIndex < agendaItems.length) {
                const item = agendaItems[selectedItemIndex];
                item.lat = parseFloat(e.latlng.lat.toFixed(6));
                item.lon = parseFloat(e.latlng.lng.toFixed(6));
                item.status = 'success';
                item.manuallyAdjusted = true;

                updateMapMarkers();
                renderItemsList();
                updateExportCode();
                showStatus(`📍 Posição de "${item.name}" atualizada no mapa para (${item.lat}, ${item.lon})`);
            }
        });
    }

    // Standardize IDs for REAL_LANDMARKS
    function slugify(text) {
        return text
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    // Auto-detect Icon & Color based on Place Name / Address
    function detectIconAndColor(name, address) {
        const full = (name + ' ' + address).toLowerCase();
        if (full.includes('adega') || full.includes('conveniencia') || full.includes('bebida')) return { icon: '🏪', color: '#a855f7' };
        if (full.includes('caldo') || full.includes('lagoa') || full.includes('suco') || full.includes('bebida')) return { icon: '🥤', color: '#16a34a' };
        if (full.includes('padaria') || full.includes('pao') || full.includes('panificadora')) return { icon: '🥐', color: '#ca8a04' };
        if (full.includes('pizza') || full.includes('pizzaria') || full.includes('massa')) return { icon: '🍕', color: '#ea580c' };
        if (full.includes('shopping') || full.includes('patio') || full.includes('galeria') || full.includes('loja')) return { icon: '🏢', color: '#0284c7' };
        if (full.includes('posto') || full.includes('shell') || full.includes('petrobras') || full.includes('combustivel')) return { icon: '⛽', color: '#0d9488' };
        if (full.includes('oficina') || full.includes('mecanica') || full.includes('moto')) return { icon: '🛠️', color: '#4f46e5' };
        if (full.includes('hamburguer') || full.includes('lanchonete') || full.includes('burger') || full.includes('batata')) return { icon: '🍔', color: '#ef4444' };
        return { icon: '📍', color: '#3b82f6' };
    }

    // --- PARSERS FOR EXPORTED AGENDA FILES ---

    // 1. Parse vCard (.vcf)
    function parseVCard(vcardText) {
        const items = [];
        const cards = vcardText.split(/END:VCARD/i);

        cards.forEach((card, idx) => {
            if (!card.trim()) return;
            let name = '';
            let address = '';
            let lat = null;
            let lon = null;
            let phone = '';

            const lines = card.split(/\r?\n/);
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.toUpperCase().startsWith('FN:')) {
                    name = trimmed.substring(3).trim();
                } else if (trimmed.toUpperCase().startsWith('N:') && !name) {
                    const parts = trimmed.substring(2).split(';');
                    name = parts.reverse().join(' ').trim();
                } else if (trimmed.toUpperCase().startsWith('ADR') || trimmed.toUpperCase().includes(';ADR')) {
                    const idxColon = trimmed.indexOf(':');
                    if (idxColon !== -1) {
                        const parts = trimmed.substring(idxColon + 1).split(';');
                        address = parts.filter(p => p.trim()).join(', ');
                    }
                } else if (trimmed.toUpperCase().startsWith('TEL')) {
                    const idxColon = trimmed.indexOf(':');
                    if (idxColon !== -1) phone = trimmed.substring(idxColon + 1).trim();
                } else if (trimmed.toUpperCase().startsWith('GEO:')) {
                    const geoStr = trimmed.substring(4).trim();
                    const parts = geoStr.split(';');
                    if (parts.length === 2) {
                        lat = parseFloat(parts[0]);
                        lon = parseFloat(parts[1]);
                    }
                }
            });

            if (name || address) {
                const cleanName = name || `Contato ${idx + 1}`;
                const cleanAddr = address || cleanName;
                const meta = detectIconAndColor(cleanName, cleanAddr);

                items.push({
                    id: slugify(cleanName) || `LANDMARK_${idx + 1}`,
                    name: cleanName,
                    address: cleanAddr,
                    phone: phone,
                    lat: lat,
                    lon: lon,
                    icon: meta.icon,
                    color: meta.color,
                    hasDelivery: true,
                    status: (lat && lon) ? 'success' : 'pending'
                });
            }
        });

        return items;
    }

    // 2. Parse Raw Text Lines (WhatsApp, Notepad, etc.)
    function parseRawText(text) {
        const items = [];
        const lines = text.split(/\r?\n/);

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            let name = '';
            let address = trimmed;

            let clean = trimmed
                .replace(/^(Retirar|Retirada|Retire|Coleta|Coletar|Buscar|Entregar|Entrega|Destino|Levar):/i, '')
                .trim();

            if (clean.includes(' - ')) {
                const parts = clean.split(' - ');
                name = parts[0].trim();
                address = parts.slice(1).join(' - ').trim();
            } else if (clean.includes(': ')) {
                const parts = clean.split(': ');
                name = parts[0].trim();
                address = parts.slice(1).join(': ').trim();
            } else {
                name = clean;
                address = clean;
            }

            const meta = detectIconAndColor(name, address);

            items.push({
                id: slugify(name) || `LANDMARK_${idx + 1}`,
                name: name,
                address: address,
                lat: null,
                lon: null,
                icon: meta.icon,
                color: meta.color,
                hasDelivery: true,
                status: 'pending'
            });
        });

        return items;
    }

    // 3. Parse JSON or CSV
    function parseJSONorCSV(content) {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data.map((item, idx) => ({
                    id: item.id || slugify(item.name || `LANDMARK_${idx + 1}`),
                    name: item.name || item.nome || item.title || `Local ${idx + 1}`,
                    address: item.address || item.endereco || item.rua || '',
                    lat: item.lat ? parseFloat(item.lat) : null,
                    lon: item.lon || item.lng ? parseFloat(item.lon || item.lng) : null,
                    icon: item.icon || detectIconAndColor(item.name || '', item.address || '').icon,
                    color: item.color || detectIconAndColor(item.name || '', item.address || '').color,
                    hasDelivery: true,
                    status: (item.lat && item.lon) ? 'success' : 'pending'
                }));
            }
        } catch (e) {
            return parseRawText(content);
        }
        return parseRawText(content);
    }

    // --- NOMINATIM GEOCLEANING & BATCH GEOCODING ---

    async function geocodeItem(item) {
        if (item.lat && item.lon && item.status === 'success') {
            return item;
        }

        let cleanQuery = item.address
            .replace(/^(Retirar|Retirada|Coleta|Entregar|Entrega|Destino):/i, '')
            .trim();

        const searchAddr = `${cleanQuery}, Patos de Minas, MG, Brasil`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&limit=1`;

        try {
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'DeliveryBoyGame-AgendaGeocoder/1.0' }
            });
            const data = await resp.json();

            if (data && data.length > 0) {
                item.lat = parseFloat(parseFloat(data[0].lat).toFixed(6));
                item.lon = parseFloat(parseFloat(data[0].lon).toFixed(6));
                item.status = 'success';
            } else {
                const streetMatch = cleanQuery.match(/(Rua|Av|Avenida|Alameda|Praça|Tv|Travessa)\s+[^,0-9]+/i);
                if (streetMatch) {
                    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(streetMatch[0] + ', Patos de Minas, MG, Brasil')}&limit=1`;
                    const resp2 = await fetch(fallbackUrl, {
                        headers: { 'User-Agent': 'DeliveryBoyGame-AgendaGeocoder/1.0' }
                    });
                    const data2 = await resp2.json();
                    if (data2 && data2.length > 0) {
                        item.lat = parseFloat(parseFloat(data2[0].lat).toFixed(6));
                        item.lon = parseFloat(parseFloat(data2[0].lon).toFixed(6));
                        item.status = 'success';
                    } else {
                        item.lat = parseFloat((PATOS_CENTER.lat + (Math.random() - 0.5) * 0.02).toFixed(6));
                        item.lon = parseFloat((PATOS_CENTER.lon + (Math.random() - 0.5) * 0.02).toFixed(6));
                        item.status = 'pending';
                    }
                } else {
                    item.lat = parseFloat((PATOS_CENTER.lat + (Math.random() - 0.5) * 0.02).toFixed(6));
                    item.lon = parseFloat((PATOS_CENTER.lon + (Math.random() - 0.5) * 0.02).toFixed(6));
                    item.status = 'pending';
                }
            }
        } catch (err) {
            console.error('Erro na geocodificação:', err);
            item.lat = PATOS_CENTER.lat;
            item.lon = PATOS_CENTER.lon;
            item.status = 'error';
        }

        return item;
    }

    async function processBatchGeocoding() {
        if (agendaItems.length === 0) {
            showStatus('Nenhum item na lista para geocodificar.');
            return;
        }

        const progressBarContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        progressBarContainer.style.display = 'block';
        progressBar.style.width = '0%';

        showStatus(`Iniciando geocodificação de ${agendaItems.length} locais...`);

        for (let i = 0; i < agendaItems.length; i++) {
            const percent = Math.round(((i + 1) / agendaItems.length) * 100);
            progressBar.style.width = percent + '%';
            showStatus(`Geocodificando [${i + 1}/${agendaItems.length}]: ${agendaItems[i].name}...`);

            await geocodeItem(agendaItems[i]);
            renderItemsList();
            updateMapMarkers();
            updateExportCode();

            await new Promise(res => setTimeout(res, 800));
        }

        showStatus(`✅ Geocodificação concluída para todos os ${agendaItems.length} locais!`);
        setTimeout(() => { progressBarContainer.style.display = 'none'; }, 2000);
    }

    // --- RENDER & UI UPDATES ---

    function renderItemsList() {
        const container = document.getElementById('items-list');
        const countSpan = document.getElementById('count-items');
        countSpan.textContent = agendaItems.length;

        if (agendaItems.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #6b7280; padding: 40px 0;">
                    Nenhum estabelecimento adicionado. Importe sua agenda acima!
                </div>`;
            return;
        }

        container.innerHTML = agendaItems.map((item, idx) => {
            const isSelected = idx === selectedItemIndex;
            const badgeClass = item.status === 'success' ? 'badge-success' : item.status === 'pending' ? 'badge-pending' : 'badge-error';
            const badgeLabel = item.status === 'success' ? (item.manuallyAdjusted ? 'Ajustado' : 'OK') : 'Pendente';

            return `
                <div class="item-card ${isSelected ? 'selected' : ''}" onclick="window.selectItem(${idx})">
                    <div class="item-icon-box" style="border-left: 3px solid ${item.color};">
                        ${item.icon}
                    </div>
                    <div class="item-info">
                        <div class="item-name">${escapeHTML(item.name)}</div>
                        <div class="item-addr">${escapeHTML(item.address)}</div>
                        <div class="item-coords">
                            ${item.lat && item.lon ? `lat: ${item.lat}, lon: ${item.lon}` : 'Aguardando geocodificação...'}
                        </div>
                    </div>
                    <div class="item-status-badge ${badgeClass}">${badgeLabel}</div>
                </div>
            `;
        }).join('');
    }

    function updateMapMarkers() {
        if (!map) return;

        mapMarkers.forEach(m => map.removeLayer(m));
        mapMarkers = [];

        const bounds = L.latLngBounds();

        agendaItems.forEach((item, idx) => {
            if (!item.lat || !item.lon) return;

            const isSelected = idx === selectedItemIndex;
            const markerColor = isSelected ? '#eab308' : item.color || '#3b82f6';

            const iconHtml = `
                <div style="
                    background: ${markerColor};
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    border: 2px solid #ffffff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'};
                    transition: transform 0.2s ease;
                ">
                    ${item.icon}
                </div>
            `;

            const customIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-landmark-marker',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });

            const marker = L.marker([item.lat, item.lon], { icon: customIcon, draggable: true })
                .addTo(map)
                .bindPopup(`<b>${escapeHTML(item.name)}</b><br>${escapeHTML(item.address)}<br><small>lat: ${item.lat}, lon: ${item.lon}</small>`);

            marker.on('click', () => {
                window.selectItem(idx);
            });

            marker.on('dragend', function(e) {
                const newPos = e.target.getLatLng();
                item.lat = parseFloat(newPos.lat.toFixed(6));
                item.lon = parseFloat(newPos.lng.toFixed(6));
                item.status = 'success';
                item.manuallyAdjusted = true;

                renderItemsList();
                updateExportCode();
                showStatus(`📍 Posição de "${item.name}" ajustada para (${item.lat}, ${item.lon})`);
            });

            mapMarkers.push(marker);
            bounds.extend([item.lat, item.lon]);
        });

        if (mapMarkers.length > 0 && selectedItemIndex === -1) {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }

    window.selectItem = function(idx) {
        selectedItemIndex = idx;
        renderItemsList();
        updateMapMarkers();

        const item = agendaItems[idx];
        if (item && item.lat && item.lon && map) {
            map.panTo([item.lat, item.lon], { animate: true });
        }
    };

    // --- CODE & FILE EXPORT GENERATOR ---

    function updateExportCode() {
        const codeOutput = document.getElementById('code-output');
        if (!codeOutput) return;

        if (agendaItems.length === 0) {
            codeOutput.textContent = '// O código REAL_LANDMARKS aparecerá aqui após a geocodificação...';
            return;
        }

        const formattedLandmarks = agendaItems.map(item => {
            return `    {
        id: '${item.id}',
        name: '${item.name.replace(/'/g, "\\'")}',
        address: '${item.address.replace(/'/g, "\\'")}',
        lat: ${item.lat || -18.595500},
        lon: ${item.lon || -46.516500},
        icon: '${item.icon}',
        color: '${item.color}',
        hasDelivery: true
    }`;
        }).join(',\n');

        const fullJsCode = `const REAL_LANDMARKS = [\n${formattedLandmarks}\n];`;
        codeOutput.textContent = fullJsCode;
    }

    window.copyExportCode = function() {
        const codeText = document.getElementById('code-output').textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            alert('📋 Código REAL_LANDMARKS copiado para a área de transferência!');
        }).catch(err => {
            alert('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.');
        });
    };

    window.switchExportTab = function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('export-tab-js').style.display = 'none';
        document.getElementById('export-tab-json').style.display = 'none';
        document.getElementById('export-tab-vcf').style.display = 'none';

        document.getElementById(`tab-btn-${tabName}`).classList.add('active');
        document.getElementById(`export-tab-${tabName}`).style.display = 'block';
    };

    window.downloadJSON = function() {
        if (agendaItems.length === 0) return alert('Nenhum item para exportar.');
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(agendaItems, null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "agenda_geocodificada_patos.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    window.downloadVCF = function() {
        if (agendaItems.length === 0) return alert('Nenhum item para exportar.');
        let vcardContent = '';
        agendaItems.forEach(item => {
            vcardContent += `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${item.name}\r\nADR:;;${item.address};;;;\r\n`;
            if (item.lat && item.lon) {
                vcardContent += `GEO:${item.lat};${item.lon}\r\n`;
            }
            vcardContent += `END:VCARD\r\n`;
        });

        const dataStr = "data:text/vcard;charset=utf-8," + encodeURIComponent(vcardContent);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "agenda_geocodificada_patos.vcf");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    window.injectIntoGameState = function() {
        if (agendaItems.length === 0) return alert('Importe e geocodifique os locais primeiro!');
        localStorage.setItem('CUSTOM_REAL_LANDMARKS', JSON.stringify(agendaItems));
        alert('⚡ Locais salvos com sucesso! Eles serão aplicados automaticamente ao carregar o jogo.');
    };

    function showStatus(msg) {
        const el = document.getElementById('status-text');
        if (el) el.textContent = msg;
    }

    function escapeHTML(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- EVENT LISTENERS ---

    document.addEventListener('DOMContentLoaded', () => {
        initMap();

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const btnGeocode = document.getElementById('btn-geocode');
        const btnDemo = document.getElementById('btn-demo');
        const textInput = document.getElementById('text-input');

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });

        btnGeocode.addEventListener('click', () => {
            const rawText = textInput.value.trim();
            if (rawText && agendaItems.length === 0) {
                agendaItems = parseRawText(rawText);
            }
            renderItemsList();
            updateMapMarkers();
            processBatchGeocoding();
        });

        btnDemo.addEventListener('click', () => {
            textInput.value = `King Adega - Rua Vereador João Pacheco, 2352
Caldo de Cana Lagoa Grande - Rua Dr. Ivan Clementino Santana, 167
Padaria Pão Quente Patos - Av. Brasil, Centro
Pizzaria Bella Italia Patos - Av. Fátima Porto
Shopping Pátio Central Patos - Rua Major Gote
Posto Shell Lagoa - Av. Juscelino Kubitschek`;

            agendaItems = parseRawText(textInput.value);
            renderItemsList();
            updateMapMarkers();
            showStatus('Exemplo de locais em Patos de Minas carregado! Clique em "Processar & Geocodificar Endereços".');
        });
    });

    function handleFileUpload(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            showStatus(`Arquivo "${file.name}" carregado. Processando contatos...`);

            if (file.name.endsWith('.vcf')) {
                agendaItems = parseVCard(content);
            } else if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
                agendaItems = parseJSONorCSV(content);
            } else {
                agendaItems = parseRawText(content);
            }

            renderItemsList();
            updateMapMarkers();
            updateExportCode();
            showStatus(`${agendaItems.length} contatos extraídos de "${file.name}". Clique em "Processar & Geocodificar Endereços".`);
        };
        reader.readAsText(file);
    }

})();
