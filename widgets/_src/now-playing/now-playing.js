/* Now Playing Panel for XENEON Edge.
 *
 * The iCUE Media provider exposes only songName, artist, and three transport actions.
 * This widget deliberately does not invent album art, progress, seek, or playback state.
 */

var mediaPending = {};
var mediaRequestId = 1000;
var mediaSignalPlugin = null;
var polling = false;
var pollTimer = null;
var providerFailures = 0;
var currentTrack = { title: "", artist: "" };
var lastHistoryKey = "";
var gradientModel = null;
var gradientLastFrame = 0;
var gradientRaf = null;
var uiStarted = false;
var translationsReady = false;

var SLOT_SPECS = [
    { id: "s-h",  w: 840,  h: 344 },
    { id: "s-v",  w: 696,  h: 416 },
    { id: "m-h",  w: 840,  h: 696 },
    { id: "m-v",  w: 696,  h: 840 },
    { id: "l-h",  w: 1688, h: 696 },
    { id: "l-v",  w: 696,  h: 1688 },
    { id: "xl-h", w: 2536, h: 696 },
    { id: "xl-v", w: 696,  h: 2536 }
];

var PALETTE_ORDER = ["artist", "neon", "ember", "ocean"];

function getIcueProperty(name, fallback) {
    try {
        var value = globalThis[name];
        if (typeof Node !== "undefined" && value instanceof Node) return fallback;
        if (value === undefined || value === null) return fallback;
        return value;
    } catch (e) {
        return fallback;
    }
}

function instanceKey(namespace) {
    var id = "packrat";
    try { if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId); } catch (e) { }
    return id + ":now-playing:" + namespace;
}

