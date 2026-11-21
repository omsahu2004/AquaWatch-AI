/* ===================================================================
   store.js — Central State Management with LocalStorage Persistence
   =================================================================== */
window.Store = (function () {

    // ── Default State ──────────────────────────────────────────────
    const DEFAULT_THRESHOLDS = {
        ph:          { min: 6.5,  max: 8.5  },
        do:          { min: 6.0,  max: 10.0 },
        turbidity:   { min: 0,    max: 5.0  },
        temperature: { min: 15,   max: 30   },
        tds:         { min: 0,    max: 500  },
        nitrates:    { min: 0,    max: 10   },
        conductivity:{ min: 100,  max: 800  }
    };

    const state = {
        currentPage: 'dashboard',
        simulationSpeed: 1,
        theme: 'dark',
        thresholds: JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)),
        droneData: {},       // { droneId: [reading, ...] }
        alerts: [],          // [ { id, droneId, location, parameter, message, severity, timestamp, acknowledged } ]
        lastUpdate: null
    };

    // ── Event Listeners ────────────────────────────────────────────
    const listeners = {};

    function subscribe(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        // Return unsubscribe function
        return function () {
            listeners[event] = listeners[event].filter(function (cb) { return cb !== callback; });
        };
    }

    function emit(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(function (cb) {
            try { cb(data); } catch (e) { console.warn('[Store] Listener error:', e); }
        });
    }

    // ── State Accessors ────────────────────────────────────────────
    function getState() { return state; }

    function setState(updates) {
        Object.assign(state, updates);
        emit('stateChange', state);
    }

    // ── Drone Data ─────────────────────────────────────────────────
    function addDroneReading(droneId, reading) {
        if (!state.droneData[droneId]) state.droneData[droneId] = [];
        state.droneData[droneId].push(reading);
        // Circular buffer – keep latest 500
        if (state.droneData[droneId].length > 500) {
            state.droneData[droneId].shift();
        }
        emit('droneUpdate', { droneId: droneId, reading: reading });
    }

    function getLatestReading(droneId) {
        var arr = state.droneData[droneId];
        return (arr && arr.length) ? arr[arr.length - 1] : null;
    }

    function getReadingHistory(droneId, count) {
        count = count || 50;
        var arr = state.droneData[droneId] || [];
        return arr.slice(-count);
    }

    function getAllLatestReadings() {
        var result = {};
        Object.keys(state.droneData).forEach(function (id) {
            result[id] = getLatestReading(id);
        });
        return result;
    }

    // ── Alerts ─────────────────────────────────────────────────────
    function addAlert(alertData) {
        var alert = Object.assign({}, alertData, {
            id: Date.now() + '_' + Math.random().toString(36).slice(2),
            timestamp: new Date(),
            acknowledged: false
        });
        state.alerts.unshift(alert);
        // Keep latest 100
        if (state.alerts.length > 100) state.alerts.pop();
        emit('alertAdded', alert);
        emit('alertsChanged', state.alerts);
        return alert;
    }

    function acknowledgeAlert(alertId) {
        var alert = state.alerts.find(function (a) { return a.id === alertId; });
        if (alert) {
            alert.acknowledged = true;
            emit('alertsChanged', state.alerts);
        }
    }

    function acknowledgeAll() {
        state.alerts.forEach(function (a) { a.acknowledged = true; });
        emit('alertsChanged', state.alerts);
    }

    function getActiveAlerts() {
        return state.alerts.filter(function (a) { return !a.acknowledged; });
    }

    function clearAlerts() {
        state.alerts = [];
        emit('alertsChanged', state.alerts);
    }

    // ── Persistence ────────────────────────────────────────────────
    function save() {
        try {
            localStorage.setItem('aquawatch_prefs', JSON.stringify({
                thresholds:       state.thresholds,
                theme:            state.theme,
                simulationSpeed:  state.simulationSpeed
            }));
        } catch (e) { /* ignore quota errors */ }
    }

    function load() {
        try {
            var raw = localStorage.getItem('aquawatch_prefs');
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (parsed.thresholds)      state.thresholds      = parsed.thresholds;
            if (parsed.theme)           state.theme           = parsed.theme;
            if (parsed.simulationSpeed) state.simulationSpeed = parsed.simulationSpeed;
        } catch (e) { /* corrupt data, ignore */ }
    }

    function resetThresholds() {
        state.thresholds = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
        save();
        emit('stateChange', state);
    }

    // ── Init ───────────────────────────────────────────────────────
    load();

    // ── Public API ─────────────────────────────────────────────────
    return {
        getState:           getState,
        setState:           setState,
        subscribe:          subscribe,
        addDroneReading:    addDroneReading,
        getLatestReading:   getLatestReading,
        getReadingHistory:  getReadingHistory,
        getAllLatestReadings:getAllLatestReadings,
        addAlert:           addAlert,
        acknowledgeAlert:   acknowledgeAlert,
        acknowledgeAll:     acknowledgeAll,
        getActiveAlerts:    getActiveAlerts,
        clearAlerts:        clearAlerts,
        save:               save,
        resetThresholds:    resetThresholds,
        DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS
    };
})();
