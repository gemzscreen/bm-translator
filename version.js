/* BM Translator - version and changelog.
   VERSION (file) is the single source of truth; keep APP.version, the first CHANGELOG entry,
   the version button in index.html and sw.js in step with:  node scripts/version.mjs bump x.y.z
   then add the new entry at the top of CHANGELOG, run  node scripts/version.mjs changelog  and  check. */
var APP = { name: 'BM Translator', version: '1.1.0', brand: 'DarkwizLab.com', brandUrl: 'https://darkwizlab.com' };
var CHANGELOG = [
  { v:'1.1.0', date:'12 Nov 2026', items:[
    'Version number and "What\'s new" list: tap the version in the header. Every update now has a number, a changelog and a GitHub release (same system as QS CRM).',
    'Scanner: drag a box around the text to read only that part; the whole photo is still read first automatically.',
    'Scanner ignores the random marks it "sees" in logos, objects and textured backgrounds, and shows "No readable text found" with tips instead of nonsense. You can still look at what was ignored.',
    'Scanner reads small text better: a boxed area is enlarged before reading.',
    'Settings: Save button for the MyMemory email, with a confirmation of what is saved, and a Remove button.',
    'Security: the app may only load its own files and talk to the translation service (content security policy), will not run inside another website, sends no referrer when opening links, and checks and size-limits imported files.',
    'App updates always download fresh files.',
    'Powered by DarkwizLab.com.'
  ]},
  { v:'1.0.0', date:'12 Nov 2026', items:[
    'First release: offline Malay / Brunei Malay to English translator with phrasebook match, word-by-word meaning and root-word analysis (about 930 built-in entries).',
    'Photo scanner (Malay and English) that works offline after a one-time download.',
    'Voice input (online), read-aloud, phrasebook with favourites, My words with backup and import, online full-sentence translation (MyMemory) and Google Translate link.',
    'Installable on Android and iPhone; works without data.'
  ]}
];
