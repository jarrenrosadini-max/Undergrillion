import { CONFIG } from './config.js';
import {
  TIERS, TIER_ORDER, FANS_PER_PT, VENUES, venueFor, showFor, matchAnswer, expandQuestions, buildCatalogQuestions, finalizeQuestions,
  buildDictionary, dictCorrect, pickDaily, openMicQueue, rarestAnswers, topAnswers, tierSpread, localDateStr, fmt, rng, shuffle, normalize,
} from './engine.js';
import { sceneSVG } from './scenes.js';

const $ = id => document.getElementById(id);
const STORE_KEY = 'undergrillion:v2';
const ERA_LABEL = { early: 'EARLY 2010s', soundcloud: 'SOUNDCLOUD ERA', pluggnb: 'PLUGGNB', opium: 'OPIUM / RAGE', newwave: 'NEW WAVE', leaks: 'LEAKS', wildcard: 'WILDCARD' };
// How the venue reacts per rarity: speed (s), repeats, crowd jump (px), flash opacity, zoom.
const REACT = {
  1: [1.6, 1, -6, 0.05, 1.01], 2: [1.2, 1, -10, 0.08, 1.015], 3: [0.9, 2, -14, 0.12, 1.02], 4: [0.7, 2, -18, 0.16, 1.03],
  5: [0.5, 3, -24, 0.22, 1.04], 6: [0.36, 4, -30, 0.3, 1.05], 7: [0.22, 7, -38, 0.42, 1.07], tu: [1.2, 1, -10, 0.08, 1.015],
};

// ---------- State ----------
const store = load();
function load() {
  const base = { fans: 0, streak: 0, bestStreak: 0, lastDailyDone: null, best: 0, daily: {} };
  try {
    const v2 = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (v2) return { ...base, ...v2 };
    const v1 = JSON.parse(localStorage.getItem('undergrillion:v1') || 'null'); // keep fans/streak from v1
    return v1 ? { ...base, fans: v1.fans || 0, streak: v1.streak || 0, lastDailyDone: v1.lastDailyDone || null, best: v1.best || 0 } : base;
  } catch { return base; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ } }

let ALL = [], BY_ID = new Map(), DICT = [];
let mode = 'daily', today = localDateStr();
let queue = [], qi = 0, attemptsLeft = CONFIG.ATTEMPTS;
let timer = null, deadline = 0, totalMs = 0, answering = false;
let omCount = 0, omEra = 'all';
const omRand = rng(Date.now());
let shownFans = store.fans, sceneKey = null, endIdx = 0, pending = null;
let omResults = [], endResults = [], endMode = 'daily';
const ROUND = 7;
const PARTICLE_COLORS = { bedroom: ['#9b5cff', '#4aa3ff'], groupchat: ['#3fd9d3', '#3d8bff'], houseparty: ['#ff5a1f', '#ffc83d', '#9b5cff'], openmic: ['#ffe9b0'], club: ['#ff2f6d', '#3d8bff'], warehouse: ['#ff4060', '#ffffff'], theater: ['#ffc83d'], tour: ['#9b5cff', '#ff5a1f'], festival: ['#ffc83d', '#ff8a3d'], mainstage: ['#ff2f6d', '#9b5cff', '#3fd9d3', '#ffc83d'], stadium: ['#fff6c9', '#ffffff'] };

// ---------- Boot ----------
init();
async function init() {
  if (CONFIG.ADS_ENABLED) document.body.classList.add('ads-on');
  setScene(venueFor(store.fans).scene, false);
  try {
    const get = u => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [qData, lData, cData] = await Promise.all([get('data/questions.json'), get('data/leaks.json'), get('data/catalog.json')]);
    ALL = finalizeQuestions([...expandQuestions(qData.questions), ...buildCatalogQuestions(cData, lData, qData.solo || [])]);
    BY_ID = new Map(ALL.map(q => [q.id, q]));
    DICT = buildDictionary(ALL, cData);
  } catch (e) {
    $('prompt').textContent = 'Could not load the question crates. Refresh to try again.';
    console.error(e); return;
  }
  bindUI();
  renderTop(false);
  if (!localStorage.getItem(STORE_KEY)) openHelp();
  startDaily();
  setInterval(tickCountdown, 1000);
}

