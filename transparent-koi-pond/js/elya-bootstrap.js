/* Elya adaptation: Codex / GPT / 模型 ID 无法确认. Source: Wallpaper Engine 3807744786. */

'use strict';
// Codex / GPT / 模型 ID 无法确认: restore the whole current snapshot before initializing any source module.
(() => {
  const runtime = window.elyaPet;
  let state = {}, dirty = false, timer = 0, writing = null, blocked = false;
  const copy = value => JSON.parse(JSON.stringify(value));
  const message = (zh, en) => /^zh/i.test(navigator.language) ? zh : en;
  function fail(error) {
    console.error(error);
    let box = document.getElementById('koi-runtime-error');
    if (!box) { box = document.createElement('div'); box.id = 'koi-runtime-error'; box.setAttribute('role', 'alert'); document.body.appendChild(box); }
    const code = error.code || error.message || 'KOI_RUNTIME_ERROR';
    box.textContent = message('锦鲤池操作失败：', 'Koi pond operation failed: ') + code;
  }
  async function flush() {
    clearTimeout(timer); timer = 0;
    if (blocked) return;
    if (writing) { await writing; if (dirty && !blocked) return flush(); return; }
    if (!dirty) return;
    const value = copy(state); dirty = false;
    writing = runtime.storage.set('pond-state', value);
    try { await writing; }
    catch (error) { blocked = true; error.code = error.code || 'KOI_STORAGE_WRITE_FAILED'; fail(error); }
    finally { writing = null; }
  }
  window.KoiHost = {
    fail, flush,
    load(key) { return key in state ? copy(state[key]) : {}; },
    save(key, value) {
      state[key] = copy(value); dirty = true;
      if (!timer && !blocked) timer = setTimeout(flush, 1000);
    },
    async fetch(url) {
      if (!runtime.network) throw Object.assign(new Error('WEB_PET_NETWORK_DENIED'), { code: 'WEB_PET_NETWORK_DENIED' });
      const result = await runtime.network.fetch({ url, method: 'GET', responseType: 'text' });
      return { ok: result.status >= 200 && result.status < 300, status: result.status, json: async () => JSON.parse(result.body) };
    },
  };
  async function boot() {
    if (!runtime || runtime.protocolVersion !== 2) throw Error('ELYA_RUNTIME_V2_REQUIRED');
    runtime.setHostPresentation({ bubble: false, voice: false });
    const restored = await runtime.storage.get('pond-state');
    if (restored !== undefined) {
      if (!restored || typeof restored !== 'object' || Array.isArray(restored)) throw Error('KOI_INVALID_SNAPSHOT');
      state = restored;
    }
    const scripts = ['core','lang-en','i18n','koi','scenery','creatures','weather','surprises','light','season','egret','mykoi','book','sound','painter','picker','panel','elya-runtime','main'];
    for (const name of scripts) await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'js/' + name + '.js';
      script.onload = resolve; script.onerror = () => reject(Error('KOI_SCRIPT_LOAD_FAILED: ' + name));
      document.body.appendChild(script);
    });
    document.documentElement.dataset.koiReady = 'true';
  }
  boot().catch(fail);
})();
