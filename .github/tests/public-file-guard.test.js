const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkPublicTree } = require('../scripts/public-file-guard');

const PROPER = 'https://script.google.com/macros/s/AKfycbTESTONLYnotARealDeployment0000000000/exec';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chi-guard-'));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>menu</title>\n');
  fs.writeFileSync(path.join(root, 'assets', 'app.js'), '/* page */\n');
  fs.writeFileSync(path.join(root, 'assets', 'config.js'), "const ENDPOINT = '';\n");
  return root;
}

const EXEC_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

test('the committed config passes with an empty ENDPOINT or one /exec URL', () => {
  const root = path.resolve(__dirname, '..', '..');
  assert.deepEqual(checkPublicTree(root), []);
  const config = fs.readFileSync(path.join(root, 'assets', 'config.js'), 'utf8');
  const lines = config.split('\n').filter(line => /^\s*const ENDPOINT\s*=/.test(line));
  assert.equal(lines.length, 1);
  const match = lines[0].match(/^\s*const ENDPOINT\s*=\s*(['"])(.*)\1\s*;\s*$/);
  assert.ok(match, 'ENDPOINT must be one quoted string');
  const value = match[2];
  assert.ok(value === '' || EXEC_URL.test(value));
  if (value) {
    const without = config.replace(value, '');
    assert.equal(without.includes(value), false);
    assert.equal(without.includes('AKfyc'), false);
  }
});

test('one proper /exec URL is allowed only as ENDPOINT in config.js', () => {
  const root = fixture();
  fs.writeFileSync(
    path.join(root, 'assets', 'config.js'),
    "const ENDPOINT = '" + PROPER + "';\n"
  );
  assert.deepEqual(checkPublicTree(root), []);
});

test('a bare deployment id is rejected', () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, 'assets', 'app.js'), '\nconst id = "AKfycbTESTONLYnotARealDeployment0000000000";\n');
  const errors = checkPublicTree(root);
  assert.ok(errors.some(e => /bare deployment id/.test(e)));
});

test('the same /exec URL outside ENDPOINT is rejected', () => {
  const root = fixture();
  fs.writeFileSync(
    path.join(root, 'assets', 'config.js'),
    "const ENDPOINT = '" + PROPER + "';\n"
  );
  fs.appendFileSync(path.join(root, 'assets', 'app.js'), '\nconst extra = "' + PROPER + '";\n');
  const errors = checkPublicTree(root);
  assert.ok(errors.length > 0);
});

test('a /dev URL is rejected, including as ENDPOINT', () => {
  const root = fixture();
  const dev = 'https://script.google.com/macros/s/AKfycbTESTONLYnotARealDeployment0000000000/dev';
  fs.writeFileSync(path.join(root, 'assets', 'config.js'), "const ENDPOINT = '" + dev + "';\n");
  const errors = checkPublicTree(root);
  assert.ok(errors.some(e => /ENDPOINT must be empty|\/dev URL|bare deployment id/.test(e)));
});

test('credentials and sheet or folder ids are rejected', () => {
  const cred = fixture();
  fs.appendFileSync(path.join(cred, 'assets', 'app.js'), '\n/* clasprc.json client_secret */\n');
  assert.ok(checkPublicTree(cred).some(e => /credential/.test(e)));

  const sheet = fixture();
  fs.appendFileSync(
    path.join(sheet, 'assets', 'app.js'),
    '\nconst s = "https://docs.google.com/spreadsheets/d/abc123/edit";\n'
  );
  assert.ok(checkPublicTree(sheet).some(e => /Sheet or Drive/.test(e)));

  const folder = fixture();
  fs.appendFileSync(
    path.join(folder, 'index.html'),
    '\nhttps://drive.google.com/drive/folders/abc123\n'
  );
  assert.ok(checkPublicTree(folder).some(e => /Sheet or Drive/.test(e)));
});
