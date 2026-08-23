from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parents[3]
BUILT_HTML = (ROOT / 'widgets' / 'rig-battery' / 'index.html').read_text(encoding='utf-8')
SLOTS = {
    's-h': (840,344), 's-v': (696,416), 'm-h': (840,696), 'm-v': (696,840),
    'l-h': (1688,696), 'l-v': (696,1688), 'xl-h': (2536,696), 'xl-v': (696,2536)
}

FIXTURE = {
    'mouse-low': {'type':'battery-charge','device':'SABRE RGB','name':'Battery','units':'%','value':'9','connected':True},
    'mouse-low-status': {'type':'battery-status','device':'SABRE RGB','name':'Battery Status','units':'','value':'Charging','connected':True},
    'headset': {'type':'battery-charge','device':'VIRTUOSO MAX','name':'Battery','units':'%','value':'18','connected':True},
    'headset-status': {'type':'battery-status','device':'VIRTUOSO MAX','name':'Battery Status','units':'','value':'Discharging','connected':True},
    'keyboard': {'type':'battery-charge','device':'K100 AIR','name':'Battery','units':'%','value':'43','connected':True},
    'keyboard-status': {'type':'battery-status','device':'K100 AIR','name':'Battery Status','units':'hours','value':'2.5','connected':True},
    'mouse-two': {'type':'battery-charge','device':'SABRE RGB','name':'Battery 2','units':'%','value':'65','connected':True},
    'mouse-two-status': {'type':'battery-status','device':'SABRE RGB','name':'Battery Status 2','units':'','value':'Discharging','connected':True},
    'healthy': {'type':'battery-charge','device':'DARK CORE','name':'Battery','units':'%','value':'88','connected':True},
    'healthy-status': {'type':'battery-status','device':'DARK CORE','name':'Battery Status','units':'','value':'Full','connected':True},
    'temp': {'type':'temperature','device':'CPU','name':'Package','units':'C','value':'55','connected':True},
    'gone': {'type':'battery-charge','device':'DISCONNECTED','name':'Battery','units':'%','value':'3','connected':False},
}

INIT = r'''
(({ sensors }) => {
  globalThis.uniqueId = 'verify-rig-battery';
  globalThis.lowBatteryThreshold = 20;
  globalThis.textColor = '#F4F6F8';
  globalThis.accentColor = '#2BE86A';
  globalThis.backgroundColor = '#070A0D';
  globalThis.tr = async (value) => value;
  class Signal {
    constructor(){ this.listeners=[]; }
    connect(fn){ this.listeners.push(fn); }
    emit(...args){ for(const fn of this.listeners) fn(...args); }
  }
  const asyncResponse = new Signal();
  const plugin = {
    asyncResponse,
    sensorAdded:new Signal(), sensorRemoved:new Signal(), sensorDataChanged:new Signal(),
    sensorValueChanged:new Signal(), sensorUnitsChanged:new Signal(),
    getAllSensorIds(id){ setTimeout(()=>asyncResponse.emit(id,Object.keys(sensors)),0); },
    getSensorType(id,sid){ setTimeout(()=>asyncResponse.emit(id,sensors[sid]?.type ?? ''),0); },
    getSensorDeviceName(id,sid){ setTimeout(()=>asyncResponse.emit(id,sensors[sid]?.device ?? ''),0); },
    getSensorName(id,sid){ setTimeout(()=>asyncResponse.emit(id,sensors[sid]?.name ?? ''),0); },
    getSensorUnits(id,sid){ setTimeout(()=>asyncResponse.emit(id,sensors[sid]?.units ?? ''),0); },
    getSensorValue(id,sid){ setTimeout(()=>asyncResponse.emit(id,sensors[sid]?.value ?? ''),0); },
    sensorIsConnected(id,sid){ setTimeout(()=>asyncResponse.emit(id,sensors[sid]?.connected !== false),0); },
  };
  globalThis.plugins = { Sensorsdataprovider: plugin };
  globalThis.pluginSensorsdataprovider_initialized = true;
  globalThis.__fixturePlugin = plugin;
})(%s);
''' % json.dumps({'sensors': FIXTURE})

EMPTY_INIT = INIT.replace(json.dumps({'sensors': FIXTURE}), json.dumps({'sensors': {}}))


def visible_count(page):
    return page.locator('.battery-card').evaluate_all("els => els.filter(e => { const s=getComputedStyle(e); const r=e.getBoundingClientRect(); return s.display!=='none' && r.width>0 && r.height>0; }).length")


