/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   锦鲤
   ============================================================ */
const WHITE_FIN = 'rgba(245,241,233,0.55)';
function patches(R, c, count, rmin, rmax, headFirst) {
  const out = [];
  for (let p = 0; p < count; p++) {
    const t0 = headFirst && p === 0 ? 0.08 + R() * 0.06 : 0.18 + R() * 0.6;
    const s0 = (R() - 0.5) * 1.1;
    const n = 3 + ((R() * 3) | 0);
    for (let i = 0; i < n; i++) out.push({ t: clamp(t0 + (R() - 0.5) * 0.16, 0.02, 0.95), s: s0 + (R() - 0.5) * 0.9, r: rmin + R() * (rmax - rmin), c });
  }
  return out;
}
// 鳞片网纹（孔雀、松叶）
function scaleNet(c) {
  const out = [];
  for (let i = 0, t = 0.16; t < 0.86; t += 0.055, i++)
    for (let s = -0.75 + (i % 2) * 0.25; s <= 0.8; s += 0.5) out.push({ t, s, r: 0.017, c });
  return out;
}
// w 是池中出现的权重；w 为 0 的只会作为客人来访
const VARIETIES = [
  { name: '红白', w: 6, base: '#f3efe7', fin: WHITE_FIN, gen: R => patches(R, '#d8452c', 2 + ((R() * 3) | 0), 0.07, 0.12, true) },
  { name: '丹顶', w: 1, base: '#f5f1ea', fin: WHITE_FIN, gen: () => [{ t: 0.09, s: 0, r: 0.075, c: '#d93a28' }] },
  { name: '大正三色', w: 3, base: '#f2ede3', fin: WHITE_FIN, gen: R => [...patches(R, '#d6492b', 2 + ((R() * 2) | 0), 0.07, 0.11, true), ...patches(R, '#1b1d20', 2, 0.028, 0.05)] },
  { name: '昭和三色', w: 2, base: '#1d1f23', fin: 'rgba(40,42,46,0.55)', gen: R => [...patches(R, '#d8492c', 2 + ((R() * 2) | 0), 0.07, 0.12, true), ...patches(R, '#eee8dc', 1 + ((R() * 2) | 0), 0.06, 0.1)] },
  { name: '黄金', w: 3, base: '#e9b54e', fin: 'rgba(242,200,110,0.55)', sheen: true },
  { name: '白金', w: 1, base: '#e6eae7', fin: 'rgba(240,244,242,0.5)', sheen: true },
  { name: '绯鲤', w: 2, base: '#e45a2c', fin: 'rgba(236,122,82,0.5)' },
  { name: '茶鲤', w: 1, base: '#9b6b44', fin: 'rgba(160,118,78,0.5)' },
  { name: '乌鸦', w: 2, base: '#26282c', fin: 'rgba(40,42,46,0.6)' },
  { name: '秋翠', w: 1, base: '#8ea2ae', fin: 'rgba(164,180,190,0.5)', gen: () => {
      const out = [];
      for (let t = 0.3; t < 0.75; t += 0.09) out.push({ t, s: 1.0, r: 0.05, c: '#e0763a' }, { t, s: -1.0, r: 0.05, c: '#e0763a' });
      for (let t = 0.14; t < 0.82; t += 0.068) out.push({ t, s: 0, r: 0.02, c: '#3d5566' });
      return out;
    } },
  { name: '九纹龙', w: 0, rarity: 2, base: '#f0ece4', fin: 'rgba(60,62,66,0.5)', gen: R => patches(R, '#1c1e22', 3 + ((R() * 2) | 0), 0.07, 0.13) },
  { name: '白写', w: 0, rarity: 2, base: '#1c1e22', fin: 'rgba(235,232,224,0.5)', gen: R => patches(R, '#eeeae1', 2, 0.045, 0.08, true) },
  { name: '孔雀', w: 0, rarity: 2, base: '#dde2dc', fin: 'rgba(236,200,160,0.5)', sheen: true, gen: R => [...patches(R, '#e2742f', 2 + ((R() * 2) | 0), 0.07, 0.12, true), ...scaleNet('rgba(64,70,66,0.3)')] },
  { name: '松叶', w: 0, rarity: 2, base: '#e3ad4a', fin: 'rgba(240,196,110,0.5)', sheen: true, gen: () => scaleNet('rgba(92,56,20,0.42)') },
  { name: '银鳞红白', w: 0, rarity: 2, base: '#f5f2eb', fin: WHITE_FIN, glint: true, gen: R => patches(R, '#d8452c', 2 + ((R() * 3) | 0), 0.07, 0.12, true) },
  { name: '落叶时雨', w: 0, rarity: 2, base: '#8d9ca6', fin: 'rgba(150,166,176,0.5)', gen: R => patches(R, '#8a5a36', 2 + ((R() * 2) | 0), 0.08, 0.13) },
  { name: '五色', w: 0, rarity: 2, base: '#e8e2d8', fin: WHITE_FIN, gen: R => [...patches(R, '#cf3f2a', 2 + ((R() * 2) | 0), 0.07, 0.12, true), ...scaleNet('rgba(44,62,96,0.38)')] },
  { name: '浅黄', w: 0, rarity: 2, base: '#7d97a8', fin: 'rgba(226,130,80,0.5)', gen: () => {
      const out = scaleNet('rgba(214,228,238,0.4)');
      for (let t = 0.06; t < 0.5; t += 0.08) out.push({ t, s: 0.95, r: 0.05, c: '#e0763a' }, { t, s: -0.95, r: 0.05, c: '#e0763a' });
      return out;
    } },
  { name: '金鳞', w: 0, rarity: 3, base: '#f2c95c', fin: 'rgba(255,214,120,0.6)', sheen: true, glint: true, glow: true },
  // 金龙鲤：长鳍、带须，最稀有；离开时跃出水面化作金光
  { name: '金龙鲤', w: 0, rarity: 3, base: '#f3bf45', fin: 'rgba(255,190,80,0.6)', sheen: true, glint: true, glow: true, longFin: true, barbels: true, ascend: true, gen: () => scaleNet('rgba(196,112,24,0.35)') },
];
for (const v of VARIETIES) if (v.rarity == null) v.rarity = v.w >= 3 ? 0 : 1;
const VAR_TOTAL = VARIETIES.reduce((s, v) => s + v.w, 0);
function pickVariety(R) {
  let r = R() * VAR_TOTAL;
  for (const v of VARIETIES) { if ((r -= v.w) <= 0) return v; }
  return VARIETIES[0];
}
function bodyW(u) {
  if (u < 0.28) return 0.58 + 0.42 * Math.sin(u / 0.28 * Math.PI / 2);
  const v = (u - 0.28) / 0.72;
  return 0.13 + 0.87 * Math.pow(Math.cos(v * Math.PI / 2), 1.15);
}
// 天气和时段对游速的影响：夜里慢，雷雨时躁动
function envSpeed() { return S.swimSpeed * (1 - ENV.dark * 0.35) * (1 + ENV.storm * 0.25); }

