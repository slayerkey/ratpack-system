export const variants = [
  { name: 'performance', slot: 'XL_H', mode: 'performance' },
  { name: 'today', slot: 'XL_H', mode: 'today' },
  { name: 'ambient', slot: 'XL_H', mode: 'ambient' },
];

const FIXED_NOW = Date.parse('2026-08-29T10:42:00-07:00');

function modeFor(context) {
  return context.variant?.mode || 'home';
}

export async function prepare(page, context) {
  await page.route('https://api.open-meteo.com/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current: { temperature_2m: 29.4, weather_code: 1 },
        hourly: {
          time: [
            '2026-08-29T10:00','2026-08-29T11:00','2026-08-29T12:00','2026-08-29T13:00','2026-08-29T14:00','2026-08-29T15:00','2026-08-29T16:00','2026-08-29T17:00','2026-08-29T18:00'
          ],
          temperature_2m: [29.4,30.1,31.0,32.2,33.0,32.6,31.5,30.2,29.1],
          precipitation_probability: [2,2,3,4,5,8,12,18,22],
          weather_code: [1,1,1,1,1,1,2,2,2],
        },
        daily: {
          temperature_2m_max: [33.2,32.0],
          temperature_2m_min: [24.8,24.2],
          sunrise: ['2026-08-29T05:58','2026-08-30T05:59'],
          sunset: ['2026-08-29T18:57','2026-08-30T18:56'],
        },
      }),
    });
  });
  await page.route('https://www.cloudflare.com/cdn-cgi/trace**', async route => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'fl=fixture\nip=127.0.0.1\n' });
  });

  await page.addInitScript(({ fixedNow }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    globalThis.Date = FixedDate;
    globalThis.uniqueId = 'rat-art-ultimate';
    globalThis.iCUE = { isPreview: false };
    globalThis.preset = 'everyday';
    globalThis.startMode = 'home';
    globalThis.smartMode = false;
    globalThis.use24Hour = false;
    globalThis.temperatureUnit = 'f';
    globalThis.weatherEnabled = true;
    globalThis.weatherLatitude = '33.4484';
    globalThis.weatherLongitude = '-112.0740';
    globalThis.calendarUrl = '';
    globalThis.focusMinutes = 25;
    globalThis.pinnedNote = 'Send replay to Jake';
    globalThis.graphWindow = '5m';
    globalThis.textColor = '#F5F7FA';
    globalThis.accentColor = '#2BE86A';
    globalThis.backgroundColor = '#07090D';
    globalThis.tr = async value => value;
    try { localStorage.clear(); } catch {}

    function signal() {
      const listeners = [];
      return { connect(fn){ listeners.push(fn); }, emit(id,value){ for(const fn of listeners) fn(id,value); } };
    }
    function makeAsync(methods) {
      const asyncResponse = signal();
      const obj = { asyncResponse };
      for (const [name, fn] of Object.entries(methods)) {
        obj[name] = (id, ...args) => setTimeout(() => asyncResponse.emit(id, fn(...args)), 0);
      }
      return obj;
    }
    const values = {'gpu-temp':68,'gpu-load':91,'cpu-temp':61,'cpu-load':46};
    const meta = {
      'gpu-temp':['NVIDIA GeForce RTX 5090','GPU Temperature','°C','temperature','gpu'],
      'gpu-load':['NVIDIA GeForce RTX 5090','GPU Load','%','load','gpu'],
      'cpu-temp':['AMD Ryzen 9','CPU Package Temperature','°C','temperature','package'],
      'cpu-load':['AMD Ryzen 9','CPU Total Load','%','load','cpu'],
    };
    const sensors = makeAsync({
      getAllSensorIds: () => Object.keys(values),
      getSensorDeviceName: id => meta[id][0],
      getSensorName: id => meta[id][1],
      getSensorUnits: id => meta[id][2],
      getSensorType: id => meta[id][3],
      getSensorKind: id => meta[id][4],
      getSensorValue: id => values[id],
    });
    const fps = makeAsync({ getFpsAvailable:()=>true, getCurrentFps:()=>238, getCurrentProcess:()=> 'VALORANT-Win64-Shipping.exe' });
    const media = makeAsync({ getSongName:()=> 'Midnight Circuit', getArtist:()=> 'Velvet Static' });
    media.triggerPreviousTrack=()=>{}; media.triggerPlayPause=()=>{}; media.triggerNextTrack=()=>{};
    globalThis.plugins = { Sensorsdataprovider:sensors, Fpsdataprovider:fps, Mediadataprovider:media };
  }, { fixedNow: FIXED_NOW });
}