function bindUI() {
  $('answer-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  $('answer').addEventListener('input', () => { $('mic').classList.toggle('live', $('answer').value.length > 0); if (pending) clearDym(); });
  $('dym-yes').addEventListener('click', () => confirmDym(true));
  $('dym-no').addEventListener('click', () => confirmDym(false));
  $('btn-streak').addEventListener('click', openStreak);
  $('btn-again').addEventListener('click', () => startOpenMic());
  document.addEventListener('click', e => { if (!e.target.closest('button, input, label, a, .card, .result, .end, .venue, .modes, .topbar, .overlay, .era-filter, .mic-wrap')) hype(); });
  window.addEventListener('pointermove', e => parallax(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5), { passive: true });
  window.addEventListener('deviceorientation', e => { if (e.gamma != null) parallax(Math.max(-1, Math.min(1, e.gamma / 30)) / 2, Math.max(-1, Math.min(1, (e.beta - 40) / 30)) / 2); }, { passive: true });
  $('btn-fans').addEventListener('click', openFans);
  $('end-grid').addEventListener('click', () => openModal('tiers'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.overlay').classList.add('hidden')));
  document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); }));
  $('btn-next').addEventListener('click', next);
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c));
    omEra = c.dataset.era; startOpenMic();
  }));
  $('om-timer').addEventListener('change', () => { if (answering) restartTimer(); });
  $('btn-help').addEventListener('click', openHelp);
  $('btn-help-close').addEventListener('click', () => $('help').classList.add('hidden'));
  $('btn-share').addEventListener('click', share);
  $('btn-to-openmic').addEventListener('click', () => switchMode('openmic'));
  $('ep-search').addEventListener('submit', e => { e.preventDefault(); searchAnswer(); });
  $('btn-reset').addEventListener('click', e => {
    e.preventDefault();
    if (window.confirm('Reset all fans, streaks and daily progress?')) { localStorage.removeItem(STORE_KEY); localStorage.removeItem('undergrillion:v1'); location.reload(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !$('result').classList.contains('hidden') && document.activeElement !== $('answer')) next();
  });
}
function openHelp() { $('help').classList.remove('hidden'); }

// ---------- Did you mean ----------
function clearDym() { pending = null; $('dym').classList.add('hidden'); $('btn-submit').textContent = 'Drop it'; }
function confirmDym(yes) {
  if (!pending) return;
  const { original, corrected } = pending;
  clearDym();
  $('answer').value = yes ? corrected : original;
  evaluate(yes ? corrected : original, yes ? original : null);
}
function openModal(id) { $(id).classList.remove('hidden'); }
function openStreak() {
  const days = Object.values(store.daily).filter(d => d.done).length;
  $('streak-body').innerHTML = `<div class="stat-row"><div><b>${store.streak}</b><span>Current streak</span></div><div><b>${Math.max(store.bestStreak || 0, store.streak)}</b><span>Best streak</span></div><div><b>${days}</b><span>Daily Sets played</span></div><div><b>${store.best}</b><span>Best score</span></div></div>
    <p>Your streak is how many days in a row you've finished the Daily Set. Miss a day and it resets to zero. A new set drops at midnight your time.</p>`;
  openModal('streak');
}
function openFans() {
  const v = venueFor(store.fans);
  $('fans-body').innerHTML = `<p><b>${fmt(store.fans)} fans</b>, all-time. Every point you score brings in 10 fans (5 in Open Mic). Fans move you up to bigger venues, and the background changes to match.</p>
    <ol class="ladder">${VENUES.map((x, i) => `<li class="${i < v.idx ? 'done' : i === v.idx ? 'now' : ''}"><span>${i <= v.idx ? (i === v.idx ? '🎤' : '✓') : '🔒'} ${x.name}</span><b>${fmt(x.fans)}</b></li>`).join('')}</ol>`;
  openModal('fans');
}

