import http from "node:http";
import { URL } from "node:url";
import { getClaudeVersion } from "./claude-client.js";
import { HOOK_HEADER } from "./integration-manager.js";

const HOST = "127.0.0.1";
export const PORT = 19741;
const LOCAL_ORIGIN = `http://${HOST}:${PORT}`;
const LOCAL_HOST = `${HOST}:${PORT}`;

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function isTrustedHostHeader(value) {
  return String(firstHeader(value) ?? "").toLowerCase() === LOCAL_HOST;
}

export function isTrustedApiMutationHeaders(headers = {}) {
  if (!isTrustedHostHeader(headers.host)) return false;
  const contentType = String(firstHeader(headers["content-type"]) ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) return false;
  const origin = firstHeader(headers.origin);
  if (origin && String(origin).toLowerCase() !== LOCAL_ORIGIN) return false;
  const fetchSite = String(firstHeader(headers["sec-fetch-site"]) ?? "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  return true;
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Request too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function setupPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auto Queue for Claude Code</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:#080a0e;color:#f4f6f8;min-height:100vh}
main{width:min(960px,calc(100% - 32px));margin:40px auto 80px}
.hero{padding:28px 30px;border:1px solid #242a33;border-radius:22px;background:radial-gradient(circle at 90% 0%,#2be86a1c,transparent 38%),linear-gradient(145deg,#141820,#0d1015);box-shadow:0 24px 60px #0008}
.eyebrow,.step{font-size:12px;font-weight:800;letter-spacing:.16em;color:#2be86a}.hero h1{font-size:34px;margin:8px 0}.hero p{margin:0;color:#aeb6c2;max-width:760px;line-height:1.55}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px}
.card{background:#10141a;border:1px solid #242a33;border-radius:18px;padding:20px}.card h2{margin:0 0 14px;font-size:16px}.muted{color:#8f98a6}
.pill{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#171d24;border:1px solid #2a333f;font-size:12px;font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:#76808e}.good .dot{background:#2be86a}.bad .dot{background:#ff5a67}.warn .dot{background:#f3b84a}
button,input,select{font:inherit}button{cursor:pointer;border:0;border-radius:11px;padding:10px 13px;background:#2be86a;color:#051009;font-weight:800}button.secondary{background:#202731;color:#edf1f5}button.danger{background:#3a1d23;color:#ffb7be}button:disabled{cursor:not-allowed;opacity:.45}
.row{display:flex;gap:8px;flex-wrap:wrap}.queueForm{display:flex;gap:8px}.queueForm input{flex:1;min-width:0;background:#0a0d11;color:white;border:1px solid #2a333f;border-radius:10px;padding:10px 11px}
.field{margin:0 0 10px}.field label{display:block;margin:0 0 6px;color:#aeb6c2;font-size:12px;font-weight:700}.field select{width:100%;background:#0a0d11;color:white;border:1px solid #2a333f;border-radius:10px;padding:10px 11px}
.session{border-top:1px solid #222933;padding:14px 0}.session:first-of-type{border-top:0}.title{font-weight:800;color:#f4f6f8}.state{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#2be86a}.meta{font-size:12px;color:#8f98a6;margin-top:3px}
.notice{margin-top:14px;padding:13px 15px;border-radius:13px;background:#121821;border:1px solid #253142;color:#aeb8c5;font-size:13px;line-height:1.45}.notice.good{border-color:#245f39;color:#c8f6d5}.notice.bad{border-color:#6b3037;color:#ffc5ca}.how{margin:14px 0 0;padding:0;list-style:none;counter-reset:steps}.how li{counter-increment:steps;position:relative;padding:0 0 11px 32px;color:#b8c1cd;font-size:13px;line-height:1.45}.how li:last-child{padding-bottom:0}.how li:before{content:counter(steps);position:absolute;left:0;top:0;width:21px;height:21px;border-radius:50%;display:grid;place-items:center;background:#1c2b22;border:1px solid #2f6a42;color:#63ef8e;font-size:11px;font-weight:900}
details{margin-top:14px}summary{cursor:pointer;color:#aeb6c2;font-weight:700;font-size:13px;padding:4px 0}pre{white-space:pre-wrap;word-break:break-word;background:#090c10;border:1px solid #20262f;border-radius:12px;padding:12px;color:#cbd2da;max-height:360px;overflow:auto}
</style>
</head>
<body>
<main>
<section class="hero">
<div class="eyebrow">PACKRAT</div>
<h1>Auto Queue for Claude Code</h1>
<p>Queue a follow-up now without interrupting Claude. Auto Queue saves it locally, waits for Claude to finish the message already in progress, then hands your queued prompt to that same chat as the next request.</p>
</section>
<section class="card" style="margin-top:14px"><div class="step">HOW IT WORKS</div><h2 style="margin-top:6px">One normal message activates the chat</h2><ol class="how"><li><strong>Connect Claude Code once.</strong> PackRat installs its supported local Claude hooks without replacing your existing settings.</li><li><strong>Send one normal message in the Claude chat you want to use.</strong> This first real message is important: it lets PackRat learn which chat is active. If Auto says it is waiting for a chat, do this step.</li><li><strong>While Claude is working, queue a follow-up.</strong> Queue next does not send immediately and does not type into VS Code.</li><li><strong>Let Claude finish normally.</strong> At the end of the current turn, Auto Queue supplies your saved prompt as the next request in the same chat. Additional queued prompts run one at a time at later turn boundaries.</li></ol><div class="notice"><strong>Easy test:</strong> send Claude any normal message, then queue “Reply with exactly: AUTO QUEUE WORKED” while Claude is still working. Do not send the queued message yourself. Claude should finish the first request, then automatically answer the queued one.</div></section>
<div class="grid">
<section class="card"><div class="step">ONE TIME SETUP</div><h2 style="margin-top:6px">Connect Claude Code</h2><div id="claude" class="pill"><span class="dot"></span><span>Checking…</span></div><div id="versionHelp" class="notice">Checking Claude Code compatibility…</div><div style="height:10px"></div><div id="integration" class="pill"><span class="dot"></span><span>Checking connection…</span></div><div class="notice">After you click Connect, send one normal message in Claude. That message proves the connection is live and tells Auto Queue which chat to follow. Existing Claude settings and other hooks are preserved.</div><div class="row" style="margin-top:14px"><button id="connect">Connect Claude Code</button><button id="disconnect" class="secondary">Disconnect</button></div></section>
<section class="card"><h2>Quick Queue</h2><div class="field"><label for="session">Target chat</label><select id="session"><option value="">Auto</option></select></div><form id="queueForm" class="queueForm"><input id="prompt" placeholder="Run tests and fix failures" required><button>Queue next</button></form><div class="row" style="margin-top:10px"><button id="remove" class="secondary">Remove next</button><button id="clear" class="danger">Clear queue</button></div><div id="queueFeedback" class="notice"><strong>Queue next does not send immediately.</strong> Use it while Claude is already working. Your request is saved locally and becomes Claude's next request after the current turn finishes.</div></section>
</div>
<section class="card" style="margin-top:14px"><h2>Claude Chats</h2><div id="sessions" class="muted">No Claude chat learned yet. Connect first, then send one normal message in the Claude chat you want Auto Queue to follow.</div></section>
<details class="card"><summary>Advanced diagnostics</summary><p class="muted" style="font-size:12px;line-height:1.5;margin-top:10px">Use this only for troubleshooting. Exact session IDs and raw hook state stay local on this computer.</p><pre id="raw">{}</pre></details>
</main>
<script>
async function request(url, options={}) {
  const response = await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const data = await response.json();
  if(!response.ok) throw new Error(data.error||response.statusText);
  return data;
}
function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function statePill(text){return '<span class="dot"></span><span>'+esc(text)+'</span>'}
function targetSession(){return document.getElementById('session').value||null}
function humanLabel(session){return session.lastUserPromptPreview||session.humanLabel||session.projectLabel||session.name||'Claude chat'}
function displayLabel(session,activeSessionId,includeState=true){
  const parts=[];
  if(session.id===activeSessionId)parts.push('ACTIVE');
  else if(includeState&&session.state==='working')parts.push('WORKING');
  else if(includeState&&session.state==='need_you')parts.push('NEEDS YOU');
  const human=humanLabel(session);parts.push(session.lastUserPromptPreview?'“'+human+'”':human);
  return parts.join(' · ');
}
function refreshSessionSelect(sessions,activeSessionId){
  const select=document.getElementById('session');
  const previous=select.value;
  select.textContent='';
  const engaged=sessions.filter(session=>session.state==='working'||session.state==='need_you');
  const active=sessions.find(session=>session.id===activeSessionId);
  const auto=document.createElement('option');auto.value='';
  if(active)auto.textContent='Auto · '+displayLabel(active,activeSessionId,false);
  else if(engaged.length===1)auto.textContent='Auto · '+displayLabel(engaged[0],null,true);
  else auto.textContent='Auto · send a normal Claude message first';
  select.appendChild(auto);
  for(const session of sessions){
    const option=document.createElement('option');option.value=session.id;option.textContent=displayLabel(session,activeSessionId,true);select.appendChild(option);
  }
  if(previous&&sessions.some(session=>session.id===previous))select.value=previous;
}
function setQueueFeedback(text,kind=''){
  const el=document.getElementById('queueFeedback');el.textContent=text;el.className='notice'+(kind?' '+kind:'');
}
async function refresh(){
  try{
    const data=await request('/api/status');
    const ready=data.claude.ok&&data.claude.compatible;
    const c=document.getElementById('claude');c.className='pill '+(ready?'good':'bad');c.innerHTML=statePill(data.claude.ok?(data.claude.version||'Unknown version'):(data.claude.error||'Not detected'));
    const vh=document.getElementById('versionHelp');vh.textContent=ready?'Claude Code is compatible with Auto Queue.':(data.claude.error||('Claude Code '+data.claude.minimumVersion+' or newer is required.'));
    document.getElementById('connect').disabled=!ready;
    const i=document.getElementById('integration');
    const hookLive=Boolean(data.lastHookAt);
    const integrationText=data.integration.needsReconnect?'Reconnect required':(data.integration.connected?(hookLive?'Connected · Claude is live':'Connected · now send one normal Claude message'):'Not connected');
    i.className='pill '+(data.integration.connected&&!data.integration.needsReconnect&&hookLive?'good':'warn');i.innerHTML=statePill(integrationText);
    const sessions=data.queue.sessions||[];refreshSessionSelect(sessions,data.queue.activeSessionId||null);
    document.getElementById('sessions').innerHTML=sessions.length?sessions.map(s=>{
      const active=s.id===data.queue.activeSessionId;
      const human=humanLabel(s);
      const title=(active?'ACTIVE · ':'')+(s.lastUserPromptPreview?'“'+esc(human)+'”':esc(human));
      return '<div class="session"><div class="title">'+title+'</div><div class="state">'+esc(s.state)+(s.waitingFor?' · '+esc(s.waitingFor):'')+'</div><div class="meta">Queue '+s.queue.length+' · Chain '+s.continuationCount+'/6</div>'+(s.queue[0]?'<div class="muted">Next: '+esc(s.queue[0].prompt)+'</div>':'')+'</div>';
    }).join(''):'No Claude chat learned yet. Connect first, then send one normal message in the Claude chat you want Auto Queue to follow.';
    document.getElementById('raw').textContent=JSON.stringify(data,null,2);
  }catch(error){document.getElementById('raw').textContent=String(error)}
}
document.getElementById('connect').onclick=async()=>{await request('/api/connect',{method:'POST',body:'{}'});setQueueFeedback('Connected. Now send one normal message in the Claude chat you want Auto Queue to follow.','good');await refresh()};
document.getElementById('disconnect').onclick=async()=>{await request('/api/disconnect',{method:'POST',body:'{}'});await refresh()};
document.getElementById('queueForm').onsubmit=async(e)=>{
  e.preventDefault();const input=document.getElementById('prompt');
  try{
    const queued=await request('/api/queue',{method:'POST',body:JSON.stringify({prompt:input.value,sessionId:targetSession()})});
    const status=await request('/api/status');
    const match=(status.queue.sessions||[]).find(session=>session.id===queued.sessionId);
    const label=match?(match.lastUserPromptPreview?'“'+humanLabel(match)+'”':humanLabel(match)):'the selected Claude chat';
    input.value='';setQueueFeedback('Queued #'+queued.position+' for '+label+'. It did not send yet. Claude will receive it after the current turn finishes.','good');await refresh();
  }catch(error){setQueueFeedback(String(error?.message||error),'bad')}
};
document.getElementById('remove').onclick=async()=>{try{await request('/api/remove-next',{method:'POST',body:JSON.stringify({sessionId:targetSession()})});setQueueFeedback('Removed the next queued request.','good');await refresh()}catch(error){setQueueFeedback(String(error?.message||error),'bad')}};
document.getElementById('clear').onclick=async()=>{try{const result=await request('/api/clear',{method:'POST',body:JSON.stringify({sessionId:targetSession()})});setQueueFeedback('Cleared '+result.cleared+' queued request'+(result.cleared===1?'':'s')+'.','good');await refresh()}catch(error){setQueueFeedback(String(error?.message||error),'bad')}};
refresh();setInterval(refresh,1000);
</script>
</body></html>`;
}

export class LocalServer {
  constructor({ service, integration, logger = console }) {
    this.service = service;
    this.integration = integration;
    this.logger = logger;
    this.server = null;
    this.lastHookAt = null;
    this.lastHookEvent = null;
    this.claude = { ok: false, version: null, compatible: false, error: "Not checked yet." };
  }

  setClaudeStatus(status) {
    this.claude = status;
  }

  async start() {
    if (this.server) return;
    this.claude = await getClaudeVersion();
    await this.integration.initialize();

    this.server = http.createServer(async (req, res) => {
      try {
        if (!isTrustedHostHeader(req.headers.host)) {
          return json(res, 403, { error: "Forbidden host." });
        }
        const url = new URL(req.url || "/", LOCAL_ORIGIN);

        if (req.method === "POST" && url.pathname === "/hook") {
          const hookHeader = req.headers[HOOK_HEADER.toLowerCase()];
          if (!this.integration.authorizeHookHeader(firstHeader(hookHeader))) {
            return json(res, 403, { error: "Forbidden." });
          }
          const payload = await readJson(req);
          this.lastHookAt = Date.now();
          this.lastHookEvent = String(payload?.hook_event_name ?? "unknown");
          const decision = await this.service.handleHook(payload);
          if (decision) return json(res, 200, decision);
          res.writeHead(204, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          return res.end();
        }

        if (req.method === "GET" && url.pathname === "/api/status") {
          const integration = await this.integration.status();
          return json(res, 200, {
            ok: true,
            claude: this.claude,
            integration,
            lastHookAt: this.lastHookAt,
            lastHookEvent: this.lastHookEvent,
            queue: this.service.getSnapshot()
          });
        }

        if (req.method === "POST" && url.pathname.startsWith("/api/")) {
          if (!isTrustedApiMutationHeaders(req.headers)) {
            return json(res, 403, { error: "Local API mutation rejected." });
          }
        }

        if (req.method === "POST" && url.pathname === "/api/connect") {
          this.claude = await getClaudeVersion();
          if (!this.claude.ok || !this.claude.compatible) {
            return json(res, 409, { error: this.claude.error || "Unsupported Claude Code version." });
          }
          return json(res, 200, await this.integration.connect());
        }
        if (req.method === "POST" && url.pathname === "/api/disconnect") {
          return json(res, 200, await this.integration.disconnect());
        }
        if (req.method === "POST" && url.pathname === "/api/queue") {
          const body = await readJson(req);
          return json(res, 200, await this.service.enqueue(body.prompt, body.sessionId ?? null));
        }
        if (req.method === "POST" && url.pathname === "/api/remove-next") {
          const body = await readJson(req);
          return json(res, 200, { removed: await this.service.removeNext(body.sessionId ?? null) });
        }
        if (req.method === "POST" && url.pathname === "/api/clear") {
          const body = await readJson(req);
          return json(res, 200, { cleared: await this.service.clearQueue(body.sessionId ?? null) });
        }

        if (req.method === "GET" && url.pathname === "/") {
          const body = setupPage();
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY"
          });
          return res.end(body);
        }

        return json(res, 404, { error: "Not found." });
      } catch (error) {
        this.logger?.error?.("Auto Queue local server error", error);
        return json(res, 400, { error: String(error?.message ?? error) });
      }
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server?.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.server?.off("error", onError);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(PORT, HOST);
    });
  }

  async stop() {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => server.close(resolve));
  }
}