function storeRead(namespace, fallback) {
    try {
        var raw = localStorage.getItem(instanceKey(namespace));
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
}

function storeWrite(namespace, value) {
    try { localStorage.setItem(instanceKey(namespace), JSON.stringify(value)); } catch (e) { }
}

async function t(key) {
    try {
        if (typeof tr === "function") {
            var value = await tr(key);
            if (value !== undefined && value !== null && String(value)) return String(value);
        }
    } catch (e) { }
    return key;
}

async function translateRuntime() {
    var keys = [
        "SYSTEM MEDIA",
        "Nothing playing",
        "Start music in any Windows media app",
        "iCUE Media provider unavailable",
        "The panel will reconnect automatically",
        "RECENTLY PLAYED",
        "Tracks appear here as they change.",
        "Previous track",
        "Play or pause",
        "Next track",
        "Recently played",
        "Now Playing Panel",
        "Unknown artist"
    ];
    var values = await Promise.all(keys.map(function (key) { return t(key); }));
    var map = {};
    keys.forEach(function (key, i) { map[key] = values[i]; });

    setText("statusLabel", map["SYSTEM MEDIA"]);
    setText("historyTitle", map["RECENTLY PLAYED"]);
    setText("historyEmpty", map["Tracks appear here as they change."]);
    document.getElementById("previousControl").setAttribute("aria-label", map["Previous track"]);
    document.getElementById("playPauseControl").setAttribute("aria-label", map["Play or pause"]);
    document.getElementById("nextControl").setAttribute("aria-label", map["Next track"]);
    document.getElementById("historyPanel").setAttribute("aria-label", map["Recently played"]);
    document.getElementById("stage").setAttribute("aria-label", map["Now Playing Panel"]);
    if (document.body.getAttribute("data-state") === "playing" && !currentTrack.artist) setText("trackArtist", map["Unknown artist"]);
    translationsReady = true;
    renderState();
}

function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

function readSettings() {
    var palette = String(getIcueProperty("palettePreset", "artist") || "artist").toLowerCase();
    if (PALETTE_ORDER.indexOf(palette) < 0) palette = "artist";
    return {
        palette: palette,
        motion: Math.max(0, Math.min(100, Number(getIcueProperty("gradientMotion", 35)) || 0)),
        use24: getIcueProperty("use24Hour", true) !== false,
        showHistory: getIcueProperty("showHistory", true) !== false,
        text: String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8"),
        accent: String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A"),
        background: String(getIcueProperty("backgroundColor", "#07090D") || "#07090D")
    };
}

function currentPalette() {
    var cfg = readSettings();
    var saved = storeRead("palette-override", null);
    if (saved && saved.base === cfg.palette && PALETTE_ORDER.indexOf(saved.value) >= 0) return saved.value;
    if (saved) storeWrite("palette-override", null);
    return cfg.palette;
}

function cyclePalette() {
    var cfg = readSettings();
    var current = currentPalette();
    var index = PALETTE_ORDER.indexOf(current);
    var next = PALETTE_ORDER[(index + 1) % PALETTE_ORDER.length];
    storeWrite("palette-override", { base: cfg.palette, value: next });
    applySettings(true);
}

function applySettings(forceGradient) {
    var cfg = readSettings();
    document.documentElement.style.setProperty("--text", cfg.text);
    document.documentElement.style.setProperty("--accent", cfg.accent);
    document.documentElement.style.setProperty("--bg", cfg.background);
    var palette = currentPalette();
    document.body.setAttribute("data-palette", palette);
    document.body.classList.toggle("history-off", !cfg.showHistory);
    updatePaletteBadge(palette);
    rebuildGradient(forceGradient !== false);
    renderHistory();
    updateClock();
}

async function updatePaletteBadge(palette) {
    var names = { artist: "Artist", neon: "Neon", ember: "Ember", ocean: "Ocean" };
    var parts = await Promise.all([t(names[palette] || "Artist"), t("Palette")]);
    setText("paletteBadge", (parts[0] + " " + parts[1]).toUpperCase());
}

function nearestSlot() {
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
    var best = SLOT_SPECS[0];
    var bestScore = Infinity;
    for (var i = 0; i < SLOT_SPECS.length; i++) {
        var spec = SLOT_SPECS[i];
        var score = Math.abs(Math.log(w / spec.w)) + Math.abs(Math.log(h / spec.h));
        if (score < bestScore) { bestScore = score; best = spec; }
    }
    return best.id;
}

function applySlot() {
    document.body.setAttribute("data-slot", nearestSlot());
    requestAnimationFrame(function () { fitTypography(); });
}

function normalizeSeed(value) {
    var text = String(value || "").trim();
    try { text = text.normalize("NFKC"); } catch (e) { }
    return text.toLowerCase().replace(/\s+/g, " ");
}

function fnv1a(value) {
    var text = normalizeSeed(value);
    var hash = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
        state += 0x6D2B79F5;
        var t0 = state;
        t0 = Math.imul(t0 ^ (t0 >>> 15), t0 | 1);
        t0 ^= t0 + Math.imul(t0 ^ (t0 >>> 7), t0 | 61);
        return ((t0 ^ (t0 >>> 14)) >>> 0) / 4294967296;
    };
}

function wrapHue(h) { return ((h % 360) + 360) % 360; }

function paletteHues(seed, preset) {
    var r = mulberry32(seed ^ fnv1a(preset));
    var base;
    if (preset === "neon") base = 275 + r() * 42;
    else if (preset === "ember") base = 8 + r() * 38;
    else if (preset === "ocean") base = 184 + r() * 46;
    else base = r() * 360;

    var companion;
    var counter;
    if (preset === "neon") {
        companion = 316 + r() * 30;
        counter = 184 + r() * 28;
    } else if (preset === "ember") {
        companion = 34 + r() * 22;
        counter = 315 + r() * 24;
    } else if (preset === "ocean") {
        companion = 164 + r() * 32;
        counter = 226 + r() * 38;
    } else {
        companion = base + 24 + r() * 46;
        counter = base + 138 + r() * 72;
    }
    return [wrapHue(base), wrapHue(companion), wrapHue(counter), wrapHue(base - 28 - r() * 38)];
}

function gradientSeedText() {
    if (document.body.getAttribute("data-state") === "playing") {
        return normalizeSeed(currentTrack.artist) || normalizeSeed(currentTrack.title) || "packrat-now-playing";
    }
    if (document.body.getAttribute("data-state") === "unavailable") return "packrat-now-playing-unavailable";
    return "packrat-now-playing-idle";
}

