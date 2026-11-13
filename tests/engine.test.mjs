import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { matchAnswer, expandQuestions, buildLeakQuestions, pickDaily, normalize, venueFor, showFor } from '../site/js/engine.js';

const q = JSON.parse(readFileSync(new URL('../site/data/questions.json', import.meta.url)));
const l = JSON.parse(readFileSync(new URL('../site/data/leaks.json', import.meta.url)));
const qs = expandQuestions(q.questions);
const leaks = buildLeakQuestions(l);
const all = [...qs, ...leaks];

// Data integrity
const ids = new Set();
for (const x of all) {
  assert(!ids.has(x.id), 'dup id ' + x.id); ids.add(x.id);
  assert(x.answers.length >= 3, 'too few answers ' + x.id);
  for (const a of x.answers) assert([1,2,3,4,5,6].includes(a.tier), `bad tier ${x.id} ${a.text}`);
  const norms = new Map();
  for (const a of x.answers) { const n = normalize(a.text); if (norms.has(n) && norms.get(n) !== a.tier) console.warn('WARN same answer diff tier', x.id, a.text); norms.set(n, a.tier); }
}
const byEra = all.reduce((m, x) => (m[x.era] = (m[x.era] || 0) + 1, m), {});
console.log('questions:', qs.length, 'leak prompts:', leaks.length, 'total:', all.length, byEra);

const find = id => all.find(x => x.id === id);
const m = (id, s) => matchAnswer(s, find(id).answers, find(id).whitelist);
assert.equal(m('kashdami', 'Kashdami reparations')?.answer.text, undefined); // not a song name
assert.equal(m('kashdami', 'reparations')?.tier, 1);
assert.equal(m('pluggnb-artists', 'KASHDAMI')?.answer.text, 'Ka$hdami');
assert.equal(m('pluggnb-artists', 'autumn')?.answer.text, 'Autumn!');
assert.equal(m('opium-artists', 'ken car$on')?.answer.text, 'Ken Carson');
assert.equal(m('opium-artists', 'HXG')?.answer.text, 'Homixide Gang');
assert.equal(m('osama-proj', 'psykotic')?.tier, 2);
assert.equal(m('summrs-proj', 'bellworld 2')?.answer.text, '##Bellworld 2');
assert.equal(m('summrs-proj', 'bellworld')?.answer.text, '##Bellworld');
assert.equal(m('sc-wave', 'xxxtentaction')?.answer.text, 'XXXTentacion'); // typo
assert.equal(m('ken-proj', 'Y'), null);
assert.equal(m('slayworld', 'drake'), null);
assert.equal(m('leak-osamason', 'sped klass')?.tier, 6);
assert.equal(m('leak-destroylonely', 'the date')?.tier, 3);
assert.equal(m('leak-destroylonely', 'suicide mission')?.tier, 5);

// Daily: 7 unique, deterministic, era mix
const d1 = pickDaily(all, '2026-11-13'), d2 = pickDaily(all, '2026-11-13'), d3 = pickDaily(all, '2026-11-14');
assert.equal(d1.length, 7); assert.equal(new Set(d1.map(x => x.id)).size, 7);
assert.deepEqual(d1.map(x => x.id), d2.map(x => x.id));
assert.notDeepEqual(d1.map(x => x.id), d3.map(x => x.id));
console.log('daily 11-13:', d1.map(x => `${x.era}:${x.id}`).join(', '));

assert.equal(venueFor(0).name, 'Bedroom');
assert.equal(venueFor(5_000_000).name, 'Rolling Loud Main Stage');
assert.equal(showFor(700).name, 'Stadium Headliner');
console.log('all tests passed');
