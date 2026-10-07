/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   环境音：水声、雨声、雷声、蛙鸣、虫鸣、水花，全部用 Web Audio 实时合成
   默认关闭；打开后跟着画面里发生的事发声
   ============================================================ */
const SND = { ctx: null, master: null, water: null, rain: null, voices: 0, flash: 0, idle: 0, last: {}, dripT: 2, cricketT: 3, chorusT: 4 };

// 可无缝循环的噪声：结尾一段和开头交叉淡化，从 loopStart 接回去
function noiseBuffer(ctx, sec, brown) {
  const n = Math.floor(ctx.sampleRate * sec), m = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5;
    }
    for (let i = 0; i < m; i++) { const k = i / m; d[n - m + i] = d[n - m + i] * (1 - k) + d[i] * k; }
  }
  buf.loopFrom = m / ctx.sampleRate;
  return buf;
}
function loopBed(buf, type, freq, q) {
  const ctx = SND.ctx, src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopStart = buf.loopFrom; src.loopEnd = buf.duration;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(SND.master);
  src.start(0, Math.random() * buf.duration * 0.5);
  return { f, g };
}

function initSound() {
  if (SND.ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { window.KoiHost.fail(Error('KOI_AUDIO_UNAVAILABLE')); return false; }
  try { SND.ctx = new AC(); } catch (e) { window.KoiHost.fail(e); return false; }
  const ctx = SND.ctx;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  SND.master = ctx.createGain(); SND.master.gain.value = 0;
  SND.master.connect(comp);
  SND.brown = noiseBuffer(ctx, 6, true);
  SND.white = noiseBuffer(ctx, 3, false);
  SND.water = loopBed(SND.brown, 'lowpass', 420, 0.7);   // 池水：低低的一层
  SND.rain = loopBed(SND.white, 'bandpass', 2400, 0.45); // 雨：沙沙的
  return true;
}
function resumeSound() {
  if (SND.ctx && S.sound && !HOST.paused && !document.hidden && SND.ctx.state !== 'running') SND.ctx.resume().catch(window.KoiHost.fail);
}
// 浏览器要求先有一次点击才能出声；壁纸程序里一般没有这个限制
addEventListener('pointerdown', resumeSound, true);
addEventListener('keydown', resumeSound, true);
// 页面藏起来、或者壁纸程序让暂停（比如在打全屏游戏）时，声音也停
function syncSoundPause() {
  if (!SND.ctx) return;
  if (document.hidden || HOST.paused) SND.ctx.suspend().catch(window.KoiHost.fail);
  else resumeSound();
}
document.addEventListener('visibilitychange', syncSoundPause);

function applySound() {
  if (S.sound && initSound()) resumeSound();
}

// 能不能再发一个声音：开着、在运行、同时发声的不太多、同类声音别挨得太近
function sndOk(kind, gap) {
  if (!SND.ctx || !S.sound || SND.ctx.state !== 'running' || SND.voices > 24) return false;
  if (gap) {
    const now = SND.ctx.currentTime;
    if (now - (SND.last[kind] || 0) < gap) return false;
    SND.last[kind] = now;
  }
  return true;
}
// 一个声音的出口：带左右声道位置，播完自动计数
function voice(x, dur) {
  const ctx = SND.ctx, g = ctx.createGain();
  g.gain.value = 0;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp((x / (W || 1)) * 2 - 1, -1, 1) * 0.65;
    g.connect(p).connect(SND.master);
  } else g.connect(SND.master);
  SND.voices++;
  setTimeout(() => { SND.voices--; }, (dur + 0.2) * 1000);
  return g;
}
function noiseSrc(buf, t, dur) {
  const s = SND.ctx.createBufferSource();
  s.buffer = buf;
  s.start(t, Math.random() * Math.max(0, buf.duration - dur - 0.1));
  s.stop(t + dur);
  return s;
}

