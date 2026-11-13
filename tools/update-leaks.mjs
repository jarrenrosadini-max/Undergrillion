// Weekly leak updater. Reads public community tracker Google Sheets as CSV,
// adds NEW leak titles to site/data/leaks.json, and writes a PR summary.
// Never stores links or audio: only artist, title, era, status.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { normalize } from '../site/js/engine.js';

const root = new URL('..', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('tools/trackers.json', root)));
const dataPath = new URL('site/data/leaks.json', root);
const data = JSON.parse(readFileSync(dataPath));

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function cleanTitle(raw) {
  let s = String(raw).split('\n')[0];
  const status = /🏆/.test(s) ? 'grail' : /⭐/.test(s) ? 'bestof' : null;
  s = s.replace(/https?:\/\/\S+/g, '')
       .replace(/\((?:prod|feat|ft|with)[^)]*\)/gi, '')
       .replace(/\[(?:V\d+|\?)\]/gi, '')
       .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/gu, '')
       .replace(/\s+/g, ' ').trim();
  return { title: s, status };
}

const existing = new Set(data.leaks.map(l => normalize(l.a) + '|' + normalize(l.t)));
const added = [], skipped = [];

for (const t of cfg.trackers) {
  if (!t.sheetId) { skipped.push(`${t.artist} (no sheetId yet)`); continue; }
  const url = `https://docs.google.com/spreadsheets/d/${t.sheetId}/export?format=csv&gid=${t.gid || 0}`;
  let rows;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = parseCSV(await res.text());
  } catch (e) { skipped.push(`${t.artist} (${e.message})`); continue; }
  const hi = rows.findIndex(r => r.some(c => c.trim() === t.columns.title));
  if (hi < 0) { skipped.push(`${t.artist} (header "${t.columns.title}" not found)`); continue; }
  const header = rows[hi].map(c => c.trim());
  const ti = header.indexOf(t.columns.title), ei = header.indexOf(t.columns.era);
  for (const r of rows.slice(hi + 1)) {
    const { title, status } = cleanTitle(r[ti] || '');
    if (!title || title.length > 80) continue;
    const key = normalize(t.artist) + '|' + normalize(title);
    if (!normalize(title) || existing.has(key)) continue;
    existing.add(key);
    const era = ei >= 0 ? (r[ei] || '').split('\n')[0].replace(/\[.*?\]/g, '').trim() || null : null;
    const entry = { a: t.artist, t: title, e: era, new: true };
    if (status) entry.s = status;
    data.leaks.push(entry); added.push(entry);
  }
}

if (added.length) data.snapshotDate = new Date().toISOString().slice(0, 10);
writeFileSync(dataPath, JSON.stringify(data, null, 1) + '\n');

const md = [`## ${added.length} new leaks from the community trackers`, '',
  'Review before merging. New leaks score as **Vault** by default (grails/best-of as **Day One**). Delete any line that looks wrong or isn\'t really a leak.', '',
  ...added.slice(0, 300).map(l => `- **${l.a}**: ${l.t}${l.e ? ` _(${l.e})_` : ''}${l.s ? ` · ${l.s}` : ''}`),
  added.length > 300 ? `- …and ${added.length - 300} more` : '', '',
  skipped.length ? `Skipped: ${skipped.join(', ')}` : ''].join('\n');
writeFileSync(new URL('tools/.last-update.md', root), md);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `added=${added.length}\n`);
console.log(md);
