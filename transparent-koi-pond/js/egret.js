/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   白鹭飞过：只看得见影子掠过水面，鱼群四散；偶尔落下一根白羽
   还有金色的光点（金龙鲤跃龙门时用）
   ============================================================ */
let feathers = [], sparkles = [];
const EGRET = { next: rand(420, 900), b: null };

function egretWeather() { return ENV.dark < 0.35 && ENV.rain < 0.3 && ENV.snow < 0.3 && ENV.fog < 0.5; }

function spawnEgret() {
  if (EGRET.b) return EGRET.b;
  const span = rand(190, 240) * SCALE;
  const ltr = Math.random() < 0.5;
  const y0 = rand(H * 0.15, H * 0.85), y1 = clamp(y0 + rand(-0.4, 0.4) * H, H * 0.1, H * 0.9);
  const x0 = ltr ? -span : W + span, x1 = ltr ? W + span : -span;
  const speed = rand(300, 380) * SCALE;
  EGRET.b = {
    x0, y0, x1, y1, bend: rand(-0.12, 0.12) * H, t: 0,
    dur: Math.hypot(x1 - x0, y1 - y0) / speed, span,
    x: x0, y: y0, a: Math.atan2(y1 - y0, x1 - x0),
    flap: rand(0, TAU), rate: rand(2.0, 2.6), glide: 0,
    feather: Math.random() < 0.55 ? rand(0.3, 0.7) : -1,
    scared: new Set(), noted: false,
  };
  return EGRET.b;
}

function updateEgret(dt) {
  if (!EGRET.b) {
    if (egretWeather()) EGRET.next -= dt;
    if (EGRET.next < 0) { EGRET.next = rand(900, 2400); spawnEgret(); }
    return;
  }
  const b = EGRET.b;
  const before = b.t;
  b.t += dt / b.dur;
  const px = b.x, py = b.y;
  b.x = lerp(b.x0, b.x1, b.t);
  b.y = lerp(b.y0, b.y1, b.t) + Math.sin(b.t * Math.PI) * b.bend;
  b.a = Math.atan2(b.y - py, b.x - px);
  // 扇几下，滑翔一会儿
  b.glide -= dt;
  if (b.glide <= 0) {
    const was = Math.sin(b.flap);
    b.flap += dt * b.rate * TAU;
    if (was < 0 && Math.sin(b.flap) >= 0) {
      sndWhoosh(b.x);
      if (Math.random() < 0.18) b.glide = rand(0.8, 1.6);
    }
  }
  // 影子掠过时，底下的鱼吓得散开，乌龟缩头，青蛙跳水
  const r = b.span * 0.75;
  for (const f of fish) {
    if (b.scared.has(f) || f.leap) continue;
    if (Math.hypot(f.x - b.x, f.y - b.y) < r) { f.startle(b.x, b.y, rand(0.9, 1.6)); b.scared.add(f); }
  }
  for (const t of turtles) if (!b.scared.has(t) && Math.hypot(t.x - b.x, t.y - b.y) < r) { t.poke(); b.scared.add(t); }
  for (const fr of frogs) if (!b.scared.has(fr) && fr.state === 'sit' && Math.hypot(fr.x - b.x, fr.y - b.y) < r * 0.8) { fr.leaveToWater(); b.scared.add(fr); }
  if (!b.noted && b.t > 0.4) { b.noted = true; bookMoment('egret'); }
  if (b.feather > 0 && before < b.feather && b.t >= b.feather) dropFeather(b.x, b.y, Math.cos(b.a), Math.sin(b.a));
  if (b.t >= 1) EGRET.b = null;
}

