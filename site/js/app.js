import { CONFIG } from './config.js';
import {
  TIERS, FANS_PER_PT, venueFor, showFor, matchAnswer, expandQuestions, buildLeakQuestions,
  pickDaily, rarestAnswers, localDateStr, fmt, rng, shuffle,
} from './engine.js';

const $ = id => document.getElementById(id);
const STORE_KEY = 'undergrillion:v1';
const ERA_LABEL = { early: 'EARLY 2010s', soundcloud: 'SOUNDCLOUD ERA', pluggnb: 'PLUGGNB', opium: 'OPIUM / RAGE', newwave: 'NEW WAVE', leaks: 'LEAKS', wildcard: 'WILDCARD' };

// ---------- State ----------
const store = load();
function load() {
  try { return { fans: 0, streak: 0, lastDailyDone: null, best: 0, daily: {}, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
  catch { return { fans: 0, streak: 0, lastDailyDone: null, best: 0, daily: {} }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ } }

let ALL = [];
let mode = 'daily';
let today = localDateStr();
let queue = [];          // questions for current run
let qi = 0;              // index in queue
let attemptsLeft = CONFIG.ATTEMPTS;
let timer = null, deadline = 0, totalMs = 0;
let answering = false;
let omCount = 0, omEra = 'all', omRand = rng(Date.now());
let shownFans = store.fans;

// ---------- Boot ----------
init();
async function init() {
  if (CONFIG.ADS_ENABLED) document.body.classList.add('ads-on');
  try {
    const [qRes, lRes] = await Promise.all([fetch('data/questions.json'), fetch('data/leaks.json')]);
    const qData = await qRes.json(), lData = await lRes.json();
    ALL = [...expandQuestions(qData.questions), ...buildLeakQuestions(lData)];
  } catch (e) {
    $('prompt').textContent = 'Could not load the question crates. Refresh to try again.';
    console.error(e); return;
  }
  bindUI();
  renderTop(false);
  renderCrowd();
  if (!localStorage.getItem(STORE_KEY)) openHelp();
  startDaily();
  setInterval(tickCountdown, 1000);
}

function bindUI() {
  $('answer-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  $('answer').addEventListener('input', () => $('mic').classList.toggle('live', $('answer').value.length > 0));
  $('btn-next').addEventListener('click', next);
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c));
    omEra = c.dataset.era; startOpenMic();
  }));
  $('om-timer').addEventListener('change', () => { if (answering) restartTimer(); });
  $('btn-help').addEventListener('click', openHelp);
  $('btn-help-close').addEventListener('click', () => $('help').classList.add('hidden'));
  $('btn-vu').addEventListener('click', () => $('venue-up').classList.add('hidden'));
  $('btn-share').addEventListener('click', share);
  $('btn-to-openmic').addEventListener('click', () => switchMode('openmic'));
  $('btn-inter-close').addEventListener('click', () => { $('interstitial').classList.add('hidden'); });
  $('btn-reset').addEventListener('click', e => {
    e.preventDefault();
    if (confirmReset()) { localStorage.removeItem(STORE_KEY); location.reload(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !$('result').classList.contains('hidden') && document.activeElement !== $('answer')) next();
  });
}
function confirmReset() { return window.confirm('Reset all fans, streaks and daily progress?'); }
function openHelp() { $('help').classList.remove('hidden'); }

// ---------- Modes ----------
function switchMode(m) {
  mode = m;
  document.querySelectorAll('.mode').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  $('era-filter').classList.toggle('hidden', m !== 'openmic');
  stopTimer();
  m === 'daily' ? startDaily() : startOpenMic();
}

function dailyRecord() { return (store.daily[today] ||= { results: [], done: false }); }

function startDaily() {
  today = localDateStr();
  queue = pickDaily(ALL, today);
  const rec = dailyRecord();
  if (rec.done) return showEnd();
  qi = rec.results.length;
  showStage();
  ask();
}

function startOpenMic() {
  const pool = ALL.filter(q => omEra === 'all' || q.era === omEra);
  queue = shuffle(pool, omRand);
  qi = 0;
  showStage();
  ask();
}

function showStage() {
  $('end').classList.add('hidden');
  $('stage').classList.remove('hidden');
}

// ---------- Question flow ----------
function current() { return queue[qi]; }

function ask() {
  const q = current();
  if (!q) return mode === 'daily' ? finishDaily() : startOpenMic();
  answering = true;
  attemptsLeft = CONFIG.ATTEMPTS;
  setTier(null);
  $('card').classList.remove('hidden');
  $('result').classList.add('hidden');
  $('q-count').textContent = mode === 'daily' ? `${qi + 1} / ${queue.length}` : `OPEN MIC · #${omCount + 1}`;
  $('era-tag').textContent = ERA_LABEL[q.era] || q.era.toUpperCase();
  $('prompt').textContent = q.prompt;
  $('feedback').textContent = '';
  $('answer').value = '';
  $('answer').disabled = false;
  $('btn-submit').disabled = false;
  $('mic').classList.remove('live');
  renderAttempts();
  restartTimer();
  setTimeout(() => $('answer').focus({ preventScroll: true }), 50);
}

