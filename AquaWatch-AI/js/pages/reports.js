/* ===================================================================
   pages/reports.js — Automated Reports Page
   Station Summary Table · WQI Overview · Trend Indicators
   =================================================================== */
window.ReportsPage = (function () {

    var _updateInterval = null;

    function fmt(v, d) { return (!isNaN(v) && v !== undefined) ? parseFloat(v).toFixed(d || 2) : '--'; }

    var PARAM_LABELS = {
        ph: 'pH', do: 'DO (mg/L)', turbidity: 'Turbidity (NTU)',
        temperature: 'Temp (°C)', tds: 'TDS (mg/L)', nitrates: 'Nitrates (mg/L)', conductivity: 'Conductivity (µS/cm)'
    };

    // ── Render ─────────────────────────────────────────────────────
    function render(container) {
        container.innerHTML = buildHTML();
        setTimeout(function () { startUpdates(); }, 100);
    }

    function buildHTML() {
        var now = new Date();
        var html = '<div class="fade-in">';

        html += '<div class="page-header">';
        html += '<div class="page-title-block"><h1>Water Quality Report</h1><p>Auto-generated summary · ' + now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) + '</p></div>';
        html += '<div class="page-actions">';
        html += '<button class="btn btn-secondary btn-sm" onclick="ReportsPage.refresh()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh</button>';
        html += '<button class="btn btn-ghost btn-sm" onclick="window.print()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print</button>';
        html += '</div></div>';

        // Summary cards
        html += '<div id="report-summary"></div>';

        // Station overview table
        html += '<div class="card" style="margin-bottom:20px;">';
        html += '<div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Station Overview</div><span class="text-xs text-muted" id="report-timestamp">Loading...</span></div>';
        html += '<div class="data-table-wrapper" id="station-overview-table"></div>';
        html += '</div>';

        // Detailed parameter table
        html += '<div class="card">';
        html += '<div class="card-header"><div class="card-title">Detailed Parameter Report</div><span class="text-xs text-muted">All latest sensor readings</span></div>';
        html += '<div class="data-table-wrapper" id="detail-table"></div>';
        html += '</div>';

        html += '</div>'; // fade-in
        return html;
    }

    function renderSummary() {
        var el = document.getElementById('report-summary');
        if (!el) return;

        var drones = SimulationEngine.DRONES;
        var readings = drones.map(function(d){ return Store.getLatestReading(d.id); }).filter(Boolean);
        var wqiVals  = readings.map(function(r){ return r.wqi || 50; });
        var avgWQI   = wqiVals.length ? wqiVals.reduce(function(a,b){ return a+b; }, 0) / wqiVals.length : 50;
        var minWQI   = wqiVals.length ? Math.min.apply(null, wqiVals) : 0;
        var maxWQI   = wqiVals.length ? Math.max.apply(null, wqiVals) : 0;
        var excellent= readings.filter(function(r){ return r.wqi <= 25; }).length;
        var good     = readings.filter(function(r){ return r.wqi > 25 && r.wqi <= 50; }).length;
        var poor     = readings.filter(function(r){ return r.wqi > 50 && r.wqi <= 75; }).length;
        var veryPoor = readings.filter(function(r){ return r.wqi > 75; }).length;

        el.innerHTML = '<div class="report-summary-grid" style="margin-bottom:20px;">' +
            buildSummaryCard('Network WQI',   avgWQI.toFixed(1), AIEngine.classifyWQI(avgWQI).color, 'Weighted average across all stations') +
            buildSummaryCard('Best Station WQI', minWQI.toFixed(1), '#22c55e', 'Lowest WQI = highest quality') +
            buildSummaryCard('Worst Station WQI', maxWQI.toFixed(1), '#ef4444', 'Highest WQI = lowest quality') +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">' +
            buildQualityCount('🟢 Excellent', excellent, '#22c55e') +
            buildQualityCount('🟡 Good',      good,     '#4ade80') +
            buildQualityCount('🟠 Poor',      poor,     '#f59e0b') +
            buildQualityCount('🔴 Very Poor', veryPoor, '#ef4444') +
            '</div>';
    }

    function buildSummaryCard(label, value, color, desc) {
        return '<div class="card" style="text-align:center;padding:20px;">' +
               '<div style="font-family:var(--font-display);font-size:2rem;font-weight:800;color:' + color + ';text-shadow:0 0 16px ' + color + '">' + value + '</div>' +
               '<div style="font-size:0.875rem;font-weight:600;color:var(--text-primary);margin-top:4px;">' + label + '</div>' +
               '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">' + desc + '</div>' +
               '</div>';
    }

    function buildQualityCount(label, count, color) {
        return '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:12px;padding:12px 16px;text-align:center;">' +
               '<div style="font-size:1.5rem;font-weight:700;color:' + color + ';">' + count + '</div>' +
               '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">' + label + '</div>' +
               '</div>';
    }

    function renderStationOverview() {
        var el = document.getElementById('station-overview-table');
        var tsEl = document.getElementById('report-timestamp');
        if (!el) return;
        if (tsEl) tsEl.textContent = 'Generated: ' + new Date().toLocaleString('en-IN');

        var rows = SimulationEngine.DRONES.map(function (drone) {
            var r     = Store.getLatestReading(drone.id);
            if (!r) return '<tr><td class="col-name">' + drone.name + '</td><td colspan="6" class="text-muted" style="text-align:center;">No data</td></tr>';
            var wqi   = r.wqi || 50;
            var cls   = r.classification || AIEngine.classifyWQI(wqi);
            var trend = AIEngine.calculateTrend(drone.id);
            var sc    = cls.cssClass || 'good';

            var trendHtml = '<span class="trend-badge ' + trend.direction + '">' + trend.label + '</span>';
            var statusHtml= '<span class="status-pill ' + sc + '">' + cls.label + '</span>';

            return '<tr>' +
                   '<td class="col-name"><strong>' + drone.id + '</strong> ' + drone.name + '</td>' +
                   '<td style="font-family:var(--font-mono);font-size:1rem;font-weight:700;color:' + cls.color + ';">' + wqi.toFixed(1) + '</td>' +
                   '<td>' + statusHtml + '</td>' +
                   '<td>' + trendHtml + '</td>' +
                   '<td class="text-secondary">' + drone.location + '</td>' +
                   '<td class="text-secondary">' + drone.waterBody + '</td>' +
                   '</tr>';
        }).join('');

        el.innerHTML = '<table class="data-table"><thead><tr><th>Station</th><th>WQI</th><th>Quality</th><th>Trend</th><th>Location</th><th>Water Body</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderDetailTable() {
        var el = document.getElementById('detail-table');
        if (!el) return;

        var params = ['ph', 'do', 'turbidity', 'temperature', 'tds', 'nitrates', 'conductivity'];

        var headerCells = '<th>Parameter</th>' + SimulationEngine.DRONES.map(function(d){
            return '<th>' + d.id + '<br><span style="font-weight:400;font-size:0.6875rem;">' + d.name.split(' ')[0] + '</span></th>';
        }).join('');

        var bodyRows = params.map(function (param) {
            var cells = SimulationEngine.DRONES.map(function (drone) {
                var r   = Store.getLatestReading(drone.id);
                if (!r) return '<td class="text-muted">--</td>';
                var val = r[param];
                var risks = AIEngine.evaluateFuzzyRules(r);
                var risk  = risks[param];
                var color = '#94a3b8';
                if (risk) {
                    if (risk.level === 'CRITICAL') color = '#dc2626';
                    else if (risk.level === 'HIGH') color = '#ef4444';
                    else if (risk.level === 'MODERATE') color = '#f59e0b';
                    else color = '#22c55e';
                }
                return '<td style="font-family:var(--font-mono);font-size:0.8125rem;color:' + color + ';font-weight:600;">' + fmt(val) + '</td>';
            }).join('');

            return '<tr><td class="col-name">' + (PARAM_LABELS[param] || param) + '</td>' + cells + '</tr>';
        }).join('');

        el.innerHTML = '<table class="data-table"><thead><tr>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table>';
    }

    function renderAll() {
        renderSummary();
        renderStationOverview();
        renderDetailTable();
    }

    function startUpdates() {
        renderAll();
        _updateInterval = setInterval(renderAll, 5000);
    }

    function refresh() {
        renderAll();
    }

    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
    }

    return { render: render, cleanup: cleanup, refresh: refresh };
})();