// ---------- Modes ----------
function switchMode(m) {
  mode = m;
  document.querySelectorAll('.mode').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  $('era-filter').classList.toggle('hidden', m !== 'openmic');
  stopTimer();
  m === 'daily' ? startDaily() : startOpenMic();
}
function dailyRecord() { return (store.daily[today] ||= { ids: null, results: [], done: false }); }
function startDaily() {
  today = localDateStr();
  const rec = dailyRecord();
  if (!rec.ids) { rec.ids = pickDaily(ALL, today).map(q => q.id); save(); }
  queue = rec.ids.map(id => BY_ID.get(id)).filter(Boolean);
  if (queue.length < rec.ids.length) { rec.ids = pickDaily(ALL, today).map(q => q.id); queue = rec.ids.map(id => BY_ID.get(id)); rec.results = []; save(); }
  if (rec.done) return showEnd(rec.results, 'daily');
  qi = rec.results.length;
  showStage(); ask();
}
function startOpenMic() {
  const pool = omEra === 'all' ? openMicQueue(ALL, omRand, ROUND) : shuffle(ALL.filter(q => omEra === 'leaks' ? q.isLeak || q.era === 'leaks' : q.era === omEra), omRand);
  queue = pool.slice(0, ROUND); omResults = [];
  qi = 0; showStage(); ask();
}
function showStage() { $('end').classList.add('hidden'); $('stage').classList.remove('hidden'); }

// ---------- Question flow ----------
function current() { return queue[qi]; }
function ask() {
  const q = current();
  if (!q) return mode === 'daily' ? finishDaily() : showEnd(omResults, 'openmic');
  answering = true; attemptsLeft = CONFIG.ATTEMPTS;
  setTier(null);
  $('card').classList.remove('hidden'); $('result').classList.add('hidden');
  $('q-count').textContent = mode === 'daily' ? `${qi + 1} / ${queue.length}` : `OPEN MIC · ${qi + 1} / ${queue.length}`;
  $('era-tag').textContent = ERA_LABEL[q.era] || q.era.toUpperCase();
  $('prompt').textContent = q.prompt;
  $('feedback').textContent = '';
  $('answer').value = ''; $('answer').disabled = false; $('btn-submit').disabled = false;
  $('mic').classList.remove('live'); clearDym();
  renderAttempts(); restartTimer();
  setTimeout(() => $('answer').focus({ preventScroll: true }), 50);
}
function renderAttempts() { $('attempts').innerHTML = Array.from({ length: CONFIG.ATTEMPTS }, (_, i) => `<i class="${i >= attemptsLeft ? 'used' : ''}"></i>`).join(''); }
function timerOn() { return mode === 'daily' || $('om-timer').checked; }
function restartTimer() {
  stopTimer();
  const fill = $('timer-fill');
  if (!timerOn()) { fill.style.transform = 'scaleX(1)'; fill.classList.remove('low'); return; }
  totalMs = CONFIG.DAILY_SECONDS * 1000; deadline = performance.now() + totalMs;
  const tick = () => {
    const left = deadline - performance.now(), frac = Math.max(0, left / totalMs);
    fill.style.transform = `scaleX(${frac})`; fill.classList.toggle('low', frac < 0.25);
    if (left <= 0) { stopTimer(); resolve(null, true); return; }
    timer = requestAnimationFrame(tick);
  };
  timer = requestAnimationFrame(tick);
}
function stopTimer() { if (timer) cancelAnimationFrame(timer); timer = null; }

function submit() {
  if (!answering) return;
  if (pending) return confirmDym(true);           // Enter again = yes
  const val = $('answer').value.trim();
  if (!val) return;
  const q = current();
  const exact = q.answers.some(a => [a.text, ...(a.aliases || [])].some(f => normalize(f) === normalize(val)));
  if (!exact) {
    const fix = dictCorrect(DICT, val);
    if (fix && normalize(fix) !== normalize(val)) {
      pending = { original: val, corrected: fix };
      $('answer').value = fix;
      $('dym-text').textContent = fix;
      $('dym').classList.remove('hidden');
      $('btn-submit').textContent = 'Yes';
      return;
    }
  }
  evaluate(val, null);
}

function evaluate(val, typedOriginal) {
  const q = current();
  const hit = matchAnswer(val, q.answers, q.whitelist, q.kind);
  if (hit) { if (typedOriginal) hit.corrected = true, hit.typed = typedOriginal; return resolve(hit, false, typedOriginal || val); }
  attemptsLeft--; renderAttempts();
  $('card').classList.remove('shake'); void $('card').offsetWidth; $('card').classList.add('shake');
  if (attemptsLeft <= 0) return resolve(null, false, val);
  $('feedback').textContent = `Wack. "${val}" doesn't count. ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left.`;
  $('answer').select();
}

