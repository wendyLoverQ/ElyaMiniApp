/* Codex / GPT / 模型 ID 无法确认: keep complete animated subjects inside the transparent viewport. */
'use strict';
const FRAME_GAP = 8;
function frameCircle(x, y, radius, shadow = 0) {
  const ox = SUN.x * shadow, oy = SUN.y * shadow;
  return { left: x - radius + Math.min(0, ox), right: x + radius + Math.max(0, ox),
    top: y - radius + Math.min(0, oy), bottom: y + radius + Math.max(0, oy) };
}
function frameCorrection(b) {
  const axis = (lo, hi, size) => Math.max(FRAME_GAP - lo, Math.min(0, size - FRAME_GAP - hi));
  return [axis(b.left, b.right, W), axis(b.top, b.bottom, H)];
}
function containActor(actor, radius, shadow = 0) {
  const [dx, dy] = frameCorrection(frameCircle(actor.x, actor.y, radius, shadow));
  actor.x += dx; actor.y += dy;
}
function fishFrame(f) {
  const h = f.leap ? Math.sin(Math.PI * f.leap) : 0;
  const scale = 1 + h * (f.ascend ? 1.2 : 0.55), [cx, cy] = f.sample(0.4, 0);
  const r = f.L * (0.27 * f.finScale + 0.06);
  const glow = f.v.glow ? f.L * 0.7 * scale : 0;
  const off = 4 + (1 - f.z) * 16 + h * 70;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (let i = 0; i <= f.seg; i++) {
    const x = cx + (f.dx[i] - cx) * scale, y = cy + (f.dy[i] - cy) * scale;
    left = Math.min(left, x - r * scale - glow, f.dx[i] - r + off * SUN.x);
    right = Math.max(right, x + r * scale + glow, f.dx[i] + r + off * SUN.x);
    top = Math.min(top, y - r * scale - glow, f.dy[i] - r + off * SUN.y);
    bottom = Math.max(bottom, y + r * scale + glow, f.dy[i] + r + off * SUN.y);
  }
  if (f.mine) {
    const [mx, my] = f.sample(0.35, 0), ring = f.L * 0.62 + 12;
    left = Math.min(left, mx - ring); right = Math.max(right, mx + ring);
    top = Math.min(top, my - ring); bottom = Math.max(bottom, my + ring);
  }
  return { left, right, top, bottom };
}
function containFish(f) {
  if (f.visitor) return;
  const [dx, dy] = frameCorrection(fishPresentation(f).bounds);
  if (!dx && !dy) return;
  f.x += dx; f.y += dy;
  for (let i = 0; i <= f.seg; i++) { f.px[i] += dx; f.py[i] += dy; }
  f.buildGeometry();
}
function frameOpacity(b) {
  const distance = Math.min(b.left, b.top, W - b.right, H - b.bottom) - FRAME_GAP;
  const t = clamp(distance / (Math.min(W, H) * 0.06), 0, 1);
  return t * t * (3 - 2 * t);
}
// Codex / GPT / 模型 ID 无法确认: departing actors retain their lifecycle; opacity reaches zero before any outline crosses the edge.
function drawFramed(g, bounds, paint) {
  const opacity = frameOpacity(bounds);
  if (!opacity) return;
  g.save();
  g.filter = 'opacity(' + opacity + ')';
  paint();
  g.restore();
}
// Codex / GPT / 模型 ID 无法确认: fit the full rendered fish without changing resident growth or visitor travel.
function fishPresentation(f) {
  const b = fishFrame(f), cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  const inset = FRAME_GAP + Math.min(W, H) * 0.07;
  const scale = Math.min(1, (W - inset * 2) / (b.right - b.left), (H - inset * 2) / (b.bottom - b.top));
  const bounds = {left: cx + (b.left - cx) * scale, right: cx + (b.right - cx) * scale,
    top: cy + (b.top - cy) * scale, bottom: cy + (b.bottom - cy) * scale};
  return { bounds, cx, cy, scale };
}
function drawSwimmer(g, s, shadow) {
  const paint = () => shadow ? s.drawShadow(g) : s.draw(g);
  if (!s.px) { paint(); return; }
  const { bounds, cx, cy, scale } = fishPresentation(s);
  const fitted = () => {
    g.save(); g.translate(cx, cy); g.scale(scale, scale); g.translate(-cx, -cy); paint(); g.restore();
  };
  if (s.visitor) drawFramed(g, bounds, fitted);
  else fitted();
}
function containPondSubjects() {
  for (const f of fish) containFish(f);
  for (const t of turtles) containActor(t, t.S * 0.95 + 2, 4 + (1 - t.z) * 14);
  for (const f of frogs) containActor(f, f.s * 3.2 + 3, f.state === 'jump' ? 43 : 0);
  for (const f of fireflies) containActor(f, 18);
  for (const p of food) containActor(p, 9);
}
