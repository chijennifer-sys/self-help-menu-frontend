const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const NOMATCH = 'That does not match a record. Check your Student ID, it is your record number in the CHI portal, and check your date of birth.';
const THROTTLED = 'Too many tries. Wait a minute, then try again. If it still will not work, use the message button at the bottom of the page.';
const MISSING_DOB = 'Put in your date of birth as well. It is how the page knows it is you.';

function createEl(id) {
  const classes = new Set();
  const el = {
    id,
    hidden: false,
    innerHTML: '',
    value: '',
    textContent: '',
    disabled: false,
    style: {},
    dataset: {},
    attrs: {},
    listeners: {},
    classList: {
      toggle(c, on) { if (on) classes.add(c); else classes.delete(c); },
      contains(c) { return classes.has(c); },
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); }
    },
    addEventListener(type, fn) {
      (el.listeners[type] || (el.listeners[type] = [])).push(fn);
    },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return el.attrs[k]; },
    focus() {},
    closest() { return null; }
  };
  return el;
}

function jsonResponse(status, body, contentType) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => String(n).toLowerCase() === 'content-type' ? (contentType || 'application/json; charset=utf-8') : '' },
    text: async () => text
  };
}

function endpointValue(source) {
  const match = String(source).match(/^const ENDPOINT\s*=\s*(['"])(.*)\1\s*;/m);
  if (!match) throw new Error('ENDPOINT assignment not found');
  return match[2];
}

/* Swap the saved assignment in memory. Empty and a real /exec URL are both valid inputs. */
function injectEndpoint(configSource, endpoint) {
  const current = endpointValue(configSource);
  const wanted = endpoint ? String(endpoint) : '';
  const quoted = "'" + wanted.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const next = String(configSource).replace(
    /^const ENDPOINT\s*=\s*(['"])(.*)\1\s*;/m,
    'const ENDPOINT = ' + quoted + ';'
  );
  if (endpointValue(next) !== wanted) throw new Error('ENDPOINT fixture was not injected');
  if (current && current !== wanted && next.includes(current)) {
    throw new Error('saved ENDPOINT was left in the fixture');
  }
  return next;
}

async function loadPage({ endpoint, href, handler }) {
  const calls = [];
  const els = {};
  const make = id => els[id] || (els[id] = createEl(id));
  const memory = new Map();
  const history = { url: '', replaceState(_s, _t, next) { history.url = next; } };
  const windowObj = { location: { href }, scrollTo() {} };
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(String(url), init || {}, calls.length);
  };
  const config = injectEndpoint(
    fs.readFileSync(path.join(ROOT, 'assets', 'config.js'), 'utf8'),
    endpoint || ''
  );
  const source = [
    fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8'),
    config,
    fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8')
  ].join('\n');
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    fetch,
    setTimeout,
    clearTimeout,
    window: windowObj,
    history,
    localStorage: {
      getItem: k => memory.has(k) ? memory.get(k) : null,
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: k => memory.delete(k)
    },
    document: {
      body: null,
      getElementById: id => els[id] || null,
      addEventListener(type, fn) { make('document').addEventListener(type, fn); },
      querySelector: sel => sel === '.shell' ? make('shell') : null
    },
    navigator: { clipboard: { writeText: async () => {} } }
  };
  ['body', 'idq', 'iddob', 'iderr', 'idzone', 'view', 'searchwrap', 'sopen', 's', 'sclear', 'msg', 'portal', 'vp', 'vw', 'participant', 'wiring', 'bar', 'shell', 'document'].forEach(make);
  sandbox.document.body = els.body;
  vm.runInNewContext(source, sandbox, { filename: 'page.js' });
  await sandbox.BOOT;
  return { sandbox, calls, els, memory, history };
}

function stored(memory) {
  const raw = memory.get('chi_me');
  return raw ? JSON.parse(raw) : null;
}

function visible(els) {
  return [els.idzone, els.view, els.iderr].map(el => el && el.innerHTML || '').join('\n');
}

test('endpoint fixtures replace either an empty or a saved /exec URL', () => {
  const file = path.join(ROOT, 'assets', 'config.js');
  const savedBytes = fs.readFileSync(file);
  const saved = savedBytes.toString('utf8');
  const fixture = 'https://lookup.test/exec';
  const emptySource = "const ENDPOINT = '';\nconst DEMO = [];\n";
  const savedSource = "const ENDPOINT = 'https://script.google.com/macros/s/AKfycbSAVEDONLYnotARealDeployment00000/exec';\n";
  assert.match(injectEndpoint(emptySource, fixture), /const ENDPOINT = 'https:\/\/lookup\.test\/exec';/);
  assert.equal(injectEndpoint(emptySource, '').includes("const ENDPOINT = '';"), true);
  const clearedSaved = injectEndpoint(savedSource, '');
  assert.match(clearedSaved, /const ENDPOINT = '';/);
  assert.equal(clearedSaved.includes('AKfyc'), false);
  const swapped = injectEndpoint(savedSource, fixture);
  assert.match(swapped, /const ENDPOINT = 'https:\/\/lookup\.test\/exec';/);
  assert.equal(swapped.includes('AKfycbSAVEDONLY'), false);
  const fromFile = injectEndpoint(saved, '');
  assert.match(fromFile, /const ENDPOINT = '';/);
  const previous = endpointValue(saved);
  if (previous) assert.equal(fromFile.includes(previous), false);
  const live = injectEndpoint(saved, fixture);
  assert.equal(endpointValue(live), fixture);
  if (previous && previous !== fixture) assert.equal(live.includes(previous), false);
  assert.deepEqual(fs.readFileSync(file), savedBytes);
});

test('four country answers stay in the content file', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  const hits = src.match(/\{country\}/g) || [];
  assert.equal(hits.length, 4);
});

test('demo roster is unchanged when ENDPOINT is empty', async () => {
  let fetched = false;
  const page = await loadPage({
    endpoint: '',
    href: 'https://example.test/menu/',
    handler() { fetched = true; throw new Error('demo must not fetch'); }
  });
  assert.equal(fetched, false);
  assert.match(page.els.idzone.innerHTML, /Preview/);
  assert.match(page.els.idzone.innerHTML, /52341/);
  page.els.idq.value = '52341';
  page.els.iddob.value = '2004-03-11';
  await page.sandbox.doLookup();
  const me = stored(page.memory);
  assert.equal(me.name, 'Andrei Ionescu');
  assert.equal(me.employer, 'Aramark');
  assert.equal(me.country, 'Romania');
  assert.equal(me.email, 'demo1@example.com');
  assert.equal(me.emailMask, 'd••••@example.com');
  assert.equal(fetched, false);
  assert.match(page.els.idzone.innerHTML, /Andrei Ionescu/);
  assert.match(page.els.idzone.innerHTML, /Aramark/);
});

test('a live refusal uses the existing message and does not fall back to demo', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, {
        found: false,
        message: 'The Student ID was wrong but the date was right. REFUSAL_BODY'
      });
    }
  });
  page.els.idq.value = '52341';
  page.els.iddob.value = '2004-03-11';
  await page.sandbox.doLookup();
  assert.equal(page.calls.length, 1);
  const url = new URL(page.calls[0].url);
  assert.equal(url.searchParams.get('q'), '52341');
  assert.equal(url.searchParams.get('dob'), '2004-03-11');
  assert.equal(url.searchParams.get('t'), null);
  assert.equal(page.calls[0].init.method, 'GET');
  assert.equal(page.calls[0].init.credentials, 'omit');
  const html = visible(page.els);
  assert.match(page.els.iderr.innerHTML, new RegExp(NOMATCH.replace(/[.]/g, '\\.')));
  assert.equal(html.includes('REFUSAL_BODY'), false);
  assert.equal(html.includes('wrong but the date'), false);
  assert.equal(html.includes('Andrei'), false);
  assert.equal(html.includes('Aramark'), false);
  assert.equal(stored(page.memory), null);
});

