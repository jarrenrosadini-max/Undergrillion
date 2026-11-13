// Pure game logic: no DOM. Imported by app.js, tests (node) and tools.

export const TIERS = {
  1: { name: 'Mainstream', pts: 5, cls: 't1', emoji: '⚪' },
  2: { name: 'Common Ball', pts: 10, cls: 't2', emoji: '🔵' },
  3: { name: 'Rare', pts: 25, cls: 't3', emoji: '🟢' },
  4: { name: 'Niche', pts: 40, cls: 't4', emoji: '🟣' },
  5: { name: 'Tapped In', pts: 60, cls: 't5', emoji: '🟠' },
  6: { name: 'Elite Ball', pts: 80, cls: 't6', emoji: '🔴' },
  7: { name: 'Day One', pts: 100, cls: 't7', emoji: '🏆' },
  tu: { name: 'Too Underground', pts: 15, cls: 'ttu', emoji: '🩵' },
  wack: { name: 'Wack', pts: 0, cls: 'twack', emoji: '❌' },
};
export const TIER_ORDER = [1, 2, 3, 4, 5, 6, 7];
export const FANS_PER_PT = 10;

export const VENUES = [
  { fans: 0, name: 'Bedroom', sub: 'First SoundCloud upload', scene: 'bedroom' },
  { fans: 1000, name: 'Group-Chat Premiere', sub: 'The homies are listening', scene: 'groupchat' },
  { fans: 5000, name: 'House Party', sub: 'Aux cord secured', scene: 'houseparty' },
  { fans: 15000, name: 'Open Mic', sub: 'Your first real stage', scene: 'openmic' },
  { fans: 40000, name: 'Local Club', sub: '200 cap, sold out', scene: 'club' },
  { fans: 100000, name: 'Warehouse Rave', sub: 'Address in the DMs', scene: 'warehouse' },
  { fans: 250000, name: 'Small Theater', sub: '1,000 cap', scene: 'theater' },
  { fans: 600000, name: 'Theater Tour', sub: 'On the road', scene: 'tour' },
  { fans: 1500000, name: 'Festival Side Stage', sub: 'Mosh pits forming', scene: 'festival' },
  { fans: 5000000, name: 'Rolling Loud Main Stage', sub: 'You made it', scene: 'mainstage' },
  { fans: 15000000, name: 'Stadium Headliner', sub: 'Secret final venue', scene: 'stadium' },
];

export function venueFor(fans) {
  let idx = 0;
  for (let i = 0; i < VENUES.length; i++) if (fans >= VENUES[i].fans) idx = i;
  return { idx, ...VENUES[idx], next: VENUES[idx + 1] || null };
}
export function showFor(points) {
  const ladder = [0, 60, 130, 200, 270, 340, 410, 480, 550, 620, 680];
  let idx = 0;
  for (let i = 0; i < ladder.length; i++) if (points >= ladder[i]) idx = i;
  return VENUES[idx];
}

// ---------- Matching ----------
export function normalize(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o').replace(/\$/g, 's').replace(/&/g, 'and').replace(/0/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}
const STOP = new Set(['lil', 'yung', 'young', 'the', 'a', 'an', 'of', 'and', 'big', 'baby', 'king', 'mc', 'dj', 'da', 'my', 'me', 'i', 'you', 'it', 'in', 'on', 'to']);
export function words(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\$/g, 's').replace(/0/g, 'o')
    .split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w));
}
export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function allowedEdits(len) { return len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3; }

// kind: 'n' = names (artists/people/crews), anything else = titles.
// Returns {answer, tier, corrected} or null. Auto-correction only snaps when the
// input is close to exactly ONE answer, so it never guesses between two.
export function matchAnswer(input, answers, whitelist = [], kind = 't') {
  const q = normalize(input);
  if (!q) return null;
  const forms = a => [a.text, ...(a.aliases || [])];
  for (const a of answers) for (const f of forms(a)) if (normalize(f) === q) return { answer: a, tier: a.tier, corrected: false };

  // 1) typo: small edit distance relative to length
  let best = [], bestD = Infinity;
  for (const a of answers) for (const f of forms(a)) {
    const n = normalize(f); if (!n) continue;
    const d = lev(q, n);
    if (d <= allowedEdits(n.length) && d <= Math.ceil(n.length * 0.25)) {
      if (d < bestD) { best = [a]; bestD = d; } else if (d === bestD && !best.includes(a)) best.push(a);
    }
  }
  if (best.length === 1) return { answer: best[0], tier: best[0].tier, corrected: true };

  // 2) shortened form: "lil uzi" -> Lil Uzi Vert
  const uniq = list => { const s = [...new Set(list)]; return s.length === 1 ? s[0] : null; };
  if (q.length >= 4) {
    const pre = uniq(answers.filter(a => forms(a).some(f => { const n = normalize(f); return n.startsWith(q) && q.length >= n.length * 0.55; })));
    if (pre) return { answer: pre, tier: pre.tier, corrected: true };
  }
  // 3) names only: a distinctive word on its own ("carti", "uzi", "kenny")
  if (kind === 'n' && q.length >= 3) {
    const w = uniq(answers.filter(a => forms(a).some(f => words(f).some(x => x === q || (x.length >= 5 && lev(x, q) <= 1)))));
    if (w) return { answer: w, tier: w.tier, corrected: true };
  }
  for (const w of whitelist) if (normalize(w) === q) return { answer: { text: w, tier: 'tu' }, tier: 'tu', corrected: false };
  return null;
}

