function levelColor(percent, threshold) {
  if (percent == null) return "#8D98A7";
  if (percent <= threshold) return "#FF5C62";
  if (percent <= Math.max(threshold + 15, 35)) return "#F3B342";
  return "var(--accent)";
}

function formatEta(minutes) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "";
  var total = Math.round(minutes);
  var hours = Math.floor(total / 60);
  var mins = total % 60;
  if (hours && mins) return hours + "h " + mins + "m";
  if (hours) return hours + "h";
  return mins + "m";
}

async function statusLabel(card) {
  if (card.statusState === "charging") return await t("Charging");
  if (card.statusState === "full") return await t("Full");
  if (card.statusState === "discharging") return await t("Discharging");
  return await t("Battery");
}

function boltSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 5.5 13H11l-1 9L18.5 10H13l0-8Z"></path></svg>';
}

async function renderCards() {
  var board = document.getElementById("board");
  if (!board || document.body.getAttribute("data-panel-state") !== "ready") return;
  board.replaceChildren();
  board.setAttribute("data-count", String(Math.min(cards.length, 9)));
  var cfg = readSettings();
  var batteryWord = await t("Battery");
  var countText = cards.length + " " + (cards.length === 1 ? await t("DEVICE") : await t("DEVICES"));
  setText("deviceCount", countText);

  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var article = document.createElement("article");
    article.className = "battery-card interactive";
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("data-key", card.key);
    article.setAttribute("aria-label", card.name + " " + batteryWord);

    var pct = card.percentage;
    var color = levelColor(pct, cfg.threshold);
    article.style.setProperty("--charge", pct == null ? "0%" : pct + "%");
    article.style.setProperty("--level-color", color);
    if (pct != null && pct <= cfg.threshold) article.classList.add("is-low");
    else if (pct != null && pct <= Math.max(cfg.threshold + 15, 35)) article.classList.add("is-warning");
    if (card.statusState === "charging") article.classList.add("is-charging");

    var top = document.createElement("div");
    top.className = "card-top";
    var name = document.createElement("div");
    name.className = "device-name";
    name.textContent = card.name;
    top.appendChild(name);

    var statusRow = document.createElement("div");
    statusRow.className = "status-row";
    var badge = document.createElement("div");
    badge.className = "status-badge" + (card.statusState === "charging" ? " charging" : "");
    if (card.statusState === "charging") badge.innerHTML = boltSvg();
    var badgeText = document.createElement("span");
    badgeText.textContent = await statusLabel(card);
    badge.appendChild(badgeText);
    statusRow.appendChild(badge);
    top.appendChild(statusRow);

    var metricRow = document.createElement("div");
    metricRow.className = "metric-row";
    var metricWrap = document.createElement("div");
    metricWrap.className = "metric-wrap";
    var metric = document.createElement("div");
    metric.className = "metric";
    var caption = document.createElement("div");
    caption.className = "metric-caption";
    var detail = detailModes[card.key] === true;

    if (!detail) {
      if (pct == null) metric.textContent = "--";
      else {
        metric.textContent = String(Math.round(pct));
        var unit = document.createElement("small");
        unit.textContent = "%";
        metric.appendChild(unit);
      }
      caption.textContent = await t("Charge level");
    } else if (card.etaMinutes != null) {
      metric.textContent = formatEta(card.etaMinutes);
      caption.textContent = await t("Remaining");
    } else if (card.statusState !== "unknown") {
      metric.textContent = await statusLabel(card);
      caption.textContent = await t("Battery status");
    } else {
      metric.textContent = await t("No estimate");
      caption.textContent = await t("Estimate unavailable");
    }
    metricWrap.appendChild(metric);
    metricWrap.appendChild(caption);
    metricRow.appendChild(metricWrap);

    var hint = document.createElement("div");
    hint.className = "card-hint";
    hint.textContent = detail ? await t("Tap to show percentage") : await t("Tap for battery detail");
    metricRow.appendChild(hint);

    var bottom = document.createElement("div");
    bottom.className = "card-bottom";
    var track = document.createElement("div");
    track.className = "battery-track";
    var fill = document.createElement("div");
    fill.className = "battery-fill";
    track.appendChild(fill);
    bottom.appendChild(track);

    article.appendChild(top);
    article.appendChild(metricRow);
    article.appendChild(bottom);

    article.addEventListener("click", function () { toggleCard(this.getAttribute("data-key")); });
    article.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCard(this.getAttribute("data-key"));
      }
    });
    board.appendChild(article);
  }
}

function toggleCard(key) {
  if (!key) return;
  detailModes[key] = !detailModes[key];
  renderCards();
}

async function setFreshness(stale) {
  var el = document.getElementById("freshness");
  if (!el) return;
  el.classList.toggle("stale", !!stale);
  el.textContent = stale ? await t("Last known readings") : await t("LOWEST FIRST");
}

async function showState(state) {
  document.body.setAttribute("data-panel-state", state);
  setText("deviceCount", "0 " + await t("DEVICES"));
  await setFreshness(false);
  if (state === "empty") {
    setText("stateTitle", await t("No battery sensors found"));
    setText("stateBody", await t("This panel reads supported Corsair wireless devices through iCUE. Connect a wireless device to see its battery here."));
  } else if (state === "unavailable") {
    setText("stateTitle", await t("iCUE sensor service unavailable"));
    setText("stateBody", await t("The panel will reconnect automatically."));
  } else {
    setText("stateTitle", await t("Waiting for iCUE sensors"));
    setText("stateBody", await t("Battery devices will appear automatically."));
  }
}

async function translateStatic() {
  wirelessDeviceLabel = await t("Wireless device");
  setText("eyebrow", await t("WIRELESS POWER"));
  setText("panelTitle", await t("Peripheral Battery"));
  document.getElementById("stage").setAttribute("aria-label", await t("Peripheral Battery Panel"));
  translationsReady = true;
  if (document.body.getAttribute("data-panel-state") === "ready") {
    await setFreshness(cards.some(function (card) { return !card.live; }));
    renderCards();
  } else {
    await showState(document.body.getAttribute("data-panel-state") || "waiting");
  }
}

function startWidget() {
  if (started) return;
  started = true;
  applySlot();
  applySettings();
  showState("waiting");
  translateStatic();
  restoreCache();
  window.addEventListener("resize", applySlot);
  scanSensors();
  reconcileTimer = setInterval(scanSensors, 30000);
}

icueEvents = {
  onICUEInitialized: function () {
    applySettings();
    translateStatic();
    scanSensors();
  },
  onDataUpdated: function () {
    applySettings();
    translateStatic();
  }
};

pluginSensorsdataproviderEvents = {
  onInitialized: function () {
    scheduleScan(0);
  }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWidget);
else startWidget();