def audit_slot(browser, slot, size):
    context = browser.new_context(viewport={'width': size[0], 'height': size[1]}, device_scale_factor=1)
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    page.evaluate(INIT)
    page.set_content(BUILT_HTML, wait_until='load')
    page.wait_for_function("document.body.getAttribute('data-panel-state') === 'ready'", timeout=8000)
    page.wait_for_timeout(150)

    state = page.evaluate('''() => ({
      slot: document.body.dataset.slot,
      panel: document.body.dataset.panelState,
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      iw: innerWidth,
      ih: innerHeight,
      names: Array.from(document.querySelectorAll('.device-name')).map(x=>x.textContent),
      metrics: Array.from(document.querySelectorAll('.metric')).map(x=>x.textContent.trim()),
      charging: document.querySelectorAll('.battery-card.is-charging').length,
      low: document.querySelectorAll('.battery-card.is-low').length,
      badges: Array.from(document.querySelectorAll('.status-badge')).map(x=>x.textContent.trim()),
    })''')
    assert state['slot'] == slot, (slot, state)
    assert state['panel'] == 'ready', state
    assert state['sw'] <= state['iw'] and state['sh'] <= state['ih'], state
    assert state['names'][0] == 'SABRE RGB 1', state['names']
    assert state['names'][1] == 'VIRTUOSO MAX', state['names']
    assert 'SABRE RGB 2' in state['names'], state['names']
    assert state['charging'] == 1, state
    assert state['low'] == 2, state
    assert 'Charging' in state['badges'], state['badges']
    expected_visible = 2 if slot in ('s-h','s-v') else 5
    assert visible_count(page) == expected_visible, (slot, visible_count(page), expected_visible)

    boxes = page.locator('.battery-card').evaluate_all('''els => els.map(e => {const s=getComputedStyle(e),r=e.getBoundingClientRect(); return {display:s.display,w:r.width,h:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom};})''')
    for box in boxes:
        if box['display'] == 'none':
            continue
        assert box['w'] >= 56 and box['h'] >= 56, (slot, box)
        assert box['left'] >= -0.5 and box['top'] >= -0.5 and box['right'] <= size[0] + 0.5, (slot, box)

    first = page.locator('.battery-card').first
    before = first.locator('.metric').inner_text().strip()
    first.click()
    page.wait_for_timeout(80)
    after = first.locator('.metric').inner_text().strip()
    assert before != after and 'Charging' in after, (before, after)
    assert 'is-charging' in (first.get_attribute('class') or '')
    assert not errors, (slot, errors)
    context.close()


def audit_empty(browser):
    context=browser.new_context(viewport={'width':840,'height':696})
    page=context.new_page(); errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.evaluate(EMPTY_INIT)
    page.set_content(BUILT_HTML, wait_until='load')
    page.wait_for_function("document.body.getAttribute('data-panel-state') === 'empty'", timeout=8000)
    title=page.locator('#stateTitle').inner_text().strip(); body=page.locator('#stateBody').inner_text().strip()
    assert title == 'No battery sensors found', title
    assert 'Corsair wireless devices through iCUE' in body, body
    assert page.locator('.battery-card').count() == 0
    assert not errors, errors
    context.close()


def audit_eta(browser):
    context=browser.new_context(viewport={"width":840,"height":696})
    page=context.new_page(); page.evaluate(INIT); page.set_content(BUILT_HTML, wait_until="load")
    page.wait_for_function("document.body.getAttribute('data-panel-state') === 'ready'", timeout=8000)
    card=page.locator('.battery-card').filter(has=page.locator('.device-name', has_text='K100 AIR')).first
    card.click(); page.wait_for_timeout(80)
    assert card.locator('.metric').inner_text().strip() == '2h 30m'
    cap=card.locator('.metric-caption').inner_text().strip(); assert cap == 'REMAINING', cap
    context.close()


def audit_unavailable(browser):
    context=browser.new_context(viewport={"width":840,"height":696})
    page=context.new_page()
    page.evaluate("globalThis.uniqueId='verify-unavailable'; globalThis.tr=async v=>v; globalThis.lowBatteryThreshold=20; globalThis.textColor='#F4F6F8'; globalThis.accentColor='#2BE86A'; globalThis.backgroundColor='#070A0D';")
    page.set_content(BUILT_HTML, wait_until='load')
    page.wait_for_function("document.body.getAttribute('data-panel-state') === 'unavailable'", timeout=8000)
    assert page.locator('#stateTitle').inner_text().strip() == 'iCUE sensor service unavailable'
    context.close()


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for slot,size in SLOTS.items():
            audit_slot(browser,slot,size)
            print('PASS',slot,size)
        audit_empty(browser); print('PASS empty state')
        audit_eta(browser); print('PASS explicit ETA state')
        audit_unavailable(browser); print('PASS unavailable state')
        browser.close()
    print('RIG BATTERY FIXTURE QA PASS')

if __name__ == '__main__': main()
