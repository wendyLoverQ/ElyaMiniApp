/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   池中小记：每条鱼的档案、池中之最、品种图鉴、奇遇、稀有访客
   ============================================================ */
const POND_KEY = 'koipond.pond.v1';
const BOOK_KEY = 'koipond.book.v1';
const RARITY = ['常见', '少见', '稀有', '传说'];
const FISH_NAMES = ('阿福 元宝 团团 汤圆 年糕 花卷 豆沙 芝麻 布丁 栗子 糯米 米粒 丸子 桂圆 红豆 麻薯 可可 奶茶 橘子 柚子 青梅 杏仁 ' +
  '核桃 小满 谷雨 白露 朝朝 暮暮 点点 墨墨 阿金 阿银 大红 胖胖 圆圆 泡泡 波波 鼓鼓 悠悠 慢慢 跳跳 闹闹 乐乐 福福 旺旺 ' +
  '如意 吉祥 锦儿 胭脂 丹丹 雪球 樱桃 荔枝 山楂 酒酿 汤包 馒头 烧卖 月饼 粽子 蛋黄 云朵 石榴 枇杷 海棠 小鲤 大头').split(' ');

// 池里每条鱼的档案：种子决定长相，吃得多会慢慢长大
const POND = Object.assign({ fish: [], next: 1 }, loadJSON(POND_KEY));
// 图鉴：见过的品种、遇到过的奇遇、全池吃过多少
const BOOK = Object.assign({ seen: {}, moments: {}, eaten: 0, visits: 0, fresh: 1 }, loadJSON(BOOK_KEY));
let bookReady = false;          // 启动时一口气登记的品种不弹提示
setTimeout(() => { bookReady = true; }, 3000);

function savePond() { saveJSON(POND_KEY, { fish: POND.fish, next: POND.next }); }
function saveBook() { const { seen, moments, eaten, visits, fresh } = BOOK; saveJSON(BOOK_KEY, { seen, moments, eaten, visits, fresh }); }
let pondTimer = 0, bookTimer = 0;
function savePondSoon() { clearTimeout(pondTimer); pondTimer = setTimeout(savePond, 2000); }
function saveBookSoon() { clearTimeout(bookTimer); bookTimer = setTimeout(saveBook, 2000); }
function saveAll() { saveMine(); savePond(); saveBook(); }

const varietyByName = n => VARIETIES.find(v => v.name === n) || VARIETIES[0];
const cmOf = len => Math.round(len * 0.6);   // 画面长度 → 厘米

/* ---------- 池中的鱼 ---------- */
function pickName() {
  const used = new Set(POND.fish.map(r => r.name));
  used.add(MINE.name);
  const free = FISH_NAMES.filter(n => !used.has(n));
  return free.length ? free[(Math.random() * free.length) | 0] : 'No.' + POND.next;
}
function newResident() {
  const seed = (Math.random() * 1e9) | 0, R = mulberry32(seed ^ 0x5bd1e995);
  const big = R() < 0.12;
  return {
    id: POND.next++, seed, v: pickVariety(R).name, name: pickName(),
    len: Math.round((44 + R() * 46) * (big ? 1.3 : 1) * 10) / 10,
    z: Math.round(R() * 100) / 100, eaten: 0, joined: Date.now(),
  };
}
function residentGrowth(r) { return 1 + 0.3 * (1 - Math.exp(-r.eaten / 150)); }
function residentL(r) { return r.len * residentGrowth(r) * SCALE; }
function residentCm(r) { return cmOf(r.len * residentGrowth(r)); }
function makeResident(r) {
  const f = new Fish({ seed: r.seed, variety: varietyByName(r.v), L: residentL(r), z: r.z });
  f.res = r;
  return f;
}
// 要显示的鱼：留下来的客人都在，其余按档案顺序取；不够就添新鱼
function pondResidents(want) {
  const guests = POND.fish.filter(r => r.guest), regs = POND.fish.filter(r => !r.guest);
  let added = false;
  while (regs.length < want) { const r = newResident(); POND.fish.push(r); regs.push(r); added = true; }
  if (added) savePond();
  return [...guests, ...regs.slice(0, want)];
}
function noteVarieties() {
  for (const f of fish) if (!f.visitor && !f.v.custom) bookSee(f.v.name);
}

