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
const LINK_TOKEN = (() => {
  try{
    const u = new URL(window.location.href);
    const t = u.searchParams.get('p');
    if(t){
      u.searchParams.delete('p');
      history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + u.hash);
    }
    return t || '';
  }catch(e){ return ''; }
})();

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

function enrich(p){
  const st = D(p.dsStart), en = D(p.dsEnd), ar = D(p.arrival);
  const day = st ? days(TODAY, st) : null;
  const len = (st && en) ? days(en, st) : null;
  const m = {...p};
  m.day = day; m.len = len;
  m.daysLeft = en ? days(en, TODAY) : null;
  m.ssnBy = en ? FMT(addDays(en, -45)) : '';
  m.sevisBy = st ? FMT(addDays(st, 30)) : '';
  m.graceEnd = en ? FMT(addDays(en, 30)) : '';
  m.proofCutoff = en ? FMT(addDays(en, -16)) : '';
  m.earlyOk = st ? FMT(addDays(st, -7)) : '';
  m.dsStartF = FMT(st); m.dsEndF = FMT(en); m.arrivalF = FMT(ar);
  m.insGap = (st && ar) ? days(st, ar) : null;
  m.poc = (POC[p.agency] || []).join(' and ');
  m.agencyCode = p.agency;
  m.agencyName = AGENCY_NAME[p.agency] || '';
  // Living in the USA is a board, not a moment, so nothing lands there by date.
  m.stage = (day === null) ? null : day < 0 ? 'home' : day <= 14 ? 'arr' : (m.daysLeft !== null && m.daysLeft <= 14) ? 'end' : (m.daysLeft !== null && m.daysLeft < 0) ? 'end' : 'work';
  m.emailMask = maskEmail(m.email);
  return m;
}

function setMe(p){
  ME = p ? enrich(p) : null;
  try{ ME ? localStorage.setItem('chi_me', JSON.stringify(ME)) : localStorage.removeItem('chi_me'); }catch(e){}
}

/* Replace these two with real fetches. Contract is in the wiring view.
   Every lookup needs the Student ID or the name AND the date of birth.
   Nothing comes back on the ID alone, which is what stops the roster
   being walked by anybody who has the link. */
async function lookupToken(tok){
  const hit = DEMO.find(x => x.tok === String(tok).trim());
  return hit ? enrich(hit) : null;
}

async function lookup(sid, dob){
  const hit = DEMO.find(x => x.sid === String(sid).trim() && x.dob === dob);
  return hit ? enrich(hit) : null;
}

async function lookupName(full, dob){
  const parts = String(full).trim().toLowerCase().split(/\s+/).filter(Boolean);
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
  hits = hits.filter(x => x.dob === dob);
  if(hits.length > 8) return 'too-many';
  return hits.map(enrich);
}

function fill(str){
  if(!ME || !str) return str;
  return str.replace(/\{(\w+)\}/g, (m,k) => (ME[k] !== undefined && ME[k] !== null && ME[k] !== '') ? ME[k] : m);
}

let state = {stage:null, leaf:null, q:''};
const view = document.getElementById('view');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const chev = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
const back = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

function render(){
  if(ME && ME.stage && !state.q && state.leaf === null && !state.stage) state.stage = ME.stage;
  if(state.q){ return renderSearch(); }
  if(state.leaf !== null){ return renderLeaf(); }
  if(state.stage){ return renderStage(); }
  return renderHome();
}

