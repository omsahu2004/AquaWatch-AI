/* ===================================================================
   pages/map.js — Interactive Leaflet Map Page
   Drone Markers · Color-Coded Quality · Live Popups
   =================================================================== */
window.MapPage = (function () {

    var _map         = null;
    var _markers     = {};
    var _circles     = {};
    var _updateInterval = null;

    var QUALITY_COLORS = {
        'Excellent': '#22c55e',
        'Good':      '#4ade80',
        'Poor':      '#f59e0b',
        'Very Poor': '#ef4444',
        'Critical':  '#dc2626'
    };

    function fmt(val, dec) {
        return (val !== undefined && !isNaN(val)) ? parseFloat(val).toFixed(dec || 2) : '--';
    }

    function getColor(reading) {
        if (!reading || !reading.classification) return '#00d4ff';
        return QUALITY_COLORS[reading.classification.label] || '#00d4ff';
    }

    // ── Custom Pulsing Marker Icon ─────────────────────────────────
    function createDroneIcon(color, droneId) {
        var html = [
            '<div style="position:relative;width:36px;height:36px;">',
            '<div style="position:absolute;inset:0;border-radius:50%;background:' + color + ';opacity:0.2;animation:markerPulse 2s ease-in-out infinite;"></div>',
            '<div style="position:absolute;top:4px;left:4px;width:28px;height:28px;border-radius:50%;background:' + color + ';border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;font-family:monospace;box-shadow:0 0 12px ' + color + '80;">' + droneId + '</div>',
            '</div>'
        ].join('');
        return L.divIcon({ html: html, className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20] });
    }

    // ── Popup HTML ─────────────────────────────────────────────────
    function buildPopupHTML(drone, reading) {
        if (!reading) return '<div style="color:#94a3b8;padding:8px;">No data yet...</div>';
        var wqi  = reading.wqi || 50;
        var cls  = reading.classification || AIEngine.classifyWQI(wqi);
        var col  = cls.color || '#00d4ff';

        return [
            '<div class="popup-header">',
            '<div class="popup-drone-id">' + drone.id + ' · ' + drone.waterBody + '</div>',
            '<div class="popup-name">' + drone.name + '</div>',
            '<div class="popup-location">📍 ' + drone.location + '</div>',
            '</div>',
            '<div class="popup-wqi-row">',
            '<div>',
            '<div class="popup-wqi-score" style="color:' + col + ';text-shadow:0 0 12px ' + col + '">' + wqi.toFixed(1) + '</div>',
            '<div style="font-size:0.6875rem;color:var(--text-muted);">WQI</div>',
            '</div>',
            '<span class="status-pill ' + (reading.classification ? reading.classification.cssClass : 'good') + '">' + cls.label + '</span>',
            '</div>',
            '<div class="popup-params">',
            '<div class="popup-param"><div class="popup-param-label">pH</div><div class="popup-param-value">' + fmt(reading.ph) + '</div></div>',
            '<div class="popup-param"><div class="popup-param-label">DO</div><div class="popup-param-value">' + fmt(reading.do) + ' mg/L</div></div>',
            '<div class="popup-param"><div class="popup-param-label">Turbidity</div><div class="popup-param-value">' + fmt(reading.turbidity, 1) + ' NTU</div></div>',
            '<div class="popup-param"><div class="popup-param-label">Temp</div><div class="popup-param-value">' + fmt(reading.temperature, 1) + '°C</div></div>',
            '<div class="popup-param"><div class="popup-param-label">TDS</div><div class="popup-param-value">' + fmt(reading.tds, 0) + ' mg/L</div></div>',
            '<div class="popup-param"><div class="popup-param-label">Nitrates</div><div class="popup-param-value">' + fmt(reading.nitrates) + ' mg/L</div></div>',
            '</div>',
            '<div style="margin-top:10px;font-size:0.6875rem;color:var(--text-muted);font-family:monospace;">' + (reading.timestamp ? new Date(reading.timestamp).toLocaleString('en-IN') : '') + '</div>'
        ].join('');
    }

    // ── Render ─────────────────────────────────────────────────────
    function render(container) {
        // Add pulse animation for markers
        var style = document.getElementById('map-marker-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'map-marker-style';
            style.textContent = '@keyframes markerPulse { 0%,100% { transform:scale(1); opacity:0.2; } 50% { transform:scale(1.6); opacity:0.05; } }';
            document.head.appendChild(style);
        }

        container.innerHTML = buildHTML();
        setTimeout(function () { initMap(); startUpdates(); }, 150);
    }

    function buildHTML() {
        return [
            '<div class="fade-in">',
            '<div class="page-header">',
            '<div class="page-title-block"><h1>Live Monitoring Map</h1><p>Geographical distribution of aquatic drone stations across India</p></div>',
            '<div class="page-actions">',
            '<button class="btn btn-secondary btn-sm" onclick="MapPage.fitBounds()" title="Fit all markers">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Fit All',
            '</button>',
            '</div>',
            '</div>',
            '<div class="map-page-wrapper">',
            '<div class="map-container-wrapper">',
            '<div id="leaflet-map"></div>',
            buildLegend(),
            '</div>',
            '</div>',
            '</div>'
        ].join('');
    }

    function buildLegend() {
        return [
            '<div class="map-legend">',
            '<div class="map-legend-title">Water Quality</div>',
            '<div class="legend-item"><div class="legend-dot" style="background:#22c55e;box-shadow:0 0 6px #22c55e"></div>Excellent (WQI ≤ 25)</div>',
            '<div class="legend-item"><div class="legend-dot" style="background:#4ade80;box-shadow:0 0 6px #4ade80"></div>Good (WQI 26–50)</div>',
            '<div class="legend-item"><div class="legend-dot" style="background:#f59e0b;box-shadow:0 0 6px #f59e0b"></div>Poor (WQI 51–75)</div>',
            '<div class="legend-item"><div class="legend-dot" style="background:#ef4444;box-shadow:0 0 6px #ef4444"></div>Very Poor (WQI 76–100)</div>',
            '<div class="legend-item legend-last"><div class="legend-dot" style="background:#dc2626;box-shadow:0 0 8px #dc2626"></div>Critical (WQI > 100)</div>',
            '</div>'
        ].join('');
    }

    // ── Init Leaflet ───────────────────────────────────────────────
    function initMap() {
        var mapEl = document.getElementById('leaflet-map');
        if (!mapEl || _map) return;

        // Center on India
        _map = L.map('leaflet-map', {
            center: [23.5, 80.0],
            zoom:   5,
            zoomControl: true,
            attributionControl: true
        });

        // Dark tile layer (CartoDB Dark Matter — free, no API key)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(_map);

        // Add markers
        SimulationEngine.DRONES.forEach(function (drone) {
            var reading = Store.getLatestReading(drone.id);
            var color   = getColor(reading);

            // Quality circle (heatmap-like)
            var circle = L.circle([drone.lat, drone.lng], {
                color:       color,
                fillColor:   color,
                fillOpacity: 0.08,
                weight:      1,
                radius:      40000
            }).addTo(_map);
            _circles[drone.id] = circle;

            // Marker
            var marker = L.marker([drone.lat, drone.lng], { icon: createDroneIcon(color, drone.id) })
                .addTo(_map)
                .bindPopup(buildPopupHTML(drone, reading), {
                    maxWidth: 280,
                    className: 'aquawatch-popup'
                });
            _markers[drone.id] = marker;
        });

        _map.invalidateSize();
    }

    // ── Live Updates ───────────────────────────────────────────────
    function startUpdates() {
        _updateInterval = setInterval(updateMarkers, 3000);
    }

    function updateMarkers() {
        if (!_map) return;
        SimulationEngine.DRONES.forEach(function (drone) {
            var reading = Store.getLatestReading(drone.id);
            var color   = getColor(reading);

            // Update marker icon
            var marker = _markers[drone.id];
            if (marker) {
                marker.setIcon(createDroneIcon(color, drone.id));
                // Update popup if open
                if (marker.isPopupOpen()) {
                    marker.getPopup().setContent(buildPopupHTML(drone, reading));
                }
            }

            // Update quality circle
            var circle = _circles[drone.id];
            if (circle) {
                circle.setStyle({ color: color, fillColor: color });
            }
        });
    }

    function fitBounds() {
        if (!_map) return;
        var pts = SimulationEngine.DRONES.map(function (d) { return [d.lat, d.lng]; });
        _map.fitBounds(pts, { padding: [40, 40] });
    }

    // ── Cleanup ────────────────────────────────────────────────────
    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
        if (_map) {
            _map.remove();
            _map = null;
        }
        _markers = {};
        _circles = {};
    }

    return { render: render, cleanup: cleanup, fitBounds: fitBounds };
})();
