/** Canonical Rat Ship Maker Console bridge for iCUE/XENEON widgets.
 * GitHub owns the SHIP_KIT. Authentication stays in the local .playwright-profile.
 * Default behavior stages the listing and stops. Pass --submit only after explicit approval.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const slug = args.find(x => !x.startsWith('--'));
const kitArg = (args.find(x => x.startsWith('--kit=')) || '').slice(6);
const CHECK_KIT = args.includes('--check-kit');
const CHECK_LOGIN = args.includes('--check');
const RESUME = args.includes('--resume');
const SUBMIT = args.includes('--submit');
if (!slug) throw new Error('usage: node tools/ship/maker_console.mjs <slug> --kit=<SHIP_KIT> [--check-kit|--check|--resume|--submit]');
const KIT = kitArg ? resolve(kitArg) : resolve('artifacts', 'ship', slug, 'SHIP_KIT');
if (!existsSync(KIT)) throw new Error(`SHIP_KIT not found: ${KIT}`);
const subFile = join(KIT, 'submission.json');
if (!existsSync(subFile)) throw new Error('SHIP_KIT/submission.json is required');
const prod = JSON.parse(readFileSync(subFile, 'utf8'));
if (prod.slug !== slug || prod.type !== 'widget') throw new Error('submission metadata does not match requested widget');
const media = ['01_search_icon.png','02_cover.png','03_gallery_01.png','04_gallery_02.png','05_gallery_03.png','06_gallery_04.png'];
const required = ['PASTE_description.txt','PASTE_release_notes.txt',...media];
const missing = required.filter(f => !existsSync(join(KIT,f)));
const packages = readdirSync(KIT).filter(f => /\.icuewidget$/i.test(f));
if (packages.length !== 1) missing.push(`exactly one .icuewidget required, found ${packages.length}`);
for (const k of ['name','version','price_usd','marketplace_category','marketplace_dashboard_sizes','marketplace_language']) {
  if (prod[k] == null || (Array.isArray(prod[k]) && !prod[k].length)) missing.push(`submission.${k}`);
}
if (missing.length) throw new Error(`SHIP_KIT preflight failed:\n${missing.join('\n')}`);
if (CHECK_KIT) {
  console.log(`RAT SHIP KIT PASS: ${prod.name} ${prod.version} | $${prod.price_usd}`);
  console.log(`package: ${packages[0]}`);
  process.exit(0);
}
const LOG = join(KIT,'log'); mkdirSync(LOG,{recursive:true});
const STATE = join(LOG,'state.json');
const state = RESUME && existsSync(STATE) ? JSON.parse(readFileSync(STATE,'utf8')) : {done:[],uploaded:[]};
const save = () => writeFileSync(STATE, JSON.stringify(state,null,2));
const done = id => state.done.includes(id);
const mark = id => { if(!done(id)) state.done.push(id); save(); };
let shot = 0;
async function snap(page,label){ await page.screenshot({path:join(LOG,`${String(++shot).padStart(2,'0')}-${label}.png`)}); }
async function signedIn(page){
  const sign = page.getByRole('button',{name:/^sign in$|^get started$/i}).or(page.getByRole('link',{name:/^sign in$|^get started$/i})).first();
  if(await sign.isVisible().catch(()=>false)) return false;
  return await page.getByRole('button',{name:/^(account|switch apps)$/i}).first().isVisible().catch(()=>false);
}
async function waitSignedIn(page,ms=25000){ const end=Date.now()+ms; while(Date.now()<end){ if(await signedIn(page)) return true; await page.waitForTimeout(1500);} return false; }
async function autoLogin(page){
  const sign = page.getByRole('button',{name:/^sign in$/i}).or(page.getByRole('link',{name:/^sign in$/i})).first();
  if(!await sign.isVisible().catch(()=>false)) return false;
  await sign.click().catch(()=>{}); await page.waitForLoadState('domcontentloaded').catch(()=>{});
  if(await waitSignedIn(page,20000)) return true;
  const form = page.locator('#kc-form-login');
  if(await form.isVisible().catch(()=>false)){
    const autofilled = await page.evaluate(()=>{const e=document.querySelector('#email'),p=document.querySelector('#password'); return !!e&&!!p&&e.value.length>0&&p.value.length>0;}).catch(()=>false);
    if(autofilled){ await page.locator('#kc-login').click().catch(()=>{}); return await waitSignedIn(page,30000); }
  }
  return false;
}
async function livePage(ctx,page){ if(page&&!page.isClosed()) return page; const ps=ctx.pages().filter(p=>!p.isClosed()); if(!ps.length) throw new Error('Maker Console closed every page'); return ps.at(-1); }
async function click(page,re,timeout=15000){
  const b = page.getByRole('button',{name:re}).or(page.getByRole('link',{name:re})).first();
  await b.waitFor({state:'visible',timeout});
  const txt=((await b.textContent())||'').trim();
  if(/^(submit|publish|submit for review)$/i.test(txt)) throw new Error(`guard refused ${txt}`);
  await b.click({timeout}); await page.waitForTimeout(900);
}
async function listboxes(page){
  const triggers=page.locator('button[aria-haspopup="listbox"]'); const out=[];
  for(let i=0;i<await triggers.count();i++){
    const t=triggers.nth(i); const trigger=((await t.textContent())||'').replace(/\s+/g,' ').trim(); let options=[];
    try{await t.click();await page.waitForTimeout(400);options=(await page.getByRole('option').allTextContents()).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);await page.keyboard.press('Escape');}catch{}
    out.push({index:i,trigger,options});
  }
  writeFileSync(join(LOG,'details-listboxes.json'),JSON.stringify(out,null,2)); return out;
}
async function pickByContent(page,boxes,label,wanted){
  const grouped=new Map(),missing=[];
  for(const value of wanted){
    const box=boxes.find(b=>b.options.some(o=>o.toLowerCase()===value.toLowerCase()));
    if(!box){missing.push(value);continue;}
    if(!grouped.has(box.index)) grouped.set(box.index,[]); grouped.get(box.index).push(value);
  }
  for(const [idx,values] of grouped){
    const t=page.locator('button[aria-haspopup="listbox"]').nth(idx); await t.click(); await page.waitForTimeout(400);
    for(const v of values){
      const esc=v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      await page.getByRole('option',{name:new RegExp(`^${esc}$`,'i')}).first().click(); await page.waitForTimeout(250);
    }
    await page.keyboard.press('Escape'); console.log(`${label}: ${values.join(', ')}`);
  }
  return missing;
}
async function countGallery(page){ return await page.locator('img[src^="data:image"], img[src*="mp-cdn.elgato.com"]:not([src*="/organizations/"]), video').count().catch(()=>null); }
async function richText(page,locator,text){
  await locator.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('Delete'); await page.keyboard.insertText(text); await page.waitForTimeout(400);
  const back=((await locator.innerText().catch(()=>''))||'').trim(); if(!back) throw new Error('rich text write did not persist');
}
async function step(page,id,label,fn){ if(RESUME&&done(id)){console.log(`skip ${label}`);return;} console.log(`\n== ${label} ==`); await fn(); mark(id); await snap(page,id); }

const context=await chromium.launchPersistentContext(join(ROOT,'.playwright-profile'),{headless:false,viewport:{width:1500,height:950}});
let page=context.pages()[0]??await context.newPage();
await page.goto('https://maker.elgato.com',{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(3000);
let auth=await waitSignedIn(page); if(!auth) auth=await autoLogin(page); await snap(page,auth?'signed-in':'signed-out');
if(CHECK_LOGIN){ console.log(auth?'MAKER LOGIN PASS':'MAKER LOGIN REQUIRED'); await context.close(); process.exit(auth?0:2); }
if(!auth){ console.log('Maker Console authentication is local. Sign in in the opened browser, then rerun with --resume.'); await new Promise(r=>setTimeout(r,120000)); await context.close(); process.exit(2); }

async function openExisting(){
  await page.goto('https://maker.elgato.com/products',{waitUntil:'domcontentloaded',timeout:45000}); await page.waitForTimeout(3000);
  const row=page.getByRole('link',{name:new RegExp(`^${prod.name}`,'i')}).or(page.getByText(prod.name,{exact:true})).first();
  if(!await row.isVisible().catch(()=>false)) return false; await row.click(); await page.waitForTimeout(3500); return true;
}
const editing=await openExisting();
if(!editing){
  await step(page,'1-create','Create Widget draft',async()=>{
    await click(page,/create product|new product|add product/i);
    const choice=page.getByRole('radio',{name:/^widget$/i}).or(page.getByText(/^widget$/i)).or(page.getByRole('button',{name:/^widget$/i})).first();
    await choice.click(); await click(page,/^(next|continue)$/i);
  });
  await step(page,'2-file','Upload .icuewidget',async()=>{
    page=await livePage(context,page); const input=page.locator('input[type="file"]').first(); await input.setInputFiles(join(KIT,packages[0])); await click(page,/^(next|continue)$/i,180000);
  });
  await step(page,'3-copy','Verify name and set description',async()=>{
    page=await livePage(context,page); const ro=page.locator('input[readonly][maxlength]').first(); await ro.waitFor({state:'visible',timeout:10000});
    const name=(await ro.inputValue()).trim(); if(name!==prod.name) throw new Error(`manifest name mismatch: ${name}`);
    const desc=page.locator('#description').or(page.locator('div[role="textbox"]')).or(page.locator('[contenteditable="true"]')).first();
    await richText(page,desc,readFileSync(join(KIT,'PASTE_description.txt'),'utf8').trim()); await click(page,/^create product$/i); page=await livePage(context,page);
  });
  await step(page,'4-details','Set category, dashboard sizes, language and price',async()=>{
    page=await livePage(context,page);
    for(const size of prod.marketplace_dashboard_sizes){ const chip=page.getByRole('button',{name:new RegExp(`^${size}$`,'i')}).first(); if(!await chip.isVisible().catch(()=>false)) throw new Error(`dashboard size not offered: ${size}`); await chip.click(); }
    const boxes=await listboxes(page); const miss=[...await pickByContent(page,boxes,'Category',prod.marketplace_category),...await pickByContent(page,boxes,'Language',prod.marketplace_language)];
    if(miss.length) throw new Error(`Maker Console no longer offers: ${miss.join(', ')}`);
    if(prod.price_usd>0){
      await page.getByRole('button',{name:/^paid$/i}).first().click();
      const price=page.locator('input[type="number"],input[inputmode="decimal"]').or(page.locator('input:not([type=checkbox]):not([type=file]):not([readonly]):visible')).first();
      await price.fill(String(prod.price_usd)); const back=Number(await price.inputValue()); if(back!==Number(prod.price_usd)) throw new Error(`price mismatch ${back}`);
    } else await page.getByRole('button',{name:/^free$/i}).first().click();
    await click(page,/^continue$/i);
  });
}

await step(page,'5-media','Upload icon and cover',async()=>{
  page=await livePage(context,page); const icon=page.locator('input#media-app-icon'); if(await icon.count()) await icon.setInputFiles(join(KIT,'01_search_icon.png'));
  const thumb=(await icon.count())?page.locator('input[name="media"]:not([multiple]):not(#media-app-icon)').first():page.locator('input[name="media"]:not([multiple])').first();
  await thumb.setInputFiles(join(KIT,'02_cover.png')); await page.waitForTimeout(1800); const body=await page.locator('body').innerText(); if(/Thumbnail required/i.test(body)) throw new Error('thumbnail upload did not stick');
});
for(const f of media.slice(2)){
  if(RESUME&&state.uploaded.includes(f)) continue;
  page=await livePage(context,page); const before=await countGallery(page); if(before==null) throw new Error('cannot verify gallery count');
  const input=page.locator('input[type="file"][accept*="mp4"]').first(); await input.setInputFiles(join(KIT,f),{timeout:60000}); await page.waitForTimeout(2500);
  const after=await countGallery(page); if(after!==before+1) throw new Error(`gallery invariant failed for ${f}: ${before} -> ${after}`);
  state.uploaded.push(f); save(); await snap(page,`gallery-${f}`);
}
mark('6-gallery');
await step(page,'6-continue','Continue past media',async()=>{
  for(let i=0;i<6;i++){ await click(page,/^(next|continue)$/i,30000).catch(()=>{}); await page.waitForTimeout(1800); if(!await page.getByRole('button',{name:/^replace$/i}).first().isVisible().catch(()=>false)) return; }
  throw new Error('media slide would not advance');
});
await step(page,'7-notes','Verify version and set release notes',async()=>{
  page=await livePage(context,page); const body=await page.locator('body').innerText(); if(!body.includes(prod.version)) throw new Error(`summary does not show version ${prod.version}`);
  const notes=page.getByLabel(/release notes|what.s new/i).or(page.getByRole('textbox',{name:/release|notes/i})).or(page.locator('[contenteditable="true"]')).first();
  await richText(page,notes,readFileSync(join(KIT,'PASTE_release_notes.txt'),'utf8').trim());
});
await step(page,'8-autopublish','Enable auto publish',async()=>{
  const cb=page.getByRole('checkbox',{name:/automatically publish/i}).or(page.getByRole('switch',{name:/automatically publish/i})).first(); await cb.waitFor({state:'visible',timeout:10000});
  const on=async()=>await cb.isChecked().catch(async()=>await cb.getAttribute('aria-checked')==='true'); if(!await on()) await cb.click(); if(!await on()) throw new Error('auto publish did not enable');
});

page=await livePage(context,page); await snap(page,'final');
if(!SUBMIT){ console.log(`STAGED: ${prod.name}. Nothing submitted. Re-run with --resume --submit after review.`); await context.close(); process.exit(0); }
if(state.uploaded.length!==media.slice(2).length) throw new Error('gallery is incomplete, refusing submit');
const summary=await page.locator('body').innerText(); if(!summary.includes(prod.name)||!summary.includes(prod.version)) throw new Error('summary name/version mismatch, refusing submit');
const cb=page.getByRole('checkbox',{name:/automatically publish/i}).or(page.getByRole('switch',{name:/automatically publish/i})).first(); const ap=await cb.isChecked().catch(async()=>await cb.getAttribute('aria-checked')==='true'); if(!ap) throw new Error('auto publish is off, refusing submit');
const btn=page.getByRole('button',{name:/^submit$/i}).first(); await btn.waitFor({state:'visible',timeout:15000}); await btn.click(); await page.waitForTimeout(8000); await snap(page,'after-submit'); console.log(`SUBMITTED: ${prod.name} | ${page.url()}`); await context.close();
