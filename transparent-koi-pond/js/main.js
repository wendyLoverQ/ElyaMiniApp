/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   主循环、交互、时钟
   ============================================================ */
function sortSwimmers() {
  swimmers = [...fish, ...turtles].sort((a, b) => b.z - a.z);   // 深的先画
}
// 池里的鱼都有档案（名字、长相、吃过多少），每次打开都是同一群
function applyFishCount() {
  const want = Math.max(1, (S.fishCount || autoFishCount()) - 1);
  const live = new Map(fish.filter(f => f.res).map(f => [f.res, f]));
  const others = pondResidents(want).map(r => live.get(r) || makeResident(r));
  for (const f of others) f.setLength(residentL(f.res));
  const visitors = fish.filter(f => f.visitor);
  for (const f of visitors) f.setLength(f.vlen * SCALE);
  fish = [...(MINE.fish ? [MINE.fish] : []), ...others, ...visitors];
  sortSwimmers();
  noteVarieties();
}
function applyTurtles() {
  while (turtles.length < S.turtles) turtles.push(new Turtle());
  if (turtles.length > S.turtles) turtles.length = S.turtles;
  sortSwimmers();
}

/* 交互 */
const hint = document.getElementById('hint');
let hintGone = false;
function hideHint() { if (!hintGone) { hintGone = true; hint.classList.add('gone'); } }
setTimeout(hideHint, 25000);

addEventListener('pointermove', e => {
  const t = performance.now();
  const x = e.clientX / ZOOM, y = e.clientY / ZOOM;
  const d = Math.hypot(x - pointer.x, y - pointer.y);
  pointer.speed = pointer.inside ? d / Math.max(1, t - pointer.lt) * 1000 : 0;
  pointer.x = x; pointer.y = y; pointer.lt = t;
  pointer.moved = time; pointer.inside = true;
  peekGear(e.clientX, e.clientY);
});
document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; peekGear(-1e4, -1e4); });
addEventListener('blur', () => { pointer.inside = false; });

cvs.addEventListener('pointerdown', e => {
  const x = e.clientX / ZOOM, y = e.clientY / ZOOM;
  if (panelOpen) { closePanel(); return; }
  hideHint();
  try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }

  // 天上飞的先判定
  for (const d of dragonflies) if (d.hit(x, y)) { d.scare(x, y); return; }
  for (const b of butterflies) if (b.state === 'rest' && Math.hypot(b.x - x, b.y - y) < b.s * 1.2) { b.state = 'fly'; b.pickTarget(); return; }
  // 水面上的
  const l = lanternAt(x, y);
  if (l) { pokeLantern(l); return; }
  for (const f of frogs) if (f.hit(x, y)) { f.poke(); return; }
  // 点到自己的锦鲤：冒爱心，不撒食
  if (MINE.fish && !MINE.fish.leap && MINE.fish.hit(x, y)) {
    MINE.showT = 5;
    spawnHearts(x, y - 10);
    addRipple(x, y, 26, 1.2, 0.6);
    MINE.fish.phase += 1.5;
    return;
  }
  // 点到乌龟：缩进壳里
  for (const t of turtles) if (t.hit(x, y)) { t.poke(); return; }
  // 点在荷叶上：荷叶晃一下，停在上面的蝴蝶飞走
  const pad = padAt(x, y);
  if (pad) {
    const dx = pad.x - x, dy = pad.y - y, d = Math.hypot(dx, dy) || 1;
    const f = 70 / Math.sqrt(pad.R / 60);
    pad.vx += dx / d * f; pad.vy += dy / d * f;
    pad.pulse = 1; pad.pt = 0;
    addRipple(x, y, pad.R * 1.2, 2.2, 0.8);
    for (const b of butterflies) if (b.state === 'rest' && b.land && b.land.pad === pad) { b.state = 'fly'; b.pickTarget(); }
    for (const fr of frogs) if (fr.state === 'sit' && fr.pad === pad && Math.random() < 0.5) fr.leaveToWater();
    return;
  }
  for (const p of petals) {
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d < 140 && d > 0) { p.vx += dx / d * 30 * (1 - d / 140); p.vy += dy / d * 30 * (1 - d / 140); p.va += rand(-0.6, 0.6); }
  }
  pushFeathers(x, y, 140, 30);
  stirMoon(x, y);
  pressStart(x, y);
});
cvs.addEventListener('pointermove', e => pressMove(e.clientX / ZOOM, e.clientY / ZOOM));
cvs.addEventListener('pointerup', pressEnd);
cvs.addEventListener('pointercancel', () => { PRESS.mode = 'drag'; pressEnd(); });

