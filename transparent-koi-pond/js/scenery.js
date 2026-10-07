/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   花瓣、鱼食、水波纹
   ============================================================ */
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
