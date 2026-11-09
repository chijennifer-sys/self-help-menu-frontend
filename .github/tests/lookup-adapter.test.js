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
  const opened = [];
  const mails = [];
  const copied = [];
  const windowObj = {
    location: { href },
    scrollTo() {},
    open(url){ opened.push(String(url)); return { closed: false }; }
  };
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
    fs.readFileSync(path.join(ROOT, 'assets', 'plain.js'), 'utf8'),
    config,
    fs.readFileSync(path.join(ROOT, 'assets', 'office-holidays.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'assets', 'orientation.js'), 'utf8'),
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
      querySelector: sel => sel === '.shell' ? make('shell') : null,
      createElement(tag) {
        const el = createEl(tag);
        el.click = () => {
          if (String(el.href || '').indexOf('mailto:') === 0) mails.push(String(el.href));
        };
        el.remove = () => {};
        return el;
      }
    },
    navigator: { clipboard: { writeText: async (text) => { copied.push(String(text)); } } }
  };
  ['body', 'idq', 'iddob', 'iderr', 'idzone', 'view', 'searchwrap', 'sopen', 's', 'sclear', 'msg', 'whatsapp', 'whatsappnote', 'portal', 'vp', 'vw', 'participant', 'wiring', 'bar', 'shell', 'document'].forEach(make);
  sandbox.document.body = els.body;
  els.body.appendChild = () => {};
  vm.runInNewContext(source, sandbox, { filename: 'page.js' });
  await sandbox.BOOT;
  if(sandbox.setOfficeNow) sandbox.setOfficeNow('2026-01-06T15:00:00Z');
  return { sandbox, calls, els, memory, history, opened, mails, copied };
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

test('country personalization stays on the four programme tiles', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  ['My visa appointment', 'Where is my DS-2019', 'I lost my passport or another document', 'Can I come back next year'].forEach(q => {
    const i = src.indexOf("q:'" + q + "'");
    assert.ok(i > 0, q);
    assert.match(src.slice(i, i + 700), /\{country/);
  });
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
  const blankCountry = page.sandbox.fill('You are in {country}.');
  assert.equal(blankCountry.includes('{country}'), false);
  assert.equal(blankCountry.includes('undefined'), false);
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

function clickId(page, id) {
  const button = page.els[id];
  const listeners = (button.listeners && button.listeners.click) || [];
  listeners.forEach(fn => fn.call(button, { preventDefault() {} }));
}

function clickMsg(page) { clickId(page, 'msg'); }
function clickWhatsApp(page) { clickId(page, 'whatsapp'); }

function parseMailto(url) {
  assert.match(url, /^mailto:/);
  const q = url.indexOf('?');
  const to = decodeURIComponent(url.slice('mailto:'.length, q));
  const params = new URLSearchParams(url.slice(q + 1));
  return { to, subject: params.get('subject'), body: params.get('body') };
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
  assert.equal((src.match(/\n\{s:'/g) || []).length, 72);

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
  assert.match(html, /You are in <b>Romania<\/b>\. Message my CHI team about your visa\. That opens an email to your coordinator\./);
  assert.equal(/agency/i.test(html), false);
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
  assert.match(officeHtml, /Bosnia and Herzegovina/);
  assert.equal(/Experience Work and Travel|agency/i.test(officeHtml), false);
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
  assert.match(html, /CHI does not book the embassy appointment/);
  assert.equal(/agency/i.test(html), false);
  assert.match(html, /Is your appointment after your start date\? CHI can write a letter to move your dates\./);
  assert.equal(/ask your agency|tell your agency|message my agency/i.test(html), false);
  assert.equal(html.includes('{'), false);
  assert.equal(html.includes('ZZZZ'), false);
  assert.equal(html.includes('Hidden Employer'), false);
  assert.match(html, /email to your coordinator/);

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
  assert.match(countryHtml, /You are in <b>Romania<\/b>/);
  assert.equal(/agency/i.test(countryHtml), false);
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

function whatsAppText(url, base) {
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, base || 'https://wa.me/16099484483');
  assert.deepEqual([...u.searchParams.keys()], ['text']);
  return u.searchParams.get('text');
}

function assertNoSecrets(text) {
  assert.equal(text.includes('undefined'), false);
  assert.equal(text.includes('null'), false);
  assert.equal(text.includes('2001-01-04'), false);
  assert.equal(text.includes('raw-secret-box@example.com'), false);
  assert.equal(text.includes('secret-token-value'), false);
  assert.equal(/a••••@example\.com/.test(text), false);
}

test('Message my CHI team opens an email draft on click and not on view', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('the message bar must not look anyone up'); }
  });
  page.sandbox.openQuestion('My visa appointment');
  assert.equal(page.opened.length, 0);
  assert.equal(page.mails.length, 0);
  assert.equal(page.calls.length, 0);
  clickMsg(page);
  assert.equal(page.calls.length, 0);
  assert.equal(page.opened.length, 0);
  assert.equal(page.mails.length, 1);
  const mail = parseMailto(page.mails[0]);
  assert.equal(mail.to, 'chijennifer@chinet.org');
  assert.equal(mail.subject, 'My visa appointment');
  assert.match(mail.body, /^Hello Jennifer,\n\nI need help from my CHI team\.\nQuestion: My visa appointment\n\n\[Describe what happened\.\.\.\]$/);
  assertNoSecrets(mail.subject + '\n' + mail.body);
  clickWhatsApp(page);
  const anon = whatsAppText(page.opened[0]);
  assert.equal(anon, 'Hello, I need help from my CHI team.\nI am looking at: My visa appointment');
  assert.equal(page.calls.length, 0);

  const named = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() {
      return jsonResponse(200, person({
        first: 'Ada',
        last: 'Lovelace & Co',
        sid: '10001',
        season: 'Summer 2026',
        dob: '2001-01-04',
        email: 'raw-secret-box@example.com',
        emailMask: 'a••••@example.com',
        employer: 'Hidden Employer',
        location: 'Ocean City, NJ',
        country: 'Romania',
        tok: 'secret-token-value',
        dsStart: '2026-06-01',
        dsEnd: '2026-09-15'
      }));
    }
  });
  await identifyAs(named, person({ sid: '10001', dob: '2001-01-04' }));
  named.sandbox.openQuestion('I feel unsafe or I am being harassed');
  assert.equal(named.opened.length, 0);
  assert.equal(named.mails.length, 0);
  clickMsg(named);
  const hid = parseMailto(named.mails[0]);
  assert.equal(hid.to, 'chijennifer@chinet.org');
  assert.equal(hid.subject.includes('I feel unsafe'), false);
  assert.equal(hid.body.includes('I feel unsafe'), false);
  assert.match(hid.body, /\[Describe what happened\.\.\.\]/);
  assertNoSecrets(hid.subject + '\n' + hid.body);
  const callsBefore = named.calls.length;
  clickMsg(named);
  assert.equal(named.calls.length, callsBefore);
});

