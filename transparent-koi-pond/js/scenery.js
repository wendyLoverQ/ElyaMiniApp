/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   荷叶、荷花、花瓣、鱼食、水波纹
   ============================================================ */
const PAD_LAYOUT = [
  [0.05, 0.13, 0.10, 1], [0.14, 0.22, 0.062, 0], [0.02, 0.32, 0.045, 0],
  [0.79, 0.06, 0.058, 1], [1.0, 0.52, 0.075, 0],
  [0.955, 0.80, 0.105, 1], [0.85, 0.93, 0.06, 0],
  [0.07, 0.90, 0.09, 0], [0.015, 0.66, 0.05, 0], [0.56, 1.0, 0.05, 0],
];

function drawLotus(g, x, y, s, R) {
  g.save();
  g.translate(x, y);
  g.rotate(R() * TAU);
  const rings = [
    [10, 1.0, 0.36, '#f8e9ee', '#e2718f'],
    [8, 0.8, 0.34, '#fbf1f3', '#ea86a2'],
    [6, 0.56, 0.3, '#fff8f6', '#f1a3b5'],
  ];
  rings.forEach(([n, len, wid, c0, c1], ri) => {
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate(i / n * TAU + ri * 0.35);
      const L = s * len, Wd = s * wid;
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(Wd, -L * 0.25, Wd * 0.8, -L * 0.85, 0, -L);
      g.bezierCurveTo(-Wd * 0.8, -L * 0.85, -Wd, -L * 0.25, 0, 0);
      const gr = g.createLinearGradient(0, 0, 0, -L);
      gr.addColorStop(0, c0); gr.addColorStop(0.55, c0); gr.addColorStop(1, c1);
      if (ri === 0) { g.shadowColor = 'rgba(10,32,26,0.35)'; g.shadowBlur = 6 * DPR; g.shadowOffsetX = 4 * DPR; g.shadowOffsetY = 6 * DPR; }
      g.fillStyle = gr; g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = 'rgba(190,80,110,0.25)'; g.lineWidth = 0.8; g.stroke();
      g.beginPath(); g.moveTo(0, -L * 0.15); g.lineTo(0, -L * 0.8);
      g.strokeStyle = 'rgba(222,112,142,0.22)'; g.stroke();
      g.restore();
    }
  });
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU;
    g.fillStyle = '#f5d86a';
    g.beginPath(); g.arc(Math.cos(a) * s * 0.19, Math.sin(a) * s * 0.19, s * 0.035, 0, TAU); g.fill();
  }
  g.fillStyle = '#c7c965';
  g.beginPath(); g.arc(0, 0, s * 0.14, 0, TAU); g.fill();
  g.fillStyle = 'rgba(120,120,40,0.55)';
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.arc(Math.cos(a) * s * 0.07, Math.sin(a) * s * 0.07, s * 0.018, 0, TAU); g.fill(); }
  g.restore();
}

// 荷叶随季节：春天是小小的新叶和花苞，夏天满池荷花，秋天叶边发黄、结了莲蓬，冬天是残荷
const PAD_STYLE = {
  spring: { size: 0.78, col: ['#bfe08e', '#8cc15e', '#68a64a', '#548f3f'], vein: 'rgba(236,246,190,0.45)', rim: 'rgba(214,232,140,0.5)', spots: 0, tear: 0, bloom: 'bud' },
  summer: { size: 1, col: ['#a8cc72', '#6fa64d', '#4f8c3e', '#3f7735'], vein: 'rgba(228,240,172,0.42)', rim: 'rgba(198,214,110,0.45)', spots: 0, tear: 0, bloom: 'lotus' },
  autumn: { size: 1, col: ['#b9c56a', '#8ea24a', '#8a8a3a', '#a07a34'], vein: 'rgba(236,226,160,0.4)', rim: 'rgba(196,150,70,0.55)', spots: 7, tear: 0.08, bloom: 'pod' },
  winter: { size: 0.9, col: ['#9a7c4e', '#7c603a', '#5f4a2e', '#4a3a24'], vein: 'rgba(196,170,120,0.35)', rim: 'rgba(70,52,30,0.5)', spots: 10, tear: 0.32, bloom: 'deadpod', drop: [1, 4, 8] },
};

