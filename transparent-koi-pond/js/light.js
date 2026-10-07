/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   光影：太阳的方向和影子、夜里的星星和月相、雨后的彩虹
   ============================================================ */
const LIGHT = { f: 0.5, acc: 99, stars: [], moon: 0.5, moonF: null, mist: 0 };
const RAINBOW = { a: 0, t: 0, armed: 0 };

// 一天走到哪儿了：0 日出 → 1 日落；夜里是 null
function dayFrac() {
  if (S.timeMode === 'day') return 0.42;
  if (S.timeMode === 'dusk') return 0.96;
  if (S.timeMode === 'night') return null;
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const f = (h - ENV.sunrise) / (ENV.sunset - ENV.sunrise);
  return f < -0.05 || f > 1.05 ? null : clamp(f, 0, 1);
}

// 月相：0 新月 → 0.5 满月 → 1 新月
function moonPhase(ms) {
  const days = (ms - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return ((days / 29.530588853) % 1 + 1) % 1;
}

// 月亮在天上走到哪儿：月亮大约在“中午 + 月相×24 小时”过中天，前后各 6 小时在天上。
// 所以满月整夜都在，上弦月只在前半夜，下弦月后半夜才升起，新月前后夜里看不到。
// 返回 0 月出 → 1 月落，不在天上时是 null；手动选“夜晚”时，月亮不在天上就放在正中
function moonArc() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const transit = (12 + LIGHT.moon * 24) % 24;
  const f = ((((h - transit) % 24) + 36) % 24 - 12 + 6) / 12;
  if (f >= 0 && f <= 1) return f;
  return S.timeMode === 'night' ? 0.5 : null;
}
// 倒影的位置：和太阳走同一条路，从右边升起，移到左边落下；越低越靠近池边
function moonPlace() {
  const f = LIGHT.moonF;
  if (f == null) return null;
  const ang = lerp(2.2, -0.2, f), elev = Math.sin(Math.PI * f), R = Math.min(W, H) * (0.22 + 0.2 * (1 - elev));
  const fade = clamp(f / 0.06, 0, 1) * clamp((1 - f) / 0.06, 0, 1);
  // Codex / GPT / 模型 ID 无法确认: include the disturbed moon sprite and shimmer in its safe inset.
  const margin = 65 * Math.max(0.8, SCALE);
  return { x: clamp(W / 2 - Math.cos(ang) * R * 1.2, margin, W - margin), y: clamp(H / 2 - Math.sin(ang) * R, margin, H - margin), a: fade };
}

// 晨雾：春、秋、冬的清早，天晴的时候水面上浮着一层薄雾
function mistAmount() {
  if (S.timeMode !== 'auto' || season() === 'summer') return 0;
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const k = (h - (ENV.sunrise - 0.5)) / 2.5;
  return k < 0 || k > 1 ? 0 : 0.38 * Math.sin(Math.PI * Math.sqrt(k));
}

function buildStars() {
  const R = mulberry32(5), n = Math.round(clamp(W * H / 16000, 40, 160));
  LIGHT.stars = [];
  for (let i = 0; i < n; i++) {
    const x = lerp(16, W - 16, R()), y = lerp(16, H - 16, R());
    if (padAt(x, y, 1.05)) continue;
    const big = R() < 0.08;
    LIGHT.stars.push({ x, y, r: big ? 1.5 + R() : 0.6 + R() * 0.7, ph: R() * TAU, rate: 0.6 + R() * 2.2 });
  }
}

function updateLight(dt) {
  LIGHT.acc += dt;
  if (LIGHT.acc > 1) {
    LIGHT.acc = 0;
    LIGHT.f = dayFrac();
    LIGHT.moon = moonPhase(Date.now());
    LIGHT.moonF = moonArc();
    LIGHT.mist = mistAmount();
  }
  // 影子：早上斜向左下，正午短，傍晚拉长朝右
  const f = LIGHT.f == null ? 0.5 : LIGHT.f;
  const ang = lerp(2.2, -0.2, f), elev = Math.sin(Math.PI * f);
  const k = 0.8 + 0.9 * Math.pow(1 - elev, 1.5), e = Math.min(1, dt * 0.5);
  SUN.x += (Math.cos(ang) * k - SUN.x) * e;
  SUN.y += (Math.sin(ang) * k - SUN.y) * e;
  SUN.lit = (1 - ENV.cloud * 0.8) * (1 - ENV.dark) * (1 - ENV.rain * 0.6) * (1 - ENV.fog * 0.6);

  MOONW.d *= Math.exp(-dt * 0.45);
  if (ENV.dark < 0.02) MOONW.a = 0;

  // 彩虹：下过一场雨，雨停了太阳又出来，大概一半的机会
  if (ENV.rain > 0.35) RAINBOW.armed = 600;
  else RAINBOW.armed -= dt;
  if (RAINBOW.armed > 0 && RAINBOW.t <= 0 && ENV.rain < 0.08 && ENV.cloud < 0.6 && ENV.dark < 0.25 && LIGHT.f != null) {
    RAINBOW.armed = 0;
    if (Math.random() < 0.55) RAINBOW.t = rand(100, 160);
  }
  if (RAINBOW.t > 0) RAINBOW.t -= dt;
  const want = RAINBOW.t > 0 && ENV.rain < 0.2 ? 1 : 0;
  RAINBOW.a += (want - RAINBOW.a) * Math.min(1, dt * (want ? 0.12 : 0.06));
}