test('missing date of birth does not call the network', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('missing dob must not fetch'); }
  });
  page.els.idq.value = '52341';
  page.els.iddob.value = '';
  await page.sandbox.doLookup();
  assert.equal(page.calls.length, 0);
  assert.match(page.els.iderr.innerHTML, new RegExp(MISSING_DOB.replace(/[.]/g, '\\.')));
  assert.equal(stored(page.memory), null);
});

test('HTML, malformed, network, and access errors render no response body', async () => {
  const cases = [
    {
      name: 'html',
      marker: 'HTML_BODY_SHOULD_NOT_RENDER',
      handler: () => jsonResponse(200, '<html><body>HTML_BODY_SHOULD_NOT_RENDER</body></html>', 'text/html; charset=utf-8')
    },
    {
      name: 'malformed',
      marker: 'MALFORMED_BODY_SHOULD_NOT_RENDER',
      handler: () => jsonResponse(200, 'MALFORMED_BODY_SHOULD_NOT_RENDER not-json', 'text/plain')
    },
    {
      name: 'network',
      marker: 'NETWORK_BODY_SHOULD_NOT_RENDER',
      handler() { throw new Error('NETWORK_BODY_SHOULD_NOT_RENDER'); }
    },
    {
      name: 'access',
      marker: 'ACCESS_BODY_SHOULD_NOT_RENDER',
      handler: () => jsonResponse(403, 'ACCESS_BODY_SHOULD_NOT_RENDER', 'text/plain')
    }
  ];
  for (const item of cases) {
    const page = await loadPage({
      endpoint: 'https://lookup.test/exec',
      href: 'https://example.test/menu/',
      handler: item.handler
    });
    page.els.idq.value = '10001';
    page.els.iddob.value = '2001-02-03';
    page.els.iderr.innerHTML = '<div class="iderr">previous</div>';
    await page.sandbox.doLookup();
    const html = visible(page.els);
    assert.equal(html.includes(item.marker), false, item.name);
    assert.equal(html.includes('previous'), false, item.name);
    assert.equal(stored(page.memory), null, item.name);
  }
});