export async function ready(page, context) {
  const mode = modeFor(context);
  await page.waitForFunction(() => globalThis.state?.started === true, { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('gpuTemp')?.textContent?.trim() !== '—', { timeout: 10000 });
  await page.evaluate(({ mode, fixedNow }) => {
    for (const timer of state.timers || []) clearInterval(timer);
    state.timers = [];
    const samples = 76;
    const fps = [], gpuTemp = [], cpuTemp = [], gpuLoad = [], cpuLoad = [], network = [];
    for (let i = 0; i < samples; i += 1) {
      const at = fixedNow - (samples - 1 - i) * 4000;
      fps.push({ at, value: 226 + Math.sin(i / 6) * 16 + Math.sin(i / 2.2) * 5 + (i > 46 && i < 51 ? -27 : 0) });
      gpuTemp.push({ at, value: 61 + i * .09 + Math.sin(i / 8) * 2.4 });
      cpuTemp.push({ at, value: 57 + Math.sin(i / 5.5) * 3.0 });
      gpuLoad.push({ at, value: 86 + Math.sin(i / 4.2) * 9 });
      cpuLoad.push({ at, value: 44 + Math.sin(i / 5) * 12 });
      network.push({ at, value: 31 + Math.sin(i / 6.5) * 5 + (i === 49 ? 38 : 0) });
    }
    state.history = { fps, gpuTemp, cpuTemp, gpuLoad, cpuLoad, network };
    state.metrics = { gpuTemp: 68, cpuTemp: 61, gpuLoad: 91, cpuLoad: 46 };
    state.fps = { available:true, value:238, process:'VALORANT-Win64-Shipping.exe', activeStreak:0, inactiveStreak:0 };
    state.media = { available:true, title:'Midnight Circuit', artist:'Velvet Static' };
    state.network = { current:34, jitter:4, failures:0, verified:76, state:'stable', lastOk:fixedNow };
    state.weather = {
      ready:true, loading:false, error:'', updatedAt:fixedNow,
      current:{temp:29.4,code:1},
      hourly:[29.4,30.1,31.0,32.2,33.0,32.6,31.5,30.2,29.1].map((temp,i)=>({at:fixedNow+i*3600000,temp,rain:i>5?18:4,code:i<6?1:2})),
      daily:{temperature_2m_max:[33.2],temperature_2m_min:[24.8],sunrise:['2026-08-29T05:58'],sunset:['2026-08-29T18:57']},
    };
    state.calendar = {
      ready:true, loading:false, error:'', updatedAt:fixedNow,
      events:[
        {start:new Date(fixedNow+48*60000),end:new Date(fixedNow+108*60000),summary:'Weekly coaching',location:'Discord',allDay:false},
        {start:new Date(fixedNow+158*60000),end:new Date(fixedNow+218*60000),summary:'Deep work block',location:'',allDay:false},
        {start:new Date(fixedNow+285*60000),end:new Date(fixedNow+330*60000),summary:'Gym',location:'',allDay:false},
      ],
    };
    state.focus = { running:true, endsAt:fixedNow+18*60000+16000, remainingMs:18*60000+16000 };
    renderAll();
    updateClock();
    setMode(mode, false);
    renderAll();
  }, { mode, fixedNow: FIXED_NOW });
  await page.waitForTimeout(120);
}

export async function assert(page, context) {
  const mode = modeFor(context);
  const result = await page.evaluate(() => {
    const active = document.querySelector('.screen.is-active');
    const hero = document.getElementById('homeClock');
    return {
      slot: document.body.getAttribute('data-slot'),
      mode: document.body.getAttribute('data-mode'),
      active: active?.getAttribute('data-screen'),
      fps: document.getElementById('fpsValue')?.textContent?.trim(),
      gpu: document.getElementById('gpuTemp')?.textContent?.trim(),
      weather: document.getElementById('weatherTemp')?.textContent?.trim(),
      clock: hero?.textContent?.trim(),
    };
  });
  const expectedSlot = String(context.slot).toLowerCase().replace('_','-');
  if (result.slot !== expectedSlot) throw new Error(`slot mismatch: ${JSON.stringify(result)} expected ${expectedSlot}`);
  if (result.mode !== mode || result.active !== mode) throw new Error(`mode mismatch: ${JSON.stringify(result)} expected ${mode}`);
  if (result.fps !== '238' || result.gpu !== '154' || result.weather !== '85°') throw new Error(`fixture values mismatch: ${JSON.stringify(result)}`);
  if (!result.clock.includes('10:42')) throw new Error(`clock fixture mismatch: ${JSON.stringify(result)}`);
}
