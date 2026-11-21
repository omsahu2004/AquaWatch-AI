/* ===================================================================
   app.js — SPA Router, Initialization, and Global Controller
   Ties together: Store · SimulationEngine · AIEngine · Pages
   =================================================================== */
(function () {
    'use strict';

    // ── Page Registry ──────────────────────────────────────────────
    var PAGES = {
        dashboard:  { title: 'Dashboard',          module: null, breadcrumbIcon: 'dashboard' },
        map:        { title: 'Live Map',            module: null, breadcrumbIcon: 'map' },
        analytics:  { title: 'Analytics',          module: null, breadcrumbIcon: 'analytics' },
        'ai-support':{ title:'AI Decision Support', module: null, breadcrumbIcon: 'ai' },
        alerts:     { title: 'Alerts',             module: null, breadcrumbIcon: 'alerts' },
        reports:    { title: 'Reports',            module: null, breadcrumbIcon: 'reports' },
        settings:   { title: 'Settings',           module: null, breadcrumbIcon: 'settings' }
    };

    var _currentPageId  = null;
    var _currentModule  = null;

    // ── Breadcrumb SVG Icons ───────────────────────────────────────
    var BREADCRUMB_ICONS = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        map:       '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
        analytics: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
        ai:        '<path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
        alerts:    '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
        reports:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
        settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    };

    // ── Navigation ─────────────────────────────────────────────────
    function navigate(pageId) {
        if (!PAGES[pageId]) pageId = 'dashboard';
        if (pageId === _currentPageId) return;

        // Cleanup outgoing page
        if (_currentModule && typeof _currentModule.cleanup === 'function') {
            try { _currentModule.cleanup(); } catch (e) { console.warn('[Router] Cleanup error:', e); }
        }

        // Update nav active state
        document.querySelectorAll('.nav-item[data-page]').forEach(function (el) {
            el.classList.toggle('active', el.dataset.page === pageId);
        });

        // Update breadcrumb
        var page     = PAGES[pageId];
        var iconPath = BREADCRUMB_ICONS[page.breadcrumbIcon] || BREADCRUMB_ICONS.dashboard;
        var breadEl  = document.getElementById('breadcrumb');
        if (breadEl) {
            breadEl.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' + iconPath + '</svg>' +
                '<span id="breadcrumb-text">' + page.title + '</span>';
        }

        // Update document title
        document.title = page.title + ' — AquaWatch AI';

        // Get the module
        var moduleMap = {
            dashboard:   window.DashboardPage,
            map:         window.MapPage,
            analytics:   window.AnalyticsPage,
            'ai-support':window.AISupportPage,
            alerts:      window.AlertsPage,
            reports:     window.ReportsPage,
            settings:    window.SettingsPage
        };
        var module = moduleMap[pageId];

        // Render new page
        var contentEl = document.getElementById('page-content');
        if (contentEl && module) {
            contentEl.innerHTML = '';
            contentEl.scrollTop = 0;
            try { module.render(contentEl); } catch (e) { console.error('[Router] Render error on', pageId, e); }
        }

        _currentPageId = pageId;
        _currentModule = module;

        // Update hash without triggering hashchange
        if (window.location.hash !== '#' + pageId) {
            history.replaceState(null, '', '#' + pageId);
        }

        // Close mobile sidebar
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
    }

    // ── Global clock & status bar ─────────────────────────────────
    function startGlobalTick() {
        function tick() {
            // Clock
            var clkEl = document.getElementById('header-clock');
            if (clkEl) {
                clkEl.textContent = new Date().toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                });
            }

            // Last updated
            var updEl = document.getElementById('last-updated');
            var state = Store.getState();
            if (updEl && state.lastUpdate) {
                updEl.textContent = 'Updated ' + new Date(state.lastUpdate).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
            }

            // Alert badge
            var badge   = document.getElementById('alert-badge');
            var active  = Store.getActiveAlerts().length;
            if (badge) {
                badge.textContent = active > 99 ? '99+' : active;
                badge.style.display = active > 0 ? 'flex' : 'none';
            }
        }
        tick(); // immediate
        setInterval(tick, 1000);
    }

    // ── Event Listeners ────────────────────────────────────────────
    function setupEventListeners() {
        // ── Sidebar nav links
        document.querySelectorAll('.nav-item[data-page]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                navigate(this.dataset.page);
            });
        });

        // ── Hash-based routing
        window.addEventListener('hashchange', function () {
            var hash = window.location.hash.replace('#', '').trim();
            if (hash && PAGES[hash]) navigate(hash);
        });

        // ── Sidebar collapse toggle
        var collapseBtn = document.getElementById('sidebar-toggle');
        var sidebar     = document.getElementById('sidebar');
        var mainWrapper = document.getElementById('main-wrapper');
        if (collapseBtn && sidebar) {
            collapseBtn.addEventListener('click', function () {
                sidebar.classList.toggle('collapsed');
                // Adjust main wrapper
                if (sidebar.classList.contains('collapsed')) {
                    mainWrapper.style.marginLeft = 'var(--sidebar-collapsed-width)';
                } else {
                    mainWrapper.style.marginLeft = 'var(--sidebar-width)';
                }
            });
        }

        // ── Mobile menu
        var mobileBtn = document.getElementById('mobile-menu-btn');
        if (mobileBtn && sidebar) {
            mobileBtn.addEventListener('click', function () {
                sidebar.classList.toggle('mobile-open');
            });
            // Close sidebar on outside click
            document.addEventListener('click', function (e) {
                if (sidebar.classList.contains('mobile-open') &&
                    !sidebar.contains(e.target) && e.target !== mobileBtn) {
                    sidebar.classList.remove('mobile-open');
                }
            });
        }

        // ── Theme toggle (header button)
        var themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', function () {
                var html   = document.documentElement;
                var isDark = html.getAttribute('data-theme') !== 'light';
                html.setAttribute('data-theme', isDark ? 'light' : 'dark');
                Store.setState({ theme: isDark ? 'light' : 'dark' });
                Store.save();
                var moonIcon = document.getElementById('theme-icon-moon');
                var sunIcon  = document.getElementById('theme-icon-sun');
                if (moonIcon) moonIcon.style.display = isDark ? 'none' : '';
                if (sunIcon)  sunIcon.style.display  = isDark ? '' : 'none';
            });
        }
    }

    // ── Loading Screen Animation ───────────────────────────────────
    function runLoadingSequence(onComplete) {
        var loadingEl    = document.getElementById('loading-screen');
        var statusEl     = document.getElementById('loading-status');
        var barFillEl    = document.getElementById('loading-bar-fill');

        var steps = [
            { text: 'Initializing drone network...',          progress: 15 },
            { text: 'Loading simulation engine...',           progress: 30 },
            { text: 'Calibrating AI analysis modules...',     progress: 50 },
            { text: 'Connecting to monitoring stations...',   progress: 65 },
            { text: 'Seeding historical sensor data...',      progress: 80 },
            { text: 'Starting real-time simulation...',       progress: 92 },
            { text: 'System ready!',                          progress: 100 }
        ];

        var idx = 0;
        var interval = setInterval(function () {
            if (idx >= steps.length) {
                clearInterval(interval);
                setTimeout(onComplete, 500);
                return;
            }
            var step = steps[idx];
            if (statusEl)  statusEl.textContent = step.text;
            if (barFillEl) barFillEl.style.width = step.progress + '%';
            idx++;
        }, 380);
    }

    // ── Apply saved theme before rendering ────────────────────────
    function applySavedTheme() {
        var savedTheme = Store.getState().theme;
        if (savedTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            var moonIcon = document.getElementById('theme-icon-moon');
            var sunIcon  = document.getElementById('theme-icon-sun');
            if (moonIcon) moonIcon.style.display = 'none';
            if (sunIcon)  sunIcon.style.display  = '';
        }
    }

    // ── Main Init ─────────────────────────────────────────────────
    function init() {
        applySavedTheme();

        // Chart.js global defaults (dark theme)
        if (window.Chart) {
            Chart.defaults.color         = '#64748b';
            Chart.defaults.borderColor   = 'rgba(255,255,255,0.05)';
            Chart.defaults.font.family   = 'Inter, system-ui, sans-serif';
        }

        runLoadingSequence(function () {
            // Hide loading, show app
            var loadingEl = document.getElementById('loading-screen');
            var appEl     = document.getElementById('app');

            if (loadingEl) {
                loadingEl.style.opacity    = '0';
                loadingEl.style.transition = 'opacity 0.4s ease';
                setTimeout(function () {
                    loadingEl.style.display = 'none';
                }, 400);
            }
            if (appEl) {
                appEl.style.display = 'flex';
                appEl.style.opacity = '0';
                appEl.style.transition = 'opacity 0.4s ease';
                setTimeout(function () { appEl.style.opacity = '1'; }, 50);
            }

            // Start simulation engine
            SimulationEngine.start();

            // Wire up events
            setupEventListeners();

            // Start global clock & badge ticker
            startGlobalTick();

            // Navigate to initial page
            var initialPage = window.location.hash.replace('#', '').trim() || 'dashboard';
            if (!PAGES[initialPage]) initialPage = 'dashboard';
            navigate(initialPage);
        });
    }

    // ── Expose navigate globally (used by page modules) ───────────
    window.navigate = navigate;

    // ── Boot on DOM ready ─────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
