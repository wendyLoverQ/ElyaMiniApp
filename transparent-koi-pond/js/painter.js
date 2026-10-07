/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   画锦鲤：在“我的锦鲤”里给它画上自己的花纹
   每一笔都是身体上的一个色块，放回池子以后跟着身体一起弯
   ============================================================ */
const PAINT_COLORS = [['#d8452c', '绯红'], ['#1b1d20', '墨黑'], ['#f0ece4', '雪白'], ['#e9b54e', '金黄'], ['#e0763a', '橙'], ['#5d7f97', '浅葱蓝']];
const PAINT_BASES = [['#f3efe7', '白', 0], ['#1d1f23', '墨', 0], ['#e9b54e', '黄金', 1], ['#e6eae7', '白金', 1], ['#e45a2c', '绯', 0], ['#8ea2ae', '浅葱', 0], ['#9b6b44', '茶', 0]];
const PAINT_MAX = 600;
const PAINT = { base: '#f3efe7', sheen: false, blobs: [], hist: [], color: 0, size: 0.055, fish: null, down: false, lx: 0, ly: 0, raf: 0 };

const painterEl = document.getElementById('painter');
const paintCv = document.getElementById('paint-cv');

// 从它现在的样子开始画
function openPainter() {
  const v = mineVariety();
  const f = new Fish({ seed: MINE.seed, variety: v, L: 100, z: 0.1, a: 0, x: 0, y: 0 });
  PAINT.base = v.base; PAINT.sheen = !!v.sheen;
  PAINT.blobs = f.blobs.map(b => ({ t: b.t, s: b.s, r: b.r, c: b.c }));
  PAINT.hist = [];
  painterEl.hidden = false;
  document.getElementById('paint-open').setAttribute('aria-expanded', 'true');
  syncPaintUI();
  renderPainter();
  painterEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function closePainter() {
  painterEl.hidden = true;
  document.getElementById('paint-open').setAttribute('aria-expanded', 'false');
}

function paintVariety() {
  return { name: CUSTOM_NAME, custom: true, base: PAINT.base, fin: finFor(PAINT.base), sheen: PAINT.sheen, rarity: 0 };
}

// 画布上摆一条直直的鱼，头朝右
function renderPainter() {
  PAINT.raf = 0;
  const d = Math.min(2, devicePixelRatio || 1);
  const cw = paintCv.clientWidth || 300, ch = paintCv.clientHeight || 130;
  if (paintCv.width !== Math.round(cw * d)) { paintCv.width = Math.round(cw * d); paintCv.height = Math.round(ch * d); }
  const g = paintCv.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, cw, ch);
  const L = Math.min(cw * 0.74, ch * 2.4);
  let f = PAINT.fish;
  if (!f || f.L !== L || f.cw !== cw) {
    f = new Fish({ seed: MINE.seed, variety: paintVariety(), L, z: 0, a: 0, x: cw / 2 + L * 0.47, y: ch / 2 });
    f.still = true; f.speed = 0; f.cw = cw;
    f.buildGeometry();
    PAINT.fish = f;
  }
  f.v = paintVariety();
  f.blobs = PAINT.blobs;
  f.draw(g);
}
function queuePaint() { if (!PAINT.raf) PAINT.raf = requestAnimationFrame(renderPainter); }

// 画布坐标 → 身体坐标 (t, s)
function toBody(x, y) {
  const f = PAINT.fish, span = f.seg * f.segLen;
  const t = clamp((f.dx[0] - x) / span, -0.08, 1.02);
  const k = clamp(t, 0, 1) * f.seg, i = Math.min(f.seg - 1, k | 0);
  const w = f.w[i] + (f.w[i + 1] - f.w[i]) * (k - i);
  return [t, clamp((y - f.dy[0]) / Math.max(1, w), -1.6, 1.6)];
}

