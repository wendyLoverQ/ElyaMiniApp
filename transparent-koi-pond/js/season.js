/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   四季：池底的颜色、岸边那棵树的影子、落下来的花和叶、冬天的薄冰
   ============================================================ */
const SEASON = { cur: null, fallT: 5, gustT: 60, ice: 0 };
let canopyTwigs = null, canopyLeaves = null, canopyTips = [], iceCanvas = null, falling = [];

/* ---------- 池底：按季节染一层颜色，秋冬沉着些落叶 ---------- */
const SEASON_WASH = {
  spring: 'rgba(170,214,150,0.10)',
  summer: 'rgba(40,118,84,0.08)',
  autumn: 'rgba(176,126,56,0.16)',
  winter: 'rgba(178,198,208,0.20)',
};
function seasonBottom(g) {
  const se = season();
  g.fillStyle = SEASON_WASH[se];
  g.fillRect(0, 0, W, H);
  if (se !== 'autumn' && se !== 'winter') return;
  const R = mulberry32(61), n = Math.round(W * H / (se === 'autumn' ? 26000 : 40000));
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, s = (6 + R() * 10) * SCALE, a = R() * TAU;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `hsla(${22 + R() * 20},${30 + R() * 20}%,${22 + R() * 10}%,${0.16 + R() * 0.12})`;
    g.beginPath(); g.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,28,16,0.12)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-s, 0); g.lineTo(s * 1.3, 0); g.stroke();
    g.restore();
  }
}

/* ---------- 树影：岸边左上角有一棵树，影子落进池子里 ---------- */
// 冬天只剩枝条，春天稀疏，夏天最密，秋天叶子掉了一半
const CANOPY_DENSITY = { spring: 0.5, summer: 1, autumn: 0.55, winter: 0 };
function buildCanopy() {
  const cw = W * 0.62, ch = H * 0.7, q = 0.5;
  const R = mulberry32(83), se = season(), dens = CANOPY_DENSITY[se];
  const mk = () => { const c = mkCanvas(cw * q, ch * q), g = c.getContext('2d'); g.scale(q, q); return [c, g]; };
  const [tc, tg] = mk(), [lc, lg] = mk();
  tg.strokeStyle = lg.fillStyle = 'rgb(8,26,22)';
  tg.lineCap = 'round';
  canopyTips = [];
  const u = Math.min(W, H);
  const branch = (x, y, a, len, wid, depth) => {
    const segs = 4;
    let px = x, py = y, pa = a;
    tg.lineWidth = wid;
    tg.beginPath(); tg.moveTo(px, py);
    for (let i = 0; i < segs; i++) {
      pa += (R() - 0.5) * 0.35;
      px += Math.cos(pa) * len / segs; py += Math.sin(pa) * len / segs;
      tg.lineTo(px, py);
    }
    tg.stroke();
    if (depth >= 6 || len < 12) {
      canopyTips.push([px, py]);
      if (dens > 0) {
        // 影子是一样深的；叶子之间漏下来的光斑单独挖掉
        const n = Math.round((12 + R() * 8) * dens);
        for (let i = 0; i < n; i++) {
          const r = (3.5 + R() * 4.5) * SCALE, d = Math.sqrt(R()) * 48 * SCALE, b = R() * TAU;
          lg.beginPath(); lg.ellipse(px + Math.cos(b) * d, py + Math.sin(b) * d, r, r * 0.55, R() * TAU, 0, TAU); lg.fill();
        }
        lg.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 5; i++) {
          const d = R() * 40 * SCALE, b = R() * TAU;
          lg.beginPath(); lg.arc(px + Math.cos(b) * d, py + Math.sin(b) * d, (1.5 + R() * 3.5) * SCALE, 0, TAU); lg.fill();
        }
        lg.globalCompositeOperation = 'source-over';
      }
      return;
    }
    const kids = 2 + (R() < 0.4 ? 1 : 0);
    for (let k = 0; k < kids; k++) branch(px, py, pa + (k - (kids - 1) / 2) * (0.5 + R() * 0.3), len * (0.68 + R() * 0.12), wid * 0.66, depth + 1);
  };
  branch(-u * 0.08, -u * 0.06, 0.78, u * 0.19, 11 * SCALE, 0);
  branch(-u * 0.04, u * 0.1, 0.3, u * 0.13, 7 * SCALE, 1);
  // 边缘虚一点，像真的影子
  const soften = c => { const o = mkCanvas(c.width, c.height), g = o.getContext('2d'); g.filter = 'blur(1px)'; g.drawImage(c, 0, 0); return o; };
  // 枝和叶合成一张画，另外留一张叶子做风里晃动的那一层
  if (dens > 0) tg.drawImage(lc, 0, 0, cw, ch);
  canopyTwigs = soften(tc);
  canopyLeaves = dens > 0 ? soften(lc) : null;
  canopyTwigs.cw = cw; canopyTwigs.ch = ch;
}