function drawBud(g, x, y, s) {
  g.save(); g.translate(x, y); g.rotate(-0.6);
  g.shadowColor = 'rgba(10,32,26,0.35)'; g.shadowBlur = 4 * DPR; g.shadowOffsetX = 3 * DPR; g.shadowOffsetY = 4 * DPR;
  g.beginPath(); g.moveTo(0, s * 0.5);
  g.bezierCurveTo(s * 0.42, s * 0.2, s * 0.3, -s * 0.45, 0, -s * 0.62);
  g.bezierCurveTo(-s * 0.3, -s * 0.45, -s * 0.42, s * 0.2, 0, s * 0.5);
  const gr = g.createLinearGradient(0, s * 0.5, 0, -s * 0.62);
  gr.addColorStop(0, '#a9c67a'); gr.addColorStop(0.45, '#f4d3dc'); gr.addColorStop(1, '#e0708f');
  g.fillStyle = gr; g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(190,80,110,0.3)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(0, s * 0.4); g.quadraticCurveTo(s * 0.12, -s * 0.1, 0, -s * 0.58); g.stroke();
  g.restore();
}
// 莲蓬：一个圆盘，上面一个个小孔
function drawPod(g, x, y, s, dead) {
  g.save(); g.translate(x, y);
  g.shadowColor = 'rgba(10,32,26,0.35)'; g.shadowBlur = 4 * DPR; g.shadowOffsetX = 3 * DPR; g.shadowOffsetY = 4 * DPR;
  const gr = g.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s);
  gr.addColorStop(0, dead ? '#8a6c44' : '#c9cf7a'); gr.addColorStop(1, dead ? '#4e3a22' : '#8f9a46');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = dead ? 'rgba(30,20,10,0.6)' : 'rgba(80,90,30,0.55)';
  const holes = [[0, 0], ...[0, 1, 2, 3, 4, 5].map(i => [Math.cos(i / 6 * TAU) * 0.5, Math.sin(i / 6 * TAU) * 0.5])];
  for (const [hx, hy] of holes) { g.beginPath(); g.arc(hx * s, hy * s, s * 0.13, 0, TAU); g.fill(); }
  g.strokeStyle = dead ? 'rgba(40,28,14,0.5)' : 'rgba(100,110,40,0.5)'; g.lineWidth = s * 0.08;
  g.beginPath(); g.arc(0, 0, s * 0.96, 0, TAU); g.stroke();
  g.restore();
}

