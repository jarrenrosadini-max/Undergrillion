// Builds site/data/catalog.json: every roster artist's released discography
// (Deezer public API: albums, tracks, popularity rank, fan count) plus unreleased
// songs from community tracker sheets and fan-archive accounts.
// Runs in GitHub Actions (needs internet). Stores titles only — never links or audio.
import { readFileSync, writeFileSync } from 'node:fs';
import { normalize } from '../site/js/engine.js';

const root = new URL('..', import.meta.url);
const roster = JSON.parse(readFileSync(new URL('tools/roster.json', root)));
const overrides = (() => { try { return JSON.parse(readFileSync(new URL('tools/overrides.json', root))); } catch { return {}; } })();
const API = 'https://api.deezer.com';
const MAX_ALBUMS = 80, MAX_UNRELEASED = 600;

// ---- polite rate limit: <= 8 requests/second, retry on quota errors ----
let last = 0;
async function api(path, tries = 5) {
  const wait = Math.max(0, last + 130 - Date.now()); last = Date.now() + wait;
  if (wait) await new Promise(r => setTimeout(r, wait));
  try {
    const res = await fetch(API + path);
    const j = await res.json();
    if (j.error) { if (tries > 0 && j.error.code === 4) { await new Promise(r => setTimeout(r, 5000)); return api(path, tries - 1); } throw new Error(j.error.message); }
    return j;
  } catch (e) { if (tries > 0) { await new Promise(r => setTimeout(r, 2000)); return api(path, tries - 1); } throw e; }
}
async function all(path) {
  let out = [], url = path + (path.includes('?') ? '&' : '?') + 'limit=100';
  for (let i = 0; i < 10 && url; i++) {
    const j = await api(url.replace(API, ''));
    out = out.concat(j.data || []);
    url = j.next ? j.next.replace(API, '') : null;
  }
  return out;
}

const clean = t => String(t).replace(/\s*[([](?:feat|ft|with|prod)[^)\]]*[)\]]/gi, '').replace(/\s+/g, ' ').trim();

async function isRap(id) {
  // Deezer genre 116 = Rap/Hip Hop. Check up to 3 releases.
  try {
    const albums = (await api(`/artist/${id}/albums?limit=3`)).data || [];
    for (const al of albums) { const d = await api(`/album/${al.id}`); if ((d.genres?.data || []).some(g => g.id === 116) || d.genre_id === 116) return true; }
  } catch { /* ignore */ }
  return false;
}
async function findArtist(a) {
  if (overrides[a.name]?.deezerId) {
    const j = await api(`/artist/${overrides[a.name].deezerId}`);
    return { pick: j, alts: [] };
  }
  const names = [a.name, ...(a.aliases || [])].map(normalize);
  const res = await api(`/search/artist?q=${encodeURIComponent(a.name)}&limit=25`);
  const exact = (res.data || []).filter(x => names.includes(normalize(x.name))).sort((x, y) => y.nb_fan - x.nb_fan);
  if (!exact.length) return { pick: null, alts: (res.data || []).slice(0, 5) };
  const cands = exact.slice(0, 5);
  if (a.hint) for (const cand of cands) {
    const top = await api(`/artist/${cand.id}/top?limit=50`);
    if ((top.data || []).some(t => normalize(t.title).includes(normalize(a.hint)))) return { pick: cand, alts: exact.filter(x => x !== cand).slice(0, 3) };
  }
  if (a.producer) return { pick: cands[0], alts: exact.slice(1, 4) };
  for (const cand of cands) if (await isRap(cand.id)) return { pick: cand, alts: exact.filter(x => x !== cand).slice(0, 3), unsure: cand !== cands[0] ? 'picked rap-tagged artist over bigger namesake' : false };
  if (cands.length === 1) return { pick: cands[0], alts: [], unsure: 'only match, not rap-tagged' };
  return { pick: null, alts: cands, unsure: 'no rap-tagged match' };
}

async function discography(id) {
  const albums = (await all(`/artist/${id}/albums`)).filter(al => al.record_type !== 'compile').slice(0, MAX_ALBUMS);
  const alb = [], tracks = new Map();
  for (const al of albums) {
    const idx = alb.push([clean(al.title), al.record_type, (al.release_date || '').slice(0, 4)]) - 1;
    let tr = [];
    try { tr = (await api(`/album/${al.id}/tracks?limit=300`)).data || []; } catch { continue; }
    for (const t of tr) {
      const title = clean(t.title_short || t.title);
      const key = normalize(title);
      if (!key) continue;
      const prev = tracks.get(key);
      if (!prev || (t.rank || 0) > prev[1]) tracks.set(key, [title, t.rank || 0, idx]);
    }
  }
  return { alb, rel: [...tracks.values()].sort((x, y) => y[1] - x[1]) };
}

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const BAD = /^(\?+|unknown|untitled|n\/a|tba|tbd|name|song)$/i;
function cleanLeak(raw, artistNames) {
  let s = String(raw).split('\n')[0];
  const status = /🏆/.test(s) ? 'grail' : /⭐/.test(s) ? 'bestof' : /✨|🥇/.test(s) ? 'wanted' : null;
  s = s.replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2728}]/gu, '')
    .replace(/\s*\[(?:V\d+|\?|.*?(?:edit|snippet|og|demo|alt|version|mix).*?)\]/gi, '')
    .replace(/\s*\((?:feat|ft|with|prod|ref|w\/)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ').trim();
  const m = s.match(/^(.{1,30}?)\s+-\s+(.+)$/);  // "Artist - Title"
  if (m) s = m[2].trim();
  for (const n of artistNames) if (normalize(s).startsWith(normalize(n)) && normalize(s) !== normalize(n)) { /* keep */ }
  if (!s || BAD.test(s) || s.length > 70) return null;
  return { t: s, s: status };
}

async function fetchSheet(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error('not public');
  return parseCSV(text);
}
const headerRow = rows => rows.findIndex(r => r.some(c => /^name/i.test(c.trim())) && r.some(c => /^era/i.test(c.trim())));
async function trackerLeaks(sheetId, artistNames) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  const tries = [`${base}/export?format=csv`, ...['Unreleased', 'Unreleased Songs', 'Main', 'Tracker', 'Songs'].map(n => `${base}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(n)}`), `${base}/gviz/tq?tqx=out:csv`];
  let rows = null, hi = -1, lastErr = 'no Era/Name header';
  for (const u of tries) {
    try { const r = await fetchSheet(u); const h = headerRow(r); if (h >= 0) { rows = r; hi = h; break; } } catch (e) { lastErr = e.message; }
  }
  if (!rows) throw new Error(lastErr);
  const h = rows[hi].map(c => c.trim().toLowerCase());
  const ni = h.findIndex(c => c.startsWith('name')), ei = h.findIndex(c => c.startsWith('era'));
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const lk = cleanLeak(r[ni] || '', artistNames);
    if (!lk) continue;
    const era = (r[ei] || '').split('\n')[0].replace(/\[.*?\]/g, '').trim();
    out.push([lk.t, era && era.length < 40 ? era : null, lk.s]);
  }
  return out;
}