function fishAte(f) {
  BOOK.eaten++;
  if (f.mine) mineAte();
  else if (f.res) { f.res.eaten++; f.setLength(residentL(f.res)); savePondSoon(); }
  else if (f.visitor) VISIT.eaten++;
  sndEat(f.x);
  saveBookSoon();
}

/* ---------- 提示条 ---------- */
const toastEl = document.getElementById('toast');
const gearEl = document.getElementById('gear');
const toastQ = [];
let toastBusy = false;
function toast(tag, text) {
  toastQ.push([tag, text]);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const next = toastQ.shift();
  if (!next) { toastBusy = false; return; }
  toastBusy = true;
  toastEl.querySelector('b').textContent = next[0];
  toastEl.querySelector('span').textContent = next[1];
  toastEl.classList.add('show');
  setTimeout(() => { toastEl.classList.remove('show'); setTimeout(nextToast, 900); }, 4200);
}
function markFresh() {
  BOOK.fresh++;
  gearEl.classList.toggle('fresh', BOOK.fresh > 0);
}
function clearFresh() {
  if (!BOOK.fresh) return;
  BOOK.fresh = 0;
  gearEl.classList.remove('fresh');
  saveBookSoon();
}

function bookSee(name) {
  if (BOOK.seen[name]) return false;
  BOOK.seen[name] = Date.now();
  if (bookReady) { toast(t('图鉴新增'), `${nm(name)} · ${t(RARITY[varietyByName(name).rarity])}`); markFresh(); }
  saveBookSoon();
  return true;
}

/* ---------- 奇遇：条件从无到有算一次 ---------- */
const MOMENTS = [
  { k: 'feed', name: '撒一把鱼食', hint: '轻点水面', on: () => food.length > 0 },
  { k: 'frenzy', name: '群鱼争食', hint: '连着多撒几把', on: () => LEAP.eats.length >= 14 },
  { k: 'hand', name: '伸手入水', hint: '按住水面，别松手', on: () => handActive() },
  { k: 'wake', name: '划水', hint: '在水面上拖一拖', on: () => PRESS.active && PRESS.mode === 'drag' },
  { k: 'leap', name: '锦鲤跃水', hint: '耐心等等，或者让它们吃得热闹些', on: () => fish.some(f => f.leap) },
  { k: 'heart', name: '比心', hint: '点点你自己的那条', on: () => hearts.length > 0 },
  { k: 'shy', name: '缩头乌龟', hint: '碰一碰乌龟', on: () => turtles.some(t => t.hideT > 0) },
  { k: 'gaze', name: '乌龟回眸', hint: '在乌龟旁边停一停', on: () => turtles.some(t => Math.abs(t.look) > 0.3) },
  { k: 'frog', name: '扑通', hint: '水里游着谁？', on: () => frogs.some(f => f.state === 'swim') },
  { k: 'dragonfly', name: '蜻蜓点水', hint: '晴好的天气里留意水面', on: () => dragonflies.some(d => d.dipped) },
  { k: 'butterfly', name: '蝶栖荷上', hint: '晴天的白天', on: () => butterflies.some(b => b.state === 'rest') },
  { k: 'dusk', name: '黄昏', hint: '傍晚时分', on: () => ENV.dusk > 0.5 },
  { k: 'firefly', name: '流萤', hint: '天黑以后', on: () => fireflies.some(f => f.life > 0.6) },
  { k: 'rain', name: '听雨', hint: '下雨的时候', on: () => ENV.rain > 0.5 },
  { k: 'storm', name: '惊雷', hint: '雷雨天', on: () => ENV.flash > 0.5 },
  { k: 'snow', name: '初雪', hint: '下雪的时候', on: () => ENV.snow > 0.5 },
  { k: 'fog', name: '烟波', hint: '起雾的时候', on: () => ENV.fog > 0.5 },
  { k: 'lantern', name: '河灯', hint: '节日的夜里', on: () => lanterns.some(l => l.life > 0.6) },
  { k: 'rainbow', name: '雨后彩虹', hint: '雨停了，太阳出来的时候', on: () => RAINBOW.a > 0.5 },
  { k: 'stars', name: '星河倒影', hint: '晴朗的夜里', on: () => starAlpha() > 0.5 },
  { k: 'moon', name: '水中捞月', hint: '晴夜里，碰一碰水里的月亮' },
  { k: 'blossom', name: '落英', hint: '春天，留意岸边那棵树' },
  { k: 'leaf', name: '一叶知秋', hint: '秋天起风的时候' },
  { k: 'ice', name: '薄冰', hint: '冬天最冷的日子' },
  { k: 'egret', name: '鹭影', hint: '晴天里，留意掠过水面的影子' },
  { k: 'visitor', name: '有客来访', hint: '开着壁纸，总会有客人来' },
  { k: 'stay', name: '留客', hint: '客人来了，喂它些吃的' },
  { k: 'dragon', name: '鱼跃龙门', hint: '最稀有的客人，走的时候不一样' },
];
const momentOn = {};
let momentAcc = 0;
function bookMoment(k, quiet) {
  const m = MOMENTS.find(m => m.k === k);
  const e = BOOK.moments[k];
  if (e) e.n++;
  else {
    BOOK.moments[k] = { first: Date.now(), n: 1 };
    if (!quiet) toast(t('池中小记'), t(m.name));
    markFresh();
  }
  saveBookSoon();
}
function updateMoments(dt) {
  momentAcc += dt;
  if (momentAcc < 0.25) return;
  momentAcc = 0;
  for (const m of MOMENTS) {
    if (!m.on) continue;
    const now = !!m.on();
    if (now && !momentOn[m.k]) bookMoment(m.k);
    momentOn[m.k] = now;
  }
}