function renderAttempts() {
  $('attempts').innerHTML = Array.from({ length: CONFIG.ATTEMPTS }, (_, i) => `<i class="${i >= attemptsLeft ? 'used' : ''}"></i>`).join('');
}

function timerOn() { return mode === 'daily' || $('om-timer').checked; }

function restartTimer() {
  stopTimer();
  const fill = $('timer-fill');
  if (!timerOn()) { fill.style.transform = 'scaleX(1)'; fill.classList.remove('low'); return; }
  totalMs = CONFIG.DAILY_SECONDS * 1000;
  deadline = performance.now() + totalMs;
  const tick = () => {
    const left = deadline - performance.now();
    const frac = Math.max(0, left / totalMs);
    fill.style.transform = `scaleX(${frac})`;
    fill.classList.toggle('low', frac < 0.25);
    if (left <= 0) { stopTimer(); resolve(null, true); return; }
    timer = requestAnimationFrame(tick);
  };
  timer = requestAnimationFrame(tick);
}
function stopTimer() { if (timer) cancelAnimationFrame(timer); timer = null; }

function submit() {
  if (!answering) return;
  const val = $('answer').value.trim();
  if (!val) return;
  const q = current();
  const hit = matchAnswer(val, q.answers, q.whitelist);
  if (hit) return resolve(hit, false, val);
  attemptsLeft--;
  renderAttempts();
  $('card').classList.remove('shake'); void $('card').offsetWidth; $('card').classList.add('shake');
  if (attemptsLeft <= 0) return resolve(null, false, val);
  $('feedback').textContent = `Wack. "${val}" doesn't count. ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left.`;
  $('answer').select();
}

function resolve(hit, timedOut, typed = '') {
  if (!answering) return;
  answering = false;
  stopTimer();
  $('answer').disabled = true; $('btn-submit').disabled = true;
  $('mic').classList.remove('live');
  const q = current();
  const tierKey = hit ? hit.tier : 'wack';
  const tier = TIERS[tierKey];
  const rate = mode === 'daily' ? 1 : CONFIG.OPEN_MIC_FAN_RATE;
  const pts = tier.pts;
  const fansGain = Math.round(pts * FANS_PER_PT * rate);

  const before = venueFor(store.fans).idx;
  store.fans += fansGain;
  if (mode === 'daily') {
    dailyRecord().results.push({ id: q.id, tier: tierKey, pts, answer: hit ? hit.answer.text : null });
  } else omCount++;
  save();

  // Result UI
  setTier(tier.cls);
  $('tier-badge').textContent = timedOut ? 'Time!' : tier.name;
  $('result-answer').textContent = hit ? hit.answer.text : (timedOut ? 'The beat ran out.' : `"${typed}" isn't on the list.`);
  $('result-pts').textContent = `+${pts}`;
  $('result-fans').textContent = `+${fmt(fansGain)}`;
  $('rarest').innerHTML = rarestAnswers(q).map(a =>
    `<li><span>${esc(a.text)}</span><span class="tag ${TIERS[a.tier].cls}">${TIERS[a.tier].name}</span></li>`).join('');
  $('fact').textContent = q.fact || '';
  $('btn-next').textContent = (mode === 'daily' && qi === queue.length - 1) ? 'See the show ›' : 'Next ›';
  $('card').classList.add('hidden');
  $('result').classList.remove('hidden');
  $('btn-next').focus({ preventScroll: true });

  celebrate(tierKey, fansGain);
  renderTop(true);
  renderCrowd();
  const after = venueFor(store.fans);
  if (after.idx > before) setTimeout(() => venueUp(after), 1100);
}

function next() {
  if ($('result').classList.contains('hidden')) return;
  qi++;
  if (mode === 'openmic' && CONFIG.ADS_ENABLED && omCount > 0 && omCount % CONFIG.INTERSTITIAL_EVERY === 0) {
    $('interstitial').classList.remove('hidden');
  }
  ask();
}

// ---------- Daily end ----------
function finishDaily() {
  const rec = dailyRecord();
  if (!rec.done) {
    rec.done = true;
    const y = new Date(); y.setDate(y.getDate() - 1);
    store.streak = store.lastDailyDone === localDateStr(y) ? store.streak + 1 : 1;
    store.lastDailyDone = today;
    const total = rec.results.reduce((s, r) => s + r.pts, 0);
    store.best = Math.max(store.best, total);
    save();
  }
  showEnd();
}