/* 主循环 */
function update(dt) {
  time += dt;
  updateEnv(dt);
  for (const f of fish) f.update(dt);
  for (const t of turtles) t.update(dt);
  updateMine(dt);
  updateFood(dt);
  for (const r of ripples) r.age += dt;
  ripples = ripples.filter(r => r.age < r.life);
  updatePads(dt);
  updatePetals(dt);
  updateButterflies(dt);
  updateFireflies(dt);
  updateHearts(dt);
  updateSurprises(dt);
  updateBook(dt);
  updateSky(dt);
  updateLight(dt);
  updateSeason(dt);
  updateSound(dt);
}

function draw() {
  const g = ctx;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, W, H);

  for (const s of swimmers) if (!s.leap) s.drawShadow(g);
  for (const s of swimmers) if (!s.leap) s.draw(g);
  for (const f of frogs) if (f.state === 'swim') f.draw(g);

  drawFood(g);
  drawRipples(g);
  drawBubbles(g);
  drawPads(g);
  for (const f of frogs) if (f.state === 'sit') f.draw(g);
  drawPetals(g);
  drawFloatingFeathers(g);
  drawDrops(g);
  drawFlakes(g);
  drawFalling(g);
  for (const b of butterflies) b.draw(g);
  for (const d of dragonflies) d.draw(g);
  drawFallingFeathers(g);
  // 腾空的：跃起的锦鲤、起跳的青蛙
  for (const s of swimmers) if (s.leap) { s.drawShadow(g); s.draw(g); }
  for (const f of frogs) if (f.state === 'jump') { f.drawShadow(g); f.draw(g); }
  drawDroplets(g);

  drawEgret(g);
  drawTransparentLighting(g);
  drawStars(g);
  drawRainbow(g);
  drawLanterns(g);
  drawFireflies(g);
  drawSparkles(g);


  drawMineMarker(g);
  drawSpot(g);
  drawHearts(g);
  publishKoiSurface();
}

/* 适配屏幕：以 1080p 为基准。壁纸程序里 devicePixelRatio 常常是 1，
   2K、4K 屏上不放大的话，鱼、时钟和按钮都会缩成一小团 */
const BASE_W = 1920, BASE_H = 1080, MAX_ZOOM = 4;
function fitScreen() {
  ZOOM = clamp(Math.min(innerWidth / BASE_W, innerHeight / BASE_H), 1, MAX_ZOOM);
  const root = document.documentElement.style;
  root.fontSize = (16 * ZOOM).toFixed(2) + 'px';
  const bar = taskbarInsets();
  for (const k of ['t', 'r', 'b']) root.setProperty('--bar-' + k, bar[k] + 'px');
}
// Codex / GPT / 模型 ID 无法确认: layout is viewport-local; native bounds belong to Elya.
function taskbarInsets() { return { t: 0, r: 0, b: 0 }; }

let started = false;
function resize() {
  // 窗口还没有尺寸时（后台标签页、壁纸程序刚启动）先等一等，否则所有东西都会挤在左上角
  if (!innerWidth || !innerHeight) { setTimeout(resize, 200); return; }
  fitScreen();
  W = innerWidth / ZOOM; H = innerHeight / ZOOM;
  // 画布按真实像素画，所以把 ZOOM 也算进 DPR：大屏上画面等比放大，而不是鱼变小
  DPR = Math.min(devicePixelRatio || 1, CONFIG.maxDpr) * ZOOM * QUALITY_DPR[qualityLevel()];
  QUAL.since = time;
  SCALE = clamp(Math.min(W, H) / 900, 0.7, 1.4);
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  applySeason();
  renderGlow();
  renderFlake();
  if (!started) { spawnMine(); started = true; }
  applyFishCount();
  applyTurtles();
  // 屏幕变小以后，跑到外面的放回池子里
  for (const c of [...fish, ...turtles]) {
    if (c.x < -60 || c.x > W + 60 || c.y < -60 || c.y > H + 60) {
      c.x = rand(W * 0.1, W * 0.9); c.y = rand(H * 0.1, H * 0.9);
      if (c.px) { c.px.fill(c.x); c.py.fill(c.y); c.followChain(); }
    }
  }
  frogs = [];
  syncControls();
}

let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });

/* 帧率：“自动”时池子里有动静就跑 60，安静下来降到 30，省一半的电 */
let busyT = -99;
function targetFps() {
  const f = pickFps();
  return HOST.fps ? Math.min(f, HOST.fps) : f;
}
function pickFps() {
  if (S.fpsCap) return S.fpsCap;
  if (panelOpen || PRESS.active || food.length || hearts.length || sparkles.length || ENV.flash > 0.02 || EGRET.b ||
      (pointer.inside && time - pointer.moved < 0.5) || fish.some(f => f.leap) || frogs.some(f => f.state === 'jump')) busyT = time;
  return time - busyT < 3 ? 60 : 30;
}

