(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PackRatPowerMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var HOUR_MS = 3600000;

  function finiteNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseNumeric(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    var match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? finiteNumber(match[0]) : null;
  }

  function wattsScale(units) {
    var unit = String(units == null ? "" : units).trim().toLowerCase().replace(/\s+/g, "");
    if (/^(w|watt|watts)$/.test(unit)) return 1;
    if (/^(kw|kilowatt|kilowatts)$/.test(unit)) return 1000;
    if (/^(mw|milliwatt|milliwatts)$/.test(unit)) return 0.001;
    return null;
  }

  function parseWatts(value, units) {
    var number = parseNumeric(value);
    var scale = wattsScale(units);
    if (number === null || scale === null) return null;
    var watts = number * scale;
    return Number.isFinite(watts) && watts >= 0 ? watts : null;
  }

  function validSample(sample) {
    return !!sample && Number.isFinite(Number(sample.t)) && Number.isFinite(Number(sample.w)) && Number(sample.w) >= 0;
  }

  function integrateInterval(previous, current, maxGapMs) {
    if (!validSample(previous) || !validSample(current)) {
      return { valid: false, reason: "invalid-sample", wh: 0, ms: 0 };
    }
    var dt = Number(current.t) - Number(previous.t);
    if (!(dt > 0)) return { valid: false, reason: "non-positive-time", wh: 0, ms: 0 };
    if (Number.isFinite(Number(maxGapMs)) && Number(maxGapMs) > 0 && dt > Number(maxGapMs)) {
      return { valid: false, reason: "gap", wh: 0, ms: 0 };
    }
    var averageW = (Number(previous.w) + Number(current.w)) / 2;
    return {
      valid: true,
      reason: "ok",
      wh: averageW * dt / HOUR_MS,
      ms: dt,
      averageW: averageW
    };
  }

  function interpolatePower(previous, current, timestamp) {
    var t0 = Number(previous.t);
    var t1 = Number(current.t);
    if (!(t1 > t0)) return Number(current.w);
    var ratio = (Number(timestamp) - t0) / (t1 - t0);
    return Number(previous.w) + (Number(current.w) - Number(previous.w)) * ratio;
  }

  function splitLinearInterval(previous, current, boundaries, maxGapMs) {
    var whole = integrateInterval(previous, current, maxGapMs);
    if (!whole.valid) return [];
    var t0 = Number(previous.t);
    var t1 = Number(current.t);
    var cuts = (Array.isArray(boundaries) ? boundaries : [])
      .map(Number)
      .filter(function (value) { return Number.isFinite(value) && value > t0 && value < t1; })
      .sort(function (a, b) { return a - b; });
    var unique = [];
    cuts.forEach(function (value) {
      if (!unique.length || unique[unique.length - 1] !== value) unique.push(value);
    });
    var points = [t0].concat(unique, [t1]);
    var pieces = [];
    for (var i = 0; i < points.length - 1; i += 1) {
      var aT = points[i];
      var bT = points[i + 1];
      var a = { t: aT, w: interpolatePower(previous, current, aT) };
      var b = { t: bT, w: interpolatePower(previous, current, bT) };
      var piece = integrateInterval(a, b, null);
      pieces.push({
        t0: aT,
        t1: bT,
        w0: a.w,
        w1: b.w,
        wh: piece.wh,
        ms: piece.ms
      });
    }
    return pieces;
  }

  function averageWatts(energyWh, measuredMs) {
    var wh = finiteNumber(energyWh);
    var ms = finiteNumber(measuredMs);
    if (wh === null || ms === null || ms <= 0) return null;
    return wh / (ms / HOUR_MS);
  }

  function costForEnergy(energyWh, ratePerKwh) {
    var wh = finiteNumber(energyWh);
    var rate = finiteNumber(ratePerKwh);
    if (wh === null || rate === null || wh < 0 || rate < 0) return null;
    return (wh / 1000) * rate;
  }

  function formatWatts(value) {
    var watts = finiteNumber(value);
    if (watts === null || watts < 0) return "—";
    if (watts >= 10000) return Math.round(watts).toLocaleString("en-US");
    if (watts >= 1000) return watts.toFixed(0);
    if (watts >= 100) return watts.toFixed(0);
    if (watts >= 10) return watts.toFixed(1);
    return watts.toFixed(2);
  }

  function formatEnergy(energyWh) {
    var wh = finiteNumber(energyWh);
    if (wh === null || wh < 0) return { value: "—", unit: "Wh" };
    if (wh >= 1000) return { value: (wh / 1000).toFixed(2), unit: "kWh" };
    if (wh >= 100) return { value: wh.toFixed(0), unit: "Wh" };
    if (wh >= 10) return { value: wh.toFixed(1), unit: "Wh" };
    return { value: wh.toFixed(2), unit: "Wh" };
  }

  function summarizeSamples(samples, maxGapMs) {
    var valid = (Array.isArray(samples) ? samples : []).filter(validSample).map(function (sample) {
      return { t: Number(sample.t), w: Number(sample.w) };
    });
    if (!valid.length) return { wh: 0, measuredMs: 0, averageW: null, peakW: null, validIntervals: 0 };
    var wh = 0;
    var measuredMs = 0;
    var intervals = 0;
    var peakW = valid.reduce(function (peak, sample) { return Math.max(peak, sample.w); }, 0);
    for (var i = 1; i < valid.length; i += 1) {
      var interval = integrateInterval(valid[i - 1], valid[i], maxGapMs);
      if (!interval.valid) continue;
      wh += interval.wh;
      measuredMs += interval.ms;
      intervals += 1;
    }
    return {
      wh: wh,
      measuredMs: measuredMs,
      averageW: averageWatts(wh, measuredMs),
      peakW: peakW,
      validIntervals: intervals
    };
  }

  return {
    HOUR_MS: HOUR_MS,
    parseNumeric: parseNumeric,
    parseWatts: parseWatts,
    integrateInterval: integrateInterval,
    splitLinearInterval: splitLinearInterval,
    averageWatts: averageWatts,
    costForEnergy: costForEnergy,
    formatWatts: formatWatts,
    formatEnergy: formatEnergy,
    summarizeSamples: summarizeSamples
  };
});
