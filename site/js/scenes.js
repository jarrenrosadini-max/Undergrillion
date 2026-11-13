// Procedural SVG venue backgrounds. Each scene is drawn in a 1600x1000 box and
// fills the screen (slice). Animated parts use classes styled in style.css:
// .beam (light beams), .person (crowd), .flash (strobe layer), .twinkle, .flame, .bubble
import { rng, hashStr } from './engine.js';

const W = 1600, H = 1000;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

function crowd(n, y, scale, seed, color = '#07060b', spread = [0, W]) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const x = spread[0] + r() * (spread[1] - spread[0]);
    const h = (60 + r() * 40) * scale, w = h * 0.42;
    const arm = r() < 0.35 ? `<rect x="${x + w * 0.3}" y="${y - h * 1.55}" width="${w * 0.16}" height="${h * 0.6}" rx="${w * 0.08}" fill="${color}" transform="rotate(${-20 + r() * 40} ${x + w * 0.38} ${y - h * 0.95})"/>` : '';
    s += `<g class="person" style="animation-delay:${(r() * 1.2).toFixed(2)}s">${arm}<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="${w * 0.45}" fill="${color}"/><circle cx="${x + w / 2}" cy="${y - h - w * 0.42}" r="${w * 0.42}" fill="${color}"/></g>`;
  }
  return s;
}
function beams(n, ox, oy, colors, seed, len = 1100, width = 90) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length], ang = -40 + (80 / Math.max(1, n - 1)) * i + (r() * 10 - 5);
    const x = ox + (n > 1 ? (i - (n - 1) / 2) * 140 : 0);
    s += `<polygon class="beam" style="--a:${ang.toFixed(1)}deg;transform-origin:${x}px ${oy}px;animation-delay:${(r() * 2).toFixed(2)}s" points="${x - 6},${oy} ${x + 6},${oy} ${x + width},${oy + len} ${x - width},${oy + len}" fill="url(#beam-${c.replace('#', '')})" opacity=".55"/>`;
  }
  return s;
}
function beamDefs(colors) {
  return colors.map(c => `<linearGradient id="beam-${c.replace('#', '')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`).join('');
}
function stars(n, seed, maxY = 500) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) s += `<circle class="twinkle" style="animation-delay:${(r() * 3).toFixed(2)}s" cx="${r() * W}" cy="${r() * maxY}" r="${0.8 + r() * 1.8}" fill="#fff" opacity=".7"/>`;
  return s;
}
function lights(n, y, seed, colors) {
  const r = rng(seed); let s = `<path d="M0 ${y} Q ${W / 2} ${y + 60} ${W} ${y}" stroke="#2a2433" stroke-width="3" fill="none"/>`;
  for (let i = 0; i <= n; i++) { const t = i / n, x = t * W, yy = y + 60 * 4 * t * (1 - t) * 0.5; s += `<circle class="twinkle" style="animation-delay:${(r() * 2).toFixed(2)}s" cx="${x}" cy="${yy + 8}" r="7" fill="${colors[i % colors.length]}"/>`; }
  return s;
}
const flash = c => `<rect class="flash" x="0" y="0" width="${W}" height="${H}" fill="${c}" opacity="0"/>`;