function resolve(hit, timedOut, typed = '') {
  if (!answering) return;
  answering = false; stopTimer(); clearDym();
  $('answer').disabled = true; $('btn-submit').disabled = true; $('mic').classList.remove('live');
  const q = current();
  const tierKey = hit ? hit.tier : 'wack';
  const tier = TIERS[tierKey];
  const rate = mode === 'daily' ? 1 : CONFIG.OPEN_MIC_FAN_RATE;
  const pts = tier.pts, fansGain = Math.round(pts * FANS_PER_PT * rate);
  const before = venueFor(store.fans).idx;
  store.fans += fansGain;
  if (mode === 'daily') dailyRecord().results.push({ id: q.id, tier: tierKey, pts, answer: hit ? hit.answer.text : null, typed });
  else { omCount++; omResults.push({ id: q.id, tier: tierKey, pts, answer: hit ? hit.answer.text : null, typed }); }
  save();

  setTier(tier.cls);
  $('tier-badge').textContent = timedOut ? 'Time!' : tier.name;
  $('result-answer').textContent = hit ? hit.answer.text : (timedOut ? 'The beat ran out.' : `"${typed}" isn't on the list.`);
  $('corrected').classList.toggle('hidden', !(hit && hit.corrected));
  if (hit && hit.corrected) $('corrected').textContent = `You typed "${typed}", which counted as ${hit.answer.text}.`;
  $('result-pts').textContent = `+${pts}`; $('result-fans').textContent = `+${fmt(fansGain)}`;
  $('rarest').innerHTML = rarestAnswers(q).map(a => `<li><span>${esc(a.text)}</span>${tag(a.tier)}</li>`).join('');
  $('fact').textContent = q.fact || '';
  $('btn-next').textContent = qi === queue.length - 1 ? (mode === 'daily' ? 'See the show ›' : 'See your round ›') : 'Next ›';
  $('card').classList.add('hidden'); $('result').classList.remove('hidden');
  $('btn-next').focus({ preventScroll: true });

  celebrate(tierKey, fansGain);
  react(tierKey);
  renderTop(true);
  const after = venueFor(store.fans);
  if (after.idx > before) setTimeout(() => { setScene(after.scene, true); flagNewVenue(); }, 900);
}
function next() {
  if ($('result').classList.contains('hidden')) return;
  qi++; ask();
}

// ---------- Venue scene ----------
function setScene(key, animate) {
  if (key === sceneKey) return;
  sceneKey = key;
  const host = $('scene');
  const layer = document.createElement('div');
  layer.className = 'scene-layer' + (animate ? ' enter' : ' current');
  layer.innerHTML = sceneSVG(key);
  const old = host.querySelector('.scene-layer.current');
  host.appendChild(layer);
  particles(key);
  if (animate) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      layer.classList.remove('enter'); layer.classList.add('current');
      if (old) { old.classList.remove('current'); old.classList.add('leave'); setTimeout(() => old.remove(), 1900); }
    }));
  } else if (old) old.remove();
}
function react(tierKey) {
  const host = $('scene');
  host.classList.remove('hit', 'miss'); void host.offsetWidth;
  if (tierKey === 'wack') { host.classList.add('miss'); return; }
  const [s, reps, jump, flashO, zoom] = REACT[tierKey] || REACT[1];
  host.style.setProperty('--hit', `${s}s`); host.style.setProperty('--reps', reps);
  host.style.setProperty('--jump', `${jump}px`); host.style.setProperty('--flash', flashO); host.style.setProperty('--zoom', zoom);
  host.classList.add('hit');
  clearTimeout(react._t); react._t = setTimeout(() => host.classList.remove('hit'), s * reps * 1000 + 400);
}
function flagNewVenue() {
  const l = $('venue-label'); l.textContent = 'NEW VENUE UNLOCKED'; l.classList.add('new');
  setTimeout(() => { l.textContent = 'NOW PLAYING'; l.classList.remove('new'); }, 4500);
  confetti();
}

