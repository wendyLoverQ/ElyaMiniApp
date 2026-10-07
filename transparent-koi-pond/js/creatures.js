/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   乌龟、蝴蝶、萤火虫、爱心
   ============================================================ */

class Turtle {
  constructor() {
    this.S = rand(28, 40) * SCALE;
    this.x = rand(W * 0.15, W * 0.85); this.y = rand(H * 0.15, H * 0.85);
    this.a = rand(0, TAU);
    this.speed = 0;
    this.cruise = rand(9, 14) * Math.sqrt(SCALE);
    this.phase = rand(0, TAU);
    this.z = rand(0.15, 0.55);
    this.state = 'swim'; this.stateT = rand(8, 20);
    this.retract = 0; this.hideT = 0; this.wOff = 0;
    this.breath = rand(20, 60);
    this.redEar = Math.random() < 0.6;   // 巴西龟耳后有红斑，草龟没有
    this.look = 0;
    this.shellHue = rand(-8, 8);
  }

  hit(x, y) { return Math.hypot(x - this.x, y - this.y) < this.S * 0.6; }

  poke() {
    this.hideT = rand(3.5, 5.5);
    addRipple(this.x, this.y, this.S * 1.4, 1.6, 0.7);
  }

  update(dt) {
    if (this.hideT > 0) {
      this.hideT -= dt;
      this.retract = Math.min(1, this.retract + dt * 5);
      this.speed *= Math.exp(-dt * 3);
    } else {
      this.retract = Math.max(0, this.retract - dt * 1.2);
      this.stateT -= dt;
      if (this.stateT < 0) {
        if (this.state === 'swim') { this.state = 'rest'; this.stateT = rand(3, 9); }
        else { this.state = 'swim'; this.stateT = rand(10, 25); }
      }
      let sx = Math.cos(this.a), sy = Math.sin(this.a);
      this.wOff = clamp((this.wOff + (Math.random() - 0.5) * dt * 2) * (1 - dt * 0.2), -1, 1);
      sx += Math.cos(this.a + this.wOff) * 0.8; sy += Math.sin(this.a + this.wOff) * 0.8;
      const m = Math.min(110, Math.min(W, H) * 0.1);
      if (this.x < m) sx += (m - this.x) / m * 2.5;
      if (this.x > W - m) sx -= (this.x - (W - m)) / m * 2.5;
      if (this.y < m) sy += (m - this.y) / m * 2.5;
      if (this.y > H - m) sy -= (this.y - (H - m)) / m * 2.5;

      let target = this.state === 'rest' ? 0 : this.cruise * S.swimSpeed;
      // 鼠标停在旁边时，停下来扭头看你
      let look = 0;
      if (pointer.inside && time - pointer.moved > 0.5) {
        const dx = pointer.x - this.x, dy = pointer.y - this.y;
        if (Math.hypot(dx, dy) < this.S * 3.5) {
          target = 0;
          let da = Math.atan2(dy, dx) - this.a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          look = clamp(da, -0.75, 0.75);
        }
      }
      this.look += (look - this.look) * Math.min(1, dt * 3);
      // 歇着的时候偶尔吐一串泡泡
      if (this.state === 'rest' && Math.random() < dt * 0.12) {
        const hx = this.x + Math.cos(this.a) * this.S * 0.6, hy = this.y + Math.sin(this.a) * this.S * 0.6;
        for (let i = 0; i < 3; i++) setTimeout(() => addBubble(hx + rand(-4, 4), hy + rand(-4, 4)), i * 260);
      }
      // 乌龟也抢鱼食，只是慢
      let best = null, bd = 260 * 260;
      for (const p of food) {
        if (p.dead) continue;
        const d2 = (p.x - this.x) ** 2 + (p.y - this.y) ** 2;
        if (d2 < bd) { bd = d2; best = p; }
      }
      if (best) {
        const d = Math.sqrt(bd) || 1;
        sx += (best.x - this.x) / d * 2.5; sy += (best.y - this.y) / d * 2.5;
        target = this.cruise * 1.6 * S.swimSpeed;
        if (d < this.S * 0.45) { best.dead = true; addRipple(best.x, best.y, 14, 1.1, 0.6); }
      }
      let da = Math.atan2(sy, sx) - this.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.a += clamp(da * 2 * dt, -0.8 * dt, 0.8 * dt);
      this.speed += (target - this.speed) * Math.min(1, dt * 1.2);
    }
    this.x = clamp(this.x + Math.cos(this.a) * this.speed * dt, -this.S, W + this.S);
    this.y = clamp(this.y + Math.sin(this.a) * this.speed * dt, -this.S, H + this.S);
    this.phase += dt * (0.8 + this.speed * 0.28) * (1 - this.retract);

    // 隔一阵子浮上来换气
    this.breath -= dt;
    if (this.breath < 0) {
      this.breath = rand(30, 90);
      addRipple(this.x + Math.cos(this.a) * this.S * 0.6, this.y + Math.sin(this.a) * this.S * 0.6, this.S * 0.9, 1.8, 0.6);
    }
  }

