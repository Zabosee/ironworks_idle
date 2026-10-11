// Gemeinsame CDP-Helfer für tools/live.mjs und tools/e2e.mjs (keine Abhängigkeiten, Node >= 22 mit globalem WebSocket/fetch).
// Voraussetzung: Chrome mit --remote-debugging-port=9222 und einem Tab auf http://localhost:8080.

const PORT = process.env.CDP_PORT || 9222;
export const GAME = process.env.GAME_URL || 'http://localhost:8080';

export async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find(t => t.type === 'page' && t.url.startsWith(GAME)) || list.find(t => t.type === 'page');
  if (!page) throw new Error('Kein Chrome-Tab gefunden. Chrome mit --remote-debugging-port starten.');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    else if (msg.method) listeners.forEach(l => l(msg));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: (f) => listeners.push(f), close: () => ws.close(), page };
}

export const OVERLAY = `(() => {
  let el = document.getElementById('__claude_live');
  if (!el) {
    el = document.createElement('div'); el.id = '__claude_live';
    el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;background:rgba(20,16,12,.92);color:#ffb35c;border:1px solid #ff8a1f;border-radius:999px;padding:6px 16px;font:600 13px system-ui;box-shadow:0 0 18px rgba(255,138,31,.45);pointer-events:none;transition:opacity .3s';
    document.body.appendChild(el);
  }
  return el;
})()`;

export async function evaluate(c, expr) {
  const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
export const say = (c, text) => evaluate(c, `(${OVERLAY}).textContent = '🤖 Claude: ' + ${JSON.stringify(text)}`);
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function click(c, sel, n = 1) {
  for (let i = 0; i < n; i++) {
    const ok = await evaluate(c, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false;
      el.scrollIntoView({block:'nearest'}); const o = el.style.outline; el.style.outline = '3px solid #ff8a1f';
      setTimeout(() => el.style.outline = o, 350); return true; })()`);
    if (!ok) throw new Error('Element nicht gefunden: ' + sel);
    const box = await evaluate(c, `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    if (n > 1) await sleep(60);
  }
}

export async function collectErrors(c, ms) {
  const errs = [];
  await c.send('Runtime.enable'); await c.send('Log.enable');
  c.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) errs.push(m.params.type.toUpperCase() + ' ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) errs.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await sleep(ms);
  return errs;
}