// Autocomplete over a GLOBAL dictionary (every name/title in the game), so
// suggestions never reveal which answers are valid for the current prompt.
export function buildDictionary(questions, catalog) {
  const map = new Map();
  const add = t => { const n = normalize(t); if (n && n.length > 1 && !map.has(n)) map.set(n, t); };
  for (const q of questions) for (const a of q.answers) add(a.text);
  if (catalog) for (const ar of catalog.artists) { add(ar.n); ar.rel.forEach(r => add(r[0])); ar.alb.forEach(r => add(r[0])); }
  return [...map.entries()].map(([n, t]) => ({ n, t, w: words(t) }));
}
export function suggest(dict, input, limit = 6) {
  const q = normalize(input);
  if (q.length < 2) return [];
  const qw = words(input);
  const scored = [];
  for (const e of dict) {
    let s = -1;
    if (e.n === q) s = 0;
    else if (e.n.startsWith(q)) s = 1;
    else if (qw.length && qw.every(w => e.w.some(x => x.startsWith(w)))) s = 2;
    else if (q.length >= 4 && e.n.includes(q)) s = 3;
    if (s >= 0) scored.push([s, e.t.length, e.t]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, limit).map(x => x[2]);
}

// ---------- RNG ----------
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Question building ----------
export function expandQuestions(raw) {
  return raw.map(q => ({
    id: q.id, era: q.era, prompt: q.p, fact: q.f || '', whitelist: q.w || [], kind: q.k || 't', src: 'curated',
    answers: q.a.map(([text, tier, aliases]) => ({ text, tier, aliases: aliases || [] })),
  }));
}

const SCENE_ERA = { early: 'early', drain: 'early', soundcloud: 'soundcloud', pluggnb: 'pluggnb', opium: 'opium', newwave: 'newwave', oway: 'newwave', producer: 'wildcard' };
const SCENE_LABEL = { early: 'an early-2010s internet rap', drain: 'a Drain Gang / Sad Boys', soundcloud: 'a SoundCloud-era', pluggnb: 'a plugg / pluggnb', opium: 'an Opium / rage-era', newwave: 'a current underground', oway: 'a ØWAY' };
const slug = s => normalize(s) || 'x';

// Tier from a popularity position: i = index in a list sorted most -> least popular.
export function tierByRank(i, n, cuts = [0.04, 0.12, 0.25, 0.45]) {
  const p = n <= 1 ? 0 : i / n;
  for (let k = 0; k < cuts.length; k++) if (p < cuts[k]) return k + 1;
  return cuts.length + 1;
}

// catalog: {artists:[{n, sc, al, f, p, alb:[[title,type,year]], rel:[[title,rank,albumIdx]], unr:[[title,era,status]]}]}
// leakData: curated leaks.json, used to add play counts / grail flags.
export function buildCatalogQuestions(catalog, leakData) {
  if (!catalog) return [];
  const out = [];
  const leakIdx = new Map();
  for (const l of leakData?.leaks || []) leakIdx.set(slug(l.a) + '|' + slug(l.t), l);
  const date = catalog.generated;

  for (const ar of catalog.artists) {
    if (ar.p) continue;
    const era = SCENE_ERA[ar.sc] || 'wildcard';
    const id = slug(ar.n);
    const unr = ar.unr.map(([t, e, s]) => ({ t, e, s }));
    for (const l of leakData?.leaks || []) if (slug(l.a) === id && !unr.some(u => slug(u.t) === slug(l.t)) && !ar.rel.some(r => slug(r[0]) === slug(l.t))) unr.push({ t: l.t, e: l.e, s: l.s, al: l.al });
    const isGrail = u => { const c = leakIdx.get(id + '|' + slug(u.t)); return u.s === 'grail' || u.s === 'bestof' || c?.s === 'grail' || c?.s === 'bestof'; };

    const released = ar.rel.map(([t], i) => ({ text: t, tier: tierByRank(i, ar.rel.length), aliases: [] }));
    const leaks = unr.map(u => ({ text: u.t, tier: isGrail(u) ? 7 : 6, aliases: u.al || leakIdx.get(id + '|' + slug(u.t))?.al || [] }));

    if (released.length >= 10) {
      out.push({
        id: `songs-${id}`, era, kind: 't', src: 'catalog', artist: ar.n,
        prompt: `Name a ${ar.n} song`,
        fact: `${ar.n} has ${released.length} released songs in our catalog${leaks.length ? ` and ${leaks.length} known unreleased ones (leaks count as Elite Ball)` : ''}. Popularity data as of ${date}.`,
        answers: [...released, ...leaks], whitelist: [],
      });
    }
    if (leaks.length >= 12) {
      const known = leaks.map(l => ({ ...l, plays: leakIdx.get(id + '|' + slug(l.text))?.p || 0 }));
      const ranked = known.filter(l => l.plays).sort((a, b) => b.plays - a.plays);
      const rk = new Map(ranked.map((l, i) => [l.text, i]));
      out.push({
        id: `leaks-${id}`, era: 'leaks', kind: 't', src: 'catalog', artist: ar.n, isLeak: true,
        prompt: `Name an unreleased ${ar.n} song (any leak counts)`,
        fact: `Fans have catalogued ${leaks.length}+ unreleased ${ar.n} songs. Grails, the most-wanted leaks, score Day One. Snapshot ${date}.`,
        answers: known.map(l => ({ text: l.text, aliases: l.aliases, tier: l.tier === 7 ? 7 : rk.has(l.text) ? (rk.get(l.text) < 3 ? 3 : 4) : 5 })),
        whitelist: [],
      });
    }
    const projects = ar.alb.map((a, i) => ({ a, i })).filter(x => x.a[1] === 'album' || x.a[1] === 'ep');
    if (projects.length >= 3) {
      const score = new Map();
      ar.rel.forEach(([, rank, ai]) => score.set(ai, Math.max(score.get(ai) || 0, rank)));
      projects.sort((x, y) => (score.get(y.i) || 0) - (score.get(x.i) || 0));
      const seen = new Set();
      const uniqProjects = projects.filter(x => { const k = slug(x.a[0]); if (seen.has(k)) return false; seen.add(k); return true; });
      out.push({
        id: `projects-${id}`, era, kind: 't', src: 'catalog', artist: ar.n,
        prompt: `Name a ${ar.n} album or EP`,
        fact: `${ar.n} has ${uniqProjects.length} albums/EPs out.`,
        answers: uniqProjects.map((x, i) => ({ text: x.a[0], tier: tierByRank(i, uniqProjects.length, [0.15, 0.35, 0.55, 0.75]), aliases: [] })),
        whitelist: [],
      });
    }
  }

  const byScene = {};
  for (const ar of catalog.artists) if (!ar.p) (byScene[ar.sc] ||= []).push(ar);
  for (const [sc, list] of Object.entries(byScene)) {
    if (list.length < 5 || !SCENE_LABEL[sc]) continue;
    list.sort((a, b) => b.f - a.f);
    out.push({
      id: `scene-${sc}`, era: SCENE_ERA[sc], kind: 'n', src: 'catalog',
      prompt: `Name ${SCENE_LABEL[sc]} artist`,
      fact: `Rarity here follows each artist's fan count. The biggest name in this pool is ${list[0].n}.`,
      answers: list.map((ar, i) => ({ text: ar.n, aliases: ar.al, tier: tierByRank(i, list.length, [0.1, 0.25, 0.45, 0.65, 0.85]) })),
      whitelist: [],
    });
  }
  return out;
}

// Daily 7: 2 pluggnb, 2 newwave, 1 opium, 1 early|soundcloud, 1 leaks|wildcard.
// Alternates curated and catalog prompts so a day isn't all "name a song".
export const DAILY_SLOTS = [['pluggnb'], ['newwave'], ['opium'], ['early', 'soundcloud'], ['pluggnb'], ['newwave'], ['leaks', 'wildcard']];
export function pickDaily(questions, dateStr) {
  const rand = rng(hashStr('undergrillion:' + dateStr));
  const used = new Set(), usedArtists = new Set(), picks = [];
  DAILY_SLOTS.forEach((eras, si) => {
    const wantCurated = si % 2 === 0;
    let pool = questions.filter(q => eras.includes(q.era) && !used.has(q.id) && !(q.artist && usedArtists.has(q.artist)));
    const pref = pool.filter(q => (q.src === 'curated') === wantCurated);
    if (pref.length) pool = pref;
    const q = shuffle(pool, rand)[0] || shuffle(questions.filter(x => !used.has(x.id)), rand)[0];
    used.add(q.id); if (q.artist) usedArtists.add(q.artist); picks.push(q);
  });
  return picks;
}

export function rarestAnswers(q, n = 3) { return q.answers.slice().sort((a, b) => b.tier - a.tier).slice(0, n); }
export function topAnswers(q, n = 5) { return q.answers.slice().sort((a, b) => a.tier - b.tier).slice(0, n); }
export function tierSpread(q) {
  const c = Object.fromEntries(TIER_ORDER.map(t => [t, 0]));
  for (const a of q.answers) if (c[a.tier] !== undefined) c[a.tier]++;
  return c;
}

export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
