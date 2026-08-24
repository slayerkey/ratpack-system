'use strict';
  function demoForecast(kind) {
    var now = Date.now();
    var start = new Date(now); start.setMinutes(0,0,0);
    var base = start.getTime();
    var cold = kind === 'cold', hot = kind === 'hot', snow = kind === 'snow', rain = kind === 'rain', night = kind === 'night';
    var hours = [];
    for (var i=0;i<54;i++) {
      var hourEpoch = base + i*3600000;
      var lp = localDateParts(hourEpoch);
      var hh = Number(lp.hour);
      var day = hh >= 6 && hh < 19;
      if (night) day = false;
      var temp = cold ? -18 + Math.sin(i/4)*5 : hot ? 112 + Math.sin(i/4)*7 : 72 + Math.sin((i-3)/5)*8;
      var k = snow ? (i%5 < 3 ? 'snow' : 'cloudy') : rain ? (i%4 < 3 ? 'rain' : 'cloudy') : (day ? (i%5 ? 'clear' : 'partly') : 'clear');
      hours.push({ time:hourEpoch, localIso:'', temp:temp, feels:temp + (hot?6:cold?-7:-1), precipProbability:(rain||snow)?Math.min(95,35+i*4%70):(i%7===0?12:2), precip:(rain?0.08: snow?0.03:0), wind:8+(i%6)*2, windDir:(210+i*11)%360, uv:day?Math.max(0,7-Math.abs(12-hh)):0, isDay:day, code:0, text:k==='clear'?'Clear':k==='partly'?'Partly cloudy':k==='cloudy'?'Cloudy':k==='rain'?'Rain':'Snow', kind:k });
    }
    function atHour(offsetHour) { return base + offsetHour*3600000; }
    var today = new Date(base); var date = today.getFullYear()+'-'+pad2(today.getMonth()+1)+'-'+pad2(today.getDate());
    return {
      provider:'Fixture', name: kind === 'long' ? 'Llanfairpwllgwyngyll Weather Station' : 'Phoenix', region:'Arizona', country:'United States', latitude:33.4484, longitude:-112.074,
      timezone:'America/Phoenix', current:{temp:hours[0].temp,feels:hours[0].feels,wind:hours[0].wind,windDir:hours[0].windDir,isDay:hours[0].isDay,code:0,text:hours[0].text,kind:hours[0].kind},
      hours:hours, days:[
        {date:date,high:hot?119:cold?-8:86,low:hot?91:cold?-26:67,sunrise:atHour(2.2),sunset:atHour(8.8),code:0},
        {date:new Date(base+86400000).toISOString().slice(0,10),high:hot?117:cold?-5:88,low:hot?90:cold?-24:69,sunrise:atHour(26.2),sunset:atHour(32.8),code:1},
        {date:new Date(base+2*86400000).toISOString().slice(0,10),high:hot?115:cold?-4:84,low:hot?88:cold?-20:65,sunrise:atHour(50.1),sunset:atHour(56.7),code:2}
      ], tempUnit:tempUnit(),windUnit:windUnit(),precipUnit:precipUnit()
    };
  }

  function fixtureForecast() {
    try {
      if (window.__weatherTimelineFixture) {
        var f = window.__weatherTimelineFixture;
        if (typeof f === 'string') return demoForecast(f);
        if (f.forecast) return f.forecast;
        return f;
      }
    } catch (error) {}
    return null;
  }

  function sliceUpcoming(forecast) {
    var now = Date.now() - 3600000;
    var upcoming = (forecast.hours || []).filter(function (h) { return Number(h.time) >= now; });
    if (!upcoming.length) upcoming = forecast.hours || [];
    return upcoming;
  }

  async function loadForecast(force) {
    applyTheme(); applySlot();
    var fixture = fixtureForecast();
    if (fixture) {
      STATE.forecast = fixture; STATE.status = 'fresh'; STATE.stale = !!window.__weatherTimelineStale; STATE.updatedAt = Date.now() - (STATE.stale ? 95*60000 : 0); STATE.provider = fixture.provider || 'Fixture'; render(); return;
    }
    if (!force && STATE.status === 'loading') return;
    var cached = readCache();
    if (!STATE.forecast && cached && cached.forecast) {
      STATE.forecast = cached.forecast; STATE.updatedAt = cached.updatedAt || 0; STATE.stale = true; STATE.status = 'stale'; render();
    }
    STATE.status = 'loading'; STATE.message = ''; renderStatus();
    var keys = providerKeys();
    var query = currentLocationQuery();
    try {
      var result;
      if (keys.openMeteo) result = await fetchOpenMeteo(query, keys.openMeteo);
      else if (keys.weatherApi) result = await fetchWeatherApi(query, keys.weatherApi);
      else throw new Error('Weather provider setup needed');
      STATE.forecast = result; STATE.updatedAt = Date.now(); STATE.stale = false; STATE.status = 'fresh'; STATE.message = ''; STATE.provider = result.provider || '';
      writeCache(result);
    } catch (error) {
      var fallback = readCache();
      if (fallback && fallback.forecast) {
        STATE.forecast = fallback.forecast; STATE.updatedAt = fallback.updatedAt || 0; STATE.stale = true; STATE.status = 'stale'; STATE.message = 'Showing the last successful forecast.';
      } else {
        STATE.forecast = null; STATE.updatedAt = 0; STATE.stale = false; STATE.status = 'setup';
        STATE.message = keys.openMeteo || keys.weatherApi ? (error && error.message ? error.message : 'Forecast unavailable') : 'Add a free WeatherAPI.com key in settings if iCUE does not provide weather access.';
      }
    }
    render(); scheduleRefresh();
  }

  function scheduleRefresh() {
    if (REFRESH_TIMER) clearTimeout(REFRESH_TIMER);
    var minutes = clamp(prop('refreshMinutes', 20), 10, 60) || 20;
    REFRESH_TIMER = setTimeout(function () { loadForecast(false); }, minutes*60000);
  }

  function formatTemp(v) { return Number.isFinite(Number(v)) ? Math.round(Number(v)) + '°' : '—'; }
  function formatPercent(v) { return Math.round(clamp(v,0,100)) + '%'; }
  function formatPrecip(v) {
    var n = Number(v); if (!Number.isFinite(n)) return '—';
    return unitMode()==='f' ? n.toFixed(n < 0.1 ? 2 : 1) + ' in' : n.toFixed(n < 1 ? 1 : 0) + ' mm';
  }
  function formatWind(v) { return Number.isFinite(Number(v)) ? Math.round(Number(v)) + ' ' + windUnit() : '—'; }
  function formatTime(epoch, timezone, includeMinutes) {
    try { return new Intl.DateTimeFormat(undefined,{timeZone:timezone||undefined,hour:'numeric',minute:includeMinutes?'2-digit':undefined}).format(new Date(epoch)).replace(':00',''); }
    catch (error) { var d=new Date(epoch); return includeMinutes?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):d.toLocaleTimeString([],{hour:'numeric'}); }
  }
  function formatDay(epoch, timezone) {
    try { return new Intl.DateTimeFormat(undefined,{timeZone:timezone||undefined,weekday:'short'}).format(new Date(epoch)); } catch (error) { return new Date(epoch).toLocaleDateString([],{weekday:'short'}); }
  }
  function timeAgo(ms) {
    if (!ms || ms < 60000) return 'NOW'; var m=Math.floor(ms/60000); if(m<60)return m+'M AGO'; return Math.floor(m/60)+'H AGO';
  }
  function windCompass(deg) {
    if (!Number.isFinite(Number(deg))) return '—';
    return ['N','NE','E','SE','S','SW','W','NW'][Math.round(((Number(deg)%360)+360)%360/45)%8];
  }

  function iconSvg(kind, isDay) {
    var sun = isDay ? '<circle cx="22" cy="20" r="7" class="sun"/><g class="rays"><path d="M22 6v5M22 29v5M8 20h5M31 20h5M12 10l4 4M28 26l4 4M32 10l-4 4M16 26l-4 4"/></g>' : '<path class="moon" d="M28 8c-7 2-10 11-5 17 3 4 8 5 12 3-3 6-11 9-18 5C8 27 9 13 18 8c3-2 7-2 10 0z"/>';
    var cloud = '<path class="cloud" d="M12 34h24c6 0 8-8 3-11-2-1-4-1-6 0-2-7-12-8-16-2-7-1-10 10-5 13z"/>';
    if (kind==='clear') return '<svg viewBox="0 0 48 48">'+sun+'</svg>';
    if (kind==='partly') return '<svg viewBox="0 0 48 48">'+sun+cloud+'</svg>';
    if (kind==='cloudy'||kind==='fog') return '<svg viewBox="0 0 48 48">'+cloud+(kind==='fog'?'<path class="precip" d="M12 39h25M16 44h18"/>':'')+'</svg>';
    if (kind==='snow') return '<svg viewBox="0 0 48 48">'+cloud+'<path class="precip" d="M16 39l4 4m0-4l-4 4m10-4l4 4m0-4l-4 4"/></svg>';
    if (kind==='storm') return '<svg viewBox="0 0 48 48">'+cloud+'<path class="bolt" d="M26 34l-6 9 6-2-2 6 9-11-6 2z"/></svg>';
    return '<svg viewBox="0 0 48 48">'+cloud+'<path class="precip" d="M17 38l-2 5M25 38l-2 5M33 38l-2 5"/></svg>';
  }

  function todaySummary(forecast) {
    var day = forecast.days && forecast.days[0];
    if (!day) return {high:null,low:null};
    return day;
  }

  function solarEvent(dateText, lat, lon, zenith, sunrise) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    var dm = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dm) return null;
    var d = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])));
    var N = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(),0,0))/86400000);
    var lngHour = lon/15; var t = N + ((sunrise?6:18)-lngHour)/24; var M=0.9856*t-3.289;
    var L=M+1.916*Math.sin(M*Math.PI/180)+0.020*Math.sin(2*M*Math.PI/180)+282.634; L=(L+360)%360;
    var RA=Math.atan(0.91764*Math.tan(L*Math.PI/180))*180/Math.PI; RA=(RA+360)%360; RA += (Math.floor(L/90)*90-Math.floor(RA/90)*90); RA/=15;
    var sinDec=0.39782*Math.sin(L*Math.PI/180); var cosDec=Math.cos(Math.asin(sinDec));
    var cosH=(Math.cos(zenith*Math.PI/180)-sinDec*Math.sin(lat*Math.PI/180))/(cosDec*Math.cos(lat*Math.PI/180)); if(cosH>1||cosH<-1)return null;
    var H=(sunrise?360-Math.acos(cosH)*180/Math.PI:Math.acos(cosH)*180/Math.PI)/15;
    var T=H+RA-0.06571*t-6.622; var UT=(T-lngHour)%24; if(UT<0)UT+=24;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + UT*3600000;
  }

  function nearestSolarDay(epoch, anchor) {
    if (!epoch || !anchor) return epoch;
    while (epoch - anchor > 12*3600000) epoch -= 24*3600000;
    while (anchor - epoch > 12*3600000) epoch += 24*3600000;
    return epoch;
  }
