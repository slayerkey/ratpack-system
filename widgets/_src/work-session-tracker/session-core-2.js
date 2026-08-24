  function startSession(name, kind, project) {
    if (state.active || !actionAllowed()) return false;
    var clean = cleanName(name, kind);
    var now = nowMs();
    state.active = {
      id: nextId('active'), name: clean, projectId: project ? project.id : null,
      color: project ? safeColor(project.color) : PALETTE[selectedColor % PALETTE.length],
      kind: kind === 'break' ? 'break' : 'focus', startedAtMs: now, status: 'running',
      segments: [{ startMs: now, endMs: null }]
    };
    if (kind !== 'break') state.lastProjectName = clean;
    saveState(); render();
    return true;
  }

  function pauseSession() {
    if (!state.active || state.active.status !== 'running' || !actionAllowed()) return false;
    var open = openSegment(state.active);
    if (open) open.endMs = Math.max(open.startMs, nowMs());
    state.active.status = 'paused';
    saveState(); render();
    return true;
  }

  function resumeSession() {
    if (!state.active || state.active.status !== 'paused' || !actionAllowed()) return false;
    var now = nowMs();
    state.active.status = 'running';
    state.active.segments.push({ startMs: now, endMs: null });
    saveState(); render();
    return true;
  }

  function finishSession() {
    if (!state.active || !actionAllowed()) return false;
    var now = nowMs();
    var active = state.active;
    if (active.status === 'running') {
      var open = openSegment(active);
      if (open) open.endMs = Math.max(open.startMs, now);
    }
    var total = durationSegments(active.segments, now);
    if (total >= 1000) {
      state.sessions.push({
        id: nextId('session'), name: active.name, projectId: active.projectId, color: active.color,
        kind: active.kind, startedAtMs: active.startedAtMs, endedAtMs: now,
        segments: active.segments.map(function (s) { return { startMs: s.startMs, endMs: s.endMs === null ? now : s.endMs }; }),
        manualAdjustmentMs: 0
      });
    }
    state.active = null;
    saveState(); render();
    return true;
  }

  function cleanName(name, kind) {
    var text = String(name || '').trim().replace(/\s+/g, ' ');
    if (!text) return kind === 'break' ? 'Break' : 'Focus Session';
    return text.slice(0, 72);
  }

  function durationSegments(segments, atMs) {
    return (segments || []).reduce(function (sum, segment) {
      var end = segment.endMs === null ? atMs : segment.endMs;
      return sum + Math.max(0, end - segment.startMs);
    }, 0);
  }

  function sessionDuration(session) {
    return Math.max(0, durationSegments(session.segments, session.endedAtMs) + Number(session.manualAdjustmentMs || 0));
  }

  function dayBounds(ms) {
    var d = new Date(ms);
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    return { start: start, end: next };
  }

  function overlapMs(a, b, c, d) { return Math.max(0, Math.min(b, d) - Math.max(a, c)); }

  function contributionForDay(item, bounds, atMs) {
    if (!item || item.kind === 'break') return 0;
    var base = (item.segments || []).reduce(function (sum, segment) {
      var end = segment.endMs === null ? atMs : segment.endMs;
      return sum + overlapMs(segment.startMs, end, bounds.start, bounds.end);
    }, 0);
    if (item.manualAdjustmentMs && item.endedAtMs >= bounds.start && item.endedAtMs < bounds.end) {
      base += Number(item.manualAdjustmentMs || 0);
    }
    return Math.max(0, base);
  }

  function focusForDay(ms) {
    var bounds = dayBounds(ms);
    var at = nowMs();
    var total = state.sessions.reduce(function (sum, session) { return sum + contributionForDay(session, bounds, at); }, 0);
    if (state.active) total += contributionForDay(state.active, bounds, at);
    return Math.max(0, total);
  }

  function sessionsForDay(ms, includeActive) {
    var bounds = dayBounds(ms);
    var items = state.sessions.filter(function (session) {
      return session.segments.some(function (segment) {
        return overlapMs(segment.startMs, segment.endMs, bounds.start, bounds.end) > 0;
      });
    }).slice();
    if (includeActive && state.active && state.active.segments.some(function (segment) {
      var end = segment.endMs === null ? nowMs() : segment.endMs;
      return overlapMs(segment.startMs, end, bounds.start, bounds.end) > 0;
    })) items.push(activeAsSession());
    return items.sort(function (a, b) { return a.startedAtMs - b.startedAtMs; });
  }

  function activeAsSession() {
    if (!state.active) return null;
    return {
      id: state.active.id, name: state.active.name, projectId: state.active.projectId, color: state.active.color,
      kind: state.active.kind, startedAtMs: state.active.startedAtMs, endedAtMs: nowMs(),
      segments: state.active.segments.map(function (segment) {
        return { startMs: segment.startMs, endMs: segment.endMs === null ? nowMs() : segment.endMs };
      }), manualAdjustmentMs: 0, active: true, status: state.active.status
    };
  }

  function pruneHistory() {
    var keepDays = IS_PRO ? 120 : 8;
    var cutoff = nowMs() - keepDays * 86400000;
    var maxSessions = IS_PRO ? 1500 : 150;
    state.sessions = state.sessions.filter(function (session) { return session.endedAtMs >= cutoff; }).slice(-maxSessions);
    if (IS_PRO) state.projects = state.projects.slice(0, 30);
    else state.projects = [];
  }

  function saveProject(name) {
    if (!IS_PRO || !actionAllowed()) return false;
    var clean = cleanName(name, 'focus');
    var existing = state.projects.find(function (project) { return project.name.toLowerCase() === clean.toLowerCase(); });
    if (existing) {
      existing.color = PALETTE[selectedColor % PALETTE.length];
    } else if (state.projects.length < 30) {
      state.projects.unshift({ id: nextId('project'), name: clean, color: PALETTE[selectedColor % PALETTE.length] });
    }
    state.lastProjectName = clean;
    saveState(); render();
    return true;
  }

  function cycleColor() {
    if (!IS_PRO) return;
    selectedColor = (selectedColor + 1) % PALETTE.length;
    var node = byId('colorDot'); if (node) node.style.background = PALETTE[selectedColor];
  }

  function adjustLast(minutes) {
    if (!IS_PRO || !actionAllowed()) return false;
    var session = state.sessions.slice().reverse().find(function (item) { return item.kind === 'focus'; });
    if (!session) return false;
    var base = durationSegments(session.segments, session.endedAtMs);
    var next = Number(session.manualAdjustmentMs || 0) + Number(minutes) * 60000;
    session.manualAdjustmentMs = Math.max(-base + 60000, Math.min(12 * 3600000, next));
    saveState(); render();
    return true;
  }

  function deleteLast() {
    if (!IS_PRO || !actionAllowed()) return false;
    for (var i = state.sessions.length - 1; i >= 0; i--) {
      if (state.sessions[i].kind === 'focus') { state.sessions.splice(i, 1); saveState(); render(); return true; }
    }
    return false;
  }

  function formatDuration(ms, compact) {
    ms = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(ms / 3600); var m = Math.floor((ms % 3600) / 60); var s = ms % 60;
    if (compact) return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm';
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function formatTime(ms) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
  }

  function formatDay(ms) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(ms)).toUpperCase();
  }

  function formatShortDate(ms) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ms));
  }

  function nearestSlot() {
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 840);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 344);
    var best = SLOT_SPECS[0], score = Infinity;
    SLOT_SPECS.forEach(function (item) {
      var next = Math.abs(Math.log(w / item.w)) + Math.abs(Math.log(h / item.h));
      if (next < score) { score = next; best = item; }
    });
    return best.id;
  }

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; });
  }