function renderPad(R, seed, flower, st) {
  const Rr = mulberry32(seed);
  const S_ = R * 3 + 28;
  const mkc = () => { const c = mkCanvas(S_ * DPR, S_ * DPR), g = c.getContext('2d'); g.scale(DPR, DPR); g.translate(S_ / 2, S_ / 2); return [c, g]; };
  const [c, g] = mkc();

  const na = Rr() * TAU, gap = 0.13;
  const shape = new Path2D();
  shape.moveTo(0, 0);
  for (let i = 0; i <= 72; i++) {
    const a = na + gap + (TAU - 2 * gap) * i / 72;
    let rr = R * (1 + 0.018 * Math.sin(a * 6 + seed) + 0.01 * Math.sin(a * 13));
    if (st.tear) rr *= 1 - st.tear * Math.max(0, Math.sin(a * 7 + seed) * Math.sin(a * 3 + seed * 1.7)) - st.tear * 0.25 * Math.max(0, Math.sin(a * 17 + seed * 3));
    shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  shape.closePath();

  // 影子单独画一张，跟着太阳挪
  const [sh, sg] = mkc();
  sg.filter = `blur(${Math.max(2, R * 0.08)}px)`;
  sg.fillStyle = 'rgba(8,30,24,0.45)'; sg.fill(shape);

  const gr = g.createRadialGradient(-R * 0.15, -R * 0.2, R * 0.05, 0, 0, R);
  gr.addColorStop(0, st.col[0]); gr.addColorStop(0.45, st.col[1]); gr.addColorStop(0.85, st.col[2]); gr.addColorStop(1, st.col[3]);
  g.fillStyle = gr; g.fill(shape);

  g.save();
  g.clip(shape);
  for (let i = 0; i < 26; i++) {
    const a = Rr() * TAU, d = Math.sqrt(Rr()) * R * 0.95, r = R * (0.05 + Rr() * 0.13);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const col = Rr() < 0.55 ? 'rgba(38,88,40,' : 'rgba(216,216,122,';
    const sgr = g.createRadialGradient(x, y, 0, x, y, r);
    sgr.addColorStop(0, col + '0.2)'); sgr.addColorStop(1, col + '0)');
    g.fillStyle = sgr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 秋冬的枯斑
  for (let i = 0; i < st.spots; i++) {
    const a = Rr() * TAU, d = (0.4 + Rr() * 0.6) * R, r = R * (0.06 + Rr() * 0.16);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const sgr = g.createRadialGradient(x, y, 0, x, y, r);
    sgr.addColorStop(0, 'rgba(96,62,26,0.45)'); sgr.addColorStop(1, 'rgba(96,62,26,0)');
    g.fillStyle = sgr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = st.vein;
  g.lineWidth = Math.max(0.8, R * 0.012);
  const nV = 16 + ((Rr() * 6) | 0);
  for (let v = 0; v < nV; v++) {
    const a = na + gap + (TAU - 2 * gap) * (v + 0.5) / nV, bend = (Rr() - 0.5) * 0.12;
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(a + bend) * R * 0.5, Math.sin(a + bend) * R * 0.5, Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97);
    g.stroke();
  }
  g.lineWidth = R * 0.06; g.strokeStyle = st.rim; g.stroke(shape);
  g.restore();
  g.lineWidth = 1; g.strokeStyle = 'rgba(28,66,30,0.4)'; g.stroke(shape);
  g.fillStyle = 'rgba(214,228,152,0.7)';
  g.beginPath(); g.arc(0, 0, R * 0.03, 0, TAU); g.fill();

  if (flower) {
    if (st.bloom === 'lotus') drawLotus(g, R * 0.12, -R * 0.08, R * 0.46, Rr);
    else if (st.bloom === 'bud') drawBud(g, R * 0.15, -R * 0.1, R * 0.3);
    else drawPod(g, R * 0.14, -R * 0.1, R * 0.17, st.bloom === 'deadpod');
  }
  // 残荷：折断的茎横在叶子上
  if (st.bloom === 'deadpod' && Rr() < 0.7) {
    const a = Rr() * TAU, l = R * (0.9 + Rr() * 0.5);
    g.strokeStyle = 'rgba(60,44,26,0.85)'; g.lineWidth = Math.max(1.5, R * 0.035); g.lineCap = 'round';
    g.beginPath(); g.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
    g.lineTo(Math.cos(a) * l * 0.6, Math.sin(a) * l * 0.6);
    g.lineTo(Math.cos(a + 0.5) * l, Math.sin(a + 0.5) * l);
    g.stroke();
  }
  return { c, sh, S: S_ };
}

function buildPads() {
  const u = Math.min(W, H), st = PAD_STYLE[season()];
  pads = [];
  PAD_LAYOUT.forEach((p, i) => {
    if (st.drop && st.drop.includes(i)) return;
    const R = p[2] * u * st.size;
    const { c, sh, S: size } = renderPad(R, i * 97 + 13, !!p[3], st);
    // Codex / GPT / 模型 ID 无法确认: normalized anchors refer to the usable inner frame, including rotation, pulse and shadows.
    const margin = size * Math.SQRT1_2 * 1.035 + 12 * Math.max(0.8, SCALE) * 1.7 + FRAME_GAP;
    pads.push({ bx: lerp(margin, W - margin, p[0]), by: lerp(margin, H - margin, p[1]), margin, R, img: c, sh, S: size, ox: 0, oy: 0, vx: 0, vy: 0, rot0: i * 1.9, seed: i * 1.7, pulse: 0, pt: 0, flower: !!p[3], x: 0, y: 0, rot: 0 });
  });
  updatePadPose();
}

function updatePadPose() {
  const wob = 1 + ENV.wind * 2.5;
  for (const p of pads) {
    p.x = p.bx + p.ox + Math.sin(time * 0.15 * wob + p.seed) * 3 * wob;
    p.y = p.by + p.oy + Math.cos(time * 0.12 * wob + p.seed * 1.3) * 3 * wob;
    p.rot = p.rot0 + Math.sin(time * 0.08 * wob + p.seed) * 0.05 * wob + p.ox * 0.002;
    p.x = clamp(p.x, p.margin, W - p.margin);
    p.y = clamp(p.y, p.margin, H - p.margin);
  }
}

function updatePads(dt) {
  for (const p of pads) {
    p.vx += (-5 * p.ox - 1.8 * p.vx) * dt;
    p.vy += (-5 * p.oy - 1.8 * p.vy) * dt;
    p.ox += p.vx * dt; p.oy += p.vy * dt;
    p.pulse *= Math.exp(-dt * 2.2); p.pt += dt;
  }
  updatePadPose();
}

function drawPads(g) {
  const off = 12 * Math.max(0.8, SCALE);
  g.globalAlpha = 1 - ENV.cloud * 0.5;
  for (const p of pads) {
    g.save();
    g.translate(p.x + off * SUN.x, p.y + off * SUN.y); g.rotate(p.rot);
    g.drawImage(p.sh, -p.S / 2, -p.S / 2, p.S, p.S);
    g.restore();
  }
  g.globalAlpha = 1;
  for (const p of pads) {
    const sc = 1 + p.pulse * 0.035 * Math.sin(p.pt * 9);
    g.save();
    g.translate(p.x, p.y); g.rotate(p.rot); g.scale(sc, sc);
    g.drawImage(p.img, -p.S / 2, -p.S / 2, p.S, p.S);
    g.restore();
  }
}

function padAt(x, y, k) {
  for (const p of pads) if (Math.hypot(p.x - x, p.y - y) < p.R * (k || 0.95)) return p;
  return null;
}

/* 漂在水面的花叶：随季节换——春桃花、夏荷瓣、秋银杏和枫叶、冬枯叶 */
let petalSprites = [];
function spriteCanvas(s, draw) {
  const c = mkCanvas((s * 2 + 12) * DPR, (s * 2 + 12) * DPR), g = c.getContext('2d');
  g.scale(DPR, DPR); g.translate(s + 6, s + 6);
  g.shadowColor = 'rgba(10,32,26,0.35)'; g.shadowBlur = 3 * DPR; g.shadowOffsetX = 2 * DPR; g.shadowOffsetY = 3 * DPR;
  draw(g, s);
  return c;
}
function petalSprite(c0, c1, s) {
  return spriteCanvas(s, g => {
    g.beginPath(); g.moveTo(0, s);
    g.bezierCurveTo(s * 0.7, s * 0.4, s * 0.55, -s * 0.7, 0, -s);
    g.bezierCurveTo(-s * 0.55, -s * 0.7, -s * 0.7, s * 0.4, 0, s);
    const gr = g.createLinearGradient(0, s, 0, -s);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fill();
  });
}
function blossomSprite(s) {
  // 五瓣的小桃花
  return spriteCanvas(s, g => {
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(i / 5 * TAU);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(s * 0.45, -s * 0.3, s * 0.4, -s * 0.95, 0, -s * 0.8);
      g.bezierCurveTo(-s * 0.4, -s * 0.95, -s * 0.45, -s * 0.3, 0, 0);
      g.fillStyle = '#f7c6d3'; g.fill();
      g.restore();
    }
    g.shadowColor = 'transparent';
    g.fillStyle = '#e9859f'; g.beginPath(); g.arc(0, 0, s * 0.2, 0, TAU); g.fill();
  });
}
function ginkgoSprite(s, c0, c1) {
  return spriteCanvas(s, g => {
    g.beginPath(); g.moveTo(0, s * 0.35);
    g.lineTo(-s * 0.85, -s * 0.45);
    g.quadraticCurveTo(-s * 0.5, -s * 0.95, -s * 0.06, -s * 0.72);
    g.lineTo(0, -s * 0.5); g.lineTo(s * 0.06, -s * 0.72);
    g.quadraticCurveTo(s * 0.5, -s * 0.95, s * 0.85, -s * 0.45);
    g.closePath();
    const gr = g.createRadialGradient(0, s * 0.3, 0, 0, s * 0.3, s * 1.2);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(150,110,20,0.35)'; g.lineWidth = 0.6;
    for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(0, s * 0.3); g.lineTo(Math.sin(i * 0.2) * s * 0.85, -s * 0.5 - Math.cos(i * 0.2) * s * 0.2); g.stroke(); }
    g.strokeStyle = c1; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, s * 0.35); g.lineTo(0, s * 0.95); g.stroke();
  });
}
function mapleSprite(s, c0, c1) {
  // 五裂的枫叶：每个裂片是一个尖角，中间凹进去
  return spriteCanvas(s, g => {
    const tips = [-90, -38, 14, 166, 218].map(d => d * Math.PI / 180);
    const lens = [1, 0.85, 0.6, 0.6, 0.85];
    g.beginPath();
    tips.forEach((a, i) => {
      const L = s * lens[i], a0 = a - 0.32, a1 = a + 0.32;
      const inner = s * 0.32;
      if (i === 0) g.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
      else g.lineTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
      g.lineTo(Math.cos(a - 0.12) * L * 0.72, Math.sin(a - 0.12) * L * 0.72);
      g.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      g.lineTo(Math.cos(a + 0.12) * L * 0.72, Math.sin(a + 0.12) * L * 0.72);
      g.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
    });
    g.lineTo(0, s * 0.3);
    g.closePath();
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(90,20,10,0.35)'; g.lineWidth = 0.6;
    for (const a of tips) { g.beginPath(); g.moveTo(0, s * 0.2); g.lineTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8); g.stroke(); }
    g.strokeStyle = c1; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, s * 0.3); g.lineTo(0, s * 0.9); g.stroke();
  });
}
function buildPetals() {
  const se = season();
  if (se === 'spring') petalSprites = [blossomSprite(13), blossomSprite(11), petalSprite('#fdf1f4', '#f3a9bd', 11)];
  else if (se === 'summer') petalSprites = [petalSprite('#fbeff2', '#e7809e', 14)];
  else if (se === 'autumn') petalSprites = [ginkgoSprite(17, '#f6d45a', '#dba12c'), ginkgoSprite(15, '#f2c64a', '#c98e22'), mapleSprite(19, '#e5642e', '#b52f1a'), mapleSprite(16, '#d9492a', '#9c2414')];
  else petalSprites = [ginkgoSprite(15, '#b89a6a', '#8a6a3e'), mapleSprite(16, '#9c6a44', '#6e4428')];
  const want = { spring: 11, summer: 6, autumn: 10, winter: 4 }[se];
  if (petals.length !== want) {
    petals = [];
    for (let i = 0; i < want; i++) petals.push({ x: rand(0, W), y: rand(0, H), a: rand(0, TAU), va: rand(-0.15, 0.15), vx: rand(-2, 5), vy: rand(-3, 3), s: rand(0.65, 1.05), k: i % petalSprites.length });
  }
  for (const p of petals) p.k %= petalSprites.length;
}
function updatePetals(dt) {
  const drift = 4 + ENV.wind * 22;
  for (const p of petals) {
    const k = Math.exp(-dt * 0.5);
    p.vx = p.vx * k + (drift - p.vx) * dt * 0.05;
    p.vy *= k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.va *= Math.exp(-dt * 0.3); p.a += p.va * dt + Math.sin(time * 0.3 + p.s * 9) * dt * 0.05;
    if (p.x > W + 30) p.x = -30; if (p.x < -30) p.x = W + 30;
    if (p.y > H + 30) p.y = -30; if (p.y < -30) p.y = H + 30;
  }
}
function drawPetals(g) {
  if (!S.petals) return;
  for (const p of petals) {
    const img = petalSprites[p.k], ps = img.width / DPR;
    g.save();
    // Codex / GPT / 模型 ID 无法确认: drifting petals fade while their complete rotated sprite still fits.
    g.globalAlpha = (p.life != null ? clamp(p.life / 6, 0, 1) : 1) * frameOpacity(frameCircle(p.x, p.y, ps * p.s * Math.SQRT1_2));
    g.translate(p.x, p.y); g.rotate(p.a); g.scale(p.s, p.s);
    g.drawImage(img, -ps / 2, -ps / 2, ps, ps);
    g.restore();
  }
}