test('email and WhatsApp follow the same coordinator and do not guess', async () => {
  const team = {
    jenn: { email: 'chijennifer@chinet.org', whatsapp: 'https://wa.me/16099484483', greet: 'Jennifer', short: 'Jenn' },
    kathleen: { email: 'chikathleenr@chinet.org', whatsapp: 'https://wa.me/16093503606', greet: 'Kathleen', short: 'Kathleen' },
    victor: { email: 'chivictor@chinet.org', whatsapp: 'https://wa.me/16098922969', greet: 'Victor', short: 'Victor' },
    amy: { email: 'chiamyj@chinet.org', whatsapp: 'https://wa.me/17178805970', greet: 'Amy', short: 'Amy' },
    dasha: { email: 'chidashak@chinet.org', whatsapp: 'https://wa.me/16465121122', greet: 'Dasha', short: 'Dasha' }
  };
  async function route(extra) {
    const page = await loadPage({
      endpoint: 'https://lookup.test/exec',
      href: 'https://example.test/menu/',
      handler() {
        return jsonResponse(200, person(Object.assign({
          season: 'Summer 2026',
          employer: 'Aramark',
          location: 'Ocean City, NJ',
          dsStart: '2026-06-01',
          dsEnd: '2026-09-15',
          dob: '2001-01-04',
          email: 'raw-secret-box@example.com',
          emailMask: 'a••••@example.com',
          tok: 'secret-token-value'
        }, extra)));
      }
    });
    await identifyAs(page, person({ sid: '10001', dob: '2001-01-04' }));
    page.sandbox.openQuestion('My visa appointment');
    assert.equal(page.mails.length, 0);
    assert.equal(page.opened.length, 0);
    clickMsg(page);
    clickWhatsApp(page);
    return { page, mail: parseMailto(page.mails[0]), wa: page.opened[0], me: stored(page.memory) };
  }
  function expectWho(result, key) {
    const who = team[key];
    assert.equal(result.mail.to, who.email);
    assert.equal(result.mail.subject, 'Summer 2026 / My visa appointment / 10001 / Ada Lovelace');
    assert.match(result.mail.body, new RegExp('^Hello ' + who.greet + ','));
    assert.match(result.mail.body, /My name is Ada Lovelace\./);
    assert.match(result.mail.body, /Student ID: 10001/);
    assert.match(result.mail.body, /Employer: Aramark/);
    assert.match(result.mail.body, /Location: Ocean City, NJ/);
    assert.match(result.mail.body, /Question: My visa appointment/);
    assert.match(result.mail.body, /\[Describe what happened\.\.\.\]$/);
    assertNoSecrets(result.mail.subject + '\n' + result.mail.body);
    assert.equal(result.mail.body.includes('Romania'), false);
    whatsAppText(result.wa, who.whatsapp);
    assert.equal(result.page.els.whatsapp.textContent, 'WhatsApp ' + who.short);
    assert.equal(result.page.els.whatsapp.getAttribute('aria-label'), 'WhatsApp ' + who.short);
    assert.equal(JSON.stringify(result.me).includes(who.email), false);
    assert.equal(JSON.stringify(result.me).includes('wa.me'), false);
  }

  expectWho(await route({ coordinator: 'Kathleen' }), 'kathleen');
  expectWho(await route({ Coordinators: 'Victor Purilla' }), 'victor');
  expectWho(await route({ coordinator: 'Amy' }), 'amy');
  expectWho(await route({ Coordinators: 'Amy Jackson' }), 'amy');
  expectWho(await route({ coordinator: 'Dasha Komarova' }), 'dasha');
  expectWho(await route({ Coordinators: 'Jennifer Campbell' }), 'jenn');
  expectWho(await route({}), 'jenn');

  const messy = 'Kathleen and Victor';
  const ambiguous = await route({ Coordinators: messy, phone: '555' });
  expectWho(ambiguous, 'jenn');
  assert.equal(ambiguous.me.coordinator, undefined);
  assert.equal(JSON.stringify(ambiguous.me).includes(messy), false);
  assert.equal(JSON.stringify(ambiguous.me).includes('555'), false);

  const disagree = await route({ coordinator: 'Amy', Coordinators: 'Dasha' });
  expectWho(disagree, 'jenn');
  assert.equal(disagree.me.coordinator, undefined);

  const kathleen = await route({ coordinator: 'Kathleen Rizzo' });
  const pick = kathleen.page.sandbox.projectChooser({
    sid: '10001', first: 'Ada', last: 'Lovelace', agency: 'AEX', season: 'Summer 2026',
    coordinator: 'Kathleen', Coordinators: 'Kathleen Rizzo', employer: 'Secret Employer', email: 'secret@example.com'
  });
  assert.equal(pick.coordinator, undefined);
  assert.equal(pick.employer, undefined);
  assert.equal(pick.email, undefined);
  assert.equal(JSON.stringify(pick).includes('Kathleen'), false);

  const decide = kathleen.page.sandbox.coordinatorFromRecord;
  assert.equal(decide({ coordinator: 'Victor' }), 'victor');
  assert.equal(decide({ Coordinators: 'Jennifer Campbell' }), 'jenn');
  assert.equal(decide({ Coordinators: 'Jennifer' }), 'jenn');
  assert.equal(decide({ Coordinators: 'Vic' }), 'jenn');
  assert.equal(decide({ Coordinators: 'Kathleen, Jenn' }), 'jenn');
  assert.equal(decide({ coordinator: 'Amy Jackson extra' }), 'jenn');
  assert.equal(decide({ coordinator: 'Amy', Coordinators: 'Dasha' }), 'jenn');
  assert.equal(decide({}), 'jenn');
});

test('WhatsApp button follows Eastern office hours', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { return jsonResponse(200, person({ dob: '2001-01-04' })); }
  });
  const open = page.sandbox.whatsAppOpen;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(/urgent/i.test(html), false);
  const noteText = html.slice(html.indexOf('id="whatsappnote"'), html.indexOf('</div>', html.indexOf('id="whatsappnote"')));
  assert.match(noteText, /WhatsApp is available Monday to Friday, 9am to 5pm Eastern\./);
  assert.equal(noteText.includes('911'), false);
  assert.equal(page.els.whatsapp.textContent, 'WhatsApp Jenn');
  const content = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  assert.match(content, /Call 911/);
  assert.match(content, /988/);

  function show(iso){
    page.opened.length = 0;
    page.sandbox.refreshWhatsApp(iso);
    return { button: page.els.whatsapp.hidden, line: page.els.whatsappnote.hidden, mail: page.els.msg.hidden };
  }
  assert.deepEqual(show('2026-01-06T13:59:59Z'), { button: true, line: false, mail: false });
  assert.deepEqual(show('2026-01-06T14:00:00Z'), { button: false, line: true, mail: false });
  assert.deepEqual(show('2026-01-06T21:59:59Z'), { button: false, line: true, mail: false });
  assert.deepEqual(show('2026-01-06T22:00:00Z'), { button: true, line: false, mail: false });
  assert.equal(open('2026-07-07T12:59:59Z'), false);
  assert.equal(open('2026-07-07T13:00:00Z'), true);
  assert.equal(open('2026-07-07T20:59:59Z'), true);
  assert.equal(open('2026-07-07T21:00:00Z'), false);
  assert.equal(open('2026-01-10T15:00:00Z'), false);
  assert.equal(open('2026-01-11T18:00:00Z'), false);
  assert.equal(open('2026-01-06T14:00:00Z'), true);
  assert.equal(open('2026-01-06T22:00:00Z'), false);

  page.sandbox.setOfficeNow('2026-01-06T22:00:00Z');
  clickWhatsApp(page);
  assert.equal(page.opened.length, 0);
  clickMsg(page);
  assert.equal(parseMailto(page.mails[0]).to, 'chijennifer@chinet.org');
  page.sandbox.setOfficeNow('2026-01-06T15:00:00Z');
  clickWhatsApp(page);
  assert.equal(page.opened.length, 1);

  await identifyAs(page, person({ sid: '10001', dob: '2001-01-04' }));
  page.sandbox.setOfficeNow('2026-01-10T15:00:00Z');
  page.sandbox.openQuestion('I feel unsafe or I am being harassed');
  assert.match(page.els.view.innerHTML, /Call 911/);
  page.sandbox.openQuestion('I am struggling or homesick');
  assert.match(page.els.view.innerHTML, /988/);
  assert.equal(page.els.whatsapp.hidden, true);
  assert.equal(page.els.whatsappnote.hidden, false);
});

test('CHI office holidays hide WhatsApp for the Eastern date', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('a holiday must not look anyone up'); }
  });
  const open = page.sandbox.whatsAppOpen;
  const list = fs.readFileSync(path.join(ROOT, 'assets', 'office-holidays.js'), 'utf8');
  assert.match(list, /2026-11-11/);
  assert.match(list, /Veterans Day/);
  assert.match(list, /2027-11-01/);
  assert.match(list, /CHI Founders' Day/);
  function show(iso){
    page.sandbox.refreshWhatsApp(iso);
    return { button: page.els.whatsapp.hidden, line: page.els.whatsappnote.hidden, mail: page.els.msg.hidden };
  }
  assert.deepEqual(show('2026-11-10T15:00:00Z'), { button: false, line: true, mail: false });
  assert.deepEqual(show('2026-11-11T15:00:00Z'), { button: true, line: false, mail: false });
  assert.deepEqual(show('2026-11-12T15:00:00Z'), { button: false, line: true, mail: false });
  assert.equal(open('2026-11-11T15:00:00Z'), false);
  assert.equal(open('2026-11-10T15:00:00Z'), true);
  page.sandbox.setOfficeNow('2026-11-11T15:00:00Z');
  page.opened.length = 0;
  clickWhatsApp(page);
  assert.equal(page.opened.length, 0);
  clickMsg(page);
  assert.equal(parseMailto(page.mails[page.mails.length - 1]).to, 'chijennifer@chinet.org');
  const note = page.els.whatsappnote.textContent || '';
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /WhatsApp is available Monday to Friday, 9am to 5pm Eastern\./);
  assert.equal(note.includes('911'), false);
});