function particles(key) {
  const cols = PARTICLE_COLORS[key] || ['#ffffff'];
  const r = rng(key.length * 97);
  $('particles').innerHTML = Array.from({ length: 28 }, (_, i) =>
    `<i style="left:${(r() * 100).toFixed(1)}%;--s:${(2 + r() * 4).toFixed(1)}px;--c:${cols[i % cols.length]};--d:${(9 + r() * 12).toFixed(1)}s;--dl:-${(r() * 20).toFixed(1)}s;--dx:${(r() * 120 - 60).toFixed(0)}px"></i>`).join('');
}
function parallax(x, y) {
  const host = $('scene');
  host.style.setProperty('--px', `${(-x * 18).toFixed(1)}px`); host.style.setProperty('--py', `${(-y * 12).toFixed(1)}px`);
}
function hype() {
  const host = $('scene');
  host.classList.remove('hype'); void host.offsetWidth; host.classList.add('hype');
  clearTimeout(hype._t); hype._t = setTimeout(() => host.classList.remove('hype'), 1500);
}

// ---------- Daily end ----------
function finishDaily() {
  const rec = dailyRecord();
  if (!rec.done) {
    rec.done = true;
    const y = new Date(); y.setDate(y.getDate() - 1);
    store.streak = store.lastDailyDone === localDateStr(y) ? store.streak + 1 : 1;
    store.bestStreak = Math.max(store.bestStreak || 0, store.streak);
    store.lastDailyDone = today;
    store.best = Math.max(store.best, rec.results.reduce((s, r) => s + r.pts, 0));
    save();
  }
  showEnd(rec.results, 'daily');
}
function showEnd(results, kind) {
  stopTimer();
  endResults = results; endMode = kind;
  const rec = { results };
  const total = rec.results.reduce((s, r) => s + r.pts, 0);
  $('end-label').textContent = kind === 'daily' ? "TONIGHT'S SHOW" : 'OPEN MIC ROUND';
  $('btn-again').classList.toggle('hidden', kind === 'daily');
  $('btn-to-openmic').classList.toggle('hidden', kind !== 'daily');
  $('btn-share').classList.toggle('hidden', kind !== 'daily');
  $('next-daily').classList.toggle('hidden', kind !== 'daily');
  $('stage').classList.add('hidden'); $('end').classList.remove('hidden');
  $('end-venue').textContent = showFor(total).name;
  $('end-pts').textContent = total;
  $('end-grid').textContent = rec.results.map(r => TIERS[r.tier].emoji).join('');
  $('end-tabs').innerHTML = rec.results.map((r, i) => `<button class="end-tab ${TIERS[r.tier].cls}" data-i="${i}" role="tab">${i + 1}</button>`).join('');
  $('end-tabs').querySelectorAll('.end-tab').forEach(b => b.addEventListener('click', () => showEndPanel(+b.dataset.i)));
  showEndPanel(0);
  renderTop(false); tickCountdown();
}
function showEndPanel(i) {
  endIdx = i;
  const r = endResults[i], q = BY_ID.get(r?.id);
  $('end-tabs').querySelectorAll('.end-tab').forEach((b, k) => b.classList.toggle('on', k === i));
  if (!q) { $('ep-prompt').textContent = 'This prompt has been retired.'; return; }
  $('ep-prompt').textContent = q.prompt;
  $('ep-you').innerHTML = r.answer ? `You said <b>${esc(r.answer)}</b> ${tag(r.tier)}` : `No answer counted${r.typed ? ` ("${esc(r.typed)}")` : ''} ${tag('wack')}`;
  // Answer-pool chart: how many valid answers sit in each rarity tier, with your tier highlighted.
  const spread = tierSpread(q), max = Math.max(1, ...Object.values(spread));
  $('chart').innerHTML = TIER_ORDER.map(t => `<div class="bar ${TIERS[t].cls} ${r.tier === t ? 'you' : ''}" title="${TIERS[t].name}: ${spread[t]} answers"><i style="height:${Math.max(4, (spread[t] / max) * 100)}%"></i><span>${spread[t] || ''}</span></div>`).join('');
  $('chart-labels').innerHTML = TIER_ORDER.map(t => `<span>${TIERS[t].name}</span>`).join('');
  $('ep-top').innerHTML = topAnswers(q, 4).map(a => `<li><span>${esc(a.text)}</span>${tag(a.tier)}</li>`).join('');
  $('ep-rare').innerHTML = rarestAnswers(q, 4).map(a => `<li><span>${esc(a.text)}</span>${tag(a.tier)}</li>`).join('');
  $('ep-search-input').value = ''; $('ep-search-result').textContent = '';
}
function searchAnswer() {
  const r = endResults[endIdx], q = BY_ID.get(r?.id), v = $('ep-search-input').value.trim();
  if (!q || !v) return;
  const hit = matchAnswer(v, q.answers, q.whitelist, q.kind);
  $('ep-search-result').innerHTML = hit
    ? `<b>${esc(hit.answer.text)}</b> would have been ${tag(hit.tier)} for ${TIERS[hit.tier].pts} pts.`
    : `"${esc(v)}" isn't on the list for this one.`;
}
function share() {
  const rec = dailyRecord(), total = rec.results.reduce((s, r) => s + r.pts, 0);
  const text = `Undergrillion ${today}\n${rec.results.map(r => TIERS[r.tier].emoji).join('')}\n${total} pts · Tonight: ${showFor(total).name}\n🔥 ${store.streak} day streak\n${location.href.split('#')[0]}`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Copied. Go flex it.'), () => toast(text));
}
function tickCountdown() {
  if ($('end').classList.contains('hidden') || endMode !== 'daily') return;
  const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((mid - now) / 1000));
  $('countdown').textContent = [s / 3600, (s % 3600) / 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':');
  if (s === 0 && mode === 'daily') startDaily();
}