/* 画质：“自动”时如果电脑跟不上 60 帧，就把内部分辨率降一档（只降不升，免得来回跳） */
const QUALITY_DPR = [1, 0.8, 0.64];
const QUAL = { level: 0, gaps: [], js: 0, n: 0, best: 99, strikes: 0, since: 0 };
function qualityLevel() { return S.quality === 'low' ? 2 : S.quality === 'high' ? 0 : QUAL.level; }
function lowQuality() { return qualityLevel() >= 2; }
function watchQuality(gap, jsMs, fps) {
  if (S.quality !== 'auto' || QUAL.level >= 2 || fps < 60 || time - QUAL.since < 6) { QUAL.gaps.length = 0; QUAL.js = QUAL.n = 0; return; }
  QUAL.gaps.push(gap); QUAL.js += jsMs; QUAL.n++;
  if (QUAL.gaps.length < 200) return;
  const g = QUAL.gaps.sort((a, b) => a - b), med = g[g.length >> 1], js = QUAL.js / QUAL.n;
  QUAL.gaps.length = 0; QUAL.js = QUAL.n = 0;
  QUAL.best = Math.min(QUAL.best, med);
  // 明明跑得到 60 却掉到 40 以下，或者慢到 22 帧以下，或者脚本本身就很吃力
  const slow = (QUAL.best < 20 && med > 25) || med > 45 || js > 10;
  QUAL.strikes = slow ? QUAL.strikes + 1 : 0;
  if (QUAL.strikes >= 2) { QUAL.level++; QUAL.strikes = 0; QUAL.best = 99; resize(); }
}

let last = performance.now(), next = 0, running = true;
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  if (!started) { last = next = now; return; }
  const fps = targetFps(), iv = 1000 / fps;
  if (now < next - 1.5) return;
  next = Math.max(next + iv, now - iv * 0.5);
  const gap = now - last;
  const dt = Math.min(0.05, gap / 1000);
  last = now;
  const t0 = performance.now();
  update(dt);
  draw();
  watchQuality(gap, performance.now() - t0, fps);
}
function setRunning(on) {
  if (!on) { if (running) { running = false; saveAll(); } }
  else if (!running) { running = true; last = next = performance.now(); requestAnimationFrame(frame); }
}
document.addEventListener('visibilitychange', () => setRunning(!document.hidden && !HOST.paused));
function onHostPause() { setRunning(!document.hidden && !HOST.paused); syncSoundPause(); }
addEventListener('pagehide', () => { saveAll(); saveJSON(SETTINGS_KEY, S); window.KoiHost.flush(); });

/* 节气与时钟 */
const TERMS = [[1,6,'小寒'],[1,20,'大寒'],[2,4,'立春'],[2,19,'雨水'],[3,5,'惊蛰'],[3,20,'春分'],[4,5,'清明'],[4,20,'谷雨'],[5,5,'立夏'],[5,21,'小满'],[6,6,'芒种'],[6,21,'夏至'],[7,7,'小暑'],[7,22,'大暑'],[8,7,'立秋'],[8,23,'处暑'],[9,7,'白露'],[9,23,'秋分'],[10,8,'寒露'],[10,23,'霜降'],[11,7,'立冬'],[11,22,'小雪'],[12,7,'大雪'],[12,22,'冬至']];
function tick() {
  const d = new Date();
  document.getElementById('clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  document.getElementById('date').textContent = fmtWeekDate(d);
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  let term = '冬至';
  for (const [m, day, name] of TERMS) if (m * 100 + day <= md) term = name;
  FEST = festivalOn(d);
  checkSeason();
  document.getElementById('term').textContent = FEST ? `${termName(term)} · ${t(FEST.label)}` : termName(term);
}

// 底部那行提示：节日有祝福，设置按钮藏起来时就不提它
function setHint() {
  if (FEST) hint.textContent = t(FEST.greet);
  else hint.textContent = t('点击锦鲤或喂食按钮撒食 · 拖动荷花图标移动');
}

/* 换语言：写死的文字整页换掉，代码生成的文字重画一遍 */
function applyLang() {
  const next = resolveLang();
  const changed = next !== LANG;
  LANG = next;
  translatePage();
  translateSwatches();
  setHint();
  fillCities();
  syncControls();
  renderWeatherUI();
  tick();
  refreshMinePane(true);
  renderBook(true);
  return changed;
}
// 壁纸程序告诉了界面语言；设置里选的是“自动”才跟着变
function onHostLang() { if (started && S.lang === 'auto' && resolveLang() !== LANG) applyLang(); }

function start() {
  applyLang();
  resize();
  tick();
  setInterval(tick, 10000);
  renderWeatherUI();
  if (S.weatherMode === 'auto') fetchWeather();
  applySound();
  requestAnimationFrame(frame);
}
start();
connectElya();
