/* ===================================================================
   ai-engine.js — AI Analysis Engine
   WQI Calculation · Fuzzy Rules · Z-Score Anomaly Detection · Trend
   =================================================================== */
window.AIEngine = (function () {

    // ── Parameter Configuration ────────────────────────────────────
    var PARAM_CONFIG = {
        ph:          { label: 'pH',           unit: '',       weight: 0.20, ideal: 7.0,  worst: 14.0, min: 6.5,  max: 8.5  },
        do:          { label: 'Dissolved O₂', unit: 'mg/L',  weight: 0.25, ideal: 10.0, worst: 0.0,  min: 6.0,  max: 10.0 },
        turbidity:   { label: 'Turbidity',    unit: 'NTU',   weight: 0.15, ideal: 0.0,  worst: 100.0,min: 0.0,  max: 5.0  },
        temperature: { label: 'Temperature',  unit: '°C',    weight: 0.10, ideal: 20.0, worst: 45.0, min: 15.0, max: 30.0 },
        tds:         { label: 'TDS',          unit: 'mg/L',  weight: 0.15, ideal: 0.0,  worst: 2000.0,min:0,    max: 500  },
        nitrates:    { label: 'Nitrates',     unit: 'mg/L',  weight: 0.10, ideal: 0.0,  worst: 100.0,min: 0.0,  max: 10.0 },
        conductivity:{ label: 'Conductivity', unit: 'µS/cm', weight: 0.05, ideal: 300.0,worst: 3000.0,min:100,  max: 800  }
    };

    // ── WQI Calculation (Weighted Arithmetic Index) ────────────────
    function calculateSubIndex(param, value) {
        var cfg = PARAM_CONFIG[param];
        if (!cfg) return 0;
        var deviation   = Math.abs(value - cfg.ideal);
        var maxDev      = Math.abs(cfg.worst - cfg.ideal);
        return Math.min(100, maxDev > 0 ? (deviation / maxDev) * 100 : 0);
    }

    function calculateWQI(reading) {
        var weightedSum = 0;
        var totalWeight = 0;
        Object.keys(PARAM_CONFIG).forEach(function (param) {
            if (reading[param] !== undefined && !isNaN(reading[param])) {
                var qi     = calculateSubIndex(param, reading[param]);
                var weight = PARAM_CONFIG[param].weight;
                weightedSum += qi * weight;
                totalWeight += weight;
            }
        });
        return totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(2)) : 50;
    }

    // ── WQI Classification ─────────────────────────────────────────
    function classifyWQI(wqi) {
        if (wqi <= 25) return { label: 'Excellent',  cssClass: 'excellent',  color: '#22c55e', hex: '#22c55e', severity: 0 };
        if (wqi <= 50) return { label: 'Good',       cssClass: 'good',       color: '#4ade80', hex: '#4ade80', severity: 1 };
        if (wqi <= 75) return { label: 'Poor',       cssClass: 'poor',       color: '#f59e0b', hex: '#f59e0b', severity: 2 };
        if (wqi <= 100)return { label: 'Very Poor',  cssClass: 'very-poor',  color: '#ef4444', hex: '#ef4444', severity: 3 };
        return              { label: 'Critical',    cssClass: 'critical',   color: '#dc2626', hex: '#dc2626', severity: 4 };
    }

    // ── Fuzzy Rules Engine ─────────────────────────────────────────
    function evaluateFuzzyRules(reading) {
        var risks = {};

        // pH
        var ph = reading.ph;
        if      (ph < 5.0  || ph > 10.0) risks.ph = { level: 'CRITICAL', message: 'Extreme pH — aquatic life threatened' };
        else if (ph < 6.5  || ph > 8.5 ) risks.ph = { level: 'HIGH',     message: 'pH outside drinking water standard' };
        else if (ph < 6.8  || ph > 8.2 ) risks.ph = { level: 'MODERATE', message: 'pH slightly outside optimal range'   };
        else                              risks.ph = { level: 'LOW',      message: 'pH within safe range'               };

        // Dissolved Oxygen
        var doVal = reading.do;
        if      (doVal < 2.0) risks.do = { level: 'CRITICAL', message: 'Critically low O₂ — fish kill risk' };
        else if (doVal < 4.0) risks.do = { level: 'HIGH',     message: 'Low DO — aquatic stress detected'   };
        else if (doVal < 6.0) risks.do = { level: 'MODERATE', message: 'DO below optimal threshold'         };
        else                  risks.do = { level: 'LOW',      message: 'Adequate dissolved oxygen'          };

        // Turbidity
        var turb = reading.turbidity;
        if      (turb > 100) risks.turbidity = { level: 'CRITICAL', message: 'Very high turbidity — treatment required' };
        else if (turb > 25 ) risks.turbidity = { level: 'HIGH',     message: 'High turbidity — light penetration blocked' };
        else if (turb > 10 ) risks.turbidity = { level: 'MODERATE', message: 'Elevated turbidity'                      };
        else                 risks.turbidity = { level: 'LOW',      message: 'Clear water conditions'                   };

        // Temperature
        var temp = reading.temperature;
        if      (temp > 38 || temp < 5 ) risks.temperature = { level: 'CRITICAL', message: 'Extreme temperature — ecological risk'       };
        else if (temp > 32 || temp < 10) risks.temperature = { level: 'HIGH',     message: 'Temperature outside safe range'              };
        else if (temp > 28 || temp < 15) risks.temperature = { level: 'MODERATE', message: 'Elevated temperature'                        };
        else                             risks.temperature = { level: 'LOW',      message: 'Temperature within normal range'             };

        // TDS
        var tds = reading.tds;
        if      (tds > 1500) risks.tds = { level: 'CRITICAL', message: 'Extremely high total dissolved solids' };
        else if (tds > 500 ) risks.tds = { level: 'HIGH',     message: 'TDS exceeds drinking water limit'      };
        else if (tds > 300 ) risks.tds = { level: 'MODERATE', message: 'Elevated dissolved solids'             };
        else                 risks.tds = { level: 'LOW',      message: 'TDS within acceptable range'           };

        // Nitrates
        var nit = reading.nitrates;
        if      (nit > 50) risks.nitrates = { level: 'CRITICAL', message: 'Dangerous nitrates — health hazard'     };
        else if (nit > 10) risks.nitrates = { level: 'HIGH',     message: 'Nitrates exceed WHO guidelines (10mg/L)' };
        else if (nit > 5 ) risks.nitrates = { level: 'MODERATE', message: 'Elevated nitrate levels'                };
        else               risks.nitrates = { level: 'LOW',      message: 'Nitrates within safe limits'            };

        // Conductivity
        var cond = reading.conductivity;
        if      (cond > 2000) risks.conductivity = { level: 'CRITICAL', message: 'Very high conductivity — heavy pollution'    };
        else if (cond > 800 ) risks.conductivity = { level: 'HIGH',     message: 'Conductivity above recommended limit'         };
        else if (cond > 500 ) risks.conductivity = { level: 'MODERATE', message: 'Elevated conductivity'                       };
        else                  risks.conductivity = { level: 'LOW',      message: 'Normal conductivity levels'                  };

        return risks;
    }

    // ── Z-Score Anomaly Detection ──────────────────────────────────
    function detectAnomalies(droneId) {
        var params   = ['ph', 'do', 'turbidity', 'temperature', 'tds', 'nitrates', 'conductivity'];
        var anomalies= [];
        var history  = Store.getReadingHistory(droneId, 30);
        if (history.length < 8) return anomalies;

        params.forEach(function (param) {
            var values = history.map(function (r) { return r[param]; }).filter(function (v) { return v !== undefined && !isNaN(v); });
            if (values.length < 5) return;

            var n    = values.length;
            var mean = values.reduce(function (a, b) { return a + b; }, 0) / n;
            var variance = values.reduce(function (s, v) { return s + Math.pow(v - mean, 2); }, 0) / n;
            var std  = Math.sqrt(variance);
            if (std === 0) return;

            var latest = values[values.length - 1];
            var zScore = Math.abs((latest - mean) / std);

            if (zScore > 2.5) {
                anomalies.push({
                    param:     param,
                    label:     PARAM_CONFIG[param] ? PARAM_CONFIG[param].label : param,
                    value:     parseFloat(latest.toFixed(2)),
                    mean:      parseFloat(mean.toFixed(2)),
                    std:       parseFloat(std.toFixed(2)),
                    zScore:    parseFloat(zScore.toFixed(2)),
                    direction: latest > mean ? 'spike' : 'drop',
                    severity:  zScore > 3.5 ? 'CRITICAL' : 'HIGH'
                });
            }
        });

        return anomalies;
    }

    // ── Trend Analysis (Linear Regression on WQI) ──────────────────
    function calculateTrend(droneId) {
        var history = Store.getReadingHistory(droneId, 20);
        if (history.length < 5) return { direction: 'stable', slope: 0, label: '→ Stable', color: '#94a3b8' };

        var pts = history.map(function (r, i) { return { x: i, y: (r.wqi || 50) }; });
        var n   = pts.length;
        var sx  = pts.reduce(function (s, p) { return s + p.x; }, 0);
        var sy  = pts.reduce(function (s, p) { return s + p.y; }, 0);
        var sxy = pts.reduce(function (s, p) { return s + p.x * p.y; }, 0);
        var sxx = pts.reduce(function (s, p) { return s + p.x * p.x; }, 0);
        var denom = (n * sxx - sx * sx);
        var slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;

        if (slope >  0.5) return { direction: 'degrading',  slope: slope, label: '↑ Degrading',  color: '#ef4444' };
        if (slope < -0.5) return { direction: 'improving',  slope: slope, label: '↓ Improving',  color: '#22c55e' };
        return                   { direction: 'stable',     slope: slope, label: '→ Stable',     color: '#94a3b8' };
    }

    // ── Plain-English AI Report Generator ─────────────────────────
    function generateReport(droneId) {
        var reading = Store.getLatestReading(droneId);
        if (!reading) return 'No sensor data available yet. Waiting for the simulation engine to generate readings...';

        var drone   = SimulationEngine.DRONES.find(function (d) { return d.id === droneId; });
        var wqi     = reading.wqi || calculateWQI(reading);
        var cls     = classifyWQI(wqi);
        var risks   = evaluateFuzzyRules(reading);
        var trend   = calculateTrend(droneId);
        var anomalies = detectAnomalies(droneId);

        var criticalParams = Object.keys(risks).filter(function (k) { return risks[k].level === 'CRITICAL'; });
        var highParams     = Object.keys(risks).filter(function (k) { return risks[k].level === 'HIGH';     });

        var name = drone ? drone.name + ', ' + drone.location : droneId;
        var report = '🔬 <strong>AI Assessment — ' + name + '</strong><br><br>';

        report += 'The water body is currently classified as <strong>' + cls.label + '</strong> with an overall WQI of <strong>' + wqi.toFixed(1) + '</strong>. ';

        if (criticalParams.length > 0) {
            report += '⚠️ <strong>Critical intervention required</strong> — the following parameters are at dangerous levels: <strong>' + criticalParams.map(function(p){ return PARAM_CONFIG[p] ? PARAM_CONFIG[p].label : p; }).join(', ') + '</strong>. ';
        } else if (highParams.length > 0) {
            report += '⚡ Elevated readings detected in: <strong>' + highParams.map(function(p){ return PARAM_CONFIG[p] ? PARAM_CONFIG[p].label : p; }).join(', ') + '</strong>. Monitoring is advised. ';
        } else {
            report += '✅ All parameters are within acceptable limits. ';
        }

        report += '<br><br>📈 <strong>Trend:</strong> ';
        if (trend.direction === 'degrading') {
            report += 'The WQI trend is <strong style="color:#ef4444">deteriorating</strong> over the recent monitoring window. Immediate inspection of the water body is recommended.';
        } else if (trend.direction === 'improving') {
            report += 'The WQI trend shows <strong style="color:#22c55e">improvement</strong> over recent readings. Continue standard monitoring protocols.';
        } else {
            report += 'Conditions are <strong>stable</strong> with no significant trend. Regular monitoring should continue.';
        }

        if (anomalies.length > 0) {
            report += '<br><br>🚨 <strong>Anomaly Alert:</strong> ' + anomalies.length + ' statistical anomaly/anomalies detected (Z-score &gt; 2.5). ';
            report += 'Parameters: <strong>' + anomalies.map(function(a){ return a.label; }).join(', ') + '</strong>. This may indicate a contamination event or sensor malfunction.';
        }

        return report;
    }

    // ── Threshold Alert Checks ─────────────────────────────────────
    var _lastAlertTime = {};

    function checkThresholds(drone, reading) {
        var thresholds = Store.getState().thresholds;
        var now        = Date.now();
        var cooldown   = 90000; // 90 seconds per param per drone

        var checks = [
            { param: 'ph',          value: reading.ph,          label: 'pH'          },
            { param: 'do',          value: reading.do,          label: 'Dissolved O₂'},
            { param: 'turbidity',   value: reading.turbidity,   label: 'Turbidity'   },
            { param: 'temperature', value: reading.temperature, label: 'Temperature' },
            { param: 'tds',         value: reading.tds,         label: 'TDS'         },
            { param: 'nitrates',    value: reading.nitrates,    label: 'Nitrates'    }
        ];

        checks.forEach(function (chk) {
            if (chk.value === undefined || isNaN(chk.value)) return;
            var thresh = thresholds[chk.param];
            if (!thresh) return;

            var key = drone.id + '_' + chk.param;
            if (now - (_lastAlertTime[key] || 0) < cooldown) return;

            var violated = false;
            var msg      = '';
            var severity = 'warning';

            if (chk.value < thresh.min) {
                violated = true;
                msg      = chk.label + ' is ' + chk.value.toFixed(2) + ' (below min ' + thresh.min + ')';
                severity = chk.value < thresh.min * 0.6 ? 'critical' : 'warning';
            } else if (chk.value > thresh.max) {
                violated = true;
                msg      = chk.label + ' is ' + chk.value.toFixed(2) + ' (above max ' + thresh.max + ')';
                severity = chk.value > thresh.max * 1.5 ? 'critical' : 'warning';
            }

            if (violated) {
                _lastAlertTime[key] = now;
                Store.addAlert({
                    droneId:   drone.id,
                    location:  drone.name,
                    parameter: chk.param,
                    message:   msg,
                    severity:  severity,
                    value:     chk.value
                });
            }
        });
    }

    function checkAndGenerateAlert(drone, reading, wqi, cls) {
        var key      = 'anomaly_' + drone.id;
        var cooldown = 45000;
        var now      = Date.now();
        if (now - (_lastAlertTime[key] || 0) < cooldown) return;
        _lastAlertTime[key] = now;

        var paramLabel = reading.anomalyParam ? (PARAM_CONFIG[reading.anomalyParam] ? PARAM_CONFIG[reading.anomalyParam].label : reading.anomalyParam) : 'Unknown';

        Store.addAlert({
            droneId:   drone.id,
            location:  drone.name,
            parameter: reading.anomalyParam || 'unknown',
            message:   'Anomaly detected in ' + paramLabel + ' — WQI: ' + wqi.toFixed(1) + ' (' + cls.label + ')',
            severity:  cls.severity >= 3 ? 'critical' : 'warning',
            value:     reading.anomalyParam ? reading[reading.anomalyParam] : null
        });
    }

    // ── Public API ─────────────────────────────────────────────────
    return {
        PARAM_CONFIG:            PARAM_CONFIG,
        calculateSubIndex:       calculateSubIndex,
        calculateWQI:            calculateWQI,
        classifyWQI:             classifyWQI,
        evaluateFuzzyRules:      evaluateFuzzyRules,
        detectAnomalies:         detectAnomalies,
        calculateTrend:          calculateTrend,
        generateReport:          generateReport,
        checkThresholds:         checkThresholds,
        checkAndGenerateAlert:   checkAndGenerateAlert
    };
})();
