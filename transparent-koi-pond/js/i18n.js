/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   中英切换
   代码里的文字照旧写中文，显示前过一遍 t()；英文在 js/lang-en.js。
   index.html 里写死的文字由 translatePage() 整页替换，切回中文时换回原文。
   两个中文词撞了、英文要不一样时，在元素上写 data-en="…" 指定它自己的英文
   ============================================================ */
let LANG = resolveLang();

// 手动选的优先；否则听壁纸程序的界面语言，再没有就看系统语言
function resolveLang() {
  if (S.lang === 'zh' || S.lang === 'en') return S.lang;
  const pref = HOST.lang || (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^zh/i.test(pref) ? 'zh' : 'en';
}

function fill(s, vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s;
}
function t(zh, vars) {
  if (LANG !== 'en' || !(zh in EN)) return fill(zh, vars);
  const en = EN[zh];
  return typeof en === 'function' ? en(vars || {}) : fill(en, vars);
}
// 鱼的名字和品种名：英文里查不到的（比如自己起的名字）原样显示
const nm = name => (LANG === 'en' && EN_NAMES[name]) || name;
const termName = term => (LANG === 'en' && EN_TERMS[term]) || term;
const cityName = c => (LANG === 'en' && c.en) || c.name;

// 日期：中文“9月25日”，英文“Sep 25”
function fmtMonthDay(ts) {
  const d = new Date(ts);
  return LANG === 'en' ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmtFullDate(ts) {
  const d = new Date(ts);
  return LANG === 'en' ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmtWeekDate(d) {
  return LANG === 'en' ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;
}

/* 整页替换写死的文字。原文记在旁边，切回中文时用 */
const I18N_ATTRS = ['aria-label', 'title', 'placeholder'];
const origText = new WeakMap(), origAttr = new WeakMap();
const HAS_ZH = /[一-鿿]/;
function swapText(src, el) {
  const key = src.trim();
  if (!key || !HAS_ZH.test(key)) return src;
  const en = el && el.dataset && el.dataset.en;
  return src.replace(key, en && LANG === 'en' ? en : t(key));
}
function translatePage(root) {
  root = root || document.body;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!origText.has(n)) origText.set(n, n.nodeValue);
    const next = swapText(origText.get(n), n.parentElement);
    if (n.nodeValue !== next) n.nodeValue = next;
  }
  for (const el of root.querySelectorAll('[aria-label], [title], [placeholder]')) {
    let orig = origAttr.get(el);
    if (!orig) { orig = {}; origAttr.set(el, orig); }
    for (const a of I18N_ATTRS) {
      if (!el.hasAttribute(a)) continue;
      if (!(a in orig)) orig[a] = el.getAttribute(a);
      el.setAttribute(a, swapText(orig[a], el));
    }
  }
  document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
  document.title = t('锦鲤池');
}

// 调试用：列出当前页面上还没翻成英文的文字
function missingText() {
  const out = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) continue;
    if (HAS_ZH.test(n.nodeValue)) out.add(n.nodeValue.trim());
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
    for (const a of I18N_ATTRS) { const v = el.getAttribute(a); if (v && HAS_ZH.test(v)) out.add(`${a}: ${v}`); }
  }
  return [...out];
}