function drawCanopy(g) {
  if (!canopyTwigs) return;
  const a = 0.26 * SUN.lit;
  if (a < 0.02) return;
  const cw = canopyTwigs.cw, ch = canopyTwigs.ch;
  // 影子跟着太阳挪：早上偏左，傍晚偏右
  const ox = (SUN.x - 0.55) * W * 0.08, oy = (SUN.y - 0.85) * H * 0.06;
  const w = 1 + ENV.wind * 4;
  g.globalAlpha = a;
  g.drawImage(canopyTwigs, ox + Math.sin(time * 0.5) * w, oy + Math.cos(time * 0.4) * w * 0.5, cw, ch);
  // 叶子一层叠一层，风一吹，光斑就在影子里跳
  if (canopyLeaves && !lowQuality()) {
    g.globalAlpha = a * 0.4;
    g.drawImage(canopyLeaves, ox + 6 + Math.sin(time * 1.3) * w * 3, oy + 4 + Math.cos(time * 1.1) * w * 2, cw, ch);
  }
  g.globalAlpha = 1;
}

/* ---------- 从树上落下来的：春天的花瓣，秋天的叶子 ---------- */
function fallRate() {
  const se = season();
  return { spring: 1 / 7, summer: 1 / 50, autumn: 1 / 5, winter: 0 }[se] * (1 + ENV.wind * 3) * (1 - ENV.dark * 0.5);
}
function dropFromTree(n) {
  if (!S.petals || !canopyTips.length || !petalSprites.length) return;
  for (let i = 0; i < n; i++) {
    const [x, y] = canopyTips[(Math.random() * canopyTips.length) | 0];
    falling.push({ x: x + rand(-30, 30), y: y + rand(-30, 30), h: 1, vx: rand(8, 20) + ENV.wind * 30, vy: rand(4, 14), a: rand(0, TAU), va: rand(-2, 2), ph: rand(0, TAU), dur: rand(3, 5), s: rand(0.7, 1.05), k: (Math.random() * petalSprites.length) | 0 });
  }
  if (falling.length > 24) falling.splice(0, falling.length - 24);
}
function updateFalling(dt) {
  SEASON.fallT -= dt * fallRate() * 7;
  if (SEASON.fallT <= 0) { SEASON.fallT = rand(4, 10); dropFromTree(1); }
  // 偶尔一阵风，一下子落好几片
  SEASON.gustT -= dt;
  if (SEASON.gustT <= 0) {
    SEASON.gustT = rand(150, 400);
    const se = season();
    if ((se === 'spring' || se === 'autumn') && ENV.rain < 0.3 && ENV.dark < 0.6) dropFromTree(5 + ((Math.random() * 5) | 0));
  }
  for (const f of falling) {
    f.h -= dt / f.dur;
    f.x += (f.vx + Math.sin(time * 2 + f.ph) * 18) * dt;
    f.y += (f.vy + Math.cos(time * 1.7 + f.ph) * 6) * dt;
    f.a += f.va * dt * (1 + Math.sin(time * 3 + f.ph));
    if (f.h <= 0) {
      f.dead = true;
      addRipple(f.x, f.y, 10 + 8 * SCALE, 1.2, 0.45);
      sndPlip(f.x, 0.25, 900, 0);
      petals.push({ x: f.x, y: f.y, a: f.a, va: f.va * 0.1, vx: f.vx * 0.3, vy: f.vy * 0.3, s: f.s, k: f.k, life: rand(80, 140) });
      noteFall();
    }
  }
  if (falling.some(f => f.dead)) falling = falling.filter(f => !f.dead);
}
function noteFall() {
  const se = season();
  if (se === 'spring') bookMoment('blossom');
  else if (se === 'autumn') bookMoment('leaf');
}
function drawFalling(g) {
  if (!falling.length || !S.petals) return;
  for (const f of falling) {
    const img = petalSprites[f.k % petalSprites.length];
    if (!img) continue;
    const ps = img.width / DPR, sc = f.s * (1 + f.h * 0.7), off = 4 + f.h * 70 * SCALE;
    // 影子
    g.save();
    g.globalAlpha = 0.18 * (1 - f.h * 0.5) * (1 - ENV.cloud * 0.5);
    g.translate(f.x + off * SUN.x, f.y + off * SUN.y); g.rotate(f.a); g.scale(sc * 0.8, sc * 0.8 * Math.abs(Math.cos(time * 3 + f.ph)) + 0.2);
    g.fillStyle = '#0c2a22'; g.beginPath(); g.arc(0, 0, ps * 0.28, 0, TAU); g.fill();
    g.restore();
    // 在空中翻转：纵向压扁一下
    g.save();
    g.translate(f.x, f.y); g.rotate(f.a); g.scale(sc, sc * (0.35 + 0.65 * Math.abs(Math.cos(time * 3 + f.ph))));
    g.drawImage(img, -ps / 2, -ps / 2, ps, ps);
    g.restore();
  }
}