/* 水波纹 / 鱼食 */
function drawRipples(g) {
  for (const r of ripples) {
    const k = r.age / r.life;
    const rr = r.maxR * (1 - Math.pow(1 - k, 3));
    // Codex / GPT / 模型 ID 无法确认: let expanding waves disappear before the full ring reaches the edge.
    const a = Math.pow(1 - k, 1.5) * r.strength * frameOpacity(frameCircle(r.x, r.y, rr + 4));
    g.lineWidth = 2.5;
    g.strokeStyle = `rgba(18,50,40,${a * 0.22})`;
    g.beginPath(); g.arc(r.x, r.y, rr + 2, 0, TAU); g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = `rgba(236,250,240,${a * 0.6})`;
    g.beginPath(); g.arc(r.x, r.y, rr, 0, TAU); g.stroke();
    if (rr > 14) {
      g.strokeStyle = `rgba(236,250,240,${a * 0.3})`;
      g.beginPath(); g.arc(r.x, r.y, rr * 0.7, 0, TAU); g.stroke();
    }
  }
}

function updateFood(dt) {
  for (const p of food) {
    const k = Math.exp(-dt * 1.2);
    p.vx = p.vx * k + (Math.random() - 0.5) * dt * 6 + ENV.wind * dt * 4;
    p.vy = p.vy * k + (Math.random() - 0.5) * dt * 6;
    p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
  }
  food = food.filter(p => !p.dead && p.age < 45);
}

function drawFood(g) {
  const r0 = 2.5 * Math.sqrt(SCALE);
  for (const p of food) {
    const fade = Math.min(1, (45 - p.age) / 5, p.age * 4);
    const r = r0 * p.s;
    g.globalAlpha = fade;
    g.fillStyle = 'rgba(14,40,32,0.25)';
    g.beginPath(); g.arc(p.x + 3, p.y + 4, r, 0, TAU); g.fill();
    g.fillStyle = '#c69b62';
    g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(250,232,190,0.9)';
    g.beginPath(); g.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.4, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}

function scatterFood(x, y) {
  sndFood(x);
  const n = 5 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), r = rand(2, 20);
    food.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * rand(4, 14), vy: Math.sin(a) * rand(4, 14), age: 0, s: rand(0.8, 1.25), dead: false });
  }
  while (food.length > 90) food.shift();
}
