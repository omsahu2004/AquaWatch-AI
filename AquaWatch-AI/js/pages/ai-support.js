/* ===================================================================
   pages/ai-support.js — AI Decision Support Page
   WQI Breakdown · Fuzzy Rules · Anomaly Feed · AI Report
   =================================================================== */
window.AISupportPage = (function () {

    var _updateInterval = null;
    var _selectedDrone  = 'D1';
    var _riskChart      = null;

    function fmt(v, d) { return (!isNaN(v) && v !== undefined) ? parseFloat(v).toFixed(d || 2) : '--'; }

    var RISK_COLORS = {
        LOW:      { text: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
        MODERATE: { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
        HIGH:     { text: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
        CRITICAL: { text: '#dc2626', bg: 'rgba(220,38,38,0.2)'  }
    };

    var PARAM_LABELS = {
        ph: 'pH', do: 'Dissolved O₂', turbidity: 'Turbidity',
        temperature: 'Temperature', tds: 'TDS', nitrates: 'Nitrates', conductivity: 'Conductivity'
    };

    // ── Render ─────────────────────────────────────────────────────
    function render(container) {
        container.innerHTML = buildHTML();
        setTimeout(function () {
            bindControls();
            renderAllSections();
            startUpdates();
        }, 100);
    }

    function buildHTML() {
        var droneOptions = SimulationEngine.DRONES.map(function (d) {
            return '<option value="' + d.id + '"' + (_selectedDrone === d.id ? ' selected' : '') + '>' + d.id + ' — ' + d.name + '</option>';
        }).join('');

        var html = '<div class="fade-in">';

        html += '<div class="page-header">';
        html += '<div class="page-title-block"><h1>AI Decision Support</h1><p>Intelligent water quality analysis · Fuzzy rules engine · Anomaly detection</p></div>';
        html += '<div class="page-actions">';
        html += '<div class="form-group" style="flex-direction:row;align-items:center;gap:10px;">';
        html += '<label class="form-label" style="white-space:nowrap;">Station:</label>';
        html += '<select class="form-select" id="ai-drone-select" style="min-width:200px;">' + droneOptions + '</select>';
        html += '</div>';
        html += '</div></div>';

        // Info banner
        html += '<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">';
        html += '<svg viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        html += '<span style="font-size:0.8125rem;color:var(--text-secondary);">The AI engine uses a <strong style="color:var(--text-primary)">Weighted Arithmetic WQI model</strong> combined with a <strong style="color:var(--text-primary)">Fuzzy Rules classifier</strong> and <strong style="color:var(--text-primary)">Z-Score anomaly detection</strong> to assess water quality.</span>';
        html += '</div>';

        // Grid row 1
        html += '<div class="ai-page-grid" style="margin-bottom:20px;">';

        // WQI Breakdown
        html += '<div class="card"><div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>WQI Parameter Breakdown</div></div>';
        html += '<div class="wqi-breakdown-list" id="wqi-breakdown"></div>';
        html += '</div>';

        // Fuzzy Rules
        html += '<div class="card"><div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>Fuzzy Rules Assessment</div>';
        html += '<div id="fuzzy-overall" style="font-size:0.8125rem;color:var(--text-muted);">Loading...</div></div>';
        html += '<div class="fuzzy-rules-grid" id="fuzzy-rules"></div>';
        html += '</div>';

        html += '</div>'; // ai-page-grid row 1

        // Grid row 2
        html += '<div class="ai-page-grid" style="margin-bottom:20px;">';

        // Anomaly Feed
        html += '<div class="card"><div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Z-Score Anomaly Detection</div>';
        html += '<span style="font-size:0.6875rem;color:var(--text-muted);">Threshold: |z| &gt; 2.5</span></div>';
        html += '<div class="anomaly-feed" id="anomaly-feed"></div>';
        html += '</div>';

        // Trend Analysis
        html += '<div class="card"><div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Trend Analysis</div></div>';
        html += '<div id="trend-analysis-content"></div>';
        html += '</div>';

        html += '</div>'; // ai-page-grid row 2

        // AI Report (full width)
        html += '<div class="card">';
        html += '<div class="card-header"><div class="card-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>AI-Generated Water Quality Report</div>';
        html += '<span style="font-size:0.6875rem;color:var(--text-muted);font-family:var(--font-mono);">Auto-generated · Updates every 5s</span></div>';
        html += '<div class="ai-report-box" id="ai-report">Generating assessment...</div>';
        html += '</div>';

        html += '</div>'; // fade-in
        return html;
    }

    // ── Controls ───────────────────────────────────────────────────
    function bindControls() {
        var sel = document.getElementById('ai-drone-select');
        if (sel) {
            sel.addEventListener('change', function () {
                _selectedDrone = this.value;
                renderAllSections();
            });
        }
    }

    // ── Render all sections ────────────────────────────────────────
    function renderAllSections() {
        renderWQIBreakdown();
        renderFuzzyRules();
        renderAnomalyFeed();
        renderTrendAnalysis();
        renderAIReport();
    }

    // ── WQI Breakdown ─────────────────────────────────────────────
    function renderWQIBreakdown() {
        var el = document.getElementById('wqi-breakdown');
        if (!el) return;
        var r = Store.getLatestReading(_selectedDrone);
        if (!r) { el.innerHTML = '<div class="text-muted text-sm">No data yet...</div>'; return; }

        var params = ['ph', 'do', 'turbidity', 'temperature', 'tds', 'nitrates', 'conductivity'];
        var html   = '';

        params.forEach(function (param) {
            var cfg   = AIEngine.PARAM_CONFIG[param];
            if (!cfg) return;
            var val   = r[param];
            var qi    = isNaN(val) ? 50 : AIEngine.calculateSubIndex(param, val);
            var color = qi <= 25 ? '#22c55e' : qi <= 50 ? '#4ade80' : qi <= 75 ? '#f59e0b' : '#ef4444';
            var pct   = Math.min(qi, 100);

            html += '<div class="wqi-param-row">';
            html += '<div class="wqi-param-name" title="Weight: ' + (cfg.weight * 100).toFixed(0) + '%">' + cfg.label + '</div>';
            html += '<div class="wqi-param-track"><div class="wqi-param-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>';
            html += '<div class="wqi-param-score" style="color:' + color + '">' + qi.toFixed(0) + '</div>';
            html += '<span class="risk-badge ' + (qi <= 25 ? 'LOW' : qi <= 50 ? 'MODERATE' : qi <= 75 ? 'HIGH' : 'CRITICAL') + '" style="margin-left:6px;font-size:0.6rem;">' + (qi <= 25 ? 'LOW' : qi <= 50 ? 'MOD' : qi <= 75 ? 'HIGH' : 'CRIT') + '</span>';
            html += '</div>';
        });

        var wqi = r.wqi || AIEngine.calculateWQI(r);
        var cls = r.classification || AIEngine.classifyWQI(wqi);
        html += '<div style="margin-top:14px;padding:10px 12px;border-radius:8px;border:1px solid ' + cls.color + '33;background:' + cls.color + '11;display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="font-size:0.875rem;font-weight:600;color:var(--text-primary);">Overall WQI</span>';
        html += '<span style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;color:' + cls.color + ';text-shadow:0 0 12px ' + cls.color + '">' + wqi.toFixed(1) + ' <span style="font-size:0.75rem;font-weight:600;">' + cls.label + '</span></span>';
        html += '</div>';

        el.innerHTML = html;
    }

    // ── Fuzzy Rules ────────────────────────────────────────────────
    function renderFuzzyRules() {
        var el    = document.getElementById('fuzzy-rules');
        var ovEl  = document.getElementById('fuzzy-overall');
        if (!el) return;
        var r = Store.getLatestReading(_selectedDrone);
        if (!r) { el.innerHTML = '<div class="text-muted text-sm">No data yet...</div>'; return; }

        var risks = AIEngine.evaluateFuzzyRules(r);
        var html  = '';

        // Determine overall
        var levels    = Object.values(risks).map(function(r){ return r.level; });
        var hasCrit   = levels.some(function(l){ return l === 'CRITICAL'; });
        var highCount = levels.filter(function(l){ return l === 'HIGH'; }).length;
        var overallLabel = hasCrit ? 'CRITICAL RISK' : (highCount >= 2 ? 'HIGH RISK' : (highCount >= 1 ? 'MODERATE RISK' : 'LOW RISK'));
        var overallColor = hasCrit ? '#dc2626' : (highCount >= 2 ? '#ef4444' : (highCount >= 1 ? '#f59e0b' : '#22c55e'));

        if (ovEl) {
            ovEl.innerHTML = '<span style="font-weight:700;color:' + overallColor + '">● ' + overallLabel + '</span>';
        }

        Object.keys(risks).forEach(function (param) {
            var risk  = risks[param];
            var col   = RISK_COLORS[risk.level] || RISK_COLORS.LOW;
            var label = PARAM_LABELS[param] || param;
            html += '<div class="fuzzy-rule-item">';
            html += '<div class="fuzzy-param-name">' + label + '</div>';
            html += '<span class="risk-badge ' + risk.level + '">' + risk.level + '</span>';
            html += '<div class="fuzzy-rule-msg">' + risk.message + '</div>';
            html += '</div>';
        });

        el.innerHTML = html;
    }

    // ── Anomaly Feed ───────────────────────────────────────────────
    function renderAnomalyFeed() {
        var el = document.getElementById('anomaly-feed');
        if (!el) return;
        var anomalies = AIEngine.detectAnomalies(_selectedDrone);

        if (!anomalies.length) {
            el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.875rem;">✅ No statistical anomalies detected<br><span style="font-size:0.75rem;">Z-score within normal bounds (|z| &lt; 2.5)</span></div>';
            return;
        }

        el.innerHTML = anomalies.map(function (a) {
            return '<div class="anomaly-item">' +
                   '<div class="anomaly-icon">' + (a.severity === 'CRITICAL' ? '🔴' : '🟡') + '</div>' +
                   '<div>' +
                   '<div class="anomaly-param">' + a.label + ' — ' + a.direction.toUpperCase() + '</div>' +
                   '<div class="anomaly-detail">Current: <strong style="color:var(--text-primary)">' + a.value + '</strong> | Mean: ' + a.mean + ' | Std: ' + a.std + '</div>' +
                   '<span class="anomaly-zscore">Z-score: ' + a.zScore + '</span>' +
                   '</div></div>';
        }).join('');
    }

    // ── Trend Analysis ─────────────────────────────────────────────
    function renderTrendAnalysis() {
        var el = document.getElementById('trend-analysis-content');
        if (!el) return;
        var trend = AIEngine.calculateTrend(_selectedDrone);
        var history = Store.getReadingHistory(_selectedDrone, 20);
        var wqiHistory = history.map(function(r){ return r.wqi || 50; });
        var latestWQI = wqiHistory.length ? wqiHistory[wqiHistory.length - 1] : 50;
        var firstWQI  = wqiHistory.length ? wqiHistory[0] : 50;
        var change    = latestWQI - firstWQI;

        var drone = SimulationEngine.DRONES.find(function(d){ return d.id === _selectedDrone; });
        var droneName = drone ? drone.name : _selectedDrone;

        el.innerHTML = [
            '<div style="text-align:center;padding:20px 16px;">',
            '<div style="font-size:3rem;margin-bottom:8px;">' + (trend.direction === 'improving' ? '📉' : trend.direction === 'degrading' ? '📈' : '📊') + '</div>',
            '<div style="font-family:var(--font-display);font-size:1.5rem;font-weight:700;color:' + trend.color + ';margin-bottom:4px;">' + trend.label + '</div>',
            '<div style="font-size:0.875rem;color:var(--text-secondary);">' + droneName + '</div>',
            '</div>',
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 4px;">',
            '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;text-align:center;">',
            '<div style="font-size:0.6875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">Regression Slope</div>',
            '<div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-top:4px;">' + (trend.slope > 0 ? '+' : '') + trend.slope.toFixed(3) + '</div>',
            '</div>',
            '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;text-align:center;">',
            '<div style="font-size:0.6875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">WQI Change</div>',
            '<div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700;color:' + (change > 0 ? '#ef4444' : '#22c55e') + ';margin-top:4px;">' + (change > 0 ? '+' : '') + change.toFixed(1) + '</div>',
            '</div>',
            '</div>',
            '<div style="margin:14px 4px 0;font-size:0.75rem;color:var(--text-muted);text-align:center;">Based on linear regression over last ' + wqiHistory.length + ' readings</div>'
        ].join('');
    }

    // ── AI Report ─────────────────────────────────────────────────
    function renderAIReport() {
        var el = document.getElementById('ai-report');
        if (!el) return;
        el.innerHTML = AIEngine.generateReport(_selectedDrone);
    }

    // ── Live Updates ──────────────────────────────────────────────
    function startUpdates() {
        _updateInterval = setInterval(function () {
            renderAllSections();
        }, 5000);
    }

    // ── Cleanup ────────────────────────────────────────────────────
    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
        if (_riskChart) { try { _riskChart.destroy(); } catch(e){} _riskChart = null; }
    }

    return { render: render, cleanup: cleanup };
})();