test('computed dates, missing fields, hasSSN, and search', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('rendering a fake record must not look anyone up'); }
  });
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
    agency: 'AEX', country: 'Romania', employer: 'Aramark', location: 'Ocean City, NJ',
    job: 'Server', season: 'Summer 2026', hasSSN: 'No',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', arrival: '2026-05-28'
  });
  const me = JSON.parse(page.sandbox.localStorage.getItem('chi_me'));
  const expectF = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  assert.equal(me.insStartF, expectF('2026-05-25'));
  assert.equal(me.sevisDueF, expectF('2026-05-31'));
  assert.equal(me.graceEnd, '');
  page.sandbox.setMe(Object.assign({}, me, { lastDayWorked: '2026-09-01' }));
  const worked = JSON.parse(page.sandbox.localStorage.getItem('chi_me'));
  assert.equal(worked.graceEnd, expectF('2026-10-01'));
  assert.equal(me.ssnBy, expectF('2026-08-01'));
  assert.equal(me.sevisBy, me.sevisDueF);
  page.sandbox.openQuestion('How do I apply for my Social Security Number');
  assert.match(page.els.view.innerHTML, /activation email/);
  assert.equal(page.els.view.innerHTML.includes('good for life'), false);
  page.sandbox.setMe(Object.assign({}, me, { hasSSN: 'Yes' }));
  page.sandbox.openQuestion('How do I apply for my Social Security Number');
  assert.match(page.els.view.innerHTML, /good for life/);

  page.sandbox.setMe({ sid: '10001', name: 'Ada', first: 'Ada', agency: 'ZZZZ', agencyName: 'ZZZZ' });
  const titles = [...fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8').matchAll(/\bq:'([^']+)'/g)].map(m => m[1]);
  assert.equal(titles.length, 72);
  titles.forEach(q => {
    page.sandbox.openQuestion(q);
    const html = page.els.view.innerHTML;
    assert.equal(html.includes('undefined'), false, q);
    assert.equal(/\{[a-zA-Z]+/.test(html), false, q);
    assert.equal(html.includes('ZZZZ'), false, q);
  });
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace', firstName: 'Ada',
    agency: 'AEX', agencyName: 'American Experience', country: 'Romania',
    employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server', season: 'Summer 2026',
    hasSSN: 'Yes', coordinator: 'kathleen', dsNumber: 'N123', housingStatus: 'Approved',
    housingAddress: '1 Boardwalk', sevisStatus: 'Validated', visaStatus: 'Approved',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', arrival: '2026-05-28',
    emailMask: 'a••••@example.com'
  });
  titles.forEach(q => {
    page.sandbox.openQuestion(q);
    assert.equal(page.els.view.innerHTML.includes('undefined'), false, q);
    assert.equal(/\{[a-zA-Z]+/.test(page.els.view.innerHTML), false, q);
  });
  page.els.s.value = 'social security';
  page.els.s.listeners.input.forEach(fn => fn());
  assert.match(page.els.view.innerHTML, /Social Security/i);
  page.els.s.value = 'teladoc';
  page.els.s.listeners.input.forEach(fn => fn());
  assert.match(page.els.view.innerHTML, /Teladoc|doctor|sick/i);
  page.els.s.value = 'workers comp';
  page.els.s.listeners.input.forEach(fn => fn());
  assert.match(page.els.view.innerHTML, /second job|accident|employer/i);
  assert.equal(titles.length, 72);
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

test('training deck facts stay on the existing tiles', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  const phones = [...src.matchAll(/1-800-432-4643/g)];
  assert.ok(phones.length >= 4);
  phones.forEach(hit => {
    const window = src.slice(hit.index, hit.index + 70);
    assert.match(window, /^1-800-432-4643, ext\. 0/);
    assert.match(window, /24\/7/);
  });
  assert.equal((src.match(/\n\{s:'/g) || []).length, 72);

  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('a training-deck check must not look anyone up'); }
  });
  function search(word){
    page.els.s.value = word;
    page.els.s.listeners.input.forEach(fn => fn());
    assert.equal(page.els.view.innerHTML.includes('Nothing matches'), false, word);
    return page.els.view.innerHTML;
  }
  assert.match(search('revolut'), /US bank account/i);
  assert.match(search('paypal'), /US bank account/i);
  assert.match(search('1040'), /tax/i);
  assert.match(search('marijuana'), /What should I bring/);
  assert.match(search('frostbite'), /What should I bring/);

  const expectF = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  page.sandbox.setMe({ season: 'Summer 2026', employer: 'Aramark', location: 'Ocean City, NJ', dsStart: '2026-06-01', dsEnd: '2026-09-15' });
  page.sandbox.openQuestion('What should I bring');
  assert.match(page.els.view.innerHTML, /1,500 dollars/);
  assert.match(page.els.view.innerHTML, /2 to 3 weeks/);
  assert.match(page.els.view.innerHTML, /21/);
  assert.match(page.els.view.innerHTML, /cigarettes, vapes, or alcohol/);
  assert.match(page.els.view.innerHTML, /Marijuana is illegal under federal law/);
  assert.equal(page.els.view.innerHTML.includes('frostbite'), false);

  page.sandbox.setMe({ season: 'Winter 2027', location: 'Stowe, VT', dsStart: '2026-12-01', dsEnd: '2027-03-15' });
  page.sandbox.openQuestion('What should I bring');
  assert.match(page.els.view.innerHTML, /frostbite/);
  assert.match(page.els.view.innerHTML, /dress in layers/);
  assert.match(page.els.view.innerHTML, /short days in small towns/);
  page.sandbox.openQuestion('How early can I arrive');
  assert.match(page.els.view.innerHTML, /3 to 5 days before/);
  assert.match(page.els.view.innerHTML, new RegExp(expectF('2026-12-01').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  page.sandbox.setMe({ employer: 'Aramark', season: 'Summer 2026' });
  page.sandbox.openQuestion('How early can I arrive');
  assert.match(page.els.view.innerHTML, /3 to 5 days before/);
  assert.equal(page.els.view.innerHTML.includes('undefined'), false);
  assert.equal(/\{[a-zA-Z]+/.test(page.els.view.innerHTML), false);
  page.sandbox.openQuestion('Where do I verify my housing');
  assert.match(page.els.view.innerHTML, /at least 4 weeks before you arrive/);
  assert.match(page.els.view.innerHTML, /cannot activate SEVIS/);
  page.sandbox.openQuestion('How do I get a second job approved');
  assert.match(page.els.view.innerHTML, /written CHI approval before your first shift/);
  assert.match(page.els.view.innerHTML, /verbal OK from an employer is not approval/);
  assert.match(page.els.view.innerHTML, /Additional Employment form/);
  page.sandbox.openQuestion('Can I change to a different employer');
  assert.match(page.els.view.innerHTML, /30 days/);
  assert.match(page.els.view.innerHTML, /CHI must approve/);
  assert.match(page.els.view.innerHTML, /Do not walk out of your job/);
  page.sandbox.openQuestion('How do I open a US bank account');
  assert.match(page.els.view.innerHTML, /Revolut and PayPal do not work for U\.S\. payroll/);
  assert.match(page.els.view.innerHTML, /Use a U\.S\. bank account/);
  page.sandbox.openQuestion('What tax comes out of my pay');
  assert.match(page.els.view.innerHTML, /W-2 arrives by January 31/);
  assert.match(page.els.view.innerHTML, /February 1 and April 15/);
  assert.match(page.els.view.innerHTML, /Form 1040-NR/);
  page.sandbox.openQuestion('When do I have to leave the United States');
  assert.match(page.els.view.innerHTML, /up to 30 days/);
  assert.match(page.els.view.innerHTML, /cannot work/);
  assert.match(page.els.view.innerHTML, /Consider travel insurance/);
  assert.equal(page.els.view.innerHTML.includes('undefined'), false);
  page.sandbox.setMe({ dsStart: '2026-06-01', dsEnd: '2026-09-15', season: 'Summer 2026' });
  page.sandbox.openQuestion('When do I have to leave the United States');
  assert.match(page.els.view.innerHTML, new RegExp(expectF('2026-09-15').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(page.els.view.innerHTML, /Consider travel insurance/);

  ['What documents do I need', 'I was in an accident', 'I feel unsafe or I am being harassed', 'I lost my passport or another document'].forEach(q => {
    page.sandbox.openQuestion(q);
    assert.match(page.els.view.innerHTML, /1-800-432-4643, ext\. 0/, q);
    assert.match(page.els.view.innerHTML, /24\/7/, q);
  });
});

test('email guidance stays on the existing tiles', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  assert.equal((src.match(/\n\{s:'/g) || []).length, 72);
  assert.equal((src.match(/MyProfile/g) || []).length, 2);
  assert.match(src, /https:\/\/wt\.chinet\.org\/Students\/MyProfile/);
  assert.equal(src.includes('docs.google.com'), false);
  assert.equal(/ask your agency|contact your agency|message your agency/i.test(src), false);
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('guidance checks must not look anyone up'); }
  });
  const expectF = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', country: 'Peru', season: 'Summer 2026',
    employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', arrival: '2026-05-28',
    hasSSN: 'No', ssaOfficeName: 'Plattsburgh SSA', ssaZip: '12901'
  });
  page.sandbox.openQuestion('Where do I verify my housing');
  assert.match(page.els.view.innerHTML, /at least 4 weeks before you arrive/);
  assert.equal(/30 days before arrival/i.test(page.els.view.innerHTML), false);

  page.sandbox.openQuestion('Can I start my Social Security');
  const ssn = page.els.view.innerHTML;
  assert.match(ssn, /online Social Security application before you fly/);
  assert.match(ssn, /about 7 business days/);
  assert.match(ssn, /visa activation email/);
  assert.match(ssn, /ssa\.gov\/number-card\/request-number-first-time/);
  assert.match(ssn, /Plattsburgh is about an hour away/);
  assert.equal(ssn.includes('undefined'), false);

  page.sandbox.setMe({
    sid: '10001', first: 'Ada', dsEnd: '2026-09-15', hasSSN: 'No',
    ssaOfficeName: 'Ocean City SSA', season: 'Summer 2026'
  });
  page.sandbox.openQuestion('Can I start my Social Security');
  assert.equal(page.els.view.innerHTML.includes('Plattsburgh'), false);
  page.sandbox.openQuestion('My Social Security card has not come');
  assert.match(page.els.view.innerHTML, new RegExp(expectF('2026-08-25').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(page.els.view.innerHTML, /every employer, including a second job/i);

  page.sandbox.openQuestion('How do I get a second job approved');
  const job = page.els.view.innerHTML;
  assert.match(job, /10pm to 6am/);
  assert.match(job, /valet/);
  assert.match(job, /Uber, Lyft, or DoorDash/);
  assert.match(job, /warehouse/);
  assert.match(job, /blood or bodily fluids/);

  page.sandbox.openQuestion('How do I extend my insurance for my travel period');
  assert.match(page.els.view.innerHTML, /50 dollars/);

  page.sandbox.openQuestion('Where do I enter my flight details');
  assert.match(page.els.view.innerHTML, /Message my CHI team/);
  assert.equal(/agency/i.test(page.els.view.innerHTML), false);

  page.sandbox.openQuestion('When do I have to leave the United States');
  assert.match(page.els.view.innerHTML, /cannot extend your J-1/);
  assert.equal(/contact your agency|home agency|ask your agency|message your agency/i.test(page.els.view.innerHTML), false);

  page.sandbox.openQuestion('Something else about my job');
  const who = page.els.view.innerHTML;
  assert.match(who, /Who should I ask/);
  assert.match(who, /federal holidays/);
  assert.equal(who.includes('911'), false);
  assert.equal(/agency/i.test(who), false);

  function search(word){
    page.els.s.value = word;
    page.els.s.listeners.input.forEach(fn => fn());
    assert.equal(page.els.view.innerHTML.includes('Nothing matches'), false, word);
  }
  search('sprintax');
  search('plattsburgh');
  search('valet');
  search('esta');
});

test('orientation schedule converts Peru, hides a past week, and falls back when empty', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('the orientation tile must not look anyone up'); }
  });
  const link = 'https://us02web.zoom.us/webinar/register/WN_e5OfXP9_T-W9HwNsS-RbyQ';
  page.sandbox.setOrientationNow('2026-11-09T15:00:00Z');
  page.sandbox.setMe({ sid: '10001', first: 'Ada', country: 'Peru', orientationAttended: 'Yes' });
  page.sandbox.openQuestion('When is the next online orientation');
  const peru = page.els.view.innerHTML;
  assert.match(peru, /10:00 AM in Peru/);
  assert.match(peru, /10:00 AM New York time/);
  assert.equal(peru.includes('9:00 AM'), false);
  assert.match(peru, /Before You Fly/);
  assert.match(peru, /Arrival &amp; Getting to Work|Arrival & Getting to Work/);
  assert.match(peru, /Living the Program/);
  assert.match(peru, /Our records show you've attended orientation/);
  assert.equal(peru.includes(link), true);
  assert.match(peru, /changed clocks back on November 1/);

  page.sandbox.setOfficeNow('2026-11-11T15:00:00Z');
  page.sandbox.setOrientationNow('2026-11-11T15:00:00Z');
  page.sandbox.openQuestion('When is the next online orientation');
  assert.match(page.els.view.innerHTML, /Arrival/);
  assert.equal(page.els.view.innerHTML.includes(link), true);

  page.sandbox.setOrientationNow('2026-11-12T15:00:00Z');
  page.sandbox.openQuestion('When is the next online orientation');
  const past = page.els.view.innerHTML;
  assert.match(past, /The next orientation dates will be posted here\. Watch your email for your invitation\./);
  assert.equal(past.includes('Before You Fly'), false);
  assert.equal(past.includes(link), false);
  assert.match(past, /Our records show you've attended orientation/);

  page.sandbox.setOrientationNow('2026-11-09T15:00:00Z');
  page.sandbox.setOrientationWeeks([]);
  page.sandbox.openQuestion('When is the next online orientation');
  const empty = page.els.view.innerHTML;
  assert.match(empty, /The next orientation dates will be posted here\. Watch your email for your invitation\./);
  assert.equal(empty.includes(link), false);
  assert.equal(empty.includes('Before You Fly'), false);

  page.sandbox.setOrientationWeeks(null);
  page.sandbox.setMe({ sid: '10001', country: 'Mexico' });
  page.sandbox.openQuestion('When is the next online orientation');
  assert.match(page.els.view.innerHTML, /10:00 AM New York time/);
  assert.equal(page.els.view.innerHTML.includes('in Mexico'), false);
});

test('participant-facing tile text does not say agency', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  const sandbox = { globalThis: null };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src + '\nglobalThis.__T=T;', sandbox);
  const hits = [];
  sandbox.__T.forEach(t => {
    const bits = [t.q, t.sub, t.you, t.youYes, t.youNo, t.lead];
    (t.body || []).forEach(p => bits.push(p));
    (t.need || []).forEach(p => bits.push(p));
    if (t.act) bits.push(t.act.label);
    if (t.clock) bits.push(t.clock.l, t.clock.t);
    if (t.sample) (t.sample.lines || []).forEach(l => bits.push(l));
    bits.forEach(s => {
      if (s && /\bagency\b/i.test(String(s))) hits.push(t.q + ': ' + s);
    });
  });
  assert.deepEqual(hits, []);
  assert.equal((src.match(/\n\{s:'/g) || []).length, 72);
});

test('My next steps shows, hides, and skips missing fields', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('next steps must not look anyone up'); }
  });
  const day = '2026-11-09T12:00:00Z';
  page.sandbox.setNextStepsNow(day);
  function card(record){
    page.sandbox.setMe(record);
    page.sandbox.state = page.sandbox.state;
    const view = page.els.view;
    page.sandbox.render();
    return view.innerHTML;
  }
  const base = {
    sid: '10001', first: 'Ada', employer: 'Aramark', location: 'Ocean City, NJ',
    dsStart: '2026-11-20', dsEnd: '2026-12-20', arrival: '2026-10-20',
    hasSSN: 'No', sevisStatus: 'Initial', housingStatus: 'Pending'
  };
  let html = card(base);
  assert.match(html, /My next steps/);
  assert.match(html, /Validate your SEVIS record by/);
  assert.match(html, /Plan your last day/);
  assert.match(html, /Verify your housing/);
  assert.equal(html.includes('Plan your last paycheck'), false);
  assert.equal((html.match(/class="nextitem"/g) || []).length, 3);

  html = card(Object.assign({}, base, { sevisStatus: 'Validated', housingStatus: 'Approved', dsEnd: '2027-06-01', hasSSN: 'Yes', arrival: '2026-06-01' }));
  assert.equal(html.includes('My next steps'), false);

  html = card(Object.assign({}, base, { housingStatus: '' , sevisStatus: '', dsEnd: '', dsStart: '', arrival: '2026-10-20', hasSSN: 'No' }));
  assert.match(html, /Social Security Number is not on file/);
  assert.equal(html.includes('Validate your SEVIS'), false);
  assert.equal(html.includes('Verify your housing'), false);
  assert.equal(html.includes('Plan your last day'), false);

  html = card({ sid: '10001', arrival: '2026-11-09', dsStart: '2026-11-09', sevisStatus: 'Active', hasSSN: 'Yes', housingStatus: 'Verified' });
  assert.match(html, /first 2 weeks/);
  assert.match(html, /Finish your employer onboarding/);
  assert.match(html, /Save your insurance card/);

  html = card({ sid: '10001', arrival: '2026-10-10', hasSSN: 'Yes', sevisStatus: 'Active', housingStatus: 'Verified', dsEnd: '2026-11-20' });
  assert.match(html, /Plan your last paycheck/);
  assert.match(html, /contact your employer directly/);
  assert.match(html, /Do not mail it to CHI/);

  html = card({ sid: '10001', arrival: '2026-10-10', hasSSN: 'Yes', sevisStatus: 'Active', housingStatus: 'Verified' });
  assert.match(html, /Never stop going to work/);

  html = card({ sid: '10001', lastDayWorked: '2026-11-01', dsEnd: '2026-12-20', hasSSN: 'Yes', housingStatus: 'Verified', sevisStatus: 'Validated' });
  assert.match(html, /grace period started on your last day of work/);
  assert.match(html, /cannot work now/);

  html = card({ sid: '10001', dsEnd: '2026-11-20', hasSSN: 'Yes', housingStatus: 'Verified', sevisStatus: 'Validated' });
  assert.equal(html.includes('grace period started'), false);

  page.sandbox.setMe(base);
  page.sandbox.render();
  const button = { dataset: { q: 'How do I validate my SEVIS record' }, closest(sel){ return sel === '[data-q]' ? button : null; } };
  const listeners = (page.els.document.listeners && page.els.document.listeners.click) || [];
  listeners.forEach(fn => fn({ target: { closest(sel){ return button.closest(sel); } } }));
  assert.match(page.els.view.innerHTML, /How do I validate my SEVIS record/);

  function search(word, title){
    page.els.s.value = word;
    page.els.s.listeners.input.forEach(fn => fn());
    assert.equal(page.els.view.innerHTML.includes('Nothing matches'), false, word);
    assert.match(page.els.view.innerHTML, title);
  }
  search('when do i start', /When do I start working/);
  search('find housing', /Help me find housing/);
  search('change department', /Can I change my position or department/);
  search('forgot evaluation', /My monthly evaluation/);
  search('who do I ask', /Who do I contact for help/);
  search('weed', /I feel unsafe or I am being harassed/);
  search('babysitter', /How do I get a second job approved/);
  search('15 days', /I want to go home early/);
  search('returnee', /Can I come back next year/);
  search('come back next year', /Can I come back next year/);
  search('second season', /Can I come back next year/);
});

test('SEVIS, travel signature, returnee rules, and no CHI mail address', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  assert.equal((src.match(/\n\{s:'/g) || []).length, 72);
  assert.equal(/24 hours/i.test(src), false);
  assert.equal(/West End Ave|Anchorage Court|San Rafael/i.test(src), false);
  assert.match(src, /46208/);
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('these checks must not look anyone up'); }
  });
  page.sandbox.setMe({ sid: '10001', first: 'Ada', employer: 'Aramark', country: 'Peru', season: 'Summer 2026', dsEnd: '2026-09-15', arrival: '2026-05-28' });
  page.sandbox.openQuestion('How do I validate my SEVIS record');
  const sevis = page.els.view.innerHTML;
  assert.match(sevis, /within 3 days of arrival/);
  assert.equal(/24 hours|72 hours/i.test(sevis), false);
  page.sandbox.openQuestion('Can I travel inside or outside the United States');
  assert.match(page.els.view.innerHTML, /Request a travel signature 2 weeks ahead/);
  page.sandbox.openQuestion('Can I travel before I go home');
  assert.match(page.els.view.innerHTML, /Request a travel signature 2 weeks ahead/);
  page.sandbox.openQuestion('Can I come back next year');
  const back = page.els.view.innerHTML;
  assert.match(back, /3-year maximum/);
  assert.match(back, /self-placement/);
  assert.match(back, /letter of intent/);
  assert.equal(/agency/i.test(back), false);
  page.sandbox.openQuestion('How do I get my final paycheck');
  const pay = page.els.view.innerHTML;
  assert.match(pay, /update your address with your employer and with your bank/i);
  assert.match(pay, /CHI does not take your mail/);
  assert.equal(/West End|Anchorage|San Rafael/i.test(pay), false);
});

test('the U.S. phone tile opens the Tally form and search finds it', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8');
  assert.equal((src.match(/\n\{s:'/g) || []).length, 72);
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('the phone form must not look anyone up'); }
  });
  page.sandbox.setMe({ sid: '10001', first: 'Ada', last: 'Lovelace', employer: 'Aramark' });
  page.sandbox.openQuestion('How do I get a US phone number');
  const html = page.els.view.innerHTML;
  assert.match(html, /Once you have a U\.S\. number, submit it here so CHI can reach you\./);
  assert.match(html, /Update my U\.S\. phone number/);
  assert.match(html, /href="https:\/\/tally\.so\/r\/GxQbZQ\?[^"]*sid=10001/);
  assert.equal(html.includes('undefined'), false);

  page.sandbox.setMe({ country: 'Peru' });
  page.sandbox.openQuestion('How do I get a US phone number');
  const bare = page.els.view.innerHTML;
  assert.match(bare, /href="https:\/\/tally\.so\/r\/GxQbZQ"/);
  assert.equal(bare.includes('sid='), false);
  assert.equal(bare.includes('undefined'), false);

  function search(word){
    page.els.s.value = word;
    page.els.s.listeners.input.forEach(fn => fn());
    assert.equal(page.els.view.innerHTML.includes('Nothing matches'), false, word);
    assert.match(page.els.view.innerHTML, /How do I get a US phone number/);
  }
  search('american number');
  search('whatsapp number');
  search('us number');
});

test('job change and shorten program open the named Tally forms', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('these forms must not look anyone up'); }
  });
  page.sandbox.setMe({ sid: '10001', first: 'Ada', last: 'Lovelace', employer: 'Aramark', dsEnd: '2026-09-15' });

  page.sandbox.openQuestion('Can I change to a different employer');
  const change = page.els.view.innerHTML;
  assert.match(change, /Open the job change checklist/);
  assert.match(change, /href="https:\/\/tally\.so\/r\/aQyZxb\?[^"]*sid=10001/);
  assert.match(change, /30 days/);
  assert.match(change, /CHI must approve/);
  assert.match(change, /Do not walk out of your job/);
  assert.equal(change.includes('undefined'), false);

  page.sandbox.openQuestion('Can I make my second job my main job');
  const swap = page.els.view.innerHTML;
  assert.match(swap, /Open the job change checklist/);
  assert.match(swap, /href="https:\/\/tally\.so\/r\/aQyZxb\?[^"]*sid=10001/);

  page.sandbox.openQuestion('I want to go home early');
  const home = page.els.view.innerHTML;
  assert.match(home, /Submit a shorten program request/);
  assert.match(home, /href="https:\/\/tally\.so\/r\/pbLbZP\?[^"]*sid=10001/);
  assert.equal(home.includes('undefined'), false);

  function search(word, title){
    page.els.s.value = word;
    page.els.s.listeners.input.forEach(fn => fn());
    assert.equal(page.els.view.innerHTML.includes('Nothing matches'), false, word);
    assert.match(page.els.view.innerHTML, title);
  }
  search('checklist', /Can I change to a different employer/);
  search('switch employer', /Can I change to a different employer/);
  search('quit job', /Can I change to a different employer/);
  search('new job', /Can I change to a different employer/);
  search('early return', /I want to go home early/);
  search('quit program', /I want to go home early/);
  search('end program', /I want to go home early/);
});

