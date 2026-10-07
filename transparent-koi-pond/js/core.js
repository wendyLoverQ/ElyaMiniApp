/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   基础工具、设置、共享状态
   ============================================================ */
const CONFIG = {
  maxDpr: 1.5,     // 高分屏上限，越高越清晰也越费
  bgImage: '',     // 池底图，比如 'assets/pond.png'；留空则用程序画的池底
};

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// 可平铺的分形值噪声，返回 0..1
function tileNoise(size, octaves, baseCells, seed) {
  const R = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o;
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = R();
    for (let y = 0; y < size; y++) {
      const fy = y / size * cells, j0 = fy | 0, ty = fy - j0, sy = ty * ty * (3 - 2 * ty), j1 = (j0 + 1) % cells;
      for (let x = 0; x < size; x++) {
        const fx = x / size * cells, i0 = fx | 0, tx = fx - i0, sx = tx * tx * (3 - 2 * tx), i1 = (i0 + 1) % cells;
        const a = grid[j0 * cells + i0], b = grid[j0 * cells + i1], c = grid[j1 * cells + i0], d = grid[j1 * cells + i1];
        out[y * size + x] += (lerp(lerp(a, b, sx), lerp(c, d, sx), sy)) * amp;
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function loadJSON(k) { return window.KoiHost.load(k); }
function saveJSON(k, v) { window.KoiHost.save(k, v); }

// 天气用的城市。en 是英文名，tz 用来给新用户猜一个离得最近的城市
const CITIES = {
  beijing: { name: '北京', en: 'Beijing', lat: 39.90, lon: 116.40, tz: 'Asia/Shanghai' },
  shanghai: { name: '上海', en: 'Shanghai', lat: 31.23, lon: 121.47, tz: 'Asia/Shanghai' },
  guangzhou: { name: '广州', en: 'Guangzhou', lat: 23.13, lon: 113.26, tz: 'Asia/Shanghai' },
  shenzhen: { name: '深圳', en: 'Shenzhen', lat: 22.54, lon: 114.06, tz: 'Asia/Shanghai' },
  hangzhou: { name: '杭州', en: 'Hangzhou', lat: 30.27, lon: 120.15, tz: 'Asia/Shanghai' },
  suzhou: { name: '苏州', en: 'Suzhou', lat: 31.30, lon: 120.58, tz: 'Asia/Shanghai' },
  nanjing: { name: '南京', en: 'Nanjing', lat: 32.06, lon: 118.80, tz: 'Asia/Shanghai' },
  wuhan: { name: '武汉', en: 'Wuhan', lat: 30.59, lon: 114.30, tz: 'Asia/Shanghai' },
  changsha: { name: '长沙', en: 'Changsha', lat: 28.23, lon: 112.94, tz: 'Asia/Shanghai' },
  chengdu: { name: '成都', en: 'Chengdu', lat: 30.57, lon: 104.07, tz: 'Asia/Shanghai' },
  chongqing: { name: '重庆', en: 'Chongqing', lat: 29.56, lon: 106.55, tz: 'Asia/Shanghai' },
  xian: { name: '西安', en: "Xi'an", lat: 34.34, lon: 108.94, tz: 'Asia/Shanghai' },
  kunming: { name: '昆明', en: 'Kunming', lat: 25.04, lon: 102.71, tz: 'Asia/Shanghai' },
  xiamen: { name: '厦门', en: 'Xiamen', lat: 24.48, lon: 118.09, tz: 'Asia/Shanghai' },
  harbin: { name: '哈尔滨', en: 'Harbin', lat: 45.80, lon: 126.53, tz: 'Asia/Shanghai' },
  hongkong: { name: '香港', en: 'Hong Kong', lat: 22.32, lon: 114.17, tz: 'Asia/Hong_Kong' },
  taipei: { name: '台北', en: 'Taipei', lat: 25.03, lon: 121.56, tz: 'Asia/Taipei' },
  tokyo: { name: '东京', en: 'Tokyo', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' },
  seoul: { name: '首尔', en: 'Seoul', lat: 37.57, lon: 126.98, tz: 'Asia/Seoul' },
  singapore: { name: '新加坡', en: 'Singapore', lat: 1.35, lon: 103.82, tz: 'Asia/Singapore' },
  bangkok: { name: '曼谷', en: 'Bangkok', lat: 13.76, lon: 100.50, tz: 'Asia/Bangkok' },
  mumbai: { name: '孟买', en: 'Mumbai', lat: 19.08, lon: 72.88, tz: 'Asia/Kolkata' },
  dubai: { name: '迪拜', en: 'Dubai', lat: 25.20, lon: 55.27, tz: 'Asia/Dubai' },
  moscow: { name: '莫斯科', en: 'Moscow', lat: 55.76, lon: 37.62, tz: 'Europe/Moscow' },
  berlin: { name: '柏林', en: 'Berlin', lat: 52.52, lon: 13.40, tz: 'Europe/Berlin' },
  paris: { name: '巴黎', en: 'Paris', lat: 48.86, lon: 2.35, tz: 'Europe/Paris' },
  london: { name: '伦敦', en: 'London', lat: 51.51, lon: -0.13, tz: 'Europe/London' },
  newyork: { name: '纽约', en: 'New York', lat: 40.71, lon: -74.01, tz: 'America/New_York' },
  toronto: { name: '多伦多', en: 'Toronto', lat: 43.65, lon: -79.38, tz: 'America/Toronto' },
  chicago: { name: '芝加哥', en: 'Chicago', lat: 41.88, lon: -87.63, tz: 'America/Chicago' },
  losangeles: { name: '洛杉矶', en: 'Los Angeles', lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles' },
  vancouver: { name: '温哥华', en: 'Vancouver', lat: 49.28, lon: -123.12, tz: 'America/Vancouver' },
  saopaulo: { name: '圣保罗', en: 'São Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' },
  sydney: { name: '悉尼', en: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
};
const DEFAULT_CITY = 'wuhan';
// 新用户没选过城市时，按电脑的时区挑一个：时区一样最好，其次是现在的时差一样
function guessCity() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || CITIES[DEFAULT_CITY].tz === tz) return DEFAULT_CITY;
    const hit = Object.keys(CITIES).find(k => CITIES[k].tz === tz);
    if (hit) return hit;
    const now = new Date(), local = -now.getTimezoneOffset();
    const off = zone => { const p = new Date(now.toLocaleString('en-US', { timeZone: zone })); return Math.round((p - new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000); };
    return Object.keys(CITIES).find(k => off(CITIES[k].tz) === local) || DEFAULT_CITY;
  } catch (e) { return DEFAULT_CITY; }
}

const SETTINGS_KEY = 'koipond.settings.v1';
const DEFAULTS = {
  style: 'watercolor',   // 'clear' 清透 | 'watercolor' 水彩
  paper: 0.55,           // 纸纹强度 0..1
  caustics: 1,           // 光斑强度 0..1.5
  fishCount: 0,          // 0 = 按屏幕大小自动
  swimSpeed: 1,
  turtles: 3,
  butterflies: true,     // 蝴蝶和蜻蜓
  frogs: true,
  petals: true,
  showClock: false,
  gearMode: 'always',    // 设置按钮：always 一直显示 | hover 鼠标靠近时 | hidden 隐藏（只在壁纸程序的侧边栏里能选）
  fpsCap: 0,             // 0 = 自动：有动静时 60，安静时 30
  quality: 'auto',       // auto | high | low
  weatherMode: 'clear',   // auto | clear | cloudy | rain | storm | snow | fog
  city: guessCity(),    // 预设城市的键，或者 'custom'（用 customCity 里搜到的）
  customCity: null,      // { name, lat, lon }：在侧边栏或面板里按名字搜到的城市
  lang: 'auto',          // auto | zh | en；auto 跟着壁纸程序或系统的语言
  timeMode: 'auto',      // auto | day | dusk | night
  seasonMode: 'auto',    // auto | spring | summer | autumn | winter（南半球可以手动选）
  marker: 'hover',       // hover | always
  sound: false,          // 环境音，默认关
  volume: 0.6,
};
const S = Object.assign({}, DEFAULTS, loadJSON(SETTINGS_KEY));
// 现在用哪个城市看天气：预设的，或者按名字搜到的
function cityInfo() { return (S.city === 'custom' && S.customCity) || CITIES[S.city] || CITIES[DEFAULT_CITY]; }
let saveTimer = 0;
function saveSettings() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveJSON(SETTINGS_KEY, S), 300); }

/* 共享的世界状态 */
const cvs = document.getElementById('pond');
const ctx = cvs.getContext('2d');
// W、H 是按 1080p 折算的逻辑尺寸；ZOOM 是逻辑像素到 CSS 像素的倍数（2K、4K 屏上大于 1）
let W = 0, H = 0, DPR = 1, SCALE = 1, ZOOM = 1, time = 0;
let fish = [], turtles = [], swimmers = [], butterflies = [], fireflies = [];
let food = [], ripples = [], drops = [], flakes = [], pads = [], petals = [], hearts = [];
// Codex / GPT / 模型 ID 无法确认: only the public Elya Runtime controls this APP.
const HOST = { fps: 0, paused: false, lang: '' };

// 太阳：影子往哪边落、有多长；lit 是阳光有多足
const SUN = { x: 0.55, y: 0.85, lit: 1 };
const pointer = { x: -9999, y: -9999, inside: false, moved: -10, speed: 0, lt: 0 };

function addRipple(x, y, maxR, life, strength) {
  ripples.push({ x, y, maxR, life, strength, age: 0 });
  if (ripples.length > 140) ripples.shift();
}
function autoFishCount() { return Math.round(clamp(W * H / 42000, 16, 48)); }
