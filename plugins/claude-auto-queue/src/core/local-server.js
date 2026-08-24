import http from "node:http";
import { URL } from "node:url";
import { getClaudeVersion } from "./claude-client.js";
import { HOOK_HEADER } from "./integration-manager.js";

const HOST = "127.0.0.1";
export const PORT = 19741;

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
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

function diagnosticsPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claude Auto Queue Spike</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:#080a0e;color:#f4f6f8;min-height:100vh}
main{width:min(960px,calc(100% - 32px));margin:40px auto 80px}
.hero{padding:28px 30px;border:1px solid #242a33;border-radius:22px;background:linear-gradient(145deg,#141820,#0d1015);box-shadow:0 24px 60px #0008}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:.18em;color:#2be86a}.hero h1{font-size:34px;margin:8px 0 8px}.hero p{margin:0;color:#aeb6c2;max-width:700px;line-height:1.55}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px}
.card{background:#10141a;border:1px solid #242a33;border-radius:18px;padding:20px}.card h2{margin:0 0 14px;font-size:16px}.muted{color:#8f98a6}
.pill{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#171d24;border:1px solid #2a333f;font-size:12px;font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:#76808e}.good .dot{background:#2be86a}.bad .dot{background:#ff5a67}.warn .dot{background:#f3b84a}
button,input,select{font:inherit}button{cursor:pointer;border:0;border-radius:11px;padding:10px 13px;background:#2be86a;color:#051009;font-weight:800}button.secondary{background:#202731;color:#edf1f5}button.danger{background:#3a1d23;color:#ffb7be}
.row{display:flex;gap:8px;flex-wrap:wrap}.queueForm{display:flex;gap:8px}.queueForm input{flex:1;min-width:0;background:#0a0d11;color:white;border:1px solid #2a333f;border-radius:10px;padding:10px 11px}
.field{margin:0 0 10px}.field label{display:block;margin:0 0 6px;color:#aeb6c2;font-size:12px;font-weight:700}.field select{width:100%;background:#0a0d11;color:white;border:1px solid #2a333f;border-radius:10px;padding:10px 11px}
pre{white-space:pre-wrap;word-break:break-word;background:#090c10;border:1px solid #20262f;border-radius:12px;padding:12px;color:#cbd2da;max-height:360px;overflow:auto}
.session{border-top:1px solid #222933;padding:12px 0}.session:first-of-type{border-top:0}.title{font-weight:800}.state{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#2be86a}
.notice{margin-top:14px;padding:13px 15px;border-radius:13px;background:#121821;border:1px solid #253142;color:#aeb8c5;font-size:13px;line-height:1.45}
</style>
</head>
<body>
<main>
<section class="hero">
<div class="eyebrow">PACKRAT FEASIBILITY SPIKE</div>
<h1>Claude Auto Queue</h1>
<p>This page exists only to prove the supported Claude Code integration before the premium Stream Deck UI is finalized. Everything here stays on this computer.</p>
</section>
<div class="grid">
<section class="card"><h2>Claude Code</h2><div id="claude" class="pill"><span class="dot"></span><span>Checking…</span></div><div style="height:10px"></div><div id="integration" class="pill"><span class="dot"></span><span>Checking hooks…</span></div><div class="row" style="margin-top:14px"><button id="connect">Connect Claude Code</button><button id="disconnect" class="secondary">Disconnect</button></div></section>
<section class="card"><h2>Add test work</h2><div class="field"><label for="session">Target session</label><select id="session"><option value="">Auto: active Claude session</option></select></div><form id="queueForm" class="queueForm"><input id="prompt" placeholder="Run tests and fix failures" required><button>Add</button></form><div class="row" style="margin-top:10px"><button id="remove" class="secondary">Remove next</button><button id="clear" class="danger">Clear queue</button></div><div class="notice">Start a real Claude Code turn, add one or more follow-ups here or from the Stream Deck Queue Prompt key, then let Claude finish normally. The Stop hook should start the next queued task in the same session. Auto targeting refuses to guess when more than one session is ambiguous.</div></section>
</div>
<section class="card" style="margin-top:14px"><h2>Detected sessions</h2><div id="sessions" class="muted">No session data yet.</div></section>
<section class="card" style="margin-top:14px"><h2>Raw diagnostic state</h2><pre id="raw">{}</pre></section>
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
function refreshSessionSelect(sessions,activeSessionId){
  const select=document.getElementById('session');
  const previous=select.value;
  select.textContent='';
  const auto=document.createElement('option');auto.value='';auto.textContent=activeSessionId?'Auto: active session':'Auto: detect active session';select.appendChild(auto);
  for(const session of sessions){
    const option=document.createElement('option');
    option.value=session.id;
    const label=session.name||session.cwd||session.id;
    option.textContent=(session.id===activeSessionId?'Active · ':'')+label+' · '+session.state;
    select.appendChild(option);
  }
  if(previous&&sessions.some(session=>session.id===previous)) select.value=previous;
}
async function refresh(){
  try{
    const data=await request('/api/status');
    const c=document.getElementById('claude');c.className='pill '+(data.claude.ok?'good':'bad');c.innerHTML=statePill(data.claude.ok?data.claude.version:(data.claude.error||'Not detected'));
    const i=document.getElementById('integration');
    const integrationText=data.integration.needsReconnect?'Reconnect to upgrade hook auth':(data.integration.connected?'Hooks connected':'Hooks not connected');
    i.className='pill '+(data.integration.connected&&!data.integration.needsReconnect?'good':'warn');i.innerHTML=statePill(integrationText);
    const sessions=data.queue.sessions||[];
    refreshSessionSelect(sessions,data.queue.activeSessionId||null);
    document.getElementById('sessions').innerHTML=sessions.length?sessions.map(s=>'<div class="session"><div class="title">'+esc(s.name||s.cwd||s.id)+'</div><div class="state">'+esc(s.state)+(s.waitingFor?' · '+esc(s.waitingFor):'')+'</div><div class="muted">Queue: '+s.queue.length+' · Chain: '+s.continuationCount+'/6</div>'+(s.queue[0]?'<div class="muted">Next: '+esc(s.queue[0].prompt)+'</div>':'')+'</div>').join(''):'No Claude sessions detected yet.';
    document.getElementById('raw').textContent=JSON.stringify(data,null,2);
  }catch(error){document.getElementById('raw').textContent=String(error)}
}
document.getElementById('connect').onclick=async()=>{await request('/api/connect',{method:'POST',body:'{}'});await refresh()};
document.getElementById('disconnect').onclick=async()=>{await request('/api/disconnect',{method:'POST',body:'{}'});await refresh()};
document.getElementById('queueForm').onsubmit=async(e)=>{e.preventDefault();const input=document.getElementById('prompt');await request('/api/queue',{method:'POST',body:JSON.stringify({prompt:input.value,sessionId:targetSession()})});input.value='';await refresh()};
document.getElementById('remove').onclick=async()=>{await request('/api/remove-next',{method:'POST',body:JSON.stringify({sessionId:targetSession()})});await refresh()};
document.getElementById('clear').onclick=async()=>{await request('/api/clear',{method:'POST',body:JSON.stringify({sessionId:targetSession()})});await refresh()};
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
    this.claude = { ok: false, version: null, error: "Not checked yet." };
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
        const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

        if (req.method === "POST" && url.pathname === "/hook") {
          const hookHeader = req.headers[HOOK_HEADER.toLowerCase()];
          if (!this.integration.authorizeHookHeader(Array.isArray(hookHeader) ? hookHeader[0] : hookHeader)) {
            return json(res, 403, { error: "Forbidden." });
          }
          const payload = await readJson(req);
          this.lastHookAt = Date.now();
          this.lastHookEvent = String(payload?.hook_event_name ?? "unknown");
          const decision = await this.service.handleHook(payload);
          if (decision) return json(res, 200, decision);
          res.writeHead(204, { "Cache-Control": "no-store" });
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

        if (req.method === "POST" && url.pathname === "/api/connect") {
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
          const body = diagnosticsPage();
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
            "Cache-Control": "no-store"
          });
          return res.end(body);
        }

        return json(res, 404, { error: "Not found." });
      } catch (error) {
        this.logger?.error?.("Claude Auto Queue local server error", error);
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