// 星星的倒影，随水波微微晃
function starAlpha() { return ENV.dark * (1 - ENV.cloud) * (1 - ENV.fog) * (1 - ENV.rain) * (1 - ENV.snow * 0.7); }
function drawStars(g) {
  const a = starAlpha();
  if (a < 0.03) return;
  const wob = 1 + ENV.wind * 3;
  g.fillStyle = '#eef3ff';
  for (const s of LIGHT.stars) {
    const tw = 0.8 + 0.2 * Math.sin(time * s.rate * 0.5 + s.ph);
    g.globalAlpha = a * tw * 0.8;
    g.beginPath();
    g.arc(s.x + Math.sin(time * 1.1 + s.ph) * wob, s.y + Math.cos(time * 0.9 + s.ph) * wob * 0.5, s.r * Math.sqrt(SCALE), 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

// 水里的月亮：是倒影，不是光源。按真实的月相画，边缘是软的；
// 水面一动，倒影就碎成一条条横向错开的片，涟漪、雨点、手碰一下都会把它打碎，过一会儿再合拢
const MOONW = { d: 0, x: 0, y: 0, r: 0, a: 0, sx: 0, sy: 0, cv: null, key: '' };
function moonLit(p) { return (1 - Math.cos(TAU * p)) / 2; }
function moonSprite(mr, p, fest) {
  const key = `${Math.round(mr)}_${Math.round(p * 120)}_${fest}_${DPR}`;
  if (MOONW.key === key) return MOONW.cv;
  const S_ = mr * 2 + 8, c = mkCanvas(S_ * DPR, S_ * DPR), g = c.getContext('2d');
  g.scale(DPR, DPR); g.translate(S_ / 2, S_ / 2);
  const k = Math.cos(TAU * p);
  g.save();
  if (p > 0.5) g.scale(-1, 1);     // 上半月亮在右边，下半月亮在左边
  g.beginPath();
  g.arc(0, 0, mr, -Math.PI / 2, Math.PI / 2, false);
  if (k > 0) g.ellipse(0, 0, mr * k, mr, 0, Math.PI / 2, -Math.PI / 2, true);
  else g.ellipse(0, 0, -mr * k, mr, 0, Math.PI / 2, Math.PI * 1.5, false);
  g.closePath();
  g.restore();
  g.filter = `blur(${Math.max(1, mr * 0.06)}px)`;
  g.fillStyle = fest ? 'rgb(250,238,206)' : 'rgb(226,232,240)';
  g.fill();
  g.filter = 'none';
  // 月面上淡淡的暗斑
  g.globalCompositeOperation = 'source-atop';
  const R = mulberry32(12);
  for (let i = 0; i < 7; i++) {
    const a = R() * TAU, d = R() * mr * 0.6, r = mr * (0.12 + R() * 0.22);
    g.fillStyle = 'rgba(120,128,140,0.07)';
    g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU); g.fill();
  }
  MOONW.key = key; MOONW.cv = c; c.S = S_;
  return c;
}
// 月亮附近的水面被搅动了多少：手碰过、涟漪、雨点
function moonStir() {
  let d = MOONW.d, best = MOONW.d;
  const reach = MOONW.r * 3;
  for (const r of ripples) {
    const dist = Math.hypot(r.x - MOONW.x, r.y - MOONW.y);
    if (dist > reach + r.maxR) continue;
    const s = (1 - r.age / r.life) * r.strength * 0.35;
    d += s;
    if (s > best) { best = s; MOONW.sx = r.x; MOONW.sy = r.y; }
  }
  return Math.min(1.2, d);
}
function stirMoon(x, y) {
  if (MOONW.a < 0.15 || Math.hypot(x - MOONW.x, y - MOONW.y) > MOONW.r * 2.2) return false;
  MOONW.d = 1; MOONW.sx = x; MOONW.sy = y;
  bookMoment('moon');
  return true;
}
function drawMoon(g, mx, my, a) {
  const p = LIGHT.moon, lit = moonLit(p);
  MOONW.a = lit < 0.03 ? 0 : a;
  if (lit < 0.03) return;
  const fest = FEST && FEST.name === '中秋';
  const mr = (fest ? 28 : 24) * Math.max(0.8, SCALE);
  MOONW.x = mx; MOONW.y = my; MOONW.r = mr;
  const cv = moonSprite(mr, p, fest), S_ = cv.S;
  const stir = moonStir();
  const shimmer = 0.5 + ENV.wind * 2.5 + ENV.rain * 6;
  if (stir < 0.03) { drawMoonStrips(g, cv, mx, my, shimmer, a * 0.72); return; }
  drawMoonRippled(g, cv, mx, my, stir, shimmer, a * 0.72);
}
// 平时的倒影：切成细细的横条，每条随水波左右错一点，边缘就会微微颤
function drawMoonStrips(g, cv, x, y, amp, alpha) {
  const S_ = cv.S, n = 26, sh = S_ / n, src = cv.height / n;
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const dx = Math.sin(time * 1.3 + i * 0.8) * amp * (0.55 + 0.45 * Math.sin(time * 0.6 + i * 0.37));
    g.drawImage(cv, 0, i * src, cv.width, src, x - S_ / 2 + dx, y - S_ / 2 + i * sh, S_, sh + 0.6);
  }
  g.globalAlpha = 1;
}
// 被搅动时：涟漪从搅动的地方一圈圈往外走，倒影顺着涟漪被推开、扭弯，碎成一道道光弧；
// 水面平下来，倒影再慢慢合拢。按像素做位移，只在搅动的那几秒里算
const MW = { src: null, of: null, out: null, og: null, img: null };
function drawMoonRippled(g, cv, mx, my, stir, shimmer, alpha) {
  const d = DPR, sw = cv.width;
  if (MW.of !== cv) { MW.src = cv.getContext('2d').getImageData(0, 0, sw, cv.height).data; MW.of = cv; }
  const pad = Math.round(sw * 0.45), ow = sw + pad * 2;
  if (!MW.out || MW.out.width !== ow) { MW.out = mkCanvas(ow, ow); MW.og = MW.out.getContext('2d'); MW.img = MW.og.createImageData(ow, ow); }
  const o = MW.img.data, src = MW.src;
  o.fill(0);
  const cx = (MOONW.sx - mx) * d + ow / 2, cy = (MOONW.sy - my) * d + ow / 2;
  const mrD = MOONW.r * d, k = TAU / (mrD * 0.6), A = mrD * 0.45 * Math.min(1, stir), ph = time * 6, fall = 1 / (mrD * 2.5);
  const sh = shimmer * d;
  for (let y = 0; y < ow; y++) {
    const row = Math.sin(time * 1.3 + y / d * 0.8) * sh;
    for (let x = 0; x < ow; x++) {
      const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const disp = A * Math.sin(k * r - ph) * Math.exp(-r * fall);
      const sx = (x - pad - dx / r * disp - row) | 0, sy = (y - pad - dy / r * disp) | 0;
      if (sx < 0 || sy < 0 || sx >= sw || sy >= sw) continue;
      const si = (sy * sw + sx) * 4;
      if (!src[si + 3]) continue;
      const oi = (y * ow + x) * 4;
      o[oi] = src[si]; o[oi + 1] = src[si + 1]; o[oi + 2] = src[si + 2]; o[oi + 3] = src[si + 3];
    }
  }
  MW.og.putImageData(MW.img, 0, 0);
  g.globalAlpha = alpha * (1 - Math.min(1, stir) * 0.25);
  g.drawImage(MW.out, mx - ow / 2 / d, my - ow / 2 / d, ow / d, ow / d);
  g.globalAlpha = 1;
}

// 彩虹的倒影：一道很淡的弧，从池子的一角跨过去
function drawRainbow(g) {
  const a = RAINBOW.a * (1 - ENV.dark) * (1 - ENV.cloud * 0.6);
  if (a < 0.01) return;
  // Codex / GPT / 模型 ID 无法确认: show a complete rainbow arc rather than a wallpaper-sized cropped ring.
  const cx = W * 0.5, cy = H * 0.68, r = Math.min(W * 0.38, H * 0.45), bw = r * 0.06;
  const gr = g.createRadialGradient(cx, cy, r - bw, cx, cy, r + bw);
  const cols = ['120,90,200', '70,110,230', '70,190,140', '240,230,90', '250,160,60', '240,80,70'];
  gr.addColorStop(0, 'rgba(120,90,200,0)');
  cols.forEach((c, i) => gr.addColorStop(0.12 + i * 0.15, `rgba(${c},${a * 0.16})`));
  gr.addColorStop(1, 'rgba(240,80,70,0)');
  g.globalCompositeOperation = 'screen';
  g.strokeStyle = gr; g.lineWidth = bw * 2;
  g.beginPath(); g.arc(cx, cy, r, Math.PI, TAU); g.stroke();
  g.globalCompositeOperation = 'source-over';
}
