/* CHI participant menu — engine.
   Dates, identification, rendering, events. Loads after content.js and config.js. */

const TODAY = new Date();
const D = v => v ? new Date(v + 'T00:00:00') : null;
const days = (a,b) => Math.round((a - b) / 86400000);
const FMT = d => d ? d.toLocaleDateString('en-US',{day:'numeric', month:'long', year:'numeric'}) : '';
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

let ME = null;
let idMode = 'id';
let picks = [];
try{ const raw = localStorage.getItem('chi_me'); if(raw) ME = JSON.parse(raw); }catch(e){}

/* A personal link out of the automated email: ...menu?p=<token>.
   One tap, nothing typed. The token is random per participant, so
   there is no sequence for anybody to walk.

   It is stripped from the address bar the moment it is used. That is
   not decoration. Without it, the first participant who copies the
   link out of their browser and posts it in the employer WhatsApp
   group hands forty people their own record. */
/* ?tile= is a stable topic link, never a person. Student id, date of
   birth, name, and the personal ?p= token are not left in the address. */
const PAGE_IDENTITY_KEYS = ['sid','dob','name','first','last','employer','email','emailMask','tok','token','q'];
const START_LINK = (() => {
  try{
    const u = new URL(window.location.href);
    const token = u.searchParams.get('p') || '';
    if(token) u.searchParams.delete('p');
    PAGE_IDENTITY_KEYS.forEach(k => u.searchParams.delete(k));
    const tile = (u.searchParams.get('tile') || '').trim().toLowerCase();
    const next = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + u.hash;
    history.replaceState(null, '', next);
    return { token: token, tile: tile };
  }catch(e){ return { token:'', tile:'' }; }
})();
const LINK_TOKEN = START_LINK.token;
const TILE_QUERY = START_LINK.tile;

async function useLinkToken(){
  if(!LINK_TOKEN) return false;
  let hit = null;
  try{ hit = await lookupToken(LINK_TOKEN); }catch(e){}
  if(!hit) return false;
  setMe(hit);
  return true;
}

function maskEmail(e){
  const v = String(e || '');
  const at = v.indexOf('@');
  if(at < 1) return '';
  return v[0] + '\u2022\u2022\u2022\u2022' + v.slice(at);
}

/* A mask from the web app is kept as it arrived. A raw address in that
   field is masked here, so the raw address is never what gets stored. */
function safeEmailMask(v){
  const s = String(v || '').trim();
  const at = s.indexOf('@');
  if(at < 1) return '';
  if(/[•*]/.test(s.slice(0, at))) return s;
  return maskEmail(s);
}

function realDate(v){
  const d = D(v);
  return d && !isNaN(d.getTime()) ? d : null;
}
function enrich(p){
  const st = realDate(p.dsStart), en = realDate(p.dsEnd), ar = realDate(p.arrival);
  const day = st ? days(TODAY, st) : null;
  const len = (st && en) ? days(en, st) : null;
  const m = {...p};
  m.day = day; m.len = len;
  m.daysLeft = en ? days(en, TODAY) : null;
  m.ssnBy = en ? FMT(addDays(en, -45)) : '';
  m.dsEndMinus21 = en ? FMT(addDays(en, -21)) : '';
  m.insStartF = st ? FMT(addDays(st, -7)) : '';
  m.sevisDueF = ar ? FMT(addDays(ar, 3)) : '';
  m.sevisBy = m.sevisDueF;
  const rawWorked = asText(p.lastDayWorked || p.lastWorkDay).slice(0, 10);
  const worked = /^\d{4}-\d{2}-\d{2}$/.test(rawWorked) ? D(rawWorked) : null;
  if(worked) m.lastDayWorked = rawWorked;
  m.lastDayWorkedF = FMT(worked);
  m.graceEnd = worked ? FMT(addDays(worked, 30)) : '';
  m.proofCutoff = en ? FMT(addDays(en, -16)) : '';
  m.earlyOk = m.insStartF;
  m.dsStartF = FMT(st); m.dsEndF = FMT(en); m.arrivalF = FMT(ar);
  m.firstName = asText(p.firstName || p.first);
  m.winterNote = /\bwinter\b/i.test(asText(p.season))
    ? 'This is a winter season. Watch for frostbite, dress in layers, and expect short days in small towns.'
    : '';
  m.winterTaxNote = /\bwinter\b/i.test(asText(p.season))
    ? 'This winter season crosses two calendar years, so you should get two W-2s, one for each tax year.'
    : '';
  m.hoursHolidayNote = /\bwinter\b/i.test(asText(p.season))
    ? 'After New Year, winter hours often drop even if your end date is later. Save money while the hours are high.'
    : /\bsummer\b/i.test(asText(p.season))
    ? 'After Labor Day, summer hours often drop even if your end date is later. Save money while the hours are high.'
    : 'After a major holiday, hours often drop even if your end date is later. Save money while the hours are high.';
  m.plattsburghNote = /plattsburgh/i.test(asText(p.ssaOfficeName))
    ? 'Plattsburgh is about an hour away. Apply online first. Book only after the activation email, on a day your manager agrees. Share the ride with coworkers when you can.'
    : '';
  if(/^\d{4}-\d{2}-\d{2}/.test(String(p.embassyInterview || ''))) m.embassyInterviewIso = String(p.embassyInterview).slice(0, 10);
  if(typeof coordinatorFromRecord === 'function'){
    const coordinatorKey = coordinatorFromRecord(p);
    if(coordinatorKey && coordinatorKey !== 'jenn') m.coordinator = coordinatorKey;
    else delete m.coordinator;
  }
  ['sevisValidationDate','embassyInterview','dateVisaReceived','placementStart','placementEnd','hostCityArrival','earlyStart','lateStart','earlyEnd','lateEnd'].forEach(k => {
    if(m[k] && /^\d{4}-\d{2}-\d{2}/.test(String(m[k]))) m[k] = FMT(D(String(m[k]).slice(0,10)));
  });
  m.insGap = (st && ar) ? days(st, ar) : null;
  m.poc = (POC[p.agency] || []).join(' and ');
  m.agencyCode = p.agency;
  m.agencyName = AGENCY_NAME[p.agency] || p.agencyName || '';
  // Living in the USA is a board, not a moment, so nothing lands there by date.
  m.stage = (day === null) ? null : day < 0 ? 'home' : day <= 14 ? 'arr' : (m.daysLeft !== null && m.daysLeft <= 14) ? 'end' : (m.daysLeft !== null && m.daysLeft < 0) ? 'end' : 'work';
  const rawEmail = typeof p.email === 'string' ? p.email.trim() : '';
  if(typeof p.emailMask === 'string' && p.emailMask.trim() && !rawEmail){
    m.emailMask = safeEmailMask(p.emailMask);
    delete m.email;
  } else {
    m.emailMask = maskEmail(m.email);
  }
  return m;
}

function setMe(p){
  ME = p ? enrich(p) : null;
  try{ ME ? localStorage.setItem('chi_me', JSON.stringify(ME)) : localStorage.removeItem('chi_me'); }catch(e){}
  if(typeof refreshWhatsApp === 'function') refreshWhatsApp();
}

/* Empty ENDPOINT stays on the demo roster. A non-empty ENDPOINT is one GET
   and never reads DEMO. The page's ?p= token is sent as ?t=. An id or a
   name is sent as ?q= with ?dob=. Both halves are required. */
function endpointOn(){
  return typeof ENDPOINT === 'string' && ENDPOINT.trim() !== '';
}

function LookupFail(kind){
  const err = new Error(kind);
  err.name = 'LookupFail';
  err.kind = kind;
  return err;
}

function asText(v){
  if(v === undefined || v === null) return '';
  return String(v).trim();
}

function liveUrl(params){
  let u;
  try{ u = new URL(ENDPOINT); }
  catch(e){ throw LookupFail('access'); }
  Object.keys(params).forEach(k => {
    if(params[k] !== undefined && params[k] !== null && String(params[k]) !== '')
      u.searchParams.set(k, String(params[k]));
  });
  return u.toString();
}

function headerOf(res, name){
  try{
    if(res && res.headers && typeof res.headers.get === 'function')
      return res.headers.get(name) || '';
  }catch(e){}
  return '';
}

function failureKind(data){
  if(!data || typeof data !== 'object') return '';
  if(data.throttled === true || data.throttle === true || data.rateLimited === true) return 'throttle';
  if(data.tooMany === true || data.too_many === true) return 'too-many';
  const code = asText(data.code || data.error || data.reason || data.status).toLowerCase();
  if(/throttle|rate.?limit|too many tries/.test(code)) return 'throttle';
  if(/too[-_ ]?many/.test(code)) return 'too-many';
  return '';
}

