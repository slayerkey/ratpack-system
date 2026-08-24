/* PackRat Helldivers 2 Galactic War.
 *
 * Data comes only from https://api.helldivers2.dev/api/v1 using the exact
 * X-Super-Client and X-Super-Contact headers documented in the product spec.
 * No third party logos, game art, or faction insignia are used.
 */

var API_ROOT = "https://api.helldivers2.dev/api/v1";
var API_HEADERS = {
    "X-Super-Client": "packrat-xeneon",
    "X-Super-Contact": "slayerkey+ondiscord@gmail.com"
};
var ENDPOINTS = ["war", "campaigns", "assignments", "planets"];
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

var F_ACTIONS = {
    "Terminids": "#F49A34",
    "Terminid": "#F49A34",
    "Automaton": "#E05252",
    "Automatons": "#E05252",
    "Illuminate": "#4FA9F4",
    "Humans": "#E6D26C"
};

var TASK_TYPES = {
    2: "EXTRACT",
    3: "ERADICATE",
    7: "COMPLETE MISSIONS",
    9: "COMPLETE OPERATIONS",
    11: "LIBERATE",
    12: "DEFEND",
    13: "CONTROL",
    15: "EXPAND FRONT"
};

var appStarted = false;
var pollBusy = false;
var pollTimer = null;
var tickerTimer = null;
var countdownTimer = null;
var currentData = null;
var selectedCampaignId = null;
var orderMode = "briefing";
var recentChanges = [];
var translations = {};

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

function instanceKey(name) {
    var id = "packrat";
    try {
        if (typeof uniqueId !== "undefined" && uniqueId) id = String(uniqueId);
    } catch (e) {}
    return id + ":helldivers:" + name;
}

function readCache() {
    try {
        var raw = localStorage.getItem(instanceKey("snapshot"));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function writeCache(data) {
    try {
        localStorage.setItem(instanceKey("snapshot"), JSON.stringify({ savedAt: Date.now(), data: data }));
    } catch (e) {}
}

function safeNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.data)) return value.data;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.results)) return value.results;
    return [];
}

function asObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    if (value.data && typeof value.data === "object" && !Array.isArray(value.data)) return value.data;
    return value;
}

function cleanText(value) {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") {
        if (typeof value.message === "string") value = value.message;
        else if (typeof value.value === "string") value = value.value;
        else if (typeof value.en === "string") value = value.en;
        else if (typeof value.text === "string") value = value.text;
        else value = "";
    }
    return String(value)
        .replace(/<span\b[^>]*>/gi, "")
        .replace(/<\/span>/gi, "")
        .replace(/<i(?:=[^>]*)?>/gi, "")
        .replace(/<\/i>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

async function t(key) {
    try {
        if (typeof tr === "function") {
            var value = await tr(key);
            if (value !== undefined && value !== null && String(value)) return String(value);
        }
    } catch (e) {}
    return key;
}

async function loadTranslations() {
    var keys = [
        "GALACTIC WAR", "MAJOR ORDER", "ACTIVE CAMPAIGNS", "WAR STATUS",
        "ACTIVE FRONTS", "DIVERS", "FRONT PROGRESS", "WAR FEED", "EXPIRES IN",
        "CONNECTING", "LIVE", "STALE", "OFFLINE", "WAITING FOR DATA",
        "Priority fronts first", "TAP FOR OBJECTIVES", "TAP FOR BRIEFING", "TAP TO RETURN",
        "No active Major Order", "Galactic command has not issued a current assignment.",
        "No active campaigns", "The current war snapshot has no active fronts.",
        "War data unavailable", "The panel will retry automatically.",
        "SECTOR", "STATUS", "BIOME", "DEFENSE HELD", "LIBERATION", "REGION",
        "DEFENDING", "LIBERATING", "STABLE", "COUNTERATTACKING",
        "EXTRACT", "ERADICATE", "COMPLETE MISSIONS", "COMPLETE OPERATIONS",
        "LIBERATE", "DEFEND", "CONTROL", "EXPAND FRONT", "OBJECTIVE",
        "UPDATED", "AGO", "DIVERS DEPLOYED", "REMAINING", "CURRENT FRONT",
        "NO ACTIVE PLANET EVENTS", "API DATA IS CACHED"
    ];
    var values = await Promise.all(keys.map(function (key) { return t(key); }));
    keys.forEach(function (key, i) { translations[key] = values[i]; });
    document.querySelectorAll("[data-tr]").forEach(function (node) {
        var key = node.getAttribute("data-tr");
        if (translations[key]) node.textContent = translations[key];
    });
}
function L(key) { return translations[key] || key; }
function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }

function nearestSlot() {
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
    var best = SLOT_SPECS[0];
    var score = Infinity;
    SLOT_SPECS.forEach(function (spec) {
        var s = Math.abs(Math.log(w / spec.w)) + Math.abs(Math.log(h / spec.h));
        if (s < score) { score = s; best = spec; }
    });
    return best.id;
}
function applySlot() { document.body.setAttribute("data-slot", nearestSlot()); }

function applySettings() {
    var text = String(getIcueProperty("textColor", "#F4F6F8") || "#F4F6F8");
    var accent = String(getIcueProperty("accentColor", "#2BE86A") || "#2BE86A");
    var bg = String(getIcueProperty("backgroundColor", "#05080C") || "#05080C");
    document.documentElement.style.setProperty("--text", text);
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--bg", bg);
    document.getElementById("ticker").classList.toggle("hidden", getIcueProperty("showTicker", true) === false);
    restartPolling();
}

function refreshMs() {
    var minutes = safeNumber(getIcueProperty("refreshMinutes", 1), 1);
    return Math.max(60 * 1000, clamp(minutes, 1, 30) * 60 * 1000);
}

async function fetchJson(endpoint) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    try {
        var response = await fetch(API_ROOT + "/" + endpoint, {
            method: "GET",
            headers: API_HEADERS,
            signal: controller.signal,
            cache: "no-store"
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function loadSnapshot() {
    if (pollBusy) return;
    pollBusy = true;
    var cache = readCache();
    var base = cache && cache.data ? cache.data : {};
    var responses = await Promise.all(ENDPOINTS.map(fetchJson));
    var next = {
        war: base.war || null,
        campaigns: base.campaigns || [],
        assignments: base.assignments || [],
        planets: base.planets || []
    };
    var success = 0;
    ENDPOINTS.forEach(function (key, i) {
        if (responses[i] !== null) { next[key] = responses[i]; success += 1; }
    });

    var hasAny = success > 0 || Boolean(cache);
    if (!hasAny) {
        currentData = null;
        document.body.setAttribute("data-connection", "offline");
        setText("connectionBadge", L("OFFLINE"));
        document.getElementById("coldOffline").classList.remove("hidden");
        pollBusy = false;
        return;
    }

    document.getElementById("coldOffline").classList.add("hidden");
    if (success > 0) {
        writeCache(next);
        updateRecentChanges(currentData, next);
        currentData = next;
        document.body.setAttribute("data-connection", success === ENDPOINTS.length ? "live" : "stale");
        setText("connectionBadge", success === ENDPOINTS.length ? L("LIVE") : L("STALE"));
        renderAll();
    } else {
        currentData = cache.data;
        document.body.setAttribute("data-connection", "stale");
        setText("connectionBadge", L("STALE"));
        renderAll();
    }
    pollBusy = false;
}

function restartPolling() {
    if (!appStarted) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadSnapshot, refreshMs());
}

function getWar() { return asObject(currentData && currentData.war); }
function getCampaigns() { return asArray(currentData && currentData.campaigns); }
function getAssignments() { return asArray(currentData && currentData.assignments); }
function getPlanets() { return asArray(currentData && currentData.planets); }
function planetIndex(planet) { return safeNumber(planet && (planet.index !== undefined ? planet.index : planet.id), -1); }
function planetPlayers(planet) { var stats = planet && planet.statistics ? planet.statistics : {}; return safeNumber(stats.playerCount !== undefined ? stats.playerCount : stats.player_count, 0); }
function campaignPlayers(campaign) { return planetPlayers(campaign && campaign.planet); }
function factionName(campaign) { var value = cleanText(campaign && campaign.faction); return value || cleanText(campaign && campaign.planet && campaign.planet.currentOwner) || "Unknown"; }
function factionColor(name) { return F_ACTIONS[name] || "#8FA0B2"; }

function progressFraction(health, maxHealth) {
    health = safeNumber(health, 0);
    maxHealth = safeNumber(maxHealth, 0);
    if (maxHealth <= 0) return 0;
    return clamp(1 - health / maxHealth, 0, 1);
}

function leadingRegion(planet) {
    var regions = asArray(planet && planet.regions);
    var unlocked = regions.filter(function (region) {
        var available = region.isAvailable;
        if (available === undefined) available = region.is_available;
        return available !== false;
    });
    var pool = unlocked.length ? unlocked : regions.filter(function (region) { return progressFraction(region.health, region.maxHealth) > 0.0001; });
    if (!pool.length) return null;
    return pool.reduce(function (best, region) {
        if (!best) return region;
        var rp = progressFraction(region.health, region.maxHealth);
        var bp = progressFraction(best.health, best.maxHealth);
        if (Math.abs(rp - bp) > Number.EPSILON) return rp > bp ? region : best;
        return safeNumber(region.players, 0) > safeNumber(best.players, 0) ? region : best;
    }, null);
}

function campaignProgress(campaign) {
    var planet = campaign && campaign.planet ? campaign.planet : {};
    var event = planet.event || null;
    if (event) {
        var eventHealth = safeNumber(event.health, 0);
        var eventMax = safeNumber(event.maxHealth, 0);
        var held = eventMax > 0 ? clamp(eventHealth / eventMax * 100, 0, 100) : 0;
        return { value: held, label: L("DEFENSE HELD"), scope: "event", endTime: event.endTime || event.end_time || null };
    }
    var planetProgress = progressFraction(planet.health, planet.maxHealth);
    if (planetProgress >= 0.0001) return { value: planetProgress * 100, label: L("LIBERATION"), scope: "planet", endTime: null };
    var region = leadingRegion(planet);
    if (region) {
        var regionProgress = progressFraction(region.health, region.maxHealth);
        if (regionProgress >= 0.0001) return { value: regionProgress * 100, label: cleanText(region.name) || L("REGION"), scope: "region", endTime: null };
    }
    return { value: 0, label: region && cleanText(region.name) ? cleanText(region.name) : L("LIBERATION"), scope: "planet", endTime: null };
}

function isDefense(campaign) { return Boolean(campaign && campaign.planet && campaign.planet.event); }
function compareCampaigns(a, b) {
    var ap = campaignProgress(a), bp = campaignProgress(b);
    var ae = ap.endTime ? Date.parse(ap.endTime) : NaN;
    var be = bp.endTime ? Date.parse(bp.endTime) : NaN;
    if (Number.isFinite(ae) && Number.isFinite(be)) return ae - be;
    if (Number.isFinite(ae)) return -1;
    if (Number.isFinite(be)) return 1;
    if (Math.abs(ap.value - bp.value) > 0.001) return bp.value - ap.value;
    return campaignPlayers(b) - campaignPlayers(a);
}
function sortedCampaigns() { return getCampaigns().slice().sort(compareCampaigns); }

function totalPlayers() {
    var war = getWar();
    var stats = war.statistics || {};
    var count = safeNumber(stats.playerCount !== undefined ? stats.playerCount : stats.player_count, -1);
    if (count >= 0) return count;
    return getCampaigns().reduce(function (sum, campaign) { return sum + campaignPlayers(campaign); }, 0);
}

function frontProgress() {
    var campaigns = getCampaigns();
    if (!campaigns.length) return 0;
    var weighted = 0, weight = 0;
    campaigns.forEach(function (campaign) {
        var w = Math.max(1, campaignPlayers(campaign));
        weighted += campaignProgress(campaign).value * w;
        weight += w;
    });
    return weight ? weighted / weight : 0;
}

function compactNumber(value) {
    value = safeNumber(value, 0);
    if (value >= 1000000) return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (value >= 1000) return (value / 1000).toFixed(value >= 100000 ? 0 : 1).replace(/\.0$/, "") + "K";
    return Math.round(value).toLocaleString();
}
function percent(value, digits) { value = clamp(safeNumber(value, 0), 0, 100); return value.toFixed(digits === undefined ? 1 : digits).replace(/\.0+$/, "") + "%"; }

function durationParts(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    var total = Math.floor(ms / 1000);
    return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
function countdownText(iso, compact) {
    if (!iso) return "--";
    var end = Date.parse(iso);
    if (!Number.isFinite(end)) return "--";
    var parts = durationParts(end - Date.now());
    if (parts.d > 0) return compact ? parts.d + "D " + parts.h + "H" : parts.d + "D  " + String(parts.h).padStart(2, "0") + "H  " + String(parts.m).padStart(2, "0") + "M";
    if (parts.h > 0) return compact ? parts.h + "H " + parts.m + "M" : parts.h + "H  " + String(parts.m).padStart(2, "0") + "M  " + String(parts.s).padStart(2, "0") + "S";
    return parts.m + "M  " + String(parts.s).padStart(2, "0") + "S";
}
function elapsedText(ms) {
    ms = Math.max(0, safeNumber(ms, 0));
    if (ms < 60000) return Math.max(1, Math.floor(ms / 1000)) + "s";
    if (ms < 3600000) return Math.floor(ms / 60000) + "m";
    return Math.floor(ms / 3600000) + "h";
}

function currentAssignment() {
    var orders = getAssignments();
    var now = Date.now();
    var active = orders.filter(function (order) { var end = Date.parse(order.expiration || order.expires || order.endTime || ""); return !Number.isFinite(end) || end > now; });
    active.sort(function (a, b) { return Date.parse(a.expiration || "") - Date.parse(b.expiration || ""); });
    return active[0] || orders[0] || null;
}

function taskValue(task, wantedType) {
    if (!task) return null;
    if (task.values && !Array.isArray(task.values) && typeof task.values === "object") {
        var direct = task.values[wantedType];
        if (direct === undefined) direct = task.values[String(wantedType)];
        if (direct !== undefined) return safeNumber(direct, null);
    }
    var values = Array.isArray(task.values) ? task.values : [];
    var types = Array.isArray(task.valueTypes) ? task.valueTypes : (Array.isArray(task.value_types) ? task.value_types : []);
    for (var i = 0; i < Math.min(values.length, types.length); i++) if (safeNumber(types[i], -1) === wantedType) return safeNumber(values[i], null);
    return null;
}

function findPlanetByIndex(index) {
    index = safeNumber(index, -1);
    if (index < 0) return null;
    var campaigns = getCampaigns();
    for (var i = 0; i < campaigns.length; i++) if (planetIndex(campaigns[i].planet) === index) return campaigns[i].planet;
    var planets = getPlanets();
    for (var j = 0; j < planets.length; j++) if (planetIndex(planets[j]) === index) return planets[j];
    return null;
}
function findCampaignByPlanetIndex(index) {
    index = safeNumber(index, -1);
    return getCampaigns().find(function (campaign) { return planetIndex(campaign.planet) === index; }) || null;
}

function objectiveDetails(order) {
    var tasks = asArray(order && order.tasks);
    var progress = Array.isArray(order && order.progress) ? order.progress : [];
    return tasks.map(function (task, index) {
        var type = safeNumber(task.type, -1);
        var typeName = TASK_TYPES[type] || L("OBJECTIVE");
        var targetIndex = taskValue(task, 12);
        var goal = taskValue(task, 3);
        var raw = safeNumber(progress[index] !== undefined ? progress[index] : task.progress, 0);
        var targetPlanet = targetIndex !== null ? findPlanetByIndex(targetIndex) : null;
        var targetName = targetPlanet ? cleanText(targetPlanet.name) : "";
        var value = null, valueText = "";

        if (type === 11 && targetIndex !== null) {
            var liberationCampaign = findCampaignByPlanetIndex(targetIndex);
            if (liberationCampaign) { value = campaignProgress(liberationCampaign).value; valueText = percent(value, 1); }
            else if (targetPlanet) { value = progressFraction(targetPlanet.health, targetPlanet.maxHealth) * 100; valueText = percent(value, 1); }
        } else if (type === 12 && targetIndex !== null) {
            var defenseCampaign = findCampaignByPlanetIndex(targetIndex);
            if (defenseCampaign && defenseCampaign.planet && defenseCampaign.planet.event) { value = campaignProgress(defenseCampaign).value; valueText = percent(value, 1); }
            else if (targetPlanet) { value = cleanText(targetPlanet.currentOwner) === "Humans" ? 100 : 0; valueText = percent(value, 0); }
        } else if (type === 13 && targetPlanet) {
            value = cleanText(targetPlanet.currentOwner) === "Humans" ? 100 : 0;
            valueText = percent(value, 0);
        } else if (goal !== null && goal > 0) {
            value = clamp(raw / goal * 100, 0, 100);
            valueText = compactNumber(raw) + " / " + compactNumber(goal);
        }

        var name = L(typeName);
        if (targetName) name += " " + targetName;
        return { name: name, value: value, valueText: valueText || "--", indeterminate: value === null };
    });
}

function renderOrder() {
    var order = currentAssignment();
    var content = document.getElementById("orderContent");
    var empty = document.getElementById("orderEmpty");
    var briefing = document.getElementById("orderBriefing");
    var objectives = document.getElementById("orderObjectives");
    document.body.setAttribute("data-order-mode", orderMode);
    setText("orderModeHint", orderMode === "briefing" ? L("TAP FOR OBJECTIVES") : L("TAP FOR BRIEFING"));

    if (!order) { content.classList.add("hidden"); empty.classList.remove("hidden"); return; }
    content.classList.remove("hidden"); empty.classList.add("hidden");
    setText("orderTitle", cleanText(order.title) || L("MAJOR ORDER"));
    setText("orderBriefing", cleanText(order.briefing || order.description) || L("MAJOR ORDER"));
    setText("orderCountdown", countdownText(order.expiration, nearestSlot().indexOf("s-") === 0));
    briefing.classList.toggle("hidden", orderMode !== "briefing");
    objectives.classList.toggle("hidden", orderMode !== "objectives");

    var details = objectiveDetails(order);
    var rows = document.getElementById("objectiveRows"); rows.replaceChildren();
    var segments = document.getElementById("orderSegments"); segments.replaceChildren();
    if (!details.length) { var unknown = document.createElement("div"); unknown.className = "order-segment indeterminate"; segments.appendChild(unknown); return; }

    details.forEach(function (detail) {
        var row = document.createElement("div"); row.className = "objective-row";
        var name = document.createElement("div"); name.className = "objective-name"; name.textContent = detail.name;
        var value = document.createElement("div"); value.className = "objective-value"; value.textContent = detail.valueText;
        row.appendChild(name); row.appendChild(value); rows.appendChild(row);
        var segment = document.createElement("div"); segment.className = "order-segment" + (detail.indeterminate ? " indeterminate" : "");
        if (!detail.indeterminate) { var fill = document.createElement("span"); fill.style.width = clamp(detail.value, 0, 100) + "%"; segment.appendChild(fill); }
        segments.appendChild(segment);
    });
}

function campaignCard(campaign, index) {
    var planet = campaign.planet || {};
    var faction = factionName(campaign);
    var progress = campaignProgress(campaign);
    var button = document.createElement("button");
    button.type = "button"; button.className = "campaign-card interactive";
    button.style.setProperty("--faction-color", factionColor(faction));
    button.setAttribute("data-campaign-id", String(campaign.id));
    button.setAttribute("aria-label", cleanText(planet.name) + " " + percent(progress.value, 1));

    var top = document.createElement("div"); top.className = "card-top";
    var names = document.createElement("div");
    var planetName = document.createElement("div"); planetName.className = "card-planet"; planetName.textContent = cleanText(planet.name) || "Unknown planet";
    var factionEl = document.createElement("div"); factionEl.className = "card-faction"; factionEl.textContent = faction;
    names.appendChild(planetName); names.appendChild(factionEl); top.appendChild(names);

    if (isDefense(campaign)) {
        var priority = document.createElement("div"); priority.className = "card-priority"; priority.textContent = L("DEFENDING"); top.appendChild(priority);
    } else if (index === 0) {
        var first = document.createElement("div"); first.className = "card-priority"; first.textContent = L("CURRENT FRONT"); top.appendChild(first);
    }

    var progressEl = document.createElement("div"); progressEl.className = "card-progress"; progressEl.textContent = percent(progress.value, 1);
    var progressLabel = document.createElement("div"); progressLabel.className = "card-progress-label"; progressLabel.textContent = progress.label;
    var track = document.createElement("div"); track.className = "progress-track card-track";
    var fill = document.createElement("span"); fill.style.width = clamp(progress.value, 0, 100) + "%"; track.appendChild(fill);

    var bottom = document.createElement("div"); bottom.className = "card-bottom";
    var players = document.createElement("div"); players.className = "card-players";
    var playersValue = document.createElement("strong"); playersValue.textContent = compactNumber(campaignPlayers(campaign));
    var playersLabel = document.createElement("span"); playersLabel.textContent = L("DIVERS");
    players.appendChild(playersValue); players.appendChild(playersLabel); bottom.appendChild(players);

    if (progress.endTime) {
        var time = document.createElement("div"); time.className = "card-time";
        var timeValue = document.createElement("strong"); timeValue.textContent = countdownText(progress.endTime, true);
        var timeLabel = document.createElement("span"); timeLabel.textContent = L("REMAINING");
        time.appendChild(timeValue); time.appendChild(timeLabel); bottom.appendChild(time);
    }

    button.appendChild(top); button.appendChild(progressEl); button.appendChild(progressLabel); button.appendChild(track); button.appendChild(bottom);
    button.addEventListener("click", function () { selectedCampaignId = campaign.id; renderCampaignDetail(); });
    return button;
}

function renderCampaigns() {
    var campaigns = sortedCampaigns();
    var rail = document.getElementById("campaignRail");
    var empty = document.getElementById("campaignEmpty");
    rail.replaceChildren(); setText("campaignCount", String(campaigns.length));
    if (!campaigns.length) { empty.classList.remove("hidden"); rail.classList.add("hidden"); document.getElementById("campaignDetail").classList.add("hidden"); return; }
    empty.classList.add("hidden"); rail.classList.remove("hidden");
    campaigns.forEach(function (campaign, index) { rail.appendChild(campaignCard(campaign, index)); });
    renderCampaignDetail();
}

function campaignStatus(campaign) {
    var planet = campaign.planet || {};
    if (planet.event) return L("DEFENDING");
    var maxHealth = safeNumber(planet.maxHealth, 0);
    var regen = safeNumber(planet.regenPerSecond, 0);
    var rate = maxHealth > 0 ? regen * 3600 / maxHealth * 100 : 0;
    if (rate < 0) return L("LIBERATING");
    if (rate > 0.5) return L("COUNTERATTACKING");
    return L("STABLE");
}

function renderCampaignDetail() {
    var detail = document.getElementById("campaignDetail");
    var rail = document.getElementById("campaignRail");
    if (selectedCampaignId === null || selectedCampaignId === undefined) { detail.classList.add("hidden"); rail.classList.remove("hidden"); return; }
    var campaign = getCampaigns().find(function (item) { return String(item.id) === String(selectedCampaignId); });
    if (!campaign) { selectedCampaignId = null; detail.classList.add("hidden"); rail.classList.remove("hidden"); return; }

    var planet = campaign.planet || {}, faction = factionName(campaign), progress = campaignProgress(campaign), color = factionColor(faction);
    rail.classList.add("hidden"); detail.classList.remove("hidden"); detail.style.setProperty("--detail-color", color);
    setText("detailFaction", faction); setText("detailPlanet", cleanText(planet.name) || "Unknown planet");
    setText("detailProgress", percent(progress.value, 2)); setText("detailProgressLabel", progress.label);
    setText("detailPlayers", compactNumber(planetPlayers(planet))); setText("detailSector", cleanText(planet.sector) || "--");
    setText("detailStatus", campaignStatus(campaign)); setText("detailBiome", cleanText(planet.biome && (planet.biome.name || planet.biome)) || "--");
    document.getElementById("detailProgressBar").style.width = clamp(progress.value, 0, 100) + "%";

    var context = document.getElementById("detailContext"); context.replaceChildren();
    var region = leadingRegion(planet);
    if (region && cleanText(region.name)) {
        var regionChip = document.createElement("div"); regionChip.className = "detail-chip";
        regionChip.textContent = L("REGION") + "  " + cleanText(region.name) + "  " + percent(progressFraction(region.health, region.maxHealth) * 100, 1);
        context.appendChild(regionChip);
    }
    asArray(planet.hazards).slice(0, 3).forEach(function (hazard) {
        var chip = document.createElement("div"); chip.className = "detail-chip"; chip.textContent = cleanText(hazard.name || hazard) || "";
        if (chip.textContent) context.appendChild(chip);
    });
    if (progress.endTime) {
        var timeChip = document.createElement("div"); timeChip.className = "detail-chip";
        timeChip.textContent = countdownText(progress.endTime, false) + " " + L("REMAINING"); context.appendChild(timeChip);
    }
}

function renderWar() {
    var campaigns = getCampaigns(), players = totalPlayers(), progress = frontProgress();
    setText("warFronts", String(campaigns.length)); setText("warPlayers", compactNumber(players)); setText("warProgress", percent(progress, 1));
    setText("globalPlayers", compactNumber(players) + " " + L("DIVERS DEPLOYED"));
    var counts = {};
    campaigns.forEach(function (campaign) { var faction = factionName(campaign); counts[faction] = (counts[faction] || 0) + 1; });
    var summary = document.getElementById("factionSummary"); summary.replaceChildren();
    Object.keys(counts).sort().forEach(function (faction) {
        var chip = document.createElement("div"); chip.className = "faction-chip"; chip.style.setProperty("--faction-color", factionColor(faction));
        chip.textContent = faction + " " + counts[faction]; summary.appendChild(chip);
    });
}

function campaignProgressWithData(campaign) {
    var planet = campaign && campaign.planet ? campaign.planet : {};
    if (planet.event) { var max = safeNumber(planet.event.maxHealth, 0), health = safeNumber(planet.event.health, 0); return { value: max > 0 ? clamp(health / max * 100, 0, 100) : 0 }; }
    var p = progressFraction(planet.health, planet.maxHealth);
    if (p > 0.0001) return { value: p * 100 };
    var region = leadingRegion(planet); return { value: region ? progressFraction(region.health, region.maxHealth) * 100 : 0 };
}
function campaignSnapshot(data) {
    var campaigns = asArray(data && data.campaigns), out = {};
    campaigns.forEach(function (campaign) {
        var planet = campaign.planet || {}, progress = campaignProgressWithData(campaign);
        out[String(campaign.id)] = { planet: cleanText(planet.name), progress: progress.value, defense: Boolean(planet.event), players: planetPlayers(planet) };
    });
    return out;
}

function updateRecentChanges(previous, next) {
    if (!previous || !next) return;
    var before = campaignSnapshot(previous), after = campaignSnapshot(next), changes = [];
    Object.keys(after).forEach(function (id) {
        var now = after[id], old = before[id];
        if (!old) { changes.push(now.planet + " joined the active fronts"); return; }
        if (!old.defense && now.defense) changes.push("Defense started on " + now.planet);
        var oldBucket = Math.floor(old.progress / 5), newBucket = Math.floor(now.progress / 5);
        if (newBucket > oldBucket && now.progress > old.progress) changes.push(now.planet + " reached " + percent(now.progress, 1));
        if (Math.abs(now.players - old.players) >= Math.max(500, old.players * 0.25)) changes.push(compactNumber(now.players) + " " + L("DIVERS") + " on " + now.planet);
    });
    if (changes.length) recentChanges = changes.slice(0, 6).concat(recentChanges).slice(0, 10);
}

function tickerMessages() {
    var messages = [], campaigns = sortedCampaigns();
    campaigns.forEach(function (campaign) {
        if (!campaign.planet || !campaign.planet.event) return;
        var p = campaignProgress(campaign), planet = cleanText(campaign.planet.name);
        messages.push("DEFENSE ON " + planet + "  " + countdownText(p.endTime, true) + " " + L("REMAINING"));
    });
    recentChanges.slice(0, 4).forEach(function (message) { if (messages.indexOf(message) < 0) messages.push(message); });
    campaigns.slice(0, 4).forEach(function (campaign) {
        var planet = cleanText(campaign.planet && campaign.planet.name), p = campaignProgress(campaign);
        var current = planet + "  " + percent(p.value, 1) + "  " + compactNumber(campaignPlayers(campaign)) + " " + L("DIVERS");
        if (messages.indexOf(current) < 0) messages.push(current);
    });
    if (!messages.length) messages.push(L("NO ACTIVE PLANET EVENTS"));
    return messages;
}
function renderTicker() { var joined = tickerMessages().join("   •   "); setText("tickerTrack", joined + "   •   " + joined + "   •   "); }

function renderConnectionAge() {
    var cache = readCache();
    if (!cache) { setText("updatedText", L("WAITING FOR DATA")); return; }
    setText("updatedText", L("UPDATED") + " " + elapsedText(Date.now() - safeNumber(cache.savedAt, Date.now())) + " " + L("AGO"));
}

function renderAll() {
    if (!currentData) return;
    renderOrder(); renderCampaigns(); renderWar(); renderTicker(); renderConnectionAge();
}
function updateClocks() {
    if (!currentData) return;
    renderOrder(); renderCampaigns(); renderTicker(); renderConnectionAge();
}

function startWidget() {
    if (appStarted) return;
    appStarted = true;
    applySlot();
    loadTranslations().then(function () {
        applySettings();
        var cache = readCache();
        if (cache && cache.data) {
            currentData = cache.data;
            document.body.setAttribute("data-connection", "stale");
            setText("connectionBadge", L("STALE"));
            renderAll();
        }
        loadSnapshot();
    });

    document.getElementById("majorOrder").addEventListener("click", function () { orderMode = orderMode === "briefing" ? "objectives" : "briefing"; renderOrder(); });
    document.getElementById("campaignDetail").addEventListener("click", function () { selectedCampaignId = null; renderCampaignDetail(); });
    window.addEventListener("resize", function () { applySlot(); renderAll(); });
    countdownTimer = setInterval(updateClocks, 1000);
    tickerTimer = setInterval(renderTicker, 10000);
}

icueEvents = {
    onICUEInitialized: function () { startWidget(); applySettings(); loadSnapshot(); },
    onDataUpdated: function () { applySettings(); renderAll(); }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startWidget, { once: true });
else startWidget();