class Fish {
  constructor(opts) {
    opts = opts || {};
    const R = opts.seed != null ? mulberry32(opts.seed) : Math.random;
    this.mine = !!opts.mine;
    const big = R() < 0.12;
    this.seg = 10;
    this.setLength(opts.L || (44 + R() * 46) * SCALE * (big ? 1.3 : 1));
    this.finScale = R() < 0.2 ? 1.7 : 1;   // 蝴蝶鲤：长鳍
    this.z = opts.z != null ? opts.z : R(); // 0 靠近水面，1 贴着池底
    this.cruise = (24 + R() * 14) * Math.pow(this.L / 70, 0.35);
    this.speed = this.cruise;
    this.a = opts.a != null ? opts.a : rand(0, TAU);
    this.x = opts.x != null ? opts.x : rand(W * 0.1, W * 0.9);
    this.y = opts.y != null ? opts.y : rand(H * 0.1, H * 0.9);
    this.phase = rand(0, TAU);
    this.seed = rand(0, 1000);
    this.wOff = 0; this.fear = 0; this.fx = 0; this.fy = 0; this.kiss = rand(8, 50);
    this.v = opts.variety || pickVariety(R);
    if (this.v.longFin) this.finScale = 2.1;
    this.blobs = this.v.gen ? this.v.gen(R) : [];
    // 银鳞：身上一闪一闪的亮片（用 Math.random，不打乱种子序列）
    this.glints = [];
    if (this.v.glint) for (let i = 0; i < 16; i++) this.glints.push({ t: rand(0.12, 0.8), s: rand(-0.8, 0.8), ph: rand(0, TAU), rate: rand(1.5, 3.5) });
    const n = this.seg + 1;
    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.dx = new Float32Array(n); this.dy = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n);
    this.w = new Float32Array(n);
    for (let k = 0; k < n; k++) { this.px[k] = this.x - Math.cos(this.a) * this.segLen * k; this.py[k] = this.y - Math.sin(this.a) * this.segLen * k; }
    this.buildGeometry();
  }

  setLength(L) {
    this.L = L;
    this.hw = L * 0.11;
    this.segLen = L * 0.78 / this.seg;
  }

  startle(fromX, fromY, dur) {
    const dx = this.x - fromX, dy = this.y - fromY, d = Math.hypot(dx, dy) || 1;
    this.fx = dx / d; this.fy = dy / d;
    this.fear = Math.max(this.fear, dur);
  }

  // 点在身体附近算命中
  hit(x, y) {
    const [cx, cy] = this.sample(0.35, 0);
    return Math.hypot(x - cx, y - cy) < this.L * 0.55;
  }

  update(dt) {
    // 跃出水面：保持方向往前冲，落回水里溅起水花
    if (this.leap) {
      this.leap += dt / this.leapDur;
      this.speed += (this.cruise * 3 - this.speed) * Math.min(1, dt * 3);
      this.x += Math.cos(this.a) * this.speed * dt;
      this.y += Math.sin(this.a) * this.speed * dt;
      this.followChain();
      this.phase += dt * 6;
      // 跃龙门：升到最高处就化作金光不见了
      if (this.ascend) {
        if (Math.random() < dt * 40) sparkleBurst(this.x, this.y, 1, 0.3);
        if (this.leap >= 0.5) { this.gone = true; this.buildGeometry(); return; }
      }
      if (this.leap >= 1) { this.leap = 0; splash(this.x, this.y, 1); }
      this.buildGeometry();
      return;
    }
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    let sx = ca, sy = sa;

    // 漫游
    this.wOff = clamp((this.wOff + (Math.random() - 0.5) * dt * 3) * (1 - dt * 0.3), -1.4, 1.4);
    sx += Math.cos(this.a + this.wOff) * 0.8;
    sy += Math.sin(this.a + this.wOff) * 0.8;

    // 鱼群：分离 / 对齐 / 聚合
    let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0, cnt = 0;
    const R = this.L * 2.4, R2 = R * R, sepR = this.L * 0.9;
    for (const o of fish) {
      if (o === this) continue;
      const dx = o.x - this.x, dy = o.y - this.y, d2 = dx * dx + dy * dy;
      if (d2 > R2 || d2 < 1e-4) continue;
      const d = Math.sqrt(d2);
      if (d < sepR) {
        const f = (1 - d / sepR) * (Math.abs(o.z - this.z) < 0.3 ? 1 : 0.35);
        sepX -= dx / d * f; sepY -= dy / d * f;
      }
      aliX += Math.cos(o.a); aliY += Math.sin(o.a);
      cohX += dx; cohY += dy; cnt++;
    }
    sx += sepX * 2.2; sy += sepY * 2.2;
    if (cnt) {
      sx += aliX / cnt * 0.28; sy += aliY / cnt * 0.28;
      const cl = Math.hypot(cohX, cohY) || 1;
      sx += cohX / cl * 0.12; sy += cohY / cl * 0.12;
    }

    // 池边；要离开的客人直接游出去
    if (this.exitTo) {
      const dx = this.exitTo[0] - this.x, dy = this.exitTo[1] - this.y, d = Math.hypot(dx, dy) || 1;
      sx += dx / d * 3; sy += dy / d * 3;
    } else {
      const m = Math.min(140, Math.min(W, H) * 0.12);
      if (this.x < m) sx += (m - this.x) / m * 2.5;
      if (this.x > W - m) sx -= (this.x - (W - m)) / m * 2.5;
      if (this.y < m) sy += (m - this.y) / m * 2.5;
      if (this.y > H - m) sy -= (this.y - (H - m)) / m * 2.5;
    }

    const em = envSpeed();
    let target = this.cruise * (1 + 0.25 * Math.sin(time * 0.35 + this.seed)) * em;

    // 找吃的
    const mx = this.x + ca * this.hw * 0.6, my = this.y + sa * this.hw * 0.6;
    let best = null, bd = 420 * 420;
    for (const p of food) {
      if (p.dead) continue;
      const d2 = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d2 < bd) { bd = d2; best = p; }
    }
    const summoned = this.mine && MINE.summonT > 0;
    if (summoned) {
      const tx = pointer.inside ? pointer.x : W / 2, ty = pointer.inside ? pointer.y : H / 2;
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1;
      if (d > this.L * 0.6) { sx += dx / d * 3.5; sy += dy / d * 3.5; target = this.cruise * 2.2 * Math.max(1, em); }
      else target = this.cruise * 0.4;
    } else if (handActive() && Math.hypot(PRESS.x - mx, PRESS.y - my) < (this.mine ? 700 : 480)) {
      // 手伸进水里：游过来，啄一下，退开，再游过来
      const dx = PRESS.x - mx, dy = PRESS.y - my, d = Math.hypot(dx, dy) || 1;
      sx += dx / d * 3; sy += dy / d * 3;
      target = this.cruise * (d < 80 ? 1.2 : 2.2);
      if (d < this.hw * 0.8 + 4 && this.fear <= 0) {
        addBubble(mx, my);
        if (Math.random() < 0.5) addBubble(mx, my, 2);
        addRipple(mx, my, 12, 0.8, 0.5);
        this.startle(PRESS.x, PRESS.y, rand(0.18, 0.4));
        if (this.mine) { MINE.showT = Math.max(MINE.showT, 2); if (Math.random() < 0.3) spawnHearts(mx, my - 8); }
      }
    } else if (best) {
      const d = Math.sqrt(bd) || 1;
      sx += (best.x - mx) / d * 3.2; sy += (best.y - my) / d * 3.2;
      target = this.cruise * (d < 60 ? 1.6 : 2.6) * Math.max(0.8, em);
      if (d < this.hw * 0.9 + 3) {
        best.dead = true;
        addRipple(best.x, best.y, 16 + this.L * 0.15, 1.2, 0.7);
        noteEat();
        fishAte(this);
      }
    } else if (pointer.inside && time - pointer.moved > 1.2) {
      // 鼠标静止不动时，附近的鱼会慢慢游过来看看；自己的那条更亲人
      const reach = this.mine ? 420 : 260;
      const dx = pointer.x - this.x, dy = pointer.y - this.y, d = Math.hypot(dx, dy);
      if (d < reach && d > this.L * 0.5) { sx += dx / d * (this.mine ? 2 : 1.2); sy += dy / d * (this.mine ? 2 : 1.2); target = this.cruise * 0.8 * em; }
    }

    // 鼠标快速划过会惊扰鱼
    if (this.fear <= 0 && pointer.inside && time - pointer.moved < 0.12 && pointer.speed > 900) {
      if (Math.hypot(pointer.x - this.x, pointer.y - this.y) < 150) this.startle(pointer.x, pointer.y, rand(0.6, 1.1));
    }
    if (this.fear > 0) {
      this.fear -= dt;
      sx += this.fx * 4; sy += this.fy * 4;
      target = this.cruise * 4.2;
    }

    // 转向（限制角速度，鱼不会原地掉头）
    let da = Math.atan2(sy, sx) - this.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const maxTurn = (1.4 + this.speed / this.cruise * 0.9) * dt;
    this.a += clamp(da * 4 * dt, -maxTurn, maxTurn);
    this.speed += (target - this.speed) * Math.min(1, dt * (this.fear > 0 ? 4 : 1.6));

    const lim = this.exitTo ? this.L * 2.2 : this.L;
    this.x = clamp(this.x + Math.cos(this.a) * this.speed * dt, -lim, W + lim);
    this.y = clamp(this.y + Math.sin(this.a) * this.speed * dt, -lim, H + lim);

    this.followChain();
    this.phase += dt * (3.2 + this.speed * 0.1) * Math.sqrt(60 / this.L);

    // 浅处的鱼偶尔到水面“亲”一下（下雨时水面已经够热闹了）
    this.kiss -= dt;
    if (this.kiss < 0) {
      this.kiss = rand(12, 60);
      if (this.z < 0.4 && ENV.rain < 0.3) { addRipple(mx, my, 14 + this.L * 0.2, 1.6, 0.5); sndKiss(mx); }
    }

    this.buildGeometry();
  }

  // 身体是一条跟随头部的链；每个关节最多弯 0.3 弧度，急转弯时不会卷成一团
  followChain() {
    this.px[0] = this.x; this.py[0] = this.y;
    let prevA = this.a;
    for (let k = 1; k <= this.seg; k++) {
      const dx = this.px[k - 1] - this.px[k], dy = this.py[k - 1] - this.py[k];
      let ja = Math.atan2(dy, dx);
      const bend = Math.atan2(Math.sin(ja - prevA), Math.cos(ja - prevA));
      if (bend > 0.3) ja = prevA + 0.3; else if (bend < -0.3) ja = prevA - 0.3;
      this.px[k] = this.px[k - 1] - Math.cos(ja) * this.segLen;
      this.py[k] = this.py[k - 1] - Math.sin(ja) * this.segLen;
      prevA = ja;
    }
  }

  buildGeometry() {
    const n = this.seg, { px, py, dx, dy, tx, ty, w } = this;
    const amp = this.still ? 0 : this.hw * 0.55 * (0.45 + 0.55 * Math.min(this.speed / (this.cruise * 2.2), 1));
    // 第一遍：在链上叠加游动的正弦摆
    for (let k = 0; k <= n; k++) {
      const a = k === 0 ? 0 : k - 1, b = k === n ? n : k + 1;
      let ex = px[a] - px[b], ey = py[a] - py[b];
      const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
      const u = k / n;
      const lat = amp * (Math.pow(u, 1.4) + 0.05) * Math.sin(this.phase - k * 0.62);
      dx[k] = px[k] - ey * lat;
      dy[k] = py[k] + ex * lat;
    }
    // 第二遍：在摆动后的脊柱上求切线和宽度
    for (let k = 0; k <= n; k++) {
      const a = k === 0 ? 0 : k - 1, b = k === n ? n : k + 1;
      const ex = dx[a] - dx[b], ey = dy[a] - dy[b];
      const el = Math.hypot(ex, ey) || 1;
      tx[k] = ex / el; ty[k] = ey / el;
      w[k] = this.hw * bodyW(k / n);
    }

    // 身体轮廓
    const pts = [[dx[0] + tx[0] * this.hw * 0.62, dy[0] + ty[0] * this.hw * 0.62]];
    for (let k = 0; k <= n; k++) pts.push([dx[k] - ty[k] * w[k], dy[k] + tx[k] * w[k]]);
    for (let k = n; k >= 0; k--) pts.push([dx[k] + ty[k] * w[k], dy[k] - tx[k] * w[k]]);
    const body = new Path2D();
    const last = pts[pts.length - 1];
    body.moveTo((last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      body.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    body.closePath();
    this.bodyPath = body;

    // 尾鳍
    const bx = dx[n], by = dy[n], wn = w[n];
    const nx = -ty[n], ny = tx[n];
    const ang = Math.atan2(-ty[n], -tx[n]) + 0.35 * Math.sin(this.phase - n * 0.62 - 0.9);
    const TL = this.L * 0.24 * this.finScale, sp = 0.42 * (this.finScale > 1 ? 1.15 : 1);
    const at = (a, r) => [bx + Math.cos(a) * r, by + Math.sin(a) * r];
    const tipL = at(ang - sp, TL), tipR = at(ang + sp, TL), notch = at(ang, TL * 0.55);
    const cL = at(ang - sp * 0.45, TL * 0.55), cR = at(ang + sp * 0.45, TL * 0.55);
    const nL = at(ang - sp * 0.5, TL * 0.85), nR = at(ang + sp * 0.5, TL * 0.85);
    const tail = new Path2D();
    tail.moveTo(bx + nx * wn, by + ny * wn);
    tail.quadraticCurveTo(cL[0], cL[1], tipL[0], tipL[1]);
    tail.quadraticCurveTo(nL[0], nL[1], notch[0], notch[1]);
    tail.quadraticCurveTo(nR[0], nR[1], tipR[0], tipR[1]);
    tail.quadraticCurveTo(cR[0], cR[1], bx - nx * wn, by - ny * wn);
    tail.closePath();
    this.tailPath = tail;

    // 胸鳍：慢游时扇得更明显
    const k = 2, fl = this.L * 0.17 * this.finScale, fw = this.L * 0.065 * this.finScale;
    const back = Math.atan2(-ty[k], -tx[k]);
    const flap = 0.25 * Math.sin(time * 2.4 + this.seed) * (1.3 - Math.min(this.speed / (this.cruise * 2), 1));
    const fins = new Path2D();
    for (const side of [-1, 1]) {
      const axis = back + side * (0.95 + flap);
      const baseX = dx[k] - side * ty[k] * w[k] * 0.8, baseY = dy[k] + side * tx[k] * w[k] * 0.8;
      const cx = baseX + Math.cos(axis) * fl * 0.5, cy = baseY + Math.sin(axis) * fl * 0.5;
      fins.moveTo(cx + Math.cos(axis) * fl / 2, cy + Math.sin(axis) * fl / 2);
      fins.ellipse(cx, cy, fl / 2, fw / 2, axis, 0, TAU);
    }
    this.finPath = fins;
  }

  // (t 沿脊柱 0 头 → 1 尾, s 横向 -1 右 → 1 左) → 世界坐标
  sample(t, s) {
    const f = t * this.seg, i = Math.min(this.seg - 1, f | 0), k = f - i;
    const x = this.dx[i] + (this.dx[i + 1] - this.dx[i]) * k;
    const y = this.dy[i] + (this.dy[i + 1] - this.dy[i]) * k;
    const tx = this.tx[i] + (this.tx[i + 1] - this.tx[i]) * k;
    const ty = this.ty[i] + (this.ty[i + 1] - this.ty[i]) * k;
    const w = this.w[i] + (this.w[i + 1] - this.w[i]) * k;
    return [x - ty * w * s, y + tx * w * s];
  }

  drawShadow(g) {
    const h = this.leap ? Math.sin(Math.PI * this.leap) : 0;
    const off = 4 + (1 - this.z) * 16 + h * 70;
    g.save();
    g.translate(off * SUN.x, off * SUN.y);
    g.fillStyle = `rgba(14,40,32,${(0.15 + 0.1 * this.z) * (1 - ENV.cloud * 0.5) * (1 - h * 0.5)})`;
    g.fill(this.bodyPath); g.fill(this.tailPath);
    g.restore();
  }

  draw(g) {
    const v = this.v;
    const h = this.leap ? Math.sin(Math.PI * this.leap) : 0;
    if (h > 0) {
      const [cx, cy] = this.sample(0.4, 0), sc = 1 + h * (this.ascend ? 1.2 : 0.55);
      g.save(); g.translate(cx, cy); g.scale(sc, sc); g.translate(-cx, -cy);
    }
    g.globalAlpha = 1 - this.z * 0.45;
    g.fillStyle = v.fin;
    g.fill(this.finPath);
    g.fill(this.tailPath);
    g.globalAlpha = 1;

    // 金鳞：身周一圈淡淡的金光
    if (v.glow) {
      g.save();
      g.shadowColor = `rgba(255,214,120,${0.55 + 0.3 * Math.sin(time * 2 + this.seed)})`;
      g.shadowBlur = this.L * 0.35;
      g.fillStyle = v.base;
      g.fill(this.bodyPath);
      g.restore();
    }
    g.save();
    g.fillStyle = v.base;
    g.fill(this.bodyPath);
    g.clip(this.bodyPath);
    for (const b of this.blobs) {
      const [x, y] = this.sample(b.t, b.s);
      g.fillStyle = b.c;
      g.beginPath(); g.arc(x, y, b.r * this.L, 0, TAU); g.fill();
    }
    for (const q of this.glints) {
      const a = Math.pow(Math.max(0, Math.sin(time * q.rate + q.ph)), 6);
      if (a < 0.05) continue;
      const [x, y] = this.sample(q.t, q.s);
      g.fillStyle = `rgba(255,255,250,${a * 0.95})`;
      g.beginPath(); g.arc(x, y, this.L * 0.012 + a * this.L * 0.012, 0, TAU); g.fill();
    }
    // 背脊高光
    g.beginPath(); g.moveTo(this.dx[0], this.dy[0]);
    for (let k = 1; k <= this.seg; k++) g.lineTo(this.dx[k], this.dy[k]);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = `rgba(255,255,255,${v.sheen ? 0.32 : 0.13})`;
    g.lineWidth = this.hw * 0.7;
    g.stroke();
    // 背鳍
    g.beginPath(); g.moveTo(this.dx[3], this.dy[3]);
    for (let k = 4; k <= 7; k++) g.lineTo(this.dx[k], this.dy[k]);
    g.strokeStyle = 'rgba(0,0,0,0.14)';
    g.lineWidth = Math.max(1, this.hw * 0.14);
    g.stroke();
    // 身体边缘压暗，显出圆润
    g.strokeStyle = 'rgba(10,30,25,0.2)';
    g.lineWidth = this.hw * 0.45;
    g.stroke(this.bodyPath);
    g.fillStyle = 'rgba(18,18,18,0.75)';
    for (const s of [-0.78, 0.78]) {
      const [x, y] = this.sample(0.06, s);
      g.beginPath(); g.arc(x, y, this.hw * 0.11, 0, TAU); g.fill();
    }
    g.restore();

    // 金龙鲤的两根须
    if (v.barbels) {
      const fx = this.tx[0], fy = this.ty[0], len = this.L * 0.2;
      g.strokeStyle = 'rgba(240,196,100,0.9)';
      g.lineWidth = Math.max(1, this.hw * 0.07);
      g.lineCap = 'round';
      g.beginPath();
      for (const side of [-1, 1]) {
        const [x0, y0] = this.sample(0.03, side * 0.55);
        const nx = -fy * side, ny = fx * side, wv = 0.8 + 0.25 * Math.sin(time * 3 + side);
        g.moveTo(x0, y0);
        g.quadraticCurveTo(x0 + nx * len * 0.6 + fx * len * 0.25, y0 + ny * len * 0.6 + fy * len * 0.25,
          x0 + nx * len * wv - fx * len * 0.5, y0 + ny * len * wv - fy * len * 0.5);
      }
      g.stroke();
    }
    // 水彩画风：一道淡淡的描边，像颜料在边缘淤积
    if (S.style === 'watercolor') {
      g.strokeStyle = 'rgba(58,44,34,0.28)';
      g.lineWidth = 0.9;
      g.stroke(this.bodyPath);
    }

    // 越深越被水色吞没
    if (this.z > 0.05 && h === 0) {
      g.fillStyle = `rgba(66,114,100,${this.z * 0.42})`;
      g.fill(this.bodyPath);
      g.fill(this.tailPath);
    }
    if (h > 0) g.restore();
  }
}
