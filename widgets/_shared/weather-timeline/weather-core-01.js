'use strict';

  var CFG = window.WEATHER_TIMELINE_CONFIG || { pro: false, slug: 'weather-timeline' };
  var IS_PRO = !!CFG.pro;
  var SLOT_SPECS = [
    { id: 's-h', w: 840, h: 344 }, { id: 's-v', w: 696, h: 416 },
    { id: 'm-h', w: 840, h: 696 }, { id: 'm-v', w: 696, h: 840 },
    { id: 'l-h', w: 1688, h: 696 }, { id: 'l-v', w: 696, h: 1688 },
    { id: 'xl-h', w: 2536, h: 696 }, { id: 'xl-v', w: 696, h: 2536 }
  ];
  var COMPACT_SLOTS = { 's-h': 1, 's-v': 1, 'm-h': 1, 'm-v': 1 };
  var REFRESH_TIMER = null;
  var CLOCK_TIMER = null;
  var ABORTER = null;
  var PRO_MARKETPLACE_URL = CFG.proMarketplaceUrl || 'https://marketplace.elgato.com/product/weather-timeline-pro-160c8019-ce77-49d8-a306-8ef1764a70c5';

  var STATE = {
    status: 'loading', message: '', stale: false, updatedAt: 0,
    forecast: null, locationIndex: 0, timelinePage: 0, selectedHour: -1,
    slot: 's-h', provider: '', preview: false, slow: false
  };

  function prop(name, fallback) {
    try {
      var value = globalThis[name];
      if (typeof Node !== 'undefined' && value instanceof Node) return fallback;
      if (value === undefined || value === null) return fallback;
      return value;
    } catch (error) { return fallback; }
  }

  function safeText(value) { return value === undefined || value === null ? '' : String(value); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Number(v) || 0)); }
  function pad2(v) { return String(v).padStart(2, '0'); }
  function finite(v, fallback) { var n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function esc(value) { return safeText(value).replace(/[&<>"']/g, function (ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }

  function instanceKey(name) {
    var id = 'packrat';
    try { if (typeof uniqueId !== 'undefined' && uniqueId) id = String(uniqueId); } catch (error) {}
    return id + ':' + CFG.slug + ':' + name;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(instanceKey('forecast-cache'));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.forecast || !Array.isArray(parsed.forecast.hours)) return null;
      return parsed;
    } catch (error) { return null; }
  }

  function writeCache(forecast) {
    try { localStorage.setItem(instanceKey('forecast-cache'), JSON.stringify({ forecast: forecast, updatedAt: Date.now() })); } catch (error) {}
  }

  function unitMode() {
    var chosen = safeText(prop('temperatureUnits', 'auto')).toLowerCase();
    if (chosen === 'c' || chosen === 'f') return chosen;
    try {
      if (window.iCUE && typeof iCUE.defaultTemperatureUnit === 'function') {
        return String(iCUE.defaultTemperatureUnit()).indexOf('F') >= 0 ? 'f' : 'c';
      }
    } catch (error) {}
    try {
      return /^en-US/i.test(navigator.language || '') ? 'f' : 'c';
    } catch (error) { return 'c'; }
  }

  function tempUnit() { return unitMode() === 'f' ? '°F' : '°C'; }
  function windUnit() { return unitMode() === 'f' ? 'mph' : 'km/h'; }
  function precipUnit() { return unitMode() === 'f' ? 'in' : 'mm'; }

  function nearestSlot() {
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
    var best = SLOT_SPECS[0], score = Infinity;
    SLOT_SPECS.forEach(function (item) {
      var next = Math.abs(Math.log(w / item.w)) + Math.abs(Math.log(h / item.h));
      if (next < score) { score = next; best = item; }
    });
    return best.id;
  }

  function applySlot() {
    STATE.slot = nearestSlot();
    document.body.setAttribute('data-slot', STATE.slot);
    document.body.setAttribute('data-compact', COMPACT_SLOTS[STATE.slot] ? 'true' : 'false');
  }

  function applyTheme() {
    var theme = safeText(prop('theme', IS_PRO ? 'aurora' : 'sky')).toLowerCase();
    var allowed = IS_PRO ? ['aurora','sky','midnight','mono','ember','mint','violet','glass'] : ['sky','midnight','mono','aurora'];
    if (allowed.indexOf(theme) < 0) theme = allowed[0];
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-pro', IS_PRO ? 'true' : 'false');
  }

  function isPreview() {
    try { return !!(window.iCUE && iCUE.isPreview); } catch (error) { return false; }
  }

  function currentLocationQuery() {
    var locations = IS_PRO ? [prop('location1',''), prop('location2',''), prop('location3','')] : [prop('location1','')];
    locations = locations.map(function (v) { return safeText(v).trim(); });
    var configured = locations.filter(Boolean);
    if (!configured.length) return '';
    STATE.locationIndex = Math.min(STATE.locationIndex, configured.length - 1);
    return configured[STATE.locationIndex] || configured[0];
  }

  function configuredLocations() {
    var values = IS_PRO ? [prop('location1',''), prop('location2',''), prop('location3','')] : [prop('location1','')];
    return values.map(function (v) { return safeText(v).trim(); }).filter(Boolean);
  }

  function providerKeys() {
    var open = '';
    try { open = safeText(window.openMeteoApiKey).trim(); } catch (error) {}
    return { openMeteo: open, weatherApi: safeText(prop('weatherApiKey','')).trim() };
  }

  function parseCoordinates(query) {
    var m = safeText(query).match(/^\s*(-?\d+(?:\.\d+)?)\s*[,/]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    var lat = Number(m[1]), lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { name: lat.toFixed(3) + ', ' + lon.toFixed(3), latitude: lat, longitude: lon };
  }

  async function fetchJson(url, timeoutMs) {
    if (ABORTER) { try { ABORTER.abort(); } catch (error) {} }
    ABORTER = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ABORTER) ABORTER.abort(); } catch (error) {} }, timeoutMs || 9000);
    try {
      var response = await fetch(url, { cache: 'no-store', signal: ABORTER ? ABORTER.signal : undefined });
      if (!response || !response.ok) throw new Error('HTTP ' + (response ? response.status : 'network'));
      return await response.json();
    } finally { clearTimeout(timer); ABORTER = null; }
  }

  async function ipLocation() {
    try {
      if (!window.iCUE || !iCUE.ipRegistryApiKey) return null;
      var data = await fetchJson('https://api.ipregistry.co/?key=' + encodeURIComponent(iCUE.ipRegistryApiKey), 6500);
      var loc = data && data.location;
      if (!loc || !Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) return null;
      return {
        name: safeText(loc.city) || 'Current location',
        region: loc.region ? safeText(loc.region.name) : '',
        country: loc.country ? safeText(loc.country.name) : '',
        latitude: Number(loc.latitude), longitude: Number(loc.longitude), auto: true
      };
    } catch (error) { return null; }
  }

  async function geocodeOpenMeteo(query, key) {
    var direct = parseCoordinates(query);
    if (direct) return direct;
    if (!query) return await ipLocation();
    var lang = 'en';
    try { if (window.iCUE && iCUE.iCUELanguage) lang = iCUE.iCUELanguage; } catch (error) {}
    var url = 'https://customer-geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=1&language=' + encodeURIComponent(lang) + '&apikey=' + encodeURIComponent(key);
    var data = await fetchJson(url, 8000);
    var item = data && Array.isArray(data.results) ? data.results[0] : null;
    if (!item) throw new Error('Location not found');
    return { name: safeText(item.name), region: safeText(item.admin1), country: safeText(item.country), latitude: Number(item.latitude), longitude: Number(item.longitude), timezone: safeText(item.timezone) };
  }
