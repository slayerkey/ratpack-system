export async function prepare(page) {
  await page.addInitScript(() => {
    globalThis.uniqueId = 'rat-art';
    globalThis.obsPort = '4455';
    globalThis.obsPassword = '';
    globalThis.textColor = '#F2F5F7';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#0B0E11';
    globalThis.tr = async (value) => value;
    globalThis.__PACKRAT_OBS_FIXTURE__ = {
      stream: {
        outputActive: true,
        outputReconnecting: false,
        outputTimecode: '00:42:18.000',
        outputDuration: 2538000,
        outputCongestion: 0.02,
        outputBytes: 118000000,
        outputSkippedFrames: 12,
        outputTotalFrames: 151000
      },
      record: {
        outputActive: true,
        outputPaused: false,
        outputTimecode: '00:18:42.000',
        outputDuration: 1122000,
        outputBytes: 3200000000
      },
      stats: {
        availableDiskSpace: 482304,
        outputSkippedFrames: 8,
        outputTotalFrames: 151000,
        renderSkippedFrames: 3,
        renderTotalFrames: 151000
      },
      bitrate: 6128,
      bitrateHistory: [5980,6015,6002,6044,6060,6082,6055,6100,6070,6114,6092,6120,6088,6135,6105,6148,6110,6096,6152,6125,6118,6160,6132,6108,6145,6172,6124,6140,6180,6155,6130,6170,6144,6190,6168,6150,6182,6148,6176,6200,6162,6188,6210,6174,6195,6168,6204,6220,6186,6214,6198,6225,6202,6238,6210,6192,6228,6240,6218,6128],
      scenes: [
        { sceneName: 'Gameplay' },
        { sceneName: 'Just Chatting' },
        { sceneName: 'Starting Soon' },
        { sceneName: 'BRB' },
        { sceneName: 'Ending' }
      ],
      currentScene: 'Gameplay'
    };
  });
}

export async function ready(page) {
  await page.waitForFunction(() => (
    document.body.getAttribute('data-connection') === 'connected'
    && document.getElementById('activeScene')?.textContent === 'Gameplay'
    && Number(document.getElementById('bitrateValue')?.textContent || 0) > 0
  ), { timeout: 10000 });
  await page.waitForTimeout(350);
}

export async function assert(page) {
  const state = await page.evaluate(() => ({
    connection: document.body.getAttribute('data-connection'),
    stream: document.body.getAttribute('data-stream'),
    scene: document.getElementById('activeScene')?.textContent,
    bitrate: document.getElementById('bitrateValue')?.textContent,
    sceneButtons: document.querySelectorAll('.scene-button').length
  }));
  if (state.connection !== 'connected' || state.stream !== 'live' || state.scene !== 'Gameplay') {
    throw new Error(`Stream Dashboard Rat Art fixture failed: ${JSON.stringify(state)}`);
  }
  if (Number(state.bitrate || 0) <= 0 || state.sceneButtons < 1) {
    throw new Error(`Stream Dashboard Rat Art data missing: ${JSON.stringify(state)}`);
  }
}