function dab(x, y) {
  const f = PAINT.fish, rpx = PAINT.size * f.L;
  if (PAINT.color < 0) {
    // 橡皮：擦掉笔下的色块
    const before = PAINT.blobs.length;
    PAINT.blobs = PAINT.blobs.filter(b => { const [bx, by] = f.sample(b.t, b.s); return Math.hypot(bx - x, by - y) > rpx + b.r * f.L * 0.3; });
    return PAINT.blobs.length !== before;
  }
  if (PAINT.blobs.length >= PAINT_MAX) return false;
  const [t, s] = toBody(x, y);
  PAINT.blobs.push({ t: +t.toFixed(3), s: +s.toFixed(3), r: PAINT.size, c: PAINT_COLORS[PAINT.color][0] });
  return true;
}
function strokeTo(x, y) {
  const step = Math.max(2, PAINT.size * PAINT.fish.L * 0.45);
  const dx = x - PAINT.lx, dy = y - PAINT.ly, d = Math.hypot(dx, dy);
  if (d < step) return;
  const n = Math.floor(d / step);
  for (let i = 1; i <= n; i++) dab(PAINT.lx + dx * i / n, PAINT.ly + dy * i / n);
  PAINT.lx = x; PAINT.ly = y;
  queuePaint();
}
function paintPos(e) { const r = paintCv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
paintCv.addEventListener('pointerdown', e => {
  if (!PAINT.fish) return;
  e.preventDefault();
  try { paintCv.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  pushHist();
  PAINT.down = true;
  const [x, y] = paintPos(e);
  PAINT.lx = x; PAINT.ly = y;
  dab(x, y);
  queuePaint();
});
paintCv.addEventListener('pointermove', e => { if (PAINT.down) strokeTo(...paintPos(e)); });
const endStroke = () => { if (!PAINT.down) return; PAINT.down = false; commitPaint(); };
paintCv.addEventListener('pointerup', endStroke);
paintCv.addEventListener('pointercancel', endStroke);

function pushHist() {
  PAINT.hist.push({ b: PAINT.blobs.slice(), base: PAINT.base, sheen: PAINT.sheen });
  if (PAINT.hist.length > 40) PAINT.hist.shift();
}
// 每画完一笔就放回池子里：池中那条马上换上新花纹
function commitPaint() {
  const cols = [], idx = new Map();
  const b = PAINT.blobs.map(o => {
    if (!idx.has(o.c)) { idx.set(o.c, cols.length); cols.push(o.c); }
    return [o.t, o.s, +o.r.toFixed(3), idx.get(o.c)];
  });
  MINE.custom = { base: PAINT.base, sheen: PAINT.sheen ? 1 : 0, cols, b };
  MINE.variety = CUSTOM_NAME;
  saveMine();
  spawnMine();
  MINE.showT = Math.max(MINE.showT, 3);
  refreshMinePane(true);
  syncPaintUI();
  renderPainter();
}

function swatch(hex, label, on, extra) {
  return `<button type="button" class="sw${extra || ''}" style="--c:${hex}" aria-label="${label}" title="${label}" aria-pressed="${on}"></button>`;
}
document.getElementById('paint-cols').innerHTML =
  PAINT_COLORS.map(([c, n]) => swatch(c, n, false)).join('') + swatch('transparent', '橡皮', false, ' eraser');
document.getElementById('paint-bases').innerHTML = PAINT_BASES.map(([c, n]) => swatch(c, n + '底', false)).join('');
// 色块的名字（中文原文），换语言时 translatePage() 按 {c}底 的格式翻
function translateSwatches() {
  document.querySelectorAll('#paint-cols .sw').forEach((b, i) => { const n = i < PAINT_COLORS.length ? PAINT_COLORS[i][1] : '橡皮'; b.title = b.ariaLabel = t(n); });
  document.querySelectorAll('#paint-bases .sw').forEach((b, i) => { b.title = b.ariaLabel = t('{c}底', { c: t(PAINT_BASES[i][1]) }); });
}
function syncPaintUI() {
  document.querySelectorAll('#paint-cols .sw').forEach((b, i) => b.setAttribute('aria-pressed', String(i === (PAINT.color < 0 ? PAINT_COLORS.length : PAINT.color))));
  document.querySelectorAll('#paint-bases .sw').forEach((b, i) => b.setAttribute('aria-pressed', String(PAINT_BASES[i][0] === PAINT.base)));
  for (const b of document.querySelectorAll('#paint-size button')) b.setAttribute('aria-pressed', String(+b.dataset.val === PAINT.size));
  document.getElementById('paint-count').textContent = PAINT.blobs.length >= PAINT_MAX ? t('画满了，擦掉一些再画') : '';
}
document.getElementById('paint-cols').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const i = [...b.parentElement.children].indexOf(b);
  PAINT.color = i >= PAINT_COLORS.length ? -1 : i;
  syncPaintUI();
});
document.getElementById('paint-bases').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const [c, , sheen] = PAINT_BASES[[...b.parentElement.children].indexOf(b)];
  pushHist();
  PAINT.base = c; PAINT.sheen = !!sheen;
  commitPaint();
});
document.getElementById('paint-size').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  PAINT.size = +b.dataset.val; syncPaintUI();
});
document.getElementById('paint-undo').addEventListener('click', () => {
  const h = PAINT.hist.pop();
  if (!h) return;
  PAINT.blobs = h.b; PAINT.base = h.base; PAINT.sheen = h.sheen;
  commitPaint();
});
document.getElementById('paint-clear').addEventListener('click', () => {
  if (!PAINT.blobs.length) return;
  pushHist();
  PAINT.blobs = [];
  commitPaint();
});
document.getElementById('paint-open').addEventListener('click', () => (painterEl.hidden ? openPainter() : closePainter()));
document.getElementById('paint-done').addEventListener('click', () => { closePainter(); MINE.showT = 6; closePanel(); });
