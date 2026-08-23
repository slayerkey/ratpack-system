const fs=require('fs'), vm=require('vm'), assert=require('assert');
const path=require('path'); const base=path.resolve(__dirname,'..')+path.sep; const code=['agenda-core.js','agenda-recur.js','agenda-data.js'].map(f=>fs.readFileSync(base+f,'utf8')).join('\n');
const sandbox={console, Date, Intl, Math, JSON, Number, String, Array, Object, RegExp, Promise, setTimeout, clearTimeout, URL, globalThis:null,
  document:{readyState:'loading',addEventListener(){},documentElement:{clientWidth:840,clientHeight:696,style:{setProperty(){}}}},
  window:{innerWidth:840,innerHeight:696,addEventListener(){}}, localStorage:{getItem(){return null},setItem(){}}, fetch(){return Promise.resolve(null)}};
sandbox.globalThis=sandbox; vm.createContext(sandbox); vm.runInContext(code,sandbox);
function ics(body){return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PackRat Test//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;}
function ymd(d){return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')}
function dt(d,h,m){return ymd(d)+'T'+String(h).padStart(2,'0')+String(m).padStart(2,'0')+'00'}
const now=new Date();
const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
const tomorrow=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
const day2=new Date(today.getFullYear(),today.getMonth(),today.getDate()+2);
let raw=ics([
'BEGIN:VEVENT','UID:weekly','SUMMARY:Weekly','DTSTART:'+dt(today,10,0),'DTEND:'+dt(today,11,0),'RRULE:FREQ=DAILY;COUNT=4','EXDATE:'+dt(tomorrow,10,0),'END:VEVENT',
'BEGIN:VEVENT','UID:weekly','RECURRENCE-ID:'+dt(day2,10,0),'SUMMARY:Moved','DTSTART:'+dt(day2,14,0),'DTEND:'+dt(day2,15,0),'END:VEVENT',
'BEGIN:VEVENT','UID:allday','SUMMARY:All day','DTSTART;VALUE=DATE:'+ymd(today),'DTEND;VALUE=DATE:'+ymd(tomorrow),'END:VEVENT'
].join('\r\n'));
let events=sandbox.parseCalendar(raw,0);
assert(events.some(e=>e.uid==='allday'&&e.allDay&&e.allDayStart===ymd(today)&&e.allDayEndExclusive===ymd(tomorrow)),'all-day exclusive DTEND');
assert(!events.some(e=>e.uid==='weekly'&&!e.allDay&&e.start.getDate()===tomorrow.getDate()&&e.start.getHours()===10),'EXDATE removed');
assert(events.some(e=>e.uid==='weekly'&&!e.allDay&&e.start.getDate()===day2.getDate()&&e.start.getHours()===14&&e.title==='Moved'),'RECURRENCE-ID moved override');
assert(events.filter(e=>e.uid==='weekly').length===3,'count preserved with one exclusion and override');
const tzRaw=ics(['BEGIN:VEVENT','UID:tz','SUMMARY:NY event','DTSTART;TZID=America/New_York:'+dt(today,9,0),'DTEND;TZID=America/New_York:'+dt(today,10,0),'END:VEVENT'].join('\r\n'));
const tz=sandbox.parseCalendar(tzRaw,0).find(e=>e.uid==='tz');
assert(tz&&tz.start instanceof Date&&!Number.isNaN(tz.start.getTime()),'IANA timezone parsed');
const floatingRaw=ics(['BEGIN:VEVENT','UID:f','SUMMARY:Floating','DTSTART:'+dt(today,13,30),'DTEND:'+dt(today,14,0),'END:VEVENT'].join('\r\n'));
const floating=sandbox.parseCalendar(floatingRaw,0).find(e=>e.uid==='f');
assert(floating&&floating.start.getHours()===13&&floating.start.getMinutes()===30,'floating local preserved');
console.log('parser fixture pass', events.length);
const before=sandbox.zonedPartsToDate({y:2026,m:3,d:7,h:9,min:0,s:0},'America/New_York');
const after=sandbox.zonedPartsToDate({y:2026,m:3,d:9,h:9,min:0,s:0},'America/New_York');
assert(before&&after,'DST dates convert');
assert((after-before)===47*3600000,'wall time stays 9 AM across spring DST change');
console.log('timezone DST fixture pass');
const vtRaw=ics([
'BEGIN:VTIMEZONE','TZID:Eastern Standard Time',
'BEGIN:STANDARD','DTSTART:16011101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','TZOFFSETFROM:-0400','TZOFFSETTO:-0500','END:STANDARD',
'BEGIN:DAYLIGHT','DTSTART:16010302T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','TZOFFSETFROM:-0500','TZOFFSETTO:-0400','END:DAYLIGHT','END:VTIMEZONE',
'BEGIN:VEVENT','UID:embedded-spring','SUMMARY:Embedded spring','DTSTART;TZID=Eastern Standard Time:20260309T090000','DTEND;TZID=Eastern Standard Time:20260309T100000','END:VEVENT',
'BEGIN:VEVENT','UID:embedded-fall','SUMMARY:Embedded fall','DTSTART;TZID=Eastern Standard Time:20261102T090000','DTEND;TZID=Eastern Standard Time:20261102T100000','END:VEVENT'
].join('\r\n'));
const vtRoot=sandbox.parseComponents(vtRaw); const vtAliases=sandbox.collectTimezoneAliases(vtRoot);
assert(vtAliases['Eastern Standard Time']&&vtAliases['Eastern Standard Time'].type==='vtimezone','embedded VTIMEZONE registered');
const spring=sandbox.parseDateValue({name:'DTSTART',params:{TZID:'Eastern Standard Time'},value:'20260309T090000'},vtAliases);
const fall=sandbox.parseDateValue({name:'DTSTART',params:{TZID:'Eastern Standard Time'},value:'20261102T090000'},vtAliases);
assert(spring&&spring.date.toISOString()==='2026-03-09T13:00:00.000Z','embedded daylight offset applied');
assert(fall&&fall.date.toISOString()==='2026-11-02T14:00:00.000Z','embedded standard offset applied');
const recurTemplate={startValue:{parts:{y:2026,m:3,d:2,h:9,min:0,s:0},zone:vtAliases['Eastern Standard Time']}};
assert(sandbox.wallPartsToOccurrenceDate(recurTemplate,{y:2026,m:3,d:9}).toISOString()==='2026-03-09T13:00:00.000Z','recurring event keeps embedded timezone wall time');
console.log('embedded VTIMEZONE fixture pass');
