import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { matchAnswer, expandQuestions, buildCatalogQuestions, buildDictionary, suggest, pickDaily, normalize, venueFor, showFor, TIERS } from '../site/js/engine.js';

const read = p => JSON.parse(readFileSync(new URL('../site/data/' + p, import.meta.url)));
const q = read('questions.json'), l = read('leaks.json');
const catPath = new URL('../site/data/catalog.json', import.meta.url);
const cat = existsSync(catPath) ? JSON.parse(readFileSync(catPath)) : null;
const curated = expandQuestions(q.questions);
const gen = buildCatalogQuestions(cat, l);
const all = [...curated, ...gen];

const ids = new Set();
for (const x of all) {
  assert(!ids.has(x.id), 'dup id ' + x.id); ids.add(x.id);
  assert(x.answers.length >= 3, 'too few answers ' + x.id);
  for (const a of x.answers) assert(TIERS[a.tier], `bad tier ${x.id} ${a.text} ${a.tier}`);
}
const byEra = all.reduce((m, x) => (m[x.era] = (m[x.era] || 0) + 1, m), {});
console.log('curated:', curated.length, 'catalog prompts:', gen.length, 'total:', all.length, byEra);
if (cat) console.log('catalog artists:', cat.artists.length, 'released:', cat.artists.reduce((s, a) => s + a.rel.length, 0), 'unreleased:', cat.artists.reduce((s, a) => s + a.unr.length, 0));

const find = id => all.find(x => x.id === id);
const m = (id, s) => { const x = find(id); return matchAnswer(s, x.answers, x.whitelist, x.kind); };
// exact + aliases
assert.equal(m('kashdami', 'reparations')?.tier, 1);
assert.equal(m('pluggnb-artists', 'KASHDAMI')?.answer.text, 'Ka$hdami');
assert.equal(m('pluggnb-artists', 'autumn')?.answer.text, 'Autumn!');
assert.equal(m('opium-artists', 'HXG')?.answer.text, 'Homixide Gang');
// auto-correct: short forms and typos snap only when close
assert.equal(m('sc-wave', 'carti')?.answer.text, 'Playboi Carti');
assert.equal(m('sc-wave', 'lil uzi')?.answer.text, 'Lil Uzi Vert');
assert.equal(m('sc-wave', 'xxxtentaction')?.answer.text, 'XXXTentacion');
assert.equal(m('sc-wave', 'ski mask')?.corrected, false);
assert.equal(m('sc-wave', 'lil')?.answer, undefined);            // too vague
assert.equal(m('slayworld', 'drake'), null);
assert.equal(m('ken-proj', 'Y'), null);
assert.equal(m('summrs-proj', 'bellworld 2')?.answer.text, '##Bellworld 2');
assert.equal(m('summrs-proj', 'bellworld')?.answer.text, '##Bellworld');
assert.equal(m('lonely-proj', '</3')?.answer.text, '</3');
// autocomplete is global, not per-question
const dict = buildDictionary(all, cat);
assert(suggest(dict, 'play').some(s => /Playboi Carti/.test(s)));

const d1 = pickDaily(all, '2026-11-13'), d2 = pickDaily(all, '2026-11-13');
assert.equal(d1.length, 7); assert.equal(new Set(d1.map(x => x.id)).size, 7);
assert.deepEqual(d1.map(x => x.id), d2.map(x => x.id));
console.log('daily:', d1.map(x => x.id).join(', '));
assert.equal(venueFor(5_000_000).name, 'Rolling Loud Main Stage');
assert.equal(showFor(700).name, 'Stadium Headliner');
console.log('all tests passed');