  drawShadow(g) {
    const off = 4 + (1 - this.z) * 14;
    g.fillStyle = `rgba(14,40,32,${0.2 * (1 - ENV.cloud * 0.5)})`;
    g.beginPath();
    g.ellipse(this.x + off * SUN.x, this.y + off * SUN.y, this.S * 0.58, this.S * 0.47, this.a, 0, TAU);
    g.fill();
  }

  draw(g) {
    const S_ = this.S, r = this.retract, sw = Math.sin(this.phase);
    const skin = '#7f8f4e', skinDark = '#56642f';
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.a);

    // 四肢：对角的两条腿同步划水
    const legs = [[S_ * 0.22, 1, true], [S_ * 0.22, -1, true], [-S_ * 0.26, 1, false], [-S_ * 0.26, -1, false]];
    for (const [lx, side, front] of legs) {
      const stroke = sw * (front ? 1 : -1) * side;
      const ang = side * (front ? 0.95 + stroke * 0.5 : 2.25 - stroke * 0.4);
      const len = S_ * (front ? 0.34 : 0.26) * (1 - r * 0.8), wid = S_ * (front ? 0.13 : 0.12);
      g.save();
      g.translate(lx, side * S_ * 0.3);
      g.rotate(ang);
      g.beginPath(); g.ellipse(len * 0.5, 0, len * 0.5, wid * 0.5, 0, 0, TAU);
      g.fillStyle = skin; g.fill();
      g.strokeStyle = skinDark; g.lineWidth = 0.8; g.stroke();
      g.restore();
    }
    // 尾巴
    g.beginPath();
    g.moveTo(-S_ * 0.44, -S_ * 0.05); g.lineTo(-S_ * (0.62 - r * 0.15), 0); g.lineTo(-S_ * 0.44, S_ * 0.05);
    g.fillStyle = skin; g.fill();

