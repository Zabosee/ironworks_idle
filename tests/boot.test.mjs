// Boot-Rauchtest ohne Browser: importiert alle UI-Module samt js/main.js gegen einen minimalen DOM-Ersatz und
// führt alle Render-Pfade (alle Tabs, Default- und "reicher" Zustand) aus. Fängt fehlende Importe / tote
// Referenzen (z. B. "setTabHidden is not defined"), die reine Logik-Tests nicht sehen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { installStorage, state, reset, setEra } from './helpers.mjs';

installStorage();

// ---------- minimaler DOM-Ersatz ----------
class ClassList {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach(x => this.s.add(x)); } remove(...c) { c.forEach(x => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const on = f ?? !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }
}
class FakeNode {}
class El extends FakeNode {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.dataset = {};
    this.classList = new ClassList(); this.style = { cssText: '', setProperty() {} }; this.listeners = {};
    this.hidden = false; this.disabled = false; this.value = ''; this.checked = false; this.textContent = ''; this.className = '';
    this.clientWidth = 800; this.clientHeight = 600; this.scrollTop = 0; this.scrollLeft = 0; this.tabIndex = 0;
  }
  get parentElement() { return this.parentNode ?? (this._pe ??= new El('div')); }
  get offsetWidth() { return 800; } get offsetHeight() { return 600; }
  get firstChild() { return this.children[0] ?? null; }
  get lastChild() { return this.children.at(-1) ?? null; }
  get childNodes() { return this.children; }
  get nextSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) + 1] ?? null : null; }
  get previousElementSibling() { const p = this.parentNode; return p ? p.children[p.children.indexOf(this) - 1] ?? null : null; }
  append(...k) { for (const x of k) { if (typeof x === 'string') { const t = new El('#text'); t.textContent = x; this.#add(t); } else this.#add(x); } }
  #add(x) { x.remove?.(); x.parentNode = this; this.children.push(x); }
  appendChild(x) { this.#add(x); return x; }
  prepend(x) { this.#add(x); this.children.unshift(this.children.pop()); }
  insertBefore(x, ref) { this.#add(x); if (ref) { this.children.pop(); this.children.splice(this.children.indexOf(ref), 0, x); } return x; }
  replaceChildren(...k) { this.children = []; this.append(...k); }
  removeChild(x) { x.remove(); return x; }
  remove() { if (this.parentNode) { const a = this.parentNode.children; a.splice(a.indexOf(this), 1); this.parentNode = null; } }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  removeEventListener() {}
  dispatchEvent() { return true; }
  click() { for (const f of this.listeners.click ?? []) f({ target: this, preventDefault() {}, stopPropagation() {} }); }
  focus() {} blur() {} scrollIntoView() {} setPointerCapture() {} showModal() {} close() {} select() {} animate() { return { cancel() {}, finished: Promise.resolve() }; }
  contains(x) { for (let n = x; n; n = n.parentNode) if (n === this) return true; return false; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }; }
  getContext() { return new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } }); }
  getBBox() { return { x: 0, y: 0, width: 10, height: 10 }; }
  getTotalLength() { return 100; }
  querySelector(sel) { return q(this, sel)[0] ?? stub(sel); }
  querySelectorAll(sel) { return q(this, sel); }
  getElementsByTagName() { return []; }
}
const byId = new Map(), stubs = new Map();
const stub = sel => { if (!stubs.has(sel)) stubs.set(sel, new El('div')); return stubs.get(sel); };
function walk(n, f) { for (const c of n.children) { f(c); walk(c, f); } }
function q(root, sel) {
  const out = [];
  const m = /^#([\w-]+)$/.exec(sel);
  if (m) return byId.has(m[1]) ? [byId.get(m[1])] : [];
  const cls = /^\.([\w-]+)$/.exec(sel);
  const dt = /^\[data-tab(?:="([^"]*)")?\]$/.exec(sel);
  walk(root, c => {
    if (cls && c.classList.contains(cls[1])) out.push(c);
    if (dt && 'tab' in c.dataset && (dt[1] === undefined || c.dataset.tab === dt[1])) out.push(c);
  });
  return out;
}
const html = readFileSync('index.html', 'utf8');
for (const [, tag, attrs] of html.matchAll(/<(\w+)([^>]*\sid="[^"]+"[^>]*)>/g)) {
  const e = new El(tag);
  for (const [, k, v] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) { e.setAttribute(k, v); if (k.startsWith('data-')) e.dataset[k.slice(5)] = v; }
  if (/\shidden(\s|$|\/)/.test(attrs.replace(/"[^"]*"/g, '""'))) e.hidden = true;
  e.id = e.attrs.id; byId.set(e.id, e);
}
const body = new El('body'), docEl = new El('html');
const docListeners = {};
globalThis.Node = FakeNode;
globalThis.document = {
  body, documentElement: docEl, hidden: false, activeElement: null,
  getElementById: id => byId.get(id) ?? null,
  querySelector: sel => q(body, sel)[0] ?? (/^#/.test(sel) ? null : stub(sel)),
  querySelectorAll: sel => (/^#/.test(sel) ? q(body, sel) : [...q(body, sel)]),
  createElement: t => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: t => { const e = new El('#text'); e.textContent = String(t); return e; },
  createDocumentFragment: () => new El('#frag'),
  addEventListener: (t, f) => { (docListeners[t] ??= []).push(f); }, removeEventListener() {},
};
// Alle per index.html bekannten Elemente hängen am body, damit tabs/querySelector sie finden
for (const e of byId.values()) body.append(e);
const mq = { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} };
Object.assign(globalThis, { addEventListener() {}, matchMedia: () => mq, devicePixelRatio: 1, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  getComputedStyle: () => ({ getPropertyValue: () => '' }), HTMLDialogElement: undefined, ResizeObserver: class { observe() {} disconnect() {} },
  location: { hostname: 'localhost', reload() {} }, sessionStorage: globalThis.localStorage, performance: globalThis.performance });
globalThis.window = globalThis;
globalThis.setInterval = () => 0;   // main.js: Heartbeat, kein offener Timer
try { Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true }); } catch { /* vorhanden */ }

// ---------- Tests ----------
const errors = [];
const origErr = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ')); };

const R = await import('../js/ui/render.js');
const T = await import('../js/ui/tabs.js');
const { initSettings } = await import('../js/ui/settings.js');
const { initWorks } = await import('../js/ui/works.js');
const { initToasts } = await import('../js/ui/toast.js');
const { initCollect, initGoldenUI, initFlash } = await import('../js/ui/effects.js');
const Rm = await import('../js/ui/research-map.js');
const { applyStaticTexts } = await import('../js/ui/static-i18n.js');
const { RESEARCH } = await import('../js/data/research.js');
const { RES_IDS } = await import('../js/data/resources.js');

describe('Boot-Rauchtest (DOM-Ersatz)', () => {
  test('alle UI-Module lassen sich importieren', async () => {
    for (const f of readdirSync('js/ui').filter(f => f.endsWith('.js'))) {
      const m = await import('../js/ui/' + f); assert.ok(Object.keys(m).length > 0, f);
    }
  });

  test('Initialisierung wie in main.js boot()', () => {
    reset();
    initToasts(document.getElementById('toasts'));
    applyStaticTexts();
    R.initRender(); initWorks();
    T.initTabs(document.getElementById('tabs'));
    initSettings();
    initCollect(document.getElementById('collect'), document.getElementById('click-zone'), R.refresh);
    initGoldenUI(document.getElementById('goldenLayer')); initFlash();
    R.refresh();
    assert.deepEqual(errors, []);
  });

  test('Default-Zustand: refresh/frame ohne Fehler, Industrie-Tab bleibt versteckt', () => {
    reset();
    for (let i = 0; i < 3; i++) { R.refresh(); R.frame({ rates: {}, gained: {} }, 0.1); }
    assert.equal(document.getElementById('tabbtn-industry').hidden, true);
  });

  test('Reicher Zustand (Neuguss, alle Ressourcen, alle Forschungen): alle Tabs rendern, Industrie-Tab erscheint', () => {
    reset();
    setEra(2);
    state.prestige.count = 3;
    for (const k of RES_IDS) state.res[k] = 1e12;
    for (const r of RESEARCH) state.research[r.id] = 1;
    const names = [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab);
    assert.ok(names.length >= 5, 'Tab-Buttons gefunden');
    for (const n of names) {
      T.setTabHidden?.(n, false);
      document.getElementById('tabbtn-' + n)?.click();
      for (let i = 0; i < 2; i++) { R.refresh(); R.frame({ rates: {}, gained: {} }, 0.1); }
    }
    assert.equal(document.getElementById('tabbtn-industry').hidden, false);
    assert.deepEqual(errors, []);
  });

  test('Rückkehr in den Default-Zustand blendet den Industrie-Tab wieder aus', () => {
    reset(); R.refresh();
    assert.equal(document.getElementById('tabbtn-industry').hidden, true);
  });

  test('Forschungskarte: Zustände und Panel aktualisieren', () => {
    reset(); Rm.updateNodeStates(); Rm.updateResearchPanel();
    assert.deepEqual(errors, []);
  });

  test('main.js bootet ohne Boot-Fehler', async () => {
    reset();
    await import('../js/main.js');
    assert.equal(document.getElementById('boot-error').hidden, true, document.getElementById('boot-error').textContent);
    assert.ok(window.__eisenwerk, 'Debug-Hook / Boot-Marker fehlt');
    assert.deepEqual(errors, []);
  });
});
describe('Bestätigungsdialog und Import-Vorabprüfung', () => {
  test('confirmDialog: nur EIN Dialog gleichzeitig, weitere Aufrufe liefern false', async () => {
    class FakeDialog extends El { constructor() { super('dialog'); this.returnValue = ''; } showModal() { this.open = true; } }
    const origCreate = document.createElement;
    document.createElement = t => (t === 'dialog' ? new FakeDialog() : new El(t));
    globalThis.HTMLDialogElement = FakeDialog;
    try {
      const { confirmDialog } = await import('../js/ui/dom.js');
      const count = () => body.children.filter(c => c.tagName === 'DIALOG').length;
      const p1 = confirmDialog({ title: 'a', message: 'b' });
      const p2 = confirmDialog({ title: 'a', message: 'b' });
      const p3 = confirmDialog({ title: 'a', message: 'b' });
      assert.equal(count(), 1);
      const dlg = body.children.find(c => c.tagName === 'DIALOG');
      dlg.returnValue = 'ok'; for (const f of dlg.listeners.close) f();
      assert.deepEqual(await Promise.all([p1, p2, p3]), [true, false, false]);
      assert.equal(count(), 0);
      const p4 = confirmDialog({ title: 'a', message: 'b' });   // danach wieder möglich
      assert.equal(count(), 1);
      const d2 = body.children.find(c => c.tagName === 'DIALOG'); for (const f of d2.listeners.close) f();
      assert.equal(await p4, false);
    } finally { document.createElement = origCreate; globalThis.HTMLDialogElement = undefined; }
  });

  test('Import mit ungültiger Eingabe: Fehlermeldung im Status, kein Dialog', async () => {
    reset();
    let btn; walk(body, c => { if (c.tagName === 'BUTTON' && c.textContent === 'Importieren') btn = c; });
    assert.ok(btn, 'Importieren-Button');
    const before = body.children.filter(c => c.tagName === 'DIALOG').length;
    btn.click(); await Promise.resolve();
    assert.equal(body.children.filter(c => c.tagName === 'DIALOG').length, before);
    assert.deepEqual(errors, []);
  });
});
describe('Konzern-UI (Reiter, Sperrzustand, Gründen mit Bestätigung)', () => {
  const tab = () => document.getElementById('tabbtn-corp');
  const parts = () => { const root = document.getElementById('corp-root'); return { lock: root.children.at(-2), main: root.children.at(-1) }; };   // main.js baut die UI ein zweites Mal auf
  const tick = () => { R.refresh(); R.frame({ rates: {}, gained: {} }, 0.1); };
  class FakeDialog extends El { constructor() { super('dialog'); this.returnValue = ''; } showModal() { this.open = true; } }
  const found = () => { let b = null; walk(body, c => { if (c.id === 'corp-found') b = c; }); return b; };
  const goto = name => { const btn = document.getElementById('tabbtn-' + name); for (const f of document.getElementById('tabs').listeners.click ?? []) f({ target: { closest: () => btn } }); };

  test('Reiter: versteckt bis Neuguss 25, danach gesperrt sichtbar (aria-disabled), ab 100 nutzbar', () => {
    reset(); tick();
    assert.equal(tab().hidden, true);
    state.prestige.count = 24; tick();
    assert.equal(tab().hidden, true);
    state.prestige.count = 25; tick();
    assert.equal(tab().hidden, false);
    assert.equal(tab().getAttribute('aria-disabled'), 'true');
    assert.equal(document.getElementById('corp-lock').hasAttribute('hidden'), false);
    assert.match(document.getElementById('corp-tab-status').textContent, /25/);
    state.prestige.count = 100; tick();
    assert.equal(tab().getAttribute('aria-disabled'), 'false');
    assert.equal(document.getElementById('corp-lock').hasAttribute('hidden'), true);
    reset(); tick();
  });

  test('Sperrzustand zeigt nur die Box mit Fortschritt, freigeschaltet den vollen Aufbau', () => {
    reset(); state.prestige.count = 42; goto('corp'); tick();
    assert.equal(parts().lock.hidden, false); assert.equal(parts().main.hidden, true);
    state.prestige.count = 100; tick();
    assert.equal(parts().lock.hidden, true); assert.equal(parts().main.hidden, false);
    assert.equal(found().getAttribute('aria-disabled'), 'true');   // noch keine Patente
    state.prestige.total = 104000; state.stats.corpRunTime = 10800; tick();   // raw 8, Zeitdeckel 2
    assert.equal(found().getAttribute('aria-disabled'), 'false');
    assert.deepEqual(errors, []);
  });

  test('Deckel-Anzeige: capped zeigt Hinweis und Zeit bis zum nächsten Patent, sonst nicht', () => {
    const texts = () => { const o = []; walk(parts().main, c => { if (c.children.length === 0 && c.textContent && !c.hidden) o.push(c.textContent); }); return o.join('|'); };
    reset(); state.prestige.count = 100; state.prestige.total = 104000; state.stats.corpRunTime = 10800; goto('corp'); tick();   // raw 8, Deckel 2
    const txt = texts();
    assert.match(txt, /Gedeckelt: höchstens 2 Patente nach 3 h Konzernlauf \(ohne Deckel 8\)/);
    assert.match(txt, /Nächstes Patent durch Zeit in 1 h 24 min/);   // ceil(3/0,68*3600) = 15883 s, minus 10800 s
    assert.match(txt, /0,68 Patente je Stunde/);
    state.prestige.total = 3000; tick();   // raw 1, Deckel 2: nicht gedeckelt
    const txt2 = texts();
    assert.doesNotMatch(txt2, /Gedeckelt|durch Zeit/);
    assert.match(txt2, /Nächste Patente bei/);
    assert.deepEqual(errors, []);
  });

  test('Sperrtext nennt die echte Zahl Konzernforschungen; Vorschau im Singular bei 1 Patent', () => {
    const texts = () => { const o = []; walk(parts().main, c => { if (c.children.length === 0 && c.textContent) o.push(c.textContent); }); return o.join('|'); };
    const lockTxt = () => { const o = []; walk(parts().lock, c => { if (c.children.length === 0 && c.textContent) o.push(c.textContent); }); return o.join('|'); };
    reset(); state.prestige.count = 25; tick();
    assert.match(lockTxt(), new RegExp('Konzernforschung: ' + RESEARCH.filter(r => r.corp).length + ' dauerhafte Forschungen'));
    assert.doesNotMatch(lockTxt(), /: 36 /);
    state.prestige.count = 100; state.prestige.total = 3000; state.stats.corpRunTime = 6000; tick();   // genau 1 Patent
    assert.match(texts(), /Du erhältst \+1 Patent(\||$)/);
    state.prestige.total = 104000; state.stats.corpRunTime = 10800; tick();   // 2 Patente
    assert.match(texts(), /Du erhältst \+2 Patente/);
  });

  test('Deckel aktiv, 0 Patente: Hinweis, Erstes Patent durch Zeit, Minuten statt Sekunden', () => {
    const texts = () => { const o = []; walk(parts().main, c => { if (c.children.length === 0 && c.textContent && !c.hidden) o.push(c.textContent); }); return o.join('|'); };
    reset(); state.prestige.count = 100; state.prestige.total = 3000; state.stats.corpRunTime = 0; goto('corp'); tick();   // raw 1, Deckel 0
    const txt = texts();
    assert.match(txt, /Noch keine Patente/);
    assert.match(txt, /Gedeckelt: höchstens 0 Patente nach 0 s Konzernlauf \(ohne Deckel 1\)/);
    assert.match(txt, /Erstes Patent durch Zeit in 1 h 28 min/);   // ceil(1/0,68*3600) = 5295 s
    assert.equal(found().getAttribute('aria-disabled'), 'true');
    state.prestige.total = 104000; state.stats.corpRunTime = 10802; tick();   // 2 Patente gedeckelt: Sekunden abgerundet
    assert.match(texts(), /nach 3 h Konzernlauf/);
    assert.deepEqual(errors, []);
  });

  test('foundCorp ruft doCorp erst nach Bestätigung auf', async () => {
    reset(); state.prestige.count = 100; state.prestige.total = 104000; state.stats.corpRunTime = 10800;   // Deckel 2
    const { foundCorp, foundPreview } = await import('../js/ui/corp.js');
    assert.equal(foundPreview().gain, 2);
    let asked = 0;
    assert.equal(await foundCorp(async () => { asked++; return false; }), false);
    assert.equal(asked, 1); assert.equal(state.corp.count, 0); assert.equal(state.prestige.total, 104000);
    assert.equal(await foundCorp(async pv => { asked++; assert.equal(pv.gain, 2); return true; }), true);
    assert.equal(state.corp.count, 1); assert.equal(state.corp.points, 2); assert.equal(state.prestige.total, 0);
    asked = 0;   // ohne Patente: gar keine Rückfrage
    assert.equal(await foundCorp(async () => { asked++; return true; }), false); assert.equal(asked, 0);
  });

  test('Gründen-Knopf: Dialog, Abbrechen ändert nichts, Bestätigen gründet', async () => {
    reset(); state.prestige.count = 100; state.prestige.total = 104000; state.stats.corpRunTime = 10800; goto('corp'); tick();
    const origCreate = document.createElement;
    document.createElement = t => (t === 'dialog' ? new FakeDialog() : new El(t));
    globalThis.HTMLDialogElement = FakeDialog;
    try {
      const dlgs = () => body.children.filter(c => c.tagName === 'DIALOG');
      found().click();
      assert.equal(dlgs().length, 1);
      let dlg = dlgs()[0]; dlg.returnValue = 'cancel'; for (const f of dlg.listeners.close) f();
      for (let i = 0; i < 5; i++) await Promise.resolve();
      assert.equal(state.corp.count, 0); assert.equal(dlgs().length, 0);
      found().click();
      dlg = dlgs()[0]; dlg.returnValue = 'ok'; for (const f of dlg.listeners.close) f();
      for (let i = 0; i < 5; i++) await Promise.resolve();
      assert.equal(state.corp.count, 1);
    } finally { document.createElement = origCreate; globalThis.HTMLDialogElement = undefined; }
    assert.deepEqual(errors, []);
  });

  test('corpThreshold ist die Umkehrung des Wurzelwerts (raw, ohne Zeitdeckel) von corpGain (auch mit Lizenzgebühren)', async () => {
    reset();
    const { corpThreshold } = await import('../js/ui/corp.js');
    const { corpGainParts } = await import('../js/core/formulas.js');
    for (const lvl of [0, 2, 4]) {
      state.corp.shop.c_gain = lvl;
      for (const g of [1, 2, 7, 30]) { const th = corpThreshold(g); assert.ok(corpGainParts(th).raw >= g && corpGainParts(th - 1).raw < g, 'lvl ' + lvl + ' gain ' + g); }
    }
    assert.equal(corpThreshold(0), 0);
  });

  test('Voller Konzernzustand rendert alle Reiter ohne Fehler (Shop, Auto-Neuguss, Zeitalter 8, Chronik)', () => {
    reset(); setEra(8);
    state.prestige.count = 150; state.prestige.total = 70000;
    state.corp.points = 12; state.corp.total = 160; state.corp.count = 3; state.corp.shop = { c_autocast: 1, c_heir: 2, c_eff: 1 };
    state.corp.history = [{ gain: 5, gussformen: 170000, time: 4000, at: Date.now() }, { gain: 7, gussformen: 240000, time: 7000, at: Date.now() }];
    state.autoCast.on = true;
    for (const k of RES_IDS) state.res[k] = 1e12;
    for (const r of RESEARCH) state.research[r.id] = 1;
    for (const n of [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab)) { document.getElementById('tabbtn-' + n)?.click(); tick(); tick(); }
    assert.equal(tab().hidden, false);
    assert.deepEqual(errors, []);
    reset(); tick();
  });
});
process.on('exit', () => { console.error = origErr; });

describe('UI-Befunde Abnahme', () => {
  test('Werk-Lanes werden bei Konzerngründung zurückgesetzt (Stufe 0, Leer-Hinweis sichtbar)', async () => {
    const { emit } = await import('../js/core/events.js');
    const C = await import('../js/systems/corp.js');
    const { CORP } = await import('../js/data/corp.js');
    reset();
    state.gens.mine = 400; emit('loaded');
    const empty = document.getElementById('works-empty');
    assert.equal(empty.hidden, true);
    state.prestige.count = CORP.unlockCount; state.prestige.total = CORP.divisor * 2; state.stats.corpRunTime = 1e5;
    assert.ok(C.doCorp());
    assert.equal(state.gens.mine, 0);
    assert.equal(empty.hidden, false);
  });

  test('Zielleiste: Füll-Element trägt die Klasse bar-fill', async () => {
    const { buildGoalBar } = await import('../js/ui/goals.js');
    const g = buildGoalBar();
    const bar = g.el.children[1];
    assert.match(bar.children[0].className || bar.children[0].getAttribute('class'), /\bbar-fill\b/);
  });

  test('fmtEta: ab mehr als einem Jahr "> 1 Jahr"', async () => {
    const { fmtEta } = await import('../js/core/format.js');
    assert.equal(fmtEta(3600), '1 h');
    assert.equal(fmtEta(366 * 86400), '> 1 Jahr');
    assert.equal(fmtEta(366 * 86400, 'ca. {time}'), '> 1 Jahr');
    assert.equal(fmtEta(3600, 'ca. {time}'), 'ca. 1 h');
  });
});