// ---------- Rendering helpers ----------
function tag(t) { const x = TIERS[t]; return `<span class="tag ${x.cls}">${x.name}</span>`; }
function setTier(cls) {
  document.documentElement.style.setProperty('--tier', cls ? `var(--${cls})` : 'var(--orange)');
  const res = $('result'), hidden = res.classList.contains('hidden');
  res.className = `result glass ${cls || ''}${hidden ? ' hidden' : ''}`;
}
function renderTop(animate) {
  $('streak').textContent = store.streak;
  const v = venueFor(store.fans);
  $('venue-name').textContent = v.name;
  $('venue-sub').textContent = v.sub;
  if (v.next) {
    $('venue-fill').style.width = `${Math.min(100, ((store.fans - v.fans) / (v.next.fans - v.fans)) * 100)}%`;
    $('venue-next').innerHTML = `Next: <b>${v.next.name}</b><br>${fmt(v.next.fans - store.fans)} fans to go`;
  } else { $('venue-fill').style.width = '100%'; $('venue-next').innerHTML = '<b>Max venue</b>'; }
  odometer($('fans-top'), shownFans, store.fans, animate ? 1200 : 0);
  shownFans = store.fans;
}
function odometer(el, from, to, ms) {
  if (!ms || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function celebrate(tierKey, fansGain) {
  const strength = { wack: 0, 1: 1, tu: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 6 }[tierKey];
  for (let i = 0; i < strength; i++) {
    const r = document.createElement('div');
    r.className = 'ring'; r.style.setProperty('--scale', String(1.8 + i * 0.35)); r.style.animationDelay = `${i * 110}ms`;
    $('rings').appendChild(r); setTimeout(() => r.remove(), 1500 + i * 110);
  }
  if (fansGain > 0) {
    const mic = $('mic').getBoundingClientRect(), f = document.createElement('div');
    f.className = 'floater'; f.textContent = `+${fmt(fansGain)} fans`;
    f.style.left = `${mic.left + mic.width / 2}px`; f.style.top = `${mic.top}px`;
    $('float-layer').appendChild(f); setTimeout(() => f.remove(), 1700);
  }
  if (tierKey === 7) confetti();
  if (tierKey === 'wack') { $('card').classList.remove('shake'); void $('card').offsetWidth; $('card').classList.add('shake'); }
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const icons = ['💿', '📼', '🎤', '🔥', '💿', '⭐'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('div');
    c.className = 'confetti'; c.textContent = icons[i % icons.length];
    c.style.left = `${Math.random() * 100}vw`; c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`; c.style.animationDelay = `${Math.random() * 0.4}s`;
    $('float-layer').appendChild(c); setTimeout(() => c.remove(), 3800);
  }
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
