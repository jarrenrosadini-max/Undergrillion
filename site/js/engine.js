// Pure game logic: no DOM. Imported by app.js and by tests (node).

export const TIERS = {
  1: { name: 'Common Ball', pts: 10, cls: 't1', emoji: '⚪' },
  2: { name: 'Playlist Pick', pts: 25, cls: 't2', emoji: '🔵' },
  3: { name: 'Heads Know', pts: 40, cls: 't3', emoji: '🟢' },
  4: { name: 'Deep Cut', pts: 60, cls: 't4', emoji: '🟣' },
  5: { name: 'Vault', pts: 80, cls: 't5', emoji: '🟠' },
  6: { name: 'Day One', pts: 100, cls: 't6', emoji: '🏆' },
  tu: { name: 'Too Underground', pts: 15, cls: 'ttu', emoji: '🩵' },
  wack: { name: 'Wack', pts: 0, cls: 'twack', emoji: '❌' },
};

export const FANS_PER_PT = 10;

export const VENUES = [
  { fans: 0, name: 'Bedroom', sub: 'First SoundCloud upload' },
  { fans: 1000, name: 'Group-Chat Premiere', sub: 'The homies are listening' },
  { fans: 5000, name: 'House Party', sub: 'Aux cord secured' },
  { fans: 15000, name: 'Open Mic', sub: 'Your first real stage' },
  { fans: 40000, name: 'Local Club', sub: '200 cap, sold out' },
  { fans: 100000, name: 'Warehouse Rave', sub: 'Pop-up, address in the DMs' },
  { fans: 250000, name: 'Small Theater', sub: '1,000 cap' },
  { fans: 600000, name: 'Theater Tour', sub: 'On the road' },
  { fans: 1500000, name: 'Festival Side Stage', sub: 'Mosh pits forming' },
  { fans: 5000000, name: 'Rolling Loud Main Stage', sub: 'You made it' },
  { fans: 15000000, name: 'Stadium Headliner', sub: 'Secret final venue' },
];

export function venueFor(fans) {
  let idx = 0;
  for (let i = 0; i < VENUES.length; i++) if (fans >= VENUES[i].fans) idx = i;
  return { idx, ...VENUES[idx], next: VENUES[idx + 1] || null };
}

// Daily "tonight's show" from a single day's points (max 700).
export function showFor(points) {
  const ladder = [0, 60, 140, 220, 300, 380, 450, 520, 590, 650, 700];
  let idx = 0;
  for (let i = 0; i < ladder.length; i++) if (points >= ladder[i]) idx = i;
  return VENUES[idx];
}

export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // ë -> e, ø stays
    .replace(/ø/g, 'o')
    .replace(/\$/g, 's')
    .replace(/&/g, 'and')
    .replace(/[0]/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// answers: [{text, tier, aliases[]}]. Returns {answer, tier} or null.
export function matchAnswer(input, answers, whitelist = []) {
  const q = normalize(input);
  if (!q) return null;
  let best = null, bestD = Infinity;
  for (const ans of answers) {
    for (const form of [ans.text, ...(ans.aliases || [])]) {
      const f = normalize(form);
      if (!f) continue;
      if (f === q) return { answer: ans, tier: ans.tier };
      // Strip a leading "the"/"lil" mismatch tolerance only through edit distance.
      const allowed = f.length > 6 ? 2 : f.length > 3 ? 1 : 0;
      const d = lev(q, f);
      if (d <= allowed && d < bestD) { best = ans; bestD = d; }
    }
  }
  if (best) return { answer: best, tier: best.tier };
  for (const w of whitelist) if (normalize(w) === q) return { answer: { text: w, tier: 'tu' }, tier: 'tu' };
  return null;
}

// Seeded RNG
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

// Turn compact JSON questions into full objects.
export function expandQuestions(raw) {
  return raw.map(q => ({
    id: q.id, era: q.era, prompt: q.p, fact: q.f || '', whitelist: q.w || [],
    answers: q.a.map(([text, tier, aliases]) => ({ text, tier, aliases: aliases || [] })),
  }));
}

// Build leak prompts from leaks.json.
export function buildLeakQuestions(leakData) {
  const { leaks, snapshotDate } = leakData;
  const byArtist = {};
  for (const l of leaks) (byArtist[l.a] ||= []).push(l);
  const tierFor = (l, rankMap) => {
    if (l.s === 'grail' || l.s === 'bestof') return 6;
    const r = rankMap.get(l);
    if (r !== undefined && r < 3) return 3;
    if (r !== undefined) return 4;
    return 5;
  };
  const out = [];
  for (const [artist, list] of Object.entries(byArtist)) {
    const ranked = list.filter(l => typeof l.p === 'number').sort((x, y) => y.p - x.p);
    const rankMap = new Map(ranked.map((l, i) => [l, i]));
    const toAns = l => ({ text: l.t, tier: tierFor(l, rankMap), aliases: l.al || [] });
    const slug = normalize(artist);
    if (list.length >= 6) {
      out.push({
        id: `leak-${slug}`, era: 'leaks', isLeak: true, snapshotDate,
        prompt: `Name an unreleased ${artist} song that leaked`,
        fact: `Leak data as of ${snapshotDate}. The most-played ${artist} leak in our snapshot: "${(ranked[0] || list[0]).t}".`,
        answers: list.map(toAns), whitelist: [],
      });
    }
    const grails = list.filter(l => l.s === 'grail' || l.s === 'bestof');
    if (grails.length >= 3) {
      out.push({
        id: `grail-${slug}`, era: 'leaks', isLeak: true, snapshotDate,
        prompt: `Name a ${artist} leak fans treat as a grail or a best-of`,
        fact: `Grails are the most-wanted songs on the community trackers. Snapshot ${snapshotDate}.`,
        answers: grails.map(l => ({ text: l.t, tier: 6, aliases: l.al || [] })),
        whitelist: [],
      });
    }
    const eras = {};
    for (const l of list) if (l.e && l.e !== 'Archive') (eras[l.e] ||= []).push(l);
    for (const [era, items] of Object.entries(eras)) {
      if (items.length < 4) continue;
      out.push({
        id: `era-${slug}-${normalize(era)}`, era: 'leaks', isLeak: true, snapshotDate,
        prompt: `Name a ${artist} leak from the ${era} era`,
        fact: `${artist}'s trackers file unreleased songs by era. Snapshot ${snapshotDate}.`,
        answers: items.map(toAns), whitelist: [],
      });
    }
  }
  return out;
}

// Daily 7: 2 pluggnb, 2 newwave, 1 opium, 1 early|soundcloud, 1 leaks|wildcard
export const DAILY_SLOTS = [['pluggnb'], ['newwave'], ['opium'], ['early', 'soundcloud'], ['pluggnb'], ['newwave'], ['leaks', 'wildcard']];

export function pickDaily(questions, dateStr) {
  const rand = rng(hashStr('undergrillion:' + dateStr));
  const used = new Set();
  const picks = [];
  for (const eras of DAILY_SLOTS) {
    const pool = shuffle(questions.filter(q => eras.includes(q.era) && !used.has(q.id)), rand);
    const q = pool[0] || shuffle(questions.filter(x => !used.has(x.id)), rand)[0];
    used.add(q.id); picks.push(q);
  }
  return picks;
}

export function rarestAnswers(q, n = 3) {
  return q.answers.slice().sort((a, b) => b.tier - a.tier).slice(0, n);
}

export function localDateStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
