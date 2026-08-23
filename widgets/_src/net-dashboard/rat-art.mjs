const urls = [
  'https://speed.cloudflare.com/__down?bytes=1',
  'https://api.open-meteo.com/v1/forecast?latitude=33.45&longitude=-112.07&current=temperature_2m',
  'https://api.coingecko.com/api/v3/ping',
];

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < String(value).length; i += 1) {
    hash ^= String(value).charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const variants = [
  { name: '120-min', slot: 'M_H', mode: 'window120' },
];

export async function prepare(page) {
  await page.addInitScript(({ fixtureUrls }) => {
    globalThis.uniqueId = 'rat-art-net-dashboard';
    globalThis.probeHosts = fixtureUrls.join('\n');
    globalThis.probeInterval = 60;
    globalThis.warnAt = 100;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#07090D';
    globalThis.tr = async value => value;

    function hashUrl(value) {
      let hash = 0x811c9dc5;
      const text = String(value || '').trim();
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    }

    const prefix = 'rat-art-net-dashboard:net-dashboard:';
    const now = Date.now();
    try {
      localStorage.clear();
      const primaryHash = hashUrl(fixtureUrls[0]);
      const history = [];
      for (let i = 0; i < 156; i += 1) {
        const t = now - (155 - i) * 10000;
        const failed = i === 37 || i === 94 || i === 129;
        let ms = 31 + Math.sin(i * 0.37) * 7 + Math.cos(i * 0.11) * 3;
        if (i === 118) ms = 238;
        history.push({ t, ok: !failed, ms: failed ? null : Math.max(12, ms), counted: true });
      }
      localStorage.setItem(prefix + 'history:' + primaryHash, JSON.stringify(history));

      const readings = [
        { ms: 32, failed: false },
        { ms: 76, failed: false },
        { ms: 138, failed: false },
      ];
      fixtureUrls.forEach((url, index) => {
        localStorage.setItem(prefix + 'host:' + hashUrl(url), JSON.stringify({
          verified: true,
          lastMs: readings[index].ms,
          lastOkAt: now - (index + 1) * 9000,
          lastAttemptAt: now - (index + 1) * 9000,
          failed: readings[index].failed,
        }));
      });
      localStorage.setItem(prefix + 'speed-result', JSON.stringify({
        down: 842.4,
        up: 116.7,
        at: now - 7 * 60 * 1000,
      }));
    } catch {}

    const nativeFetch = globalThis.fetch?.bind(globalThis);
    globalThis.fetch = async input => {
      const value = String(typeof input === 'string' ? input : input?.url || '');
      let delay = 18;
      if (value.includes('open-meteo.com')) delay = 48;
      if (value.includes('coingecko.com')) delay = 84;
      await new Promise(resolve => setTimeout(resolve, delay));
      if (typeof Response !== 'undefined') return new Response('ok', { status: 200 });
      if (nativeFetch) return nativeFetch(input);
      return { ok: true, status: 200, body: { cancel() {} } };
    };
  }, { fixtureUrls: urls });
}

export async function ready(page, context) {
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('.host-row').length;
    const ping = document.getElementById('pingValue')?.textContent?.trim();
    const down = document.getElementById('downValue')?.textContent?.trim();
    return rows >= 3 && ping && ping !== '--' && down && down !== '--';
  }, { timeout: 10000 });

  if (context.variant?.mode === 'window120') {
    await page.locator('#ribbonPanel').click();
    await page.waitForFunction(
      () => document.getElementById('windowBadge')?.textContent?.trim() === '120 MIN',
      { timeout: 3000 },
    );
  }
  await page.waitForTimeout(250);
}

export async function assert(page, context) {
  const expectedSlot = context.slot.toLowerCase().replace('_', '-');
  const report = await page.evaluate(() => ({
    slot: document.body.getAttribute('data-slot'),
    state: document.body.getAttribute('data-state'),
    hosts: document.querySelectorAll('.host-row').length,
    ping: document.getElementById('pingValue')?.textContent?.trim() || '',
    jitter: document.getElementById('jitterValue')?.textContent?.trim() || '',
    loss: document.getElementById('lossValue')?.textContent?.trim() || '',
    down: document.getElementById('downValue')?.textContent?.trim() || '',
    up: document.getElementById('upValue')?.textContent?.trim() || '',
    window: document.getElementById('windowBadge')?.textContent?.trim() || '',
    canvas: (() => {
      const canvas = document.getElementById('latencyRibbon');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    })(),
  }));

  if (report.slot !== expectedSlot) throw new Error(`Network slot mismatch: ${JSON.stringify(report)}`);
  if (!['live', 'degraded'].includes(report.state)) throw new Error(`Network fixture state mismatch: ${JSON.stringify(report)}`);
  if (report.hosts !== 3) throw new Error(`Network host count mismatch: ${JSON.stringify(report)}`);
  if (report.ping === '--' || report.jitter === '--' || report.loss === '--') throw new Error(`Network hero metrics missing: ${JSON.stringify(report)}`);
  if (!(Number(report.loss) > 0)) throw new Error(`Network fixture must show visible probe loss: ${JSON.stringify(report)}`);
  if (report.down === '--' || report.up === '--') throw new Error(`Network speed fixture missing: ${JSON.stringify(report)}`);
  if (!report.canvas || report.canvas.width <= 0 || report.canvas.height <= 0) throw new Error(`Network ribbon canvas missing: ${JSON.stringify(report)}`);
  if (context.variant?.mode === 'window120' && report.window !== '120 MIN') {
    throw new Error(`Network 120 minute variant failed: ${JSON.stringify(report)}`);
  }
}

export { fnv1a };
