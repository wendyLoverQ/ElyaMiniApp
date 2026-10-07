/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   天气与昼夜
   ENV 里的数值都在 0..1 之间平滑过渡，切换天气时画面是慢慢变的
   ============================================================ */
const WEATHER_PRESETS = {
  clear:  { label: '晴',   cloud: 0,    rain: 0,    snow: 0,   fog: 0,   storm: 0, wind: 0.2 },
  cloudy: { label: '多云', cloud: 0.8,  rain: 0,    snow: 0,   fog: 0,   storm: 0, wind: 0.35 },
  rain:   { label: '雨',   cloud: 0.85, rain: 0.6,  snow: 0,   fog: 0,   storm: 0, wind: 0.4 },
  storm:  { label: '雷雨', cloud: 1,    rain: 1,    snow: 0,   fog: 0,   storm: 1, wind: 0.85 },
  snow:   { label: '雪',   cloud: 0.6,  rain: 0,    snow: 0.8, fog: 0,   storm: 0, wind: 0.25 },
  fog:    { label: '雾',   cloud: 0.3,  rain: 0,    snow: 0,   fog: 0.9, storm: 0, wind: 0.1 },
};
const ENV = { dark: 0, dusk: 0, cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0.2, flash: 0, flashNext: 0, sunrise: 6.1, sunset: 18.3 };
const LIVE = { data: null, status: 'idle', city: null, updated: 0 };
const ENV_KEYS = ['cloud', 'rain', 'snow', 'fog', 'storm', 'wind'];

// Open-Meteo 的 WMO 天气代码 → 画面参数
function fromWmo(code, wind) {
  const w = Math.min(1, (wind || 8) / 40);
  const P = (base, label, extra) => Object.assign({}, WEATHER_PRESETS[base], { label, wind: Math.max(WEATHER_PRESETS[base].wind, w) }, extra || {});
  if (code === 0) return P('clear', '晴');
  if (code === 1) return P('clear', '晴间多云', { cloud: 0.3 });
  if (code === 2) return P('cloudy', '多云', { cloud: 0.55 });
  if (code === 3) return P('cloudy', '阴', { cloud: 0.95 });
  if (code === 45 || code === 48) return P('fog', '雾');
  if (code >= 51 && code <= 57) return P('rain', '毛毛雨', { rain: 0.25 });
  if (code === 61 || code === 80) return P('rain', '小雨', { rain: 0.4 });
  if (code === 63 || code === 81) return P('rain', '中雨', { rain: 0.7 });
  if (code === 65 || code === 82) return P('rain', '大雨', { rain: 1 });
  if (code === 66 || code === 67) return P('rain', '冻雨', { rain: 0.6, snow: 0.2 });
  if (code === 71 || code === 85) return P('snow', '小雪', { snow: 0.45 });
  if (code === 73 || code === 77) return P('snow', '中雪', { snow: 0.75 });
  if (code === 75 || code === 86) return P('snow', '大雪', { snow: 1 });
  if (code >= 95) return P('storm', code === 95 ? '雷阵雨' : '雷雨冰雹');
  return P('cloudy', '阴');
}

function weatherTarget() {
  if (S.weatherMode === 'auto') return LIVE.data ? LIVE.data.target : WEATHER_PRESETS.clear;
  return WEATHER_PRESETS[S.weatherMode] || WEATHER_PRESETS.clear;
}

function timeTarget() {
  if (S.timeMode === 'day') return { dark: 0, dusk: 0 };
  if (S.timeMode === 'dusk') return { dark: 0.3, dusk: 1 };
  if (S.timeMode === 'night') return { dark: 1, dusk: 0 };
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const sr = ENV.sunrise, ss = ENV.sunset;
  let dark;
  if (h < sr - 0.5 || h > ss + 0.7) dark = 1;
  else if (h < sr + 0.5) dark = 1 - (h - (sr - 0.5));
  else if (h < ss - 0.5) dark = 0;
  else dark = (h - (ss - 0.5)) / 1.2;
  const dusk = Math.max(0, 1 - Math.min(Math.abs(h - sr), Math.abs(h - ss)) / 1.1);
  return { dark: clamp(dark, 0, 1), dusk };
}

