/* ===================================================================
   pages/analytics.js — Time-Series Analytics & Charts Page
   Chart.js Multi-Line Charts · Station Selector · Stats Summary
   =================================================================== */
window.AnalyticsPage = (function () {

    var _charts         = {};
    var _updateInterval = null;
    var _selectedDrone  = 'D1';
    var _selectedParam  = 'wqi';

    var PARAM_OPTS = [
        { value: 'wqi',         label: 'WQI Score',       color: '#00d4ff', unit: '' },
        { value: 'ph',          label: 'pH',              color: '#8b5cf6', unit: '' },
        { value: 'do',          label: 'Dissolved O₂',    color: '#22c55e', unit: 'mg/L' },
        { value: 'turbidity',   label: 'Turbidity',       color: '#f59e0b', unit: 'NTU' },
        { value: 'temperature', label: 'Temperature',     color: '#ef4444', unit: '°C' },
        { value: 'tds',         label: 'TDS',             color: '#a78bfa', unit: 'mg/L' },
        { value: 'nitrates',    label: 'Nitrates',        color: '#fb923c', unit: 'mg/L' },
        { value: 'conductivity',label: 'Conductivity',    color: '#38bdf8', unit: 'µS/cm' }
    ];

    var DRONE_COLORS = { D1: '#00d4ff', D2: '#8b5cf6', D3: '#22c55e', D4: '#f59e0b', D5: '#ef4444' };

    // ── Helpers ───────────────────────────────────────────────────
    function fmt(v, d) { return (!isNaN(v) && v !== undefined) ? parseFloat(v).toFixed(d || 2) : '--'; }

    function getHistory(droneId, param, count) {
        count = count || 50;
        var history = Store.getReadingHistory(droneId, count);
        return history.map(function (r) { return r[param] !== undefined ? parseFloat(r[param]) : null; }).filter(function(v){ return v !== null; });
    }

    function getLabels(droneId, count) {
        var history = Store.getReadingHistory(droneId, count || 50);
        return history.map(function (r) {
            var d = new Date(r.timestamp);
            return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        });
    }

    function getParamOpt(val) {
        return PARAM_OPTS.find(function (p) { return p.value === val; }) || PARAM_OPTS[0];
    }

    function computeStats(values) {
        if (!values.length) return { min: '--', max: '--', avg: '--', std: '--' };
        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);
        var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
        var variance = values.reduce(function (s, v) { return s + Math.pow(v - avg, 2); }, 0) / values.length;
        return {
            min: parseFloat(min.toFixed(2)),
            max: parseFloat(max.toFixed(2)),
            avg: parseFloat(avg.toFixed(2)),
            std: parseFloat(Math.sqrt(variance).toFixed(2))
        };
    }

    // ── Chart Configuration ───────────────────────────────────────
    var CHART_DEFAULTS = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 }
            },
            tooltip: {
                backgroundColor: 'rgba(8,25,46,0.95)',
                titleColor: '#00d4ff',
                bodyColor: '#94a3b8',
                borderColor: 'rgba(0,212,255,0.3)',
                borderWidth: 1,
                padding: 10,
                callbacks: {}
            }
        },
        scales: {
            x: {
                ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' }, maxTicksLimit: 8, maxRotation: 0 },
                grid:  { color: 'rgba(255,255,255,0.04)' }
            },
            y: {
                ticks: { color: '#64748b', font: { size: 10, family: 'JetBrains Mono' } },
                grid:  { color: 'rgba(255,255,255,0.04)' }
            }
        },
        animation: { duration: 400 },
        elements: { point: { radius: 0, hoverRadius: 4 } }
    };

    // ── Render ─────────────────────────────────────────────────────
    function render(container) {
        container.innerHTML = buildHTML();
        setTimeout(function () {
            bindControls();
            buildMainChart();
            buildAllDronesChart();
            buildStatsTable();
            startUpdates();
        }, 100);
    }

    function buildHTML() {
        var droneOptions = SimulationEngine.DRONES.map(function (d) {
            return '<option value="' + d.id + '"' + (_selectedDrone === d.id ? ' selected' : '') + '>' + d.id + ' — ' + d.name + '</option>';
        }).join('');

        var paramOptions = PARAM_OPTS.map(function (p) {
            return '<option value="' + p.value + '"' + (_selectedParam === p.value ? ' selected' : '') + '>' + p.label + '</option>';
        }).join('');

        var html = '<div class="fade-in">';

        html += '<div class="page-header">';
        html += '<div class="page-title-block"><h1>Analytics & Trends</h1><p>Time-series analysis of water quality parameters across all monitoring stations</p></div>';
        html += '<div class="page-actions"><button class="btn btn-secondary btn-sm" onclick="AnalyticsPage.exportCSV()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV</button></div>';
        html += '</div>';

        // Controls
        html += '<div class="analytics-controls-row">';
        html += '<div class="form-group"><label class="form-label">Station</label><select class="form-select" id="drone-select" style="min-width:220px;">' + droneOptions + '</select></div>';
        html += '<div class="form-group"><label class="form-label">Parameter</label><select class="form-select" id="param-select" style="min-width:160px;">' + paramOptions + '</select></div>';
        html += '</div>';

        // Mini stats row
        html += '<div class="stats-row-grid" id="stats-row"></div>';

        // Main chart (selected station + param)
        html += '<div class="analytics-chart-grid">';
        html += '<div class="chart-card"><div class="card-header"><div class="card-title" id="main-chart-title">WQI Trend — ' + _selectedDrone + '</div></div><div class="chart-wrapper" style="height:260px;"><canvas id="chart-main"></canvas></div></div>';

        // All drones WQI comparison
        html += '<div class="chart-card"><div class="card-header"><div class="card-title">All Stations — WQI Comparison</div></div><div class="chart-wrapper" style="height:260px;"><canvas id="chart-all-drones"></canvas></div></div>';
        html += '</div>';

        // Parameter breakdown table
        html += '<div class="card"><div class="card-header"><div class="card-title">Parameter Readings Table</div><span class="text-xs text-muted">Latest values from selected station</span></div>';
        html += '<div class="data-table-wrapper" id="stats-table-wrapper"></div></div>';

        html += '</div>';
        return html;
    }

    // ── Bind Controls ─────────────────────────────────────────────
    function bindControls() {
        var droneSelect = document.getElementById('drone-select');
        var paramSelect = document.getElementById('param-select');

        if (droneSelect) {
            droneSelect.addEventListener('change', function () {
                _selectedDrone = this.value;
                rebuildMainChart();
                buildStatsTable();
            });
        }
        if (paramSelect) {
            paramSelect.addEventListener('change', function () {
                _selectedParam = this.value;
                rebuildMainChart();
            });
        }
    }

    // ── Main Chart ─────────────────────────────────────────────────
    function buildMainChart() {
        var canvas = document.getElementById('chart-main');
        if (!canvas) return;
        var ctx    = canvas.getContext('2d');

        var pOpt   = getParamOpt(_selectedParam);
        var values = getHistory(_selectedDrone, _selectedParam, 50);
        var labels = getLabels(_selectedDrone, 50);

        var gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, pOpt.color + '33');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        var config = deepClone(CHART_DEFAULTS);
        config.plugins.legend.display = false;
        config.plugins.tooltip.callbacks.label = function (ctx) {
            return ' ' + parseFloat(ctx.raw).toFixed(2) + (pOpt.unit ? ' ' + pOpt.unit : '');
        };

        _charts['main'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label:           pOpt.label,
                    data:            values,
                    borderColor:     pOpt.color,
                    borderWidth:     2,
                    backgroundColor: gradient,
                    tension:         0.4,
                    fill:            true,
                    pointRadius:     0,
                    pointHoverRadius:4,
                    pointHoverBackgroundColor: pOpt.color
                }]
            },
            options: config
        });

        updateStatsRow(values, pOpt);
        updateMainChartTitle();
    }

    function rebuildMainChart() {
        if (_charts['main']) { try { _charts['main'].destroy(); } catch(e){} delete _charts['main']; }
        buildMainChart();
    }

    function updateMainChartTitle() {
        var el    = document.getElementById('main-chart-title');
        var pOpt  = getParamOpt(_selectedParam);
        var drone = SimulationEngine.DRONES.find(function(d){ return d.id === _selectedDrone; });
        if (el) el.textContent = pOpt.label + ' Trend — ' + (drone ? drone.name : _selectedDrone);
    }

    // ── All Drones WQI Chart ───────────────────────────────────────
    function buildAllDronesChart() {
        var canvas = document.getElementById('chart-all-drones');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var COUNT = 40;

        var datasets = SimulationEngine.DRONES.map(function (drone) {
            return {
                label:            drone.name,
                data:             getHistory(drone.id, 'wqi', COUNT),
                borderColor:      DRONE_COLORS[drone.id] || '#00d4ff',
                borderWidth:      1.5,
                tension:          0.4,
                fill:             false,
                pointRadius:      0,
                pointHoverRadius: 3
            };
        });

        var config = deepClone(CHART_DEFAULTS);
        config.plugins.legend.display = true;
        config.plugins.tooltip.callbacks.label = function (ctx) {
            return ' WQI: ' + parseFloat(ctx.raw).toFixed(1);
        };

        _charts['all'] = new Chart(ctx, {
            type: 'line',
            data: { labels: getLabels('D1', COUNT), datasets: datasets },
            options: config
        });
    }

    // ── Stats Row ─────────────────────────────────────────────────
    function updateStatsRow(values, pOpt) {
        var stats = computeStats(values);
        var el    = document.getElementById('stats-row');
        if (!el) return;
        el.innerHTML = [
            buildMiniStat('Minimum', stats.min + (pOpt.unit ? ' ' + pOpt.unit : '')),
            buildMiniStat('Maximum', stats.max + (pOpt.unit ? ' ' + pOpt.unit : '')),
            buildMiniStat('Average', stats.avg + (pOpt.unit ? ' ' + pOpt.unit : '')),
            buildMiniStat('Std Dev',  stats.std)
        ].join('');
    }

    function buildMiniStat(label, value) {
        return '<div class="stat-mini-card"><div class="stat-mini-label">' + label + '</div><div class="stat-mini-value">' + value + '</div></div>';
    }

    // ── Stats Table ───────────────────────────────────────────────
    function buildStatsTable() {
        var wrapper = document.getElementById('stats-table-wrapper');
        if (!wrapper) return;
        var r = Store.getLatestReading(_selectedDrone);
        if (!r) { wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-title">No data</div></div>'; return; }

        var rows = [
            ['pH',          r.ph,           '',       '6.5 – 8.5'],
            ['Dissolved O₂','do' in r ? r.do : '--', 'mg/L','6 – 10'],
            ['Turbidity',   r.turbidity,    'NTU',    '0 – 5'],
            ['Temperature', r.temperature,  '°C',     '15 – 30'],
            ['TDS',         r.tds,          'mg/L',   '0 – 500'],
            ['Nitrates',    r.nitrates,     'mg/L',   '0 – 10'],
            ['Conductivity',r.conductivity, 'µS/cm',  '100 – 800']
        ];

        var thresholds = Store.getState().thresholds;
        var tableRows = rows.map(function (row) {
            var param = row[0].toLowerCase().replace('dissolved o₂', 'do').replace('²', '').replace(' ', '');
            var val   = row[1];
            var unit  = row[2];
            var range = row[3];
            var thresh = thresholds[param === 'dissolved' ? 'do' : param] || {};
            var numVal = parseFloat(val);
            var statusColor = '#94a3b8';
            if (!isNaN(numVal)) {
                if (thresh.min !== undefined && numVal < thresh.min) statusColor = '#ef4444';
                else if (thresh.max !== undefined && numVal > thresh.max) statusColor = '#ef4444';
                else statusColor = '#22c55e';
            }

            return '<tr><td class="col-name">' + row[0] + '</td>' +
                   '<td style="font-family:var(--font-mono);color:' + statusColor + ';font-weight:600;">' + (isNaN(numVal) ? val : numVal.toFixed(2)) + '</td>' +
                   '<td class="text-muted">' + unit + '</td>' +
                   '<td class="text-muted">' + range + '</td></tr>';
        }).join('');

        wrapper.innerHTML = '<table class="data-table"><thead><tr><th>Parameter</th><th>Current Value</th><th>Unit</th><th>Healthy Range</th></tr></thead><tbody>' + tableRows + '</tbody></table>';
    }

    // ── Live Updates ──────────────────────────────────────────────
    function startUpdates() {
        _updateInterval = setInterval(function () {
            updateMainChartData();
            updateAllDronesChartData();
            buildStatsTable();
        }, 3000);
    }

    function updateMainChartData() {
        var chart = _charts['main'];
        if (!chart) return;
        var pOpt   = getParamOpt(_selectedParam);
        var values = getHistory(_selectedDrone, _selectedParam, 50);
        var labels = getLabels(_selectedDrone, 50);
        chart.data.labels              = labels;
        chart.data.datasets[0].data   = values;
        chart.update('none');
        updateStatsRow(values, pOpt);
    }

    function updateAllDronesChartData() {
        var chart = _charts['all'];
        if (!chart) return;
        var COUNT = 40;
        chart.data.labels = getLabels('D1', COUNT);
        SimulationEngine.DRONES.forEach(function (drone, i) {
            chart.data.datasets[i].data = getHistory(drone.id, 'wqi', COUNT);
        });
        chart.update('none');
    }

    // ── Export CSV ─────────────────────────────────────────────────
    function exportCSV() {
        var history = Store.getReadingHistory(_selectedDrone, 100);
        if (!history.length) { alert('No data to export yet.'); return; }
        var cols = ['timestamp', 'ph', 'do', 'turbidity', 'temperature', 'tds', 'nitrates', 'conductivity', 'wqi'];
        var csv  = cols.join(',') + '\n';
        history.forEach(function (r) {
            csv += cols.map(function (c) { return r[c] !== undefined ? r[c] : ''; }).join(',') + '\n';
        });
        var blob = new Blob([csv], { type: 'text/csv' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href   = url;
        a.download = 'aquawatch_' + _selectedDrone + '_' + Date.now() + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Cleanup ────────────────────────────────────────────────────
    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
        Object.keys(_charts).forEach(function (k) {
            try { _charts[k].destroy(); } catch(e){}
        });
        _charts = {};
    }

    // ── Deep Clone for chart config ────────────────────────────────
    function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

    return { render: render, cleanup: cleanup, exportCSV: exportCSV };
})();
