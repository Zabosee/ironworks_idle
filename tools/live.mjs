#!/usr/bin/env node
// Live-Steuerung des sichtbaren Chrome-Fensters über das DevTools-Protokoll (keine Abhängigkeiten).
// Voraussetzung: Chrome läuft mit --remote-debugging-port=9222 und hat einen Tab auf http://localhost:8080.
//
// Befehle:
//   node tools/live.mjs eval "<js>"            JS im Spiel ausführen, Ergebnis ausgeben
//   node tools/live.mjs click "<selector>" [n] Element n-mal sichtbar anklicken (mit Hervorhebung)
//   node tools/live.mjs tab <name>             Tab wechseln (gens, upgrades, research, ...)
//   node tools/live.mjs say "<text>"           Statuszeile im Browser anzeigen
//   node tools/live.mjs reload                 Seite neu laden (Cache umgehen)
//   node tools/live.mjs shot <datei.png>       Screenshot speichern
//   node tools/live.mjs errors [ms]            Konsolenfehler/Exceptions für ms sammeln (Standard 3000)
//   node tools/live.mjs check                  Reload + Fehler sammeln + Basis-DOM-Prüfung

const PORT = process.env.CDP_PORT || 9222;
const GAME = process.env.GAME_URL || 'http://localhost:8080';

async function connect() {
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

const OVERLAY = `(() => {
  let el = document.getElementById('__claude_live');
  if (!el) {
    el = document.createElement('div'); el.id = '__claude_live';
    el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;background:rgba(20,16,12,.92);color:#ffb35c;border:1px solid #ff8a1f;border-radius:999px;padding:6px 16px;font:600 13px system-ui;box-shadow:0 0 18px rgba(255,138,31,.45);pointer-events:none;transition:opacity .3s';
    document.body.appendChild(el);
  }
  return el;
})()`;

async function evaluate(c, expr) {
  const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const say = (c, text) => evaluate(c, `(${OVERLAY}).textContent = '🤖 Claude: ' + ${JSON.stringify(text)}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function click(c, sel, n = 1) {
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

async function collectErrors(c, ms) {
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

const [cmd, ...args] = process.argv.slice(2);
const c = await connect();
try {
  switch (cmd) {
    case 'eval': { const v = await evaluate(c, args.join(' ')); console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2)); break; }
    case 'click': await say(c, 'Klicke ' + args[0]); await click(c, args[0], Number(args[1]) || 1); console.log('ok'); break;
    case 'tab': await say(c, 'Öffne Tab ' + args[0]); await click(c, `[data-tab="${args[0]}"]`); console.log('ok'); break;
    case 'say': await say(c, args.join(' ')); console.log('ok'); break;
    case 'reload': await c.send('Page.reload', { ignoreCache: true }); await sleep(1200); console.log('ok'); break;
    case 'shot': {
      const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
      const fs = await import('node:fs'); fs.writeFileSync(args[0] || 'shot.png', Buffer.from(data, 'base64')); console.log('gespeichert: ' + (args[0] || 'shot.png')); break;
    }
    case 'errors': { const e = await collectErrors(c, Number(args[0]) || 3000); console.log(e.length ? e.join('\n') : 'keine Fehler'); break; }
    case 'check': {
      await c.send('Runtime.enable'); await c.send('Log.enable');
      const p = collectErrors(c, 3500);
      await c.send('Page.reload', { ignoreCache: true });
      const e = await p;
      const dom = await evaluate(c, `({ title: document.title, bootError: !document.getElementById('boot-error')?.hidden, tabs: document.querySelectorAll('[data-tab]').length, gens: document.querySelectorAll('#tab-gens > *, #gens > *').length })`);
      console.log(JSON.stringify(dom)); console.log(e.length ? e.join('\n') : 'keine Fehler');
      break;
    }
    default: console.log('Befehle: eval | click | tab | say | reload | shot | errors | check');
  }
} finally { c.close(); }