/* ---------- 稀有访客：偶尔从池边游进来，待几分钟再走；喂过它的，可能会留下 ---------- */
const VISIT = { f: null, t: 0, eaten: 0, next: BOOK.visits ? rand(1200, 2700) : rand(240, 420) };
function spawnVisitor(name) {
  if (VISIT.f) return null;
  const rare = VARIETIES.filter(v => v.rarity === 2);
  // 金龙鲤约 1.5%，金鳞约 6%，其余是稀有品种
  const r = Math.random();
  const v = name ? varietyByName(name) : r < 0.015 ? varietyByName('金龙鲤') : r < 0.075 ? varietyByName('金鳞') : rare[(Math.random() * rare.length) | 0];
  const len = v.ascend ? rand(100, 124) : rand(62, 96), L = len * SCALE;
  const side = (Math.random() * 4) | 0;
  const x = side === 0 ? -L * 0.9 : side === 1 ? W + L * 0.9 : rand(W * 0.2, W * 0.8);
  const y = side === 2 ? -L * 0.9 : side === 3 ? H + L * 0.9 : rand(H * 0.2, H * 0.8);
  const a = Math.atan2(H / 2 + rand(-H, H) * 0.2 - y, W / 2 + rand(-W, W) * 0.2 - x);
  const seed = (Math.random() * 1e9) | 0, z = Math.round(rand(0.05, 0.35) * 100) / 100;
  const f = new Fish({ seed, variety: v, L, z, x, y, a });
  f.visitor = true; f.vlen = len;
  fish.push(f);
  sortSwimmers();
  Object.assign(VISIT, { f, t: rand(200, 360), eaten: 0, seed, z, leaving: false });
  const first = !BOOK.visits;
  BOOK.visits++;
  const isNew = !BOOK.seen[v.name];
  BOOK.seen[v.name] = BOOK.seen[v.name] || Date.now();
  toast(t(isNew ? '图鉴新增' : '有客来访'), `${nm(v.name)} · ${t(RARITY[v.rarity])}`);
  if (isNew) markFresh();
  if (first) toast(t('悄悄话'), t('喂它些吃的，说不定它会留下'));
  bookMoment('visitor');
  spotFish(f, v.name, 9);
  if (v.rarity >= 3) { sparkleBurst(f.x, f.y, 16, 0.6); sndChime(f.x); }
  return f;
}
function updateVisit(dt) {
  if (!VISIT.f) {
    VISIT.next -= dt;
    if (VISIT.next < 0) { VISIT.next = rand(1200, 2700); spawnVisitor(); }
    return;
  }
  const f = VISIT.f;
  if (f.gone) {
    // 金龙鲤跃过龙门
    fish = fish.filter(o => o !== f);
    sortSwimmers();
    VISIT.f = null;
    sparkleBurst(f.x, f.y, 46, 1.5);
    sndChime(f.x);
    toast(t('鱼跃龙门'), t('{name}化作点点金光，不见了', { name: nm(f.v.name) }));
    bookMoment('dragon', true);
    return;
  }
  if (!VISIT.leaving) {
    VISIT.t -= dt;
    if (VISIT.t > 0) return;
    if (VISIT.eaten >= 3 && Math.random() < (f.v.rarity >= 3 ? 0.35 : 0.6)) { keepVisitor(f); return; }
    VISIT.leaving = true;
    if (!f.v.ascend) {
      // 游向最近的池边离开
      const ex = f.x < W / 2 ? -f.L * 3 : W + f.L * 3, ey = f.y < H / 2 ? -f.L * 3 : H + f.L * 3;
      f.exitTo = Math.min(f.x, W - f.x) < Math.min(f.y, H - f.y) ? [ex, f.y] : [f.x, ey];
    }
    return;
  }
  if (f.v.ascend) {
    // 等它游到开阔的水面再跃起
    if (!f.leap && f.x > W * 0.15 && f.x < W * 0.85 && f.y > H * 0.15 && f.y < H * 0.85) {
      f.ascend = true; f.leap = 0.0001; f.leapDur = 1.8; f.z = 0;
      splash(f.x, f.y, 0.9);
    }
    return;
  }
  if (f.x < -f.L * 1.9 || f.x > W + f.L * 1.9 || f.y < -f.L * 1.9 || f.y > H + f.L * 1.9) {
    fish = fish.filter(o => o !== f);
    sortSwimmers();
    VISIT.f = null;
  }
}
function keepVisitor(f) {
  const r = { id: POND.next++, seed: VISIT.seed, v: f.v.name, name: pickName(), len: Math.round(f.vlen * 10) / 10, z: VISIT.z, eaten: VISIT.eaten, joined: Date.now(), guest: true };
  POND.fish.push(r);
  savePond();
  f.visitor = false; f.res = r;
  VISIT.f = null;
  toast(t('留下来了'), t('{kind}住进了池子，就叫它「{name}」吧', { kind: nm(f.v.name), name: nm(r.name) }));
  bookMoment('stay');
  spotFish(f, r.name, 10);
}

