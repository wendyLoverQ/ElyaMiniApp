/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   我的锦鲤：属于你的一条，会被标出来，吃得越多、陪得越久长得越大
   ============================================================ */
const MINE_KEY = 'koipond.mine.v1';
const MINE_DEFAULT_NAME = '小锦';
function newMineData() {
  return { name: MINE_DEFAULT_NAME, variety: '红白', seed: (Math.random() * 1e9) | 0, born: Date.now(), eaten: 0, watched: 0 };
}
const MINE = Object.assign(newMineData(), loadJSON(MINE_KEY));
MINE.fish = null; MINE.showT = 8; MINE.markerA = 0; MINE.summonT = 0; MINE.saveAcc = 0;
saveMine();

// 改名：面板里打字、点“换一个”、壁纸属性栏里填，都走这里
const MINE_NAME_MAX = 16;
function renameMine(name) {
  MINE.name = String(name).trim().slice(0, MINE_NAME_MAX) || MINE_DEFAULT_NAME;
  saveMine();
  MINE.showT = 4;
}

function saveMine() {
  const { name, variety, seed, born, eaten, watched, custom } = MINE;
  saveJSON(MINE_KEY, { name, variety, seed, born, eaten, watched, custom });
}

// 自己画的花纹：底色 + 一堆色块，和品种花纹一样按“沿身体 t、横向 s、半径 r”记，游起来会跟着身体弯
const CUSTOM_NAME = '自绘';
function finFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const up = c => Math.min(255, Math.round(c + (255 - c) * 0.25));
  return `rgba(${up(r)},${up(g)},${up(b)},0.55)`;
}
function customVariety(c) {
  c = c || MINE.custom;
  if (!c) return null;
  const blobs = c.b.map(([t, s, r, i]) => ({ t, s, r, c: c.cols[i] }));
  return { name: CUSTOM_NAME, custom: true, w: 0, rarity: 0, base: c.base, fin: finFor(c.base), sheen: !!c.sheen, gen: () => blobs.slice() };
}
function mineVariety() {
  if (MINE.variety === CUSTOM_NAME && MINE.custom) return customVariety();
  return VARIETIES.find(v => v.name === MINE.variety) || VARIETIES[0];
}
function mineKindLabel() { return MINE.variety === CUSTOM_NAME ? t('自己画的花纹') : nm(MINE.variety); }

// 成长：0 → 1，喂 160 粒左右或陪 12 小时左右长到一半
function mineGrowth() { return 1 - Math.exp(-(MINE.eaten / 160 + MINE.watched / (3600 * 12))); }
function mineLength() { return 46 * SCALE * (1 + 1.1 * mineGrowth()); }
function mineCm() { return cmOf(mineLength() / SCALE); }

function spawnMine() {
  const v = mineVariety();
  const old = MINE.fish;
  const f = new Fish({ seed: MINE.seed, variety: v, L: mineLength(), mine: true, z: 0.1, x: old ? old.x : undefined, y: old ? old.y : undefined, a: old ? old.a : undefined });
  if (old) { const i = fish.indexOf(old); if (i >= 0) fish[i] = f; else fish.push(f); }
  else fish.push(f);
  MINE.fish = f;
  sortSwimmers();
  return f;
}

function mineAte() {
  MINE.eaten++;
  saveMine();
}

function updateMine(dt) {
  const f = MINE.fish;
  if (!f) return;
  MINE.watched += dt;
  MINE.saveAcc += dt;
  if (MINE.saveAcc > 20) { MINE.saveAcc = 0; saveMine(); }
  const L = mineLength();
  if (Math.abs(f.L - L) > 0.05) f.setLength(lerp(f.L, L, Math.min(1, dt * 0.5)));
  MINE.showT -= dt; MINE.summonT -= dt;
  let vis = MINE.showT > 0 || S.marker === 'always' ? 1 : 0;
  if (pointer.inside) { const [cx, cy] = f.sample(0.35, 0); if (Math.hypot(pointer.x - cx, pointer.y - cy) < f.L * 0.9) vis = 1; }
  MINE.markerA += (vis - MINE.markerA) * Math.min(1, dt * 4);
}

function drawMineMarker(g) {
  if (MINE.fish && MINE.markerA >= 0.02) drawFishRing(g, MINE.fish, nm(MINE.name), MINE.markerA);
}

// 在鱼身周围画一个圈，上面写名字
function drawFishRing(g, f, label, alpha) {
  const [cx, cy] = f.sample(0.35, 0);
  const r = f.L * 0.62 + 8 + Math.sin(time * 2.4) * 2;
  g.globalAlpha = alpha;
  g.strokeStyle = 'rgba(16,40,34,0.35)'; g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(250,252,246,0.92)'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
  if (label) {
    g.font = '600 16px "Noto Serif SC", "Songti SC", "STSong", serif';
    g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(16,40,34,0.5)';
    g.fillText(label, cx + 1, cy - r - 7);
    g.fillStyle = '#fbfdf8';
    g.fillText(label, cx, cy - r - 8);
  }
  g.globalAlpha = 1;
}

// 面板里的小画像：同一颗种子，姿势摆直；silhouette 时只画剪影
function drawFishPortrait(canvas, o) {
  const d = Math.min(2, devicePixelRatio || 1);
  const cw = canvas.clientWidth || 120, ch = canvas.clientHeight || 64;
  canvas.width = cw * d; canvas.height = ch * d;
  const g = canvas.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, cw, ch);
  const L = Math.min(cw * 0.72, ch * 2.1);
  const f = new Fish({ seed: o.seed, variety: o.variety, L, z: o.z, a: 0, x: cw / 2 + L * 0.47, y: ch / 2 });
  f.z = 0; f.speed = 0;
  f.buildGeometry();
  f.draw(g);
  if (o.silhouette) {
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = 'rgba(214,236,224,0.16)';
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'source-over';
  }
}
function drawMinePortrait(canvas) {
  drawFishPortrait(canvas, { seed: MINE.seed, variety: mineVariety(), z: 0.1 });
}
