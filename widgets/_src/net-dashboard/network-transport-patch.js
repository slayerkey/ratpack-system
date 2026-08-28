/* Real iCUE transport patch.
 * Imported iCUE widgets execute from a file:// origin. Requiring arbitrary probe
 * targets to return CORS headers prevents otherwise reachable HTTPS hosts from
 * ever producing latency data. An opaque no-cors fetch still gives us honest
 * request-to-response timing without exposing cross-origin response contents.
 */
(function () {
  'use strict';

  if (typeof probeHost !== 'function' || typeof fetchWithTimeout !== 'function' || typeof cacheBusted !== 'function') return;

  probeHost = async function (host) {
    var start = performance.now();
    try {
      var response = await fetchWithTimeout(cacheBusted(host.url), {
        method: 'GET',
        cache: 'no-store',
        mode: 'no-cors',
        credentials: 'omit',
        redirect: 'follow'
      }, PRIMARY_TIMEOUT_MS);
      var elapsed = performance.now() - start;
      if (!response) return { ok: false, ms: null, status: 0 };
      try {
        if (response.body && typeof response.body.cancel === 'function') response.body.cancel();
      } catch (error) {}
      return {
        ok: true,
        ms: Math.max(0, elapsed),
        status: response.type === 'opaque' ? 0 : Number(response.status || 0)
      };
    } catch (error) {
      return { ok: false, ms: null, status: 0 };
    }
  };

  globalThis.__packratNetTransport = {
    version: 2,
    mode: 'opaque-https-timing',
    description: 'HTTPS response timing from a file-origin-safe no-cors request; not ICMP ping.'
  };
})();