test('every tile opens with a short plain-English answer', () => {
  const vm = require('node:vm');
  const src = [
    fs.readFileSync(path.join(ROOT, 'assets', 'content.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'assets', 'plain.js'), 'utf8')
  ].join('\n');
  const sandbox = { globalThis: null };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src + '\nglobalThis.__T=T;', sandbox);
  function syllables(word){
    word = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if(!word) return 0;
    word = word.replace(/e$/, '');
    const groups = word.match(/[aeiouy]+/g);
    return Math.max(1, groups ? groups.length : 1);
  }
  function measure(text){
    const clean = String(text).replace(/<[^>]+>/g, ' ')
      .replace(/\[\[([\s\S]*?)\]\]/g, '$1')
      .replace(/\{(\w+)\|([^}]*)\}/g, (_, k, fb) => fb === 'omit' ? '' : fb)
      .replace(/\{\w+\}/g, ' ');
    const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const words = clean.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
    const syll = words.reduce((n, w) => n + syllables(w), 0);
    const flesch = words.length && sentences.length
      ? 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syll / words.length)
      : 0;
    const long = sentences.filter(s => s.split(/\s+/).filter(Boolean).length > 20);
    return { words: words.length, flesch, long };
  }
  const before = [];
  const after = [];
  sandbox.__T.forEach(t => {
    assert.ok(t.plain && t.plain.lead && t.plain.watch, t.q);
    assert.ok(t.plain.steps.length >= 3 && t.plain.steps.length <= 5, t.q);
    const oldText = [t.lead].concat(t.body || [], t.clock ? t.clock.t : []).join(' ');
    const newText = [t.plain.lead].concat(t.plain.steps, t.plain.watch).join(' ');
    assert.equal(/\bagency\b/i.test(newText), false, t.q);
    const oldScore = measure(oldText);
    const newScore = measure(newText);
    before.push(Object.assign({ q: t.q }, oldScore));
    after.push(Object.assign({ q: t.q }, newScore));
    assert.ok(newScore.words <= 60, t.q + ' has ' + newScore.words + ' words');
    assert.deepEqual(newScore.long, [], t.q);
  });
  const avg = rows => rows.reduce((n, r) => n + r.flesch, 0) / rows.length;
  const worst = rows => rows.slice().sort((a, b) => a.flesch - b.flesch).slice(0, 5);
  console.log('READABILITY before', avg(before).toFixed(1), 'after', avg(after).toFixed(1));
  console.log('WORST before', worst(before).map(r => r.flesch.toFixed(1) + ' ' + r.q).join(' | '));
  console.log('WORST after', worst(after).map(r => r.flesch.toFixed(1) + ' ' + r.q).join(' | '));
  assert.ok(avg(after) >= 60);
});