test('a throttle response uses the existing wait message and hides the body', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler(_url, _init, n) {
      if (n === 1) {
        return jsonResponse(200, {
          found: false,
          throttled: true,
          message: 'THROTTLE_BODY_SHOULD_NOT_RENDER'
        });
      }
      return jsonResponse(429, 'THROTTLE_BODY_SHOULD_NOT_RENDER', 'text/plain');
    }
  });
  page.els.idq.value = '10001';
  page.els.iddob.value = '2001-02-03';
  await page.sandbox.doLookup();
  assert.match(page.els.iderr.innerHTML, /Too many tries/);
  assert.equal(visible(page.els).includes('THROTTLE_BODY_SHOULD_NOT_RENDER'), false);
  assert.equal(visible(page.els).includes(THROTTLED), true);
  page.els.idq.value = '10002';
  await page.sandbox.doLookup();
  assert.equal(page.calls.length, 1, 'client cooldown stops a second request');

  const limited = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler: () => jsonResponse(429, 'THROTTLE_BODY_SHOULD_NOT_RENDER', 'text/plain')
  });
  limited.els.idq.value = '10003';
  limited.els.iddob.value = '2001-02-03';
  await limited.sandbox.doLookup();
  assert.equal(visible(limited.els).includes('THROTTLE_BODY_SHOULD_NOT_RENDER'), false);
  assert.match(limited.els.iderr.innerHTML, /Too many tries/);
});

