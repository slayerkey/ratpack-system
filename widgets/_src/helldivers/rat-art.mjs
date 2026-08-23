const FIXED_NOW = Date.parse('2026-08-22T20:00:00Z');
const iso = (hours) => new Date(FIXED_NOW + hours * 3600_000).toISOString();

const campaigns = [
  {
    id: 201,
    faction: 'Automaton',
    planet: {
      index: 202,
      name: 'Vernen Wells',
      sector: 'Hydra',
      health: 1000000,
      maxHealth: 1000000,
      regenPerSecond: 0,
      currentOwner: 'Humans',
      biome: { name: 'Highlands' },
      hazards: [{ name: 'Ion Storms' }],
      statistics: { playerCount: 12482 },
      regions: [],
      event: {
        id: 7001,
        faction: 'Automaton',
        health: 710000,
        maxHealth: 1000000,
        startTime: iso(-2),
        endTime: iso(4),
        campaignId: 201,
      },
    },
  },
  {
    id: 202,
    faction: 'Terminids',
    planet: {
      index: 101,
      name: 'Gacrux',
      sector: 'Jin Xi',
      health: 163000,
      maxHealth: 1000000,
      regenPerSecond: 100,
      currentOwner: 'Terminids',
      biome: { name: 'Jungle' },
      hazards: [{ name: 'Acid Storms' }],
      statistics: { playerCount: 9200 },
      regions: [],
    },
  },
  {
    id: 203,
    faction: 'Illuminate',
    planet: {
      index: 303,
      name: 'Genesis Prime',
      sector: 'Orion',
      health: 1000000,
      maxHealth: 1000000,
      regenPerSecond: 25,
      currentOwner: 'Illuminate',
      biome: { name: 'Mesa' },
      hazards: [{ name: 'Meteor Storms' }],
      statistics: { playerCount: 4910 },
      regions: [
        {
          name: 'Prosperity City',
          health: 520000,
          maxHealth: 1000000,
          isAvailable: true,
          players: 4100,
        },
      ],
    },
  },
  {
    id: 204,
    faction: 'Automaton',
    planet: {
      index: 404,
      name: 'Menkent',
      sector: 'Hydra',
      health: 1000000,
      maxHealth: 1000000,
      regenPerSecond: 60,
      currentOwner: 'Automaton',
      biome: { name: 'Desert' },
      hazards: [{ name: 'Fire Tornadoes' }],
      statistics: { playerCount: 2200 },
      regions: [],
    },
  },
];

const assignment = {
  id: 9001,
  title: 'Defend democracy across the galactic perimeter',
  briefing: 'Deploy Helldivers to the priority fronts. Hold the defense, liberate the marked world, and eradicate enemy forces before the order expires.',
  progress: [0, 0, 1250000],
  tasks: [
    { type: 12, values: [202], valueTypes: [12] },
    { type: 11, values: [101], valueTypes: [12] },
    { type: 3, values: [2000000], valueTypes: [3] },
  ],
  expiration: iso(31),
};

const responses = {
  '/api/v1/war': {
    now: new Date(FIXED_NOW).toISOString(),
    factions: ['Humans', 'Terminids', 'Automaton', 'Illuminate'],
    statistics: { playerCount: 34821 },
  },
  '/api/v1/campaigns': campaigns,
  '/api/v1/assignments': [assignment],
  '/api/v1/planets': campaigns.map((campaign) => campaign.planet),
};

export const variants = [
  { name: 'objectives', slot: 'M_H', mode: 'objectives' },
  { name: 'planet', slot: 'M_H', mode: 'planet' },
];

export async function prepare(page) {
  await page.addInitScript(({ fixedNow }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }
      static now() {
        return fixedNow;
      }
    }
    FixedDate.parse = NativeDate.parse;
    FixedDate.UTC = NativeDate.UTC;
    globalThis.Date = FixedDate;

    globalThis.uniqueId = 'rat-art-helldivers';
    globalThis.refreshMinutes = 1;
    globalThis.showTicker = true;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#05080C';
    globalThis.tr = async (value) => value;
    try { localStorage.clear(); } catch {}
  }, { fixedNow: FIXED_NOW });

  await page.route('https://api.helldivers2.dev/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'X-Super-Client, X-Super-Contact',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
      return;
    }

    const headers = request.headers();
    if (
      headers['x-super-client'] !== 'packrat-xeneon'
      || headers['x-super-contact'] !== 'slayerkey+ondiscord@gmail.com'
    ) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Rat Art fixture rejected API headers' }),
      });
      return;
    }

    const url = new URL(request.url());
    const payload = responses[url.pathname];
    if (!payload) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '{}',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(payload),
    });
  });
}

export async function ready(page, context) {
  await page.waitForFunction(
    () => document.body.getAttribute('data-connection') === 'live',
    { timeout: 10000 },
  );

  if (context.variant?.mode === 'objectives') {
    await page.locator('#majorOrder').click();
    await page.waitForFunction(
      () => document.body.getAttribute('data-order-mode') === 'objectives',
      { timeout: 3000 },
    );
  } else if (context.variant?.mode === 'planet') {
    await page.locator('.campaign-card').first().click();
    await page.locator('#campaignDetail').waitFor({ state: 'visible', timeout: 3000 });
  }
  await page.waitForTimeout(200);
}

export async function assert(page, context) {
  const expectedSlot = context.slot.toLowerCase().replace('_', '-');
  const report = await page.evaluate(() => ({
    connection: document.body.getAttribute('data-connection'),
    slot: document.body.getAttribute('data-slot'),
    cards: document.querySelectorAll('.campaign-card').length,
    orderTitle: document.getElementById('orderTitle')?.textContent || '',
    detailVisible: (() => {
      const el = document.getElementById('campaignDetail');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })(),
  }));

  if (report.connection !== 'live') {
    throw new Error(`Helldivers fixture did not reach live state: ${JSON.stringify(report)}`);
  }
  if (report.slot !== expectedSlot) {
    throw new Error(`Helldivers slot mismatch: expected ${expectedSlot}, got ${report.slot}`);
  }
  if (report.cards !== 4) {
    throw new Error(`Helldivers fixture expected four campaigns: ${JSON.stringify(report)}`);
  }
  if (!report.orderTitle.includes('Defend democracy')) {
    throw new Error(`Helldivers Major Order did not render: ${JSON.stringify(report)}`);
  }
  if (context.variant?.mode === 'planet' && !report.detailVisible) {
    throw new Error(`Helldivers planet detail did not render: ${JSON.stringify(report)}`);
  }
}