test('guided emails use the staff subject and do not send themselves', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('an email builder must not look anyone up'); }
  });
  const record = {
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
    season: 'Summer 2026', employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', embassyInterview: '2026-05-01',
    country: 'Peru', sevisId: 'N0001234567',
    dob: '2001-01-04', tok: 'secret-token-value', agency: 'AEX', coordinator: 'kathleen'
  };
  page.sandbox.setMe(record);
  function mailOf(){
    const url = page.mails[page.mails.length - 1];
    const mail = parseMailto(url);
    mail.cc = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('cc');
    return mail;
  }
  function fill(spec){
    spec.fields.forEach(field => {
      if(field.when || field.prefill || field.lock) return;
      let value = 'A short note';
      if(field.type === 'choice' || field.type === 'checks') value = field.options[0];
      else if(field.type === 'time') value = '15:00';
      else if(field.type === 'date') value = field.max === 'dsEndPlus30' ? '2026-10-15' : '2026-07-01';
      page.sandbox.setAskAnswer(field.id, value);
    });
  }

  page.sandbox.openQuestion('How do I extend my insurance for my travel period');
  let html = page.els.view.innerHTML;
  assert.match(html, /50 dollars/);
  assert.match(html, /Pay by card before your program end date/);
  assert.match(html, /at most 30 days after your program end date/);
  assert.match(html, /October 15, 2026/);
  assert.match(html, /data-ask-send="1" disabled/);
  assert.equal(page.calls.length, 0);

  page.sandbox.setAskAnswer('coverEnd', '2026-10-16');
  page.sandbox.setAskAnswer('where', 'Boston, MA');
  page.sandbox.setAskAnswer('depart', '2026-10-01');
  assert.match(page.els.view.innerHTML, /more than 30 days after your program end date/);
  assert.equal(page.sandbox.openAskMail(), false);
  assert.equal(page.mails.length, 0);

  page.sandbox.setAskAnswer('coverEnd', '2026-09-15');
  assert.equal(page.sandbox.openAskMail(), false);

  page.sandbox.setAskAnswer('coverEnd', '2026-10-15');
  page.sandbox.setAskAnswer('canPay', 'Yes');
  page.sandbox.setAskAnswer('__urgent', 'Yes');
  const before = page.calls.length;
  assert.equal(page.sandbox.openAskMail(), true);
  assert.equal(page.calls.length, before);
  let mail = mailOf();
  assert.equal(mail.to, 'chiwt@chinet.org');
  assert.equal(mail.cc, 'chikathleenr@chinet.org');
  assert.equal(mail.subject, '⏰ Time Sensitive | Insurance Extension Request | Summer 2026 | 10001 | Ada Lovelace');
  assert.match(mail.body, /Participant Name: Ada Lovelace/);
  assert.match(mail.body, /Student ID: 10001/);
  assert.match(mail.body, /Season: Summer 2026/);
  assert.match(mail.body, /Employer: Aramark/);
  assert.match(mail.body, /DS start: June 1, 2026/);
  assert.match(mail.body, /DS end: September 15, 2026/);
  assert.match(mail.body, /Coverage end date: October 15, 2026/);
  assert.match(mail.body, /Where you will travel: Boston, MA/);
  assert.match(mail.body, /Departure date from the USA: October 1, 2026/);
  assert.match(mail.body, /Fee: 50 dollars\. Pay by card before your program end date\./);
  assert.equal(/card number|cvv|password|date of birth|2001-01-04|secret-token-value|\bAEX\b|agency/i.test(mail.body), false);
  assert.equal(/https?:\/\//.test(mail.body), false);

  page.sandbox.setMe(Object.assign({}, record, { coordinator: '' }));
  page.sandbox.openQuestion('How do I extend my insurance for my travel period');
  page.sandbox.setAskAnswer('coverEnd', '2026-10-15');
  page.sandbox.setAskAnswer('where', 'Boston, MA');
  page.sandbox.setAskAnswer('depart', '2026-10-01');
  page.sandbox.setAskAnswer('canPay', 'Yes');
  page.sandbox.setAskAnswer('__urgent', 'No');
  assert.equal(page.sandbox.openAskMail(), true);
  mail = mailOf();
  assert.equal(mail.to, 'chiwt@chinet.org');
  assert.equal(mail.cc, 'chijennifer@chinet.org');
  assert.equal(mail.subject, 'Insurance Extension Request | Summer 2026 | 10001 | Ada Lovelace');

  page.sandbox.setMe(record);
  page.sandbox.openQuestion('Can I travel inside or outside the United States');
  html = page.els.view.innerHTML;
  assert.match(html, /Request a travel signature 2 weeks ahead/);
  assert.match(html, /Attach: a clear full page scan of your DS-2019/);
  const attachAt = html.indexOf('Attach: a clear full page scan of your DS-2019');
  const sendAt = html.indexOf('Review my email');
  assert.ok(attachAt > 0 && attachAt < sendAt);
  assert.match(html, /What does Entries say on your visa/);
  page.sandbox.setAskAnswer('back', '2026-09-15');
  page.sandbox.setAskAnswer('leave', '2026-07-01');
  page.sandbox.setAskAnswer('dest', 'Mexico City, Mexico');
  page.sandbox.setAskAnswer('bossYes', 'Yes');
  page.sandbox.setAskAnswer('scan', 'Yes');
  page.sandbox.setAskAnswer('email', 'ada@example.com');
  page.sandbox.setAskAnswer('whatsapp', '+1 555 0100');
  page.sandbox.setAskAnswer('entries', 'Multiple (M)');
  assert.match(page.els.view.innerHTML, /before your program end date/);
  assert.equal(page.sandbox.openAskMail(), false);
  page.sandbox.setAskAnswer('bossYes', 'No');
  page.sandbox.setAskAnswer('back', '2026-07-10');
  assert.equal(page.sandbox.openAskMail(), false);
  assert.match(page.els.view.innerHTML, /Ask your manager first/);
  page.sandbox.setAskAnswer('bossYes', 'Yes');
  page.sandbox.setAskAnswer('__urgent', 'Yes');
  assert.equal(page.sandbox.openAskMail(), true);
  mail = mailOf();
  assert.equal(mail.to, 'CHIWT@chinet.org');
  assert.equal(mail.cc, null);
  assert.equal(mail.subject, '⏰ Travel Signature Request, Ada Lovelace, SID 10001');
  const travelLines = [
    'Hello CHI Team,',
    'I am writing to request a travel signature on my DS-2019.',
    'Full name: Ada Lovelace',
    'Student Program ID: 10001',
    'Employer: Aramark',
    'Program dates: June 1, 2026 to September 15, 2026',
    'Visa type: J-1, Entries Multiple (M)',
    'Travel destination: Mexico City, Mexico',
    'Departure date from the United States: July 1, 2026',
    'Return date to the United States: July 10, 2026',
    'My employer has approved this time off. A clear scan of my DS-2019 is attached. Please sign it and send it back before my departure date.',
    'Thank you,',
    'ada@example.com',
    '+1 555 0100'
  ];
  let travelAt = -1;
  travelLines.forEach(line => {
    const at = mail.body.indexOf(line);
    assert.ok(at > travelAt, line);
    travelAt = at;
  });
  assert.equal(mail.body.includes('Programme dates'), false);
  assert.equal(/2001-01-04|secret-token-value|\bAEX\b|agency|chikathleenr@chinet.org/i.test(mail.body), false);

  page.sandbox.setMe(Object.assign({}, record, { visaEntries: 'M' }));
  page.sandbox.openQuestion('Can I travel inside or outside the United States');
  assert.equal(page.els.view.innerHTML.includes('What does Entries say on your visa'), false);
  page.sandbox.setAskAnswer('back', '2026-07-10');
  page.sandbox.setAskAnswer('leave', '2026-07-01');
  page.sandbox.setAskAnswer('dest', 'Mexico City, Mexico');
  page.sandbox.setAskAnswer('bossYes', 'Yes');
  page.sandbox.setAskAnswer('scan', 'Yes');
  page.sandbox.setAskAnswer('email', 'ada@example.com');
  page.sandbox.setAskAnswer('whatsapp', '+1 555 0100');
  page.sandbox.setAskAnswer('__urgent', 'No');
  assert.equal(page.sandbox.openAskMail(), true);
  mail = mailOf();
  assert.match(mail.body, /Visa type: J-1, Entries M/);
  assert.equal(mail.subject, 'Travel Signature Request, Ada Lovelace, SID 10001');

  page.sandbox.openQuestion('I want to go home early');
  assert.match(page.els.view.innerHTML, /Submit a shorten program request/);
  assert.match(page.els.view.innerHTML, /tally\.so\/r\/pbLbZP/);

  page.sandbox.openQuestion('Where do I go on my first day');
  assert.match(page.els.view.innerHTML, /https:\/\/wt\.chinet\.org\/Students\/MyProfile/);
  assert.match(page.els.view.innerHTML, /Print it and carry it with your DS-2019/);

  Object.keys(page.sandbox.ASK_FORMS).forEach(q => {
    const spec = page.sandbox.ASK_FORMS[q];
    spec.fields.forEach(field => {
      const banned = /date of birth|password|social security|card number|passport number|\bSSN\b/i;
      assert.equal(banned.test(field.label), false, q + ' ' + field.label);
    });
    page.sandbox.openQuestion(q);
    fill(spec);
    page.sandbox.setAskAnswer('__urgent', 'No');
    if(spec.fields.some(field => field.id === 'status')) page.sandbox.setAskAnswer('status', 'Approved');
    assert.equal(page.sandbox.openAskMail(), true, q);
    mail = mailOf();
    const to = spec.toAddress || (spec.to === 'chiwt' ? 'chiwt@chinet.org' : 'chikathleenr@chinet.org');
    const cc = spec.cc === 'coordinator' ? 'chikathleenr@chinet.org' : spec.cc === 'jennifer' ? 'chijennifer@chinet.org' : null;
    assert.equal(mail.to, to, q);
    assert.equal(mail.cc, cc, q);
    if(spec.layout === 'travel'){
      assert.equal(mail.subject, 'Travel Signature Request, Ada Lovelace, SID 10001', q);
      assert.match(mail.body, /Hello CHI Team,/, q);
      assert.match(mail.body, /Program dates: June 1, 2026 to September 15, 2026/, q);
    }else{
      assert.equal(mail.subject, spec.topic + ' | Summer 2026 | 10001 | Ada Lovelace', q);
      assert.match(mail.body, /Participant Name: Ada Lovelace/, q);
      assert.match(mail.body, /Student ID: 10001/, q);
    }
    assert.equal(/2001-01-04|secret-token-value|\bAEX\b|\bagency\b/i.test(mail.body + '\n' + mail.subject), false, q);
    assert.equal(page.calls.length, 0);
  });
});