    // 头
    const hx = S_ * (0.56 - r * 0.32), hsw = (Math.sin(this.phase * 0.5) * 0.12 * (1 - Math.abs(this.look)) + this.look) * (1 - r);
    g.save();
    g.translate(S_ * 0.36, 0); g.rotate(hsw); g.translate(hx - S_ * 0.36, 0);
    g.beginPath(); g.ellipse(0, 0, S_ * 0.17, S_ * 0.125, 0, 0, TAU);
    g.fillStyle = skin; g.fill();
    g.strokeStyle = 'rgba(222,206,98,0.75)'; g.lineWidth = Math.max(0.8, S_ * 0.02);
    for (const yy of [-0.05, 0, 0.05]) { g.beginPath(); g.moveTo(-S_ * 0.12, yy * S_); g.lineTo(S_ * 0.1, yy * S_ * 0.6); g.stroke(); }
    if (this.redEar) {
      g.fillStyle = '#c8452c';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-S_ * 0.05, s * S_ * 0.085, S_ * 0.05, S_ * 0.025, 0, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#1b1c16';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(S_ * 0.06, s * S_ * 0.075, S_ * 0.025, 0, TAU); g.fill(); }
    g.restore();

    // 龟壳
    const rx = S_ * 0.5, ry = S_ * 0.41;
    const shell = new Path2D(); shell.ellipse(0, 0, rx, ry, 0, 0, TAU);
    const gr = g.createRadialGradient(-S_ * 0.1, -S_ * 0.08, S_ * 0.05, 0, 0, rx);
    gr.addColorStop(0, `hsl(${72 + this.shellHue},34%,42%)`);
    gr.addColorStop(1, `hsl(${76 + this.shellHue},38%,24%)`);
    g.fillStyle = gr; g.fill(shell);
    g.save(); g.clip(shell);
    // 盾片：中间一列、两侧各三块，每块中心提亮
    const plates = [[-0.26, 0], [0, 0], [0.26, 0], [-0.24, 0.5], [0.02, 0.56], [0.26, 0.5], [-0.24, -0.5], [0.02, -0.56], [0.26, -0.5]];
    for (const [px, py] of plates) {
      const cx = px * rx, cy = py * ry, pr = S_ * 0.13;
      const pg = g.createRadialGradient(cx, cy, 0, cx, cy, pr);
      pg.addColorStop(0, 'rgba(176,184,98,0.45)'); pg.addColorStop(1, 'rgba(176,184,98,0)');
      g.fillStyle = pg; g.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
    }
    g.strokeStyle = 'rgba(38,46,20,0.55)'; g.lineWidth = Math.max(0.8, S_ * 0.022);
    g.beginPath(); g.ellipse(0, 0, rx * 0.74, ry * 0.68, 0, 0, TAU); g.stroke();
    g.beginPath();
    for (const x of [-0.13, 0.13]) { g.moveTo(x * rx * 2, -ry * 0.68); g.quadraticCurveTo(x * rx * 2.2, 0, x * rx * 2, ry * 0.68); }
    g.moveTo(-rx * 0.74, 0); g.lineTo(rx * 0.74, 0);
    for (const a of [0.55, 1.57, 2.6]) for (const s of [-1, 1]) {
      g.moveTo(Math.cos(a) * rx * 0.74, s * Math.sin(a) * ry * 0.68);
      g.lineTo(Math.cos(a) * rx, s * Math.sin(a) * ry);
    }
    g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(34,40,16,0.8)'; g.lineWidth = 1.2; g.stroke(shell);
    g.restore();

    if (this.z > 0.05) {
      g.fillStyle = `rgba(66,114,100,${this.z * 0.38})`;
      g.beginPath(); g.ellipse(this.x, this.y, rx * 1.05, ry * 1.05, this.a, 0, TAU); g.fill();
    }
  }
}

/* Codex / GPT / 模型 ID 无法确认: butterflies fly above the open water. */
const BF_PALETTES = [
  { wing: '#f0a23a', inner: '#c96a1c', edge: '#2a1f16', spot: '#fff4e0' },
  { wing: '#f7f3e8', inner: '#e8e0cc', edge: '#4a4a48', spot: '#2a2a2a' },
  { wing: '#86b8ea', inner: '#4f82c0', edge: '#1f2a44', spot: '#e8f2ff' },
  { wing: '#f3d54c', inner: '#d6a92a', edge: '#2e2716', spot: '#f7ecc0' },
];
function butterflyWeather() {
  return S.butterflies && ENV.dark < 0.35 && ENV.rain < 0.2 && ENV.snow < 0.2 && ENV.storm < 0.1 && ENV.fog < 0.6;
}

class Butterfly {
  constructor(fromEdge) {
    this.s = rand(13, 19) * SCALE;
    this.pal = BF_PALETTES[(Math.random() * BF_PALETTES.length) | 0];
    if (fromEdge) {
      const side = (Math.random() * 4) | 0;
      this.x = side === 0 ? -30 : side === 1 ? W + 30 : rand(0, W);
      this.y = side === 2 ? -30 : side === 3 ? H + 30 : rand(0, H);
    } else { this.x = rand(W * 0.1, W * 0.9); this.y = rand(H * 0.1, H * 0.9); }
    this.a = rand(0, TAU);
    this.speed = rand(55, 80) * Math.sqrt(SCALE);
    this.flap = rand(0, TAU);
    this.h = 1;
    this.state = 'fly';
    this.seed = rand(0, 100);
    this.leaving = false; this.dead = false;
    this.pickTarget();
  }

