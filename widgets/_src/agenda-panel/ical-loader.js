/* ical.js 2.2.1, MPL-2.0. Exact Calendar Sync Pro dependency restored from a deterministic gzip payload. */
globalThis.__packratIcalReady = (async function () {
  try {
    if (typeof DecompressionStream !== "function") return false;
    var packed = (globalThis.__packratIcalPacked || []).join("");
    globalThis.__packratIcalPacked = [];
    var binary = atob(packed);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    var source = await new Response(stream).text();
    var script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
    script.remove();
    return !!globalThis.ICAL;
  } catch (error) {
    return false;
  }
})();
