// Offline engine tests: node test/t_engine.js
global.window = {};
require('../data.js');
const { Engine, parse, cleanOCR } = require('../engine.js');
const E = new Engine(parse(window.BM_DATA));
let fail = 0, n = 0;
const eq = (name, got, want) => { n++; if (got !== want) { fail++; console.error(`FAIL ${name}\n   got:  ${got}\n   want: ${want}`); } };
const has = (name, got, part) => { n++; if (!String(got).includes(part)) { fail++; console.error(`FAIL ${name}\n   got:  ${got}\n   missing: ${part}`); } };

// phrasebook matches
eq('phrase ms', E.msToEn('Sudah siap?').phrase.en, 'Is it done?');
eq('phrase en', E.enToMs('Where is the toilet?').phrase.ms, 'Di mana tandas?');
eq('thank you', E.enToMs('thank you').phrase.ms, 'Terima kasih');
// word by word + roots
eq('sentence', E.msToEn('Bumbung bangunan ini bocor dan dinding retak').rough, 'roof building this leak and wall crack');
has('passive di-', E.msToEn('Dokumen telah dihantar').rough, '(be) send');
has('plural', E.msToEn('pekerja-pekerja').rough, 'worker(s)');
has('pe-an', E.msToEn('pemasangan paip').rough, '(act of) install');
has('-nya', E.msToEn('harganya').rough, 'price');
eq('brunei dialect', E.msToEn('awu, inda apa bah').rough, 'yes no problem OK');
// english -> malay word order
eq('adj + possessive', E.enToMs('my new helmet').rough, 'topi keselamatan baru saya');
eq('en sentence', E.enToMs('bring the cement to the site tomorrow').rough, 'bawa simen ke tapak esok');
// user words win
const E2 = new Engine([{ ms: 'rasuk', en: 'floor beam (my term)', note: '', cat: 'build', phrase: false, source: 'mine' }].concat(parse(window.BM_DATA)));
eq('mine first', E2.msToEn('rasuk').tokens[0].entry.source, 'mine');
// search
eq('search beam', E.search('beam')[0].ms, 'rasuk');

// scanner clean-up
const L = (c, ws) => ({ confidence: c, text: ws.map(w => w[0]).join(' '), words: ws.map(w => ({ text: w[0], confidence: w[1] })) });
const blocks = lines => ({ blocks: [{ paragraphs: [{ lines }] }] });
const mouse = cleanOCR(blocks([L(5, [['bo', 5]]), L(96, [['|', 96]]), L(41, [['DY', 34], ['ow', 33], ['4', 55]]), L(28, [['rw', 30], ['aly', 28], ['=', 40]]), L(62, [['-.', 60], ['>>', 70], ['e3', 55]])]));
eq('logo/texture -> no text', mouse.text, '');
eq('logo/texture dropped', mouse.dropped, 5);
const sign = cleanOCR(blocks([L(97, [['BAHAYA', 97]]), L(96, [['Hubungi', 97], ['penyelia:', 96], ['7123456', 96]]), L(40, [['%#', 40]])]));
eq('sign kept', sign.text, 'BAHAYA\nHubungi penyelia: 7123456');
eq('sign dropped', sign.dropped, 1);

console.log(fail ? `${fail} of ${n} tests FAILED` : `OK: ${n} engine + scanner tests pass (${E.entries.length} entries)`);
process.exit(fail ? 1 : 0);