/* ---------- 冬天的薄冰：最冷的日子里，池边结一圈冰 ---------- */
function iceWanted() {
  if (season() !== 'winter') return 0;
  if (ENV.snow > 0.3 || S.weatherMode === 'snow') return 1;
  if (LIVE.data && S.weatherMode === 'auto' && LIVE.data.temp <= 1) return 1;
  return 0;
}
function buildIce() {
  const q = 0.5, w = Math.ceil(W * q), h = Math.ceil(H * q);
  const c = mkCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  const N = 256, noise = tileNoise(N, 4, 4, 19), fine = tileNoise(N, 2, 24, 23);
  const band = Math.min(W, H) * 0.11 * q;
  const nz = (x, y) => {
    const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, a = x0 % N, b = (x0 + 1) % N, r0 = (y0 % N) * N, r1 = ((y0 + 1) % N) * N;
    return lerp(lerp(noise[r0 + a], noise[r0 + b], tx), lerp(noise[r1 + a], noise[r1 + b], tx), ty);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.min(x, y, w - x, h - y) / band;
    if (e > 2.2) continue;
    const ni = (y % N) * N + (x % N);
    // 冰的边缘一团一团往里伸，不是一条直线
    const v = 1 - e * 0.75 + clamp((nz(x * 0.3, y * 0.3) - 0.5) * 3.2, -0.9, 0.9);
    const edge = clamp((v - 0.42) / 0.05, 0, 1);
    if (edge <= 0) continue;
    const rim = Math.exp(-Math.pow((v - 0.45) / 0.025, 2));
    const k = (y * w + x) * 4;
    d[k] = 224 + rim * 28; d[k + 1] = 236 + rim * 16; d[k + 2] = 244;
    d[k + 3] = (edge * (0.18 + fine[ni] * 0.2 + clamp(v - 0.7, 0, 0.6) * 0.35) + rim * 0.3) * 255;
  }
  g.putImageData(img, 0, 0);
  // 冰上的裂纹：从岸边往里长
  const R = mulberry32(29);
  g.globalCompositeOperation = 'source-atop';   // 只画在冰上
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.7;
  for (let i = 0; i < 70; i++) {
    const side = (R() * 4) | 0, t = R(), b = R() * band * 0.8;
    let x = side === 0 ? b : side === 1 ? w - b : t * w;
    let y = side === 2 ? b : side === 3 ? h - b : t * h;
    let a = R() * TAU;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { a += (R() - 0.5) * 1.4; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); }
    g.stroke();
  }
  iceCanvas = c;
}
function updateSeason(dt) {
  const want = iceWanted();
  SEASON.ice += (want - SEASON.ice) * Math.min(1, dt * 0.04);
  if (SEASON.ice > 0.01 && !iceCanvas) buildIce();
  updateFalling(dt);
  for (const p of petals) if (p.life != null) p.life -= dt;
  if (petals.some(p => p.life != null && p.life <= 0)) petals = petals.filter(p => p.life == null || p.life > 0);
}
function drawIce(g) {
  if (SEASON.ice < 0.01 || !iceCanvas) return;
  g.globalAlpha = SEASON.ice;
  g.drawImage(iceCanvas, 0, 0, W, H);
  g.globalAlpha = 1;
}

// 季节变了（或者手动换了），重画跟季节有关的东西
function applySeason() {
  SEASON.cur = season();
  iceCanvas = null;
  falling = [];
  buildPetals();
  buildCanopy();
  buildStars();
}
function checkSeason() { if (SEASON.cur && season() !== SEASON.cur) applySeason(); }
