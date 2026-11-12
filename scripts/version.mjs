#!/usr/bin/env node
/*
 * BM Translator version tool — VERSION is the single source of truth (same system as QS CRM).
 *   node scripts/version.mjs check            VERSION = APP.version in version.js = first CHANGELOG entry = "vX" button in index.html
 *                                             = sw.js cache version; CHANGELOG.md up to date; JavaScript syntax OK
 *   node scripts/version.mjs notes [x.y.z]    release notes (markdown) for one version, from CHANGELOG in version.js
 *   node scripts/version.mjs changelog        write CHANGELOG.md from version.js
 *   node scripts/version.mjs bump x.y.z       set VERSION + APP.version + version buttons + sw.js (then add the CHANGELOG entry in version.js)
 */
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { execFileSync } from 'child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const wr = (f, t) => fs.writeFileSync(path.join(root, f), t);
const SEMVER = /^\d+\.\d+\.\d+$/;
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

function version() { return rd('VERSION').trim(); }
function loadVersionJs() { const ctx = {}; vm.runInNewContext(rd('version.js'), ctx); return ctx; }
function notes(entries, v) {
  const e = entries.find(x => x.v === v); if (!e) throw new Error('No CHANGELOG entry for ' + v + ' in version.js');
  return e.items.map(t => '- ' + t).join('\n') + '\n';
}
function changelogMd(entries) {
  return '# BM Translator — changelog\n\nGenerated from the CHANGELOG in `version.js` by `node scripts/version.mjs changelog`. Do not edit by hand.\n\n' +
    entries.map(e => `## v${e.v} — ${e.date}\n\n${notes(entries, e.v)}`).join('\n');
}
const swVersion = () => (rd('sw.js').match(/const VERSION = "bm-([\d.]+)"/) || [])[1];
const btnVersion = () => (rd('index.html').match(/id="btnVer"[^>]*>v([\d.]+)</) || [])[1];

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'notes') { process.stdout.write(notes(loadVersionJs().CHANGELOG, arg || version())); }
else if (cmd === 'changelog') { wr('CHANGELOG.md', changelogMd(loadVersionJs().CHANGELOG)); console.log('CHANGELOG.md written'); }
else if (cmd === 'bump') {
  if (!SEMVER.test(arg || '')) throw new Error('Usage: bump x.y.z');
  const old = version(); if (cmp(arg, old) <= 0) throw new Error(`New version ${arg} must be higher than ${old}`);
  wr('version.js', rd('version.js').replace(/(version: ')[^']+(')/, `$1${arg}$2`));
  wr('index.html', rd('index.html').replace(/(id="btnVer"[^>]*>)v[\d.]+(<)/, `$1v${arg}$2`).replace(/(id="brandVer"[^>]*>)v[\d.]+(<)/, `$1v${arg}$2`));
  wr('sw.js', rd('sw.js').replace(/const VERSION = "bm-[\d.]+"/, `const VERSION = "bm-${arg}"`));
  wr('VERSION', arg + '\n');
  console.log(`Bumped ${old} -> ${arg}. Now add { v:'${arg}', date:'…', items:[…] } at the top of CHANGELOG in version.js, then run: node scripts/version.mjs changelog`);
}
else if (cmd === 'check') {
  const errs = [], v = version();
  if (!SEMVER.test(v)) errs.push(`VERSION "${v}" is not x.y.z`);
  let ctx = {}; try { ctx = loadVersionJs(); } catch (e) { errs.push('version.js: ' + e.message); }
  const av = ctx.APP && ctx.APP.version; if (av !== v) errs.push(`version.js APP.version is ${av}, VERSION is ${v}`);
  const entries = ctx.CHANGELOG || [];
  if (!entries.length) errs.push('CHANGELOG in version.js is empty');
  if (entries.length && entries[0].v !== v) errs.push(`first CHANGELOG entry is ${entries[0].v}, VERSION is ${v}`);
  for (let k = 1; k < entries.length; k++) if (cmp(entries[k - 1].v, entries[k].v) <= 0) errs.push(`CHANGELOG order: ${entries[k - 1].v} before ${entries[k].v}`);
  if (btnVersion() !== v) errs.push(`index.html version button shows v${btnVersion()}, VERSION is ${v}`);
  if (swVersion() !== v) errs.push(`sw.js cache version is ${swVersion()}, VERSION is ${v} (phones would not get the update)`);
  if (entries.length && (!fs.existsSync(path.join(root, 'CHANGELOG.md')) || rd('CHANGELOG.md') !== changelogMd(entries))) errs.push('CHANGELOG.md is out of date — run: node scripts/version.mjs changelog');
  const sw = rd('sw.js'); for (const f of ['index.html', 'app.js', 'engine.js', 'data.js', 'version.js']) if (!sw.includes(`"${f}"`)) errs.push(`sw.js does not cache ${f} (needed offline)`);
  if (!/Content-Security-Policy/.test(rd('index.html'))) errs.push('index.html lost its Content-Security-Policy');
  if (/<script>(?!\s*<\/script>)/.test(rd('index.html'))) errs.push('inline <script> in index.html is blocked by the security policy - put code in app.js');
  const files = ['app.js', 'engine.js', 'data.js', 'version.js', 'sw.js'];
  for (const f of files) { try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); } catch (e) { errs.push('Syntax error in ' + f + ': ' + String(e.stderr).split('\n').slice(0, 4).join(' ')); } }
  if (errs.length) { console.error('Version / build check FAILED:\n - ' + errs.join('\n - ')); process.exit(1); }
  console.log(`OK: v${v} — version.js, index.html, sw.js, changelog, CHANGELOG.md; ${files.length} scripts pass the syntax check`);
}
else { console.log('Usage: node scripts/version.mjs check | notes [x.y.z] | changelog | bump x.y.z'); process.exit(cmd ? 1 : 0); }
