import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { matchAnswer, expandQuestions, buildCatalogQuestions, finalizeQuestions, buildDictionary, dictCorrect, pickDaily, normalize, venueFor, showFor, TIERS } from '../site/js/engine.js';

const read = p => JSON.parse(readFileSync(new URL('../site/data/' + p, import.meta.url)));
const q = read('questions.json'), l = read('leaks.json');
const catPath = new URL('../site/data/catalog.json', import.meta.url);
const cat = existsSync(catPath) ? JSON.parse(readFileSync(catPath)) : null;
const curated = expandQuestions(q.questions);
const gen = buildCatalogQuestions(cat, l, q.solo || []);
const all = finalizeQuestions([...curated, ...gen]);

const ids = new Set();
for (const x of all) {
  assert(!ids.has(x.id), 'dup id ' + x.id); ids.add(x.id);
  assert(x.answers.length >= 3, 'too few answers ' + x.id);
  for (const a of x.answers) assert(TIERS[a.tier], `bad tier ${x.id} ${a.text} ${a.tier}`);
  assert(x.answers.some(a => a.tier === 7) && x.answers.some(a => a.tier === 6), 'missing Day One/Elite Ball ' + x.id);
  assert(/song|album|EP\b|project|tape|leak/i.test(x.prompt) && x.kind !== 'n', 'must ask for a song or project: ' + x.prompt);
}
const byEra = all.reduce((m, x) => (m[x.era] = (m[x.era] || 0) + 1, m), {});
console.log('curated:', curated.length, 'catalog prompts:', gen.length, 'total:', all.length, byEra);
if (cat) console.log('catalog artists:', cat.artists.length, 'released:', cat.artists.reduce((s, a) => s + a.rel.length, 0), 'unreleased:', cat.artists.reduce((s, a) => s + a.unr.length, 0));

const find = id => all.find(x => x.id === id);
const m = (id, s) => { const x = find(id); return matchAnswer(s, x.answers, x.whitelist, x.kind); };
// exact + aliases
if (cat) { const solo = new Set((q.solo||[]).map(normalize)); for (const x of gen) if (x.artist) assert(solo.has(normalize(x.artist)), 'non-solo artist prompt ' + x.id); }
// auto-correct: short forms and typos snap only when close
assert.equal(m('oway-songs', 'bada bing bada boom')?.answer.text, 'bada bing, bada bØØm');
assert.equal(m('oway-projects', 'rokk gotti')?.answer.text, 'Røkk Gøtti');
assert.equal(m('osama-proj', 'psykotic')?.tier, 2);
assert.equal(m('ken-proj', 'Y'), null);
assert.equal(m('lonely-proj', '</3')?.answer.text, '</3');
// autocomplete is global, not per-question
const dict = buildDictionary(all, cat);
assert.equal(dictCorrect(dict, 'carti'), 'Playboi Carti');
assert.equal(dictCorrect(dict, 'osamasn'), 'OsamaSon');
assert.equal(dictCorrect(dict, 'OsamaSon'), null); // already a known name: no prompt

const d1 = pickDaily(all, '2026-11-13'), d2 = pickDaily(all, '2026-11-13');
assert.equal(d1.length, 7); assert.equal(new Set(d1.map(x => x.id)).size, 7);
assert.deepEqual(d1.map(x => x.id), d2.map(x => x.id));
console.log('daily:', d1.map(x => x.id).join(', '));
const tally = {}; let n = 0;
for (let k = 0; k < 120; k++) { const day = new Date(2026, 10, 13 + k); const d = pickDaily(all, `${day.getFullYear()}-${day.getMonth()+1}-${day.getDate()}`); for (const x of d) { tally[x.era] = (tally[x.era] || 0) + 1; n++; } }
const pct = e => (tally[e] || 0) / n;
console.log('era mix over 120 days:', Object.fromEntries(Object.entries(tally).map(([e, c]) => [e, (c / n * 100).toFixed(1) + '%'])));
assert(pct('newwave') + pct('opium') > 0.58 && pct('pluggnb') > 0.22 && pct('pluggnb') < 0.38, 'era mix off');
console.log('sample day:', pickDaily(all, '2026-11-14').map(x => x.prompt).join(' | '));
assert.equal(venueFor(5_000_000).name, 'Rolling Loud Main Stage');
assert.equal(showFor(700).name, 'Stadium Headliner');
console.log('all tests passed');
