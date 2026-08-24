import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'network.js'), 'utf8');
const sandbox = {
  console,
  URL,
  Blob,
  Uint8Array,
  AbortController,
  performance,
  setTimeout,
  clearTimeout,
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'network.js' });
const api = sandbox.__netDashboardTest;
if (!api) throw new Error('test API missing');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
}

const base = 1_000_000;
const samples = [
  { t: base + 1000, ok: true, ms: 20, counted: true },
  { t: base + 2000, ok: true, ms: 30, counted: true },
  { t: base + 3000, ok: false, ms: null, counted: true },
  { t: base + 4000, ok: true, ms: 50, counted: true },
  { t: base + 5000, ok: true, ms: 55, counted: true },
];
const metrics = api.computeMetrics(samples, base);
assert(metrics.attempts === 5, 'attempt count');
assert(metrics.failures === 1, 'failure count');
near(metrics.loss, 20, 0.0001, 'loss percentage');
near(metrics.jitter, 7.5, 0.0001, 'jitter must not bridge loss');
assert(metrics.current === 55, 'current ping');
assert(metrics.adjacentPairs === 2, 'adjacent pair count');

const latestFailure = api.computeMetrics(samples.concat([{ t: base + 6000, ok: false, ms: null, counted: true }]), base);
assert(latestFailure.current === null, 'latest failure must blank current ping');
assert(latestFailure.latestFailed === true, 'latest failure flag');

assert(api.sampleState({ ok: false, counted: false }) === 'unobserved', 'pre verification failure must be unobserved');
assert(api.sampleState({ ok: false, counted: true }) === 'loss', 'verified failure must be loss');
assert(api.sampleState({ ok: true, counted: true }) === 'success', 'success state');

const hosts = api.parseHosts('https://example.com/path?token=secret\nhttp://unsafe.test\nhttps://example.org/a');
assert(hosts.length === 2, 'only HTTPS hosts accepted');
assert(!hosts[0].hash.includes('secret'), 'hash must not contain query credential');
assert(hosts[0].hash.length === 8, 'fixed hash width');

near(api.mbps(25_000_000, 2000), 100, 0.0001, 'Mbps conversion');

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new Uint8Array(3));
    controller.enqueue(new Uint8Array(5));
    controller.close();
  }
});
const response = new Response(stream, { status: 200 });
let progressCalls = 0;
const bytes = await api.readDownloadBody(response, () => { progressCalls += 1; }, 8);
assert(bytes === 8, 'streaming byte count');
assert(progressCalls >= 1, 'download progress callback');

let yields = 0;
const upload = await api.buildUploadBody(5 * 1024 * 1024, 1024 * 1024, async () => { yields += 1; });
assert(upload.size === 5 * 1024 * 1024, 'upload body exact size');
assert(yields >= 1, 'upload preparation must yield');

const buckets = api.visualBuckets([
  { t: 100, ok: true, ms: 20, counted: true },
  { t: 200, ok: false, counted: true },
  { t: 300, ok: false, counted: false },
], 0, 400, 40);
assert(buckets.some(b => b.success.length), 'success must enter visual buckets');
assert(buckets.some(b => b.hasLoss), 'loss must enter visual buckets');
const observedCount = buckets.filter(b => b.hasObserved).length;
assert(observedCount === 2, 'unobserved sample must not look observed');

assert(source.includes('response.body') && source.includes('getReader'), 'download must use streaming reader');
assert(source.includes('buildUploadBody(SPEED_BYTES, 1048576'), 'upload must be chunk prepared');
assert(source.includes('netState.pausedForSpeed = true'), 'speed test must pause probes');
assert(source.includes('netState.pausedForSpeed = false'), 'speed test must resume probes');
assert(!source.includes('localStorage.setItem(host.url'), 'full URL must not be localStorage key');

console.log('NET DASHBOARD VERIFY PASS');
