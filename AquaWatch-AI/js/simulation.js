/* ===================================================================
   simulation.js — Water Quality Data Simulation Engine
   Gaussian Noise · Time-of-Day Variation · Anomaly Injection
   =================================================================== */
window.SimulationEngine = (function () {

    // ── Drone Locations ────────────────────────────────────────────
    var DRONES = [
        {
            id: 'D1', name: 'Yamuna River',    location: 'Delhi',    waterBody: 'River',
            lat: 28.6139, lng: 77.2090,
            // Moderately polluted urban river
            base: { ph: 7.2, do: 5.5, turbidity: 15, temperature: 26, tds: 350, nitrates: 8, conductivity: 450 }
        },
        {
            id: 'D2', name: 'Powai Lake',      location: 'Mumbai',   waterBody: 'Lake',
            lat: 19.1270, lng: 72.9060,
            // Semi-urban lake, moderate quality
            base: { ph: 7.8, do: 7.2, turbidity: 8, temperature: 28, tds: 220, nitrates: 5, conductivity: 320 }
        },
        {
            id: 'D3', name: 'Hussain Sagar',   location: 'Hyderabad',waterBody: 'Lake',
            lat: 17.4126, lng: 78.4772,
            // Known eutrophication — higher nutrients
            base: { ph: 8.6, do: 4.8, turbidity: 25, temperature: 30, tds: 480, nitrates: 12, conductivity: 620 }
        },
        {
            id: 'D4', name: 'Dal Lake',         location: 'Srinagar', waterBody: 'Lake',
            lat: 34.0837, lng: 74.7973,
            // High altitude tourist lake — moderate quality
            base: { ph: 7.5, do: 8.5, turbidity: 4, temperature: 16, tds: 180, nitrates: 4, conductivity: 250 }
        },
        {
            id: 'D5', name: 'Chilika Lake',     location: 'Odisha',   waterBody: 'Lagoon',
            lat: 19.7572, lng: 85.3200,
            // Coastal lagoon — good quality
            base: { ph: 7.9, do: 8.0, turbidity: 6, temperature: 27, tds: 310, nitrates: 3, conductivity: 850 }
        }
    ];

    // ── Per-Drone Simulation State ─────────────────────────────────
    var _droneState = {};
    DRONES.forEach(function (d) {
        _droneState[d.id] = {
            anomalyActive:   false,
            anomalyDuration: 0,
            anomalyParam:    null
        };
    });

    var _simInterval = null;

    // ── Helper: Box-Muller Gaussian Random ─────────────────────────
    function gaussRandom(mean, std) {
        var u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return (Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)) * std + mean;
    }

    function clamp(val, lo, hi) {
        return Math.max(lo, Math.min(hi, val));
    }

    // Time-of-day factor 0→1 (peaks at noon)
    function todFactor() {
        var now  = new Date();
        var hour = now.getHours() + now.getMinutes() / 60;
        return 0.5 + 0.5 * Math.sin((hour - 6) * Math.PI / 12);
    }

    // ── Core Reading Generator ─────────────────────────────────────
    function generateReading(drone, tsMs) {
        var ds  = _droneState[drone.id];
        var tod = todFactor();
        var b   = drone.base;

        // Anomaly lifecycle
        if (!ds.anomalyActive && Math.random() < 0.012) {
            var params         = ['ph', 'do', 'turbidity', 'tds', 'nitrates'];
            ds.anomalyParam    = params[Math.floor(Math.random() * params.length)];
            ds.anomalyActive   = true;
            ds.anomalyDuration = Math.floor(Math.random() * 12) + 5;
        }
        var anomalyNow = false;
        if (ds.anomalyActive) {
            anomalyNow = true;
            ds.anomalyDuration--;
            if (ds.anomalyDuration <= 0) {
                ds.anomalyActive = false;
                ds.anomalyParam  = null;
                anomalyNow       = false;
            }
        }

        // Generate each parameter
        var ph          = clamp(b.ph          + gaussRandom(0, 0.15), 4.0, 11.0);
        var doVal       = clamp(b.do          + gaussRandom(0, 0.30) + tod * 1.2, 0.0, 15.0);
        var turbidity   = clamp(b.turbidity   + gaussRandom(0, 1.50) + tod * 2.0, 0.0, 400.0);
        var temperature = clamp(b.temperature + gaussRandom(0, 0.25) + tod * 2.5, 5.0,  40.0);
        var tds         = clamp(b.tds         + gaussRandom(0, 10.0),               0.0,1800.0);
        var nitrates    = clamp(b.nitrates    + gaussRandom(0, 0.40),               0.0, 80.0);
        var conductivity= clamp(b.conductivity+ gaussRandom(0, 15.0),               0.0,2800.0);

        // Apply anomaly spike/drop
        if (anomalyNow && ds.anomalyParam) {
            var p = ds.anomalyParam;
            if (p === 'ph')        ph          = clamp(ph * (Math.random() > 0.5 ? 1.4 : 0.65), 4.0, 11.0);
            if (p === 'do')        doVal       = clamp(b.do * 0.25 + gaussRandom(0, 0.15), 0.0, 15.0);
            if (p === 'turbidity') turbidity   = clamp(turbidity * 6 + gaussRandom(0, 10), 0.0, 400.0);
            if (p === 'tds')       tds         = clamp(tds * 3 + gaussRandom(0, 50), 0.0, 1800.0);
            if (p === 'nitrates')  nitrates    = clamp(nitrates * 5 + gaussRandom(0, 2),  0.0,  80.0);
        }

        return {
            timestamp:   tsMs ? new Date(tsMs).toISOString() : new Date().toISOString(),
            ph:          parseFloat(ph.toFixed(3)),
            do:          parseFloat(doVal.toFixed(3)),
            turbidity:   parseFloat(turbidity.toFixed(2)),
            temperature: parseFloat(temperature.toFixed(2)),
            tds:         parseFloat(tds.toFixed(1)),
            nitrates:    parseFloat(nitrates.toFixed(3)),
            conductivity:parseFloat(conductivity.toFixed(1)),
            isAnomaly:   anomalyNow,
            anomalyParam:anomalyNow ? ds.anomalyParam : null
        };
    }

    // ── Enrich a Reading with AI Analysis ─────────────────────────
    function enrichReading(drone, raw) {
        var wqi = AIEngine.calculateWQI(raw);
        var cls = AIEngine.classifyWQI(wqi);
        return Object.assign({}, raw, {
            wqi:            wqi,
            classification: cls,
            droneId:        drone.id,
            droneName:      drone.name,
            droneLocation:  drone.location
        });
    }

    // ── Single Tick (called by interval) ──────────────────────────
    function tick() {
        DRONES.forEach(function (drone) {
            var raw     = generateReading(drone);
            var reading = enrichReading(drone, raw);

            // Add trend from AI engine
            var trend   = AIEngine.calculateTrend(drone.id);
            reading.trend = trend;

            Store.addDroneReading(drone.id, reading);

            // Alert checks
            if (reading.isAnomaly) {
                AIEngine.checkAndGenerateAlert(drone, reading, reading.wqi, reading.classification);
            }
            AIEngine.checkThresholds(drone, reading);
        });

        Store.setState({ lastUpdate: new Date() });
    }

    // ── Pre-seed Historical Data (looks like last 3 mins) ─────────
    function seedHistory() {
        var now      = Date.now();
        var interval = 3000;  // 3 seconds between readings
        var count    = 80;    // 80 historical readings per drone

        for (var i = count; i >= 1; i--) {
            var tsMs = now - i * interval;
            DRONES.forEach(function (drone) {
                var raw     = generateReading(drone, tsMs);
                var wqi     = AIEngine.calculateWQI(raw);
                var cls     = AIEngine.classifyWQI(wqi);
                var reading = Object.assign({}, raw, {
                    wqi:            wqi,
                    classification: cls,
                    droneId:        drone.id,
                    droneName:      drone.name,
                    droneLocation:  drone.location,
                    trend:          { direction: 'stable', label: '→ Stable', color: '#94a3b8' }
                });
                Store.addDroneReading(drone.id, reading);
            });
        }
    }

    // ── Start / Stop / Restart ─────────────────────────────────────
    function start() {
        seedHistory();
        var speed    = Store.getState().simulationSpeed || 1;
        var interval = Math.max(500, Math.round(3000 / speed));
        _simInterval = setInterval(tick, interval);
        console.log('[SimEngine] Started — interval:', interval, 'ms');
    }

    function stop() {
        if (_simInterval) { clearInterval(_simInterval); _simInterval = null; }
    }

    function setSpeed(speed) {
        stop();
        Store.setState({ simulationSpeed: speed });
        var interval = Math.max(500, Math.round(3000 / speed));
        _simInterval = setInterval(tick, interval);
        console.log('[SimEngine] Speed changed to', speed, '× — interval:', interval, 'ms');
    }

    function reset() {
        stop();
        // Reset drone anomaly state
        DRONES.forEach(function (d) {
            _droneState[d.id] = { anomalyActive: false, anomalyDuration: 0, anomalyParam: null };
        });
        // Clear data via proper store methods (emits events correctly)
        Store.setState({ droneData: {}, lastUpdate: null });
        Store.clearAlerts();
        seedHistory();
        var speed    = Store.getState().simulationSpeed || 1;
        var interval = Math.max(500, Math.round(3000 / speed));
        _simInterval = setInterval(tick, interval);
        console.log('[SimEngine] Reset complete.');
    }

    // ── Public API ─────────────────────────────────────────────────
    return {
        DRONES:  DRONES,
        start:   start,
        stop:    stop,
        setSpeed:setSpeed,
        reset:   reset
    };
})();