test('name and date of birth chooser exposes only name, agency, and season', async () => {
  const answers = [];
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler(url) {
      const q = new URL(url).searchParams;
      answers.push({ q: q.get('q'), dob: q.get('dob') });
      if (answers.length === 1) {
        return jsonResponse(200, {
          found: true,
          matches: [
            {
              sid: '90001',
              first: 'Ivan',
              last: 'Petrov',
              name: 'WRONG NAME',
              agency: 'EXPB',
              season: 'Summer 2026',
              country: 'SHOULD_NOT_SHOW_COUNTRY',
              employer: 'Chooser Employer Hidden',
              email: 'chooser-secret@example.com',
              emailMask: 'c••••@example.com',
              location: 'Chooser Location Hidden'
            },
            {
              sid: '90002',
              first: 'Ivan',
              last: 'Petrov',
              agency: 'AIM',
              season: 'Winter 2026-27',
              employer: 'Other Chooser Employer',
              email: 'other-secret@example.com'
            }
          ]
        });
      }
      return jsonResponse(200, {
        found: true,
        sid: '90001',
        first: 'Ivan',
        last: 'Petrov',
        name: 'WRONG NAME',
        agency: 'EXPB',
        season: 'Summer 2026',
        country: '',
        employer: 'Full Record Pier',
        email: 'raw-secret-box@example.com',
        emailMask: 'i••••@example.com',
        location: 'Atlantic City, NJ',
        job: 'Server',
        dsStart: '2026-06-01',
        dsEnd: '2026-09-01',
        arrival: '2026-05-20',
        hasSSN: 'No',
        dob: '2002-11-18'
      });
    }
  });
  page.els.idq.value = 'Ivan Petrov';
  page.els.iddob.value = '2002-11-18';
  await page.sandbox.doLookup();
  const html = page.els.idzone.innerHTML;
  assert.match(html, /Ivan Petrov/);
  assert.match(html, /Experience Work and Travel Doo/);
  assert.match(html, /Summer 2026/);
  assert.match(html, /Winter 2026-27/);
  ['Chooser Employer Hidden', 'Other Chooser Employer', 'chooser-secret@example.com',
    'other-secret@example.com', 'c••••@example.com', 'SHOULD_NOT_SHOW_COUNTRY',
    'Chooser Location Hidden', '90001', '90002', 'WRONG NAME'].forEach(secret => {
    assert.equal(html.includes(secret), false, secret);
  });
  assert.equal(stored(page.memory), null);
  await page.sandbox.chooseListed(0);
  assert.equal(answers[0].q, 'Ivan Petrov');
  assert.equal(answers[0].dob, '2002-11-18');
  assert.equal(answers[1].q, '90001');
  assert.equal(answers[1].dob, '2002-11-18');
  const me = stored(page.memory);
  assert.equal(me.name, 'Ivan Petrov');
  assert.equal(me.employer, 'Full Record Pier');
  assert.equal(me.emailMask, 'i••••@example.com');
  assert.equal(Object.hasOwn(me, 'email'), false);
  assert.equal(JSON.stringify(me).includes('raw-secret-box@example.com'), false);
  assert.equal(JSON.stringify(me).includes('chooser-secret@example.com'), false);
  assert.equal(JSON.stringify(me).includes('Chooser Employer Hidden'), false);
  assert.equal(me.country, undefined);
  assert.equal(page.sandbox.fill('You are in {country}.'), 'You are in {country}.');
});

test('a live record keeps emailMask and a non-empty country, and never stores a raw email', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, {
        found: true,
        sid: '10001',
        first: 'Ada',
        last: 'Lovelace',
        name: 'WRONG NAME',
        country: 'Romania',
        agency: 'STA',
        employer: 'Pier',
        email: 'raw-secret-box@example.com',
        emailMask: 'a••••@example.com',
        season: 'Summer 2026',
        dsStart: '2026-06-10',
        dsEnd: '2026-09-20',
        arrival: '2026-06-08',
        hasSSN: 'No',
        dob: '2001-01-04',
        location: 'Atlantic City, NJ',
        job: 'Ride Operator'
      });
    }
  });
  page.els.idq.value = '10001';
  page.els.iddob.value = '2001-01-04';
  await page.sandbox.doLookup();
  const me = stored(page.memory);
  assert.equal(me.name, 'Ada Lovelace');
  assert.equal(me.country, 'Romania');
  assert.equal(me.emailMask, 'a••••@example.com');
  assert.equal(Object.hasOwn(me, 'email'), false);
  assert.equal(JSON.stringify(me).includes('raw-secret-box@example.com'), false);
  assert.equal(page.sandbox.fill('in {country}'), 'in Romania');
  assert.match(page.els.idzone.innerHTML, /Ada Lovelace/);
  assert.equal(page.els.idzone.innerHTML.includes('Preview'), false);
});