async function archiveTracks(name) {
  const res = await api(`/search/artist?q=${encodeURIComponent(name)}&limit=10`);
  const hit = (res.data || []).find(x => normalize(x.name) === normalize(name));
  if (!hit) return [];
  const { rel } = await discography(hit.id);
  return rel.map(([t]) => t);
}

// ---- main ----
const report = ['# Catalog build report', '', `Generated ${new Date().toISOString()}`, '', '| Artist | Matched | Fans | Albums | Released | Unreleased | Notes |', '|---|---|---|---|---|---|---|'];
const out = [];
const allNames = roster.artists.flatMap(a => [a.name, ...(a.aliases || [])]);

for (const a of roster.artists) {
  const entry = { n: a.name, sc: a.scene, al: a.aliases || [], f: 0, p: !!a.producer, alb: [], rel: [], unr: [] };
  const notes = [];
  try {
    const { pick, alts, unsure } = await findArtist(a);
    if (pick) {
      entry.f = pick.nb_fan || 0; entry.id = pick.id;
      if (!a.producer) Object.assign(entry, await discography(pick.id));
      if (unsure) notes.push(unsure);
      if (alts.length) notes.push('also: ' + alts.map(x => `${x.name}#${x.id}(${x.nb_fan})`).join(', '));
      notes.push('top: ' + entry.rel.slice(0, 3).map(r => r[0]).join(' / '));
    } else notes.push('NOT FOUND (pin it in overrides.json). candidates: ' + alts.map(x => `${x.name}#${x.id}(${x.nb_fan})`).join(', '));
  } catch (e) { notes.push('deezer error: ' + e.message); }

  const released = new Set(entry.rel.map(r => normalize(r[0])));
  const seen = new Set();
  const addUnr = (t, era, s) => {
    const k = normalize(t);
    if (!k || released.has(k) || seen.has(k)) return;
    seen.add(k); entry.unr.push([t, era || null, s || null]);
  };
  if (a.sheet) {
    try { for (const [t, era, s] of await trackerLeaks(a.sheet, allNames)) addUnr(t, era, s); }
    catch (e) { notes.push('tracker: ' + e.message); }
  }
  for (const arc of a.archives || []) {
    try { const ts = await archiveTracks(arc); ts.forEach(t => addUnr(t.replace(new RegExp('^' + a.name + '\\s*-\\s*', 'i'), ''), 'Archive', null)); if (ts.length) notes.push(`${arc}: ${ts.length}`); }
    catch (e) { notes.push(`${arc}: ${e.message}`); }
  }
  entry.unr = entry.unr.slice(0, MAX_UNRELEASED);
  out.push(entry);
  report.push(`| ${a.name} | ${entry.id ? '#' + entry.id : '—'} | ${entry.f} | ${entry.alb.length} | ${entry.rel.length} | ${entry.unr.length} | ${notes.join('; ')} |`);
  console.log(a.name, entry.f, entry.rel.length, entry.unr.length, notes.join('; '));
}

// Generic leak archives ("Artist - Title" uploads)
for (const arc of roster.leakArchives || []) {
  try {
    const ts = await archiveTracks(arc);
    let n = 0;
    for (const raw of ts) {
      const m = raw.match(/^(.+?)\s+-\s+(.+)$/); if (!m) continue;
      const art = out.find(e => [e.n, ...e.al].some(x => normalize(x) === normalize(m[1])));
      if (!art) continue;
      const k = normalize(m[2]);
      if (!art.rel.some(r => normalize(r[0]) === k) && !art.unr.some(r => normalize(r[0]) === k)) { art.unr.push([clean(m[2]), arc, null]); n++; }
    }
    report.push('', `Leak archive "${arc}": ${ts.length} uploads, ${n} matched to roster artists.`);
  } catch (e) { report.push('', `Leak archive "${arc}": ${e.message}`); }
}

writeFileSync(new URL('site/data/catalog.json', root), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), artists: out }));
writeFileSync(new URL('tools/catalog-report.md', root), report.join('\n') + '\n');
const tot = out.reduce((s, e) => [s[0] + e.rel.length, s[1] + e.unr.length], [0, 0]);
console.log(`DONE ${out.length} artists, ${tot[0]} released tracks, ${tot[1]} unreleased`);
