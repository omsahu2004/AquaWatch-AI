/* ===================================================================
   pages/dashboard.js — Main Dashboard Page
   Live KPI Cards · WQI Gauge · Drone Station Cards · Alert Feed
   =================================================================== */
window.DashboardPage = (function () {

    var _updateInterval = null;
    var _sparkCharts    = {};
    var _unsubscribe    = null;
    var _gaugeInterval  = null;

    // ── Helpers ───────────────────────────────────────────────────
    function fmt(val, dec) { return (val !== undefined && !isNaN(val)) ? parseFloat(val).toFixed(dec || 2) : '--'; }
    function statusClass(cls) {
        var map = { 'Excellent': 'excellent', 'Good': 'good', 'Poor': 'poor', 'Very Poor': 'very-poor', 'Critical': 'critical' };
        return cls ? (map[cls.label] || 'good') : 'good';
    }

    // ── Global WQI Gauge (SVG Arc) ────────────────────────────────
    var GAUGE_RADIUS      = 90;
    var GAUGE_CIRCUMFERENCE = Math.PI * GAUGE_RADIUS; // semicircle
    var GAUGE_CX = 110, GAUGE_CY = 105;

    function wqiToColor(wqi) {
        if (wqi <= 25)  return '#22c55e';
        if (wqi <= 50)  return '#4ade80';
        if (wqi <= 75)  return '#f59e0b';
        if (wqi <= 100) return '#ef4444';
        return '#dc2626';
    }

    function updateGauge(wqi) {
        var fill   = document.getElementById('gauge-arc-fill');
        var val    = document.getElementById('gauge-value');
        var clsEl  = document.getElementById('gauge-class');
        if (!fill || !val) return;

        var capped = Math.min(wqi, 110);
        var pct    = capped / 110;
        var offset = GAUGE_CIRCUMFERENCE - pct * GAUGE_CIRCUMFERENCE;
        fill.style.strokeDashoffset = offset;
        fill.style.stroke           = wqiToColor(wqi);

        val.textContent   = wqi.toFixed(1);
        var cls           = AIEngine.classifyWQI(wqi);
        clsEl.textContent = cls.label;
        clsEl.style.color = cls.color;
    }

    // ── Sparkline Chart ───────────────────────────────────────────
    function createSparkChart(canvasId, droneId) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        var history = Store.getReadingHistory(droneId, 30);
        var data    = history.map(function (r) { return r.wqi || 50; });
        var color   = history.length ? wqiToColor(data[data.length - 1]) : '#00d4ff';

        var ctx = canvas.getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(function (_, i) { return i; }),
                datasets: [{
                    data:        data,
                    borderColor: color,
                    borderWidth: 1.5,
                    tension:     0.4,
                    fill:        true,
                    backgroundColor: (function () {
                        var grad = ctx.createLinearGradient(0, 0, 0, 48);
                        grad.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
                        grad.addColorStop(1, 'rgba(0,0,0,0)');
                        return grad;
                    })(),
                    pointRadius: 0
                }]
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                plugins:  { legend: { display: false }, tooltip: { enabled: false } },
                scales:   { x: { display: false }, y: { display: false } },
                animation: false
            }
        });
    }

    function updateSparkChart(chart, droneId) {
        if (!chart) return;
        var history = Store.getReadingHistory(droneId, 30);
        var data    = history.map(function (r) { return r.wqi || 50; });
        if (!data.length) return;

        var color = wqiToColor(data[data.length - 1]);
        chart.data.labels         = data.map(function (_, i) { return i; });
        chart.data.datasets[0].data        = data;
        chart.data.datasets[0].borderColor = color;

        var ctx  = chart.ctx;
        var grad = ctx.createLinearGradient(0, 0, 0, 48);
        grad.addColorStop(0, color + '44');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        chart.data.datasets[0].backgroundColor = grad;

        chart.update('none');
    }

    // ── Render ────────────────────────────────────────────────────
    function render(container) {
        container.innerHTML = buildHTML();
        setTimeout(function () { initCharts(); startUpdates(); }, 100);
    }

    function buildHTML() {
        var drones  = SimulationEngine.DRONES;
        var now     = new Date();

        // Calculate quick stats
        var totalWQI = 0;
        var critCount= 0;
        var allReadings = [];
        drones.forEach(function (d) {
            var r = Store.getLatestReading(d.id);
            if (r) {
                totalWQI += (r.wqi || 50);
                if (r.classification && r.classification.severity >= 3) critCount++;
                allReadings.push(r);
            }
        });
        var avgWQI = allReadings.length ? (totalWQI / allReadings.length) : 50;
        var activeAlerts = Store.getActiveAlerts().length;

        var html = '<div class="fade-in">';

        // Page header
        html += '<div class="page-header">';
        html += '<div class="page-title-block"><h1>Monitoring Dashboard</h1><p>Live water quality data from ' + drones.length + ' aquatic drone stations · ' + now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) + '</p></div>';
        html += '<div class="page-actions"><button class="btn btn-secondary btn-sm" onclick="DashboardPage.refreshAll()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh</button></div>';
        html += '</div>';

        // Quick stats
        html += '<div class="quick-stats-grid stagger-children">';
        html += buildStatCard('Total Stations',   drones.length,         'neutral', '#00d4ff', 'rgba(0,212,255,0.12)',
            '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/>');
        html += buildStatCard('Active Drones',    drones.length,         'neutral', '#8b5cf6', 'rgba(139,92,246,0.12)',
            '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>');
        html += buildStatCard('Active Alerts',    activeAlerts,          activeAlerts > 0 ? 'up' : 'neutral', '#ef4444', 'rgba(239,68,68,0.12)',
            '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>');
        html += buildStatCard('Avg Network WQI',  avgWQI.toFixed(1),     avgWQI > 60 ? 'up' : (avgWQI < 40 ? 'down' : 'neutral'), '#f59e0b', 'rgba(245,158,11,0.12)',
            '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>');
        html += '</div>';

        // Top section: Gauge + Alert Feed
        html += '<div class="dashboard-grid-top" style="margin-bottom:24px;">';

        // Global WQI Gauge
        var gaugeColor = wqiToColor(avgWQI);
        var gaugeCls   = AIEngine.classifyWQI(avgWQI);
        var dashOffset = GAUGE_CIRCUMFERENCE - (Math.min(avgWQI, 110) / 110) * GAUGE_CIRCUMFERENCE;
        html += '<div class="card gauge-card">';
        html += '<div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Network WQI</div>';
        html += '<span class="text-xs text-muted">Weighted Avg</span></div>';
        html += '<svg class="gauge-svg" viewBox="0 0 220 130" id="gauge-svg">';
        html += '<path d="M20 110 A90 90 0 0 1 200 110" class="gauge-track"/>';
        html += '<path d="M20 110 A90 90 0 0 1 200 110" class="gauge-fill" id="gauge-arc-fill" style="stroke-dasharray:' + GAUGE_CIRCUMFERENCE + ';stroke-dashoffset:' + dashOffset + ';stroke:' + gaugeColor + '"/>';
        // Tick marks
        for (var t = 0; t <= 4; t++) {
            var angle = -180 + t * 45;
            var rad   = angle * Math.PI / 180;
            var x1 = GAUGE_CX + (GAUGE_RADIUS - 20) * Math.cos(rad);
            var y1 = GAUGE_CY + (GAUGE_RADIUS - 20) * Math.sin(rad);
            var x2 = GAUGE_CX + GAUGE_RADIUS * Math.cos(rad);
            var y2 = GAUGE_CY + GAUGE_RADIUS * Math.sin(rad);
            html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>';
        }
        html += '</svg>';
        html += '<div class="gauge-center-text" style="bottom:28px;">';
        html += '<div class="gauge-value-display" id="gauge-value">' + avgWQI.toFixed(1) + '</div>';
        html += '<div class="gauge-wqi-label">WQI Score</div>';
        html += '</div>';
        html += '<div class="gauge-class-label" id="gauge-class" style="color:' + gaugeCls.color + '">' + gaugeCls.label + '</div>';
        html += '<div style="display:flex;justify-content:space-between;margin-top:12px;font-size:0.6875rem;color:var(--text-muted);">';
        html += '<span>Excellent</span><span>Good</span><span>Poor</span><span>V.Poor</span><span>Critical</span>';
        html += '</div>';
        html += '</div>'; // gauge-card

        // Recent Alerts
        html += '<div class="card">';
        html += '<div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Recent Alerts</div>';
        html += '<span id="active-alert-count" class="status-pill ' + (activeAlerts > 0 ? 'very-poor' : 'excellent') + '">' + activeAlerts + ' Active</span></div>';
        html += '<div class="alerts-list-mini" id="alert-feed">' + buildAlertFeed() + '</div>';
        html += '<div style="margin-top:12px;text-align:right;"><button class="btn btn-ghost btn-sm" onclick="navigate(\'alerts\')">View All Alerts →</button></div>';
        html += '</div>'; // alerts card

        html += '</div>'; // dashboard-grid-top

        // Drone Cards
        html += '<h2 style="font-family:var(--font-display);font-size:1rem;font-weight:600;color:var(--text-secondary);margin-bottom:14px;letter-spacing:0.02em;">📡 DRONE MONITORING STATIONS</h2>';
        html += '<div class="drone-grid stagger-children">';
        drones.forEach(function (drone) {
            html += buildDroneCard(drone);
        });
        html += '</div>';

        html += '</div>'; // fade-in
        return html;
    }

    function buildStatCard(label, value, deltaType, color, bgColor, iconPath) {
        return '<div class="stat-card" style="--stat-color:' + color + ';--stat-color-bg:' + bgColor + '">' +
               '<div class="stat-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg></div>' +
               '<div class="stat-info"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>' +
               '</div>';
    }

    function buildAlertFeed() {
        var alerts = Store.getState().alerts.slice(0, 6);
        if (!alerts.length) {
            return '<div class="empty-state" style="padding:24px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div class="empty-state-title">No alerts yet</div></div>';
        }
        return alerts.map(function (a) {
            var sev = a.severity || 'info';
            var time = a.timestamp ? new Date(a.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '';
            return '<div class="alert-mini ' + sev + '">' +
                   '<div class="alert-mini-dot"></div>' +
                   '<div class="alert-mini-content">' +
                   '<div class="alert-mini-msg">' + (a.message || '') + '</div>' +
                   '<div class="alert-mini-meta">' + (a.location || '') + ' · ' + time + '</div>' +
                   '</div></div>';
        }).join('');
    }

    function buildDroneCard(drone) {
        var r   = Store.getLatestReading(drone.id);
        var wqi = r ? (r.wqi || 50) : 50;
        var cls = r && r.classification ? r.classification : AIEngine.classifyWQI(wqi);
        var sc  = statusClass(cls);
        var trend = r && r.trend ? r.trend : { label: '→ Stable', direction: 'stable' };

        var html = '<div class="drone-card status-' + sc + '" id="card-' + drone.id + '">';

        // Header
        html += '<div class="drone-card-header">';
        html += '<div class="drone-info-row">';
        html += '<div class="drone-id-badge">' + drone.id + '</div>';
        html += '<div class="drone-name-block"><div class="drone-name">' + drone.name + '</div><div class="drone-location-text">' + drone.location + ' · ' + drone.waterBody + '</div></div>';
        html += '</div>';
        html += '<span class="status-pill ' + sc + '" id="status-pill-' + drone.id + '">' + cls.label + '</span>';
        html += '</div>';

        // WQI Score
        html += '<div class="drone-wqi-row">';
        html += '<div><div class="wqi-score-big" id="wqi-big-' + drone.id + '" style="color:' + cls.color + ';text-shadow:0 0 20px ' + cls.color + '">' + wqi.toFixed(1) + '</div>';
        html += '<div class="wqi-unit">WQI Score</div></div>';
        html += '</div>';

        // WQI progress bar
        var barPct = Math.min(wqi, 110) / 110 * 100;
        html += '<div class="wqi-progress-bar"><div class="wqi-progress-fill" id="wqi-bar-' + drone.id + '" style="width:' + barPct + '%;background:' + cls.color + '"></div></div>';

        // Parameter grid
        html += '<div class="param-mini-grid">';
        html += '<div class="param-mini-cell"><div class="param-mini-label">pH</div><div class="param-mini-value" id="p-ph-' + drone.id + '">' + (r ? fmt(r.ph) : '--') + '</div></div>';
        html += '<div class="param-mini-cell"><div class="param-mini-label">DO</div><div class="param-mini-value" id="p-do-' + drone.id + '">' + (r ? fmt(r.do, 2) : '--') + ' mg/L</div></div>';
        html += '<div class="param-mini-cell"><div class="param-mini-label">Turbidity</div><div class="param-mini-value" id="p-turb-' + drone.id + '">' + (r ? fmt(r.turbidity, 1) : '--') + ' NTU</div></div>';
        html += '<div class="param-mini-cell"><div class="param-mini-label">Temp</div><div class="param-mini-value" id="p-temp-' + drone.id + '">' + (r ? fmt(r.temperature, 1) : '--') + '°C</div></div>';
        html += '</div>';

        // Sparkline
        html += '<div class="spark-container"><canvas id="spark-' + drone.id + '" height="48"></canvas></div>';

        // Trend + extra param
        html += '<div class="drone-trend-row">';
        html += '<span class="trend-badge ' + trend.direction + '" id="trend-' + drone.id + '">' + trend.label + '</span>';
        html += '<span style="font-size:0.75rem;color:var(--text-muted);">TDS: <span id="p-tds-' + drone.id + '" style="font-family:var(--font-mono);color:var(--text-secondary);">' + (r ? fmt(r.tds, 0) : '--') + '</span> mg/L</span>';
        html += '</div>';

        html += '</div>'; // drone-card
        return html;
    }

    // ── Init Charts ───────────────────────────────────────────────
    function initCharts() {
        SimulationEngine.DRONES.forEach(function (drone) {
            var chart = createSparkChart('spark-' + drone.id, drone.id);
            if (chart) _sparkCharts[drone.id] = chart;
        });
        var r  = getAllAvgWQI();
        updateGauge(r);
    }

    function getAllAvgWQI() {
        var total = 0, count = 0;
        SimulationEngine.DRONES.forEach(function (d) {
            var r = Store.getLatestReading(d.id);
            if (r && r.wqi) { total += r.wqi; count++; }
        });
        return count ? total / count : 50;
    }

    // ── Live Updates ──────────────────────────────────────────────
    function startUpdates() {
        _unsubscribe = Store.subscribe('droneUpdate', function () {
            updateDroneValues();
        });
        _updateInterval = setInterval(updateDroneValues, 1500);
    }

    function updateDroneValues() {
        SimulationEngine.DRONES.forEach(function (drone) {
            var r = Store.getLatestReading(drone.id);
            if (!r) return;
            var wqi = r.wqi || 50;
            var cls = r.classification || AIEngine.classifyWQI(wqi);
            var sc  = statusClass(cls);
            var trend = r.trend || { label: '→ Stable', direction: 'stable' };

            // Update WQI score
            var wqiEl = document.getElementById('wqi-big-' + drone.id);
            if (wqiEl) { wqiEl.textContent = wqi.toFixed(1); wqiEl.style.color = cls.color; wqiEl.style.textShadow = '0 0 20px ' + cls.color; }

            // Update progress bar
            var bar = document.getElementById('wqi-bar-' + drone.id);
            if (bar) { bar.style.width = (Math.min(wqi, 110) / 110 * 100) + '%'; bar.style.background = cls.color; }

            // Update status pill
            var pill = document.getElementById('status-pill-' + drone.id);
            if (pill) { pill.textContent = cls.label; pill.className = 'status-pill ' + sc; }

            // Update card border class
            var card = document.getElementById('card-' + drone.id);
            if (card) { card.className = 'drone-card status-' + sc; }

            // Update params
            setInnerText('p-ph-' + drone.id,   fmt(r.ph));
            setInnerText('p-do-' + drone.id,   fmt(r.do, 2) + ' mg/L');
            setInnerText('p-turb-' + drone.id, fmt(r.turbidity, 1) + ' NTU');
            setInnerText('p-temp-' + drone.id, fmt(r.temperature, 1) + '°C');
            setInnerText('p-tds-' + drone.id,  fmt(r.tds, 0));

            // Update trend
            var tEl = document.getElementById('trend-' + drone.id);
            if (tEl) { tEl.textContent = trend.label; tEl.className = 'trend-badge ' + trend.direction; }

            // Update sparkline
            updateSparkChart(_sparkCharts[drone.id], drone.id);
        });

        // Update global gauge
        updateGauge(getAllAvgWQI());

        // Update alert feed
        var feed = document.getElementById('alert-feed');
        if (feed) feed.innerHTML = buildAlertFeed();

        // Update active alert count
        var activeCount = Store.getActiveAlerts().length;
        var cntEl = document.getElementById('active-alert-count');
        if (cntEl) {
            cntEl.textContent = activeCount + ' Active';
            cntEl.className = 'status-pill ' + (activeCount > 0 ? 'very-poor' : 'excellent');
        }
    }

    function setInnerText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // ── Cleanup ───────────────────────────────────────────────────
    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
        if (_gaugeInterval)  { clearInterval(_gaugeInterval);  _gaugeInterval  = null; }
        if (_unsubscribe)    { _unsubscribe(); _unsubscribe = null; }
        Object.keys(_sparkCharts).forEach(function (id) {
            try { _sparkCharts[id].destroy(); } catch (e) {}
        });
        _sparkCharts = {};
    }

    function refreshAll() {
        cleanup();
        var container = document.getElementById('page-content');
        if (container) render(container);
    }

    return { render: render, cleanup: cleanup, refreshAll: refreshAll };
})();