function rebuildGradient(force) {
    var preset = currentPalette();
    var seedText = gradientSeedText();
    var key = seedText + "|" + preset;
    if (!force && gradientModel && gradientModel.key === key) return;

    var seed = fnv1a(key);
    var random = mulberry32(seed);
    var hues = paletteHues(seed, preset);
    var fields = [];
    for (var i = 0; i < 4; i++) {
        fields.push({
            hue: hues[i],
            saturation: preset === "artist" ? 72 + random() * 18 : 78 + random() * 16,
            lightness: 46 + random() * 16,
            x: 0.10 + random() * 0.80,
            y: 0.08 + random() * 0.84,
            radius: 0.34 + random() * 0.34,
            phaseX: random() * Math.PI * 2,
            phaseY: random() * Math.PI * 2,
            driftX: 0.025 + random() * 0.070,
            driftY: 0.025 + random() * 0.070,
            speed: 0.55 + random() * 0.90
        });
    }
    gradientModel = { key: key, seed: seed, fields: fields, rule: fields[1] };
    document.documentElement.style.setProperty(
        "--palette-rule",
        "hsl(" + Math.round(fields[1].hue) + " " + Math.round(fields[1].saturation) + "% 72%)"
    );
    drawGradient(performance.now(), true);
}

function fitCanvas(canvas) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        return true;
    }
    return false;
}