test('lost passport and scooter accident emails collect the incident facts', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('an incident email must not look anyone up'); }
  });
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
    season: 'Summer 2026', employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', country: 'Peru', sevisId: 'N0001234567',
    dob: '2001-01-04', tok: 'secret-token-value', agency: 'AEX', coordinator: 'kathleen'
  });
  function mailOf(){
    const url = page.mails[page.mails.length - 1];
    const mail = parseMailto(url);
    return mail;
  }
  function fill(q){
    const spec = page.sandbox.ASK_FORMS[q];
    spec.fields.forEach(field => {
      if(field.when || field.prefill || field.lock) return;
      let value = 'A short note';
      if(field.type === 'choice' || field.type === 'checks') value = field.options[0];
      else if(field.type === 'time') value = '15:00';
      else if(field.type === 'date') value = '2026-07-01';
      page.sandbox.setAskAnswer(field.id, value);
    });
  }
  const today = new Date();
  const todayIso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  page.sandbox.openQuestion('I lost my passport or another document');
  let html = page.els.view.innerHTML;
  assert.match(html, /Which items are gone/);
  assert.match(html, /value="Peru"/);
  assert.match(html, /value="Ocean City"/);
  assert.match(html, /value="NJ"/);
  assert.match(html, new RegExp('value="' + todayIso + '"'));
  assert.match(html, /File a police report and keep the number/);
  assert.match(html, /Contact your embassy for a new passport/);
  fill('I lost my passport or another document');
  page.sandbox.setAskAnswer('items', 'Passport, Visa, DS-2019');
  page.sandbox.setAskAnswer('__urgent', 'No');
  assert.equal(page.sandbox.openAskMail(), true);
  let mail = mailOf();
  assert.equal(mail.to, 'chikathleenr@chinet.org');
  assert.equal(mail.subject, 'Incident - Lost Passport | Summer 2026 | 10001 | Ada Lovelace');
  assert.match(mail.body, /Participant Name: Ada Lovelace/);
  assert.match(mail.body, /Student ID: 10001/);
  assert.match(mail.body, /Country: Peru/);
  assert.match(mail.body, /SEVIS ID: N0001234567/);
  assert.match(mail.body, /Coordinator: Kathleen/);
  assert.match(mail.body, /Items: Passport, Visa, DS-2019/);
  assert.equal(mail.body.includes('2001-01-04'), false);
  assert.equal(/\bdate of birth\b|\bSSN\b|card number/i.test(mail.body), false);
  assert.equal(page.calls.length, 0);

  page.sandbox.openQuestion('I was in an accident');
  html = page.els.view.innerHTML;
  assert.match(html, /Will you miss work\?/);
  assert.match(html, /When can you go back to work\?/);
  assert.match(html, /Were you wearing a helmet\?/);
  assert.match(html, /Doctor has not said yet/);
  assert.match(html, /Did the doctor give you a note\?/);
  assert.match(html, /attach the note in your email app/);
  assert.equal(html.includes('Not on a bike or scooter'), false);
  assert.match(html, /Call IMG at 1-855-731-9445/);
  assert.match(html, /data-ask-send="1" disabled/);
  assert.equal(/911/.test(page.els.bar.textContent + page.els.whatsappnote.textContent), false);

  fill('I was in an accident');
  page.sandbox.setAskAnswer('backWork', '');
  assert.equal(page.sandbox.openAskMail(), false);
  page.sandbox.setAskAnswer('backWork', 'Doctor has not said yet');
  page.sandbox.setAskAnswer('missWork', 'Yes');
  assert.equal(page.sandbox.openAskMail(), false);
  page.sandbox.setAskAnswer('daysSoFar', '3');
  page.sandbox.setAskAnswer('helmet', 'No');
  page.sandbox.setAskAnswer('doctorNote', 'Yes');
  page.sandbox.setAskAnswer('safe', 'No');
  assert.match(page.els.view.innerHTML, /Call 911/);
  page.sandbox.setAskAnswer('__urgent', 'No');
  assert.equal(page.sandbox.openAskMail(), true);
  mail = mailOf();
  assert.equal(mail.to, 'chikathleenr@chinet.org');
  assert.equal(mail.subject, 'Incident - Scooter Accident | Summer 2026 | 10001 | Ada Lovelace');
  const missAt = mail.body.indexOf('Will you miss work?: Yes');
  const backAt = mail.body.indexOf('When can you go back to work?: Doctor has not said yet');
  const helmAt = mail.body.indexOf('Were you wearing a helmet?: No');
  const storyAt = mail.body.indexOf('What happened:');
  assert.ok(missAt > 0 && missAt < storyAt, 'miss work is above the story');
  assert.ok(backAt > missAt && backAt < storyAt);
  assert.ok(helmAt > backAt && helmAt < storyAt);
  assert.match(mail.body, /Days missed so far: 3/);
  assert.match(mail.body, /Doctor gave a note: Yes/);
  assert.match(mail.body, /SEVIS ID: N0001234567/);
  assert.equal(mail.body.includes('2001-01-04'), false);
  assert.equal(page.calls.length, 0);
});