test('the page ?p= token is requested as backend ?t=', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/?p=link-token-1&keep=1',
    handler() {
      return jsonResponse(200, {
        found: true,
        sid: '10001',
        first: 'Ada',
        last: 'Lovelace',
        agency: 'STA',
        employer: 'Pier',
        emailMask: 'a••••@example.com',
        email: 'raw-secret-box@example.com',
        country: 'Thailand',
        dsStart: '2026-06-10',
        dsEnd: '2026-09-20',
        arrival: '2026-06-08',
        dob: '2001-01-04',
        season: 'Summer 2026'
      });
    }
  });
  assert.equal(page.calls.length, 1);
  const url = new URL(page.calls[0].url);
  assert.equal(url.searchParams.get('t'), 'link-token-1');
  assert.equal(url.searchParams.get('p'), null);
  assert.equal(url.searchParams.get('q'), null);
  const stripped = new URL(page.history.url, 'https://example.test');
  assert.equal(stripped.searchParams.get('p'), null);
  assert.equal(stripped.searchParams.get('keep'), '1');
  assert.equal(page.history.url.includes('link-token-1'), false);
  const me = stored(page.memory);
  assert.equal(me.name, 'Ada Lovelace');
  assert.equal(me.country, 'Thailand');
  assert.equal(Object.hasOwn(me, 'email'), false);
});

function person(extra) {
  return Object.assign({
    found: true,
    sid: '10001',
    first: 'Ada',
    last: 'Lovelace',
    email: 'raw-secret-box@example.com',
    emailMask: 'a••••@example.com',
    dob: '2001-01-04',
    season: 'Summer 2026',
    hasSSN: 'No'
  }, extra);
}

async function identifyAs(page, record) {
  page.els.idq.value = record.sid;
  page.els.iddob.value = record.dob;
  await page.sandbox.doLookup();
}

function clickAct(page, kind) {
  const button = {
    dataset: { act: kind },
    textContent: 'Message my agency',
    disabled: false,
    style: {},
    closest(sel) { return sel === '[data-act]' ? button : null; }
  };
  const listeners = (page.els.document.listeners && page.els.document.listeners.click) || [];
  listeners.forEach(fn => fn({ target: { closest(sel) { return button.closest(sel); } } }));
  return button;
}

test('My visa appointment uses Birth Country, the agency name, and the start date', async () => {
  const configFile = path.join(ROOT, 'assets', 'config.js');
  const configBefore = fs.readFileSync(configFile);
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  const tile = src.slice(src.indexOf("q:'My visa appointment'"), src.indexOf("q:'Where is my DS-2019'"));
  assert.match(tile, /r:'Answer'/);
  assert.match(tile, /fires:'Nothing sends'/);
  assert.match(tile, /captures:'Nothing'/);
  assert.match(tile, /notify:'Nobody'/);
  assert.match(tile, /log:'Page view only'/);
  assert.equal((src.match(/\n\{s:'/g) || []).length, 67);

  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, person({
        agency: 'AEX',
        birthCountry: 'Romania',
        employer: 'Aramark',
        location: 'Ocean City, NJ',
        dsStart: '2026-06-01',
        dsEnd: '2026-09-15',
        arrival: '2026-05-28'
      }));
    }
  });
  await identifyAs(page, person({}));
  assert.equal(page.sandbox.openQuestion('My visa appointment'), true);
  const html = page.els.view.innerHTML;
  const me = stored(page.memory);
  assert.match(html, /You are coming through <b>American Experience<\/b> in <b>Romania<\/b>\. They book your appointment, not CHI\./);
  assert.match(html, new RegExp('start date, <b>' + me.dsStartF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</b>'));
  assert.equal(html.includes('AEX'), false);
  assert.equal(html.includes('raw-secret-box@example.com'), false);
  assert.equal(html.includes('2001-01-04'), false);
  assert.equal(html.includes('{country}'), false);
  assert.equal(html.includes('{agencyName}'), false);
  assert.equal(me.birthCountry, 'Romania');
  assert.equal(me.country, undefined);
  assert.equal(Object.hasOwn(me, 'email'), false);
  const callsAfterOpen = page.calls.length;
  const button = clickAct(page, 'chi');
  assert.equal(page.calls.length, callsAfterOpen);
  assert.equal(button.textContent, 'Use Message my CHI team at the bottom of the page');
  assert.equal(/agency|mailto|@/i.test(button.textContent), false);

  const byOffice = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, person({
        agencyOfficeCode: 'EXPB',
        'Birth Country': 'Bosnia and Herzegovina',
        dsStart: '2026-05-20',
        dsEnd: '2026-09-01'
      }));
    }
  });
  await identifyAs(byOffice, person({}));
  byOffice.sandbox.openQuestion('My visa appointment');
  const officeHtml = byOffice.els.view.innerHTML;
  assert.match(officeHtml, /Experience Work and Travel Doo/);
  assert.match(officeHtml, /Bosnia and Herzegovina/);
  assert.equal(officeHtml.includes('EXPB'), false);
  assert.deepEqual(fs.readFileSync(configFile), configBefore);
});