function showEnd() {
  stopTimer();
  const rec = dailyRecord();
  const total = rec.results.reduce((s, r) => s + r.pts, 0);
  $('stage').classList.add('hidden');
  $('end').classList.remove('hidden');
  $('end-venue').textContent = showFor(total).name;
  $('end-pts').textContent = total;
  $('end-fans').textContent = fmt(total * FANS_PER_PT);
  $('end-grid').textContent = rec.results.map(r => TIERS[r.tier].emoji).join('');
  const qs = pickDaily(ALL, today);
  $('end-list').innerHTML = rec.results.map((r, i) =>
    `<li>${esc(qs[i]?.prompt || '')}: <b>${r.answer ? esc(r.answer) : '—'}</b> <span class="tag ${TIERS[r.tier].cls}">${TIERS[r.tier].name}</span></li>`).join('');
  renderTop(false);
  tickCountdown();
}

function share() {
  const rec = dailyRecord();
  const total = rec.results.reduce((s, r) => s + r.pts, 0);
  const text = `Undergrillion ${today}\n${rec.results.map(r => TIERS[r.tier].emoji).join('')}\n${total} pts · Tonight: ${showFor(total).name}\n🔥 ${store.streak} day streak\n${location.href.split('#')[0]}`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Copied. Go flex it.'), () => toast(text));
}

function tickCountdown() {
  if ($('end').classList.contains('hidden')) return;
  const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((mid - now) / 1000));
  $('countdown').textContent = [s / 3600, (s % 3600) / 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':');
  if (s === 0 && mode === 'daily') startDaily();
}

// ---------- Rendering & animation ----------
function setTier(cls) {
  const root = document.documentElement;
  const map = { t1: '--t1', t2: '--t2', t3: '--t3', t4: '--t4', t5: '--t5', t6: '--t6', ttu: '--ttu', twack: '--twack' };
  root.style.setProperty('--tier', cls ? `var(${map[cls]})` : 'var(--orange)');
  $('result').className = `result ${cls || ''}` + ($('result').classList.contains('hidden') ? ' hidden' : '');
}

function renderTop(animate) {
  $('streak').textContent = store.streak;
  const v = venueFor(store.fans);
  $('venue-name').textContent = v.name;
  $('venue-sub').textContent = v.sub;
  if (v.next) {
    const pct = ((store.fans - v.fans) / (v.next.fans - v.fans)) * 100;
    $('venue-fill').style.width = `${Math.min(100, pct)}%`;
    $('venue-next').innerHTML = `Next: <b>${v.next.name}</b><br>${fmt(v.next.fans - store.fans)} fans to go`;
  } else {
    $('venue-fill').style.width = '100%';
    $('venue-next').innerHTML = '<b>Max venue</b>';
  }
  odometer($('fans-top'), shownFans, store.fans, animate ? 1200 : 0);
  shownFans = store.fans;
}

function odometer(el, from, to, ms) {
  if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function celebrate(tierKey, fansGain) {
  const rings = $('rings');
  const strength = { wack: 0, 1: 1, tu: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 6 }[tierKey];
  for (let i = 0; i < strength; i++) {
    const r = document.createElement('div');
    r.className = 'ring';
    r.style.setProperty('--ring', 'var(--tier)');
    r.style.setProperty('--scale', String(1.8 + i * 0.35));
    r.style.animationDelay = `${i * 120}ms`;
    rings.appendChild(r);
    setTimeout(() => r.remove(), 1600 + i * 120);
  }
  if (fansGain > 0) {
    const mic = $('mic').getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'floater';
    f.textContent = `+${fmt(fansGain)} fans`;
    f.style.left = `${mic.left + mic.width / 2}px`;
    f.style.top = `${mic.top}px`;
    $('float-layer').appendChild(f);
    setTimeout(() => f.remove(), 1700);
  }
  if (tierKey === 6) {
    document.querySelector('.app').classList.remove('shake'); void document.body.offsetWidth;
    document.querySelector('.app').classList.add('shake');
    confetti();
  }
  if (tierKey === 'wack') {
    $('card').classList.remove('shake'); void $('card').offsetWidth; $('card').classList.add('shake');
  }
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const icons = ['💿', '📼', '🎤', '🔥', '💿', '⭐'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.textContent = icons[i % icons.length];
    c.style.left = `${Math.random() * 100}vw`;
    c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    $('float-layer').appendChild(c);
    setTimeout(() => c.remove(), 3800);
  }
}

function renderCrowd() {
  // Crowd density grows with log(fans): 3 people in the bedroom, ~60 at the stadium.
  const n = Math.max(3, Math.min(60, Math.round(3 + Math.log10(store.fans + 1) * 8)));
  const hype = Math.round(n * Math.min(1, venueFor(store.fans).idx / 10));
  const r = rng(n);
  $('crowd').innerHTML = Array.from({ length: n }, (_, i) =>
    `<span class="person${i % Math.max(1, Math.floor(n / Math.max(1, hype))) === 0 && hype ? ' hype' : ''}" style="height:${18 + Math.floor(r() * 16)}px;animation-delay:${(r() * 1.4).toFixed(2)}s"></span>`).join('');
}

function venueUp(v) {
  $('vu-name').textContent = v.name;
  $('vu-sub').textContent = v.sub;
  $('venue-up').classList.remove('hidden');
  confetti();
}

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