test('simple tiles keep email behind Still need help', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('self-serve tiles must not look anyone up'); }
  });
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
    season: 'Summer 2026', employer: 'Aramark', location: 'Ocean City, NJ',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', country: 'Peru'
  });
  page.sandbox.openQuestion('How do I get my I-94');
  let html = page.els.view.innerHTML;
  const helpAt = html.indexOf('Still need help?');
  const triedAt = html.indexOf('What did you already try?');
  assert.ok(helpAt > 0 && triedAt > helpAt);
  assert.match(html, /Never choose Apply for I-94|Never pay/);
  assert.equal(/911/.test(page.els.bar.textContent || ''), false);

  page.sandbox.openQuestion('How do I extend my insurance for my travel period');
  html = page.els.view.innerHTML;
  assert.equal(html.includes('Still need help?'), false);
  assert.match(html, /Review my email/);

  page.sandbox.openQuestion('I am sick or I am hurt');
  html = page.els.view.innerHTML;
  assert.match(html, /Still need help\?/);
  assert.match(html, /What did you already try\?/);
  assert.match(html, /Start with free Teladoc/);
  const sickHelp = html.indexOf('Still need help?');
  const teladoc = html.indexOf('Start with free Teladoc');
  assert.ok(teladoc > 0 && teladoc < sickHelp);
});

test('tile links open after login and carry no student data', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/?tile=travel-signature&sid=10001&dob=2001-01-04&name=Ada',
    handler() {
      return jsonResponse(200, person({
        employer: 'Aramark', location: 'Ocean City, NJ',
        dsStart: '2026-06-01', dsEnd: '2026-09-15', birthCountry: 'Romania'
      }));
    }
  });
  let html = page.els.view.innerHTML;
  assert.match(html, /Can I travel inside or outside the United States/);
  assert.match(html, /date of birth/i);
  assert.match(html, /Copy link to this tile/);
  assert.equal(html.includes('Aramark'), false);
  assert.equal(page.calls.length, 0);
  const bar = new URL(page.history.url, 'https://example.test');
  assert.equal(bar.searchParams.get('tile'), 'travel-signature');
  assert.equal(bar.searchParams.get('sid'), null);
  assert.equal(bar.searchParams.get('dob'), null);
  assert.equal(bar.searchParams.get('name'), null);
  assert.equal(page.history.url.includes('10001'), false);
  assert.equal(page.history.url.includes('2001-01-04'), false);
  const link = html.match(/data-tile-link="([^"]+)"/)[1].replace(/&amp;/g, '&');
  assert.equal(link, 'https://example.test/menu/?tile=travel-signature');
  const button = {
    dataset: { tileLink: link },
    getAttribute() { return link; },
    textContent: '',
    closest(sel) { return sel === '[data-tile-link]' ? button : null; }
  };
  (page.els.document.listeners.click || []).forEach(fn => fn({ target: { closest(sel) { return button.closest(sel); } } }));
  assert.equal(page.copied[0], 'https://example.test/menu/?tile=travel-signature');

  await identifyAs(page, person({}));
  html = page.els.view.innerHTML;
  assert.match(html, /Aramark/);
  assert.match(html, /Request a travel signature 2 weeks ahead/);
  const after = new URL(page.history.url, 'https://example.test');
  assert.equal(after.searchParams.get('tile'), 'travel-signature');
  assert.equal(after.searchParams.get('sid'), null);
  assert.equal(page.history.url.includes('10001'), false);

  const bad = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/?tile=not-a-real-tile',
    handler() { throw new Error('unknown slug must not look anyone up'); }
  });
  assert.match(bad.els.view.innerHTML, /Where are you now/);
  assert.equal(bad.els.view.innerHTML.includes('Copy link to this tile'), false);
  assert.equal(new URL(bad.history.url, 'https://example.test').searchParams.get('tile'), null);
  assert.equal(bad.calls.length, 0);

  const slugs = page.sandbox.TILE_SLUGS;
  const values = Object.values(slugs);
  assert.equal(values.length, 72);
  assert.equal(new Set(values).size, 72);
  assert.equal(slugs['Can I travel inside or outside the United States'], 'travel-signature');
  values.forEach(slug => assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/));
  const docs = fs.readFileSync(path.join(ROOT, 'docs', 'tile-links.md'), 'utf8');
  Object.keys(slugs).forEach(q => {
    assert.ok(docs.includes('`' + slugs[q] + '`'), slugs[q]);
    assert.ok(docs.includes(q), q);
  });
});

test('personalized lines stay readable with missing or edge-case roster data', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('edge-case copy must not look anyone up'); }
  });
  const people = {
    'missing fields': { sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace' },
    'before arrival': {
      sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
      employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server',
      dsStart: '2026-12-01', dsEnd: '2027-03-15', season: 'Winter 2026-27', country: 'Peru'
    },
    'program ended': {
      sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
      employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server',
      dsStart: '2025-06-01', dsEnd: '2025-09-15', arrival: '2025-05-28',
      lastDayWorked: '2025-09-01', season: 'Summer 2025'
    },
    returnee: {
      sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
      employer: 'Aramark', country: 'Peru', season: 'Summer 2026',
      dsStart: '2026-06-01', dsEnd: '2026-09-15', returnee: 'Yes', timesParticipated: '2'
    }
  };
  const bad = /undefined|NaN|Invalid Date|\{[a-zA-Z]|on day\s+of|<b>\s*<\/b>|built their season/i;
  Object.keys(people).forEach(label => {
    page.sandbox.setMe(people[label]);
    Object.keys(page.sandbox.TILE_SLUGS).forEach(q => {
      page.sandbox.openQuestion(q);
      const html = page.els.view.innerHTML;
      assert.equal(bad.test(html), false, label + ' / ' + q);
    });
  });
  page.sandbox.setMe(people.returnee);
  page.sandbox.openQuestion('Can I come back next year');
  assert.match(page.els.view.innerHTML, /You have done a CHI season before/);
  assert.match(page.els.view.innerHTML, /J-1 programs before this one: <b>2<\/b>/);
  page.sandbox.setMe(people['before arrival']);
  page.sandbox.openQuestion('I am not getting enough hours');
  assert.equal(/on day -/.test(page.els.view.innerHTML), false);
  page.sandbox.setMe(people['missing fields']);
  page.sandbox.openQuestion('I need to change my start date');
  assert.equal(page.els.view.innerHTML.includes('planned the season'), false);
});

