const assert = require('node:assert/strict');
const math = require('./power-math.js');

function close(actual, expected, epsilon = 1e-9, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: expected ${expected}, got ${actual}`);
}

// Units and zero are real readings, not missing values.
assert.equal(math.parseWatts('412.5', 'W'), 412.5);
assert.equal(math.parseWatts('0', 'W'), 0);
assert.equal(math.parseWatts('1.25', 'kW'), 1250);
assert.equal(math.parseWatts('750', 'mW'), 0.75);
assert.equal(math.parseWatts('-5', 'W'), null);
assert.equal(math.parseWatts('42', ''), null);

// Constant 100 W for one hour = exactly 100 Wh.
let result = math.integrateInterval({ t: 0, w: 100 }, { t: 3600000, w: 100 });
assert.equal(result.valid, true);
close(result.wh, 100, 1e-12, 'constant 100 W');

// Linear 0 -> 100 W over one hour uses trapezoidal integration = 50 Wh.
result = math.integrateInterval({ t: 0, w: 0 }, { t: 3600000, w: 100 });
close(result.wh, 50, 1e-12, 'linear ramp');

// Irregular sample intervals must use elapsed time, never an assumed sample rate.
let summary = math.summarizeSamples([
  { t: 0, w: 100 },
  { t: 10 * 60 * 1000, w: 200 },
  { t: 25 * 60 * 1000, w: 50 },
], 20 * 60 * 1000);
close(summary.wh, 56.25, 1e-12, 'irregular samples');
close(summary.averageW, 135, 1e-12, 'time weighted average');
assert.equal(summary.peakW, 200);
assert.equal(summary.validIntervals, 2);

// Duplicate/out-of-order timestamps never create phantom energy.
result = math.integrateInterval({ t: 1000, w: 500 }, { t: 1000, w: 500 }, 5000);
assert.equal(result.valid, false);
assert.equal(result.wh, 0);

// A telemetry gap is not filled with stale power.
result = math.integrateInterval({ t: 0, w: 400 }, { t: 6000, w: 400 }, 5000);
assert.equal(result.valid, false);
assert.equal(result.reason, 'gap');
assert.equal(result.wh, 0);

// Splitting an interval at a daily boundary preserves total energy exactly.
const pieces = math.splitLinearInterval(
  { t: 0, w: 100 },
  { t: 3600000, w: 300 },
  [1800000],
  3600001,
);
assert.equal(pieces.length, 2);
close(pieces[0].wh, 75, 1e-12, 'first half');
close(pieces[1].wh, 125, 1e-12, 'second half');
close(pieces.reduce((sum, piece) => sum + piece.wh, 0), 200, 1e-12, 'split total');

// Cost is always energy in kWh multiplied by the configured rate.
close(math.costForEnergy(840, 0.15), 0.126, 1e-12, 'energy cost');
assert.equal(math.costForEnergy(840, -1), null);

// Long sessions retain precision without assuming one sample per second.
summary = math.summarizeSamples([
  { t: 0, w: 250 },
  { t: 7 * 3600000, w: 250 },
], 8 * 3600000);
close(summary.wh, 1750, 1e-12, 'long session');
close(summary.averageW, 250, 1e-12, 'long average');

// Very high but valid PC/bench power values remain representable.
summary = math.summarizeSamples([
  { t: 0, w: 12500 },
  { t: 60000, w: 12500 },
], 61000);
close(summary.wh, 208.33333333333334, 1e-9, 'high power');
assert.equal(summary.peakW, 12500);

assert.deepEqual(math.formatEnergy(840), { value: '840', unit: 'Wh' });
assert.deepEqual(math.formatEnergy(1840), { value: '1.84', unit: 'kWh' });

console.log('PC POWER MATH TEST PASS');