function drawGradient(timestamp, force) {
    if (!gradientModel) rebuildGradient(true);
    var canvas = document.getElementById("gradientCanvas");
    if (!canvas || !gradientModel) return;
    var cfg = readSettings();
    var reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }
    var moving = !reduced && cfg.motion > 0;
    if (!force && moving && timestamp - gradientLastFrame < 83) return;
    if (!force && !moving) return;
    gradientLastFrame = timestamp;

    fitCanvas(canvas);
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    var scale = Math.max(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = cfg.background;
    ctx.fillRect(0, 0, w, h);

    var motion = cfg.motion / 100;
    var seconds = timestamp / 1000;
    for (var i = 0; i < gradientModel.fields.length; i++) {
        var field = gradientModel.fields[i];
        var drift = moving ? motion : 0;
        var cx = (field.x + Math.sin(seconds * field.speed * 0.11 + field.phaseX) * field.driftX * drift) * w;
        var cy = (field.y + Math.cos(seconds * field.speed * 0.09 + field.phaseY) * field.driftY * drift) * h;
        var radius = field.radius * scale;
        var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, "hsla(" + field.hue + "," + field.saturation + "%," + field.lightness + "%,0.57)");
        grad.addColorStop(0.46, "hsla(" + field.hue + "," + field.saturation + "%," + (field.lightness - 8) + "%,0.24)");
        grad.addColorStop(1, "hsla(" + field.hue + "," + field.saturation + "%," + (field.lightness - 14) + "%,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }
}

function gradientLoop(timestamp) {
    drawGradient(timestamp, false);
    gradientRaf = requestAnimationFrame(gradientLoop);
}

function cssNumber(name, fallback) {
    try {
        var raw = getComputedStyle(document.body).getPropertyValue(name).trim();
        var value = parseFloat(raw);
        return Number.isFinite(value) ? value : fallback;
    } catch (e) { return fallback; }
}

function fitOne(element, viewport, cap, floor) {
    if (!element || !viewport) return;
    element.classList.remove("marquee");
    element.style.removeProperty("--marquee-shift");
    element.style.removeProperty("--marquee-duration");
    var low = floor;
    var high = Math.max(floor, cap);
    var available = Math.max(20, viewport.clientWidth - 2);
    var best = floor;

    for (var i = 0; i < 9; i++) {
        var mid = (low + high) / 2;
        element.style.fontSize = mid + "px";
        if (element.scrollWidth <= available) {
            best = mid;
            low = mid;
        } else {
            high = mid;
        }
    }
    element.style.fontSize = Math.floor(best * 10) / 10 + "px";

    if (element.scrollWidth > available + 1) {
        element.style.fontSize = floor + "px";
        var shift = Math.max(0, element.scrollWidth - available);
        element.style.setProperty("--marquee-shift", (-shift) + "px");
        element.style.setProperty("--marquee-duration", Math.max(6, Math.min(16, 6 + shift / 55)) + "s");
        element.classList.add("marquee");
    }
}

function fitTypography() {
    if (document.body.getAttribute("data-state") !== "playing") return;
    var trackCap = cssNumber("--track-cap", 92);
    var artistCap = cssNumber("--artist-cap", 30);
    /* Preserve the poster-like hierarchy on larger slots. The absolute floors are
     * safety rails, not a reason to turn a 208px headline into 28px body copy.
     * Once a title cannot fit at roughly half its intended hero size, marquee it. */
    var trackVisualFloor = Math.max(cssNumber("--track-floor", 24), trackCap * 0.50);
    var artistVisualFloor = Math.max(cssNumber("--artist-floor", 14), artistCap * 0.55);
    fitOne(
        document.getElementById("trackTitle"),
        document.getElementById("titleViewport"),
        trackCap,
        trackVisualFloor
    );
    fitOne(
        document.getElementById("trackArtist"),
        document.getElementById("artistViewport"),
        artistCap,
        artistVisualFloor
    );
}

function mediaPlugin() {
    try { return window.plugins && window.plugins.Mediadataprovider; }
    catch (e) { return null; }
}

function connectMediaSignal(plugin) {
    if (!plugin || mediaSignalPlugin === plugin) return !!plugin;
    if (!plugin.asyncResponse || typeof plugin.asyncResponse.connect !== "function") return false;
    try {
        plugin.asyncResponse.connect(function (requestId, value) {
            var pending = mediaPending[requestId];
            if (!pending) return;
            clearTimeout(pending.timer);
            delete mediaPending[requestId];
            pending.resolve(value);
        });
        mediaSignalPlugin = plugin;
        return true;
    } catch (e) { return false; }
}

function mediaAsk(method) {
    var plugin = mediaPlugin();
    if (!plugin || typeof plugin[method] !== "function" || !connectMediaSignal(plugin)) {
        return Promise.resolve(null);
    }
    var id = ++mediaRequestId;
    return new Promise(function (resolve) {
        var timer = setTimeout(function () {
            if (mediaPending[id]) delete mediaPending[id];
            resolve(null);
        }, 4000);
        mediaPending[id] = { resolve: resolve, timer: timer };
        try { plugin[method](id); }
        catch (e) {
            clearTimeout(timer);
            delete mediaPending[id];
            resolve(null);
        }
    });
}

function invokeTransport(method) {
    var plugin = mediaPlugin();
    if (!plugin || typeof plugin[method] !== "function") return;
    try { plugin[method](); } catch (e) { }
}

function historyItems() {
    var items = storeRead("history", []);
    return Array.isArray(items) ? items.slice(0, 8) : [];
}

function pushHistory(title, artist) {
    var key = normalizeSeed(title) + "\u0000" + normalizeSeed(artist);
    if (!title || key === lastHistoryKey) return;
    lastHistoryKey = key;
    var items = historyItems().filter(function (item) {
        return normalizeSeed(item.title) + "\u0000" + normalizeSeed(item.artist) !== key;
    });
    items.unshift({ title: title, artist: artist, at: Date.now() });
    storeWrite("history", items.slice(0, 8));
    renderHistory();
}

function renderHistory() {
    var list = document.getElementById("historyList");
    var panel = document.getElementById("historyPanel");
    if (!list || !panel) return;
    var items = historyItems();
    list.replaceChildren();
    panel.classList.toggle("is-empty", items.length === 0);
    setText("historyCount", String(items.length));
    items.slice(0, 6).forEach(function (item) {
        var li = document.createElement("li");
        li.className = "history-item";
        var title = document.createElement("div");
        title.className = "history-track";
        title.textContent = item.title;
        var artist = document.createElement("div");
        artist.className = "history-artist";
        artist.textContent = item.artist || "";
        li.appendChild(title);
        li.appendChild(artist);
        list.appendChild(li);
    });
}

async function setIdleCopy(unavailable) {
    if (!translationsReady) {
        setText("idleStatus", unavailable ? "iCUE Media provider unavailable" : "Nothing playing");
        setText("idleHint", unavailable ? "The panel will reconnect automatically" : "Start music in any Windows media app");
        return;
    }
    if (unavailable) {
        setText("idleStatus", await t("iCUE Media provider unavailable"));
        setText("idleHint", await t("The panel will reconnect automatically"));
    } else {
        setText("idleStatus", await t("Nothing playing"));
        setText("idleHint", await t("Start music in any Windows media app"));
    }
}

function renderState() {
    var state = document.body.getAttribute("data-state") || "idle";
    var unavailable = state === "unavailable";
    var playing = state === "playing";
    var controls = document.querySelectorAll(".transport-button");
    controls.forEach(function (button) { button.disabled = unavailable; });

    if (playing) {
        setText("trackTitle", currentTrack.title || "");
        setText("trackArtist", currentTrack.artist || "Unknown artist");
        requestAnimationFrame(fitTypography);
    } else {
        setIdleCopy(unavailable);
    }
    rebuildGradient(true);
}

function setMediaState(state, title, artist) {
    if (state === "playing") {
        currentTrack.title = String(title || "").trim();
        currentTrack.artist = String(artist || "").trim();
        pushHistory(currentTrack.title, currentTrack.artist);
    }
    document.body.setAttribute("data-state", state);
    renderState();
}

async function pollMedia() {
    if (polling) return;
    polling = true;
    try {
        var plugin = mediaPlugin();
        if (!plugin) {
            providerFailures++;
            setMediaState("unavailable");
            return;
        }
        connectMediaSignal(plugin);
        var result = await Promise.all([mediaAsk("getSongName"), mediaAsk("getArtist")]);
        var title = result[0];
        var artist = result[1];
        if (title === null && artist === null) {
            providerFailures++;
            if (providerFailures >= 2) setMediaState("unavailable");
            return;
        }
        providerFailures = 0;
        title = String(title || "").trim();
        artist = String(artist || "").trim();
        if (!title) setMediaState("idle");
        else setMediaState("playing", title, artist);
    } finally {
        polling = false;
    }
}

function updateClock() {
    var use24 = readSettings().use24;
    var d = new Date();
    var hours = d.getHours();
    var suffix = "";
    if (!use24) {
        suffix = hours >= 12 ? " PM" : " AM";
        hours = hours % 12 || 12;
    }
    var value = (use24 ? String(hours).padStart(2, "0") : String(hours)) + ":" + String(d.getMinutes()).padStart(2, "0") + suffix;
    setText("idleClock", value);
}

function startWidget() {
    if (uiStarted) return;
    uiStarted = true;

    applySlot();
    applySettings(true);
    renderHistory();
    updateClock();
    translateRuntime();

    document.getElementById("stage").addEventListener("click", function (event) {
        if (event.target.closest(".transport-button")) return;
        cyclePalette();
    });
    document.getElementById("previousControl").addEventListener("click", function (event) {
        event.stopPropagation(); invokeTransport("triggerPreviousTrack");
    });
    document.getElementById("playPauseControl").addEventListener("click", function (event) {
        event.stopPropagation(); invokeTransport("triggerPlayPause");
    });
    document.getElementById("nextControl").addEventListener("click", function (event) {
        event.stopPropagation(); invokeTransport("triggerNextTrack");
    });

    window.addEventListener("resize", function () {
        applySlot();
        rebuildGradient(true);
    });

    pollMedia();
    pollTimer = setInterval(pollMedia, 1000);
    setInterval(updateClock, 1000);
    gradientRaf = requestAnimationFrame(gradientLoop);
}

icueEvents = {
    onICUEInitialized: function () {
        startWidget();
        applySettings(true);
        translateRuntime();
        pollMedia();
    },
    onDataUpdated: function () {
        applySettings(true);
        translateRuntime();
        requestAnimationFrame(fitTypography);
    }
};

pluginMediadataproviderEvents = {
    onInitialized: function () {
        providerFailures = 0;
        pollMedia();
    }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWidget);
else startWidget();
