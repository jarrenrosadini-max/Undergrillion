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
  const add = (t, p = 0) => { const n = normalize(t); if (!n || n.length < 2) return; const e = map.get(n); if (!e) map.set(n, { t, p }); else if (p > e.p) e.p = p; };
  for (const q of questions) for (const a of q.answers) add(a.text, q.kind === 'n' ? 1 : 0);
  if (catalog) for (const ar of catalog.artists) { add(ar.n, 2); ar.rel.forEach(r => add(r[0])); ar.alb.forEach(r => add(r[0])); }
  return [...map.entries()].map(([n, e]) => ({ n, t: e.t, p: e.p, w: words(e.t) }));
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
    if (s >= 0) scored.push([s, -e.p, e.t.length, e.t]);
  }
  // exact/prefix first, then artist names, then shorter titles
  return scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).slice(0, limit).map(x => x[3]);
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
const an = name => (/^[aeiou8]/i.test(name) || /^(xxx|11|18)/i.test(name) ? 'an' : 'a');

// Tier from a popularity position: i = index in a list sorted most -> least popular.
// Default cuts spread a list across all 7 tiers so there is always an Elite Ball and a Day One.
export const CUTS7 = [0.03, 0.10, 0.22, 0.40, 0.62, 0.86];
export function tierByRank(i, n, cuts = CUTS7) {
  const p = n <= 1 ? 0 : i / n;
  for (let k = 0; k < cuts.length; k++) if (p < cuts[k]) return k + 1;
  return cuts.length + 1;
}

// Every prompt must have at least one Elite Ball (6) and one Day One (7).
// Curated answer lists run roughly common -> rare, so the last answers in the
// rarest group get promoted.
export function ensureTopTiers(q) {
  if (q.answers.length < 3) return q;
  const has = t => q.answers.some(a => a.tier === t);
  const promote = t => {
    const pool = q.answers.filter(a => a.tier < t && a.tier !== 7);
    if (!pool.length) return;
    const max = Math.max(...pool.map(a => a.tier));
    const group = pool.filter(a => a.tier === max);
    group[group.length - 1].tier = t;
  };
  if (!has(7)) promote(7);
  if (!has(6)) promote(6);
  return q;
}

// Broad pools. Older eras get only very broad prompts (any song / any project);
// current scenes also get year prompts.
const POOLS = {
  newwave: { scenes: ['newwave', 'oway'], label: 'any current underground artist', years: [2022, 2023, 2024, 2025, 2026] },
  oway: { scenes: ['oway'], label: 'any ØWAY member or affiliate', years: [] },
  opium: { scenes: ['opium'], label: 'any Opium / rage-era artist', years: [2021, 2022, 2023, 2024, 2025] },
  pluggnb: { scenes: ['pluggnb'], label: 'any plugg / pluggnb artist', years: [2018, 2019, 2020, 2021] },
  soundcloud: { scenes: ['soundcloud'], label: 'any SoundCloud-era rapper', years: [] },
  early: { scenes: ['early', 'drain'], label: 'any early-2010s internet rap artist', years: [] },
};
const OLD_ERAS = new Set(['early', 'soundcloud']);