/* 水滴：一声短促上扬的“叮咚” */
function sndPlip(x, vol, f0, delay) {
  if (!sndOk()) return;
  const ctx = SND.ctx, t = ctx.currentTime + (delay || 0), f = f0 || rand(700, 1400), dur = 0.16;
  const g = voice(x, dur + (delay || 0));
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * rand(1.8, 2.4), t + 0.06);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o.start(t); o.stop(t + dur + 0.02);
}
function sndFood(x) {
  if (!sndOk('food', 0.05)) return;
  const n = 4 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) sndPlip(x + rand(-20, 20), rand(0.05, 0.1), rand(1500, 2600), rand(0, 0.18));
}
function sndEat(x) { if (sndOk('eat', 0.07)) sndPlip(x, 0.07, rand(420, 640)); }
function sndBloop(x) { if (sndOk('bloop', 0.09)) sndPlip(x, 0.05, rand(300, 480)); }
function sndKiss(x) { if (sndOk('kiss', 0.4)) sndPlip(x, 0.035, rand(380, 560)); }

/* 水花：一团噪声加一声闷响，再落几滴回来 */
function sndSplash(x, power) {
  if (!sndOk('splash', 0.1)) return;
  const ctx = SND.ctx, t = ctx.currentTime, dur = 0.7;
  const g = voice(x, dur);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.6;
  noiseSrc(SND.white, t, dur).connect(f).connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * power, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur * power + 0.2);
  const o = ctx.createOscillator(), og = voice(x, 0.3);
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.35 * power, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(og); o.start(t); o.stop(t + 0.3);
  const n = Math.round(3 + power * 4);
  for (let i = 0; i < n; i++) sndPlip(x + rand(-40, 40), rand(0.04, 0.08), rand(900, 2000), rand(0.3, 0.9));
}

/* 蛙鸣：锯齿波过带通，按每秒三十来下的脉冲一开一合；两声，对上鼓腮 */
function sndCroak(x, far) {
  if (!sndOk()) return;
  const ctx = SND.ctx, t = ctx.currentTime, dur = 1.1;
  const g = voice(x, dur);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = rand(95, 130) * (far ? 1.15 : 1);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(520, 720); bp.Q.value = 3.5;
  let out = bp;
  if (far) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; bp.connect(lp); out = lp; }
  o.connect(bp); out.connect(g);
  const peak = far ? rand(0.12, 0.24) : 0.9, p = 1 / rand(26, 34);
  g.gain.setValueAtTime(0, t);
  for (const start of [0.18, 0.78]) {
    const pulses = 6 + ((Math.random() * 3) | 0);
    for (let i = 0; i < pulses; i++) {
      const s = t + start + i * p, k = Math.sin((i + 0.5) / pulses * Math.PI);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(peak * k, s + p * 0.3);
      g.gain.linearRampToValueAtTime(0, s + p * 0.9);
    }
  }
  o.start(t); o.stop(t + dur);
}

/* 虫鸣：夜里高高的几声“唧唧” */
function sndCricket() {
  if (!sndOk()) return;
  const ctx = SND.ctx, t = ctx.currentTime, x = rand(0, W), dur = 0.4;
  const g = voice(x, dur);
  const o = ctx.createOscillator();
  o.frequency.value = rand(4200, 4900);
  o.connect(g);
  const n = 3 + ((Math.random() * 2) | 0), vol = rand(0.012, 0.03);
  g.gain.setValueAtTime(0, t);
  for (let i = 0; i < n; i++) {
    const s = t + i * 0.055;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(vol, s + 0.008);
    g.gain.linearRampToValueAtTime(0, s + 0.03);
  }
  o.start(t); o.stop(t + dur);
}