// 从上往下看的白鹭：翅膀随扇动变宽变窄，脖子缩着，脚拖在后面
// 先在小画布上画成不透明的剪影，再整体半透明地叠上去，重叠处不会有深浅
let egretCv = null;
function drawEgret(g) {
  const b = EGRET.b;
  if (!b) return;
  const s = b.span, size = Math.ceil(s * 1.15);
  if (!egretCv || egretCv.width !== size) egretCv = mkCanvas(size, size);
  const e = egretCv.getContext('2d');
  e.setTransform(1, 0, 0, 1, 0, 0);
  e.clearRect(0, 0, size, size);
  e.translate(size / 2, size / 2);
  e.rotate(b.a);
  e.fillStyle = e.strokeStyle = 'rgb(12,34,28)';
  const spread = b.glide > 0 ? 1 : 0.62 + 0.38 * Math.cos(b.flap);
  const sweep = b.glide > 0 ? 0 : Math.sin(b.flap) * 0.06;
  e.beginPath(); e.ellipse(0, 0, s * 0.17, s * 0.05, 0, 0, TAU); e.fill();           // 身体
  e.beginPath(); e.ellipse(s * 0.2, 0, s * 0.055, s * 0.028, 0, 0, TAU); e.fill();   // 缩着的脖子和头
  e.beginPath(); e.moveTo(s * 0.24, -s * 0.01); e.lineTo(s * 0.37, 0); e.lineTo(s * 0.24, s * 0.01); e.fill();   // 喙
  for (const side of [-1, 1]) {
    const w = s * 0.5 * spread * side;
    e.beginPath();
    e.moveTo(s * 0.07, side * s * 0.03);
    e.quadraticCurveTo(s * (0.12 + sweep), w * 0.5, s * (0.01 + sweep), w);               // 前缘到翼尖
    e.quadraticCurveTo(s * (-0.1 + sweep), w * 1.02, s * (-0.17 + sweep * 0.5), w * 0.7);  // 圆圆的翼尖和飞羽
    e.quadraticCurveTo(s * -0.2, w * 0.3, s * -0.1, side * s * 0.03);                     // 后缘
    e.fill();
  }
  e.lineWidth = Math.max(1.5, s * 0.012);
  e.lineCap = 'round';
  e.beginPath();
  for (const side of [-1, 1]) { e.moveTo(-s * 0.14, side * s * 0.012); e.lineTo(-s * 0.45, side * s * 0.024); }
  e.stroke();
  // 影子落在鸟的斜下方，边缘是虚的
  const off = 26 * SCALE;
  g.save();
  g.globalAlpha = 0.26 * (1 - ENV.cloud * 0.5);
  g.filter = `blur(${Math.round(5 * SCALE)}px)`;
  g.drawImage(egretCv, b.x + off * SUN.x - size / 2, b.y + off * SUN.y - size / 2);
  g.restore();
}

