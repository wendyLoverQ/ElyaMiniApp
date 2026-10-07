/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   设置面板
   ============================================================ */
const panel = document.getElementById('panel');
const gear = document.getElementById('gear');
let panelOpen = false;

function openPanel() {
  panelOpen = true;
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  panel.inert = false;
  gear.setAttribute('aria-expanded', 'true');
  refreshMinePane(true);
  renderWeatherUI();
  if (!document.getElementById('pane-book').hidden) { clearFresh(); renderBook(true); }
}
function closePanel() {
  panelOpen = false;
  for (const p of panel.querySelectorAll('koi-select')) p.close();
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;
  gear.setAttribute('aria-expanded', 'false');
}
gear.addEventListener('click', () => (panelOpen ? closePanel() : openPanel()));
document.getElementById('panel-close').addEventListener('click', () => { closePanel(); gear.focus(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) { closePanel(); gear.focus(); } });
panel.inert = true;

// 设置按钮的显示方式；“鼠标靠近时”要鼠标移到按钮附近才浮出来
const GEAR_PEEK_PX = 220;   // 按 1080p 算的靠近距离，大屏上跟着 ZOOM 放大
function applyGearMode() {
  gear.hidden = S.gearMode === 'hidden';
  gear.classList.toggle('peek', S.gearMode === 'hover');
  gear.classList.remove('near');
}
function peekGear(cx, cy) {
  if (S.gearMode !== 'hover') return;
  const r = gear.getBoundingClientRect();
  const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
  gear.classList.toggle('near', d < GEAR_PEEK_PX * ZOOM);
}

// 标签页
const tabs = [...panel.querySelectorAll('[role="tab"]')];
function selectTab(name) {
  for (const t of tabs) {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  }
  for (const p of panel.querySelectorAll('[role="tabpanel"]')) p.hidden = p.dataset.pane !== name;
  if (name === 'mine') refreshMinePane(true);
  if (name === 'book' && panelOpen) { clearFresh(); renderBook(true); }

}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t.dataset.tab));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); selectTab(n.dataset.tab);
  });
});

// Wallpaper Engine 不把滚轮转给桌面壁纸，面板和下拉列表只能按住拖着滚。
// 挪过几个像素才算拖，拖完松手的那一下不算点击；滑块、输入框、画布照常用
const DRAG_SCROLL_PX = 6;
function dragScroll(el) {
  let drag = null, swallow = false;
  el.classList.add('drag-scroll');
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.pointerType === 'touch') return;   // 触屏本来就能滑
    if (e.target.closest('.drag-scroll') !== el || e.target.closest('input, textarea, canvas')) return;
    if (el.scrollHeight <= el.clientHeight) return;
    drag = { id: e.pointerId, y: e.clientY, top: el.scrollTop, on: false };
  });
  el.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dy) < DRAG_SCROLL_PX * ZOOM) return;
      drag.on = true;
      el.classList.add('dragging');
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 抓不住也能拖，只是移出去就断 */ }
    }
    el.scrollTop = drag.top - dy;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.on) { el.classList.remove('dragging'); swallow = true; setTimeout(() => { swallow = false; }, 0); }
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', e => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
}
for (const el of panel.querySelectorAll('.pane, .pick-list')) dragScroll(el);

// 城市、品种下拉
const citySel = document.getElementById('city');
// 搜到过的城市排在最前面
function fillCities() {
  const custom = S.customCity ? [{ value: 'custom', label: cityName(S.customCity) }] : [];
  citySel.options = custom.concat(Object.entries(CITIES).map(([k, c]) => ({ value: k, label: cityName(c) })));
}
fillCities();
// 稀有品种要先在图鉴里见过，才能给自己的锦鲤换上
const varSel = document.getElementById('mine-variety');
function fillVarieties() {
  const list = VARIETIES.filter(v => v.rarity < 2 || BOOK.seen[v.name] || v.name === MINE.variety);
  varSel.options = (MINE.custom ? [{ value: CUSTOM_NAME, label: t('自己画的') }] : [])
    .concat(list.map(v => ({ value: v.name, label: nm(v.name) + (v.rarity >= 2 ? ' · ' + t(RARITY[v.rarity]) : '') })));
}

// 通用绑定：data-key 对应 S 里的字段
const FORMAT = {
  pct: v => Math.round(v * 100) + '%',
  int: v => String(Math.round(v)),
};
function applySetting(key) {
  switch (key) {
    case 'fishCount': applyFishCount(); break;
    case 'turtles': applyTurtles(); break;
    case 'showClock': document.getElementById('almanac').hidden = !S.showClock; break;
    case 'gearMode': applyGearMode(); break;
    case 'weatherMode': if (S.weatherMode === 'auto' && LIVE.status !== 'ok') fetchWeather(); renderWeatherUI(); break;
    case 'city': fillCities(); if (S.weatherMode === 'auto') fetchWeather(); else renderWeatherUI(); break;
    case 'lang': applyLang(); break;
    case 'sound': applySound(); break;
    case 'seasonMode': applySeason(); break;
    case 'quality': QUAL.level = 0; resize(); break;
  }
}
function setSetting(key, val) {
  S[key] = val;
  saveSettings();
  applySetting(key);
  syncControls();
}