const SCENES = {
  bedroom: () => {
    const cols = ['#9b5cff'];
    return `<defs>${beamDefs(cols)}<radialGradient id="mon" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#4aa3ff" stop-opacity=".55"/><stop offset="1" stop-color="#4aa3ff" stop-opacity="0"/></radialGradient></defs>
    ${rect(0, 0, W, H, '#130f1d')}${rect(0, 720, W, 280, '#0c0a12')}
    <rect x="0" y="40" width="${W}" height="10" fill="#9b5cff" class="twinkle" opacity=".8"/>
    ${rect(1120, 140, 300, 260, '#1b2340', 'rx="6"')}<circle cx="1330" cy="220" r="40" fill="#e8e3c9" opacity=".85"/>${stars(18, 3, 380).replace(/cy="(\d+)/g, (m, y) => `cy="${140 + (+y % 250)}`)}
    <rect x="1120" y="265" width="300" height="6" fill="#0c0a12"/><rect x="1267" y="140" width="6" height="260" fill="#0c0a12"/>
    ${rect(160, 160, 150, 210, '#ff5a1f', 'opacity=".25" transform="rotate(-4 235 265)"')}${rect(340, 190, 130, 180, '#3fd9d3', 'opacity=".18" transform="rotate(3 405 280)"')}
    <ellipse cx="560" cy="560" rx="420" ry="200" fill="url(#mon)"/>
    ${rect(380, 470, 360, 210, '#05060a', 'rx="10"')}${rect(395, 485, 330, 180, '#16305c', 'rx="4" class="twinkle"')}
    ${rect(330, 690, 520, 22, '#1d1828')}${rect(360, 712, 18, 200, '#1d1828')}${rect(800, 712, 18, 200, '#1d1828')}
    ${rect(960, 640, 560, 150, '#1a1524', 'rx="30"')}${rect(960, 610, 160, 70, '#231d30', 'rx="24"')}${flash('#9b5cff')}`;
  },
  groupchat: () => `<defs>${beamDefs(['#3fd9d3'])}</defs>${rect(0, 0, W, H, '#0e1222')}${stars(80, 9, 600)}
    <path d="M0 760 L220 640 L420 700 L640 590 L900 680 L1150 600 L1400 690 L1600 620 L1600 1000 L0 1000z" fill="#090b14"/>
    ${[...Array(9)].map((_, i) => `<g class="bubble" style="animation-delay:${i * 0.5}s"><rect x="${120 + i * 160}" y="${220 + (i % 3) * 90}" width="${120 + (i % 2) * 40}" height="46" rx="23" fill="${i % 2 ? '#3d8bff' : '#2a2638'}" opacity=".85"/><text x="${150 + i * 160}" y="${251 + (i % 3) * 90}" font-size="24">${['🔥', '💯', '🎤', '😭', '🔥🔥', '💿', '‼️', '🗣️', '🔥'][i]}</text></g>`).join('')}
    ${crowd(6, 900, 1.5, 21, '#05060c', [400, 1200])}${flash('#3fd9d3')}`,
  houseparty: () => { const c = ['#ff5a1f', '#9b5cff', '#ffc83d', '#3fd9d3']; return `<defs>${beamDefs(c)}</defs>${rect(0, 0, W, H, '#1a1020')}${rect(0, 760, W, 240, '#0d0910')}
    ${lights(24, 90, 5, c)}<circle cx="800" cy="210" r="46" fill="#cfc8e0" opacity=".9"/><circle cx="800" cy="210" r="46" fill="url(#beam-9b5cff)" opacity=".5"/>
    ${beams(4, 800, 210, c, 7, 900, 120)}${rect(80, 600, 420, 150, '#241a2c', 'rx="30"')}${crowd(26, 960, 1.6, 11, '#07050a')}${flash('#ff5a1f')}`; },
  openmic: () => `<defs>${beamDefs(['#ffe9b0'])}</defs>${rect(0, 0, W, H, '#1c1310')}
    ${[...Array(20)].map((_, r) => [...Array(14)].map((_, c) => rect(c * 120 + (r % 2) * 60 - 30, r * 40, 112, 34, '#2a1b16', 'rx="3"')).join('')).join('')}
    ${beams(1, 800, -20, ['#ffe9b0'], 3, 760, 260)}<ellipse cx="800" cy="700" rx="300" ry="40" fill="#ffe9b0" opacity=".18"/>
    ${rect(500, 690, 600, 30, '#100a08')}<line x1="800" y1="690" x2="800" y2="520" stroke="#111" stroke-width="8"/><circle cx="800" cy="510" r="16" fill="#222"/>
    ${crowd(30, 1000, 1.7, 13, '#060404')}${flash('#ffe9b0')}`,
  club: () => { const c = ['#ff2f6d', '#3d8bff', '#9b5cff']; return `<defs>${beamDefs(c)}</defs>${rect(0, 0, W, H, '#0b0812')}
    <text x="120" y="240" font-family="Anton,Impact,sans-serif" font-size="110" fill="none" stroke="#ff2f6d" stroke-width="4" class="twinkle">LIVE</text>
    <text x="1180" y="200" font-family="Anton,Impact,sans-serif" font-size="80" fill="none" stroke="#3fd9d3" stroke-width="4" class="twinkle">808</text>
    ${beams(6, 800, 60, c, 17, 1000, 60)}${rect(620, 520, 360, 110, '#141020', 'rx="8"')}${rect(640, 540, 320, 8, '#ff2f6d', 'class="twinkle"')}
    ${crowd(44, 1000, 1.5, 19)}${flash('#ff2f6d')}`; },
  warehouse: () => { const c = ['#ff4060', '#ffffff']; return `<defs>${beamDefs(c)}</defs>${rect(0, 0, W, H, '#0d0c0f')}
    ${[200, 600, 1000, 1400].map(x => rect(x - 30, 0, 60, H, '#17151b')).join('')}${rect(0, 0, W, 60, '#18161c')}
    ${beams(8, 800, 40, c, 23, 1050, 40)}<rect x="0" y="0" width="${W}" height="${H}" fill="#ff4060" opacity=".05"/>
    ${crowd(70, 1000, 1.3, 29)}${flash('#ffffff')}`; },
  theater: () => { const c = ['#ffc83d']; return `<defs>${beamDefs(c)}<linearGradient id="cur" x1="0" x2="1"><stop offset="0" stop-color="#5a0f1c"/><stop offset=".5" stop-color="#8e1a2c"/><stop offset="1" stop-color="#5a0f1c"/></linearGradient></defs>
    ${rect(0, 0, W, H, '#140b0d')}${rect(0, 0, 260, 760, 'url(#cur)')}${rect(W - 260, 0, 260, 760, 'url(#cur)')}${rect(0, 0, W, 90, '#6d1322')}
    ${rect(260, 560, W - 520, 40, '#2a1a12')}${beams(5, 800, 80, c, 31, 520, 120)}
    ${[...Array(5)].map((_, r) => crowd(34, 760 + r * 60, 0.9 + r * 0.15, 40 + r, '#0a0507')).join('')}${flash('#ffc83d')}`; },
  tour: () => { const c = ['#9b5cff', '#ff5a1f', '#3fd9d3']; return `<defs>${beamDefs(c)}<linearGradient id="led" x1="0" x2="1"><stop offset="0" stop-color="#9b5cff"/><stop offset="1" stop-color="#ff5a1f"/></linearGradient></defs>
    ${rect(0, 0, W, H, '#09070e')}${rect(300, 120, 1000, 380, 'url(#led)', 'opacity=".55" class="twinkle"')}
    <text x="800" y="340" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="120" fill="#fff" opacity=".85">ON TOUR</text>
    ${rect(220, 560, 1160, 40, '#1a1622')}${beams(6, 800, 520, c, 37, 600, 70)}
    ${[...Array(4)].map((_, r) => crowd(60, 760 + r * 75, 0.9 + r * 0.2, 60 + r)).join('')}${flash('#ffffff')}`; },
  festival: () => { const c = ['#ffc83d', '#ff5a1f']; return `<defs>${beamDefs(c)}<linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1640"/><stop offset=".6" stop-color="#7a2f5a"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs>
    ${rect(0, 0, W, H, 'url(#dusk)')}${stars(40, 41, 300)}
    <g stroke="#120d18" stroke-width="10" fill="none"><path d="M260 720 V160 H1340 V720"/><path d="M260 160 L340 240 M1340 160 L1260 240"/></g>
    ${rect(360, 480, 880, 240, '#120d18')}${beams(6, 800, 170, c, 43, 700, 80)}
    ${[...Array(5)].map((_, r) => crowd(80, 780 + r * 55, 0.8 + r * 0.18, 70 + r, '#0a0710')).join('')}${flash('#ffc83d')}`; },
  mainstage: () => { const c = ['#ff2f6d', '#9b5cff', '#3fd9d3', '#ffc83d']; return `<defs>${beamDefs(c)}<linearGradient id="led2" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff2f6d"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#3fd9d3"/></linearGradient></defs>
    ${rect(0, 0, W, H, '#05040a')}${rect(180, 60, 1240, 470, 'url(#led2)', 'opacity=".65" class="twinkle"')}
    <text x="800" y="330" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="150" fill="#fff" opacity=".9">MAIN STAGE</text>
    ${rect(40, 120, 120, 300, '#1b1830', 'rx="6"')}${rect(1440, 120, 120, 300, '#1b1830', 'rx="6"')}
    ${[200, 420, 1180, 1400].map((x, i) => `<path class="flame" style="animation-delay:${i * 0.3}s" d="M${x} 560 q-30 -80 0 -170 q30 90 0 170z" fill="#ffc83d"/>`).join('')}
    ${beams(8, 800, 540, c, 47, 700, 50)}${[...Array(6)].map((_, r) => crowd(110, 720 + r * 55, 0.7 + r * 0.16, 90 + r)).join('')}${flash('#ffffff')}`; },
  stadium: () => { const c = ['#ffffff', '#ffc83d']; const r = rng(99); return `<defs>${beamDefs(c)}</defs>${rect(0, 0, W, H, '#04030a')}${stars(60, 51, 260)}
    <ellipse cx="800" cy="620" rx="900" ry="380" fill="#0d0b16"/><ellipse cx="800" cy="640" rx="760" ry="290" fill="#07060c"/>
    ${[...Array(260)].map(() => `<circle class="twinkle" style="animation-delay:${(r() * 3).toFixed(2)}s" cx="${100 + r() * 1400}" cy="${380 + r() * 260}" r="2.2" fill="#fff6c9" opacity=".8"/>`).join('')}
    ${[300, 800, 1300].map((x, i) => `<g class="twinkle" style="animation-delay:${i * 0.7}s">${[...Array(10)].map((_, k) => `<line x1="${x}" y1="160" x2="${x + Math.cos(k / 10 * 6.28) * 90}" y2="${160 + Math.sin(k / 10 * 6.28) * 90}" stroke="${['#ff2f6d', '#ffc83d', '#3fd9d3'][i]}" stroke-width="4"/>`).join('')}</g>`).join('')}
    ${beams(6, 800, 480, c, 53, 600, 60)}${[...Array(5)].map((_, k) => crowd(120, 800 + k * 50, 0.7 + k * 0.15, 120 + k)).join('')}${flash('#ffffff')}`; },
};

export function sceneSVG(key) {
  const body = (SCENES[key] || SCENES.bedroom)();
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}
export const SCENE_KEYS = Object.keys(SCENES);