/* ---------- 圈出某条鱼；鼠标停在一条鱼身上时，也会显出它的名字 ---------- */
const SPOT = { f: null, name: '', t: 0, a: 0, hover: false };
function fishLabel(f) { return f.res ? f.res.name : f.visitor ? f.v.name : ''; }
function spotFish(f, name, dur) {
  if (f === MINE.fish) { MINE.showT = dur; return; }
  Object.assign(SPOT, { f, name: name || fishLabel(f), t: dur, hover: false });
}
function updateSpot(dt) {
  SPOT.t -= dt;
  if (SPOT.t <= 0 && pointer.inside && time - pointer.moved > 0.6) {
    const f = fish.find(f => !f.mine && !f.leap && f.hit(pointer.x, pointer.y));
    if (f) Object.assign(SPOT, { f, name: fishLabel(f), t: 0.4, hover: true });
  }
  const vis = SPOT.f && SPOT.t > 0 && fish.includes(SPOT.f) ? 1 : 0;
  SPOT.a += (vis - SPOT.a) * Math.min(1, dt * 4);
  if (!vis && SPOT.a < 0.02) SPOT.f = null;
}
function drawSpot(g) {
  if (SPOT.f && SPOT.a > 0.02) drawFishRing(g, SPOT.f, nm(SPOT.name), SPOT.a);
}

function updateBook(dt) {
  updateVisit(dt);
  updateMoments(dt);
  updateSpot(dt);
}

