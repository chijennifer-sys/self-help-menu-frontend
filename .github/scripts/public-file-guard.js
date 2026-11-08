/* Public-file guard for the Pages repo.

   A single proper Apps Script /exec URL may appear, and only as the
   ENDPOINT string in assets/config.js. Bare deployment ids, /dev URLs,
   credentials, and Sheet or Drive folder ids are still rejected.
   An empty ENDPOINT is the expected state until that URL is reviewed. */

const fs = require('fs');
const path = require('path');

const EXEC_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const DEV_URL = /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/dev/;
const BARE_ID = /AKfyc[A-Za-z0-9_-]*/;
const SHEET = /docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/drive\/folders\//;
const CREDS = /clasprc|CLASPRC_JSON|BEGIN PRIVATE KEY|client_secret|refresh_token/;
const ENDPOINT_LINE = /^\s*const ENDPOINT\s*=\s*(['"])(.*)\1\s*;?\s*$/;

const TEXT = new Set(['.js', '.css', '.html', '.md', '.svg', '.json', '.txt', '.yml']);

function listPublicFiles(root) {
  const out = [];
  const index = path.join(root, 'index.html');
  if (fs.existsSync(index)) out.push(index);
  const assets = path.join(root, 'assets');
  if (!fs.existsSync(assets)) return out;
  const walk = dir => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(ent => {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (TEXT.has(path.extname(ent.name).toLowerCase())) out.push(p);
    });
  };
  walk(assets);
  return out;
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function checkPublicTree(root) {
  const errors = [];
  const files = listPublicFiles(root);
  const configPath = files.find(f => rel(root, f) === 'assets/config.js');
  let allowedUrl = '';

  if (!configPath) {
    errors.push('assets/config.js is missing');
  } else {
    const lines = fs.readFileSync(configPath, 'utf8').split(/\n/);
    const endpointLines = lines.filter(line => /^\s*const ENDPOINT\s*=/.test(line));
    if (endpointLines.length !== 1) {
      errors.push('assets/config.js must contain exactly one ENDPOINT assignment');
    } else {
      const match = endpointLines[0].match(ENDPOINT_LINE);
      if (!match) {
        errors.push('ENDPOINT must be one quoted string');
      } else if (match[2] === '') {
        allowedUrl = '';
      } else if (EXEC_URL.test(match[2]) && !DEV_URL.test(match[2])) {
        allowedUrl = match[2];
      } else {
        errors.push('ENDPOINT must be empty or one https://script.google.com/macros/s/<id>/exec URL');
      }
    }
  }

  files.forEach(file => {
    let text = fs.readFileSync(file, 'utf8');
    const name = rel(root, file);
    if (allowedUrl && name === 'assets/config.js') {
      const at = text.indexOf(allowedUrl);
      if (at === -1) errors.push('assets/config.js ENDPOINT URL was not found as a single string');
      else text = text.slice(0, at) + text.slice(at + allowedUrl.length);
    }
    if (allowedUrl && text.indexOf(allowedUrl) !== -1) {
      errors.push(name + ' repeats the /exec URL. It belongs only on the ENDPOINT line in assets/config.js');
    }
    if (DEV_URL.test(text)) errors.push(name + ' contains a /dev URL');
    if (SHEET.test(text)) errors.push(name + ' contains a Sheet or Drive folder id');
    if (CREDS.test(text)) errors.push(name + ' contains credential material');
    if (BARE_ID.test(text)) errors.push(name + ' contains a bare deployment id');
  });

  return errors;
}

if (require.main === module) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const errors = checkPublicTree(root);
  if (errors.length) {
    errors.forEach(err => {
      console.error('::error::' + err);
    });
    process.exit(1);
  }
  console.log('public file guard ok');
}

module.exports = { checkPublicTree };
