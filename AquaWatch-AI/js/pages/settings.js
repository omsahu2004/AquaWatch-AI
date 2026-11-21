/* ===================================================================
   pages/settings.js — Settings & Simulation Control Page
   Speed Control · Threshold Editor · Theme Toggle · Reset
   =================================================================== */
window.SettingsPage = (function () {

    var _updateInterval = null;

    // ── Render ─────────────────────────────────────────────────────
    function render(container) {
        container.innerHTML = buildHTML();
        setTimeout(function () { bindControls(); renderSpeedDisplay(); }, 100);
    }

    function buildHTML() {
        var state      = Store.getState();
        var thresholds = state.thresholds;
        var speed      = state.simulationSpeed || 1;

        var html = '<div class="fade-in">';

        html += '<div class="page-header">';
        html += '<div class="page-title-block"><h1>Settings</h1><p>Configure simulation parameters, alert thresholds, and display preferences</p></div>';
        html += '</div>';

        // Info banner
        html += '<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px;">';
        html += '<svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>';
        html += '<span style="font-size:0.8125rem;color:var(--text-secondary);">AquaWatch AI is running in <strong style="color:var(--text-primary)">simulation mode</strong>. All sensor data is synthetically generated using Gaussian noise models and time-of-day patterns. No physical hardware or paid APIs are required.</span>';
        html += '</div>';

        html += '<div class="settings-grid">';

        // ── Simulation Control ────────────────────────────────────
        html += '<div class="settings-section-card">';
        html += '<div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Simulation Engine</div>';

        html += '<div class="setting-item">';
        html += '<div class="setting-label">Simulation Speed</div>';
        html += '<div class="setting-description">Controls how fast sensor readings update (1× = 3 sec/reading)</div>';
        html += '<div class="speed-display" id="speed-display">' + speed + '×</div>';
        html += '<input type="range" class="form-range" id="sim-speed" min="1" max="10" step="1" value="' + speed + '">';
        html += '<div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--text-muted);margin-top:4px;"><span>1× (3s)</span><span>5× (0.6s)</span><span>10× (0.3s)</span></div>';
        html += '</div>';

        html += '<div class="setting-item" style="margin-top:16px;">';
        html += '<button class="btn btn-secondary w-full" id="reset-sim-btn" onclick="SettingsPage.resetSimulation()" style="justify-content:center;">';
        html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
        html += 'Reset Simulation &amp; Clear Data</button>';
        html += '</div>';

        html += '</div>'; // simulation card

        // ── Display Settings ──────────────────────────────────────
        html += '<div class="settings-section-card">';
        html += '<div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>Display Preferences</div>';

        html += '<div class="setting-row">';
        html += '<div><div class="setting-label">Dark Mode</div><div class="setting-description">Toggle between dark navy and light theme</div></div>';
        html += '<label class="toggle-switch"><input type="checkbox" id="theme-toggle-settings" ' + (Store.getState().theme !== 'light' ? 'checked' : '') + '><span class="toggle-slider"></span></label>';
        html += '</div>';

        html += '<div style="padding:14px 0;border-bottom:1px solid var(--border-subtle);">';
        html += '<div class="setting-label" style="margin-bottom:8px;">Current Time (Local)</div>';
        html += '<div style="font-family:var(--font-mono);font-size:1rem;color:var(--accent-cyan);" id="settings-clock">--:--:--</div>';
        html += '</div>';

        html += '<div style="padding:14px 0;">';
        html += '<div class="setting-label" style="margin-bottom:4px;">Version</div>';
        html += '<div style="font-family:var(--font-mono);font-size:0.875rem;color:var(--text-muted);">AquaWatch AI v1.0.0</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">BTech Project — AI-Driven Decision Support for Spatio-Temporal Water Quality Monitoring</div>';
        html += '</div>';

        html += '</div>'; // display card

        // ── Parameter Thresholds ──────────────────────────────────
        html += '<div class="settings-section-card" style="grid-column:1/-1;">';
        html += '<div class="settings-section-title" style="justify-content:space-between;">';
        html += '<span style="display:flex;align-items:center;gap:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Alert Threshold Configuration</span>';
        html += '<button class="btn btn-ghost btn-sm" onclick="SettingsPage.resetThresholds()">Reset to Defaults</button>';
        html += '</div>';
        html += '<p style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:16px;">Alerts fire when sensor readings go below minimum or above maximum values. Changes apply immediately.</p>';

        var PARAM_META = [
            { key:'ph',          label:'pH',           unit:'',       minDef:6.5,  maxDef:8.5  },
            { key:'do',          label:'Dissolved O₂', unit:'mg/L',   minDef:6.0,  maxDef:10.0 },
            { key:'turbidity',   label:'Turbidity',    unit:'NTU',    minDef:0,    maxDef:5.0  },
            { key:'temperature', label:'Temperature',  unit:'°C',     minDef:15,   maxDef:30   },
            { key:'tds',         label:'TDS',          unit:'mg/L',   minDef:0,    maxDef:500  },
            { key:'nitrates',    label:'Nitrates',     unit:'mg/L',   minDef:0,    maxDef:10   },
            { key:'conductivity',label:'Conductivity', unit:'µS/cm',  minDef:100,  maxDef:800  }
        ];

        html += '<div class="threshold-grid">';
        PARAM_META.forEach(function (p) {
            var thresh = thresholds[p.key] || { min: p.minDef, max: p.maxDef };
            html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:10px;padding:14px 16px;">';
            html += '<div style="font-size:0.875rem;font-weight:600;color:var(--text-primary);margin-bottom:10px;">' + p.label + (p.unit ? ' (' + p.unit + ')' : '') + '</div>';
            html += '<div class="threshold-pair">';
            html += '<div class="form-group"><label class="form-label">Min</label><input type="number" class="form-input threshold-input" data-param="' + p.key + '" data-type="min" value="' + thresh.min + '" step="0.1"></div>';
            html += '<div class="form-group"><label class="form-label">Max</label><input type="number" class="form-input threshold-input" data-param="' + p.key + '" data-type="max" value="' + thresh.max + '" step="0.1"></div>';
            html += '</div></div>';
        });
        html += '</div>'; // threshold-grid
        html += '<div style="margin-top:16px;text-align:right;"><button class="btn btn-primary" onclick="SettingsPage.saveThresholds()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Thresholds</button></div>';
        html += '</div>'; // thresholds card

        // ── Drone Info ────────────────────────────────────────────
        html += '<div class="settings-section-card" style="grid-column:1/-1;">';
        html += '<div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Drone Station Registry</div>';
        html += '<div class="data-table-wrapper">';
        html += '<table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Water Body</th><th>Coordinates</th><th>Status</th></tr></thead><tbody>';
        SimulationEngine.DRONES.forEach(function (d) {
            html += '<tr>';
            html += '<td><span style="font-family:var(--font-mono);color:var(--accent-cyan);font-weight:700;">' + d.id + '</span></td>';
            html += '<td class="col-name">' + d.name + '</td>';
            html += '<td>' + d.location + '</td>';
            html += '<td>' + d.waterBody + '</td>';
            html += '<td style="font-family:var(--font-mono);font-size:0.75rem;">' + d.lat.toFixed(4) + '°N, ' + d.lng.toFixed(4) + '°E</td>';
            html += '<td><span class="status-pill excellent">● Active</span></td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        html += '</div></div>'; // drone info card

        // ── About ─────────────────────────────────────────────────
        html += '<div class="settings-section-card" style="grid-column:1/-1;background:linear-gradient(135deg,rgba(0,212,255,0.04),rgba(139,92,246,0.04));border-color:rgba(0,212,255,0.15);">';
        html += '<div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>About This Project</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">';
        html += '<div>';
        html += '<h3 style="font-family:var(--font-display);font-size:1rem;color:var(--accent-cyan);margin-bottom:8px;">AI-Driven Decision Support for Spatio-Temporal Water Quality Monitoring Using Aquatic Drones</h3>';
        html += '<p style="font-size:0.8125rem;color:var(--text-secondary);line-height:1.7;margin-bottom:12px;">A BTech engineering prototype demonstrating how AI and aquatic drone technology can be used to monitor water quality across multiple geographical locations in real time.</p>';
        html += '<p style="font-size:0.8125rem;color:var(--text-secondary);line-height:1.7;">The application simulates 5 Indian water bodies, applying a Weighted Arithmetic WQI model, Fuzzy Logic rule evaluation, Z-Score anomaly detection, and Linear Regression trend analysis.</p>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:16px;"><strong style="color:var(--text-secondary);">Technology Stack</strong></div>';
        var techStack = [
            ['Frontend', 'HTML5 · CSS3 · JavaScript (ES5+)'],
            ['Charts', 'Chart.js v4.4.4'],
            ['Maps', 'Leaflet.js v1.9.4 + OpenStreetMap'],
            ['Fonts', 'Inter · Space Grotesk · JetBrains Mono'],
            ['AI Logic', 'Custom JS Rules Engine (no ML library)'],
            ['Data', 'Simulated — Gaussian noise + time-of-day patterns'],
            ['Storage', 'LocalStorage (preferences only)'],
            ['Server', 'None required — pure client-side SPA']
        ];
        techStack.forEach(function (item) {
            html += '<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid var(--border-subtle);font-size:0.8125rem;">';
            html += '<span style="color:var(--text-muted);width:90px;flex-shrink:0;">' + item[0] + '</span>';
            html += '<span style="color:var(--text-secondary);">' + item[1] + '</span>';
            html += '</div>';
        });
        html += '</div></div>';
        html += '</div>'; // about card

        html += '</div>'; // settings-grid
        html += '</div>'; // fade-in
        return html;
    }

    // ── Controls ───────────────────────────────────────────────────
    function bindControls() {
        // Speed slider
        var slider = document.getElementById('sim-speed');
        if (slider) {
            slider.addEventListener('input', function () {
                var val = parseInt(this.value);
                renderSpeedDisplay(val);
            });
            slider.addEventListener('change', function () {
                var val = parseInt(this.value);
                SimulationEngine.setSpeed(val);
                Store.save();
                showToast('Simulation speed set to ' + val + '×');
            });
        }

        // Theme toggle in settings
        var themeTog = document.getElementById('theme-toggle-settings');
        if (themeTog) {
            themeTog.addEventListener('change', function () {
                var isDark = this.checked;
                document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
                Store.setState({ theme: isDark ? 'dark' : 'light' });
                Store.save();
                // Sync header button icon
                var moonIcon = document.getElementById('theme-icon-moon');
                var sunIcon  = document.getElementById('theme-icon-sun');
                if (moonIcon) moonIcon.style.display = isDark ? '' : 'none';
                if (sunIcon)  sunIcon.style.display  = isDark ? 'none' : '';
            });
        }

        // Clock
        _updateInterval = setInterval(function () {
            var clk = document.getElementById('settings-clock');
            if (clk) clk.textContent = new Date().toLocaleTimeString('en-IN');
        }, 1000);
        var clk = document.getElementById('settings-clock');
        if (clk) clk.textContent = new Date().toLocaleTimeString('en-IN');
    }

    function renderSpeedDisplay(val) {
        val = val || Store.getState().simulationSpeed || 1;
        var el = document.getElementById('speed-display');
        if (el) el.textContent = val + '×';
    }

    function saveThresholds() {
        var inputs  = document.querySelectorAll('.threshold-input');
        var thresh  = Store.getState().thresholds;
        inputs.forEach(function (inp) {
            var param = inp.dataset.param;
            var type  = inp.dataset.type;
            var val   = parseFloat(inp.value);
            if (!isNaN(val) && thresh[param]) {
                thresh[param][type] = val;
            }
        });
        Store.setState({ thresholds: thresh });
        Store.save();
        showToast('✓ Thresholds saved successfully!');
    }

    function resetThresholds() {
        Store.resetThresholds();
        // Re-render the page
        var container = document.getElementById('page-content');
        if (container) render(container);
        showToast('Thresholds reset to defaults.');
    }

    function resetSimulation() {
        if (!confirm('Reset simulation? This will clear all historical data and restart from scratch.')) return;
        SimulationEngine.reset();
        Store.clearAlerts();
        showToast('Simulation reset complete. Generating new data...');
    }

    // ── Toast Notification ─────────────────────────────────────────
    function showToast(message) {
        var existing = document.getElementById('aq-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id  = 'aq-toast';
        toast.style.cssText = [
            'position:fixed;bottom:24px;right:24px;z-index:9999;',
            'background:rgba(8,25,46,0.97);border:1px solid rgba(0,212,255,0.3);',
            'border-radius:10px;padding:12px 20px;',
            'color:#e2e8f0;font-size:0.875rem;font-family:Inter,sans-serif;',
            'box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 20px rgba(0,212,255,0.1);',
            'animation:fadeSlideIn 0.3s ease;backdrop-filter:blur(20px);'
        ].join('');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
        }, 3000);
    }

    // ── Cleanup ────────────────────────────────────────────────────
    function cleanup() {
        if (_updateInterval) { clearInterval(_updateInterval); _updateInterval = null; }
    }

    return { render: render, cleanup: cleanup, saveThresholds: saveThresholds, resetThresholds: resetThresholds, resetSimulation: resetSimulation };
})();
