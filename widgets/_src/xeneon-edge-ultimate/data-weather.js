async function refreshWeather(force) {
  var cfg = settings();
  if (state.preview && (!cfg.weatherLatitude || !cfg.weatherLongitude)) {
    var base = Date.now();
    state.weather.current = { temp: 29.4, code: 1 };
    state.weather.hourly = [29.4,30.1,31.0,32.2,33.0,32.6,31.5,30.2,29.1].map(function (temp, i) {
      return { at: base + i * 3600000, temp: temp, rain: i >= 6 ? 20 : 4, code: i < 6 ? 1 : 2 };
    });
    state.weather.daily = { temperature_2m_max: [33.2], temperature_2m_min: [24.8], sunrise:["2026-08-29T05:58"], sunset:["2026-08-29T18:57"] };
    state.weather.ready = true; state.weather.error = ""; state.weather.updatedAt = Date.now();
    renderWeather(); renderContext(); return;
  }
  if (!cfg.weatherEnabled) {
    state.weather.ready = false; state.weather.error = "Weather disabled"; renderWeather(); return;
  }
  var lat = finite(cfg.weatherLatitude), lon = finite(cfg.weatherLongitude);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    state.weather.ready = false; state.weather.error = "Set location"; renderWeather(); return;
  }
  if (state.weather.loading) return;
  if (!force && state.weather.ready && Date.now() - state.weather.updatedAt < 12 * 60 * 1000) return;
  state.weather.loading = true;
  try {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(lat) +
      "&longitude=" + encodeURIComponent(lon) +
      "&current=temperature_2m,weather_code&hourly=temperature_2m,precipitation_probability,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=celsius&forecast_days=2&timezone=auto";
    var response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Weather HTTP " + response.status);
    var data = await response.json();
    var hourly = [];
    if (data.hourly && Array.isArray(data.hourly.time)) {
      var now = Date.now();
      data.hourly.time.forEach(function (iso, i) {
        var at = new Date(iso).getTime();
        if (at >= now - 3600000 && at <= now + 12 * 3600000) {
          hourly.push({
            at: at,
            temp: finite(data.hourly.temperature_2m && data.hourly.temperature_2m[i]),
            rain: finite(data.hourly.precipitation_probability && data.hourly.precipitation_probability[i]),
            code: finite(data.hourly.weather_code && data.hourly.weather_code[i])
          });
        }
      });
    }
    state.weather.current = {
      temp: finite(data.current && data.current.temperature_2m),
      code: finite(data.current && data.current.weather_code)
    };
    state.weather.hourly = hourly.slice(0, 9);
    state.weather.daily = data.daily || null;
    state.weather.ready = true;
    state.weather.error = "";
    state.weather.updatedAt = Date.now();
    storeWrite("weather-cache", { current: state.weather.current, hourly: state.weather.hourly, daily: state.weather.daily, updatedAt: state.weather.updatedAt });
  } catch (e) {
    var cache = storeRead("weather-cache", null);
    if (cache && Date.now() - Number(cache.updatedAt || 0) < 24 * 3600000) {
      state.weather.current = cache.current; state.weather.hourly = cache.hourly || []; state.weather.daily = cache.daily || null;
      state.weather.ready = true; state.weather.updatedAt = Number(cache.updatedAt || 0); state.weather.error = "Cached";
    } else {
      state.weather.ready = false; state.weather.error = "Weather unavailable";
    }
  } finally {
    state.weather.loading = false;
    renderWeather();
    renderContext();
  }
}

function displayTemperature(celsius) {
  if (!Number.isFinite(celsius)) return "—";
  return Math.round(settings().tempUnit === "f" ? celsius * 9 / 5 + 32 : celsius);
}

function renderWeather() {
  if (!state.weather.ready || !state.weather.current) {
    setText("weatherIcon", state.weather.loading ? "…" : "○");
    setText("weatherTemp", state.weather.loading ? "…" : "SET");
    setText("weatherCondition", state.weather.error || "Add weather location");
    setText("weatherRange", "in iCUE settings");
    setText("ambientWeather", "XENEON EDGE ULTIMATE");
    drawWeatherSpark();
    return;
  }
  var current = state.weather.current;
  var code = weatherCode(current.code);
  setText("weatherIcon", code.icon);
  setText("weatherTemp", displayTemperature(current.temp) + "°");
  setText("weatherCondition", code.label);
  var daily = state.weather.daily;
  if (daily && daily.temperature_2m_max && daily.temperature_2m_min) {
    setText("weatherRange", "H " + displayTemperature(finite(daily.temperature_2m_max[0])) + "°  L " + displayTemperature(finite(daily.temperature_2m_min[0])) + "°");
  } else setText("weatherRange", state.weather.error || "Updated now");
  setText("ambientWeather", code.label.toUpperCase() + " • " + displayTemperature(current.temp) + "°");
  drawWeatherSpark();
}
