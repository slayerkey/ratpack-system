function applySettings(initial, nextSettings) {
  var cfg = nextSettings || settings();
  var previous = state.appliedSettings;
  var weatherChanged = !previous || cfg.weatherEnabled !== previous.weatherEnabled ||
    cfg.weatherLatitude !== previous.weatherLatitude || cfg.weatherLongitude !== previous.weatherLongitude;
  var calendarChanged = !previous || cfg.calendarUrl !== previous.calendarUrl;
  var focusChanged = !!previous && cfg.focusMinutes !== previous.focusMinutes;
  var modeSettingsChanged = !!previous && (
    cfg.startMode !== previous.startMode || cfg.smartMode !== previous.smartMode || cfg.preset !== previous.preset
  );

  document.documentElement.style.setProperty("--text", cfg.text);
  document.documentElement.style.setProperty("--accent", cfg.accent);
  document.documentElement.style.setProperty("--bg", cfg.background);
  document.body.setAttribute("data-preset", cfg.preset);
  setText("noteText", cfg.pinnedNote || "Add a short note in iCUE settings.");

  var storedFocus = storeRead("focus", null);
  if (initial && storedFocus && typeof storedFocus === "object") {
    state.focus.running = !!storedFocus.running;
    state.focus.endsAt = Number(storedFocus.endsAt) || 0;
    state.focus.remainingMs = Number(storedFocus.remainingMs) || cfg.focusMinutes * 60000;
    if (state.focus.running && state.focus.endsAt <= Date.now()) {
      state.focus.running = false;
      state.focus.remainingMs = cfg.focusMinutes * 60000;
    }
  } else if (focusChanged && !state.focus.running) {
    state.focus.remainingMs = cfg.focusMinutes * 60000;
  } else if (!state.focus.running && (!state.focus.remainingMs || state.focus.remainingMs > 90 * 60000)) {
    state.focus.remainingMs = cfg.focusMinutes * 60000;
  }

  if (initial) {
    var storedMode = storeRead("mode", "");
    if (cfg.startMode !== "auto") setMode(cfg.startMode, false);
    else if (storedMode && ["home","performance","today","ambient"].indexOf(storedMode) >= 0) setMode(storedMode, false);
    else if (cfg.preset === "gaming") setMode("performance", false);
    else if (cfg.preset === "work") setMode("today", false);
    else setMode("home", false);
  } else if (previous && cfg.startMode !== previous.startMode && cfg.startMode !== "auto") {
    state.manualHoldUntil = 0;
    setMode(cfg.startMode, false);
  }

  state.appliedSettings = Object.assign({}, cfg);
  state.settingsFingerprint = settingsFingerprint(cfg);

  if (cfg.smartMode && cfg.startMode === "auto") {
    if (!state.manualHoldUntil || Date.now() >= state.manualHoldUntil) {
      document.body.setAttribute("data-auto", "auto");
      setText("autoLabel", "AUTO");
    }
  } else {
    state.manualHoldUntil = 0;
    document.body.setAttribute("data-auto", "manual");
    setText("autoLabel", "MANUAL");
  }

  if (weatherChanged) refreshWeather(!initial);
  if (calendarChanged) refreshCalendar(!initial);
  updateClock();
  renderAll();

  if (!initial && modeSettingsChanged && cfg.smartMode && cfg.startMode === "auto") {
    state.manualHoldUntil = 0;
    state.fps.activeStreak = 0;
    state.fps.inactiveStreak = 0;
    resumeAuto();
  }
}

function syncSettings(force) {
  var cfg = settings();
  var fingerprint = settingsFingerprint(cfg);
  if (!force && fingerprint === state.settingsFingerprint) return false;
  applySettings(false, cfg);
  return true;
}

function formatTime(date, includeSeconds) {
  var cfg = settings();
  var d = date || new Date();
  var h = d.getHours();
  var suffix = "";
  if (!cfg.use24) {
    suffix = h >= 12 ? " PM" : " AM";
    h = h % 12 || 12;
  }
  var text = (cfg.use24 ? String(h).padStart(2, "0") : String(h)) + ":" + String(d.getMinutes()).padStart(2, "0");
  if (includeSeconds) text += ":" + String(d.getSeconds()).padStart(2, "0");
  return text + suffix;
}

function formatShortDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();
}

function updateClock() {
  var now = new Date();
  var weekday = now.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase();
  var longDate = now.toLocaleDateString(undefined, { month: "long", day: "numeric" }).toUpperCase();
  var time = formatTime(now, false);
  setText("homeDay", weekday);
  setText("homeClock", time);
  setText("homeDate", formatShortDate(now));
  setText("todayDay", weekday);
  setText("todayClock", time);
  setText("todayDate", longDate);
  setText("ambientClock", time);
  setText("ambientDate", weekday + " • " + longDate);
  renderFocus();
  maybeSmartMode();
  renderContext();
}

function setMode(mode, manual) {
  if (["home","performance","today","ambient"].indexOf(mode) < 0) mode = "home";
  state.mode = mode;
  document.body.setAttribute("data-mode", mode);
  document.querySelectorAll(".screen").forEach(function (screen) {
    screen.classList.toggle("is-active", screen.getAttribute("data-screen") === mode);
  });
  document.querySelectorAll(".navButton[data-mode-target]").forEach(function (button) {
    button.classList.toggle("is-active", button.getAttribute("data-mode-target") === mode);
  });
  if (manual) {
    state.manualHoldUntil = Date.now() + 10 * 60 * 1000;
    document.body.setAttribute("data-auto", "hold");
    setText("autoLabel", "HOLD");
  }
  storeWrite("mode", mode);
  requestAnimationFrame(function () {
    drawPerformanceGraph(); drawNetworkSpark(); drawWeatherSpark();
  });
}

function resumeAuto() {
  var cfg = settings();
  state.manualHoldUntil = 0;
  if (!cfg.smartMode || cfg.startMode !== "auto") {
    document.body.setAttribute("data-auto", "manual");
    setText("autoLabel", "MANUAL");
    return;
  }
  document.body.setAttribute("data-auto", "auto");
  setText("autoLabel", "AUTO");
  maybeSmartMode(true);
}

function maybeSmartMode(force) {
  var cfg = settings();
  if (!cfg.smartMode || cfg.startMode !== "auto") return;
  if (!force && Date.now() < state.manualHoldUntil) return;
  if (state.manualHoldUntil && Date.now() >= state.manualHoldUntil) {
    state.manualHoldUntil = 0;
    document.body.setAttribute("data-auto", "auto");
    setText("autoLabel", "AUTO");
  }

  var gameActive = state.fps.available && finite(state.fps.value) !== null && state.fps.value > 0 && !!state.fps.process;
  if (gameActive) {
    state.fps.activeStreak += 1;
    state.fps.inactiveStreak = 0;
  } else {
    state.fps.inactiveStreak += 1;
    state.fps.activeStreak = 0;
  }
  if ((force || state.fps.activeStreak >= 2) && state.mode !== "performance") setMode("performance", false);
  if ((force || state.fps.inactiveStreak >= 3) && state.mode === "performance") {
    setMode(cfg.preset === "work" ? "today" : "home", false);
  }
}
