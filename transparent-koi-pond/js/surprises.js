/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   惊喜：时令、节日河灯、青蛙、蜻蜓、锦鲤跃水、水花、气泡、长按与划水
   原则：不加按钮，只藏在“点、按住、拖、看着”这几个动作后面
   ============================================================ */
let frogs = [], dragonflies = [], lanterns = [], droplets = [], bubbles = [];

/* 时令 */
function season() {
  if (S.seasonMode && S.seasonMode !== 'auto') return S.seasonMode;
  let m = new Date().getMonth() + 1;
  if (cityInfo().lat < 0) m = (m + 5) % 12 + 1;   // 南半球：季节和北半球正好差半年
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

/* 节日（农历节日按公历日期写死，够用到 2030 年） */
const FESTIVALS = [
  { name: '中秋', lantern: 'lotus', greet: '中秋快乐 · 天黑以后，池子里会漂起河灯', days: ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12'], span: [0, 0] },
  { name: '春节', lantern: 'red', greet: '新春快乐 · 夜里会有红灯笼漂过', days: ['2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'], span: [-1, 2] },
  { name: '元宵', lantern: 'red', greet: '元宵快乐 · 今晚池子里有花灯', days: ['2027-02-20', '2028-02-09', '2029-02-27', '2030-02-17'], span: [0, 0] },
];
function festivalOn(date) {
  const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (const f of FESTIVALS) for (const ds of f.days) {
    const [y, m, d] = ds.split('-').map(Number);
    const diff = Math.round((d0 - new Date(y, m - 1, d)) / 86400000);
    if (diff >= f.span[0] && diff <= f.span[1]) return Object.assign({}, f, { label: diff === -1 ? '除夕' : f.name });
  }
  return null;
}
let FEST = festivalOn(new Date());

/* 水花与气泡 */
function splash(x, y, power) {
  sndSplash(x, power);
  addRipple(x, y, (50 * SCALE + 20) * power, 2.4, 1);
  addRipple(x, y, (26 * SCALE + 10) * power, 1.6, 0.8);
  const n = Math.round(8 + 10 * power);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(40, 130) * power * Math.sqrt(SCALE);
    droplets.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, z: 0, vz: rand(70, 170) * power });
  }
  for (const p of petals) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d < 160 * power && d > 0) { p.vx += dx / d * 30 * power; p.vy += dy / d * 30 * power; p.va += rand(-0.5, 0.5); }
  }
}
function updateDroplets(dt) {
  for (const d of droplets) {
    d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= 420 * dt; d.z += d.vz * dt;
    if (d.z < 0) { d.dead = true; addRipple(d.x, d.y, rand(5, 9), 0.8, 0.5); }
  }
  droplets = droplets.filter(d => !d.dead);
}
function drawDroplets(g) {
  for (const d of droplets) {
    g.fillStyle = 'rgba(14,40,32,0.15)';
    g.beginPath(); g.arc(d.x + d.z * 0.25, d.y + d.z * 0.35, 1.4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(244,252,250,0.85)';
    g.beginPath(); g.arc(d.x, d.y, 1.3 + d.z * 0.012, 0, TAU); g.fill();
  }
}

function addBubble(x, y, r) {
  bubbles.push({ x: x + rand(-3, 3), y: y + rand(-3, 3), r: (r || rand(2, 4.5)) * Math.sqrt(SCALE), age: 0, life: rand(0.8, 1.6), seed: rand(0, TAU) });
  if (bubbles.length > 120) bubbles.shift();
  sndBloop(x);
}
function updateBubbles(dt) {
  for (const b of bubbles) {
    b.age += dt;
    b.x += Math.sin(time * 3 + b.seed) * 6 * dt;
    if (b.age >= b.life) { b.dead = true; addRipple(b.x, b.y, b.r * 2.5 + 4, 0.7, 0.45); }
  }
  bubbles = bubbles.filter(b => !b.dead);
}
function drawBubbles(g) {
  for (const b of bubbles) {
    const k = Math.min(1, b.age * 6), r = b.r * (0.6 + 0.4 * k);
    g.strokeStyle = 'rgba(240,252,248,0.75)'; g.lineWidth = 1;
    g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(240,252,248,0.18)'; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(b.x - r * 0.35, b.y - r * 0.35, r * 0.28, 0, TAU); g.fill();
  }
}

/* 长按水面 = 把手伸进水里；拖动 = 划水 */
const PRESS = { active: false, mode: 'tap', x: 0, y: 0, sx: 0, sy: 0, t0: 0, wx: 0, wy: 0, pulse: 0 };
function pressStart(x, y) {
  Object.assign(PRESS, { active: true, mode: 'tap', x, y, sx: x, sy: y, t0: time, wx: x, wy: y, pulse: 0 });
  addRipple(x, y, 22, 1.1, 0.55);
}
function pressMove(x, y) {
  if (!PRESS.active) return;
  PRESS.x = x; PRESS.y = y;
  if (PRESS.mode === 'tap' && Math.hypot(x - PRESS.sx, y - PRESS.sy) > 10) PRESS.mode = 'drag';
  if (PRESS.mode !== 'drag') return;
  const d = Math.hypot(x - PRESS.wx, y - PRESS.wy);
  if (d < 16) return;
  addRipple(x, y, 14 + Math.min(40, d * 0.6), 1.5, 0.55);
  for (const p of petals) {
    const dx = p.x - x, dy = p.y - y, dd = Math.hypot(dx, dy);
    if (dd < 70 && dd > 0) { p.vx += dx / dd * 18 + (x - PRESS.wx) * 0.6; p.vy += dy / dd * 18 + (y - PRESS.wy) * 0.6; }
  }
  for (const f of fish) if (Math.hypot(f.x - x, f.y - y) < 60 && pointer.speed > 400) f.startle(x, y, 0.4);
  PRESS.wx = x; PRESS.wy = y;
}
function pressEnd() {
  if (!PRESS.active) return;
  PRESS.active = false;
  if (PRESS.mode === 'tap') {
    addRipple(PRESS.sx, PRESS.sy, 70 * SCALE + 30, 2.6, 1);
    scatterFood(PRESS.sx, PRESS.sy);
    for (const f of fish) if (Math.hypot(f.x - PRESS.sx, f.y - PRESS.sy) < 70) f.startle(PRESS.sx, PRESS.sy, 0.35);
  }
}
function handActive() { return PRESS.active && PRESS.mode === 'hand'; }
function updatePress(dt) {
  if (!PRESS.active) return;
  if (PRESS.mode === 'tap' && time - PRESS.t0 > 0.45) { PRESS.mode = 'hand'; hideHint(); }
  if (PRESS.mode === 'hand') {
    PRESS.pulse -= dt;
    if (PRESS.pulse < 0) { PRESS.pulse = 0.8; addRipple(PRESS.x, PRESS.y, 34, 1.6, 0.45); }
  }
}

/* 锦鲤跃出水面：偶尔发生；抢食很热闹时更容易 */
const LEAP = { next: rand(200, 420), last: -999, eats: [] };
function noteEat() { LEAP.eats.push(time); }
function updateLeap(dt) {
  LEAP.next -= dt;
  while (LEAP.eats.length && time - LEAP.eats[0] > 8) LEAP.eats.shift();
  let go = LEAP.next < 0;
  if (!go && LEAP.eats.length >= 14 && time - LEAP.last > 40 && Math.random() < dt * 0.8) go = true;
  if (!go) return;
  const cands = fish.filter(f => !f.leap && f.z < 0.55 && f.x > W * 0.12 && f.x < W * 0.88 && f.y > H * 0.15 && f.y < H * 0.85);
  LEAP.next = rand(240, 480);
  if (!cands.length) return;
  const f = cands[(Math.random() * cands.length) | 0];
  f.leap = 0.0001; f.leapDur = rand(1.2, 1.5); f.z = Math.min(f.z, 0.2);
  LEAP.last = time;
  splash(f.x, f.y, 0.7);
}

/* 河灯（节日夜晚） */
function lanternWant() {
  if (!FEST || ENV.dark < 0.25) return 0;
  return Math.round(clamp(W * H / 260000, 4, 9));
}
function newLantern(edge) {
  return { x: edge ? -30 : rand(W * 0.05, W * 0.9), y: rand(H * 0.12, H * 0.88), vx: rand(4, 9), vy: 0, a: rand(0, TAU), va: rand(-0.08, 0.08), seed: rand(0, TAU), life: 0, pulse: 0, s: rand(16, 21) * SCALE, kind: FEST ? FEST.lantern : 'lotus' };
}
function updateLanterns(dt) {
  const want = lanternWant();
  const live = lanterns.filter(l => !l.leaving).length;
  if (live < want) lanterns.push(newLantern(false));
  if (live > want) { const l = lanterns.find(l => !l.leaving); if (l) l.leaving = true; }
  for (const l of lanterns) {
    l.vx += ((5 + ENV.wind * 14) - l.vx) * dt * 0.2;
    l.x += l.vx * dt;
    l.y += Math.sin(time * 0.3 + l.seed) * 3 * dt;
    l.a += l.va * dt;
    l.va *= Math.exp(-dt * 0.4);
    l.pulse *= Math.exp(-dt * 2.5);
    l.life = l.leaving ? l.life - dt * 0.35 : Math.min(1, l.life + dt * 0.3);
    if (l.x > W + 40) { l.x = -30; l.y = rand(H * 0.12, H * 0.88); }
  }
  lanterns = lanterns.filter(l => !(l.leaving && l.life <= 0));
}
function lanternAt(x, y) { return lanterns.find(l => Math.hypot(l.x - x, l.y - y) < l.s * 1.5); }
function pokeLantern(l) { l.va += rand(-2, 2); l.pulse = 1; l.vx += 10; addRipple(l.x, l.y, l.s * 3, 1.8, 0.7); }

function drawLanterns(g) {
  if (!lanterns.length) return;
  for (const l of lanterns) {
    const a = clamp(l.life, 0, 1) * frameOpacity(frameCircle(l.x, l.y, l.s * 5.4 + 6)), fl = 0.85 + 0.15 * Math.sin(time * 9 + l.seed) * Math.sin(time * 5.3 + l.seed);
    const s = l.s * (1 + l.pulse * 0.08 * Math.sin(time * 14));
    // 水面上的一圈暖光
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(l.x + 2, l.y + 4, 0, l.x + 2, l.y + 4, s * 5);
    glow.addColorStop(0, `rgba(255,186,110,${0.32 * a * fl})`);
    glow.addColorStop(1, 'rgba(255,186,110,0)');
    g.fillStyle = glow; g.fillRect(l.x - s * 5, l.y - s * 5, s * 10, s * 10);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = a;
    g.save(); g.translate(l.x, l.y); g.rotate(l.a);
    if (l.kind === 'red') {
      const gr = g.createRadialGradient(-s * 0.2, -s * 0.2, s * 0.1, 0, 0, s);
      gr.addColorStop(0, '#ff8a5c'); gr.addColorStop(0.6, '#e2402a'); gr.addColorStop(1, '#a51d14');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(248,206,110,0.8)'; g.lineWidth = 1;
      for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.ellipse(0, 0, s * Math.abs(Math.cos(k * 1.5)) * 0.98 + 0.5, s * 0.98, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#e9c35a'; g.beginPath(); g.arc(0, 0, s * 0.28, 0, TAU); g.fill();
    } else {
      for (const [n, len, off, c0, c1] of [[8, 1.0, 0, '#fbe3ea', '#ef8fac'], [8, 0.72, 0.39, '#fff1f4', '#f4a9bf']]) {
        for (let i = 0; i < n; i++) {
          g.save(); g.rotate(i / n * TAU + off);
          const L = s * len, w = s * 0.34;
          g.beginPath(); g.moveTo(0, 0);
          g.bezierCurveTo(w, -L * 0.3, w * 0.7, -L * 0.85, 0, -L);
          g.bezierCurveTo(-w * 0.7, -L * 0.85, -w, -L * 0.3, 0, 0);
          const pg = g.createLinearGradient(0, 0, 0, -L);
          pg.addColorStop(0, c0); pg.addColorStop(1, c1);
          g.fillStyle = pg; g.fill();
          g.restore();
        }
      }
    }
    // 烛火
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.55);
    cg.addColorStop(0, `rgba(255,255,236,${fl})`); cg.addColorStop(0.4, `rgba(255,214,120,${0.9 * fl})`); cg.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, s * 0.55, 0, TAU); g.fill();
    g.restore();
    g.globalAlpha = 1;
  }
}