test('the top questions find the right tile in the first three results', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('search must not look anyone up'); }
  });
  function titles(word){
    page.els.s.value = word;
    page.els.s.listeners.input.forEach(fn => fn());
    const html = page.els.view.innerHTML;
    assert.equal(html.includes('Nothing matches'), false, word);
    return [...html.matchAll(/<span class="lab">([^<]+)<\/span>/g)].map(m => m[1]);
  }
  const cases = [
    ['go home', 'I want to go home early'],
    ['finish early', 'I want to go home early'],
    ['grace period', 'When do I have to leave the United States'],
    ['paycheck', 'I did not get my paycheck'],
    ['salary', 'My pay is wrong'],
    ['manager', 'I have a problem with my manager'],
    ['fired', 'I lost my job'],
    ['housing', 'Where do I verify my housing'],
    ['portal', 'I cannot get into my CHI portal'],
    ['quit', 'Can I change to a different employer'],
    ['hours', 'I am not getting enough hours'],
    ['sick', 'I am sick or I am hurt'],
    ['doctor', 'I want to see a doctor'],
    ['accident', 'I was in an accident'],
    ['scooter', 'I was in an accident'],
    ['first day', 'Where do I go on my first day'],
    ['second job', 'How do I get a second job approved'],
    ['ssn', 'How do I apply for my Social Security Number'],
    ['social', 'How do I apply for my Social Security Number'],
    ['sevis', 'How do I validate my SEVIS record'],
    ['when do i start', 'When do I start working'],
    ['tax', 'What tax comes out of my pay'],
    ['next year', 'Can I come back next year'],
    ['bus', 'How do I get to work'],
    ['fly', 'Where do I enter my flight details'],
    ['bank', 'How do I open a US bank account'],
    ['visa denied', 'Where do I enter my visa results'],
    ['fingerprint', 'I need casino fingerprinting'],
    ['cruise', 'Can I travel inside or outside the United States'],
    ['orientation', 'When is the next online orientation'],
    ['phone', 'How do I get a US phone number'],
    ['i94', 'How do I get my I-94'],
    ['pasport', 'I lost my passport or another document'],
    ['evaluation', 'My monthly evaluation'],
    ['time off', 'My time off was refused'],
    ['scam', 'Can CHI check my housing is not a scam']
  ];
  assert.ok(cases.length >= 30);
  cases.forEach(([word, title]) => {
    const found = titles(word);
    const at = found.indexOf(title);
    assert.ok(at >= 0 && at < 3, word + ' → ' + found.slice(0, 3).join(' | '));
  });

  const started = new Date();
  started.setDate(started.getDate() - 20);
  const startIso = started.getFullYear() + '-' + String(started.getMonth() + 1).padStart(2, '0') + '-' + String(started.getDate()).padStart(2, '0');
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
    employer: 'Aramark', arrivalAirport: 'ACY', job: 'Server',
    dsStart: startIso, dsEnd: '2027-03-15'
  });
  page.sandbox.openQuestion('Where do I enter my flight details');
  assert.match(page.els.view.innerHTML, /Some employers pick you up/);
  assert.match(page.els.view.innerHTML, /ACY/);
  assert.match(page.els.view.innerHTML, /job offer is your employer info/);
  page.sandbox.openQuestion('I need casino fingerprinting');
  assert.match(page.els.view.innerHTML, /Some employers take this fee/);
  assert.match(page.els.view.innerHTML, /Ask <b>Aramark<\/b>/);
  page.sandbox.openQuestion('I am struggling or homesick');
  assert.match(page.els.view.innerHTML, /Some people find weeks 3 and 4/);
  assert.match(page.els.view.innerHTML, /You are in weeks 3 or 4/);
  page.sandbox.openQuestion('I am sick or I am hurt');
  assert.match(page.els.view.innerHTML, /Check your insurance card or plan for your exact cost|Check your card for the exact cost/);
  assert.match(page.els.view.innerHTML, /350/);
  assert.match(page.els.view.innerHTML, /25/);
});

test('staff emails lead with the decision facts and phases pick six tiles', async () => {
  const page = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('phase and email checks must not look anyone up'); }
  });
  page.sandbox.setMe({
    sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
    season: 'Summer 2026', employer: 'Aramark', location: 'Ocean City, NJ', job: 'Server',
    dsStart: '2026-06-01', dsEnd: '2026-09-15', country: 'Peru', coordinator: 'kathleen'
  });
  page.sandbox.openQuestion('I was in an accident');
  const story = 'I was riding a rented scooter. The front wheel locked, and I fell on my left hand. A person at the corner saw it.';
  page.sandbox.setAskAnswer('safe', 'Yes');
  page.sandbox.setAskAnswer('missWork', 'No');
  page.sandbox.setAskAnswer('backWork', 'Doctor has not said yet');
  page.sandbox.setAskAnswer('doctorNote', 'No');
  page.sandbox.setAskAnswer('helmet', 'Yes');
  page.sandbox.setAskAnswer('when', '2026-07-01');
  page.sandbox.setAskAnswer('vehicle', 'Scooter');
  page.sandbox.setAskAnswer('role', 'I was riding');
  page.sandbox.setAskAnswer('doctor', 'No');
  page.sandbox.setAskAnswer('police', 'No');
  page.sandbox.setAskAnswer('what', story);
  page.sandbox.setAskAnswer('__urgent', 'No');
  assert.equal(page.sandbox.openAskMail(), true);
  const mail = parseMailto(page.mails[page.mails.length - 1]);
  const facts = ['Student ID: 10001', 'Employer: Aramark', 'Program dates: June 1, 2026 to September 15, 2026', 'Will you miss work?: No'];
  let at = -1;
  facts.forEach(line => {
    const i = mail.body.indexOf(line);
    assert.ok(i > at, line);
    at = i;
  });
  const storyAt = mail.body.indexOf(story);
  assert.ok(storyAt > at);
  assert.equal(mail.body.includes(story), true);
  assert.match(mail.subject, /^Incident - Scooter Accident \| Summer 2026 \| 10001 \| Ada Lovelace$/);

  function isoShift(n){
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function phase(startShift, endShift){
    page.sandbox.setMe({
      sid: '10001', first: 'Ada', last: 'Lovelace', name: 'Ada Lovelace',
      employer: 'Aramark', dsStart: isoShift(startShift), dsEnd: isoShift(endShift)
    });
    const go = { dataset: { go: 'home' }, closest(sel){ return sel === '[data-go]' ? go : null; } };
    const listeners = (page.els.document.listeners && page.els.document.listeners.click) || [];
    listeners.forEach(fn => fn({ target: { closest(sel){ return go.closest(sel); } } }));
    const html = page.els.view.innerHTML;
    const block = html.split('For you right now')[1] || '';
    return block.split('</section>')[0];
  }
  const before = phase(5, 90);
  assert.match(before, /You have not arrived yet/);
  assert.match(before, /My visa appointment/);
  assert.equal((before.match(/data-leaf=/g) || []).length, 6);
  assert.match(phase(0, 80), /first 2 weeks/);
  assert.match(phase(-5, 70), /first 2 weeks/);
  assert.match(phase(-30, 40), /middle of your program/);
  assert.match(phase(-40, 10), /last 3 weeks/);
  assert.match(phase(-40, 2), /last 3 weeks/);
  const after = phase(-80, -3);
  assert.match(after, /program end date has passed/);
  assert.match(after, /How do I claim my tax overages back/);
  assert.equal((after.match(/data-leaf=/g) || []).length, 6);

  const css = fs.readFileSync(path.join(ROOT, 'assets', 'styles.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--ink-3:#595959/);
  assert.match(css, /Selected\. /);

  const down = await loadPage({
    endpoint: 'https://lookup.test/exec',
    href: 'https://example.test/menu/',
    handler() { throw new Error('LOOKUP_SECRET_SHOULD_NOT_RENDER'); }
  });
  down.els.idq.value = '10001';
  down.els.iddob.value = '2001-02-03';
  await down.sandbox.doLookup();
  const shown = visible(down.els);
  assert.match(shown, /We could not look you up just now/);
  assert.match(shown, /Try again/);
  assert.equal(shown.includes('LOOKUP_SECRET_SHOULD_NOT_RENDER'), false);
  down.sandbox.openQuestion('Can I travel inside or outside the United States');
  const open = down.els.view.innerHTML;
  assert.match(open, /Request a travel signature 2 weeks ahead/);
  assert.equal(open.includes('Aramark'), false);
  assert.match(open, /This answer is different for every person/);
});