async function fetchWeather() {
  const c = cityInfo();
  LIVE.status = 'loading'; LIVE.city = c;
  renderWeatherUI();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
    '&current=temperature_2m,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=3';
  try {
    const r = await window.KoiHost.fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const cur = j.current;
    const now = fromWmo(cur.weather_code, cur.wind_speed_10m);
    const hour = s => { const m = /T(\d+):(\d+)/.exec(s || ''); return m ? +m[1] + m[2] / 60 : null; };
    const sr = hour(j.daily.sunrise[0]), ss = hour(j.daily.sunset[0]);
    if (sr != null) ENV.sunrise = sr;
    if (ss != null) ENV.sunset = ss;
    LIVE.data = {
      target: now, label: now.label, temp: Math.round(cur.temperature_2m),
      days: j.daily.weather_code.map((code, i) => ({ label: fromWmo(code).label, max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]) })),
    };
    LIVE.status = 'ok'; LIVE.updated = Date.now();
  } catch (e) {
    LIVE.data = null; LIVE.status = 'error';
    window.KoiHost.fail(e);
  }
  renderWeatherUI();
}
setInterval(() => { if (S.weatherMode === 'auto') fetchWeather(); }, 30 * 60 * 1000);

function updateEnv(dt) {
  const w = weatherTarget(), tt = timeTarget(), k = Math.min(1, dt * 0.6);
  for (const key of ENV_KEYS) ENV[key] += ((key === 'fog' ? Math.max(w.fog || 0, LIGHT.mist) : w[key] || 0) - ENV[key]) * k;
  ENV.dark += (tt.dark - ENV.dark) * k;
  ENV.dusk += (tt.dusk - ENV.dusk) * k;

  // 闪电：一次闪两下
  ENV.flash *= Math.exp(-dt * 8);
  if (ENV.flashNext > 0) { ENV.flashNext -= dt; if (ENV.flashNext <= 0) ENV.flash = 0.8; }
  if (ENV.storm > 0.5 && Math.random() < dt * 0.06 * ENV.storm) { ENV.flash = 1; ENV.flashNext = rand(0.12, 0.3); }

  // Codex / GPT / 模型 ID 无法确认: rain streaks land on the open water and form ripples.
  const rate = ENV.rain * 260 * (W * H / 2e6);
  let n = rate * dt;
  while (n > 0) {
    if (Math.random() < n) {
      const x = rand(0, W), y = rand(0, H);
      drops.push({ x, y, age: -0.12, life: rand(0.6, 1.0), r: rand(6, 15) * Math.sqrt(SCALE), pad: false });
    }
    n -= 1;
  }
  for (const d of drops) d.age += dt;
  drops = drops.filter(d => d.age < d.life);
  if (drops.length > 600) drops.splice(0, drops.length - 600);

  // 雪花：从高处飘下，落到水面慢慢化掉
  const wantFlakes = Math.round(ENV.snow * 240 * (W * H / 2e6));
  let live = 0;
  for (const f of flakes) if (f.melt < 0) live++;
  for (let i = live; i < wantFlakes && i < live + 6; i++) flakes.push({ x: rand(-40, W), y: rand(-40, H), h: rand(0.6, 1), vh: rand(0.07, 0.14), r: rand(1.4, 3.2) * Math.sqrt(SCALE), seed: rand(0, TAU), melt: -1 });
  for (const f of flakes) {
    if (f.melt >= 0) { f.melt += dt; continue; }
    f.h -= f.vh * dt;
    f.x += (ENV.wind * 28 + Math.sin(time * 1.3 + f.seed) * 9) * dt;
    f.y += (8 + Math.cos(time * 1.1 + f.seed) * 5) * dt;
    if (f.h <= 0) f.melt = 0;
  }
  flakes = flakes.filter(f => f.melt < 1.6 && f.x < W + 40 && f.y < H + 40);
}