function renderHome(){
  view.innerHTML = `
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
    <span class="rt">${t.r === 'Answer' ? 'Answer here' : t.r === 'File' ? 'Short form' : t.r === 'Team' ? 'A person replies' : 'Your agency'}</span>
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
    url += `?sid=${encodeURIComponent(ME.sid)}&first=${encodeURIComponent(ME.first)}&last=${encodeURIComponent(ME.last)}&employer=${encodeURIComponent(ME.employer)}`;
  }
  view.innerHTML = `
    <div class="crumb"><button data-go="${state.q?'search':'stage'}" data-stage="${t.s}">${back} ${esc(state.q?'Results':s.t)}</button></div>
    <article class="leaf">
      <div class="leaf-h">
        <h2>${esc(t.q)}</h2>
        <div class="leaf-meta"><span class="pill ${t.r}">${t.r}</span><span style="font-size:12.5px;color:var(--ink-3)">${esc(ROUTE_D[t.r])}</span></div>
      </div>
      <div class="leaf-b">
        <p class="lead">${esc(fill(t.lead))}</p>
        ${t.you && ME && !/\{\w+\}/.test(fill(t.you)) ? `<div class="you"><span class="yl">Your programme</span>${fill(t.you)}</div>` : ''}
        ${t.body.map(p=>`<p>${esc(fill(p))}</p>`).join('')}
        ${t.clock ? `<div class="note clock"><span class="clock-l">${esc(t.clock.l)}</span>${esc(fill(t.clock.t))}</div>` : ''}
        ${t.hz ? `<div class="note" style="background:var(--ground);border-left-color:var(--s${STAGES.find(x=>x.key===t.s).n})">Housing has tiles at every point in your programme. Search the word housing and they all come up.</div>` : ''}
        ${t.sample ? `<div class="sample">
          <div class="sample-h"><span class="sample-l">${esc(t.sample.title)}</span><button class="copy" data-copy="${T.indexOf(t)}">Copy</button></div>
          <div class="sample-t">${t.sample.lines.map(l=>esc(fill(l))||'&nbsp;').join('<br>')}</div>
        </div>` : ''}
        ${t.need && t.need.length ? `<div class="need"><h4>What your CHI team needs from you</h4><ul>${t.need.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
        ${url ? `<a class="act" href="${url}" target="_blank" rel="noopener">${esc(t.act.label)}</a>`
              : `<button class="act${t.act.kind==='answer'?' ghost':''}" data-act="${t.act.kind}">${esc(t.act.label)}</button>`}
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
          <dt>Computes</dt><dd>Day in programme, days left, SEVIS validation deadline at start plus 30, SSN deadline at end minus 45, grace period end at end plus 30, and the gap between landing and the insurance start date.</dd>
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

async function doLookup(){
  const el  = document.getElementById('idq2') || document.getElementById('idq');
  const dl  = document.getElementById('iddob2') || document.getElementById('iddob');
  const v   = el ? el.value.trim() : '';
  const dob = dl ? dl.value.trim() : '';
  const err = document.getElementById('iderr');
  const say = m => { if(err) err.innerHTML = `<div class="iderr">${m}</div>`; };
  const nomatch = 'That does not match a record. Check your Student ID, it is your record number in the CHI portal, and check your date of birth.';

  const left = Math.ceil((coolUntil - Date.now())/1000);
  if(left > 0){ say(`Too many tries. Wait ${left} seconds, then try again.`); return; }
  if(!v && !dob){ say('Put in your Student ID and your date of birth.'); return; }
  if(!v){ say('Put in your Student ID or your name as well.'); return; }
  if(!dob){ say('Put in your date of birth as well. It is how the page knows it is you.'); return; }
  if(err) err.innerHTML = '';

  const miss = () => {
    tries++;
    if(tries >= 5){ coolUntil = Date.now() + 60000; tries = 0; say('Too many tries. Wait a minute, then try again. If it still will not work, use the message button at the bottom of the page.'); return; }
    say(nomatch);
  };

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
  picks = res; idMode = 'pick'; renderId();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
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
    if(k==='pick'){ setMe(picks[+idb.dataset.i]); idMode='id'; picks=[]; renderId(); render(); window.scrollTo({top:0,behavior:'instant'}); return; }
    if(k==='clear'){ setMe(null); idMode='id'; state.stage=null; state.leaf=null; renderId(); render(); return; }
    if(k==='noop'){ return; }
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
    ac.textContent = k==='agency' ? (ME && ME.agencyName ? ME.agencyName + ' is your agency. Their contact details are on your job offer.' : 'Your agency contact is on your job offer')
      : k==='answer' ? 'Go back and choose another topic'
      : k==='template' ? 'Sent. Check your email, including spam'
      : 'Your CHI team has this. You will hear back within one working day';
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

document.getElementById('msg').addEventListener('click', function(){
  this.innerHTML = '<span>Your CHI team has this, you will hear back within one working day</span>';
});
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

(async () => { await useLinkToken(); renderId(); render(); })();
