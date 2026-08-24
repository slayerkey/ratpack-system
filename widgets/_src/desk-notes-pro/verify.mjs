import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','desk-notes-common','desk-notes-core.js'),'utf8');
const sandbox={console,Math,Date,JSON,String,Number,Object,Array,globalThis:null,document:{readyState:'loading',addEventListener(){}},addEventListener(){},innerWidth:2536,innerHeight:696}; sandbox.globalThis=sandbox;
vm.createContext(sandbox); vm.runInContext(source,sandbox,{filename:'desk-notes-core.js'}); const api=sandbox.__deskNotesTest;
function assert(v,m){if(!v)throw new Error(m);} const body=['## Launch','# Video','! [ ] Final render','[ ] Upload','','## Admin','Email sponsor'];
const b=api.parseBoard('WORK',body,1,16); assert(b.cards.length===2,'two cards'); assert(b.cards[0].category==='Video','category'); assert(b.cards[0].items[0].pinned,'pin');
const capped=api.parseBoard('MAX',Array.from({length:24},(_,i)=>'[ ] Item '+i),2,16); assert(capped.count===16,'pro cap'); assert(Object.keys(api.themes).length>=9,'pro themes');
console.log('DESK NOTES PRO VERIFY PASS');
