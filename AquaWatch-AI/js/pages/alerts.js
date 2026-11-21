/* ===================================================================
   pages/alerts.js — Alerts Management Page
   Alert List · Severity Filters · Acknowledge · Stats
   =================================================================== */
window.AlertsPage = (function () {

    var _updateInterval = null;
    var _filterSeverity = 'all';
    var _filterDrone    = 'all';
    var _unsubscribe    = null;

    // ── Render ─────────────────────────────────────────────────────
    function render(container) {
        container.innerHTML = buildHTML();
        setTimeout(function () { bindControls(); startUpdates(); }, 100);
    }

    function buildHTML() {
        var html = '<div class="fade-in">';

        html += '<div class="page-header">';
        html += '<div class="page-title-block"><h1>Alerts & Notifications</h1><p>Threshold violations, anomaly detections, and system events</p></div>';
        html += '<div class="page-actions">';
        html += '<button class="btn btn-secondary btn-sm" onclick="AlertsPage.acknowledgeAll()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Acknowledge All</button>';
        html += '<button class="btn btn-ghost btn-sm" onclick="AlertsPage.clearAll()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> Clear All</button>';
        html += '</div></div>';

        // Stats row
        html += '<div id="alert-stats-row" style="margin-bottom:20px;"></div>';

        // Filter bar
        var droneOptions = '<option value="all">All Stations</option>' + SimulationEngine.DRONES.map(function(d){
            return '<option value="' + d.id + '">' + d.id + ' — ' + d.name + '</option>';
        }).join('');

        html += '<div class="filter-bar">';
        html += '<select class="filter-select" id="filter-severity">';
        html += '<option value="all">All Severities</option>';
        html += '<option value="critical">Critical Only</option>';
        html += '<option value="warning">Warnings Only</option>';
        html += '</select>';
        html += '<select class="filter-select" id="filter-drone">' + droneOptions + '</select>';
        html += '<select class="filter-select" id="filter-acked">';
        html += '<option value="all">All Alerts</option>';
        html += '<option value="active">Active Only</option>';
        html += '<option value="acked">Acknowledged Only</option>';
        html += '</select>';
        html += '</div>';

        // Alert list
        html += '<div id="alerts-list"></div>';

        html += '</div>';
        return html;
    }

    // ── Stats Row ─────────────────────────────────────────────────
    function renderStatsRow() {
        var el = document.getElementById('alert-stats-row');
        if (!el) return;
        var alerts   = Store.getState().alerts;
        var total    = alerts.length;
        var critical = alerts.filter(function(a){ return a.severity === 'critical'; }).length;
        var warnings = alerts.filter(function(a){ return a.severity === 'warning'; }).length;
        var active   = alerts.filter(function(a){ return !a.acknowledged; }).length;

        el.innerHTML = '<div class="quick-stats-grid" style="grid-template-columns:repeat(4,1fr);">' +
            buildStatCard('Total Alerts',   total,    '#00d4ff', 'rgba(0,212,255,0.12)') +
            buildStatCard('Critical',       critical, '#dc2626', 'rgba(220,38,38,0.12)') +
            buildStatCard('Warnings',       warnings, '#f59e0b', 'rgba(245,158,11,0.12)') +
            buildStatCard('Active (Unacked)',active,  '#8b5cf6', 'rgba(139,92,246,0.12)') +
            '</div>';
    }

    function buildStatCard(label, value, color, bg) {
        return '<div class="stat-card" style="--stat-color:' + color + ';--stat-color-bg:' + bg + ';padding:14px 16px;">' +
               '<div style="flex:1;"><div class="stat-value" style="font-size:1.5rem;">' + value + '</div><div class="stat-label">' + label + '</div></div>' +
               '</div>';
    }

    // ── Alert List ─────────────────────────────────────────────────
    function renderAlertList() {
        var el = document.getElementById('alerts-list');
        if (!el) return;

        var sevFilter  = _filterSeverity;
        var droneFilter= _filterDrone;
        var ackedFilter= document.getElementById('filter-acked') ? document.getElementById('filter-acked').value : 'all';

        var alerts = Store.getState().alerts.filter(function (a) {
            if (sevFilter !== 'all' && a.severity !== sevFilter) return false;
            if (droneFilter !== 'all' && a.droneId !== droneFilter) return false;
            if (ackedFilter === 'active' && a.acknowledged) return false;
            if (ackedFilter === 'acked' && !a.acknowledged) return false;
            return true;
        });

        if (!alerts.length) {
            el.innerHTML = '<div class="card"><div class="empty-state">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
                '<div class="empty-state-title">No alerts found</div>' +
                '<div>No alerts match your current filters</div>' +
                '</div></div>';
            return;
        }

        var severityLabel = function(sev) {
            if (sev === 'critical') return '🔴 Critical';
            if (sev === 'warning')  return '🟡 Warning';
            return '🔵 Info';
        };

        var paramLabel = function(p) {
            var labels = { ph:'pH', do:'Dissolved O₂', turbidity:'Turbidity', temperature:'Temperature', tds:'TDS', nitrates:'Nitrates', conductivity:'Conductivity', anomaly:'Anomaly' };
            return labels[p] || p;
        };

        el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' + alerts.map(function (a) {
            var time = a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN', { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '';
            return '<div class="alert-item ' + (a.severity || 'info') + (a.acknowledged ? ' acknowledged' : '') + '">' +
                   '<div class="alert-severity-indicator"></div>' +
                   '<div class="alert-body">' +
                   '<div class="alert-title-row">' +
                   '<span class="alert-title-text">' + severityLabel(a.severity) + ' — ' + paramLabel(a.parameter) + '</span>' +
                   '<span class="alert-location">' + (a.location || a.droneId || '') + '</span>' +
                   (a.acknowledged ? '<span style="font-size:0.6875rem;color:var(--status-excellent);background:var(--status-excellent-bg);padding:2px 7px;border-radius:4px;">✓ Acknowledged</span>' : '') +
                   '</div>' +
                   '<div class="alert-description">' + (a.message || '') + '</div>' +
                   '<div class="alert-timestamp">' + time + '</div>' +
                   '</div>' +
                   '<div class="alert-action">' +
                   (!a.acknowledged ? '<button class="btn btn-secondary btn-sm" onclick="AlertsPage.acknowledge(\'' + a.id + '\')">Acknowledge</button>' : '') +
                   '</div>' +
                   '</div>';
        }).join('') + '</div>';
    }

    // ── Controls ───────────────────────────────────────────────────
    function bindControls() {
        var sevSel  = document.getElementById('filter-severity');
        var drnSel  = document.getElementById('filter-drone');
        var ackSel  = document.getElementById('filter-acked');

        if (sevSel) sevSel.addEventListener('change', function(){ _filterSeverity = this.value; renderAlertList(); });
        if (drnSel) drnSel.addEventListener('change', function(){ _filterDrone    = this.value; renderAlertList(); });
        if (ackSel) ackSel.addEventListener('change', function(){ renderAlertList(); });

        renderStatsRow();
        renderAlertList();

        _unsubscribe = Store.subscribe('alertsChanged', function () {
            renderStatsRow();
            renderAlertList();
        });
    }

    function acknowledge(id) {
        Store.acknowledgeAlert(id);
    }

    function acknowledgeAll() {
        Store.acknowledgeAll();
    }

    function clearAll() {
        if (confirm('Clear all alerts? This cannot be undone.')) {
            Store.clearAlerts();
        }
    }

    // ── Live Updates ──────────────────────────────────────────────
    function startUpdates() {
        _updateInterval = setInterval(function () {
            renderStatsRow();
        }, 3000);
    }

    // ── Cleanup ────────────────────────────────────────────────────
    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
        if (_unsubscribe)    { _unsubscribe(); _unsubscribe = null; }
    }

    return { render: render, cleanup: cleanup, acknowledge: acknowledge, acknowledgeAll: acknowledgeAll, clearAll: clearAll };
})();