  // Codex / GPT / 模型 ID 无法确认: butterflies fly between open-water targets without leaf landing sites.
  pickTarget() {
    this.tx = rand(W * 0.1, W * 0.9); this.ty = rand(H * 0.1, H * 0.9);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true; this.state = 'fly';
    const a = Math.atan2(this.y - H / 2, this.x - W / 2);
    this.tx = W / 2 + Math.cos(a) * Math.hypot(W, H); this.ty = H / 2 + Math.sin(a) * Math.hypot(W, H);
  }

  update(dt) {
    const near = pointer.inside && Math.hypot(pointer.x - this.x, pointer.y - this.y) < 90;
    this.flap += dt * 50;
    this.h = Math.min(1, this.h + dt * 1.5);
    const tx = this.tx, ty = this.ty;
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) + Math.sin(time * 3 + this.seed) * 0.6 * Math.min(1, d / 60) - this.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    this.a += clamp(da * 3 * dt, -4 * dt, 4 * dt);
    const sp = this.speed;
    this.x += Math.cos(this.a) * sp * dt + ENV.wind * 12 * dt;
    this.y += Math.sin(this.a) * sp * dt;
    if (near && pointer.speed > 600 && time - pointer.moved < 0.1) { this.tx = this.x - (pointer.x - this.x) * 3; this.ty = this.y - (pointer.y - this.y) * 3; }
    if (this.leaving) {
      if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) this.dead = true;
    } else if (d < 8) this.pickTarget();
  }

  wing(g, open) {
    const s = this.s, P = this.pal;
    const fore = new Path2D();
    fore.moveTo(0, -s * 0.15);
    fore.bezierCurveTo(s * 0.4, -s * 1.0, s * 1.05, -s * 0.95, s * 0.95, -s * 0.35);
    fore.bezierCurveTo(s * 0.85, -s * 0.05, s * 0.4, 0, 0, s * 0.02);
    const hind = new Path2D();
    hind.moveTo(0, 0);
    hind.bezierCurveTo(s * 0.6, s * 0.05, s * 0.85, s * 0.45, s * 0.55, s * 0.75);
    hind.bezierCurveTo(s * 0.35, s * 0.95, s * 0.1, s * 0.6, 0, s * 0.3);
    for (const p of [hind, fore]) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, s);
      gr.addColorStop(0, P.inner); gr.addColorStop(0.7, P.wing);
      g.fillStyle = gr; g.fill(p);
      g.save(); g.clip(p);
      g.strokeStyle = P.edge; g.lineWidth = s * 0.18; g.stroke(p);
      g.restore();
    }
    g.fillStyle = P.spot;
    for (const [x, y] of [[0.8, -0.55], [0.9, -0.38], [0.62, -0.72], [0.5, 0.62]]) {
      g.beginPath(); g.arc(x * s, y * s, s * 0.045, 0, TAU); g.fill();
    }
    g.strokeStyle = P.edge; g.globalAlpha = 0.45; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(0, -s * 0.1); g.lineTo(s * 0.8, -s * 0.6); g.moveTo(0, 0); g.lineTo(s * 0.7, -s * 0.2); g.moveTo(0, s * 0.1); g.lineTo(s * 0.5, s * 0.55);
    g.stroke(); g.globalAlpha = 1;
  }

  draw(g) {
    const open = 0.12 + 0.88 * Math.abs(Math.cos(this.flap));
    const sc = 1 + this.h * 0.25;
    // 水面上的影子，飞得越高离得越远
    const off = this.h * 40 + 3;
    g.save();
    g.translate(this.x + off * SUN.x, this.y + off * SUN.y);
    g.rotate(this.a + Math.PI / 2);
    g.fillStyle = 'rgba(14,40,32,0.14)';
    g.beginPath(); g.ellipse(0, 0, this.s * open * sc, this.s * 0.8 * sc, 0, 0, TAU); g.fill();
    g.restore();

    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.a + Math.PI / 2);
    g.scale(sc, sc);
    for (const side of [1, -1]) { g.save(); g.scale(side * open, 1); this.wing(g, open); g.restore(); }
    const s = this.s;
    g.fillStyle = '#2a2420';
    g.beginPath(); g.ellipse(0, s * 0.1, s * 0.07, s * 0.45, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(0, -s * 0.38, s * 0.08, 0, TAU); g.fill();
    g.strokeStyle = '#2a2420'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(0, -s * 0.42); g.lineTo(-s * 0.25, -s * 0.8); g.moveTo(0, -s * 0.42); g.lineTo(s * 0.25, -s * 0.8); g.stroke();
    g.restore();
  }
}