test('My visa appointment omits a missing country, agency name, or start date', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, person({ agency: 'ZZZZ', employer: 'Hidden Employer' }));
    }
  });
  await identifyAs(page, person({}));
  page.sandbox.openQuestion('My visa appointment');
  const html = page.els.view.innerHTML;
  assert.match(html, /Your agency at home books your embassy appointment\. CHI does not book it\./);
  assert.match(html, /Is your appointment after your start date\? CHI can write a letter to move your dates\./);
  assert.equal(/ask your agency|tell your agency|message my agency/i.test(html), false);
  assert.equal(html.includes('{'), false);
  assert.equal(html.includes('ZZZZ'), false);
  assert.equal(html.includes('Hidden Employer'), false);
  assert.equal(html.includes('Your programme'), false);

  const countryOnly = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, person({ birthCountry: 'Romania' }));
    }
  });
  await identifyAs(countryOnly, person({}));
  countryOnly.sandbox.openQuestion('My visa appointment');
  const countryHtml = countryOnly.els.view.innerHTML;
  assert.match(countryHtml, /your agency in <b>Romania<\/b>/);
  assert.equal(countryHtml.includes('{agencyName}'), false);
  countryOnly.sandbox.openQuestion('Where is my DS-2019');
  const other = countryOnly.els.view.innerHTML;
  assert.equal(other.includes('Romania'), false);
  assert.equal(other.includes('{country}'), false);
});

test('participant-facing copy does not tell anyone to contact an agency', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8') + '\nglobalThis.__T=T; globalThis.__R=ROUTE_D;';
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  const banned = /ask your agency|ask them for the tracking|tell your agency|message my agency|message your agency|contact your agency|your agency contact|apply through them|apply through the same agency|ask your agency at home|mailto:/i;
  const hits = [];
  for (const t of sandbox.__T) {
    const bits = [];
    if (t.you) bits.push(t.you);
    if (t.lead) bits.push(t.lead);
    (t.body || []).forEach(p => bits.push(p));
    (t.need || []).forEach(p => bits.push(p));
    if (t.act) {
      bits.push(t.act.label);
      if (t.act.kind === 'agency') hits.push(t.q + ' still has an agency action');
    }
    if (t.clock) bits.push(t.clock.l + ' ' + t.clock.t);
    if (t.sample) (t.sample.lines || []).forEach(l => bits.push(l));
    bits.forEach(s => { if (banned.test(String(s))) hits.push(t.q + ': ' + s); });
  }
  assert.deepEqual(hits, []);
  assert.equal(banned.test(sandbox.__R.Agency), false);
  assert.equal(/question for the agency/i.test(sandbox.__R.Agency), false);
  const app = fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8');
  assert.equal(app.includes('Their contact details are on your job offer'), false);
  assert.equal(app.includes('Your agency contact is on your job offer'), false);
});

test('My visa appointment stays behind the ID and date of birth gate and does not send', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('the locked tile must not look anyone up'); }
  });
  assert.equal(page.els.bar.hidden, false);
  assert.ok(page.els.msg);
  assert.equal(page.sandbox.openQuestion('My visa appointment'), true);
  const locked = page.els.view.innerHTML;
  assert.match(locked, /This answer is different for every person/);
  assert.match(locked, /Student ID and your date of birth/);
  assert.equal(locked.includes('CHI pays your SEVIS fee'), false);
  assert.equal(locked.includes('American Experience'), false);
  assert.equal(page.calls.length, 0);
  assert.equal(page.els.bar.hidden, false);
});
