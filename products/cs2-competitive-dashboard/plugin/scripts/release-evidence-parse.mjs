export function latestProcessSegment(text) {
  const latestStart = text.lastIndexOf("plugin process started");
  return latestStart >= 0 ? text.slice(text.lastIndexOf("\n", latestStart) + 1) : text;
}

export function logLines(session) {
  return session.split(/\r?\n/).filter(Boolean);
}

export function highestPacketCheckpoint(session) {
  const lines = logLines(session);
  let highest = session.includes("first GSI payload received") ? 1 : 0;
  for (const line of lines.filter((entry) => entry.includes("GSI payload heartbeat"))) {
    const match = line.match(/"requestCount":(\d+)/);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

export function providersReadyTogether(session) {
  return logLines(session)
    .filter((line) => line.includes("provider refresh completed"))
    .some((line) => /"leetifyStatus":"ready"/.test(line) && /"faceitStatus":"ready"/.test(line));
}