// catalog: {artists:[{n, sc, al, f, p, alb:[[title,type,year]], rel:[[title,rank,albumIdx]], unr:[[title,era,status]]}]}
// solo: artist names big enough for their own "Name a ___ song" prompts. Everyone else
// only appears as an answer inside broader prompts.
export function buildCatalogQuestions(catalog, leakData, solo = []) {
  if (!catalog) return [];
  const out = [];
  const soloSet = new Set(solo.map(slug));
  const leakIdx = new Map();
  for (const l of leakData?.leaks || []) leakIdx.set(slug(l.a) + '|' + slug(l.t), l);
  const date = catalog.generated;
  const artists = catalog.artists.filter(a => !a.p);

  // ---- Solo prompts (bigger artists only) ----
  for (const ar of artists) {
    const id = slug(ar.n);
    if (!soloSet.has(id)) continue;
    const era = SCENE_ERA[ar.sc] || 'wildcard';
    if (OLD_ERAS.has(era)) continue; // older eras: broad prompts only
    const unr = ar.unr.map(([t, e, s]) => ({ t, e, s }));
    for (const l of leakData?.leaks || []) if (slug(l.a) === id && !unr.some(u => slug(u.t) === slug(l.t)) && !ar.rel.some(r => slug(r[0]) === slug(l.t))) unr.push({ t: l.t, e: l.e, s: l.s, al: l.al });
    const isGrail = u => { const c = leakIdx.get(id + '|' + slug(u.t)); return u.s === 'grail' || u.s === 'bestof' || c?.s === 'grail' || c?.s === 'bestof'; };
    const released = ar.rel.map(([t], i) => ({ text: t, tier: tierByRank(i, ar.rel.length, [0.04, 0.12, 0.25, 0.45, 0.7, 0.9]), aliases: [] }));
    const leaks = unr.map(u => ({ text: u.t, tier: isGrail(u) ? 7 : 6, aliases: u.al || leakIdx.get(id + '|' + slug(u.t))?.al || [] }));
    if (released.length >= 10) out.push({
      id: `songs-${id}`, era, kind: 't', src: 'solo', artist: ar.n,
      prompt: `Name ${an(ar.n)} ${ar.n} song`,
      fact: `${ar.n} has ${released.length} released songs in our catalog${leaks.length ? ` and ${leaks.length} known leaks (leaks score Elite Ball or Day One)` : ''}. Popularity as of ${date}.`,
      answers: [...released, ...leaks], whitelist: [],
    });
    if (leaks.length >= 25) {
      const ranked = leaks.map(l => ({ ...l, plays: leakIdx.get(id + '|' + slug(l.text))?.p || 0 }));
      const known = ranked.filter(l => l.plays).sort((a, b) => b.plays - a.plays);
      const rk = new Map(known.map((l, i) => [l.text, i]));
      out.push({
        id: `leaks-${id}`, era, kind: 't', src: 'solo', artist: ar.n, isLeak: true,
        prompt: `Name any unreleased ${ar.n} song`,
        fact: `Fans have catalogued ${leaks.length}+ unreleased ${ar.n} songs. Grails (the most-wanted leaks) are Day One. Snapshot ${date}.`,
        answers: ranked.map(l => ({ text: l.text, aliases: l.aliases, tier: l.tier === 7 ? 7 : rk.has(l.text) ? (rk.get(l.text) < 3 ? 3 : 4) : 6 })),
        whitelist: [],
      });
    }
    const projects = [];
    const seen = new Set();
    const score = new Map();
    ar.rel.forEach(([, rank, ai]) => score.set(ai, Math.max(score.get(ai) || 0, rank)));
    ar.alb.map((a, i) => ({ a, i })).filter(x => x.a[1] === 'album' || x.a[1] === 'ep')
      .sort((x, y) => (score.get(y.i) || 0) - (score.get(x.i) || 0))
      .forEach(x => { const k = slug(x.a[0]); if (!seen.has(k)) { seen.add(k); projects.push(x); } });
    if (projects.length >= 4) out.push({
      id: `projects-${id}`, era, kind: 't', src: 'solo', artist: ar.n,
      prompt: `Name ${an(ar.n)} ${ar.n} album or EP`,
      fact: `${ar.n} has ${projects.length} albums/EPs out.`,
      answers: projects.map((x, i) => ({ text: x.a[0], tier: tierByRank(i, projects.length), aliases: [] })),
      whitelist: [],
    });
  }

  // ---- Broad pools: everyone counts here ----
  const rankSongs = (pool, keep = () => true) => {
    const songs = new Map();
    for (const a of pool) a.rel.forEach(([t, rank, ai]) => {
      if (!keep(a.alb[ai])) return;
      const k = slug(t); const prev = songs.get(k);
      if (!prev || rank > prev.rank) songs.set(k, { t, rank, by: a.n });
    });
    return [...songs.values()].sort((x, y) => y.rank - x.rank);
  };
  const rankProjects = (pool, keep = () => true) => {
    const projects = new Map();
    for (const a of pool) {
      const best = new Map();
      a.rel.forEach(([, rank, ai]) => best.set(ai, Math.max(best.get(ai) || 0, rank)));
      a.alb.forEach((al, ai) => {
        if (!(al[1] === 'album' || al[1] === 'ep') || !keep(al)) return;
        const k = slug(al[0]); const r = best.get(ai) || 0; const prev = projects.get(k);
        if (!prev || r > prev.rank) projects.set(k, { t: al[0], rank: r, by: a.n });
      });
    }
    return [...projects.values()].sort((x, y) => y.rank - x.rank);
  };
  const toAnswers = list => list.map((x, i) => ({ text: x.t, tier: tierByRank(i, list.length), aliases: [], by: x.by }));

  for (const [key, cfg] of Object.entries(POOLS)) {
    const pool = artists.filter(a => cfg.scenes.includes(a.sc));
    if (pool.length < 3) continue;
    const era = key === 'oway' ? 'newwave' : SCENE_ERA[key];
    const songs = rankSongs(pool), projects = rankProjects(pool);
    if (songs.length >= 30) out.push({
      id: `any-songs-${key}`, era, kind: 't', src: 'pool',
      prompt: `Name a song by ${cfg.label}`,
      fact: `${songs.length.toLocaleString()} songs count here. The biggest: "${songs[0].t}" by ${songs[0].by}.`,
      answers: toAnswers(songs), whitelist: [],
    });
    if (projects.length >= 8) out.push({
      id: `any-projects-${key}`, era, kind: 't', src: 'pool',
      prompt: `Name an album or EP by ${cfg.label}`,
      fact: `${projects.length} projects count here. The biggest: ${projects[0].t} by ${projects[0].by}.`,
      answers: toAnswers(projects), whitelist: [],
    });
    for (const y of cfg.years) {
      const ys = String(y), inYear = al => al && al[2] === ys;
      const ySongs = rankSongs(pool, inYear), yProj = rankProjects(pool, inYear);
      if (ySongs.length >= 40) out.push({
        id: `year-songs-${key}-${ys}`, era, kind: 't', src: 'pool', year: y,
        prompt: `Name a song released in ${ys} by ${cfg.label}`,
        fact: `${ySongs.length} songs qualify. The biggest: "${ySongs[0].t}" by ${ySongs[0].by}.`,
        answers: toAnswers(ySongs), whitelist: [],
      });
      if (yProj.length >= 10) out.push({
        id: `year-projects-${key}-${ys}`, era, kind: 't', src: 'pool', year: y,
        prompt: `Name an album or EP that dropped in ${ys} by ${cfg.label}`,
        fact: `${yProj.length} projects qualify. The biggest: ${yProj[0].t} by ${yProj[0].by}.`,
        answers: toAnswers(yProj), whitelist: [],
      });
    }
  }
  return out;
}