function syncControls() {
  for (const seg of panel.querySelectorAll('.seg[data-key]')) {
    for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.val) === String(S[seg.dataset.key]));
  }
  for (const el of panel.querySelectorAll('input[data-key], koi-select[data-key]')) {
    const key = el.dataset.key;
    if (el.type === 'checkbox') el.checked = !!S[key];
    else if (el.type === 'range') {
      const scale = +el.dataset.scale || 1;
      const v = key === 'fishCount' && !S.fishCount ? autoFishCount() : S[key];
      el.value = v * scale;
      const out = el.parentElement.querySelector('output');
      if (out) out.textContent = key === 'fishCount' && !S.fishCount ? t('自动 {n}', { n: v }) : (FORMAT[el.dataset.fmt] || FORMAT.int)(v);
    } else el.value = S[key];
  }
  document.getElementById('city-row').hidden = S.weatherMode !== 'auto';
  document.getElementById('city-find-row').hidden = S.weatherMode !== 'auto';
}

// 按名字搜城市（壁纸程序里打不了字，那边在侧边栏的“自定义城市”里填）
const cityFind = document.getElementById('city-find');
const cityQ = document.getElementById('city-q');
cityFind.addEventListener('submit', async e => {
  e.preventDefault();
  const q = cityQ.value.trim();
  if (!q || cityFind.dataset.busy) return;
  const status = document.getElementById('wx-status');
  cityFind.dataset.busy = '1';
  status.textContent = t('正在查找……');
  try {
    const c = await useCityByName(q);
    if (c) cityQ.value = '';
    status.textContent = c ? t('已切换到 {city}', { city: cityName(c) }) : t('没找到这个城市');
  } catch (err) {
    status.textContent = t('查不到，网络不通');
  } finally {
    delete cityFind.dataset.busy;
  }
});

for (const seg of panel.querySelectorAll('.seg[data-key]')) {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    setSetting(seg.dataset.key, seg.hasAttribute('data-num') ? +b.dataset.val : b.dataset.val);
  });
}
for (const el of panel.querySelectorAll('input[data-key], koi-select[data-key]')) {
  const key = el.dataset.key;
  el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
    if (el.type === 'checkbox') setSetting(key, el.checked);
    else if (el.type === 'range') setSetting(key, +el.value / (+el.dataset.scale || 1));
    else setSetting(key, el.value);
  });
}

/* 我的锦鲤 */
const mineName = document.getElementById('mine-name');
const resetBtn = document.getElementById('mine-reset');
let resetArmed = 0;
function fmtWatched(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? t('{h} 小时 {m} 分', { h, m }) : t('{m} 分钟', { m });
}
function refreshMinePane(full) {
  if (!panelOpen) return;
  document.getElementById('mine-title').textContent = nm(MINE.name);
  document.getElementById('mine-kind').textContent = mineKindLabel();
  document.getElementById('st-len').textContent = t('{n} 厘米', { n: mineCm() });
  document.getElementById('st-eat').textContent = t('{n} 粒', { n: MINE.eaten });
  document.getElementById('st-time').textContent = fmtWatched(MINE.watched);
  document.getElementById('st-born').textContent = fmtFullDate(MINE.born);
  const g = mineGrowth();
  document.getElementById('st-grow').style.width = Math.round(g * 100) + '%';
  document.getElementById('st-grow-label').textContent = t(g < 0.25 ? '幼鱼' : g < 0.6 ? '正在长大' : g < 0.9 ? '成鱼' : '池中老鲤');
  if (full) {
    if (document.activeElement !== mineName) mineName.value = nm(MINE.name);
    fillVarieties();
    varSel.value = MINE.variety;
    drawMinePortrait(document.getElementById('mine-portrait'));
  }
}
setInterval(() => refreshMinePane(false), 1000);

mineName.addEventListener('input', () => {
  renameMine(mineName.value);
  refreshMinePane(false);
});
// 桌面上打不了字，随机挑一个池子里没人用的名字
document.getElementById('mine-name-roll').addEventListener('click', () => {
  renameMine(pickName());
  refreshMinePane(true);
});
varSel.addEventListener('change', () => {
  MINE.variety = varSel.value;
  saveMine();
  spawnMine();
  if (!painterEl.hidden) openPainter();
  MINE.showT = 6;
  refreshMinePane(true);
});
document.getElementById('mine-find').addEventListener('click', () => { MINE.showT = 6; closePanel(); });
document.getElementById('mine-call').addEventListener('click', () => { MINE.showT = 10; MINE.summonT = 10; closePanel(); });
resetBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = setTimeout(() => { resetArmed = 0; resetBtn.textContent = t('重新领养'); resetBtn.classList.remove('armed'); }, 3000);
    resetBtn.textContent = t('再点一次，换一条新的');
    resetBtn.classList.add('armed');
    return;
  }
  clearTimeout(resetArmed); resetArmed = 0;
  resetBtn.textContent = t('重新领养'); resetBtn.classList.remove('armed');
  Object.assign(MINE, newMineData(), { variety: pickVariety(Math.random).name });
  saveMine();
  spawnMine();
  if (!painterEl.hidden) openPainter();
  MINE.showT = 6;
  refreshMinePane(true);
});

(function initPanel() {
  let tab = 'scene';

  selectTab(tab);
  syncControls();
  document.getElementById('almanac').hidden = !S.showClock;
  applyGearMode();
})();