/* 雷：闪电之后隔一会儿，低低地滚过去 */
function sndThunder() {
  if (!sndOk('thunder', 1)) return;
  const ctx = SND.ctx, t = ctx.currentTime + rand(0.4, 1.8), dur = rand(3.5, 5.5);
  const g = voice(W / 2 + rand(-W, W) * 0.3, dur + 2);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = rand(140, 220);
  const s = noiseSrc(SND.brown, t, dur);
  s.playbackRate.value = rand(0.6, 0.9);
  s.connect(lp).connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.2, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.5, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/* 翅膀扇动：一阵轻轻的风声 */
function sndWhoosh(x) {
  if (!sndOk('whoosh', 0.2)) return;
  const ctx = SND.ctx, t = ctx.currentTime, dur = 0.4;
  const g = voice(x, dur);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(320, t); bp.frequency.exponentialRampToValueAtTime(760, t + 0.3);
  noiseSrc(SND.white, t, dur).connect(bp).connect(g);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/* 金龙鲤跃龙门：一串往上走的清亮音 */
function sndChime(x) {
  if (!sndOk()) return;
  const ctx = SND.ctx, t0 = ctx.currentTime;
  [0, 3, 5, 7, 10, 12].forEach((st, i) => {
    const t = t0 + i * 0.09, f = 880 * Math.pow(2, st / 12), g = voice(x, 1.4 + i * 0.09);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g); o.start(t); o.stop(t + 1.35);
  });
}

function updateSound(dt) {
  if (!SND.ctx) return;
  const ctx = SND.ctx, now = ctx.currentTime;
  SND.master.gain.setTargetAtTime(S.sound ? S.volume : 0, now, 0.4);
  // 关掉以后等声音淡完，把音频挂起，不占 CPU
  if (!S.sound) {
    SND.idle += dt;
    if (SND.idle > 2 && ctx.state === 'running') ctx.suspend().catch(window.KoiHost.fail);
    return;
  }
  SND.idle = 0;
  if (ctx.state !== 'running') {
    // 被系统挂起了（比如壁纸程序刚启动），隔一会儿试着恢复
    SND.retry = (SND.retry || 0) - dt;
    if (SND.retry < 0) { SND.retry = 2; resumeSound(); }
    return;
  }

  // 池水：缓缓起伏
  const swell = 0.75 + 0.15 * Math.sin(time * 0.21) + 0.1 * Math.sin(time * 0.53 + 1);
  SND.water.g.gain.setTargetAtTime(0.38 * swell * (1 - ENV.rain * 0.4), now, 0.5);
  SND.water.f.frequency.setTargetAtTime(360 + 120 * swell, now, 0.5);
  // 雨：跟着雨量，雷雨更密
  const rain = clamp(ENV.rain + ENV.storm * 0.3, 0, 1.3);
  SND.rain.g.gain.setTargetAtTime(rain * 0.6, now, 0.8);
  SND.rain.f.frequency.setTargetAtTime(2000 + rain * 1200, now, 0.8);
  if (rain > 0.1 && Math.random() < dt * rain * 7) sndPlip(rand(0, W), rand(0.015, 0.04) * rain, rand(1800, 3200));
  // 晴天偶尔一两声水滴
  SND.dripT -= dt;
  if (SND.dripT < 0) { SND.dripT = rand(3, 9); if (rain < 0.2) sndPlip(rand(0, W), 0.03, rand(600, 1100)); }
  // 雷
  if (ENV.flash > 0.9 && SND.flash < 0.5) sndThunder();
  SND.flash = ENV.flash;
  // 夜里的虫鸣（冬天没有，下雨时不叫）
  if (ENV.dark > 0.5 && ENV.rain < 0.3 && season() !== 'winter') {
    SND.cricketT -= dt;
    if (SND.cricketT < 0) { SND.cricketT = rand(0.5, 2.8); sndCricket(); }
  }
  // 远处的蛙声：暖和的季节，天黑或下雨时
  if (season() !== 'winter' && (ENV.dark > 0.4 || ENV.rain > 0.3)) {
    SND.chorusT -= dt;
    if (SND.chorusT < 0) { SND.chorusT = rand(2.5, 8); sndCroak(rand(0, W), true); }
  }
}