function drawDrops(g) {
  if (!drops.length) return;
  const wx = ENV.wind * 0.6;
  g.lineCap = 'round';
  for (const d of drops) {
    if (d.age < 0) {
      const p = 1 + d.age / 0.12, L = 26 * (1 - p) + 4;
      g.strokeStyle = 'rgba(234,246,242,0.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(d.x - wx * L, d.y - L); g.lineTo(d.x - wx * L * 0.4, d.y - L * 0.4); g.stroke();
      continue;
    }
    const k = d.age / d.life;
    if (d.age < 0.08) {
      g.fillStyle = 'rgba(240,250,246,0.6)';
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + d.x; g.beginPath(); g.arc(d.x + Math.cos(a) * d.age * 50, d.y + Math.sin(a) * d.age * 50, 0.9, 0, TAU); g.fill(); }
    }
    if (d.pad) continue;
    const rr = d.r * (1 - Math.pow(1 - k, 2.5));
    g.strokeStyle = `rgba(16,44,36,${(1 - k) * 0.2})`; g.lineWidth = 2;
    g.beginPath(); g.arc(d.x, d.y, rr + 1.2, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(236,250,244,${(1 - k) * 0.75})`; g.lineWidth = 1.2;
    g.beginPath(); g.arc(d.x, d.y, rr, 0, TAU); g.stroke();
  }
}

let flakeSprite = null;
function renderFlake() {
  const r = 8, c = mkCanvas(r * 2 * DPR, r * 2 * DPR), g = c.getContext('2d');
  g.scale(DPR, DPR);
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(250,252,255,0.85)'); gr.addColorStop(1, 'rgba(250,252,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  flakeSprite = c;
}
function drawFlakes(g) {
  for (const f of flakes) {
    const h = Math.max(0, f.h), a = f.melt >= 0 ? 1 - f.melt / 1.6 : 1;
    const r = f.r * (1 + h * 1.6) * (f.melt >= 0 ? 1 + f.melt * 0.3 : 1);
    g.globalAlpha = a * 0.12 * (1 - h * 0.5);
    g.fillStyle = '#12302a';
    g.beginPath(); g.arc(f.x + h * 22, f.y + h * 32, r * 0.7, 0, TAU); g.fill();
    g.globalAlpha = a * (f.melt >= 0 ? 0.6 : 0.95);
    g.drawImage(flakeSprite, f.x - r * 2, f.y - r * 2, r * 4, r * 4);
  }
  g.globalAlpha = 1;
}

// 整体光照：乘一层颜色。黄昏偏暖，阴雨偏灰，夜里偏蓝
function lightColor() {
  let c = [255, 255, 255];
  c = mix3(c, [246, 204, 166], ENV.dusk * 0.7);
  c = mix3(c, [200, 208, 212], ENV.cloud * 0.3);
  c = mix3(c, [168, 180, 188], ENV.rain * 0.35);
  c = mix3(c, [214, 226, 238], ENV.snow * 0.3);
  c = mix3(c, [48, 64, 106], ENV.dark * 0.86);
  return c;
}

// 光斑强度：阴天、下雨、夜里都会变弱
function causticStrength() {
  return S.caustics * (1 - ENV.cloud * 0.75) * (1 - ENV.dark * 0.9) * (1 - ENV.rain * 0.3) * (1 - ENV.fog * 0.6);
}

/* 右上角卡片里的天气 */
function renderWeatherUI() {
  const line = document.getElementById('wx');
  const fc = document.getElementById('fc');
  const status = document.getElementById('wx-status');
  const city = cityName(cityInfo());
  const dayNames = [t('今天'), t('明天'), t('后天')];
  let text, statusText;
  if (S.weatherMode !== 'auto') {
    text = t('手动 · {w}', { w: t(WEATHER_PRESETS[S.weatherMode].label) });
    statusText = t('现在是手动天气。选“实时”会按所选城市的真实天气变化。');
  } else if (LIVE.status === 'ok' && LIVE.data) {
    text = t('{city} · {w} · {temp}°C', { city, w: t(LIVE.data.label), temp: LIVE.data.temp });
    const d = new Date(LIVE.updated);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    statusText = t('{time} 更新 · 每半小时刷新 · 数据来自 Open-Meteo', { time });
  } else if (LIVE.status === 'loading') {
    text = t('{city} · 正在获取天气', { city });
    statusText = t('正在连接 Open-Meteo……');
  } else {
    text = t('{city} · 天气未连接', { city });
    statusText = t('实时天气未连接。请在 Elya 资源详情允许联网，或手动选择天气。');
  }
  if (line) line.textContent = text;
  if (status) status.textContent = statusText;
  const days = S.weatherMode === 'auto' && LIVE.data ? LIVE.data.days : null;
  for (const el of [fc, document.getElementById('wx-forecast')]) {
    if (!el) continue;
    el.hidden = !days;
    if (days) el.innerHTML = days.map((d, i) => `<div><span>${dayNames[i]}</span><b>${t(d.label)}</b><span>${d.min}° / ${d.max}°</span></div>`).join('');
  }
}

/* 按名字找城市：Open-Meteo 的地名查询，不用密钥。中英文名各查一次，切语言时两种都有 */
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search?count=1&format=json';
async function geocodeCity(query) {
  const q = String(query || '').trim().slice(0, 60);
  if (!q) return null;
  const look = lang => window.KoiHost.fetch(`${GEO_URL}&language=${lang}&name=${encodeURIComponent(q)}`)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(j => (j && Array.isArray(j.results) && j.results[0]) || null);
  const [zh, en] = await Promise.all([look('zh'), look('en')]);
  const hit = zh || en;
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
  return { name: String((zh || hit).name).slice(0, 40), en: String((en || hit).name).slice(0, 40), lat: hit.latitude, lon: hit.longitude };
}
// 搜到了就换成这个城市，天气也切到“实时”；返回搜到的城市，没搜到是 null，网络不通会抛错
async function useCityByName(query) {
  const c = await geocodeCity(query);
  if (!c) return null;
  S.customCity = c;
  S.weatherMode = 'auto';
  setSetting('city', 'custom');
  return c;
}
