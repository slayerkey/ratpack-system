export const variants = [
  { name: 'muted', slot: 'M_H', mute: true, deaf: false },
  { name: 'deafened', slot: 'M_H', mute: true, deaf: true },
];

function voiceFor(context) {
  return {
    mute: Boolean(context.variant?.mute),
    deaf: Boolean(context.variant?.deaf),
  };
}

export async function prepare(page, context) {
  const voice = voiceFor(context);
  await page.addInitScript(({ voice }) => {
    globalThis.uniqueId = 'rat-art-discord-panel';
    globalThis.showRecentActivity = true;
    globalThis.textColor = '#F4F6F8';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#090B10';
    globalThis.tr = async (value) => value;
    globalThis.icueEvents = {};

    const names = [
      ['1001', 'Slayerkey', 'slayerkey'],
      ['1002', 'Nova', 'nova'],
      ['1003', 'Mello', 'mello'],
      ['1004', 'Avery', 'avery'],
      ['1005', 'Mika', 'mika'],
      ['1006', 'Riven', 'riven'],
      ['1007', 'Kairo', 'kairo'],
      ['1008', 'Luna', 'luna'],
    ];

    const members = names.map(([id, nick, username], index) => ({
      nick,
      mute: false,
      volume: 100,
      pan: { left: 1, right: 1 },
      voice_state: {
        mute: false,
        deaf: false,
        self_mute: index === 4,
        self_deaf: false,
        suppress: false,
      },
      user: {
        id,
        username,
        discriminator: '0',
        global_name: nick,
        avatar: null,
        bot: false,
        flags: 0,
        premium_type: 0,
      },
    }));

    globalThis.__PACKRAT_DISCORD_FIXTURE__ = {
      user: { id: '1001', username: 'slayerkey', global_name: 'Slayerkey' },
      voice,
      channel: {
        id: '555000000000000001',
        guild_id: '555000000000000000',
        name: 'Ranked Squad',
        type: 2,
        voice_states: members,
      },
      speaking: ['1002', '1006'],
      activity: [
        { name: 'Nova', at: Date.now() - 600 },
        { name: 'Riven', at: Date.now() - 4200 },
        { name: 'Mello', at: Date.now() - 11000 },
      ],
    };
  }, { voice });
}

export async function ready(page) {
  await page.waitForFunction(() => (
    Boolean(globalThis.__PACKRAT_DISCORD_TEST__)
    && document.body.getAttribute('data-state') === 'voice'
    && document.getElementById('channelName')?.textContent === 'Ranked Squad'
    && document.querySelectorAll('.member-row').length === 8
  ), { timeout: 10000 });
  await page.waitForTimeout(350);
}

export async function assert(page, context) {
  const expected = voiceFor(context);
  const state = await page.evaluate(() => globalThis.__PACKRAT_DISCORD_TEST__.getState());
  if (state.state !== 'voice' || state.channel?.name !== 'Ranked Squad' || state.members.length !== 8) {
    throw new Error(`Discord Panel Rat Art fixture failed: ${JSON.stringify(state)}`);
  }
  if (state.voice.mute !== expected.mute || state.voice.deaf !== expected.deaf) {
    throw new Error(`Discord Panel Rat Art voice state mismatch: ${JSON.stringify({ expected, actual: state.voice })}`);
  }
  const speaking = state.members.filter((member) => member.speaking).length;
  if (speaking < 2) throw new Error(`Discord Panel Rat Art expected active speakers: ${speaking}`);
}