/* 白羽：飘下来，落到水面上漂着 */
function dropFeather(x, y, dx, dy) {
  feathers.push({ x, y, vx: dx * 40, vy: dy * 40, h: 1, a: rand(0, TAU), va: 0, ph: rand(0, TAU), s: rand(24, 32) * SCALE, age: 0, landed: false });
  if (feathers.length > 3) feathers.shift();
}
function updateFeathers(dt) {
  for (const f of feathers) {
    f.age += dt;
    if (!f.landed) {
      f.h -= dt / 3.4;
      f.vx *= Math.exp(-dt * 0.8); f.vy *= Math.exp(-dt * 0.8);
      f.x += f.vx * dt + Math.sin(time * 1.7 + f.ph) * 34 * dt;
      f.y += f.vy * dt + Math.cos(time * 1.3 + f.ph) * 10 * dt;
      f.a += Math.sin(time * 1.7 + f.ph) * dt * 0.9;
      if (f.h <= 0) {
        f.h = 0; f.landed = true; f.age = 0; f.vx = 0; f.vy = 0;
        addRipple(f.x, f.y, 30 * SCALE, 2, 0.6);
        sndPlip(f.x, 0.08, 900);
      }
    } else {
      // 跟花瓣一样随风慢慢漂
      f.vx += ((4 + ENV.wind * 10) - f.vx) * dt * 0.3;
      f.vx *= Math.exp(-dt * 0.4); f.vy *= Math.exp(-dt * 0.6);
      f.x += f.vx * dt; f.y += f.vy * dt + Math.sin(time * 0.4 + f.ph) * 2 * dt;
      f.a += f.va * dt; f.va *= Math.exp(-dt * 0.8);
      if (f.x > W + 40) f.dead = true;
    }
    if (f.landed && f.age > 100) f.dead = true;
  }
  feathers = feathers.filter(f => !f.dead);
}
function pushFeathers(x, y, reach, power) {
  for (const f of feathers) {
    if (!f.landed) continue;
    const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
    if (d < reach && d > 0) { f.vx += dx / d * power * (1 - d / reach); f.vy += dy / d * power * (1 - d / reach); f.va += rand(-0.6, 0.6); }
  }
}
function drawFeather(g, f) {
  const s = f.s * (1 + f.h * 0.9);
  const alpha = f.landed ? Math.min(1, (100 - f.age) / 6) : 1;
  g.save();
  g.globalAlpha = alpha;
  // 影子：飘得越高，离得越远
  const off = 3 + f.h * 60 * SCALE;
  g.translate(f.x + off * SUN.x, f.y + off * SUN.y); g.rotate(f.a);
  g.fillStyle = `rgba(12,34,28,${0.16 * (1 - f.h * 0.5)})`;
  g.beginPath(); g.ellipse(0, 0, s * 0.45, s * 0.1, 0, 0, TAU); g.fill();
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.translate(f.x, f.y); g.rotate(f.a);
  g.fillStyle = 'rgba(250,252,249,0.94)';
  g.beginPath();
  g.moveTo(-s * 0.36, 0);
  g.quadraticCurveTo(-s * 0.05, -s * 0.17, s * 0.5, -s * 0.01);
  g.quadraticCurveTo(-s * 0.05, s * 0.12, -s * 0.36, 0);
  g.fill();
  // 根部的绒毛
  g.strokeStyle = 'rgba(250,252,249,0.7)'; g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 5; i++) { const k = -0.36 - i * 0.03; g.moveTo(s * k, 0); g.lineTo(s * (k - 0.06), (i - 2) * s * 0.03); }
  g.stroke();
  g.strokeStyle = 'rgba(196,204,198,0.95)'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(-s * 0.5, 0); g.quadraticCurveTo(0, -s * 0.02, s * 0.5, -s * 0.01); g.stroke();
  g.restore();
}
function drawFloatingFeathers(g) { for (const f of feathers) if (f.landed) drawFeather(g, f); }
function drawFallingFeathers(g) { for (const f of feathers) if (!f.landed) drawFeather(g, f); }

/* 金色光点 */
function sparkleBurst(x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(20, 120) * (spread || 1) * Math.sqrt(SCALE);
    sparkles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(1.2, 2.6), r: rand(2, 5) * SCALE, ph: rand(0, TAU) });
  }
}
function updateSparkles(dt) {
  for (const p of sparkles) {
    p.age += dt;
    p.vx *= Math.exp(-dt * 1.5); p.vy *= Math.exp(-dt * 1.5);
    p.x += p.vx * dt; p.y += p.vy * dt - 8 * dt;
  }
  sparkles = sparkles.filter(p => p.age < p.life);
}
function drawSparkles(g) {
  if (!sparkles.length) return;
  g.globalCompositeOperation = 'lighter';
  for (const p of sparkles) {
    const k = 1 - p.age / p.life, tw = 0.6 + 0.4 * Math.sin(time * 14 + p.ph);
    const r = p.r * (0.6 + k * 0.6);
    g.fillStyle = `rgba(255,214,120,${0.35 * k})`;
    g.beginPath(); g.arc(p.x, p.y, r * 2.4, 0, TAU); g.fill();
    g.strokeStyle = `rgba(255,244,210,${0.9 * k * tw})`; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(p.x - r * 1.6, p.y); g.lineTo(p.x + r * 1.6, p.y); g.moveTo(p.x, p.y - r * 1.6); g.lineTo(p.x, p.y + r * 1.6); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}

function updateSky(dt) {
  updateEgret(dt);
  updateFeathers(dt);
  updateSparkles(dt);
}
