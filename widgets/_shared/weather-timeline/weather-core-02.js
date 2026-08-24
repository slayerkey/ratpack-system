'use strict';
  function normalizeCondition(text, code) {
    var t = safeText(text).toLowerCase();
    var c = Number(code);
    if (t.indexOf('thunder') >= 0 || [95,96,99].indexOf(c) >= 0) return 'storm';
    if (t.indexOf('snow') >= 0 || t.indexOf('sleet') >= 0 || [71,73,75,77,85,86].indexOf(c) >= 0) return 'snow';
    if (t.indexOf('heavy rain') >= 0 || [65,82].indexOf(c) >= 0) return 'heavy-rain';
    if (t.indexOf('rain') >= 0 || t.indexOf('shower') >= 0 || [61,63,80,81].indexOf(c) >= 0) return 'rain';
    if (t.indexOf('drizzle') >= 0 || [51,53,55,56,57].indexOf(c) >= 0) return 'drizzle';
    if (t.indexOf('fog') >= 0 || t.indexOf('mist') >= 0 || [45,48].indexOf(c) >= 0) return 'fog';
    if (t.indexOf('overcast') >= 0 || c === 3) return 'cloudy';
    if (t.indexOf('cloud') >= 0 || [1,2].indexOf(c) >= 0) return 'partly';
    return 'clear';
  }

  function wmoText(code) {
    var c = Number(code);
    if (c === 0) return 'Clear';
    if (c === 1) return 'Mostly clear';
    if (c === 2) return 'Partly cloudy';
    if (c === 3) return 'Overcast';
    if ([45,48].indexOf(c) >= 0) return 'Fog';
    if ([51,53,55,56,57].indexOf(c) >= 0) return 'Drizzle';
    if ([61,63].indexOf(c) >= 0) return 'Rain';
    if ([65,80,81,82].indexOf(c) >= 0) return 'Heavy rain';
    if ([71,73,75,77,85,86].indexOf(c) >= 0) return 'Snow';
    if ([95,96,99].indexOf(c) >= 0) return 'Thunderstorms';
    return 'Mixed weather';
  }

  function isoEpochLocal(iso, offsetSeconds) {
    if (!iso) return NaN;
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return Date.parse(iso);
    var utc = Date.UTC(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]), Number(m[5]), 0);
    return utc - (Number(offsetSeconds) || 0) * 1000;
  }

  function normalizeOpenMeteo(data, location) {
    var H = data && data.hourly, D = data && data.daily, C = data && data.current;
    if (!H || !Array.isArray(H.time) || !H.time.length) throw new Error('Forecast missing hourly data');
    var off = Number(data.utc_offset_seconds || 0);
    var unitF = unitMode() === 'f';
    var hours = H.time.map(function (time, i) {
      var code = H.weather_code ? H.weather_code[i] : 0;
      return {
        time: isoEpochLocal(time, off), localIso: time,
        temp: finite(H.temperature_2m && H.temperature_2m[i], null),
        feels: finite(H.apparent_temperature && H.apparent_temperature[i], null),
        precipProbability: finite(H.precipitation_probability && H.precipitation_probability[i], 0),
        precip: finite(H.precipitation && H.precipitation[i], 0),
        wind: finite(H.wind_speed_10m && H.wind_speed_10m[i], null),
        windDir: finite(H.wind_direction_10m && H.wind_direction_10m[i], null),
        uv: finite(H.uv_index && H.uv_index[i], null),
        isDay: H.is_day ? Number(H.is_day[i]) === 1 : true,
        code: code, text: wmoText(code), kind: normalizeCondition('', code)
      };
    });
    var days = [];
    if (D && Array.isArray(D.time)) {
      days = D.time.map(function (day, i) {
        return {
          date: day,
          high: finite(D.temperature_2m_max && D.temperature_2m_max[i], null),
          low: finite(D.temperature_2m_min && D.temperature_2m_min[i], null),
          sunrise: D.sunrise ? isoEpochLocal(D.sunrise[i], off) : null,
          sunset: D.sunset ? isoEpochLocal(D.sunset[i], off) : null,
          code: D.weather_code ? D.weather_code[i] : 0
        };
      });
    }
    var nowCode = C && C.weather_code !== undefined ? C.weather_code : (hours[0] ? hours[0].code : 0);
    return {
      provider: 'Open-Meteo', name: location.name || 'Weather', region: location.region || '', country: location.country || '',
      latitude: Number(data.latitude || location.latitude), longitude: Number(data.longitude || location.longitude),
      timezone: safeText(data.timezone || location.timezone), utcOffsetSeconds: off,
      current: {
        temp: finite(C && C.temperature_2m, hours[0] && hours[0].temp), feels: finite(C && C.apparent_temperature, hours[0] && hours[0].feels),
        wind: finite(C && C.wind_speed_10m, hours[0] && hours[0].wind), windDir: finite(C && C.wind_direction_10m, hours[0] && hours[0].windDir),
        isDay: C && C.is_day !== undefined ? Number(C.is_day) === 1 : (hours[0] ? hours[0].isDay : true),
        code: nowCode, text: wmoText(nowCode), kind: normalizeCondition('', nowCode)
      },
      hours: hours, days: days, tempUnit: unitF ? '°F' : '°C', windUnit: unitF ? 'mph' : 'km/h', precipUnit: unitF ? 'in' : 'mm'
    };
  }

  async function fetchOpenMeteo(query, key) {
    var location = await geocodeOpenMeteo(query, key);
    if (!location) throw new Error('Could not resolve location');
    var unitF = unitMode() === 'f';
    var hourly = ['temperature_2m','apparent_temperature','precipitation_probability','precipitation','weather_code','wind_speed_10m','wind_direction_10m','is_day','uv_index'].join(',');
    var current = ['temperature_2m','apparent_temperature','weather_code','wind_speed_10m','wind_direction_10m','is_day'].join(',');
    var daily = ['weather_code','temperature_2m_max','temperature_2m_min','sunrise','sunset'].join(',');
    var url = 'https://customer-api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(location.latitude) + '&longitude=' + encodeURIComponent(location.longitude) +
      '&current=' + encodeURIComponent(current) + '&hourly=' + encodeURIComponent(hourly) + '&daily=' + encodeURIComponent(daily) + '&timezone=auto&forecast_days=3' +
      '&temperature_unit=' + (unitF ? 'fahrenheit' : 'celsius') + '&wind_speed_unit=' + (unitF ? 'mph' : 'kmh') + '&precipitation_unit=' + (unitF ? 'inch' : 'mm') + '&apikey=' + encodeURIComponent(key);
    return normalizeOpenMeteo(await fetchJson(url, 9500), location);
  }

  function localDateParts(epoch, timezone) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || undefined, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(epoch));
      var out = {};
      parts.forEach(function (p) { if (p.type !== 'literal') out[p.type] = p.value; });
      return out;
    } catch (error) {
      var d = new Date(epoch);
      return { year:String(d.getFullYear()), month:pad2(d.getMonth()+1), day:pad2(d.getDate()), hour:pad2(d.getHours()), minute:pad2(d.getMinutes()) };
    }
  }

  function weatherApiEpoch(timeEpoch) { return Number(timeEpoch || 0) * 1000; }

  function normalizeWeatherApi(data) {
    if (!data || !data.location || !data.current || !data.forecast || !Array.isArray(data.forecast.forecastday)) throw new Error('Invalid WeatherAPI response');
    var unitF = unitMode() === 'f';
    var hours = [];
    var days = data.forecast.forecastday.map(function (fd) {
      (fd.hour || []).forEach(function (h) {
        var probability = Math.max(finite(h.chance_of_rain, 0), finite(h.chance_of_snow, 0));
        var text = h.condition ? safeText(h.condition.text) : '';
        hours.push({
          time: weatherApiEpoch(h.time_epoch), localIso: safeText(h.time),
          temp: finite(unitF ? h.temp_f : h.temp_c, null), feels: finite(unitF ? h.feelslike_f : h.feelslike_c, null),
          precipProbability: probability, precip: finite(unitF ? h.precip_in : h.precip_mm, 0),
          wind: finite(unitF ? h.wind_mph : h.wind_kph, null), windDir: finite(h.wind_degree, null), uv: finite(h.uv, null),
          isDay: Number(h.is_day) === 1, code: h.condition ? h.condition.code : 0, text: text, kind: normalizeCondition(text, null)
        });
      });
      var astro = fd.astro || {};
      return {
        date: safeText(fd.date), high: finite(unitF ? fd.day.maxtemp_f : fd.day.maxtemp_c, null), low: finite(unitF ? fd.day.mintemp_f : fd.day.mintemp_c, null),
        sunrise: parseAstroEpoch(fd.date, astro.sunrise, data.location.tz_id), sunset: parseAstroEpoch(fd.date, astro.sunset, data.location.tz_id),
        code: fd.day && fd.day.condition ? fd.day.condition.code : 0
      };
    });
    var ctext = data.current.condition ? safeText(data.current.condition.text) : '';
    return {
      provider: 'WeatherAPI.com', name: safeText(data.location.name), region: safeText(data.location.region), country: safeText(data.location.country),
      latitude: Number(data.location.lat), longitude: Number(data.location.lon), timezone: safeText(data.location.tz_id), utcOffsetSeconds: null,
      current: {
        temp: finite(unitF ? data.current.temp_f : data.current.temp_c, null), feels: finite(unitF ? data.current.feelslike_f : data.current.feelslike_c, null),
        wind: finite(unitF ? data.current.wind_mph : data.current.wind_kph, null), windDir: finite(data.current.wind_degree, null),
        isDay: Number(data.current.is_day) === 1, code: data.current.condition ? data.current.condition.code : 0,
        text: ctext, kind: normalizeCondition(ctext, null)
      },
      hours: hours, days: days, tempUnit: unitF ? '°F' : '°C', windUnit: unitF ? 'mph' : 'km/h', precipUnit: unitF ? 'in' : 'mm'
    };
  }

  function parseAstroEpoch(dateText, timeText, timezone) {
    if (!dateText || !timeText) return null;
    var m = String(timeText).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    var h = Number(m[1]) % 12 + (/PM/i.test(m[3]) ? 12 : 0);
    // WeatherAPI returns local wall time. Find the epoch by walking around UTC until Intl in the target zone matches.
    var parts = String(dateText).split('-').map(Number);
    var guess = Date.UTC(parts[0], parts[1]-1, parts[2], h, Number(m[2]));
    for (var i = 0; i < 4; i++) {
      var p = localDateParts(guess, timezone);
      var observed = Date.UTC(Number(p.year), Number(p.month)-1, Number(p.day), Number(p.hour), Number(p.minute));
      var wanted = Date.UTC(parts[0], parts[1]-1, parts[2], h, Number(m[2]));
      guess += wanted - observed;
    }
    return guess;
  }

  async function fetchWeatherApi(query, key) {
    var q = query || 'auto:ip';
    var url = 'https://api.weatherapi.com/v1/forecast.json?key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(q) + '&days=3&aqi=no&alerts=no';
    return normalizeWeatherApi(await fetchJson(url, 9500));
  }
