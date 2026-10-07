/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */

'use strict';
// Codex / GPT / 模型 ID 无法确认: retain object shading without adding alpha to the surrounding desktop.
function drawTransparentLighting(g) {
  const c = lightColor();
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(' + c.map(Math.round).join(',') + ',' + Math.min(0.42, ENV.dark * 0.35 + ENV.dusk * 0.08 + ENV.cloud * 0.08) + ')';
  g.fillRect(0, 0, W, H);
  if (ENV.flash > 0.02) { g.fillStyle = 'rgba(236,242,255,' + ENV.flash * 0.45 + ')'; g.fillRect(0, 0, W, H); }
  g.restore();
  const mp = ENV.dark > 0.02 ? moonPlace() : null;
  if (!mp) MOONW.a = 0;
  else drawMoon(g, mp.x, mp.y, mp.a * ENV.dark * Math.pow(1 - ENV.cloud, 1.5) * (1 - ENV.fog * 0.7) * (1 - ENV.rain * 0.6));
}

// Codex / GPT / 模型 ID 无法确认: downsample browser Canvas alpha, merge occupied scanline runs, and submit only visible pixels.
const surfaceCanvas = document.createElement('canvas');
const surfaceContext = surfaceCanvas.getContext('2d', { willReadFrequently: true });
let surfaceAt = -Infinity;
function publishKoiSurface(force = false) {
  const now = performance.now();
  if (!force && now - surfaceAt < 60) return;
  surfaceAt = now;
  const cell = Math.max(4, Math.ceil(Math.max(innerWidth / 240, innerHeight / 160)));
  const cw = Math.ceil(innerWidth / cell), ch = Math.ceil(innerHeight / cell);
  if (surfaceCanvas.width !== cw || surfaceCanvas.height !== ch) { surfaceCanvas.width = cw; surfaceCanvas.height = ch; }
  surfaceContext.clearRect(0, 0, cw, ch);
  surfaceContext.drawImage(cvs, 0, 0, innerWidth / cell, innerHeight / cell);
  const pixels = surfaceContext.getImageData(0, 0, cw, ch).data;
  const regions = []; let previous = new Map();
  for (let y = 0; y < ch; y++) {
    const current = new Map();
    for (let x = 0; x < cw;) {
      if (pixels[(y * cw + x) * 4 + 3] < 24) { x++; continue; }
      const left = x;
      while (x < cw && pixels[(y * cw + x) * 4 + 3] >= 24) x++;
      const key = left + ':' + x, existing = previous.get(key);
      if (existing) { existing.height = Math.min(innerHeight - existing.y, existing.height + cell); current.set(key, existing); }
      else {
        const region = { shape: 'rect', action: 'interactive', x: left * cell, y: y * cell, width: Math.min(innerWidth, x * cell) - left * cell, height: Math.min(cell, innerHeight - y * cell) };
        regions.push(region); current.set(key, region);
      }
    }
    previous = current;
  }
  const addDOM = (element, action) => {
    if (!element || element.hidden || element.closest('[hidden], [inert], [aria-hidden="true"]')) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || +style.opacity === 0) return;
    const r = element.getBoundingClientRect(), x = Math.max(0, r.x), y = Math.max(0, r.y);
    const width = Math.min(innerWidth, r.right) - x, height = Math.min(innerHeight, r.bottom) - y;
    if (width > 0 && height > 0) regions.push({ shape: element.classList.contains('gear') ? 'ellipse' : 'rect', action, x, y, width, height, ...(action === 'drag' ? { hostGestures: ['move','scale-wheel'] } : {}) });
  };
  addDOM(document.getElementById('almanac'), 'drag');
  addDOM(document.getElementById('move-handle'), 'drag');
  addDOM(document.getElementById('feed-koi'), 'interactive');
  addDOM(gear, 'interactive');
  if (panelOpen) addDOM(panel, 'interactive');
  addDOM(document.getElementById('koi-runtime-error'), 'interactive');
  window.elyaPet.setInteractionSurface({ width: innerWidth, height: innerHeight, regions });
}

function connectElya() {
  const runtime = window.elyaPet;
  EN['点击锦鲤或喂食按钮撒食 · 拖动荷花图标移动'] = 'Click koi or the feed button to feed · Drag the flower handle to move';
  EN['实时天气未连接。请在 Elya 资源详情允许联网，或手动选择天气。'] = 'Live weather is disconnected. Allow network access in Elya resource details, or choose weather manually.';
  applyLang();
  document.getElementById('feed-koi').addEventListener('click', () => {
    const x = rand(W * 0.3, W * 0.65), y = rand(H * 0.3, H * 0.7);
    scatterFood(x, y); addRipple(x, y, 70 * SCALE + 30, 2.6, 1); hideHint();
  });
  runtime.onLifecycle(state => {
    switch (state.type) {
      case 'hidden': case 'paused': HOST.paused = true; break;
      case 'shown': case 'resumed': HOST.paused = false; break;
      default: return;
    }
    onHostPause();
  });
  runtime.onDispose(() => { saveAll(); saveJSON(SETTINGS_KEY, S); return window.KoiHost.flush(); });
  const observer = new MutationObserver(() => publishKoiSurface(true));
  observer.observe(panel, { attributes: true, subtree: true, childList: true });
  publishKoiSurface(true);
}