export function finalizeQuestions(list) { return list.map(ensureTopTiers); }

// Era mix for both modes: ~65% current (new wave/ØWAY + some Opium), 30% plug,
// 4% SoundCloud era, 1% early 2010s. Each prompt slot draws an era by weight.
export const ERA_WEIGHTS = [['newwave', 0.55], ['opium', 0.10], ['pluggnb', 0.30], ['soundcloud', 0.04], ['early', 0.01]];
function drawEra(rand) {
  let x = rand();
  for (const [era, w] of ERA_WEIGHTS) { if ((x -= w) < 0) return era; }
  return 'newwave';
}
function pickOne(questions, rand, used, usedArtists) {
  const era = drawEra(rand);
  const ok = q => !used.has(q.id) && !(q.artist && usedArtists.has(q.artist));
  let pool = questions.filter(q => q.era === era && ok(q));
  if (pool.length > 1) { // alternate broad vs artist-specific for variety
    const wantSolo = rand() < 0.45;
    const pref = pool.filter(q => (q.src === 'solo') === wantSolo);
    if (pref.length) pool = pref;
  }
  if (!pool.length) pool = questions.filter(q => q.era === 'newwave' && ok(q));
  if (!pool.length) pool = questions.filter(ok);
  const q = pool[Math.floor(rand() * pool.length)];
  used.add(q.id); if (q.artist) usedArtists.add(q.artist);
  return q;
}
export function pickDaily(questions, dateStr) {
  const rand = rng(hashStr('undergrillion:' + dateStr));
  const used = new Set(), usedArtists = new Set();
  return Array.from({ length: 7 }, () => pickOne(questions, rand, used, usedArtists));
}
export function openMicQueue(questions, rand, n = 7) {
  const used = new Set(), usedArtists = new Set();
  return Array.from({ length: Math.min(n, questions.length) }, () => pickOne(questions, rand, used, usedArtists));
}

// "Did you mean" against the GLOBAL dictionary, so it never reveals validity.
export function dictCorrect(dict, input) {
  const q = normalize(input);
  if (!q || dict.some(e => e.n === q)) return null;
  const qw = words(input);
  let best = null;
  const consider = (e, score) => { if (!best || score < best.score || (score === best.score && (e.p > best.e.p || (e.p === best.e.p && e.t.length < best.e.t.length)))) best = { e, score }; };
  for (const e of dict) {
    const d = lev(q, e.n);
    if (d <= allowedEdits(e.n.length) && d <= Math.ceil(e.n.length * 0.25)) consider(e, d);
    else if (q.length >= 4 && e.n.startsWith(q) && q.length >= e.n.length * 0.55) consider(e, 3);
    if (e.p >= 1 && q.length >= 3 && qw.length === 1 && e.w.includes(qw[0])) consider(e, e.p === 2 ? 0.5 : 1.5);
  }
  return best ? best.e.t : null;
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