/* ---------- 图鉴面板 ---------- */
function pondRoster() {
  const out = [];
  if (MINE.fish) out.push({ f: MINE.fish, name: MINE.name, v: MINE.fish.v, cm: mineCm(), eaten: MINE.eaten, seed: MINE.seed, z: MINE.fish.z, mine: true });
  for (const f of fish) if (f.res) out.push({ f, name: f.res.name, v: f.v, cm: residentCm(f.res), eaten: f.res.eaten, seed: f.res.seed, z: f.res.z });
  return out;
}
function bookRecords(roster) {
  const pick = better => roster.reduce((a, b) => (better(b, a) ? b : a));
  return [
    { label: t('最大的鱼'), e: pick((b, a) => b.cm > a.cm), val: e => t('{n} 厘米', { n: e.cm }) },
    { label: t('最小的鱼'), e: pick((b, a) => b.cm < a.cm), val: e => t('{n} 厘米', { n: e.cm }) },
    { label: t('最能吃'), e: pick((b, a) => b.eaten > a.eaten), val: e => (e.eaten ? t('{n} 粒', { n: e.eaten }) : t('还没开饭')) },
    { label: t('最稀有'), e: pick((b, a) => b.v.rarity > a.v.rarity || (b.v.rarity === a.v.rarity && b.cm > a.cm)), val: e => t(RARITY[e.v.rarity]) },
  ];
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const bookPane = document.getElementById('pane-book');
let bookSig = '';
function renderBook(force) {
  if (!panelOpen || bookPane.hidden) return;
  const roster = pondRoster();
  if (!roster.length) return;
  const recs = bookRecords(roster);
  const sig = JSON.stringify([LANG, recs.map(r => [r.e.name, r.e.cm, r.e.eaten]), Object.keys(BOOK.seen), BOOK.moments, roster.length, BOOK.eaten]);
  if (!force && sig === bookSig) return;
  bookSig = sig;

  // 池中之最
  const recBox = document.getElementById('bk-recs');
  recBox.replaceChildren();
  for (const r of recs) {
    const b = el('button', 'rec');
    b.type = 'button';
    const c = el('canvas');
    c.setAttribute('aria-hidden', 'true');
    const txt = el('span', 'rec-txt');
    const name = nm(r.e.name), kind = nm(r.e.v.name);
    txt.append(el('small', null, r.label), el('strong', null, name), el('em', null, kind));
    b.append(c, txt, el('span', 'rec-val', r.val(r.e)));
    b.setAttribute('aria-label', t('{label}：{name}，{kind}，{val}。在池中圈出它', { label: r.label, name, kind, val: r.val(r.e) }));
    b.addEventListener('click', () => { spotFish(r.e.f, r.e.name, 7); closePanel(); });
    recBox.append(b);
    drawFishPortrait(c, { seed: r.e.seed, variety: r.e.v, z: r.e.z });
  }
  const guests = POND.fish.filter(r => r.guest).length;
  document.getElementById('bk-sum').textContent =
    t('池中 {n} 条 · 一共吃了 {e} 粒 · 来过 {v} 位客人', { n: roster.length, e: BOOK.eaten, v: BOOK.visits }) + (guests ? t('，留下 {g} 位', { g: guests }) : '');

  // 品种
  const vBox = document.getElementById('bk-vars');
  vBox.replaceChildren();
  let nv = 0;
  VARIETIES.forEach((v, i) => {
    const seen = BOOK.seen[v.name];
    if (seen) nv++;
    const card = el('div', 'vcard' + (seen ? '' : ' locked'));
    const c = el('canvas');
    c.setAttribute('aria-hidden', 'true');
    card.append(c, el('strong', null, seen ? nm(v.name) : t('？？？')), el('span', 'rar r' + v.rarity, t(RARITY[v.rarity])));
    card.title = seen ? t('{name} · {day}第一次见到', { name: nm(v.name), day: fmtMonthDay(seen) }) : t(v.rarity >= 2 ? '只会作为客人来访' : '还没在池子里见过');
    vBox.append(card);
    drawFishPortrait(c, { seed: 7919 * (i + 3), variety: v, z: 0, silhouette: !seen });
  });
  document.getElementById('bk-vcount').textContent = `${nv} / ${VARIETIES.length}`;

  // 奇遇
  const mBox = document.getElementById('bk-moms');
  mBox.replaceChildren();
  let nMom = 0;
  for (const m of MOMENTS) {
    const e = BOOK.moments[m.k];
    if (e) nMom++;
    const item = el('div', 'moment' + (e ? '' : ' locked'));
    item.append(el('strong', null, t(e ? m.name : '？？？')), el('span', null, e ? t('{day} · {n} 次', { day: fmtMonthDay(e.first), n: e.n }) : t(m.hint)));
    mBox.append(item);
  }
  document.getElementById('bk-mcount').textContent = `${nMom} / ${MOMENTS.length}`;
}
setInterval(() => renderBook(false), 2000);
gearEl.classList.toggle('fresh', BOOK.fresh > 0);
