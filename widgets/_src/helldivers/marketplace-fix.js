/* Marketplace rejection recovery for the live Helldivers transport.
 *
 * Fixes two installed-runtime failures:
 * 1. onICUEInitialized no longer starts a second four-endpoint snapshot while the
 *    DOM startup snapshot is already in flight. The upstream API currently limits
 *    clients to five requests per ten seconds, so the old eight-request burst could
 *    rate-limit a clean install.
 * 2. Transport failures retain their actual reason instead of collapsing every
 *    non-success response into a blank/offline panel.
 */
(function () {
    var recoveryRetryTimer = null;

    function setColdState(kind) {
        var badge = {
            loading: "LOADING",
            network: "NO CONNECTION",
            offline: "API OFFLINE",
            bad: "BAD RESPONSE",
            rate: "RATE LIMITED",
            empty: "NO DATA"
        }[kind] || "OFFLINE";
        var title = {
            loading: "Loading war data",
            network: "No network connection",
            offline: "Helldivers API offline",
            bad: "Helldivers API returned an invalid response",
            rate: "Helldivers API rate limited this request",
            empty: "No current war data"
        }[kind] || "War data unavailable";
        var copy = {
            loading: "Contacting the Galactic War service.",
            network: "Check your connection. The panel will retry automatically.",
            offline: "The service is unavailable. The panel will retry automatically.",
            bad: "The service responded, but the data could not be used. The panel will retry.",
            rate: "The panel will retry after the API limit clears.",
            empty: "The service is reachable but returned no usable war snapshot."
        }[kind] || "The panel will retry automatically.";
        document.body.setAttribute("data-connection", kind);
        setText("connectionBadge", badge);
        var cold = document.getElementById("coldOffline");
        if (cold) cold.classList.remove("hidden");
        var titleNode = cold && cold.querySelector(".offline-title");
        var copyNode = cold && cold.querySelector(".offline-copy");
        if (titleNode) titleNode.textContent = title;
        if (copyNode) copyNode.textContent = copy;
    }

    function scheduleRecoveryRetry(kind) {
        clearTimeout(recoveryRetryTimer);
        var delay = kind === "rate" ? 11000 : 8000;
        recoveryRetryTimer = setTimeout(function () { loadSnapshot(); }, delay);
    }

    function classifyFailure(results) {
        if (results.some(function (item) { return item.error === "rate"; })) return "rate";
        if (results.some(function (item) { return item.error === "offline"; })) return "offline";
        if (results.some(function (item) { return item.error === "bad"; })) return "bad";
        return "network";
    }

    function hasMeaningfulData(data) {
        if (!data) return false;
        if (Object.keys(asObject(data.war)).length) return true;
        return asArray(data.campaigns).length > 0 || asArray(data.assignments).length > 0 || asArray(data.planets).length > 0;
    }

    fetchJson = async function (endpoint) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 8000);
        try {
            var response = await fetch(API_ROOT + "/" + endpoint, {
                method: "GET",
                headers: API_HEADERS,
                signal: controller.signal,
                cache: "no-store"
            });
            if (response.status === 429) return { endpoint: endpoint, ok: false, status: 429, error: "rate" };
            if (response.status >= 500) return { endpoint: endpoint, ok: false, status: response.status, error: "offline" };
            if (!response.ok) return { endpoint: endpoint, ok: false, status: response.status, error: "bad" };
            try {
                return { endpoint: endpoint, ok: true, status: response.status, data: await response.json() };
            } catch (error) {
                return { endpoint: endpoint, ok: false, status: response.status, error: "bad" };
            }
        } catch (error) {
            return { endpoint: endpoint, ok: false, status: 0, error: "network", detail: error && error.name === "AbortError" ? "timeout" : "fetch" };
        } finally {
            clearTimeout(timer);
        }
    };

    loadSnapshot = async function () {
        if (pollBusy) return;
        pollBusy = true;
        if (!currentData) setColdState("loading");

        var cache = readCache();
        var base = cache && cache.data ? cache.data : {};
        var results = await Promise.all(ENDPOINTS.map(fetchJson));
        var next = {
            war: base.war || null,
            campaigns: base.campaigns || [],
            assignments: base.assignments || [],
            planets: base.planets || []
        };
        var success = 0;
        results.forEach(function (result) {
            if (!result.ok) return;
            next[result.endpoint] = result.data;
            success += 1;
        });

        if (success === 0 && !cache) {
            currentData = null;
            var failure = classifyFailure(results);
            setColdState(failure);
            scheduleRecoveryRetry(failure);
            pollBusy = false;
            return;
        }

        if (success > 0 && !hasMeaningfulData(next) && !cache) {
            currentData = next;
            setColdState("empty");
            scheduleRecoveryRetry("empty");
            pollBusy = false;
            return;
        }

        clearTimeout(recoveryRetryTimer);
        var cold = document.getElementById("coldOffline");
        if (cold) cold.classList.add("hidden");
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
            scheduleRecoveryRetry(classifyFailure(results));
        }
        pollBusy = false;
    };

    if (globalThis.icueEvents) {
        globalThis.icueEvents.onICUEInitialized = function () {
            startWidget();
            applySettings();
        };
    }

    globalThis.__packratHelldiversRecovery = { version: 1 };

    try {
        if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) {
            Promise.resolve().then(function () {
                if (globalThis.icueEvents && typeof globalThis.icueEvents.onICUEInitialized === "function") globalThis.icueEvents.onICUEInitialized();
            });
        }
    } catch (error) {}
})();