function matchRows(data){
  if(!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const keys = ['matches','choices','results','people','candidates'];
  for(let i = 0; i < keys.length; i++){
    if(Array.isArray(data[keys[i]])) return data[keys[i]];
  }
  return null;
}

function looksLikePerson(o){
  if(!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return ['sid','first','last','name','emailMask','employer','dsStart','agency'].some(k => asText(o[k]));
}

/* Allow-list. first+last become name. emailMask is kept. A raw email
   property is never copied. Country is kept only when it is non-empty. */
function adaptFull(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  ['sid','tok','dob','last','first','firstName','agency','agencyName','employer','location','job','dsStart','dsEnd','arrival','hasSSN','season','preferred','dsNumber','whatsapp','housingStatus','housingAddress','sevisValidationDate','sevisStatus','secondJobHost','monthlyEvalStatus','returnee','timesParticipated','orientationAttended','visaStatus','visaApproved','visaEntries','entries','visaEntry','dateVisaReceived','embassyInterview','placementStart','placementEnd','hostCityArrival','earlyStart','lateStart','earlyEnd','lateEnd','employerDba','positionId','rm','paused','arrivalAirport','arrivalAirline','arrivalFlight','ssaOfficeName','ssaOfficeAddress','ssaOfficePhone','ssaZip','waGroupName','waGroupLink','managerName','employerCity','employerPhone','employerAddress','lastDayWorked','lastWorkDay'].forEach(k => {
    const v = asText(raw[k]);
    if(v) out[k] = v;
  });
  const first = asText(raw.first), last = asText(raw.last);
  if(first || last) out.name = [first, last].filter(Boolean).join(' ');
  else if(asText(raw.name)) out.name = asText(raw.name);
  const country = asText(raw.country);
  if(country) out.country = country;
  /* Birth Country is the verified roster column. Keep it beside country so
     this tile can use it without rewriting every other {country} sentence. */
  const birthCountry = asText(raw.birthCountry) || asText(raw.birth_country) || asText(raw['Birth Country']);
  if(birthCountry) out.birthCountry = birthCountry;
  const office = asText(raw.agencyOfficeCode) || asText(raw['Agency Office Code']);
  if(office) out.agencyOfficeCode = office;
  const coordinator = coordinatorFromRecord(raw);
  if(coordinator !== 'jenn') out.coordinator = coordinator;
  if(asText(raw.emailMask)) out.emailMask = safeEmailMask(raw.emailMask);
  else if(asText(raw.email) && String(raw.email).indexOf('@') > 0) out.emailMask = maskEmail(raw.email);
  return out.name || out.sid ? out : null;
}

/* The chooser may only carry name, agency and season, plus the sid used
   to ask for the full record. Employer and email from this payload are dropped. */
function projectChooser(raw){
  const first = asText(raw && raw.first), last = asText(raw && raw.last);
  const name = (first || last) ? [first, last].filter(Boolean).join(' ') : asText(raw && raw.name);
  const agency = asText(raw && raw.agency);
  const agencyName = (AGENCY_NAME[agency] || '') || asText(raw && raw.agencyName);
  const season = asText(raw && raw.season);
  const out = {name:name, agency:agency, agencyName:agencyName, season:season};
  const sid = asText(raw && raw.sid);
  if(sid) out.sid = sid;
  return out;
}

function finishOne(raw){
  const adapted = adaptFull(raw);
  return adapted ? enrich(adapted) : null;
}

function dataToOne(data){
  if(data == null) return null;
  if(Array.isArray(data)) return data.length === 1 ? finishOne(data[0]) : null;
  if(failureKind(data) === 'too-many') return null;
  if(data.found === false) return null;
  const rows = matchRows(data);
  if(rows) return rows.length === 1 ? finishOne(rows[0]) : null;
  if(!looksLikePerson(data)) return null;
  return finishOne(data);
}

function dataToNameList(data){
  if(data == null) return [];
  if(failureKind(data) === 'too-many') return 'too-many';
  let rows = Array.isArray(data) ? data : matchRows(data);
  if(!rows){
    if(data.found === false) return [];
    if(!looksLikePerson(data)) return [];
    rows = [data];
  }
  if(rows.length > 8) return 'too-many';
  if(rows.length === 1){
    const one = finishOne(rows[0]);
    return one ? [one] : [];
  }
  return rows.map(projectChooser).filter(p => p && p.name);
}

async function liveGet(params){
  let res;
  try{
    res = await fetch(liveUrl(params), {method:'GET', credentials:'omit', redirect:'follow', cache:'no-store'});
  }catch(e){
    throw LookupFail('network');
  }
  if(!res) throw LookupFail('network');
  if(res.status === 429) throw LookupFail('throttle');
  if(!res.ok) throw LookupFail('access');
  let text = '';
  try{ text = await res.text(); }
  catch(e){ throw LookupFail('network'); }
  const trimmed = String(text || '').trim();
  const ctype = headerOf(res, 'content-type');
  if(!trimmed) throw LookupFail('malformed');
  if(/text\/html/i.test(ctype) || trimmed.charAt(0) === '<' || /<!doctype html/i.test(trimmed))
    throw LookupFail('html');
  if(ctype && !/json/i.test(ctype) && trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[')
    throw LookupFail('malformed');
  let data;
  try{ data = JSON.parse(trimmed); }
  catch(e){ throw LookupFail('malformed'); }
  if(failureKind(data) === 'throttle') throw LookupFail('throttle');
  return data;
}

async function lookupToken(tok){
  const t = String(tok || '').trim();
  if(!t) return null;
  if(!endpointOn()){
    const hit = DEMO.find(x => x.tok === t);
    return hit ? enrich(hit) : null;
  }
  const data = await liveGet({t:t});
  return dataToOne(data);
}

async function lookup(sid, dob){
  const id = String(sid || '').trim();
  const d = String(dob || '').trim();
  if(!endpointOn()){
    const hit = DEMO.find(x => x.sid === id && x.dob === d);
    return hit ? enrich(hit) : null;
  }
  const data = await liveGet({q:id, dob:d});
  return dataToOne(data);
}

async function lookupName(full, dob){
  const name = String(full || '').trim();
  const d = String(dob || '').trim();
  if(!endpointOn()){
    const parts = name.toLowerCase().split(/\s+/).filter(Boolean);
    if(!parts.length) return [];
    const starts = (v, q) => String(v || '').toLowerCase().indexOf(q) === 0;
    let hits;
    if(parts.length === 1){
      const q = parts[0];
      hits = DEMO.filter(x => starts(x.first, q) || starts(x.last, q) || starts(x.preferred, q));
    } else {
      const f = parts[0], l = parts[parts.length - 1];
      hits = DEMO.filter(x => (starts(x.first, f) || starts(x.preferred, f)) && starts(x.last, l));
    }
    hits = hits.filter(x => x.dob === d);
    if(hits.length > 8) return 'too-many';
    return hits.map(enrich);
  }
  if(!name) return [];
  const data = await liveGet({q:name, dob:d});
  return dataToNameList(data);
}

function fieldValue(k){
  if(!ME) return '';
  if(k==='firstName') return asText(ME.firstName || ME.first);
  if(k==='name') return asText(ME.name) || [asText(ME.first), asText(ME.last)].filter(Boolean).join(' ');
  let v = ME[k];
  if(v===undefined || v===null) return '';
  v = String(v).trim();
  if(!v || v==='undefined' || v==='null') return '';
  if(k==='agency' || k==='agencyCode' || k==='agencyOfficeCode') return '';
  if(k==='agencyName'){
    if(AGENCY_NAME[v]) return AGENCY_NAME[v];
    if(typeof looksLikeAgencyCode==='function' && looksLikeAgencyCode(v)) return '';
    return v;
  }
  if(k==='coordinator'){
    const key = typeof coordinatorKey==='function' ? coordinatorKey(v) : '';
    if(key && typeof CHI_TEAM!=='undefined' && CHI_TEAM[key]) return CHI_TEAM[key].short;
    if(typeof looksLikeAgencyCode==='function' && looksLikeAgencyCode(v)) return '';
    return v;
  }
  if(k==='returnee'){
    const s = v.toLowerCase();
    if(s === 'yes' || s === 'y' || s === 'true' || s === 'returnee') return 'Yes';
    return '';
  }
  if(k==='day' || k==='len' || k==='daysLeft'){
    const n = Number(v);
    if(!isFinite(n)) return '';
    if(k==='day' && (n < 0 || (ME.daysLeft !== null && ME.daysLeft < 0))) return '';
    if(k==='len' && (n <= 0 || ME.day === null || ME.day < 0 || (ME.daysLeft !== null && ME.daysLeft < 0))) return '';
    return String(n);
  }
  return v;
}
function fill(str){
  if(!str) return str;
  return String(str).replace(/\[\[([\s\S]*?)\]\]/g, (m, inner) => {
    const keys = [];
    inner.replace(/\{(\w+)/g, (mm, k) => { keys.push(k); return mm; });
    if(keys.length && keys.some(k => !fieldValue(k))) return '';
    return inner;
  }).replace(/\{(\w+)(?:\|([^}]*))?\}/g, (m, k, fb) => {
    const v = fieldValue(k);
    if(v) return v;
    if(fb && fb!=='omit') return fb;
    return '';
  });
}
function fillSmart(str){
  if(!str) return '';
  let drop = false;
  let s = String(str).replace(/\[\[([\s\S]*?)\]\]/g, (m, inner) => {
    const keys = [];
    inner.replace(/\{(\w+)/g, (mm, k) => { keys.push(k); return mm; });
    if(keys.length && keys.some(k => !fieldValue(k))) return '';
    return inner;
  }).replace(/\{(\w+)(?:\|([^}]*))?\}/g, (m, k, fb) => {
    const v = fieldValue(k);
    if(v) return esc(v);
    if(fb==='omit'){ drop = true; return ''; }
    if(fb) return esc(fb);
    return '';
  });
  if(drop) return '';
  s = s.replace(/<b>\s*<\/b>/g,'').replace(/[ \t]{2,}/g,' ').replace(/\s+([.,;:])/g,'$1').replace(/\(\s*\)/g,'').trim();
  if(!s.replace(/<[^>]+>/g,'').replace(/[\s.,;:|/—\-]+/g,'')) return '';
  return s;
}
function tileYou(t){
  if(!t) return '';
  if(t.q==='My visa appointment') return visaYouHtml(ME);
  let raw = t.you || '';
  if(t.youYes || t.youNo){
    const hs = String(fieldValue('hasSSN')).toLowerCase();
    raw = (hs==='yes' || hs==='y') ? (t.youYes||'') : (t.youNo||t.you||'');
  }
  return fillSmart(raw);
}

let state = {stage:null, leaf:null, q:''};
let pickDob = '';
const view = document.getElementById('view');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const chev = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
const back = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

let nextStepsNow = null;
function setNextStepsNow(value){ nextStepsNow = value ? new Date(value) : null; }
function menuDay(){
  const d = nextStepsNow ? new Date(nextStepsNow.getTime()) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function rosterDay(v){
  const s = asText(v).slice(0, 10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return D(s);
}
function shiftDay(d, n){ const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function onOrAfterDay(a, b){ return a.getTime() >= b.getTime(); }
function onOrBeforeDay(a, b){ return a.getTime() <= b.getTime(); }
function normWord(v){ return asText(v).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function housingIsVerified(v){
  const s = normWord(v);
  if(!s) return null;
  return s === 'verified' || s === 'approved' || s === 'yes' || s === 'y';
}
function ssnState(v){
  const s = normWord(v);
  if(!s) return null;
  if(s === 'yes' || s === 'y') return 'yes';
  if(s === 'no' || s === 'n') return 'no';
  return null;
}
function sevisValidated(v){
  const s = normWord(v);
  return s === 'validated' || s === 'active' || s === 's' || s === 'sevis active';
}
function sevisActive(v){
  const s = normWord(v);
  return s === 'active' || s === 's' || s === 'sevis active';
}
function nextStepItems(){
  if(!ME) return [];
  const today = menuDay();
  const start = rosterDay(ME.dsStart);
  const end = rosterDay(ME.dsEnd);
  const arrival = rosterDay(ME.arrival);
  const worked = rosterDay(ME.lastDayWorked);
  const items = [];
  const sevis = normWord(ME.sevisStatus);
  if(arrival && sevis && !sevisValidated(sevis) && onOrAfterDay(today, arrival) && asText(ME.sevisDueF)){
    items.push({ priority:1, due:shiftDay(arrival, 3), q:'How do I validate my SEVIS record',
      text:'Validate your SEVIS record by ' + asText(ME.sevisDueF) + '. Use your housing address and room number.' });
  }
  if(worked && today.getTime() > worked.getTime() && onOrBeforeDay(today, shiftDay(worked, 30))){
    const leaveBy = asText(ME.graceEnd) || '30 days after your last day of work';
    items.push({ priority:2, due:shiftDay(worked, 30), q:'When do I have to leave the United States',
      text:'Your 30-day grace period started on your last day of work. You cannot work now. Leave by ' + leaveBy + '. Send your boarding pass photo after you fly.' });
  }
  if(arrival && onOrAfterDay(today, arrival) && onOrBeforeDay(today, shiftDay(arrival, 14))){
    items.push({ priority:3, due:shiftDay(arrival, 14), q:'I lost my job',
      text:'Your first 2 weeks: call in before any missed shift, wait to be checked out, phone away, one meal per shift, declare your tips.' });
  }
  if(end && onOrAfterDay(today, shiftDay(end, -45)) && onOrBeforeDay(today, end)){
    items.push({ priority:4, due:end, q:'I want to go home early',
      text:'Plan your last day: tell ' + (asText(ME.employer) || 'your employer') + ' a week ahead if you will finish early. Finishing work early is not the same as leaving the country early.' });
  }
  const housed = housingIsVerified(ME.housingStatus);
  if(housed === false && start && onOrAfterDay(today, shiftDay(start, -28)) && onOrBeforeDay(today, start)){
    items.push({ priority:5, due:start, q:'Where do I verify my housing',
      text:'Verify your housing in the portal now. It must be done 4 weeks before you arrive. You also need $1,500 for your first weeks.' });
  }
  if(arrival && onOrAfterDay(today, shiftDay(arrival, 25)) && onOrBeforeDay(today, shiftDay(arrival, 35))){
    items.push({ priority:6, due:shiftDay(arrival, 35), q:'Can I change to a different employer',
      text:'Never stop going to work until CHI emails you an approval for a new job.' });
  }
  if(end && onOrAfterDay(today, shiftDay(end, -21)) && onOrBeforeDay(today, end)){
    items.push({ priority:7, due:end, q:'How do I get my final paycheck',
      text:'Plan your last paycheck: contact your employer directly to arrange a check that arrives after you leave. Do not mail it to CHI. CHI will not deposit it. Keep your bank account open.' });
  }
  if(ssnState(ME.hasSSN) === 'no' && arrival && today.getTime() > shiftDay(arrival, 10).getTime()){
    const by = asText(ME.ssnBy);
    items.push({ priority:8, due:shiftDay(arrival, 10), q:'How do I apply for my Social Security Number',
      text:'Your Social Security Number is not on file. Visit the office only after the activation email.' + (by ? ' Do it by ' + by + '.' : '') });
  }
  if(start && sevis && sevisActive(sevis) && onOrAfterDay(today, start) && onOrBeforeDay(today, shiftDay(start, 7))){
    items.push({ priority:9, due:shiftDay(start, 7), q:'When do I start working',
      text:'Finish your employer onboarding this week. Your first shift comes after the paperwork, not on the DS start date alone.' });
  }
  if(arrival && onOrAfterDay(today, arrival) && onOrBeforeDay(today, shiftDay(arrival, 7))){
    items.push({ priority:10, due:shiftDay(arrival, 7), q:'Where do I find my insurance card',
      text:'Save your insurance card on your phone now: UHC Options PPO through IMG, from the Envisage Student Zone.' });
  }
  items.sort((a, b) => a.priority - b.priority || a.due - b.due);
  return items.slice(0, 3);
}
function nextStepsHtml(){
  const items = nextStepItems();
  if(!items.length) return '';
  return '<section class="nextsteps"><h2>My next steps</h2>' + items.map(item =>
    '<button type="button" class="nextitem" data-q="' + esc(item.q) + '"><span>' + esc(item.text) + '</span></button>'
  ).join('') + '</section>';
}

/* Stable topic slugs. These stay put when a title is edited.
   A link is ?tile=<slug> and nothing else about the student. */
const TILE_SLUGS = {
  'When is the next online orientation':'orientation',
  'My visa appointment':'visa-appointment',
  'Where is my DS-2019':'ds-2019',
  'I need to change my start date':'start-date',
  'Can CHI check my housing is not a scam':'housing-scam',
  'How early can I arrive':'arrive-early',
  'Where do I enter my visa results':'visa-results',
  'Where do I enter my flight details':'flight-details',
  'Where do I verify my housing':'verify-housing',
  'What airport should I fly into':'airport',
  'When should I contact my employer':'contact-employer',
  'WhatsApp groups for my employer':'whatsapp-group',
  'Where is my job description or offer':'job-offer',
  'What documents do I need':'documents',
  'Where can I find my sponsor letter':'sponsor-letter',
  'What should I bring':'packing',
  'Can I get a second job before I arrive':'second-job-before-arrival',
  'Can I start my Social Security':'social-security-before-arrival',
  'Where do I go on my first day':'first-day',
  'My housing when I land':'housing-on-arrival',
  'How do I get my I-94':'i-94',
  'How do I validate my SEVIS record':'sevis',
  'How do I apply for my Social Security Number':'social-security',
  'How do I fill in my employment paperwork':'employment-paperwork',
  'How do I get a US phone number':'us-phone',
  'How do I open a US bank account':'bank-account',
  'How do I get to work':'transport',
  'I need casino fingerprinting':'casino-fingerprinting',
  'I moved to a new address':'address-change',
  'I am not getting enough hours':'hours',
  'My pay is wrong':'pay-wrong',
  'What tax comes out of my pay':'tax',
  'There is Social Security or Medicare on my check':'fica',
  'I did not get my paycheck':'paycheck',
  'My time off was refused':'time-off',
  'I have a problem with my manager':'manager',
  'I have a problem with a coworker':'coworker',
  'I was sent home from a shift':'sent-home',
  'I lost my job':'lost-job',
  'How do I get a second job approved':'second-job',
  'My casino fingerprinting':'casino-fingerprinting-status',
  'Can I change to a different employer':'job-change',
  'Can I make my second job my main job':'second-job-main',
  'Something else about my job':'something-else',
  'I was in an accident':'accident',
  'I am sick or I am hurt':'sick',
  'I want to see a doctor':'doctor',
  'I have a toothache':'toothache',
  'Where do I find my insurance card':'insurance-card',
  'I feel unsafe or I am being harassed':'unsafe',
  'I am struggling or homesick':'homesick',
  'I lost my passport or another document':'lost-passport',
  'I need a letter or a document from CHI':'letter-from-chi',
  'I cannot get into my CHI portal':'portal-login',
  'My Social Security card has not come':'social-security-card',
  'Address verification for the bank':'address-verification',
  'Can I travel inside or outside the United States':'travel-signature',
  'I am being evicted':'eviction',
  'There is a problem at my housing':'housing-problem',
  'I want to go home early':'go-home-early',
  'When do I have to leave the United States':'leave-the-us',
  'Can I travel before I go home':'travel-before-home',
  'How do I extend my insurance for my travel period':'insurance-extension',
  'How do I get my final paycheck':'final-paycheck',
  'Should I close my US bank account':'close-bank',
  'How do I claim my tax overages back':'tax-overages',
  'Can I come back next year':'return-next-year',
  'Help me find housing':'find-housing',
  'When do I start working':'start-working',
  'Can I change my position or department':'change-position',
  'My monthly evaluation':'monthly-evaluation',
  'Who do I contact for help':'who-to-contact'
};
globalThis.TILE_SLUGS = TILE_SLUGS;
function slugFor(t){
  return t && TILE_SLUGS[t.q] || '';
}
function currentPageUrl(){
  try{
    const live = new URL(window.location.href);
    const remembered = history && typeof history.url === 'string' && history.url ? history.url : '';
    if(remembered) return new URL(remembered, live.origin);
    return live;
  }catch(e){ return null; }
}
function tileShareUrl(t){
  const slug = slugFor(t);
  const u = currentPageUrl();
  if(!u) return '?tile=' + encodeURIComponent(slug);
  const clean = new URL(u.origin + u.pathname);
  clean.searchParams.set('tile', slug);
  return clean.toString();
}
function tileLinkButton(t){
  return '<button type="button" class="copylink" data-tile-link="' + esc(tileShareUrl(t)) + '">Copy link to this tile</button>';
}
function syncTileUrl(){
  const u = currentPageUrl();
  if(!u) return;
  PAGE_IDENTITY_KEYS.forEach(k => u.searchParams.delete(k));
  if(u.searchParams.get('p')) u.searchParams.delete('p');
  if(state.leaf !== null && T[state.leaf] && slugFor(T[state.leaf])) u.searchParams.set('tile', slugFor(T[state.leaf]));
  else u.searchParams.delete('tile');
  const next = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + u.hash;
  try{ history.replaceState(null, '', next); }catch(e){}
}
function applyTileQuery(){
  if(!TILE_QUERY) return;
  const i = T.findIndex(t => slugFor(t) === TILE_QUERY);
  state.q = '';
  if(i < 0){ state.leaf = null; state.stage = null; return; }
  state.leaf = i;
  state.stage = T[i].s;
}
function render(){
  if(ME && ME.stage && !state.q && state.leaf === null && !state.stage) state.stage = ME.stage;
  if(state.q) renderSearch();
  else if(state.leaf !== null) renderLeaf();
  else if(state.stage) renderStage();
  else renderHome();
  syncTileUrl();
}

function renderHome(){
  view.innerHTML = `
    ${ME ? nextStepsHtml() : ''}
    <div class="ask"><span class="asklab">Where are you now?</span></div>
    <div class="grid q4">
      ${STAGES.map(s=>{
        const n = T.filter(t=>t.s===s.key).length;
        return `<button class="tile" data-stage="${s.key}"
          style="--tc:var(--s${s.n});--tl:var(--s${s.n}-soft);--ts:var(--s${s.n}-soft)">
          <svg class="ico" width="24" height="24" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[SICO[s.key]]}</svg>
          <span class="lab">${esc(s.t)}</span>
          ${ME && ME.stage===s.key ? `<span class="here" style="--tc:var(--s${s.n})">You are here</span>` : ''}
        </button>`;
      }).join('')}
    </div>
    <div class="brandmark">
      <img src="assets/chi-logo.png"
           alt="Cultural Homestay International, since 1980" width="72" height="72">
      <span>Cultural exchange programs since 1980</span>
    </div>`;
}

function renderStage(){
  const s = STAGES.find(x=>x.key===state.stage);
  const rows = T.filter(t=>t.s===state.stage);
  const style = `--tc:var(--s${s.n});--tl:var(--s${s.n}-soft);--ts:var(--s${s.n}-soft)`;
  let inner = '';
  if(rows.some(t=>t.g)){
    const seen = [];
    rows.forEach(t=>{ if(!seen.includes(t.g)) seen.push(t.g); });
    inner = seen.map(g=>`
      <h3 class="band" style="--tc:var(--s${s.n})">${esc(g)}</h3>
      <div class="grid" style="${style}">${rows.filter(t=>t.g===g).map(t=>qrow(t)).join('')}</div>`).join('');
  } else {
    inner = `<div class="grid" style="${style}">${rows.map(t=>qrow(t)).join('')}</div>`;
  }
  const nav = ME
    ? `<div class="board" style="--tc:var(--s${s.n})">
         <h2>${esc(s.t)}</h2>
         <div class="switch">${STAGES.filter(x=>x.key!==s.key).map(x=>`
           <button class="chip" data-stage="${x.key}" style="--tc:var(--s${x.n});--ts:var(--s${x.n}-soft)">
             ${esc(x.z || x.t)}${ME.stage===x.key?'<span class="dot"></span>':''}
           </button>`).join('')}</div>
       </div>`
    : `<div class="crumb"><button data-go="home">${back} All stages</button></div>`;
  let lead = `<p>${esc(s.d)}</p>`;
  if(ME && s.key === 'life'){
    lead = `<p>These come up at any point in your programme, not at one particular time.</p>`;
  } else if(ME && ME.stage === s.key){
    const where =
      ME.day === null ? ''
      : ME.day < 0 ? `You start in ${Math.abs(ME.day)} days.`
      : ME.daysLeft < 0 ? `Your programme ended ${Math.abs(ME.daysLeft)} days ago.`
      : ME.daysLeft <= 14 ? `You are on day ${ME.day} of ${ME.len}, with ${ME.daysLeft} to go.`
      : `You are on day ${ME.day} of ${ME.len}.`;
    lead = `<p>${where} These are the questions people ask at this point.</p>`;
  }
  const headline = ME
    ? `<div class="sect-h tight">${lead}</div>`
    : `<div class="sect-h"><h2>${esc(s.t)}</h2>${lead}</div>`;
  view.innerHTML = `
    ${ME ? nextStepsHtml() : ''}
    ${nav}
    ${headline}
    ${inner}`;
}

function qrow(t){
  const i = T.indexOf(t);
  const st = STAGES.find(x=>x.key===t.s);
  return `<button class="tile" data-leaf="${i}" style="--tc:var(--s${st.n});--tl:var(--s${st.n}-soft);--ts:var(--s${st.n}-soft)">
    ${ICO(t.ic)}
    <span class="lab">${esc(t.q)}</span>
    <span class="rt">${t.r === 'Answer' ? 'Answer here' : t.r === 'File' ? 'Short form' : t.r === 'Team' ? 'A person replies' : 'Your CHI team'}</span>
  </button>`;
}

function renderSearch(){
  const q = state.q.toLowerCase();
  const hits = T.filter(t => (t.q+' '+t.sub+' '+t.k).toLowerCase().includes(q));
  view.innerHTML = hits.length
    ? `<div class="sect-h" style="padding-top:14px"><h2>${hits.length} ${hits.length===1?'result':'results'}</h2><p>Across every stage of the program.</p></div>
       <div class="grid">${hits.map(t=>qrow(t)).join('')}</div>`
    : `<div class="empty">Nothing matches that word.<br>Try SSN, hours, housing, visa or second job.</div>`;
}

function looksLikeAgencyCode(v){
  return /^[A-Z0-9]{2,6}$/.test(String(v || ''));
}

/* Agency Office Code stays internal. Show the mapped name, never a bare code. */
function visaAgencyName(me){
  if(!me) return '';
  const code = asText(me.agency) || asText(me.agencyOfficeCode);
  if(code && AGENCY_NAME[code]) return AGENCY_NAME[code];
  const given = asText(me.agencyName);
  if(!given || given === code || looksLikeAgencyCode(given)) return '';
  return given;
}

function visaCountry(me){
  if(!me) return '';
  return asText(me.country) || asText(me.birthCountry);
}

function visaYouHtml(me){
  const country = visaCountry(me);
  const base = 'Message my CHI team about your visa. That opens an email to your coordinator.';
  if(country) return 'You are in <b>' + esc(country) + '</b>. ' + base;
  return base;
}

/* One zone per country. A country with more than one zone, or a country
   that is not listed, stays on New York time only. Match the whole name. */
const COUNTRY_ZONE = {
  peru:'America/Lima', colombia:'America/Bogota', ecuador:'America/Guayaquil',
  bolivia:'America/La_Paz', venezuela:'America/Caracas', paraguay:'America/Asuncion',
  uruguay:'America/Montevideo', argentina:'America/Argentina/Buenos_Aires',
  'costa rica':'America/Costa_Rica', panama:'America/Panama', nicaragua:'America/Managua',
  honduras:'America/Tegucigalpa', 'el salvador':'America/El_Salvador', guatemala:'America/Guatemala',
  jamaica:'America/Jamaica', 'dominican republic':'America/Santo_Domingo',
  'trinidad and tobago':'America/Port_of_Spain', barbados:'America/Barbados',
  romania:'Europe/Bucharest', bulgaria:'Europe/Sofia', poland:'Europe/Warsaw',
  hungary:'Europe/Budapest', 'czech republic':'Europe/Prague', czechia:'Europe/Prague',
  slovakia:'Europe/Bratislava', serbia:'Europe/Belgrade', croatia:'Europe/Zagreb',
  slovenia:'Europe/Ljubljana', 'bosnia and herzegovina':'Europe/Sarajevo',
  montenegro:'Europe/Podgorica', 'north macedonia':'Europe/Skopje', macedonia:'Europe/Skopje',
  albania:'Europe/Tirane', moldova:'Europe/Chisinau', ukraine:'Europe/Kyiv',
  turkey:'Europe/Istanbul', turkiye:'Europe/Istanbul', georgia:'Asia/Tbilisi',
  armenia:'Asia/Yerevan', lithuania:'Europe/Vilnius', latvia:'Europe/Riga',
  estonia:'Europe/Tallinn', germany:'Europe/Berlin', austria:'Europe/Vienna',
  netherlands:'Europe/Amsterdam', belgium:'Europe/Brussels', italy:'Europe/Rome',
  greece:'Europe/Athens', sweden:'Europe/Stockholm', norway:'Europe/Oslo',
  finland:'Europe/Helsinki', denmark:'Europe/Copenhagen', ireland:'Europe/Dublin',
  'united kingdom':'Europe/London', uk:'Europe/London', 'great britain':'Europe/London',
  england:'Europe/London', scotland:'Europe/London', wales:'Europe/London',
  thailand:'Asia/Bangkok', philippines:'Asia/Manila', vietnam:'Asia/Ho_Chi_Minh',
  'south korea':'Asia/Seoul', korea:'Asia/Seoul', 'republic of korea':'Asia/Seoul',
  japan:'Asia/Tokyo', china:'Asia/Shanghai', taiwan:'Asia/Taipei', india:'Asia/Kolkata',
  nepal:'Asia/Kathmandu', 'south africa':'Africa/Johannesburg', kenya:'Africa/Nairobi',
  ghana:'Africa/Accra', nigeria:'Africa/Lagos', tunisia:'Africa/Tunis',
  morocco:'Africa/Casablanca', egypt:'Africa/Cairo', israel:'Asia/Jerusalem',
  jordan:'Asia/Amman', singapore:'Asia/Singapore', 'new zealand':'Pacific/Auckland'
};
const COUNTRY_MULTI = {
  'united states':1, usa:1, us:1, 'united states of america':1, america:1,
  canada:1, mexico:1, brazil:1, russia:1, australia:1, indonesia:1,
  kazakhstan:1, spain:1, portugal:1, chile:1, france:1
};
function countryLookupKey(name){
  return String(name || '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}
function countryZone(country){
  const key = countryLookupKey(country);
  if(!key || COUNTRY_MULTI[key]) return '';
  return COUNTRY_ZONE[key] || '';
}
function plainClock(date, timeZone){
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(date).replace(/\u202f|\u00a0/g, ' ');
}
function plainWeekday(date, timeZone){
  return new Intl.DateTimeFormat('en-US', { timeZone: timeZone, weekday: 'long' }).format(date);
}
function plainMonthDay(dateStr){
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mo = Number(String(dateStr).slice(5, 7));
  const day = Number(String(dateStr).slice(8, 10));
  const year = String(dateStr).slice(0, 4);
  if(!months[mo - 1] || !day) return '';
  return months[mo - 1] + ' ' + day + ', ' + year;
}
function zonedWallTime(dateStr, hour, minute, timeZone){
  const y = Number(String(dateStr).slice(0, 4));
  const mo = Number(String(dateStr).slice(5, 7));
  const d = Number(String(dateStr).slice(8, 10));
  const wall = Date.UTC(y, mo - 1, d, hour, minute, 0);
  let utc = wall;
  for(let i = 0; i < 2; i++){
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date(utc));
    const bag = {};
    parts.forEach(p => { bag[p.type] = p.value; });
    let h = Number(bag.hour);
    if(h === 24) h = 0;
    const asUTC = Date.UTC(Number(bag.year), Number(bag.month) - 1, Number(bag.day), h, Number(bag.minute), Number(bag.second));
    utc = wall - (asUTC - utc);
  }
  return new Date(utc);
}
function weekStartParts(week){
  const raw = String(week && week.start || '10:00');
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  const hour = match ? Number(match[1]) : 10;
  const minute = match ? Number(match[2]) : 0;
  let zone = String(week && week.zone || 'America/New_York');
  try{ new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0); }
  catch(e){ zone = 'America/New_York'; }
  return { hour: hour, minute: minute, zone: zone };
}
let orientationNow = null;
let orientationWeeksOverride = null;
function setOrientationNow(value){
  orientationNow = value ? new Date(value) : null;
}
function setOrientationWeeks(list){
  orientationWeeksOverride = list;
}
function orientationClock(){
  return orientationNow ? new Date(orientationNow.getTime()) : new Date();
}
function orientationWeekList(){
  if(orientationWeeksOverride) return orientationWeeksOverride;
  if(typeof ORIENTATION_WEEKS !== 'undefined' && Array.isArray(ORIENTATION_WEEKS)) return ORIENTATION_WEEKS;
  return [];
}
function weekStillOpen(week, now){
  const sessions = week && Array.isArray(week.sessions) ? week.sessions : [];
  const last = sessions.length ? sessions[sessions.length - 1] : null;
  if(!last || !/^\d{4}-\d{2}-\d{2}$/.test(String(last.date || ''))) return false;
  const start = weekStartParts(week);
  const when = zonedWallTime(last.date, start.hour, start.minute, start.zone);
  return now.getTime() < when.getTime();
}
function orientationAttendedYes(){
  const v = String(fieldValue('orientationAttended')).toLowerCase();
  return v === 'yes' || v === 'y';
}
function orientationScheduleHtml(){
  const now = orientationClock();
  const localZone = countryZone(fieldValue('country'));
  const localName = fieldValue('country');
  const weeks = orientationWeekList().filter(week => weekStillOpen(week, now));
  let html = '';
  if(orientationAttendedYes()){
    html += '<p>Our records show you\'ve attended orientation.</p>';
  }
  if(!weeks.length){
    html += '<p>The next orientation dates will be posted here. Watch your email for your invitation.</p>';
    return html;
  }
  weeks.forEach(week => {
    const sessions = Array.isArray(week.sessions) ? week.sessions : [];
    const start = weekStartParts(week);
    const first = sessions[0] && sessions[0].date;
    const last = sessions[sessions.length - 1] && sessions[sessions.length - 1].date;
    const firstLabel = plainMonthDay(first);
    const lastLabel = plainMonthDay(last);
    let range = '';
    if(firstLabel && lastLabel){
      const sameMonth = firstLabel.slice(0, firstLabel.indexOf(' ')) === lastLabel.slice(0, lastLabel.indexOf(' '));
      const sameYear = String(first).slice(0, 4) === String(last).slice(0, 4);
      if(sameMonth && sameYear){
        range = firstLabel.replace(/, \d{4}$/, '') + ' to ' + String(Number(String(last).slice(8, 10))) + ', ' + String(first).slice(0, 4);
      } else if(sameYear){
        range = firstLabel.replace(/, \d{4}$/, '') + ' to ' + lastLabel;
      } else {
        range = firstLabel + ' to ' + lastLabel;
      }
    }
    html += '<p><b>' + esc(week.week || 'Orientation') + '</b>' + (range ? ': ' + esc(range) + '.' : '.') + ' Every session starts at ' + esc(plainClock(zonedWallTime(first, start.hour, start.minute, start.zone), start.zone)) + ' New York time.</p>';
    if(week.note) html += '<p>' + esc(week.note) + '</p>';
    sessions.forEach(session => {
      if(!session || !/^\d{4}-\d{2}-\d{2}$/.test(String(session.date || ''))) return;
      const when = zonedWallTime(session.date, start.hour, start.minute, start.zone);
      const day = plainWeekday(when, start.zone) + ', ' + plainMonthDay(session.date);
      let line = esc(session.name || 'Session') + ', ' + esc(day) + ': ' + esc(session.title || '') + '. ';
      line += esc(plainClock(when, start.zone)) + ' New York time.';
      if(localZone){
        line += ' ' + esc(plainClock(when, localZone)) + ' in ' + esc(localName) + '.';
      }
      html += '<p>' + line + '</p>';
    });
    const link = String(week.register || '');
    if(/^https:\/\//.test(link)){
      html += '<p><a href="' + esc(link) + '" target="_blank" rel="noopener">Register</a></p>';
    }
  });
  return html;
}

const askState = {};
const CHIWT = 'chiwt@chinet.org';

function shortFmt(d){
  if(!d) return '';
  return d.toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' });
}
function isoOf(d){
  if(!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function rosterIso(key){
  const raw = asText(ME && ME[key]);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
}

const ASK_FORMS = {};
function addAsk(questions, spec){
  if(spec.demote && !spec.fields.some(f => f.id === 'tried')){
    spec.fields.unshift({id:'tried', mail:'What you already tried', label:'What did you already try?', type:'area', required:true});
  }
  questions.forEach(q => { ASK_FORMS[q] = spec; });
}
const CHI_BUTTON = {
  'I feel unsafe or I am being harassed':1,
  'I am being evicted':1,
  'I need casino fingerprinting':1,
  'My casino fingerprinting':1,
  'Where is my DS-2019':1,
  'I was sent home from a shift':1
};
function stillSpec(t){
  return {
    topic:'I tried this',
    to:'coordinator',
    demote:true,
    fields:[
      {id:'tried', mail:'What you already tried', label:'What did you already try?', type:'area', required:true},
      {id:'stuck', mail:'What still does not work', label:'What still does not work?', type:'area', required:true}
    ]
  };
}
function formSpec(t){
  const spec = builderFor(t);
  if(spec) return spec;
  if(CHI_BUTTON[t.q]) return null;
  return stillSpec(t);
}
addAsk(['How do I extend my insurance for my travel period'], {
  topic:'Insurance Extension Request', to:'chiwt', cc:'coordinator',
  rules:[
    'Ask before your program end date.',
    'The fee is 50 dollars. Pay by card before your program end date.',
    'Do not put a card number in this email.',
    'The last day of cover can be at most 30 days after your program end date.'
  ],
  fixed:['Fee: 50 dollars. Pay by card before your program end date.'],
  fields:[
    {id:'coverEnd', mail:'Coverage end date', label:'What date should the cover end?', type:'date', required:true, min:'dsEndPlus1', max:'dsEndPlus30'},
    {id:'where', mail:'Where you will travel', label:'Which U.S. cities or states will you visit?', type:'text', required:true},
    {id:'depart', mail:'Departure date from the USA', label:'What date do you leave the USA?', type:'date', required:true},
    {id:'canPay', mail:'Can pay by card in time', label:'Can you pay the 50 dollars by card before your program end date?', type:'choice', required:true, options:['Yes', 'No']}
  ]
});
addAsk(['Can I travel inside or outside the United States', 'Can I travel before I go home'], {
  topic:'Travel Signature Request', layout:'travel', to:'chiwt', toAddress:'CHIWT@chinet.org',
  rules:['Request a travel signature 2 weeks ahead.'],
  attachLine:'Attach: a clear full page scan of your DS-2019',
  fields:[
    {id:'dest', mail:'Travel destination', label:'Which country and city are you going to?', type:'text', required:true},
    {id:'leave', mail:'Departure date from the United States', label:'What date do you leave the United States?', type:'date', required:true},
    {id:'back', mail:'Return date to the United States', label:'What date do you come back to the United States?', type:'date', required:true, max:'dayBeforeDsEnd'},
    {id:'bossYes', mail:'Employer approved this time off', label:'Did your employer approve this time off?', type:'choice', required:true, options:['Yes', 'No'], must:'Yes', deny:'Ask your manager first.'},
    {id:'scan', mail:'DS-2019 scan attached', label:'The DS-2019 scan is attached', type:'checks', required:true, options:['Yes']},
    {id:'email', mail:'Email', label:'What email should CHI use to send it back?', type:'text', required:true},
    {id:'whatsapp', mail:'WhatsApp number', label:'What is your WhatsApp number?', type:'text', required:true},
    {id:'entries', mail:'Visa entries', label:'What does Entries say on your visa?', type:'choice', required:true, options:['Multiple (M)', 'Single'], onlyIf:'missingEntries'}
  ]
});
addAsk(['I want to go home early'], {
  topic:'Shorten program', to:'coordinator', keepAct:true,
  fields:[
    {id:'why', mail:'Reason', label:'Why do you want to go home early?', type:'text', required:true},
    {id:'firstDay', mail:'First day of work', label:'What was your first day of work?', type:'date', required:true},
    {id:'lastDay', mail:'Final day of work', label:'What is your final day of work?', type:'date', required:true},
    {id:'told', mail:'Did you tell your employer and give one week notice?', label:'Did you tell your employer and give one week notice?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'city', mail:'Departure city', label:'Which city do you fly from?', type:'text', required:true},
    {id:'depart', mail:'Departure date', label:'What date do you fly?', type:'date', required:true},
    {id:'bought', mail:'Flight already bought', label:'Have you already bought your flight?', type:'choice', required:true, options:['Yes', 'No']}
  ]
});
addAsk(['I need to change my start date'], {
  topic:'Program date change', to:'coordinator',
  fields:[
    {id:'origStart', mail:'Original start date', label:'Original start date', type:'date', required:true, prefill:'dsStart', lock:true},
    {id:'origEnd', mail:'Original end date', label:'Original end date', type:'date', required:true, prefill:'dsEnd', lock:true},
    {id:'newStart', mail:'New start date', label:'What new start date do you need?', type:'date', required:true},
    {id:'newEnd', mail:'New end date', label:'What new end date do you need?', type:'date', required:true},
    {id:'reason', mail:'Reason', label:'Why do the dates need to change?', type:'text', required:true},
    {id:'agreed', mail:'Employer agreed', label:'Did your employer agree?', type:'choice', required:true, options:['Yes', 'No', 'Not yet']}
  ]
});
addAsk(['Where do I enter my visa results'], {
  topic:'Visa status', to:'coordinator', demote:true,
  fields:[
    {id:'interview', mail:'Embassy interview date', label:'What is your embassy interview date?', type:'date', required:true, prefill:'embassyInterviewIso'},
    {id:'status', mail:'Status', label:'What is the visa status?', type:'choice', required:true, options:['Approved', 'Denied', 'Pending', 'Administrative processing']},
    {id:'inPassport', mail:'Visa is in your passport', label:'Is the visa in your passport now?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'deniedOn', mail:'Date denied', label:'What date were you denied?', type:'date', required:true, when:{id:'status', value:'Denied'}},
    {id:'deniedWhy', mail:'Reason given', label:'What reason did they give?', type:'text', required:true, quick:['Not given'], when:{id:'status', value:'Denied'}}
  ]
});
addAsk(['When should I contact my employer'], {
  topic:'Employer interview', to:'coordinator', demote:true,
  fields:[
    {id:'date', mail:'Interview date', label:'What date is the interview?', type:'date', required:true},
    {id:'time', mail:'Interview time', label:'What time is the interview?', type:'time', required:true},
    {id:'who', mail:'Interviewer name', label:'What is the interviewer name?', type:'text', required:true},
    {id:'platform', mail:'Platform', label:'Where is the interview?', type:'choice', required:true, options:['Zoom', 'Phone', 'WhatsApp', 'Other']},
    {id:'done', mail:'Interview already happened', label:'Has the interview already happened?', type:'choice', required:true, options:['No', 'Yes']}
  ]
});
addAsk(['Can I come back next year'], {
  topic:'Return next year', to:'coordinator',
  fields:[
    {id:'prior', mail:'J-1 programs before this one', label:'How many J-1 programs did you do before?', type:'text', required:true},
    {id:'same', mail:'Same employer', label:'Do you want the same employer?', type:'choice', required:true, options:['Yes', 'No', 'Not sure']}
  ]
});
addAsk(['I have a problem with my manager'], {
  topic:'Needs help', to:'coordinator', demote:true,
  fields:[
    {id:'what', mail:'What happened', label:'What happened?', type:'text', required:true},
    {id:'when', mail:'When it started', label:'When did it start?', type:'date', required:true},
    {id:'told', mail:'Talked to manager', label:'Did you talk to your manager?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'help', mail:'Help needed', label:'What help do you need?', type:'text', required:true},
    {id:'safeWork', mail:'Safe at work', label:'Do you feel safe at work?', type:'choice', required:true, options:['Yes', 'No']}
  ]
});
addAsk(['I lost my job'], {
  topic:'Lost job', to:'coordinator',
  fields:[
    {id:'why', mail:'Reason', label:'Why did the job end?', type:'text', required:true},
    {id:'last', mail:'Last day worked', label:'What was your last day of work?', type:'date', required:true},
    {id:'found', mail:'Found another job', label:'Have you found another job?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'newStart', mail:'New job start date', label:'What is the new job start date?', type:'date', required:true, when:{id:'found', value:'Yes'}},
    {id:'prior', mail:'J-1 programs before this one', label:'How many J-1 programs did you do before?', type:'text', required:true}
  ]
});
addAsk(['Where do I verify my housing'], {
  topic:'Liability release', to:'chiwt', cc:'jennifer', withAct:true, demote:true,
  note:'Email the signed PDF to CHI. You must attach the file yourself. This draft does not attach it.',
  fields:[
    {id:'attach', mail:'Signed PDF', label:'Will you attach the signed PDF yourself?', type:'choice', required:true, options:['Yes']},
    {id:'whoSigns', mail:'Who must sign', label:'Who must sign?', type:'choice', required:true, options:['Me', 'A family member', 'The host']}
  ]
});
addAsk(['There is a problem at my housing'], {
  topic:'Housing problem', to:'coordinator', demote:true,
  fields:[
    {id:'what', mail:'Problem', label:'What is the problem?', type:'choice', required:true, options:['Repair', 'Rent', 'Roommate', 'Other']},
    {id:'when', mail:'When it started', label:'When did it start?', type:'date', required:true},
    {id:'told', mail:'Wrote to the landlord', label:'Did you write to the landlord?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'tonight', mail:'Can stay tonight', label:'Can you stay there tonight?', type:'choice', required:true, options:['Yes', 'No']}
  ]
});
addAsk(['I did not get my paycheck'], {
  topic:'Missing paycheck', to:'coordinator', demote:true,
  fields:[
    {id:'what', mail:'What is wrong', label:'What is wrong with the pay?', type:'choice', required:true, options:['Missing pay', 'Wrong amount', 'Name on the check', 'Other']},
    {id:'when', mail:'Pay date', label:'What was the pay date?', type:'date', required:true},
    {id:'told', mail:'Told payroll', label:'Did you tell payroll?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'finalPay', mail:'Final paycheck', label:'Is this your final paycheck?', type:'choice', required:true, options:['No', 'Yes']}
  ]
});
addAsk(['I am not getting enough hours'], {
  topic:'Hours cut', to:'coordinator', demote:true,
  fields:[
    {id:'hours', mail:'Hours this week', label:'How many hours did you work this week?', type:'text', required:true},
    {id:'weeks', mail:'Short weeks', label:'How many weeks were short?', type:'choice', required:true, options:['1', '2', '3 or more']},
    {id:'when', mail:'Week of', label:'Which week should we look at?', type:'date', required:true},
    {id:'toldMgr', mail:'Told your manager', label:'Did you tell your manager?', type:'choice', required:true, options:['Yes', 'No']}
  ]
});
addAsk(['I am sick or I am hurt'], {
  topic:'Sick or hurt', to:'coordinator', demote:true,
  fields:[
    {id:'what', mail:'What is wrong', label:'What is wrong?', type:'text', required:true},
    {id:'when', mail:'When it started', label:'When did it start?', type:'date', required:true},
    {id:'where', mail:'Where you went', label:'Where did you go?', type:'choice', required:true, options:['Teladoc', 'Walk-in clinic', 'Urgent care', 'Emergency room', 'Not yet']},
    {id:'work', mail:'Happened at work', label:'Did this happen at work?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'overnight', mail:'Hospital overnight', label:'Did you stay in a hospital overnight?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'nights', mail:'Nights in hospital', label:'How many nights?', type:'text', required:true, when:{id:'overnight', value:'Yes'}}
  ]
});
addAsk(['I want to see a doctor'], {
  topic:'Doctor visit', to:'coordinator', demote:true,
  fields:[
    {id:'need', mail:'What you need', label:'What do you need?', type:'choice', required:true, options:['A doctor visit', 'A bill or claim', 'A prescription']},
    {id:'when', mail:'Date', label:'What date was the visit?', type:'date', required:true},
    {id:'paid', mail:'Already paid a bill', label:'Did you already pay a bill?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'tookCard', mail:'Clinic took the insurance card', label:'Did the clinic take your insurance card?', type:'choice', required:true, options:['Yes', 'No']}
  ]
});
addAsk(['I lost my passport or another document'], {
  topic:'Incident - Lost Passport', to:'coordinator', incident:true,
  note:'CHI must report some things to the U.S. government. This helps you and keeps you safe. If you have photos, attach them in your email app. This page cannot attach files.',
  fields:[
    {id:'items', mail:'Items', label:'Which items are gone?', type:'checks', required:true, options:['Passport', 'Visa', 'DS-2019', 'I-94 printout', 'Other']},
    {id:'how', mail:'Lost or stolen', label:'Was it lost or stolen?', type:'choice', required:true, options:['Lost', 'Stolen']},
    {id:'when', mail:'Date it happened', label:'What date did this happen?', type:'date', required:true},
    {id:'toldChi', mail:'Date you first told CHI', label:'What date did you first tell CHI?', type:'date', required:true, prefill:'today'},
    {id:'city', mail:'City', label:'What city?', type:'text', required:true, prefill:'placeCity'},
    {id:'state', mail:'State', label:'What state?', type:'text', required:true, prefill:'placeState'},
    {id:'place', mail:'Place', label:'What kind of place?', type:'choice', required:true, options:['Work', 'Housing', 'Other']},
    {id:'what', mail:'What happened', label:'What happened, step by step?', type:'area', required:true},
    {id:'police', mail:'Police report made', label:'Did you make a police report?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'policeDept', mail:'Police department', label:'What is the police department name?', type:'text', required:true, when:{id:'police', value:'Yes'}},
    {id:'reportNo', mail:'Police report number', label:'What is the report number, if you have it?', type:'text', when:{id:'police', value:'Yes'}},
    {id:'embassy', mail:'Contacted your embassy or consulate', label:'Did you contact your embassy or consulate?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'embassyDate', mail:'Date you contacted the embassy', label:'What date did you contact them?', type:'date', required:true, when:{id:'embassy', value:'Yes'}},
    {id:'passCountry', mail:'Passport country', label:'What country issued the passport?', type:'text', required:true, prefill:'country'},
    {id:'newPass', mail:'New passport applied for', label:'Did you apply for a new passport?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'newPassDate', mail:'New passport application date', label:'What date did you apply?', type:'date', required:true, when:{id:'newPass', value:'Yes'}},
    {id:'copies', mail:'Copies or photos', label:'Do you still have copies or photos?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'toldBoss', mail:'Employer told', label:'Did you tell your employer?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'travel', mail:'Travel planned soon', label:'Do you have travel planned soon?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'travelDate', mail:'Travel date', label:'What date is that trip?', type:'date', required:true, when:{id:'travel', value:'Yes'}},
    {id:'help', mail:'Help you need', label:'What help do you need from CHI?', type:'area', required:true}
  ]
});
addAsk(['How do I get a second job approved'], {
  topic:'Second job', to:'coordinator',
  fields:[
    {id:'employer', mail:'New employer', label:'What is the new employer name?', type:'text', required:true},
    {id:'title', mail:'Job title', label:'What is the job title?', type:'text', required:true},
    {id:'started', mail:'Already started', label:'Have you already started?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'when', mail:'New job start date', label:'What is the new job start date?', type:'date', required:true},
    {id:'overlap', mail:'Hours overlap the main job', label:'Do these hours overlap your main job?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'prior', mail:'J-1 programs before this one', label:'How many J-1 programs did you do before?', type:'text', required:true}
  ]
});
addAsk(['Where do I enter my flight details'], {
  topic:'Flight change', to:'coordinator', demote:true,
  fields:[
    {id:'what', mail:'What changed', label:'What changed?', type:'choice', required:true, options:['New flight', 'Late landing', 'No flight yet']},
    {id:'when', mail:'Arrival date', label:'What is the arrival date?', type:'date', required:true},
    {id:'flight', mail:'Flight number', label:'What is the flight number?', type:'text', required:true},
    {id:'landTime', mail:'Landing time', label:'What time do you land?', type:'time', required:true}
  ]
});
addAsk(['I was in an accident'], {
  topic:'Incident - Scooter Accident', to:'coordinator', incident:true, help911:true,
  note:'CHI must report some things to the U.S. government. This helps you and keeps you safe. This form is for a scooter, e-bike, bike, car, or walking. If you have photos, attach them in your email app. This page cannot attach files.',
  fields:[
    {id:'safe', mail:'Safe right now', label:'Are you safe right now?', type:'choice', required:true, options:['Yes', 'No']},
    {id:'missWork', mail:'Will you miss work?', label:'Will you miss work?', type:'choice', required:true, top:true, options:['No', 'Yes', 'Not sure']},
    {id:'daysSoFar', mail:'Days missed so far', label:'How many days so far?', type:'text', required:true, top:true, when:{id:'missWork', value:'Yes'}},
    {id:'backWork', mail:'When can you go back to work?', label:'When can you go back to work?', type:'date', required:true, top:true, or:'Doctor has not said yet', quick:['Doctor has not said yet']},
    {id:'doctorNote', mail:'Doctor gave a note', label:'Did the doctor give you a note?', type:'choice', required:true, top:true, options:['No', 'Yes'], hint:'If yes, attach the note in your email app.'},
    {id:'helmet', mail:'Were you wearing a helmet?', label:'Were you wearing a helmet?', type:'choice', required:true, top:true, options:['Yes', 'No']},
    {id:'when', mail:'Date', label:'What date did this happen?', type:'date', required:true},
    {id:'vehicle', mail:'Vehicle', label:'What were you using?', type:'choice', required:true, options:['Scooter', 'Rented scooter', 'E-bike', 'Bike', 'Car', 'Walking']},
    {id:'company', mail:'Rental company', label:'What company, such as Lime or Bird?', type:'text', required:true, when:{id:'vehicle', value:'Rented scooter'}},
    {id:'role', mail:'Riding or hit', label:'Were you riding, or were you hit?', type:'choice', required:true, options:['I was riding', 'I was hit', 'Both']},
    {id:'doctor', mail:'Doctor, urgent care, or ER', label:'Did you go to a doctor, urgent care, or the ER?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'doctorName', mail:'Place or doctor name', label:'What is the name of the place or doctor?', type:'text', required:true, when:{id:'doctor', value:'Yes'}},
    {id:'nights', mail:'Nights in hospital', label:'How many nights in the hospital? Write 0 if none.', type:'text', required:true, when:{id:'doctor', value:'Yes'}},
    {id:'police', mail:'Police came', label:'Did the police come?', type:'choice', required:true, options:['No', 'Yes']},
    {id:'policeDept', mail:'Police department', label:'What is the police department name?', type:'text', required:true, when:{id:'police', value:'Yes'}},
    {id:'reportNo', mail:'Police report number', label:'What is the report number, if you have it?', type:'text', when:{id:'police', value:'Yes'}},
    {id:'what', mail:'What happened', label:'What happened, step by step?', type:'area', required:true}
  ]
});

function builderFor(t){
  return t && ASK_FORMS[t.q] || null;
}
function boundDate(specName){
  const end = rosterIso('dsEnd');
  if(!end || !D(end)) return '';
  if(specName === 'dsEndPlus1') return isoOf(addDays(D(end), 1));
  if(specName === 'dsEndPlus30') return isoOf(addDays(D(end), 30));
  if(specName === 'dayBeforeDsEnd') return isoOf(addDays(D(end), -1));
  return '';
}
function rosterVisaEntries(){
  const keys = ['visaEntries','entries','visaEntry'];
  for(let i = 0; i < keys.length; i++){
    const v = asText(ME && ME[keys[i]]);
    if(v) return v;
  }
  return '';
}
function fieldShown(t, field){
  if(field.onlyIf === 'missingEntries' && rosterVisaEntries()) return false;
  if(!field.when) return true;
  return fieldValueAsk(t, {id:field.when.id}) === field.when.value;
}
function todayIso(){
  const d = new Date();
  return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}
function splitTown(which){
  const loc = asText(ME && (ME.location || ME.employerCity));
  const cut = loc.lastIndexOf(',');
  if(which === 'city') return cut < 0 ? loc : loc.slice(0, cut).trim();
  return cut < 0 ? '' : loc.slice(cut + 1).trim();
}
function fieldValueAsk(t, field){
  const bag = askState[t.q] || {};
  if(field && field.id && Object.prototype.hasOwnProperty.call(bag, field.id)) return bag[field.id];
  if(!field || !field.prefill) return '';
  if(field.prefill === 'today') return todayIso();
  if(field.prefill === 'placeCity') return splitTown('city');
  if(field.prefill === 'placeState') return splitTown('state');
  if(field.prefill === 'country') return asText(ME && ME.country);
  if(field.prefill === 'embassyInterviewIso') return rosterIso('embassyInterviewIso');
  return rosterIso(field.prefill);
}
function fieldLimit(field, edge){
  return field[edge] ? boundDate(field[edge]) : '';
}
function fieldError(t, field){
  if(!fieldShown(t, field)) return '';
  const value = fieldValueAsk(t, field);
  if(field.or && value === field.or) return '';
  if(field.required && !asText(value)) return 'Required';
  if(field.must && asText(value) && value !== field.must) return field.deny || 'Ask your manager first.';
  if(field.type === 'date' && value && /^\d{4}-\d{2}-\d{2}$/.test(value)){
    const min = fieldLimit(field, 'min');
    const max = fieldLimit(field, 'max');
    if(min && value < min) return 'Pick a later date';
    if(max && value > max){
      if(field.max === 'dayBeforeDsEnd') return 'Your return date must be before your program end date';
      return 'That date is more than 30 days after your program end date';
    }
  }
  return '';
}
function askReady(t, spec){
  return spec.fields.every(field => !fieldShown(t, field) || !fieldError(t, field));
}
function askSubject(t, spec){
  const urgent = (askState[t.q] || {}).__urgent === 'Yes';
  if(spec.layout === 'travel'){
    const name = asText(ME && ME.name) || 'No name';
    const sid = asText(ME && ME.sid) || 'No Student ID';
    const subject = 'Travel Signature Request, ' + name + ', SID ' + sid;
    return urgent ? '⏰ ' + subject : subject;
  }
  const season = asText(ME && ME.season) || 'No season';
  const sid = asText(ME && ME.sid) || 'No Student ID';
  const name = asText(ME && ME.name) || 'No name';
  let subject = spec.topic + ' | ' + season + ' | ' + sid + ' | ' + name;
  if(urgent) subject = '⏰ Time Sensitive | ' + subject;
  return subject;
}
function longDate(iso){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? FMT(D(String(iso).slice(0, 10))) : '';
}
function travelBody(t){
  const name = asText(ME && ME.name) || 'Not on file';
  const sid = asText(ME && ME.sid) || 'Not on file';
  const employer = asText(ME && ME.employer) || 'Not on file';
  const start = longDate(rosterIso('dsStart')) || 'Not on file';
  const end = longDate(rosterIso('dsEnd')) || 'Not on file';
  const entries = rosterVisaEntries() || fieldValueAsk(t, {id:'entries'}) || 'Not on file';
  const dest = fieldValueAsk(t, {id:'dest'}) || 'Not on file';
  const leave = longDate(fieldValueAsk(t, {id:'leave'})) || 'Not on file';
  const back = longDate(fieldValueAsk(t, {id:'back'})) || 'Not on file';
  const email = fieldValueAsk(t, {id:'email'}) || 'Not on file';
  const wa = fieldValueAsk(t, {id:'whatsapp'}) || 'Not on file';
  return [
    'Hello CHI Team,',
    '',
    'I am writing to request a travel signature on my DS-2019.',
    '',
    'Full name: ' + name,
    'Student Program ID: ' + sid,
    'Employer: ' + employer,
    'Program dates: ' + start + ' to ' + end,
    'Visa type: J-1, Entries ' + entries,
    '',
    'Travel destination: ' + dest,
    'Departure date from the United States: ' + leave,
    'Return date to the United States: ' + back,
    '',
    'My employer has approved this time off. A clear scan of my DS-2019 is attached. Please sign it and send it back before my departure date.',
    '',
    'Thank you,',
    name,
    email,
    wa
  ].join('\n');
}
function rosterMailLines(spec){
  const lines = [];
  const put = (label, value) => lines.push(label + ': ' + (asText(value) || 'Not on file'));
  put('Participant Name', ME && ME.name);
  put('Student ID', ME && ME.sid);
  put('Season', ME && ME.season);
  put('Employer', ME && ME.employer);
  put('Location', ME && ME.location);
  put('Position/Job Title', ME && ME.job);
  const start = rosterIso('dsStart');
  const end = rosterIso('dsEnd');
  put('DS start', start ? shortFmt(D(start)) : '');
  put('DS end', end ? shortFmt(D(end)) : '');
  if(spec && spec.incident){
    put('Country', ME && ME.country);
    put('SEVIS ID', ME && (ME.sevisId || ME.sevisID || ME.sevisNumber));
    put('City', splitTown('city'));
    put('State', splitTown('state'));
    put('Coordinator', CHI_TEAM[assignedCoordinator()].greet);
  }
  return lines;
}
function askBody(t, spec){
  if(spec.layout === 'travel') return travelBody(t);
  const lines = ['Hello,', ''].concat(rosterMailLines(spec));
  lines.push('', 'Student ID: ' + (asText(ME && ME.sid) || 'Not on file'), '');
  const answerLines = { top: [], rest: [] };
  spec.fields.forEach(field => {
    if(!fieldShown(t, field)) return;
    let value = fieldValueAsk(t, field);
    if(field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) value = shortFmt(D(value));
    const line = (field.mail || field.label) + ': ' + (value || 'Not on file');
    answerLines[field.top ? 'top' : 'rest'].push(line);
  });
  answerLines.top.forEach(line => lines.push(line));
  if(answerLines.top.length) lines.push('');
  answerLines.rest.forEach(line => lines.push(line));
  (spec.fixed || []).forEach(line => lines.push(line));
  if(spec.note) lines.push(spec.note);
  return lines.join('\n');
}
function askMailUrl(t, spec){
  const to = spec.toAddress || (spec.to === 'chiwt' ? CHIWT : CHI_TEAM[assignedCoordinator()].email);
  let cc = '';
  if(spec.cc === 'coordinator') cc = CHI_TEAM[assignedCoordinator()].email;
  else if(spec.cc === 'jennifer') cc = CHI_TEAM.jenn.email;
  let url = 'mailto:' + to
    + '?subject=' + encodeURIComponent(askSubject(t, spec))
    + '&body=' + encodeURIComponent(askBody(t, spec));
  if(cc) url += '&cc=' + encodeURIComponent(cc);
  return url;
}
function setAskAnswer(id, value){
  const t = T[state.leaf];
  if(!t) return;
  askState[t.q] = askState[t.q] || {};
  askState[t.q][id] = value;
  render();
}
function openAskMail(){
  const t = T[state.leaf];
  const spec = formSpec(t);
  if(!t || !spec || !askReady(t, spec)) return false;
  openMailDraft(askMailUrl(t, spec));
  return true;
}
globalThis.ASK_FORMS = ASK_FORMS;

function askHtml(t){
  const spec = formSpec(t);
  if(!spec || !ME) return '';
  const bag = askState[t.q] || {};
  const urgent = bag.__urgent === 'Yes';
  const fields = spec.fields.map(field => {
    if(!fieldShown(t, field)) return '';
    const value = fieldValueAsk(t, field);
    const req = field.required ? ' <span class="req">Required</span>' : '';
    const err = fieldError(t, field);
    const errHtml = err && err !== 'Required' ? '<span class="askerr">' + esc(err) + '</span>' : '';
    if(field.type === 'choice'){
      const buttons = field.options.map(opt => {
        const on = value === opt ? ' aria-pressed="true"' : ' aria-pressed="false"';
        return '<button type="button" class="choice" data-ask-choice="' + esc(field.id) + '" data-ask-value="' + esc(opt) + '"' + on + '>' + esc(opt) + '</button>';
      }).join('');
      const hint = field.hint ? '<span class="askhint">' + esc(field.hint) + '</span>' : '';
      return '<fieldset class="askq"><legend>' + esc(field.label) + req + '</legend><div class="choices">' + buttons + '</div>' + hint + errHtml + '</fieldset>';
    }
    if(field.type === 'checks'){
      const picked = String(value || '').split(', ').filter(Boolean);
      const buttons = field.options.map(opt => {
        const on = picked.indexOf(opt) >= 0 ? ' aria-pressed="true"' : ' aria-pressed="false"';
        return '<button type="button" class="choice" data-ask-check="' + esc(field.id) + '" data-ask-value="' + esc(opt) + '"' + on + '>' + esc(opt) + '</button>';
      }).join('');
      return '<fieldset class="askq"><legend>' + esc(field.label) + req + '</legend><div class="choices">' + buttons + '</div>' + errHtml + '</fieldset>';
    }
    if(field.type === 'area'){
      return '<label class="askq">' + esc(field.label) + req
        + '<textarea data-ask="' + esc(field.id) + '" rows="4">' + esc(value) + '</textarea>'
        + errHtml + '</label>';
    }
    const type = field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';
    const min = fieldLimit(field, 'min');
    const max = fieldLimit(field, 'max');
    const shown = field.or && value === field.or ? '' : value;
    const quick = (field.quick || []).map(opt => {
      const on = value === opt ? ' aria-pressed="true"' : ' aria-pressed="false"';
      return '<button type="button" class="choice" data-ask-choice="' + esc(field.id) + '" data-ask-value="' + esc(opt) + '"' + on + '>' + esc(opt) + '</button>';
    }).join('');
    const hint = field.hint ? '<span class="askhint">' + esc(field.hint) + '</span>' : '';
    return '<label class="askq">' + esc(field.label) + req
      + '<input data-ask="' + esc(field.id) + '" type="' + type + '" value="' + esc(shown) + '"'
      + (min ? ' min="' + esc(min) + '"' : '')
      + (max ? ' max="' + esc(max) + '"' : '')
      + (field.lock ? ' readonly' : '')
      + '>' + (quick ? '<span class="choices">' + quick + '</span>' : '') + hint + errHtml + '</label>';
  }).join('');
  const ready = askReady(t, spec);
  const end = rosterIso('dsEnd');
  const maxText = end ? shortFmt(D(boundDate('dsEndPlus30'))) : '';
  const rules = (spec.rules || []).map(line => '<li>' + esc(line) + (line.indexOf('30 days') >= 0 && maxText ? ' The last allowed day is ' + esc(maxText) + '.' : '') + '</li>').join('');
  const facts = rosterMailLines(spec).map(line => '<li>' + esc(line) + '</li>').join('');
  const safeNow = spec.help911 && fieldValueAsk(t, {id:'safe'}) === 'No'
    ? '<p class="asknote">You are not safe. Call 911. Then call CHI at 1-800-432-4643, ext. 0.</p>'
    : '';
  return '<section class="builder">'
    + (rules ? '<ul class="rules">' + rules + '</ul>' : '')
    + (spec.note ? '<p class="asknote">' + esc(spec.note) + '</p>' : '')
    + safeNow
    + (spec.demote ? '' : '<div class="rosterbox"><p class="asktag">From your record</p><ul>' + facts + '</ul></div>')
    + fields
    + '<fieldset class="askq"><legend>Time sensitive?</legend><div class="choices">'
    + '<button type="button" class="choice" data-ask-choice="__urgent" data-ask-value="Yes"' + (urgent ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>Yes</button>'
    + '<button type="button" class="choice" data-ask-choice="__urgent" data-ask-value="No"' + (!urgent ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>No</button>'
    + '</div></fieldset>'
    + (spec.attachLine ? '<p class="asknote">' + esc(spec.attachLine) + '</p>' : '')
    + '<button type="button" class="act" id="asksend" data-ask-send="1"' + (ready ? '' : ' disabled') + '>Review my email</button>'
    + '</section>';
}

function firstScreenText(t){
  const p = t && t.plain;
  const bits = p ? [p.lead].concat(p.steps || [], p.watch || []) : [t.lead].concat((t && t.body) || []);
  return bits.filter(Boolean).map(s => String(s).replace(/<[^>]+>/g, ' ')).join(' ');
}

function leafBody(t){
  return t.body.map(p => {
    if(t.q === 'My visa appointment' && String(p).indexOf('Is your appointment after your start date') === 0){
      const when = ME && asText(ME.dsStartF);
      const sentence = when
        ? 'Is your appointment after your start date, <b>' + esc(when) + '</b>? CHI can write a letter to move your dates.'
        : esc(p);
      return '<p>' + sentence + '</p>';
    }
    const text = fillSmart(p);
    if(!text) return '';
    return '<p>' + text + '</p>';
  }).join('');
}

function renderLeaf(){
  const t = T[state.leaf];
  const s = STAGES.find(x=>x.key===t.s);
  if(!ME){
    view.innerHTML = `
      <div class="crumb"><button data-go="${state.q?'search':'stage'}" data-stage="${t.s}">${back} ${esc(state.q?'Results':s.t)}</button></div>
      <article class="leaf">
        <div class="leaf-h">
          <h2>${esc(t.q)}</h2>
          <div class="leaf-meta"><span class="pill ${t.r}">${t.r}</span><span style="font-size:12.5px;color:var(--ink-3)">${esc(ROUTE_D[t.r])}</span></div>
          ${tileLinkButton(t)}
        </div>
        <div class="leaf-b">
          <div class="lock">
            <span class="lock-l">This answer is different for every person</span>
            <p>Put in your Student ID and your date of birth, and this page will answer with your own dates, your employer and your deadlines, not general information. The date of birth is how the page knows it is you and not somebody looking you up.</p>
            <div class="idrow">
              <input id="idq2" placeholder="Student ID or your name" autocomplete="off" aria-label="Student ID or your name">
            </div>
            <div class="idrow dobrow">
              <input id="iddob2" type="date" autocomplete="off" aria-label="Your date of birth">
              <button class="act go inline" data-id="go">Answer this for me</button>
            </div>
            <div id="iderr"></div>
          </div>
        </div>
      </article>`;
    return;
  }
  let url = t.act.url ? `https://${t.act.url}` : null;
  if(url && ME){
    const q = [];
    ['sid','first','last','employer'].forEach(k => {
      const v = asText(ME[k]);
      if(v && v !== 'undefined') q.push(k + '=' + encodeURIComponent(v));
    });
    if(q.length) url += '?' + q.join('&');
  }
  const youHtml = tileYou(t);
  const spec = builderFor(t);
  const needsButton = !spec && CHI_BUTTON[t.q];
  const showAct = !!url || needsButton || (spec && (spec.keepAct || spec.withAct));
  const actHtml = !showAct ? '' : url
    ? '<a class="act" href="' + url + '" target="_blank" rel="noopener">' + esc(t.act.label) + '</a>'
    : '<button class="act' + (t.act.kind === 'answer' ? ' ghost' : '') + '" data-act="' + t.act.kind + '">' + esc(t.act.label) + '</button>';
  view.innerHTML = `
    <div class="crumb"><button data-go="${state.q?'search':'stage'}" data-stage="${t.s}">${back} ${esc(state.q?'Results':s.t)}</button></div>
    <article class="leaf">
      <div class="leaf-h">
        <h2>${esc(t.q)}</h2>
        <div class="leaf-meta"><span class="pill ${t.r}">${t.r}</span><span style="font-size:12.5px;color:var(--ink-3)">${esc(ROUTE_D[t.r])}</span></div>
        ${tileLinkButton(t)}
      </div>
      <div class="leaf-b">
        ${youHtml ? `<div class="you"><span class="yl">Your programme</span>${youHtml}</div>` : ''}
        <div class="screen">
          <p class="lead">${fillSmart((t.plain && t.plain.lead) || t.lead)}</p>
          ${(t.plain && t.plain.steps && t.plain.steps.length) ? `<ol class="steps">${t.plain.steps.map(step => { const text = fillSmart(step); return text ? '<li>' + text + '</li>' : ''; }).join('')}</ol>` : ''}
          ${(t.plain && t.plain.watch) ? `<p class="watch"><span class="wtag">Watch out</span> ${fillSmart(t.plain.watch)}</p>` : ''}
        </div>
        ${t.q === 'When is the next online orientation' ? '<div class="sched">' + orientationScheduleHtml() + '</div>' : ''}
        <details class="more">
          <summary>More details</summary>
          ${fillSmart(t.lead) ? '<p>' + fillSmart(t.lead) + '</p>' : ''}
          ${leafBody(t)}
          ${t.clock ? `<div class="note clock"><span class="clock-l">${esc(t.clock.l)}</span>${fillSmart(t.clock.t)}</div>` : ''}
          ${t.hz ? `<div class="note">Housing has tiles at every point in your program. Search the word housing and they all come up.</div>` : ''}
          ${t.sample ? `<div class="sample">
            <div class="sample-h"><span class="sample-l">${esc(t.sample.title)}</span><button class="copy" data-copy="${T.indexOf(t)}">Copy</button></div>
            <div class="sample-t">${t.sample.lines.map(l=>fillSmart(l)||'&nbsp;').join('<br>')}</div>
          </div>` : ''}
          ${t.need && t.need.length ? `<div class="need"><h4>What to have ready</h4><ul>${t.need.map(n=>fillSmart(n)).filter(Boolean).map(n=>`<li>${n}</li>`).join('')}</ul></div>` : ''}
        </details>
        ${(formSpec(t) && formSpec(t).demote) ? '<details class="still"><summary>Still need help?</summary><p class="askhint">I tried this and it did not work.</p>' + askHtml(t) + '</details>' : askHtml(t)}
        ${actHtml}
      </div>
    </article>`;
}

/* ---------- wiring view ---------- */
function renderWiring(){
  const w = document.getElementById('wiring');
  const n = {live:0, build:0, fix:0};
  T.forEach(t=>n[t.w.status]++);
  const byRoute = r => T.filter(t=>t.r===r).length;
  w.innerHTML = `
    <div class="wire-lead">
      <h1>Wiring</h1>
      <p>Every tile, what fires it, what it captures and where it lands. Built means nothing exists yet. Fix means the asset exists but has a known bug that must be cleared before it sends.</p>
    </div>
    <div class="stat">
      <div><b>${T.length}</b><span>tiles in total</span></div>
      <div><b style="color:var(--ok)">${n.live}</b><span>ready to wire</span></div>
      <div><b style="color:var(--file)">${n.build}</b><span>need building</span></div>
      <div><b style="color:var(--chi)">${n.fix}</b><span>fix a bug first</span></div>
    </div>
    <div class="stat">
      <div><b>${byRoute('Answer')}</b><span>Answer, resolves on the page</span></div>
      <div><b>${byRoute('File')}</b><span>File, form and tracked row</span></div>
      <div><b>${byRoute('Team')}</b><span>Team, straight to a person</span></div>
      <div><b>${byRoute('Agency')}</b><span>Agency, not a CHI question</span></div>
    </div>
    <div class="stat">
      <div><b style="color:var(--mo)">${T.filter(t=>t.mo).length}</b><span>tiles that end at the main office</span></div>
      <div><b>${new Set(T.filter(t=>t.mo).map(t=>t.mo[0])).size}</b><span>CHI Advisor templates they use</span></div>
      <div><b>${Object.keys(MOT).length}</b><span>templates in CHI Advisor</span></div>
      <div><b>4</b><span>main office people, routed by agency code</span></div>
    </div>
    ${STAGES.map(s=>{
      const rows = T.filter(t=>t.s===s.key);
      return `<section class="wgroup">
        <h3>${s.n}. ${esc(s.t)} &middot; ${rows.length} tiles</h3>
        ${rows.map(t=>`
          <div class="wrow">
            <div class="wrow-h">
              <b>${esc(t.q)}</b>
              <span class="pill ${t.r}">${t.r}</span>
              <span class="tag ${t.w.status}">${t.w.status==='live'?'Ready':t.w.status==='build'?'Build':'Fix first'}</span>
              ${t.mo?`<span class="tag mo">Main office</span>`:''}
            </div>
            <dl class="wgrid">
              <dt>Trigger</dt><dd>${esc(t.w.trigger)}</dd>
              <dt>Fires</dt><dd>${esc(t.w.fires)}</dd>
              <dt>Captures</dt><dd>${esc(t.w.captures)}</dd>
              <dt>Notifies</dt><dd>${esc(t.w.notify)}</dd>
              <dt>Logs to</dt><dd>${esc(t.w.log)}</dd>
              ${t.mo?`<dt>Main office</dt><dd><code>${esc(MOT[t.mo[0]]||t.mo[0])}</code> &middot; ${esc(t.mo[1])}</dd>`:''}
              ${t.w.note?`<dt>Note</dt><dd>${esc(t.w.note)}</dd>`:''}
            </dl>
          </div>`).join('')}
      </section>`;
    }).join('')}

    <section class="wgroup">
      <h3>Personalisation &middot; one lookup, ${T.filter(t=>t.you).length} tiles</h3>
      <div class="wrow">
        <div class="wrow-h"><b>What the Student ID buys</b><span class="tag build">Build</span></div>
        <dl class="wgrid">
          <dt>Input</dt><dd>One field. Digits are treated as a Student Program Id and go straight to the participant. Anything else is treated as a name. Either route ends holding a SID, and every deadline, every merge field and every prefilled form runs off that SID alone.</dd>
          <dt>Name mode</dt><dd>One name matches on first, family or preferred name. Two or more match first and family. More than 8 results is refused and asks for the Student ID, so the field cannot be used to walk the roster. Several matches show a chooser carrying only name, agency name and season. No SID, no employer, no email until the person picks themselves.</dd>
          <dt>Worth knowing</dt><dd>A five digit SID on its own identifies a participant, and SIDs run in sequence. Anyone typing numbers in that range sees a name, an employer and programme dates. Email is never displayed. If that is more than the office wants to accept, the fix is not a second field, it is the personalised link in the drip email, which removes typing altogether and can carry a token no one can guess.</dd>
          <dt>Returns</dt><dd>One participant, not a list: <code>sid, first, last, email, agency, country, employer, location, job, dsStart, dsEnd, arrival, hasSSN</code>. Never the whole row, never anyone else.</dd>
          <dt>Agency code</dt><dd>The code comes back and stays internal. It is what routes the case, picks the main office contact and groups the reporting, and a participant never sees it. The page carries the 52 code to name pairs from the Agencies sheet and shows the name instead, so AEX reads as American Experience and EXPB as Experience Work and Travel Doo. If a new agency is added to the roster without a row in the Agencies sheet, the page falls back to the country rather than printing a code.</dd>
          <dt>Computes</dt><dd>Day in programme, days left, SEVIS validation within 3 days of arrival, SSN deadline at end minus 45, grace period end at last day worked plus 30, and the gap between landing and the insurance start date.</dd>
          <dt>Changes</dt><dd>The stage question disappears. The programme day is computed from the DS dates, so the page opens on the right stage instead of asking a participant to classify themselves, and the other three stages stay one tap away on a switcher. ${T.filter(t=>t.you).length} of ${T.length} tiles swap general wording for their own employer, their own dates and their own deadline. Every Tally link arrives prefilled with SID, name, employer and email.</dd>
          <dt>Gate</dt><dd>The tiles are open, the answers are not. Anyone can browse all 45 questions and search them, which is what makes a participant want in. Opening a tile asks for the Student ID, and the answer is only ever the personal one. There is no general version, so nobody reads generic wording when a specific answer exists for them, and every participant ends up knowing their own SID because it is the price of every answer.</dd>
          <dt>Stored</dt><dd>In the browser only, so they identify once and not on every visit. No cookie, no account, nothing leaves the phone.</dd>
          <dt>Left open</dt><dd>The message my CHI team bar at the bottom stays visible before identification. It is the only route for someone who is unsafe, has lost their documents, or cannot recall their SID at the moment they need help, and the standing rule is to fail toward a human. Everything else is behind the gate.</dd>
        </dl>
      </div>
      <div class="wrow">
        <div class="wrow-h"><b>Where the lookup should live</b><span class="tag build">Build</span></div>
        <dl class="wgrid">
          <dt>Do not</dt><dd>Ship the roster as a file inside the page. A static site means anyone can read what it contains, and that would put 493 names, employers and email addresses on the open internet.</dd>
          <dt>Cheapest</dt><dd>An Apps Script web app on the sheet you already have. Free, no card, no Firebase, and it reads the same Master Data sheet CHI Advisor reads. Deploy as a web app, execute as you, access to anyone.</dd>
          <dt>Guard</dt><dd>Require both fields, return nothing on a mismatch, and stop after a handful of failed attempts from the same visitor. That is enough to stop someone walking the SID range.</dd>
          <dt>Better</dt><dd>Put a one participant link inside the drip email that already reaches all 493. No typing at all, and typing mistakes are the single most common reason a lookup fails.</dd>
        </dl>
        <div class="code">// CaseTrackerLookup.gs, deployed as a web app. Access has to be
// Anyone, because a participant is never signed in to Google. That
// is exactly why there are only two ways in and no third.

//   ?t=&lt;token&gt;                the personal link from the email
//   ?q=52341&amp;dob=2004-03-11   the fallback, both halves required

// A wrong ID and a wrong date give the same answer as each other,
// so the endpoint cannot be used to confirm that an ID exists.
// 40 misses in ten minutes and it stops answering the fallback.
// Token traffic is never throttled, so an attack on the fallback
// does not lock out the people arriving by their own link.

// In the menu page:

const ENDPOINT = &#39;https://script.google.com/macros/s/XXXX/exec&#39;;

async function lookupToken(t){                     // the email link
  const r = await fetch(ENDPOINT + &#39;?t=&#39; + encodeURIComponent(t));
  return r.json();
}
async function lookup(sid, dob){                   // the fallback
  const r = await fetch(ENDPOINT + &#39;?q=&#39; + encodeURIComponent(sid)
                                 + &#39;&amp;dob=&#39; + encodeURIComponent(dob));
  return r.json();        // { found:true, sid, first, employer, dsStart, emailMask ... }
}                         // or { found:false, message } </div>
        <dl class="wgrid" style="margin-top:10px">
          <dt>Why any of this</dt><dd>Student IDs are four to six sequential digits. An endpoint that answers <code>who is 52341</code> to anybody with the link hands over the whole roster to a script that counts upwards, and a name plus an employer plus programme dates is a ready made phishing kit aimed at a population that already gets targeted. The page is static and has nothing to break into. This one endpoint is the entire attack surface.</dd>
          <dt>The personal link</dt><dd>Run <code>buildMenuLinks()</code> once. It adds <code>Menu Token</code> and <code>Menu Link</code> to Master Data and fills the blanks with 128 random bits each, never regenerating one that already exists, so links already sitting in inboxes keep working. Put <code>Menu Link</code> into the automated emails and a participant arrives already identified, having typed nothing. To revoke one person, clear their token cell and run it again.</dd>
          <dt>Link hygiene</dt><dd>The page strips <code>?p=</code> out of the address bar the moment it is used. Without that, the first participant who copies the link out of their browser into the employer WhatsApp group hands forty people their own record.</dd>
          <dt>Name mode</dt><dd>Name plus date of birth, capped at 8, carrying only <code>sid, first, last, agency, season</code>. In practice the date collapses it to one person, so the chooser almost never appears. Nothing is exposed before a single participant has been identified.</dd>
          <dt>Watch it</dt><dd>Every attempt writes a row to a <code>Lookup Log</code> sheet: when, how, what was typed, found or not. Never the date of birth and never a token. A column of misses climbing on its own is a scrape in progress, and it is the only way you will see one.</dd>
          <dt>Still open</dt><dd>Anyone holding a valid link sees that participant. That is the same exposure as forwarding the email, and it is the right trade for a page whose whole point is one tap. What it is not is a roster anybody can walk.</dd>
        </dl>
      </div>
    </section>
    <div class="foot">
      Routes: Answer resolves on the page and nothing reaches the team. File captures a form submission, sends a confirmation, notifies and schedules chases. Team goes to a person with no automatic reply. Agency points the participant to the office named in Agency Office Code.<br><br>
      Default rule: anything unmatched, unclassified, or a bare hello goes to the team. Fail toward a human.<br><br>
      Live assets: two Tally forms (early departure pbLbZP, job change aQyZxb), plus Housing Safety and Welfare Check and Participant Help Request. The SSN receipt form is not used: CHI does not collect the receipt, so that tile answers on the page instead of opening a form. Nineteen Quick Send templates with real HTML bodies. CHI_AutoSend.gs holds the routing table, hold list and follow up scheduler.<br><br>
      Main office: 20 of the 43 tiles end with an email to the main office, and CHI Advisor already writes every one of them. The add-on reads the Master Data sheet, looks the participant up by SID or by name, and drafts the email with the subject line already in the sortable format of season, agency, SID, name. The greeting resolves from the agency code through the POC table, so AEX opens with Kelly Asmus and Drew Edgeworth, EXPB with Milena Minkova, STA with Kelly Asmus and Eliza Stirrat. That is the piece that does not need building.<br><br>
      What is missing is the join. Today the tile ends at the coordinator, the coordinator opens CHI Advisor, looks up the SID again and retypes what the form already captured. The tile already holds the SID, the employer, the dates and the reason. Passing those into the add-on as prefilled form values removes the second lookup on every one of the 20.<br><br>
      Three CHI Advisor templates have no tile and correctly so, because a participant never asks for them: Unresponsive Participant, Agency Status Check and Employer Interview Scheduled all start with the coordinator, not the participant. Liability Release Agreement is a separate flow that goes to chiwt with a copy to the coordinator and needs the signed PDF attached after the draft is made.<br><br>
      One tile needs a template written that CHI Advisor does not have: the DS-2019 reprint on the lost document tile. It currently has to go out as Custom, which means the 75 dollar fee, the shipping address and the DoS branch are all retyped by hand every time.<br><br>
      Known bugs that block sending: merge fields disagree between the curly and square bracket styles and the script only handles square brackets; Travel Outside US has no name field and opens with Hi dash; the proof of return address is wrong in three places; the medical template still carries unfilled Hospital List and Urgent Care List placeholders and auto sends overnight; the fingerprinting template skips Section 3; the Tickets sheet has nineteen duplicate Fire and Police columns.
    </div>`;
}


function gate(){
  const sw = document.getElementById('searchwrap');
  const vw = document.getElementById('view');
  if(sw) sw.hidden = false;
  if(vw) vw.hidden = false;
  if(document.body) document.body.classList.toggle('locked', !ME);
}

function renderId(){
  const z = document.getElementById('idzone');
  gate();
  if(ME){
    const st = STAGES.find(x=>x.key===ME.stage);
    const pos = (ME.day===null) ? '' :
      ME.day < 0 ? `${Math.abs(ME.day)} days before you start`
      : ME.daysLeft < 0 ? `${Math.abs(ME.daysLeft)} days past your end date`
      : `day ${ME.day} of ${ME.len}`;
    z.innerHTML = `<div class="strip" style="--sc:var(--s${st?st.n:3})">
      <div class="strip-b">
        <div class="strip-n">${esc(ME.name)}</div>
        <div class="strip-d">${esc(ME.sid)} &middot; ${esc(ME.employer)} &middot; ${esc(pos)}</div>
      </div>
      <button data-id="clear">Not you?</button>
    </div>`;
    return;
  }
  if(idMode === 'pick'){
    z.innerHTML = `<div class="idcard">
      <h2>Which one is you?</h2>
      <p>More than one person has that name. Choose yourself from the list.</p>
      <div class="picks">${picks.map((m,i)=>`
        <button class="pick" data-id="pick" data-i="${i}">
          <span class="pick-n">${esc(m.name)}</span>
          <span class="pick-d">${esc(m.agencyName || m.country)} &middot; ${esc(m.season||'')}</span>
        </button>`).join('')}</div>
      <div id="iderr"></div>
      <button class="idskip" data-id="mode-id">None of these, search again</button>
    </div>`;
    return;
  }
  z.innerHTML = `<div class="idcard slim">
    <h2>Put in your Student ID and your date of birth for your own answers</h2>
    <div class="idrow">
      <input id="idq" placeholder="Student ID or your name" autocomplete="off" aria-label="Student ID or your name">
    </div>
    <div class="idrow dobrow">
      <input id="iddob" type="date" autocomplete="off" aria-label="Your date of birth">
      <button class="act go inline" data-id="go">Find me</button>
    </div>
    <div id="iderr"></div>
  </div>
  ${ENDPOINT ? '' : `<div class="preview">
    <span class="preview-l">Preview</span>
    Demo data.
    <button class="try" data-id="try" data-v="52341" data-d="2004-03-11">52341</button><button class="try" data-id="try" data-v="53880" data-d="2003-07-29">53880</button><button class="try" data-id="try" data-v="61200" data-d="2004-09-02">61200</button><button class="try" data-id="try" data-v="Ivan" data-d="2002-11-18">Ivan</button>
  </div>`}`;
}

/* Deliberately slow and deliberately vague. A wrong Student ID and a wrong
   date of birth give the same answer, so nothing here can be used to confirm
   that an ID exists. After five misses the page stops answering for a minute.
   This is a courtesy limit only. The real limit belongs in the web app. */
let tries = 0, coolUntil = 0;

const NOMATCH = 'That does not match a record. Check your Student ID, it is your record number in the CHI portal, and check your date of birth.';
const THROTTLED = 'Too many tries. Wait a minute, then try again. If it still will not work, use the message button at the bottom of the page.';

function noteLookupFailure(e){
  const err = document.getElementById('iderr');
  if(e && e.kind === 'throttle'){
    coolUntil = Date.now() + 60000;
    tries = 0;
    if(err) err.innerHTML = '<div class="iderr">' + THROTTLED + '</div>';
    return;
  }
  if(err) err.innerHTML = '';
}

async function chooseListed(i){
  const pick = picks[i];
  if(!pick) return;
  if(!endpointOn()){
    setMe(pick); idMode='id'; picks=[]; renderId(); render(); window.scrollTo({top:0,behavior:'instant'});
    return;
  }
  const q = pick.sid || pick.name;
  let full = null;
  try{ full = q && pickDob ? await lookup(q, pickDob) : null; }
  catch(e){ noteLookupFailure(e); return; }
  if(!full){
    const err = document.getElementById('iderr');
    if(err) err.innerHTML = '<div class="iderr">' + NOMATCH + '</div>';
    return;
  }
  tries = 0;
  setMe(full); idMode='id'; picks=[]; renderId(); render(); window.scrollTo({top:0,behavior:'instant'});
}

async function doLookup(){
  const el  = document.getElementById('idq2') || document.getElementById('idq');
  const dl  = document.getElementById('iddob2') || document.getElementById('iddob');
  const v   = el ? el.value.trim() : '';
  const dob = dl ? dl.value.trim() : '';
  const err = document.getElementById('iderr');
  const say = m => { if(err) err.innerHTML = `<div class="iderr">${m}</div>`; };
  const nomatch = NOMATCH;

  const left = Math.ceil((coolUntil - Date.now())/1000);
  if(left > 0){ say(`Too many tries. Wait ${left} seconds, then try again.`); return; }
  if(!v && !dob){ say('Put in your Student ID and your date of birth.'); return; }
  if(!v){ say('Put in your Student ID or your name as well.'); return; }
  if(!dob){ say('Put in your date of birth as well. It is how the page knows it is you.'); return; }
  if(err) err.innerHTML = '';

  const miss = () => {
    tries++;
    if(tries >= 5){ coolUntil = Date.now() + 60000; tries = 0; say(THROTTLED); return; }
    say(nomatch);
  };

  try{
    if(/^\d{4,6}$/.test(v)){
      const hit = await lookup(v, dob);
      if(!hit){ miss(); return; }
      tries = 0; setMe(hit); idMode='id'; renderId(); render(); window.scrollTo({top:0,behavior:'instant'});
      return;
    }
    if(/\d/.test(v) && !/[a-z]/i.test(v)){ miss(); return; }

    const res = await lookupName(v, dob);
    if(res === 'too-many'){ say('That matches more than one person. Use your Student ID instead.'); return; }
    if(!res.length){ miss(); return; }
    tries = 0;
    if(res.length === 1){ setMe(res[0]); idMode='id'; renderId(); render(); window.scrollTo({top:0,behavior:'instant'}); return; }
    picks = res; pickDob = dob; idMode = 'pick'; renderId();
  }catch(e){
    noteLookupFailure(e);
  }
}

/* ---------- events ---------- */
document.addEventListener('input', e => {
  const el = e.target && e.target.closest && e.target.closest('[data-ask]');
  if(!el || state.leaf === null || !T[state.leaf]) return;
  const t = T[state.leaf];
  askState[t.q] = askState[t.q] || {};
  askState[t.q][el.dataset.ask] = el.value;
  const spec = builderFor(t);
  const btn = document.getElementById('asksend');
  if(btn) btn.disabled = !askReady(t, spec);
});
document.addEventListener('click', e => {
  const check = e.target && e.target.closest && e.target.closest('[data-ask-check]');
  if(check){
    const t = T[state.leaf];
    const id = check.dataset.askCheck;
    const val = check.dataset.askValue;
    const cur = t ? String(fieldValueAsk(t, {id:id}) || '') : '';
    const parts = cur ? cur.split(', ').filter(Boolean) : [];
    const at = parts.indexOf(val);
    if(at >= 0) parts.splice(at, 1);
    else parts.push(val);
    setAskAnswer(id, parts.join(', '));
    return;
  }
  const choice = e.target && e.target.closest && e.target.closest('[data-ask-choice]');
  if(choice){
    setAskAnswer(choice.dataset.askChoice, choice.dataset.askValue);
    return;
  }
  const send = e.target && e.target.closest && e.target.closest('[data-ask-send]');
  if(send){
    if(send.disabled) return;
    openAskMail();
    return;
  }
  const tileCopy = e.target.closest('[data-tile-link]');
  if(tileCopy){
    const url = tileCopy.getAttribute ? (tileCopy.getAttribute('data-tile-link') || tileCopy.dataset.tileLink || '') : (tileCopy.dataset.tileLink || '');
    try{ navigator.clipboard.writeText(url); }catch(err){}
    tileCopy.textContent = 'Link copied';
    setTimeout(()=>{ tileCopy.textContent = 'Copy link to this tile'; }, 1800);
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if(cp){
    const t = T[+cp.dataset.copy];
    const txt = t.sample.lines.map(l=>fill(l).replace(/<[^>]+>/g,'')).join('\n');
    try{ navigator.clipboard.writeText(txt); }catch(err){}
    cp.textContent = 'Copied'; setTimeout(()=>{ cp.textContent='Copy'; }, 1800);
    return;
  }
  const idb = e.target.closest('[data-id]');
  if(idb){
    const k = idb.dataset.id;
    if(k==='copy'){ return; }
    if(k==='try'){
      const f=document.getElementById('idq'), d=document.getElementById('iddob');
      if(f){ f.value=idb.dataset.v; }
      if(d){ d.value=idb.dataset.d || ''; }
      doLookup(); return;
    }
    if(k==='go'){ doLookup(); return; }
    if(k==='mode-id'){ idMode='id'; picks=[]; renderId(); return; }
    if(k==='pick'){ chooseListed(+idb.dataset.i); return; }
    if(k==='clear'){ setMe(null); idMode='id'; state.stage=null; state.leaf=null; renderId(); render(); return; }
    if(k==='noop'){ return; }
  }
  const nq = e.target.closest('[data-q]');
  if(nq && nq.dataset.q){
    openQuestion(nq.dataset.q);
    window.scrollTo({top:0,behavior:'instant'});
    return;
  }
  const st = e.target.closest('[data-stage]');
  const lf = e.target.closest('[data-leaf]');
  const go = e.target.closest('[data-go]');
  const ac = e.target.closest('[data-act]');
  if(go){
    const d = go.dataset.go;
    if(d==='home'){ state.stage=null; state.leaf=null; state.q=''; sIn.value=''; }
    else if(d==='search'){ state.leaf=null; }
    else { state.leaf=null; state.stage=go.dataset.stage; state.q=''; sIn.value=''; }
    render(); window.scrollTo({top:0,behavior:'instant'}); return;
  }
  if(lf){ state.leaf=+lf.dataset.leaf; render(); window.scrollTo({top:0,behavior:'instant'}); return; }
  if(st && !lf){ state.stage=st.dataset.stage; state.leaf=null; render(); window.scrollTo({top:0,behavior:'instant'}); return; }
  if(ac){
    const k = ac.dataset.act;
    if(k==='agency' || k==='chi'){
      const bar = document.getElementById('msg');
      if(bar && bar.focus) bar.focus();
      if(bar && bar.scrollIntoView) bar.scrollIntoView({block:'nearest'});
      ac.textContent = 'Use Message my CHI team at the bottom of the page';
    } else {
      ac.textContent = k==='answer' ? 'Go back and choose another topic'
        : k==='template' ? 'Sent. Check your email, including spam'
        : 'Your CHI team has this. You will hear back within one working day';
    }
    ac.disabled = true; ac.style.opacity = '.75'; ac.style.cursor = 'default';
  }
});

const sWrap = document.getElementById('searchwrap'), sOpen = document.getElementById('sopen');
sOpen.addEventListener('click', () => {
  const on = !sWrap.classList.contains('open');
  sWrap.classList.toggle('open', on);
  sOpen.setAttribute('aria-expanded', String(on));
  if(on) document.getElementById('s').focus();
  else { document.getElementById('s').value=''; state.q=''; render(); }
});
const sIn = document.getElementById('s'), sClear = document.getElementById('sclear');
sIn.addEventListener('input', () => {
  state.q = sIn.value.trim(); state.leaf = null;
  sClear.hidden = !state.q;
  render();
});
sClear.addEventListener('click', () => { sIn.value=''; state.q=''; sClear.hidden=true; sIn.focus(); render(); });

/* Approved coordinators. Email is the main draft. WhatsApp is the second button.
   A click opens a draft only. Nothing is sent until the participant taps Send.
   Names match the whole value only. Unknown or mixed values use Jennifer. */
const CHI_TEAM = {
  jenn: { greet:'Jennifer', short:'Jenn', email:'chijennifer@chinet.org', whatsapp:'https://wa.me/16099484483' },
  kathleen: { greet:'Kathleen', short:'Kathleen', email:'chikathleenr@chinet.org', whatsapp:'https://wa.me/16093503606' },
  victor: { greet:'Victor', short:'Victor', email:'chivictor@chinet.org', whatsapp:'https://wa.me/16098922969' },
  amy: { greet:'Amy', short:'Amy', email:'chiamyj@chinet.org', whatsapp:'https://wa.me/17178805970' },
  dasha: { greet:'Dasha', short:'Dasha', email:'chidashak@chinet.org', whatsapp:'https://wa.me/16465121122' }
};
const COORDINATOR_NAMES = {
  'jenn':'jenn', 'jennifer campbell':'jenn',
  'kathleen':'kathleen', 'kathleen rizzo':'kathleen',
  'victor':'victor', 'victor purilla':'victor',
  'amy':'amy', 'amy jackson':'amy',
  'dasha':'dasha', 'dasha komarova':'dasha'
};
const PRIVATE_QUESTION = {
  'I feel unsafe or I am being harassed':1,
  'I am struggling or homesick':1,
  'I am sick or I am hurt':1,
  'I have a toothache':1,
  'I was in an accident':1
};

function coordinatorKey(value){
  const s = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return COORDINATOR_NAMES[s] || '';
}

/* coordinator is the minimal key. Coordinators is the roster header.
   A blank field is ignored. A field that is not exactly one approved name,
   or two fields that disagree, falls back to Jenn. */
function coordinatorFromRecord(raw){
  if(!raw || typeof raw !== 'object') return 'jenn';
  const present = [];
  ['coordinator', 'Coordinators'].forEach(key => {
    if(raw[key] === undefined || raw[key] === null) return;
    if(String(raw[key]).trim() === '') return;
    present.push(coordinatorKey(raw[key]));
  });
  if(!present.length) return 'jenn';
  if(present.some(key => !key)) return 'jenn';
  const unique = present.filter((key, i) => present.indexOf(key) === i);
  if(unique.length !== 1) return 'jenn';
  return unique[0];
}

function assignedCoordinator(){
  const key = ME && ME.coordinator;
  return CHI_TEAM[key] ? key : 'jenn';
}

function currentQuestion(){
  if(state.leaf === null || !T[state.leaf]) return '';
  const q = asText(T[state.leaf].q);
  if(PRIVATE_QUESTION[q]) return '';
  return q;
}

function draftLines(){
  const who = CHI_TEAM[assignedCoordinator()];
  const question = currentQuestion();
  const lines = ['Hello ' + who.greet + ',', '', 'I need help from my CHI team.'];
  if(ME){
    const name = asText(ME.name);
    const sid = asText(ME.sid);
    const employer = asText(ME.employer);
    const location = asText(ME.location);
    const start = asText(ME.dsStartF);
    const end = asText(ME.dsEndF);
    if(name) lines.push('My name is ' + name + '.');
    if(sid) lines.push('Student ID: ' + sid);
    if(employer) lines.push('Employer: ' + employer);
    if(location) lines.push('Location: ' + location);
    if(start && end) lines.push('Dates: ' + start + ' to ' + end);
    else if(start || end) lines.push('Dates: ' + (start || end));
  }
  if(question) lines.push('Question: ' + question);
  lines.push('', '[Describe what happened...]');
  const subjectBits = [];
  if(ME && asText(ME.season)) subjectBits.push(asText(ME.season));
  if(question) subjectBits.push(question);
  if(ME && asText(ME.sid)) subjectBits.push(asText(ME.sid));
  if(ME && asText(ME.name)) subjectBits.push(asText(ME.name));
  return {
    who: who,
    subject: subjectBits.length ? subjectBits.join(' / ') : 'Help',
    body: lines.join('\n')
  };
}

function chiMailUrl(){
  const draft = draftLines();
  return 'mailto:' + draft.who.email
    + '?subject=' + encodeURIComponent(draft.subject)
    + '&body=' + encodeURIComponent(draft.body);
}

function chiWhatsAppUrl(){
  const who = CHI_TEAM[assignedCoordinator()];
  let greeting = 'Hello, I need help from my CHI team.';
  if(ME){
    const bits = [];
    const name = asText(ME.name);
    const sid = asText(ME.sid);
    if(name) bits.push('I am ' + name);
    if(sid) bits.push('Student ID ' + sid);
    if(bits.length) greeting = 'Hello. ' + bits.join(', ') + '.';
  }
  let text = greeting;
  const question = currentQuestion();
  if(question) text += '\nI am looking at: ' + question;
  return who.whatsapp + '?text=' + encodeURIComponent(text);
}

function openMailDraft(url){
  const a = document.createElement('a');
  a.href = url;
  if(a.setAttribute) a.setAttribute('rel', 'noopener');
  if(document.body && document.body.appendChild) document.body.appendChild(a);
  if(a.click) a.click();
  if(a.remove) a.remove();
}

document.getElementById('msg').addEventListener('click', function(e){
  if(e && e.preventDefault) e.preventDefault();
  openMailDraft(chiMailUrl());
});
/* Office clock is America/New_York, including daylight saving. The WhatsApp
   button is Monday to Friday, 9:00:00 through 16:59:59, except OFFICE_HOLIDAYS. */
const OFFICE_HOLIDAY_DATES = {};
if(typeof OFFICE_HOLIDAYS !== 'undefined'){
  OFFICE_HOLIDAYS.forEach(item => {
    if(item && item.date) OFFICE_HOLIDAY_DATES[item.date] = 1;
  });
}
let officeNow = null;
function setOfficeNow(value){
  officeNow = value ? new Date(value) : null;
  refreshWhatsApp();
}
function officeClock(){
  return officeNow ? new Date(officeNow.getTime()) : new Date();
}
function whatsAppOpen(now){
  const date = now ? new Date(now) : officeClock();
  let parts;
  try{
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
  }catch(e){ return false; }
  const bag = {};
  parts.forEach(p => { bag[p.type] = p.value; });
  const y = Number(bag.year), mo = Number(bag.month), d = Number(bag.day);
  let hour = Number(bag.hour);
  if(hour === 24) hour = 0;
  const minute = Number(bag.minute), second = Number(bag.second);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const easternDate = String(y) + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  if(OFFICE_HOLIDAY_DATES[easternDate]) return false;
  if(weekday === 0 || weekday === 6) return false;
  const secs = hour * 3600 + minute * 60 + second;
  return secs >= 9 * 3600 && secs < 17 * 3600;
}
function whatsAppButtonLabel(){
  const who = CHI_TEAM[assignedCoordinator()] || CHI_TEAM.jenn;
  return 'WhatsApp ' + who.short;
}
function refreshWhatsApp(now){
  const open = whatsAppOpen(now);
  const btn = document.getElementById('whatsapp');
  const note = document.getElementById('whatsappnote');
  if(btn){
    const label = whatsAppButtonLabel();
    const span = btn.querySelector && btn.querySelector('span');
    if(span) span.textContent = label;
    else btn.textContent = label;
    if(btn.setAttribute) btn.setAttribute('aria-label', label);
    btn.hidden = !open;
    if(btn.style) btn.style.display = open ? '' : 'none';
  }
  if(note){
    note.hidden = open;
    if(note.style) note.style.display = open ? 'none' : '';
  }
}

document.getElementById('whatsapp').addEventListener('click', function(e){
  if(e && e.preventDefault) e.preventDefault();
  if(!whatsAppOpen()) return;
  if(window.open) window.open(chiWhatsAppUrl(), '_blank', 'noopener,noreferrer');
});
refreshWhatsApp();
if(typeof setInterval === 'function') setInterval(function(){ refreshWhatsApp(); }, 60000);
document.getElementById('portal').addEventListener('click', () => {
  const i = T.findIndex(t => t.q === 'I cannot get into my CHI portal');
  if(i < 0) return;
  state.q=''; sIn.value=''; sClear.hidden=true;
  state.stage = T[i].s; state.leaf = i;
  render(); window.scrollTo({top:0,behavior:'instant'});
});

const vp = document.getElementById('vp'), vw = document.getElementById('vw');
const pane = document.getElementById('participant'), wpane = document.getElementById('wiring'), bar = document.getElementById('bar');
function setView(w){
  vp.setAttribute('aria-pressed', String(!w)); vw.setAttribute('aria-pressed', String(w));
  pane.hidden = w; wpane.hidden = !w; bar.style.display = w ? 'none' : '';
  document.querySelector('.shell').style.paddingBottom = w ? '40px' : '132px';
  if(w && !wpane.dataset.done){ renderWiring(); wpane.dataset.done = '1'; }
  window.scrollTo({top:0,behavior:'instant'});
}
vp.addEventListener('click', ()=>setView(false));
vw.addEventListener('click', ()=>setView(true));

document.addEventListener('keydown', e => {
  if(e.key==='Enter' && ['idq','idq2','iddob','iddob2'].indexOf(e.target.id) >= 0) doLookup();
});

function openQuestion(q){
  const i = T.findIndex(t => t.q === q);
  if(i < 0) return false;
  state.q = '';
  state.leaf = i;
  state.stage = T[i].s;
  render();
  return true;
}

var BOOT = (async () => { await useLinkToken(); applyTileQuery(); renderId(); render(); })();
