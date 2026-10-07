/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */
'use strict';
/* ============================================================
   下拉选择框 <koi-select>
   Wallpaper Engine 的网页壁纸内核（离屏渲染的 CEF）一画原生 <select> 就整页崩溃，
   所以自己做一个：用法和 <select> 差不多，有 value，选了会发 change 事件
   ============================================================ */
const PICK_LIST_MAX_REM = 16;   // 列表最高多少，再多就在里面滚动（壁纸里没有滚轮，尽量一屏摆下）
let pickSeq = 0;

class KoiSelect extends HTMLElement {
  constructor() {
    super();
    this._opts = [];
    this._value = '';
    this._active = -1;
  }

  connectedCallback() {
    if (this._btn) return;
    const id = this.id || 'koi-select-' + (++pickSeq);
    this.classList.add('pick');
    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'pick-btn';
    this._btn.setAttribute('aria-haspopup', 'listbox');
    this._btn.setAttribute('aria-expanded', 'false');
    this._btn.setAttribute('aria-controls', id + '-list');
    const labelledBy = this.getAttribute('aria-labelledby');
    if (labelledBy) this._btn.setAttribute('aria-labelledby', labelledBy + ' ' + id + '-cur');
    this._cur = document.createElement('span');
    this._cur.id = id + '-cur';
    this._btn.append(this._cur);
    this._list = document.createElement('div');
    this._list.id = id + '-list';
    this._list.className = 'pick-list';
    this._list.setAttribute('role', 'listbox');
    this._list.tabIndex = -1;
    this._list.hidden = true;
    this.append(this._btn, this._list);

    this._btn.addEventListener('click', () => (this._list.hidden ? this.open() : this.close()));
    this._btn.addEventListener('keydown', e => this._onKey(e));
    this._list.addEventListener('keydown', e => this._onKey(e));
    this._list.addEventListener('click', e => {
      const o = e.target.closest('[role="option"]');
      if (o) this._choose(+o.dataset.i);
    });
    this._onOutside = e => { if (!this.contains(e.target)) this.close(); };
    this._render();
  }

  disconnectedCallback() { this.close(); }

  // [{ value, label }, …]
  set options(list) {
    this._opts = Array.isArray(list) ? list.map(o => ({ value: String(o.value), label: String(o.label) })) : [];
    this._render();
  }
  get options() { return this._opts.slice(); }

  get value() { return this._value; }
  set value(v) {
    this._value = v == null ? '' : String(v);
    this._render();
  }

  open() {
    if (!this._list || !this._opts.length) return;
    this._list.hidden = false;
    this._btn.setAttribute('aria-expanded', 'true');
    this._place();
    this._setActive(Math.max(0, this._index()));
    this._list.focus({ preventScroll: true });
    document.addEventListener('pointerdown', this._onOutside, true);
  }

  close(refocus) {
    if (!this._list || this._list.hidden) return;
    this._list.hidden = true;
    this._btn.setAttribute('aria-expanded', 'false');
    this._list.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', this._onOutside, true);
    if (refocus) this._btn.focus();
  }

  _index() { return this._opts.findIndex(o => o.value === this._value); }

  _render() {
    if (!this._list) return;
    const cur = this._opts[this._index()];
    this._cur.textContent = cur ? cur.label : '';
    this._list.replaceChildren(...this._opts.map((o, i) => {
      const el = document.createElement('div');
      el.id = this._list.id + '-' + i;
      el.className = 'pick-opt';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(o.value === this._value));
      el.dataset.i = i;
      el.textContent = o.label;
      return el;
    }));
  }

  // 下面放不下就往上翻
  _place() {
    const pane = this.closest('.pane') || document.documentElement;
    const box = pane.getBoundingClientRect(), r = this._btn.getBoundingClientRect();
    const want = Math.min(this._list.scrollHeight, PICK_LIST_MAX_REM * parseFloat(getComputedStyle(document.documentElement).fontSize));
    const below = box.bottom - r.bottom, above = r.top - box.top;
    this.classList.toggle('up', below < want && above > below);
  }

  _cols() { return getComputedStyle(this._list).gridTemplateColumns.split(' ').length || 1; }

  _setActive(i) {
    const items = this._list.children;
    if (!items.length) return;
    this._active = clamp(i, 0, items.length - 1);
    for (let k = 0; k < items.length; k++) items[k].classList.toggle('active', k === this._active);
    const el = items[this._active];
    this._list.setAttribute('aria-activedescendant', el.id);
    el.scrollIntoView({ block: 'nearest' });
  }

  _choose(i) {
    const o = this._opts[i];
    this.close(true);
    if (!o || o.value === this._value) return;
    this.value = o.value;
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  _onKey(e) {
    const shut = this._list.hidden;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowUp': case 'ArrowLeft': case 'ArrowRight': {
        if (shut && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
        e.preventDefault();
        if (shut) { this.open(); break; }
        // 选项排成几列，上下键跨一整行
        const step = { ArrowDown: this._cols(), ArrowUp: -this._cols(), ArrowRight: 1, ArrowLeft: -1 }[e.key];
        this._setActive(this._active + step);
        break;
      }
      case 'Home': case 'End':
        if (shut) return;
        e.preventDefault();
        this._setActive(e.key === 'Home' ? 0 : this._opts.length - 1);
        break;
      case 'Enter': case ' ':
        if (shut) return;   // 按钮自己会响应，打开列表
        e.preventDefault();
        this._choose(this._active);
        break;
      case 'Escape':
        if (shut) return;
        e.preventDefault();
        e.stopPropagation();   // 只关列表，别把整个设置面板也关了
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
    }
  }
}
customElements.define('koi-select', KoiSelect);