function updateButterflies(dt) {
  const ok = butterflyWeather();
  const want = ok ? Math.max(2, Math.round(W * H / 700000) + 1) : 0;
  const active = butterflies.filter(b => !b.leaving).length;
  if (active < want && Math.random() < dt * 0.25) butterflies.push(new Butterfly(true));
  if (active > want) { const b = butterflies.find(b => !b.leaving); if (b) b.leave(); }
  for (const b of butterflies) b.update(dt);
  butterflies = butterflies.filter(b => !b.dead);
}

/* 萤火虫：天黑后出现，画在光照之后，所以会“亮” */
let glowSprite = null;
function renderGlow() {
  const r = 18, c = mkCanvas(r * 2 * DPR, r * 2 * DPR), g = c.getContext('2d');
  g.scale(DPR, DPR);
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(236,255,170,1)');
  gr.addColorStop(0.18, 'rgba(206,255,120,0.75)');
  gr.addColorStop(0.5, 'rgba(170,240,90,0.18)');
  gr.addColorStop(1, 'rgba(170,240,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  glowSprite = c;
}

function updateFireflies(dt) {
  const want = ENV.dark > 0.55 && ENV.rain < 0.4 && ENV.snow < 0.3 ? Math.round(clamp(W * H / 110000, 8, 24)) : 0;
  while (fireflies.length < want) fireflies.push({ x: rand(0, W), y: rand(0, H), vx: 0, vy: 0, ph: rand(0, TAU), rate: rand(1.2, 2.4), life: 0 });
  for (const f of fireflies) {
    f.vx = (f.vx + (Math.random() - 0.5) * 40 * dt) * Math.exp(-dt * 0.8);
    f.vy = (f.vy + (Math.random() - 0.5) * 40 * dt) * Math.exp(-dt * 0.8);
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
    if (f.y < -20) f.y = H + 20; if (f.y > H + 20) f.y = -20;
    f.life = want ? Math.min(1, f.life + dt * 0.4) : f.life - dt * 0.4;
  }
  if (!want) fireflies = fireflies.filter(f => f.life > 0);
}

function drawFireflies(g) {
  if (!fireflies.length) return;
  g.globalCompositeOperation = 'lighter';
  const r = 18;
  for (const f of fireflies) {
    const b = Math.pow(Math.max(0, Math.sin(time * f.rate + f.ph)), 3) * clamp(f.life, 0, 1);
    if (b < 0.02) continue;
    g.globalAlpha = b;
    g.drawImage(glowSprite, f.x - r, f.y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

/* 点了自己的锦鲤会冒出小爱心 */
function spawnHearts(x, y) {
  for (let i = 0; i < 5; i++) hearts.push({ x: x + rand(-10, 10), y: y + rand(-6, 6), vx: rand(-12, 12), vy: rand(-46, -28), age: -i * 0.08, life: 1.6, s: rand(6, 10) });
}
function updateHearts(dt) {
  for (const h of hearts) { h.age += dt; if (h.age > 0) { h.x += h.vx * dt; h.y += h.vy * dt; h.vy *= Math.exp(-dt * 0.6); } }
  hearts = hearts.filter(h => h.age < h.life);
}
function drawHearts(g) {
  for (const h of hearts) {
    if (h.age < 0) continue;
    const k = h.age / h.life, s = h.s * (0.6 + 0.4 * Math.min(1, k * 4));
    // Codex / GPT / 模型 ID 无法确认: rising hearts disappear while their full outline remains visible.
    g.globalAlpha = (1 - k) * frameOpacity(frameCircle(h.x, h.y, s * 1.1));
    g.fillStyle = '#f07a98';
    g.beginPath();
    g.moveTo(h.x, h.y + s * 0.35);
    g.bezierCurveTo(h.x - s, h.y - s * 0.3, h.x - s * 0.45, h.y - s, h.x, h.y - s * 0.45);
    g.bezierCurveTo(h.x + s * 0.45, h.y - s, h.x + s, h.y - s * 0.3, h.x, h.y + s * 0.35);
    g.fill();
  }
  g.globalAlpha = 1;
}