/* Codex / GPT / 模型 ID 无法确认: open-water frogs retain swimming, jumping and pointer interaction. */
function frogWant() { return S.frogs && season() !== 'winter' ? (W * H > 1.6e6 ? 2 : 1) : 0; }
function waterSpotNear(x, y, dir, dist) {
  for (let i = 0; i < 16; i++) {
    const a = dir + rand(-0.7, 0.7) * (i < 8 ? 1 : 2.5), d = dist * rand(0.8, 1.2);
    const tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
    if (tx > 40 && tx < W - 40 && ty > 40 && ty < H - 40) return [tx, ty];
  }
  return [clamp(x + 80, 40, W - 40), clamp(y + 80, 40, H - 40)];
}

// Codex / GPT / 模型 ID 无法确认: frogs swim and jump between water targets; no leaf geometry or landing sites remain.
class Frog {
  constructor() {
    this.s = rand(14, 17) * SCALE;
    this.x = rand(W * 0.2, W * 0.8); this.y = rand(H * 0.2, H * 0.8);
    this.face = rand(0, TAU); this.state = 'swim';
    this.blinkT = rand(2, 6); this.blink = 0; this.croak = -1;
    this.jumpT = rand(70, 180); this.phase = 0; this.t = 0; this.z = 0.04;
    this.pickTarget();
  }
  pickTarget() {
    const [x, y] = waterSpotNear(this.x, this.y, this.face, rand(80, 130) * SCALE);
    this.target = {x, y};
  }
  hit(x, y) { return Math.hypot(x - this.x, y - this.y) < this.s * 1.7; }
  jumpTo(tx, ty, hmax) {
    this.from = [this.x, this.y]; this.to = [tx, ty];
    this.t = 0; this.dur = 0.6; this.hmax = hmax;
    this.face = Math.atan2(ty - this.y, tx - this.x); this.state = 'jump';
  }
  leaveToWater() {
    const [tx, ty] = waterSpotNear(this.x, this.y, this.face, rand(80, 130) * SCALE);
    this.jumpTo(tx, ty, 1);
  }
  poke() {
    if (this.state === 'swim') { this.phase += 2; this.kick = 0.8; addRipple(this.x, this.y, 26, 1.2, 0.6); }
  }
  update(dt) {
    this.blinkT -= dt; this.blink -= dt;
    if (this.blinkT < 0) { this.blink = 0.14; this.blinkT = rand(2, 7); }
    if (this.state === 'jump') {
      this.t += dt / this.dur;
      const k = Math.min(1, this.t);
      this.x = lerp(this.from[0], this.to[0], k); this.y = lerp(this.from[1], this.to[1], k);
      if (this.t >= 1) { this.state = 'swim'; this.kick = 0; splash(this.x, this.y, 0.55); this.pickTarget(); }
      return;
    }
    this.jumpT -= dt;
    if (this.jumpT < 0) { this.jumpT = rand(80, 200); this.leaveToWater(); return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - this.face;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    this.face += clamp(da, -dt * 1.2, dt * 1.2);
    this.phase += dt * 3.2; this.kick = Math.max(0, (this.kick || 0) - dt);
    const v = (18 + 30 * Math.max(0, Math.sin(this.phase))) * Math.sqrt(SCALE) * (1 + this.kick * 2);
    this.x += Math.cos(this.face) * v * dt; this.y += Math.sin(this.face) * v * dt;
    if (d < 24) this.pickTarget();
  }
  drawShadow(g) {
    if (this.state !== 'jump') return;
    const h = Math.sin(Math.PI * Math.min(1, this.t)) * this.hmax, off = h * 40 + 3;
    g.fillStyle = `rgba(14,40,32,${0.2 * (1 - h * 0.4)})`;
    g.beginPath(); g.ellipse(this.x + off * SUN.x, this.y + off * SUN.y, this.s * 0.9, this.s * 0.65, this.face, 0, TAU); g.fill();
  }
  draw(g) {
    const s = this.s, jumping = this.state === 'jump', swim = this.state === 'swim';
    const h = jumping ? Math.sin(Math.PI * Math.min(1, this.t)) * this.hmax : 0;
    const skin = '#7fae44', dark = '#4e7a28';
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.face);
    g.scale(1 + h * 0.6, 1 + h * 0.6);
    // 后腿：蹲着时折在两侧；游泳和跳起时向后蹬直
    const stretch = jumping ? Math.min(1, this.t * 3) : swim ? 0.5 + 0.5 * Math.max(0, Math.sin(this.phase)) : 0;
    g.fillStyle = skin; g.strokeStyle = dark; g.lineWidth = 0.8;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(-s * 0.35, side * s * 0.38);
      g.rotate(Math.PI - side * lerp(0.5, 0.15, stretch));
      const L = s * lerp(0.7, 1.35, stretch);
      g.beginPath(); g.ellipse(L * 0.45, 0, L * 0.5, s * 0.2, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(L * 0.95, 0, s * 0.22, s * 0.14, 0, 0, TAU); g.fill();
      g.restore();
      g.beginPath(); g.ellipse(s * 0.45, side * s * 0.5, s * 0.28, s * 0.1, side * 0.9, 0, TAU); g.fill(); g.stroke();
    }
    const gr = g.createRadialGradient(-s * 0.1, -s * 0.15, s * 0.1, 0, 0, s);
    gr.addColorStop(0, '#9cc85a'); gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, s * 0.78, s * 0.56, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(s * 0.5, 0, s * 0.42, s * 0.48, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(58,92,30,0.6)';
    for (const [x, y, r] of [[-0.3, 0.15, 0.1], [-0.05, -0.22, 0.08], [0.1, 0.2, 0.07], [-0.45, -0.12, 0.07]]) { g.beginPath(); g.arc(x * s, y * s, r * s, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(210,226,140,0.55)'; g.lineWidth = Math.max(0.8, s * 0.06);
    g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(s * 0.3, 0); g.stroke();
    // 鼓起的鸣囊：嘴角两边吹出两个泡
    if (this.croak >= 0) {
      const ph = this.croak % 0.6 / 0.6, inf = Math.sin(ph * Math.PI);
      for (const side of [-1, 1]) {
        const bg = g.createRadialGradient(s * 0.78, side * s * 0.5, 0, s * 0.78, side * s * 0.5, s * 0.34 * inf + 0.5);
        bg.addColorStop(0, 'rgba(252,250,232,0.95)'); bg.addColorStop(1, 'rgba(226,222,180,0.85)');
        g.fillStyle = bg;
        g.beginPath(); g.arc(s * 0.78, side * s * 0.5, s * 0.34 * inf + 0.5, 0, TAU); g.fill();
      }
    }
    // 眼睛
    for (const side of [-1, 1]) {
      g.fillStyle = '#8fbd4c';
      g.beginPath(); g.arc(s * 0.62, side * s * 0.3, s * 0.19, 0, TAU); g.fill();
      if (this.blink > 0) {
        g.strokeStyle = dark; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(s * 0.5, side * s * 0.3); g.lineTo(s * 0.74, side * s * 0.3); g.stroke();
      } else {
        g.fillStyle = '#e2b43a';
        g.beginPath(); g.arc(s * 0.64, side * s * 0.3, s * 0.13, 0, TAU); g.fill();
        g.fillStyle = '#141410';
        g.beginPath(); g.ellipse(s * 0.65, side * s * 0.3, s * 0.05, s * 0.09, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(s * 0.6, side * s * 0.26, s * 0.035, 0, TAU); g.fill();
      }
    }
    g.restore();
    if (swim) {
      g.fillStyle = 'rgba(66,114,100,0.25)';
      g.beginPath(); g.ellipse(this.x, this.y, s * 0.8, s * 0.6, this.face, 0, TAU); g.fill();
    }
  }
}
function updateFrogs(dt) {
  const want = frogWant();
  if (frogs.length < want) frogs.push(new Frog());
  if (frogs.length > want) frogs.length = want;
  for (const f of frogs) f.update(dt);
}

/* 蜻蜓：偶尔飞来，悬停、疾飞，时不时点一下水 */
const DF = { timer: rand(12, 30) };
function dragonflyWeather() {
  return S.butterflies && season() !== 'winter' && ENV.dark < 0.3 && ENV.rain < 0.2 && ENV.snow < 0.1 && ENV.storm < 0.1;
}
class Dragonfly {
  constructor() {
    const side = (Math.random() * 4) | 0;
    this.x = side === 0 ? -30 : side === 1 ? W + 30 : rand(0, W);
    this.y = side === 2 ? -30 : side === 3 ? H + 30 : rand(0, H);
    this.s = rand(20, 26) * SCALE;
    const autumn = season() === 'autumn';
    this.color = autumn || Math.random() < 0.3 ? ['#c8412a', '#8e2416'] : Math.random() < 0.5 ? ['#3b78bd', '#1f3f6a'] : ['#4c9a5a', '#27562f'];
    this.a = 0; this.h = 1; this.lifeT = rand(25, 45);
    this.state = 'dart'; this.leaving = false; this.dead = false;
    this.seed = rand(0, TAU);
    this.pickTarget();
  }
  pickTarget(awayX, awayY) {
    if (awayX != null) {
      const a = Math.atan2(this.y - awayY, this.x - awayX) + rand(-0.5, 0.5);
      this.tx = clamp(this.x + Math.cos(a) * 260, 30, W - 30); this.ty = clamp(this.y + Math.sin(a) * 260, 30, H - 30);
    } else { this.tx = rand(W * 0.08, W * 0.92); this.ty = rand(H * 0.1, H * 0.9); }
    this.state = 'dart';
  }
  hit(x, y) { return Math.hypot(x - this.x, y - this.y) < this.s * 0.8; }
  scare(x, y) { this.pickTarget(x, y); }
  update(dt) {
    this.lifeT -= dt;
    if (this.lifeT < 0 && !this.leaving) {
      this.leaving = true;
      const a = Math.atan2(this.y - H / 2, this.x - W / 2);
      this.tx = W / 2 + Math.cos(a) * Math.hypot(W, H); this.ty = H / 2 + Math.sin(a) * Math.hypot(W, H);
      this.state = 'dart';
    }
    if (!this.leaving && pointer.inside && Math.hypot(pointer.x - this.x, pointer.y - this.y) < 90 && time - pointer.moved < 0.2) this.scare(pointer.x, pointer.y);
    if (this.state === 'hover') {
      this.hoverT -= dt;
      this.x += Math.sin(time * 2.3 + this.seed) * 6 * dt;
      this.y += Math.cos(time * 1.9 + this.seed) * 6 * dt;
      if (this.dips > 0) {
        this.dipP += dt / 0.4;
        this.h = 1 - 0.75 * Math.sin(Math.PI * clamp(this.dipP, 0, 1));
        if (!this.dipped && this.dipP >= 0.5) {
          this.dipped = true;
          addRipple(this.x - Math.cos(this.a) * this.s * 0.8, this.y - Math.sin(this.a) * this.s * 0.8, 20 * Math.sqrt(SCALE), 1.8, 0.7);
        }
        if (this.dipP >= 1.5) { this.dips--; this.dipP = 0; this.dipped = false; }
      } else this.h += (1 - this.h) * dt * 3;
      if (this.hoverT < 0 && this.dips <= 0) this.pickTarget();
    } else {
      const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - this.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.a += clamp(da, -dt * 9, dt * 9);
      const v = Math.min(d * 3.5, 280 * Math.sqrt(SCALE));
      this.x += dx / (d || 1) * v * dt; this.y += dy / (d || 1) * v * dt;
      this.h += (1 - this.h) * dt * 3;
      if (this.leaving) {
        if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) this.dead = true;
      } else if (d < 5) {
        this.state = 'hover'; this.hoverT = rand(0.6, 2.4);
        this.dips = Math.random() < 0.5 ? 1 + ((Math.random() * 3) | 0) : 0;
        this.dipP = 0; this.dipped = false;
      }
    }
  }
  draw(g) {
    const s = this.s, off = this.h * 46 + 4, flying = this.state === 'dart' || this.state === 'hover';
    g.save();
    g.translate(this.x + off * SUN.x, this.y + off * SUN.y); g.rotate(this.a);
    g.fillStyle = 'rgba(14,40,32,0.13)';
    g.fillRect(-s * 0.95, -s * 0.03, s * 1.1, s * 0.06);
    g.beginPath(); g.ellipse(0, 0, s * 0.12, s * 0.62, 0, 0, TAU); g.fill();
    g.restore();

    g.save();
    g.translate(this.x, this.y); g.rotate(this.a);
    const sc = 0.9 + this.h * 0.15; g.scale(sc, sc);
    // 翅膀：飞行时快速振动，画成半透明的虚影
    const jit = flying ? Math.sin(time * 90 + this.seed) * 0.12 : 0;
    for (const [x, side, ang] of [[0.02, 1, -0.12], [0.02, -1, 0.12], [-0.1, 1, 0.14], [-0.1, -1, -0.14]]) {
      for (const j of flying ? [jit, -jit] : [0]) {
        g.save(); g.translate(x * s, 0); g.rotate(side * (Math.PI / 2) + ang + j * side);
        g.fillStyle = flying ? 'rgba(226,238,244,0.22)' : 'rgba(226,238,244,0.35)';
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.6;
        g.beginPath(); g.ellipse(s * 0.34, 0, s * 0.36, s * 0.07, 0, 0, TAU); g.fill(); g.stroke();
        g.restore();
      }
    }
    // 腹部（一节一节）
    g.fillStyle = this.color[0];
    g.beginPath(); g.ellipse(-s * 0.52, 0, s * 0.45, s * 0.045, 0, 0, TAU); g.fill();
    g.strokeStyle = this.color[1]; g.lineWidth = 0.8;
    for (let i = 1; i < 7; i++) { const x = -s * (0.12 + i * 0.12); g.beginPath(); g.moveTo(x, -s * 0.045); g.lineTo(x, s * 0.045); g.stroke(); }
    g.fillStyle = this.color[1];
    g.beginPath(); g.ellipse(0, 0, s * 0.13, s * 0.09, 0, 0, TAU); g.fill();
    g.fillStyle = this.color[0];
    for (const side of [-1, 1]) { g.beginPath(); g.arc(s * 0.15, side * s * 0.055, s * 0.07, 0, TAU); g.fill(); }
    g.restore();
  }
}
function updateDragonflies(dt) {
  DF.timer -= dt;
  if (DF.timer < 0) {
    DF.timer = rand(50, 120);
    if (dragonflyWeather() && dragonflies.length < 2) dragonflies.push(new Dragonfly());
  }
  if (!dragonflyWeather()) for (const d of dragonflies) if (!d.leaving) d.lifeT = Math.min(d.lifeT, 0);
  for (const d of dragonflies) d.update(dt);
  dragonflies = dragonflies.filter(d => !d.dead);
}

function updateSurprises(dt) {
  updatePress(dt);
  updateLeap(dt);
  updateDroplets(dt);
  updateBubbles(dt);
  updateLanterns(dt);
  updateFrogs(dt);
  updateDragonflies(dt);
}
