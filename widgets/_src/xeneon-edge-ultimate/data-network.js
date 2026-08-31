function relativeEvent(event) {
  var mins = Math.round((event.start.getTime() - Date.now()) / 60000);
  if (mins <= 0 && event.end.getTime() > Date.now()) return "NOW";
  if (mins < 60) return "IN " + Math.max(1, mins) + "M";
  if (mins < 24 * 60) return "IN " + Math.round(mins / 60) + "H";
  return event.start.toLocaleDateString(undefined, { weekday:"short" }).toUpperCase();
}

async function probeNetwork() {
  if (state.preview) {
    var phase = Date.now() / 1000;
    var elapsedPreview = Math.round(31 + Math.sin(phase / 4.8) * 7 + Math.sin(phase * 1.2) * 2);
    state.network.current = elapsedPreview;
    state.network.verified += 1;
    state.network.lastOk = Date.now();
    pushHistory("network", elapsedPreview);
    state.network.jitter = 3 + Math.abs(Math.sin(phase / 3)) * 2;
    state.network.state = "stable";
    renderNetwork(); renderContext(); return;
  }
  var started = performance.now();
  try {
    await fetch("https://www.cloudflare.com/cdn-cgi/trace?packrat=" + Date.now(), { mode: "no-cors", cache: "no-store" });
    var elapsed = Math.round(performance.now() - started);
    state.network.current = elapsed;
    state.network.verified += 1;
    state.network.lastOk = Date.now();
    pushHistory("network", elapsed);
    var values = state.history.network.slice(-8).map(function (x) { return x.value; });
    if (values.length >= 2) {
      var diffs = [];
      for (var i=1;i<values.length;i++) diffs.push(Math.abs(values[i]-values[i-1]));
      state.network.jitter = diffs.reduce(function(a,b){return a+b;},0)/diffs.length;
    }
    state.network.state = elapsed > 220 ? "degraded" : elapsed > 120 ? "fair" : "stable";
  } catch (e) {
    state.network.failures += 1;
    state.network.state = state.network.failures >= 2 ? "degraded" : "checking";
  }
  renderNetwork();
  renderContext();
}

function renderNetwork() {
  var n = state.network;
  var label = n.current === null ? "Checking" : (n.state === "stable" ? "Stable" : n.state === "fair" ? "Fair" : "Degraded");
  setText("networkText", n.current === null ? label : label + " • " + n.current + " ms");
  setText("perfNet", n.current === null ? "— ms" : n.current + " ms");
  setText("perfNetworkState", label.toUpperCase());
  drawNetworkSpark();
}
