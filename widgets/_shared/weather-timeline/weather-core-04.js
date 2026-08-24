'use strict';
  function eventMarkers(forecast, hours) {
    var out=[]; var first=hours[0]?hours[0].time:0, last=hours.length?hours[hours.length-1].time+3600000:0;
    (forecast.days||[]).forEach(function(day){
      if(day.sunrise && day.sunrise>=first && day.sunrise<last) out.push({type:'sunrise',time:day.sunrise,label:'SUNRISE'});
      if(day.sunset && day.sunset>=first && day.sunset<last) out.push({type:'sunset',time:day.sunset,label:'SUNSET'});
      if(IS_PRO && day.date){ var dawn=nearestSolarDay(solarEvent(day.date,Number(forecast.latitude),Number(forecast.longitude),96,true),day.sunrise); if(dawn&&dawn>=first&&dawn<last)out.push({type:'dawn',time:dawn,label:'DAWN'}); }
      if(IS_PRO && day.date){ var dusk=nearestSolarDay(solarEvent(day.date,Number(forecast.latitude),Number(forecast.longitude),96,false),day.sunset); if(dusk&&dusk>=first&&dusk<last)out.push({type:'dusk',time:dusk,label:'DUSK'}); }
    });
    return out;
  }

  function hourCell(hour, index, forecast, markers) {
    var now = Date.now(); var start = Number(hour.time), end=start+3600000; var isCurrent = now>=start&&now<end;
    var rain = clamp(hour.precipProbability,0,100);
    var markerHtml='';
    (markers||[]).forEach(function(marker){ var pct=clamp((marker.time-start)/3600000*100,2,98); markerHtml+='<span class="solar-marker '+marker.type+'" style="left:'+pct+'%"><b>'+marker.label+'</b></span>'; });
    var nowHtml=''; if(isCurrent){ var pctNow=clamp((now-start)/3600000*100,1,99); nowHtml='<span class="now-line" style="left:'+pctNow+'%"><b>NOW</b></span>'; }
    var precip = rain >= 5 ? formatPercent(rain) : '<span class="dry">—</span>';
    return '<button class="hour '+(hour.isDay?'day':'night')+(isCurrent?' current':'')+'" data-hour="'+index+'" type="button">'+
      '<span class="hour-time">'+(isCurrent?'NOW':esc(formatTime(hour.time,forecast.timezone,false)))+'</span>'+
      '<span class="wx-icon">'+iconSvg(hour.kind,hour.isDay)+'</span>'+
      '<span class="hour-temp">'+esc(formatTemp(hour.temp))+'</span>'+
      '<span class="hour-rain"><i style="height:'+rain+'%"></i><em>'+precip+'</em></span>'+markerHtml+nowHtml+'</button>';
  }

  function pageHours(all) {
    var maxHours = IS_PRO ? 24 : 12;
    var requested = all.slice(0,maxHours);
    if (IS_PRO && COMPACT_SLOTS[STATE.slot]) {
      var start=STATE.timelinePage*12; return requested.slice(start,start+12);
    }
    return requested;
  }

  function renderTimeline(forecast) {
    var all = sliceUpcoming(forecast).slice(0, IS_PRO?24:12);
    var visible = pageHours(all);
    var markers = eventMarkers(forecast, visible);
    var html='';
    visible.forEach(function(h,i){ var hourMarkers=markers.filter(function(m){return m.time>=h.time&&m.time<h.time+3600000;}); html+=hourCell(h,i+(IS_PRO&&COMPACT_SLOTS[STATE.slot]?STATE.timelinePage*12:0),forecast,hourMarkers); });
    var rail=document.getElementById('hourRail'); rail.innerHTML=html;
    rail.style.setProperty('--hours', String(Math.max(1,visible.length)));
    rail.querySelectorAll('.hour').forEach(function(btn){btn.addEventListener('click',function(){ STATE.selectedHour=Number(btn.getAttribute('data-hour')); renderDetail(); });});
    var pager=document.getElementById('timelinePager');
    if(IS_PRO&&COMPACT_SLOTS[STATE.slot]){ pager.hidden=false; pager.textContent=STATE.timelinePage===0?'NEXT 12H →':'← FIRST 12H'; pager.onclick=function(){STATE.timelinePage=STATE.timelinePage?0:1;STATE.selectedHour=-1;render();}; }
    else pager.hidden=true;
  }

  function renderDetail() {
    var panel=document.getElementById('detailPanel'); if(!panel)return;
    if(!STATE.forecast||STATE.selectedHour<0){panel.setAttribute('aria-hidden','true');panel.classList.remove('open');return;}
    var all=sliceUpcoming(STATE.forecast).slice(0,IS_PRO?24:12); var h=all[STATE.selectedHour]; if(!h)return;
    document.getElementById('detailWhen').textContent=formatTime(h.time,STATE.forecast.timezone,true);
    document.getElementById('detailCondition').textContent=h.text||'Weather';
    document.getElementById('detailIcon').innerHTML=iconSvg(h.kind,h.isDay);
    var metrics=[['TEMP',formatTemp(h.temp)],['RAIN',formatPercent(h.precipProbability)]];
    if(IS_PRO){ metrics.push(['FEELS',formatTemp(h.feels)],['AMOUNT',formatPrecip(h.precip)],['WIND',windCompass(h.windDir)+' '+formatWind(h.wind)],['UV',Number.isFinite(Number(h.uv))?Number(h.uv).toFixed(1):'—']); }
    document.getElementById('detailMetrics').innerHTML=metrics.map(function(m){return '<span><b>'+esc(m[0])+'</b><strong>'+esc(m[1])+'</strong></span>';}).join('');
    panel.setAttribute('aria-hidden','false');panel.classList.add('open');
  }

  function renderDays(forecast) {
    var wrap=document.getElementById('daysRow'); if(!wrap)return;
    if(!IS_PRO || !forecast.days || forecast.days.length<2){wrap.innerHTML='';wrap.hidden=true;return;}
    wrap.hidden=false; wrap.innerHTML=forecast.days.slice(0,3).map(function(d,i){ var epoch=d.sunrise||Date.now()+i*86400000; return '<span class="day-chip"><b>'+(i===0?'TODAY':esc(formatDay(epoch,forecast.timezone).toUpperCase()))+'</b><strong>'+esc(formatTemp(d.high))+'</strong><em>'+esc(formatTemp(d.low))+'</em></span>'; }).join('');
  }

  function renderStatus() {
    var status=document.getElementById('statusLabel'); if(!status)return;
    var text='';
    if(STATE.status==='loading')text=STATE.forecast?'REFRESHING':'LOADING';
    else if(STATE.status==='fresh')text=STATE.preview?'PREVIEW':'UPDATED '+timeAgo(Date.now()-STATE.updatedAt);
    else if(STATE.status==='stale')text='STALE • '+timeAgo(Date.now()-STATE.updatedAt);
    else if(STATE.status==='setup')text='SETUP NEEDED';
    else text=STATE.status.toUpperCase();
    status.textContent=text; status.setAttribute('data-tone',STATE.status);
    status.title=STATE.message||'';
  }

  function renderSetup() {
    var setup=document.getElementById('setupState');
    if(!setup)return;
    setup.hidden=!!STATE.forecast;
    if(STATE.forecast)return;
    document.getElementById('setupTitle').textContent='Weather access needs one setting';
    document.getElementById('setupText').textContent=STATE.message||'Add a free WeatherAPI.com key in widget settings, then enter a city or coordinates.';
    document.getElementById('setupHint').textContent='iCUE weather access is used automatically when available.';
  }

  function render() {
    applyTheme(); applySlot(); STATE.preview=isPreview(); renderStatus(); renderSetup();
    var f=STATE.forecast; var stage=document.getElementById('weatherStage');
    if(!f){ stage.setAttribute('data-ready','true'); return; }
    var day=todaySummary(f); var c=f.current||{};
    document.getElementById('locationName').textContent=f.name||'Weather';
    var place=[f.region,f.country].filter(Boolean).join(', '); document.getElementById('locationMeta').textContent=place;
    document.getElementById('currentIcon').innerHTML=iconSvg(c.kind||'clear',c.isDay!==false);
    document.getElementById('currentTemp').textContent=formatTemp(c.temp);
    document.getElementById('currentCondition').textContent=c.text||'Weather';
    document.getElementById('highLow').textContent='H '+formatTemp(day.high)+'  L '+formatTemp(day.low);
    document.getElementById('providerLabel').textContent=f.provider||'';
    renderTimeline(f); renderDays(f); renderDetail();
    stage.setAttribute('data-ready','true');
  }

  function openPro() {
    if(IS_PRO)return;
    try {
      if(window.plugins&&window.plugins.Linkprovider&&typeof pluginLinkprovider_initialized!=='undefined'&&pluginLinkprovider_initialized){ window.plugins.Linkprovider.open(PRO_MARKETPLACE_URL); return; }
    } catch(error){}
    try{window.open(PRO_MARKETPLACE_URL,'_blank');}catch(error){}
  }

  function bind() {
    var refresh=document.getElementById('refreshButton'); if(refresh)refresh.addEventListener('click',function(){loadForecast(true);});
    var detailClose=document.getElementById('detailClose'); if(detailClose)detailClose.addEventListener('click',function(){STATE.selectedHour=-1;renderDetail();});
    var info=document.getElementById('infoButton'); var about=document.getElementById('aboutPanel'); var aboutClose=document.getElementById('aboutClose');
    if(info)info.addEventListener('click',function(){about.classList.add('open');about.setAttribute('aria-hidden','false');});
    if(aboutClose)aboutClose.addEventListener('click',function(){about.classList.remove('open');about.setAttribute('aria-hidden','true');});
    var pro=document.getElementById('proButton'); if(pro)pro.addEventListener('click',openPro);
    var loc=document.getElementById('locationButton'); if(loc&&IS_PRO)loc.addEventListener('click',function(){var list=configuredLocations();if(list.length>1){STATE.locationIndex=(STATE.locationIndex+1)%list.length;STATE.timelinePage=0;STATE.selectedHour=-1;loadForecast(true);}});
    window.addEventListener('resize',function(){var old=STATE.slot;applySlot();if(old!==STATE.slot){STATE.timelinePage=0;render();}});
    window.addEventListener('icue-property-changed',function(){STATE.locationIndex=0;STATE.timelinePage=0;STATE.selectedHour=-1;loadForecast(true);});
    window.addEventListener('icue-widget-settings-changed',function(){STATE.locationIndex=0;STATE.timelinePage=0;STATE.selectedHour=-1;loadForecast(true);});
  }

  function startClock(){ if(CLOCK_TIMER)clearInterval(CLOCK_TIMER); CLOCK_TIMER=setInterval(function(){ if(STATE.forecast)render(); },60000); }
  bind(); loadForecast(true); startClock();
  window.__weatherTimeline = { state:STATE, reload:function(){return loadForecast(true);}, demo:demoForecast, render:render };
