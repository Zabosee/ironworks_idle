#!/usr/bin/env node
// Live-E2E-Szenario für das sichtbare Chrome-Fenster (CDP, keine Abhängigkeiten).
//
//   node tools/e2e.mjs                 alles ausführen, langsam (Pausen, damit man zusehen kann)
//   node tools/e2e.mjs --fast          ohne Pausen
//   node tools/e2e.mjs --only=c,d,e    nur diese Szenarien (Buchstaben a..m); a (Neustart) läuft immer zuerst
//   node tools/e2e.mjs --strict        WARN (visuelle Heuristiken) zählen als Fehler
//   node tools/e2e.mjs --keep          am Ende NICHT auf einen frischen Spielstand zurücksetzen
//
// Umgebung: CDP_PORT (9222), GAME_URL (http://localhost:8080), E2E_PAUSE_MS (Pause je Schritt, Standard 700),
//           E2E_DIR (Ordner für Sicherung/Screenshots/Ergebnis, Standard: Scratchpad der Sitzung bzw. ./tools/.e2e-out)
//
// Ablauf: aktuellen localStorage sichern -> frischer Spielstand (Autosave aus, localStorage leeren, Reload) -> Szenarien a..m.
// Exit-Code 1 bei mindestens einem FAIL. Der gesicherte Spielstand wird NICHT zurückgespielt.
// Ist document.hidden true (Fenster nicht sichtbar), pausiert requestAnimationFrame; dann wird die Spielzeit über
// __eisenwerk.timers.tick simuliert (im Bericht vermerkt).

import fs from 'node:fs';
import path from 'node:path';
import { connect, evaluate, say, sleep } from './cdp.mjs';

const argv = process.argv.slice(2);
const FAST = argv.includes('--fast'), STRICT = argv.includes('--strict'), KEEP = argv.includes('--keep');
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const PAUSE = FAST ? 0 : Number(process.env.E2E_PAUSE_MS ?? 700);
const OUT = process.env.E2E_DIR || 'C:/Users/lukas/AppData/Local/Temp/claude/C--Users-lukas-Desktop-GitHub-idle-game/5eb4609e-9cd7-42a5-855b-1106d1bb663b/scratchpad';
fs.mkdirSync(OUT, { recursive: true });

const c = await connect();
const J = JSON.stringify;
const ev = expr => evaluate(c, expr);
/** Wertet js im Spielkontext aus; state, F, timers, buy stehen als Variablen zur Verfügung. */
const G = js => ev(`(() => { const { state, F, timers, buy } = window.__eisenwerk; return (${js}); })()`);

// ---------- Ereignisse / Fehlersammlung ----------
const errs = [];
const loadWaiters = [];
c.on(m => {
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(m.params.type)) errs.push(m.params.type.toUpperCase() + ' ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) errs.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  if (m.method === 'Page.loadEventFired') loadWaiters.splice(0).forEach(f => f());
});
await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Page.enable');

// ---------- Ergebnisse ----------
const results = [];   // { scenario, name, status: PASS|FAIL|WARN, msg }
const notes = [];     // Beobachtungen (z. B. verdeckte Klickziele)
let cur = { id: '?', title: '' };
const C = { g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, b: s => `\x1b[1m${s}\x1b[0m` };

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} != ${b} (Toleranz ${tol})`);

async function step(name, fn, { soft = false } = {}) {
  await say(c, `Test [${cur.id}]: ${name}`);
  let status = 'PASS', msg = '';
  try { const r = await fn(); if (typeof r === 'string') msg = r; }
  catch (e) { status = soft ? 'WARN' : 'FAIL'; msg = e instanceof Error ? e.message : String(e); }
  results.push({ scenario: cur.id, name, status, msg });
  const tag = status === 'PASS' ? C.g('PASS') : status === 'WARN' ? C.y('WARN') : C.r('FAIL');
  console.log(`  ${tag}  ${name}${msg ? '  -- ' + msg : ''}`);
  await sleep(PAUSE);
}

async function scenario(id, title, fn) {
  if (ONLY.length && id !== 'a' && !ONLY.includes(id)) return;
  cur = { id, title };
  console.log('\n' + C.b(`(${id}) ${title}`));
  await say(c, `Szenario (${id}): ${title}`);
  await sleep(PAUSE);
  try { await fn(); }
  catch (e) { results.push({ scenario: id, name: 'Szenario abgebrochen', status: 'FAIL', msg: e.message }); console.log(`  ${C.r('FAIL')}  Szenario abgebrochen -- ${e.message}`); }
}

// ---------- Browser-Helfer ----------
async function waitFor(fn, timeout = 8000, what = 'Bedingung') {
  const t0 = Date.now();
  for (;;) {
    let v; try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`Zeitüberschreitung: ${what}`);
    await sleep(100);
  }
}
const bootDone = () => ev(`!!window.__eisenwerk && typeof window.__eisenwerk === 'object' && !!document.querySelector('#meters .meter')`);
async function reload() {
  const loaded = new Promise(r => loadWaiters.push(r));
  await c.send('Page.reload', { ignoreCache: true });
  await Promise.race([loaded, sleep(10000)]);
  await waitFor(bootDone, 10000, 'Spiel gestartet');
  await sleep(300);
}
const isVisible = sel => ev(`(() => { const e = document.querySelector(${J(sel)}); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; })()`);
let HIDDEN = false;
/** Wartet sec Sekunden Spielzeit: echt, bzw. simuliert wenn das Fenster verborgen ist (rAF pausiert). */
async function wait(sec) {
  if (HIDDEN) { await G(`timers.tick(${sec})`); await G('window.__eisenwerk.refresh()'); await sleep(150); }
  else await sleep(sec * 1000);
}
/** Explizites Vorspulen der Timer (nur wo echtes Warten unverhältnismäßig wäre; wird im Bericht ausgewiesen). */
const fastForwards = [];
async function ff(sec, why) { fastForwards.push(`${sec}s: ${why}`); await G(`timers.tick(${sec})`); await G('window.__eisenwerk.refresh()'); await sleep(250); }
const seed = (res) => G(`(Object.assign(state.res, ${J(res)}), window.__eisenwerk.refresh(), true)`);
const BIG = { ore: 1e8, steel: 1e7, titan: 1e6 };

async function realClick(sel, n = 1) {
  for (let i = 0; i < n; i++) {
    const pre = await ev(`(() => { const el = document.querySelector(${J(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return true; })()`);
    if (!pre) throw new Error('Element nicht gefunden: ' + sel);
    await sleep(60);
    const info = await ev(`(() => { const el = document.querySelector(${J(sel)}); const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const top = document.elementFromPoint(x, y); const hit = !!top && (el === top || el.contains(top));
      const o = el.style.outline; el.style.outline = '3px solid #ff8a1f'; setTimeout(() => el.style.outline = o, 350);
      return { x, y, w: r.width, h: r.height, hit, by: top ? top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (typeof top.className === 'string' && top.className ? '.' + top.className.split(' ')[0] : '') : 'nichts' }; })()`);
    if (!(info.w > 0 && info.h > 0)) throw new Error('Element nicht sichtbar (Größe 0): ' + sel);
    if (!info.hit) {
      notes.push(`Klickziel ${sel} wird von ${info.by} verdeckt (Szenario ${cur.id}); Fallback el.click()`);
      await ev(`document.querySelector(${J(sel)}).click()`);
      continue;
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: info.x, y: info.y });
    for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: info.x, y: info.y, button: 'left', clickCount: 1 });
    await sleep(n > 1 ? 80 : 120);
  }
}
/** Klickt das Element in root, dessen Text text enthält (markiert es kurz mit data-e2e). */
async function clickText(root, text, tag = 'button') {
  const ok = await ev(`(() => { document.querySelectorAll('[data-e2e]').forEach(e => e.removeAttribute('data-e2e'));
    const el = [...document.querySelectorAll(${J(root + ' ' + tag)})].find(e => e.textContent.includes(${J(text)})); if (!el) return false; el.setAttribute('data-e2e', '1'); return true; })()`);
  if (!ok) throw new Error(`Kein ${tag} mit Text "${text}" in ${root}`);
  await realClick('[data-e2e="1"]');
}
async function tab(name) {
  await realClick(`[data-tab="${name}"]`);
  await sleep(120);
  assert(await ev(`document.querySelector('[data-tab="${name}"]').getAttribute('aria-selected') === 'true'`), `Tab ${name} nicht aktiv`);
}
const card = (kind, id) => `.card[data-kind="${kind}"][data-id="${id}"]`;
const shotFiles = [];
async function shot(name) {
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  const f = path.join(OUT, `e2e-${name}.png`).replace(/\\/g, '/');
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  shotFiles.push(f);
  return f;
}
const toastTexts = () => ev(`[...document.querySelectorAll('#toasts .toast')].map(t => t.textContent)`);
async function expectToast(part, timeout = 3000) {
  let all = [];
  await waitFor(async () => { all = await toastTexts(); return all.some(t => t.includes(part)); }, timeout, `Toast "${part}" (vorhanden: ${J(all)})`);
}
async function noNewErrors(from) {
  const e = errs.slice(from);
  assert(e.length === 0, 'Konsolenfehler: ' + e.join(' | '));
}
const lanesInfo = () => ev(`[...document.querySelectorAll('.lane')].filter(l => !l.hidden).map(l => ({ gen: l.dataset.gen, slots: l.querySelectorAll('.slot:not([hidden])').length, cls: l.className, rank: l.querySelector('.lane-rank')?.textContent, count: l.querySelector('.lane-count:not([hidden])')?.textContent || '' }))`);
const lane = async id => (await lanesInfo()).find(l => l.gen === id);

// ---------- Sicherung + frischer Start ----------
console.log(C.b('Eisenwerk Idle – Live-E2E'));
HIDDEN = await ev('document.hidden');
console.log(HIDDEN ? C.y('document.hidden = true -> Spielzeit wird über timers.tick simuliert') : 'Fenster sichtbar, Spielzeit läuft in Echtzeit');
await say(c, 'E2E-Lauf startet: Spielstand wird gesichert');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(OUT, `e2e-backup-localStorage-${stamp}.json`).replace(/\\/g, '/');
const dump = await ev(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(o); })()`);
fs.writeFileSync(backupFile, dump);
console.log(`Sicherung: ${backupFile} (${dump.length} Zeichen)`);
// Autosave im laufenden Spiel aus, sonst schreibt pagehide den alten Stand sofort zurück
await ev(`(() => { try { window.__eisenwerk.state.settings.autosave = false; } catch {} localStorage.clear(); return true; })()`);
const errStart = errs.length;
await reload();

// =====================================================================================
await scenario('a', 'Neustart ohne Konsolenfehler, Werk-Tab ist Standard', async () => {
  await step('Frischer Spielstand geladen (Erz 0, keine Generatoren, kein Fehlerbanner)', async () => {
    const s = await G(`({ ore: state.res.ore, gens: Object.values(state.gens).reduce((a, b) => a + b, 0), research: Object.keys(state.research).length, boot: document.getElementById('boot-error').hidden })`);
    assert(s.ore < 5 && s.gens === 0 && s.research === 0, 'Spielstand nicht frisch: ' + J(s));
    assert(s.boot, 'Boot-Fehlerbanner sichtbar');
  });
  await step('Keine Konsolenfehler/Exceptions/Warnungen nach Neustart (2,5 s beobachtet)', async () => {
    await sleep(2500);
    await noNewErrors(errStart);
  });
  await step('Werk-Tab ist Standard (aria-selected, Panel sichtbar, übrige Panels verborgen)', async () => {
    const r = await ev(`(() => { const tabs = [...document.querySelectorAll('[data-tab]')]; return { n: tabs.length, sel: tabs.filter(t => t.getAttribute('aria-selected') === 'true').map(t => t.dataset.tab),
      vis: [...document.querySelectorAll('section.panel')].filter(p => !p.hidden).map(p => p.id) }; })()`);
    assert(r.n === 8, 'Tab-Anzahl ' + r.n);
    assert(r.sel.length === 1 && r.sel[0] === 'works', 'Aktiver Tab: ' + r.sel);
    assert(r.vis.length === 1 && r.vis[0] === 'tab-works', 'Sichtbare Panels: ' + r.vis);
  });
  await step('Leere Werkhalle: keine gebauten Bilder (nur Spuren "Noch nicht gebaut")', async () => {
    const l = await lanesInfo();
    assert(l.every(x => x.slots === 0), 'Gebaute Slots vorhanden: ' + J(l));
  });
  await step('Hinweistext #works-empty ("Kaufe deinen ersten Generator ...") ist bei leerem Werk sichtbar', async () => {
    assert(await isVisible('#works-empty'), '#works-empty nie sichtbar: updateLane zeigt Spuren ungebauter, aber freigeschalteter Generatoren (mine/drill/smelter) -> any=true');
  }, { soft: true });
  await step('Debug-Hook __eisenwerk vorhanden', async () => assert(await G('typeof F.rates === "function" && typeof timers.tick === "function"'), 'Hook unvollständig'));
  await step('Tab-Leiste passt vollständig ins Fenster (kein Überlauf rechts)', async () => {
    const r = await ev(`(() => { const nav = document.getElementById('tabs'); const iw = innerWidth; const bad = [...nav.querySelectorAll('.tab')].filter(t => { const b = t.getBoundingClientRect(); return b.right > iw + 1 || b.left < -1; }).map(t => t.dataset.tab);
      return { over: nav.scrollWidth - nav.clientWidth, iw, bad, navRight: Math.round(nav.getBoundingClientRect().right) }; })()`);
    assert(r.over <= 1 && r.bad.length === 0, `Tab-Leiste läuft über: scrollWidth-clientWidth=${r.over}px, außerhalb: ${r.bad.join(',') || '-'} (Fenster ${r.iw}px)`);
  }, { soft: true });
  await shot('a-start');
});

// =====================================================================================
await scenario('b', 'Erz sammeln per Klick', async () => {
  await step('5 echte Klicks auf "Erz sammeln" erhöhen Erz und Klickzähler', async () => {
    const before = await G('({ ore: state.res.ore, clicks: state.stats.clicks, click: F.rates().click })');
    await realClick('#collect', 5);
    const after = await G('({ ore: state.res.ore, clicks: state.stats.clicks })');
    assert(after.clicks - before.clicks === 5, `Klickzähler +${after.clicks - before.clicks}, erwartet +5`);
    assert(after.ore - before.ore >= 5 * before.click - 1e-6, `Erz +${after.ore - before.ore}, erwartet >= ${5 * before.click}`);
  });
  await step('Sidebar-Anzeige (Erz-Meter) zeigt die gestiegene Zahl', async () => {
    const txt = await ev(`document.querySelector('.meter .amt').textContent`);
    const ore = await G('state.res.ore');
    assert(parseFloat(txt.replace(',', '.')) >= 5 - 1e-9 || ore >= 5, `Meter zeigt "${txt}" bei Erz ${ore}`);
    const cv = await ev(`document.getElementById('clickVal').textContent`);
    assert(/Erz pro Klick/.test(cv), 'Klickwert-Text: ' + cv);
  });
  await step('Klick erzeugt schwebende +Zahl in der Klickzone', async () => {
    await realClick('#collect');
    const n = await ev(`document.querySelectorAll('#click-zone .particle').length`);
    assert(n > 0, 'Kein .particle in #click-zone');
  });
});

// =====================================================================================
await scenario('c', 'Generator kaufen, Kaufmenge nur im Generatoren-Tab', async () => {
  await seed({ ore: 1e6, steel: 1e4, titan: 1e3 });
  await step('Kaufmenge ×1/×10/×100/Max im Generatoren-Tab sichtbar (×1 gewählt)', async () => {
    await tab('gens');
    assert(await isVisible('#buyamount'), '#buyamount nicht sichtbar');
    const r = await ev(`[...document.querySelectorAll('#buyamount [data-amount]')].map(b => b.dataset.amount + ':' + b.getAttribute('aria-checked') + ':' + (b.getClientRects().length > 0))`);
    assert(r.join() === '1:true:true,10:false:true,100:false:true,max:false:true', J(r));
  });
  await step('Kaufmenge in allen anderen Tabs nicht sichtbar', async () => {
    const bad = [];
    for (const t of ['works', 'upgrades', 'research', 'prestige', 'achievements', 'stats', 'settings']) {
      await tab(t);
      if (await isVisible('#buyamount') || await isVisible('.gens-toolbar')) bad.push(t);
    }
    assert(bad.length === 0, 'Kaufmenge sichtbar in: ' + bad.join(','));
  });
  await step('Eisenmine ×1 kaufen (echter Klick): Stufe +1, Kosten abgezogen', async () => {
    await tab('gens');
    const plan = await G(`F.bulkPlan('gen', 'mine', 1)`);
    const before = await G('({ ore: state.res.ore, lvl: state.gens.mine })');
    await realClick(card('gen', 'mine'));
    const after = await G('({ ore: state.res.ore, lvl: state.gens.mine })');
    assert(after.lvl === before.lvl + 1, `Stufe ${before.lvl} -> ${after.lvl}`);
    const spent = before.ore - after.ore;
    assert(spent >= plan.cost.ore - 6 && spent <= plan.cost.ore + 1e-6, `Kosten ${spent}, erwartet ${plan.cost.ore}`);
  });
  await step('×10 wählen und kaufen: genau +10 Stufen', async () => {
    await realClick('#buyamount [data-amount="10"]');
    assert(await ev(`document.querySelector('#buyamount [data-amount="10"]').getAttribute('aria-checked') === 'true'`), '×10 nicht markiert');
    const before = await G('state.gens.mine');
    await realClick(card('gen', 'mine'));
    near(await G('state.gens.mine') - before, 10, 0, 'Stufenzuwachs bei ×10');
  });
  await step('Max wählen und kaufen: Menge entspricht dem Kaufplan', async () => {
    await realClick('#buyamount [data-amount="max"]');
    const plan = await G(`F.bulkPlan('gen', 'mine', 'max')`);
    assert(plan.count > 0, 'Kaufplan Max leer');
    const before = await G('state.gens.mine');
    await realClick(card('gen', 'mine'));
    near(await G('state.gens.mine') - before, plan.count, 0, 'Stufenzuwachs bei Max');
  });
  await step('Unbezahlbarer Kauf wird blockiert (aria-disabled, keine Änderung)', async () => {
    await realClick('#buyamount [data-amount="1"]');
    await seed({ ore: 0, steel: 0, titan: 0 });
    await sleep(250);
    const dis = await ev(`document.querySelector(${J(card('gen', 'mine'))}).getAttribute('aria-disabled')`);
    assert(dis === 'true', 'aria-disabled = ' + dis);
    const before = await G('state.gens.mine');
    await realClick(card('gen', 'mine'));
    assert(await G('state.gens.mine') === before, 'Kauf trotz fehlendem Geld');
    await seed({ ore: 1e6, steel: 1e4, titan: 1e3 });
  });
  await shot('c-generatoren');
});

// =====================================================================================
await scenario('d', 'Werk-Tab: Bilder je Stufe, Rangwechsel ab 10 Stufen', async () => {
  await step('Eisenmine Stufe 9: 9 Bilder, Rang Holz (tier-0)', async () => {
    await G('(state.gens.mine = 8, true)');
    await tab('gens'); await realClick('#buyamount [data-amount="1"]');
    await realClick(card('gen', 'mine'));
    await tab('works');
    const l = await lane('mine');
    assert(l, 'Spur mine nicht sichtbar');
    assert(l.slots === 9, `Bilder: ${l.slots}, erwartet 9`);
    assert(/tier-0/.test(l.cls) && l.rank === 'Rang Holz', `Klasse/Rang: ${l.cls} / ${l.rank}`);
  });
  await step('Bilder sind echte, gerenderte SVG-Slots mit Größe > 0', async () => {
    const sizes = await ev(`[...document.querySelectorAll('.lane[data-gen="mine"] .slot:not([hidden]) svg')].map(s => { const b = s.getBoundingClientRect(); return Math.round(b.width) + 'x' + Math.round(b.height); })`);
    assert(sizes.length === 9 && sizes.every(s => !s.startsWith('0x') && !s.endsWith('x0')), J(sizes));
  });
  await step('10. Stufe: Rangwechsel -> Klasse tier-1, "Rang Eisen", 10 Bilder, Toast', async () => {
    await tab('gens');
    await realClick(card('gen', 'mine'));
    await expectToast('Eisenmine: Rang Eisen');
    await tab('works');
    const l = await lane('mine');
    assert(l.slots === 10, `Bilder: ${l.slots}`);
    assert(/tier-1/.test(l.cls) && !/tier-0/.test(l.cls) && l.rank === 'Rang Eisen', `Klasse/Rang: ${l.cls} / ${l.rank}`);
  });
  await step('Über 10 Stufen: max. 10 Bilder + Zähler ×11', async () => {
    await tab('gens'); await realClick(card('gen', 'mine'));
    await tab('works');
    const l = await lane('mine');
    assert(l.slots === 10 && l.count === '×11', `Bilder ${l.slots}, Zähler "${l.count}"`);
  });
  await step('Zweiter Generator (Schmelzofen ×3): eigene Spur mit 3 Bildern', async () => {
    await tab('gens');
    await realClick(card('gen', 'smelter'), 3);
    await tab('works');
    const l = await lane('smelter');
    assert(l && l.slots === 3, 'smelter: ' + J(l));
    const built = (await lanesInfo()).filter(x => x.slots > 0).map(x => x.gen);
    assert(built.length === 2, 'Gebaute Spuren: ' + built);
  });
  await shot('d-werk');
});

// =====================================================================================
await scenario('e', 'Forschung: Labor-Queue, Kolben, Effekt, Abbrechen', async () => {
  await seed({ ore: 1e6, steel: 1000, titan: 100 });
  await tab('research');
  const flask = `${card('research', 'geology')}`;
  const prog = () => ev(`(() => { const f = document.querySelector(${J(flask)}).closest('.flask-card'); return { p: parseFloat(f.style.getPropertyValue('--p') || '0'), now: Number(f.querySelector('[role=progressbar]').getAttribute('aria-valuenow')), txt: f.querySelector('.prog-text').textContent, cls: f.className }; })()`);
  let multBefore;
  await step('Geologie kaufen: Kosten abgezogen, Eintrag in Labor-Queue (Chip läuft)', async () => {
    multBefore = await G(`F.researchMult('ore')`);
    const ore0 = await G('state.res.ore');
    await realClick(flask);
    assert(await G(`state.timers.lab.length === 1 && state.timers.lab[0].id === 'geology'`), 'Nicht in Queue');
    assert(ore0 - await G('state.res.ore') >= 290, 'Kosten nicht abgezogen');
    assert(await G('state.research.geology') === undefined, 'Effekt sofort aktiv (sollte erst nach Ablauf wirken)');
    const chip = await ev(`document.querySelector('#queue-lab .slot-chip.running')?.textContent || ''`);
    assert(/Geologie/.test(chip), 'Chip: ' + chip);
    const title = await ev(`document.querySelector('#queue-lab .queue-title').textContent`);
    assert(/1\/1 aktiv/.test(title), 'Titel: ' + title);
  });
  await step('Kolben füllt sich: --p steigt, Fortschrittsbalken (aria-valuenow) steigt', async () => {
    await wait(1.5);
    const p1 = await prog();
    await wait(1.5);
    const p2 = await prog();
    assert(p1.p > 0 && p2.p > p1.p, `--p ${p1.p} -> ${p2.p}`);
    assert(p2.now > p1.now - 1 && p2.now > 0, `aria-valuenow ${p1.now} -> ${p2.now}`);
    assert(/Restzeit/.test(p2.txt), 'Text: ' + p2.txt);
    assert(/running/.test(p2.cls), 'Klasse running fehlt: ' + p2.cls);
  });
  await shot('e-labor-laufend');
  await step('Nach Ablauf: "Erforscht", Karte done, Toast, Queue leer, Effekt aktiv (+25 % Erz)', async () => {
    await waitFor(() => G('state.research.geology === 1'), 9000, 'Geologie fertig');
    await sleep(300);
    const p = await prog();
    assert(/is-done/.test(p.cls) && p.txt === 'Erforscht', `Klasse/Text: ${p.cls} / ${p.txt}`);
    assert(await G('state.timers.lab.length') === 0, 'Queue nicht leer');
    near(await G(`F.researchMult('ore')`) / multBefore, 1.25, 1e-9, 'Erz-Multiplikator');
    await expectToast('Forschung abgeschlossen: Geologie');
    assert(!(await isVisible('#badge-research')), 'Tab-Badge noch sichtbar');
  });
  await step('Abbrechen wartend: 100 % Erstattung; laufend: 50 % Erstattung (Chip-Buttons)', async () => {
    await seed({ steel: 1000, ore: 1e6 });
    const rate = await G('F.rates().steel');
    const cost = async () => G('state.res.steel');
    const s0 = await cost();
    await realClick(card('research', 'converter'));     // läuft (Stahl 40)
    await realClick(card('research', 'deepmines'));     // wartet (Stahl 60)
    const s1 = await cost();
    near(s0 - s1, 100, rate * 3 + 1, 'Kosten beider Käufe');
    const waitingBtn = await ev(`document.querySelector('#queue-lab .slot-chip.waiting .chip-cancel')?.textContent || ''`);
    assert(/100 %/.test(waitingBtn), 'Button wartend: ' + waitingBtn);
    await realClick('#queue-lab .slot-chip.waiting .chip-cancel');
    const s2 = await cost();
    const g1 = s2 - s1;
    assert(g1 >= 60 - 1e-6 && g1 <= 60 + rate * 3 + 1, `Erstattung wartend ${g1}, erwartet 60 (100 %)`);
    const runBtn = await ev(`document.querySelector('#queue-lab .slot-chip.running .chip-cancel')?.textContent || ''`);
    assert(/50 %/.test(runBtn), 'Button laufend: ' + runBtn);
    await realClick('#queue-lab .slot-chip.running .chip-cancel');
    const s3 = await cost();
    const g2 = s3 - s2;
    assert(g2 >= 20 - 1e-6 && g2 <= 20 + rate * 3 + 1, `Erstattung laufend ${g2}, erwartet 20 (50 % von 40)`);
    assert(await G('state.timers.lab.length') === 0, 'Queue nicht leer');
    assert(await G('state.research.converter') === undefined, 'Forschung trotz Abbruch aktiv');
  });
});

// =====================================================================================
await scenario('f', 'Werkbank: Klick-Upgrade und Boost über Timer', async () => {
  await seed({ ore: 1e7, steel: 1e5, titan: 1e4 });
  await tab('upgrades');
  let clickBefore;
  await step('Klick-Upgrade kaufen: Werkbank-Queue läuft, Ring (--p) füllt sich', async () => {
    clickBefore = await G('F.rates().click');
    await realClick(card('click', 'click'));
    assert(await G(`state.timers.workshop.length === 1 && state.timers.workshop[0].id === 'click'`), 'Nicht in Werkbank-Queue');
    const chip = await ev(`document.querySelector('#queue-workshop .slot-chip.running')?.textContent || ''`);
    assert(/Verstärkte Spitzhacke/.test(chip), 'Chip: ' + chip);
    await wait(2.5);
    const p = await ev(`parseFloat(document.querySelector(${J(card('click', 'click'))}).querySelector('.timer-ring')?.style.getPropertyValue('--p') || document.querySelector(${J(card('click', 'click'))}).closest('.card').querySelector('.timer-ring').style.getPropertyValue('--p') || '0')`);
    assert(p > 0.2, '--p = ' + p);
    assert(await G('state.clicks.click') === 0, 'Wirkt schon vor Ablauf');
  });
  await step('Nach Ablauf: Klickstufe 1, Klickwert steigt, Anzeige in der Sidebar aktualisiert', async () => {
    await waitFor(() => G('state.clicks.click === 1'), 9000, 'Klick-Upgrade fertig');
    await sleep(300);
    const now = await G('F.rates().click');
    assert(now > clickBefore, `Klickwert ${clickBefore} -> ${now}`);
    const txt = await ev(`document.getElementById('clickVal').textContent`);
    assert(txt.includes('+'), 'Text: ' + txt);
  });
  let oreBefore;
  await step('Diamantbohrer (Boost) kaufen: läuft 15 s (Echtzeit), danach Erz-Rate x2', async () => {
    oreBefore = await G('F.rates().ore / F.globalMult()');
    await realClick(card('boost', 'diamond'));
    assert(await G(`state.timers.workshop[0]?.id === 'diamond'`), 'Nicht in Queue');
    assert(await G('state.boosts.diamond') === undefined, 'Boost sofort aktiv');
    await wait(16);
    await waitFor(() => G('state.boosts.diamond === 1'), 4000, 'Boost fertig');
    near(await G('F.rates().ore / F.globalMult()') / oreBefore, 2, 0.01, 'Erz-Rate Faktor (ohne Erfolgsbonus)');
    await expectToast('Boost aktiv: Diamantbohrer');
    const b = await ev(`document.querySelector(${J(card('boost', 'diamond'))}).querySelector('.b').textContent`);
    assert(b === 'Aktiv', 'Badge: ' + b);
  });
  await shot('f-werkbank');
});

// =====================================================================================
await scenario('g', 'Warteschlange voll blockiert weiteren Kauf', async () => {
  await seed({ ore: 1e8, steel: 1e7, titan: 1e6 });
  await tab('upgrades');
  await step('4 Aufträge einreihen (1 läuft + 3 wartend = Kapazität)', async () => {
    for (const [k, id] of [['click', 'click'], ['boost', 'turbo'], ['boost', 'press'], ['boost', 'overclock']]) await realClick(card(k, id));
    assert(await G('state.timers.workshop.length') === 4, 'Länge ' + await G('state.timers.workshop.length'));
    const title = await ev(`document.querySelector('#queue-workshop .queue-title').textContent`);
    assert(/1\/1 aktiv/.test(title) && /3\/3 wartend/.test(title), 'Titel: ' + title);
  });
  await step('5. Kauf (Magnetscheider) ist gesperrt: Hinweis "Warteschlange voll", aria-disabled', async () => {
    const r = await ev(`(() => { const e = document.querySelector(${J(card('boost', 'magnet'))}); return { dis: e.getAttribute('aria-disabled'), note: e.querySelector('.n').textContent, cls: e.className }; })()`);
    assert(r.dis === 'true', 'aria-disabled = ' + r.dis);
    assert(/voll/.test(r.note), 'Hinweis: ' + r.note);
  });
  await step('Klick auf gesperrte Karte ändert nichts (Queue-Länge, Käufe, Ressourcen)', async () => {
    const before = await G('({ n: state.timers.workshop.length, buys: state.stats.buys, titan: state.res.titan })');
    await realClick(card('boost', 'magnet'));
    const after = await G('({ n: state.timers.workshop.length, buys: state.stats.buys, titan: state.res.titan })');
    assert(after.n === 4 && after.buys === before.buys && after.titan >= before.titan, J({ before, after }));
    assert(await G(`!!F.lockReason('boost', 'magnet') && /voll/.test(F.lockReason('boost', 'magnet'))`), 'lockReason ohne "voll"');
  });
  await shot('g-queue-voll');
  await step('Alle 4 Aufträge abbrechen: Queue leer, Magnetscheider wieder kaufbar', async () => {
    for (let i = 0; i < 4; i++) await realClick('#queue-workshop .chip-cancel');
    assert(await G('state.timers.workshop.length') === 0, 'Queue nicht leer');
    await sleep(250);
    const dis = await ev(`document.querySelector(${J(card('boost', 'magnet'))}).getAttribute('aria-disabled')`);
    assert(dis === 'false', 'aria-disabled = ' + dis);
  });
});

// =====================================================================================
await scenario('h', 'Neues Material (Kohle) freischalten', async () => {
  await seed({ ore: 1e8, steel: 1e7, titan: 1e6 });
  const coalMeter = () => ev(`(() => { const m = [...document.querySelectorAll('.meter')].find(m => m.querySelector('.meter-name').textContent === 'Kohle'); return m ? !m.hidden && m.getClientRects().length > 0 : null; })()`);
  await step('Vorher: Kohle-Meter und Zeche-Karte verborgen', async () => {
    assert(await coalMeter() === false, 'Kohle-Meter sichtbar');
    assert(await ev(`document.querySelector(${J(card('gen', 'colliery'))}).closest('.card').hidden`), 'Zeche-Karte sichtbar');
  });
  await step('Tiefbau + Kohleflöz-Erkundung erforschen (echte Klicks; Timer vorgespult)', async () => {
    await tab('research');
    await realClick(card('research', 'deepmines'));
    await ff(16, 'Tiefbau (15 s)');
    assert(await G('state.research.deepmines === 1'), 'Tiefbau nicht fertig');
    await realClick(card('research', 'coalmining'));
    await ff(21, 'Kohleflöz-Erkundung (20 s)');
    assert(await G('state.research.coalmining === 1'), 'Kohleflöz nicht fertig');
  });
  await step('Kohle erscheint in der Sidebar (Gruppe "Weitere Materialien")', async () => {
    await sleep(300);
    assert(await coalMeter() === true, 'Kohle-Meter nicht sichtbar');
    assert(await isVisible('.meters-more'), 'Gruppe "Weitere Materialien" nicht sichtbar');
    const cnt = await ev(`document.querySelector('.more-count').textContent`);
    assert(cnt === '(1)', 'Zähler ' + cnt);
  });
  await step('Zeche erscheint im Generatoren-Tab, Kauf per Klick, Spur im Werk, Kohle wird produziert', async () => {
    await tab('gens');
    assert(await isVisible(card('gen', 'colliery')), 'Zeche-Karte nicht sichtbar');
    await realClick(card('gen', 'colliery'));
    assert(await G('state.gens.colliery') === 1, 'Zeche nicht gekauft');
    await tab('works');
    assert(!!(await lane('colliery')), 'Spur colliery fehlt');
    await wait(2);
    assert(await G('state.res.coal') > 0, 'Keine Kohle produziert');
    const txt = await ev(`[...document.querySelectorAll('.meter')].find(m => m.querySelector('.meter-name').textContent === 'Kohle').querySelector('.amt').textContent`);
    assert(txt !== '0', 'Kohle-Anzeige "' + txt + '"');
  });
  await shot('h-kohle');
});

// =====================================================================================
await scenario('i', 'Speichern/Reload und Offline-Simulation', async () => {
  await seed({ ore: 1e8, steel: 1e7, titan: 1e6 });
  let snap;
  await step('Laufende Aufträge erzeugen (Labor: Resonanzhammer läuft + Konverter wartet; Werkbank: Turbo läuft)', async () => {
    await tab('research');
    await realClick(card('research', 'resonance'));
    await realClick(card('research', 'converter'));
    await tab('upgrades');
    await realClick(card('boost', 'turbo'));
    assert(await G('state.timers.lab.length === 2 && state.timers.workshop.length === 1'), 'Queues nicht wie erwartet');
  });
  await step('"Jetzt speichern" (Einstellungen) schreibt in localStorage', async () => {
    await tab('settings');
    await clickText('#settings-root', 'Jetzt speichern');
    await sleep(200);
    const st = await ev(`document.querySelector('#settings-root .status').textContent`);
    assert(st === 'Spielstand gespeichert.', 'Status: ' + st);
    const raw = await ev(`localStorage.getItem('eisenwerk-idle-save-v2')`);
    assert(raw && JSON.parse(raw).v === 4, 'Kein v4-Spielstand im localStorage');
    snap = await G('JSON.parse(JSON.stringify(state))');
  });
  await step('Reload: Ressourcen, Generatoren, Forschung, Queue-Reihenfolge und Timer erhalten', async () => {
    const e0 = errs.length;
    await reload();
    const now = await G('JSON.parse(JSON.stringify(state))');
    assert(now.res.ore >= snap.res.ore, `Erz ${snap.res.ore} -> ${now.res.ore}`);
    assert(J(now.gens) === J(snap.gens), 'Generatoren unterschiedlich');
    assert(J(now.research) === J(snap.research), 'Forschung unterschiedlich');
    assert(J(now.boosts) === J(snap.boosts), 'Boosts unterschiedlich');
    for (const q of ['lab', 'workshop']) {
      assert(now.timers[q].map(e => e.id).join() === snap.timers[q].map(e => e.id).join(), `Queue ${q}: ${now.timers[q].map(e => e.id)} statt ${snap.timers[q].map(e => e.id)}`);
      now.timers[q].forEach((e, i) => assert(e.left <= snap.timers[q][i].left + 1e-6 && e.left > snap.timers[q][i].left - 20, `Timer ${e.id}: left ${snap.timers[q][i].left} -> ${e.left}`));
    }
    await noNewErrors(e0);
  });
  await step('Timer laufen nach Reload weiter (Resonanzhammer wird fertig)', async () => {
    await tab('research');
    await waitFor(() => G('state.research.resonance === 1'), 12000, 'Resonanzhammer fertig');
  });
  await step('Offline-Simulation: lastSave 120 s zurückdatiert -> Willkommen-Toast, Timer fertig, Erz gutgeschrieben', async () => {
    await G('(state.res.steel = Math.max(state.res.steel, 1e7), true)');
    await tab('settings'); await clickText('#settings-root', 'Jetzt speichern');
    const pre = await G('({ ore: state.res.ore, rate: F.rates().ore, lab: state.timers.lab.length, wk: state.timers.workshop.length })');
    assert(pre.lab + pre.wk > 0, 'Keine laufenden Aufträge für den Offline-Test: ' + J(pre));
    await ev(`(() => { window.__eisenwerk.state.settings.autosave = false; const k = 'eisenwerk-idle-save-v2'; const d = JSON.parse(localStorage.getItem(k)); d.t -= 120000; localStorage.setItem(k, JSON.stringify(d)); return true; })()`);
    await reload();
    await expectToast('Willkommen zurück', 2500);
    const post = await G('({ ore: state.res.ore, lab: state.timers.lab.length, wk: state.timers.workshop.length, converter: state.research.converter, turbo: state.boosts.turbo })');
    assert(post.lab === 0 && post.wk === 0, `Queues nach Offline nicht abgearbeitet: ${J(post)}`);
    assert(post.converter === 1 && post.turbo === 1, 'Offline-Aufträge nicht angewandt: ' + J(post));
    assert(post.ore - pre.ore >= pre.rate * 120 * 0.75, `Offline-Erz +${post.ore - pre.ore}, erwartet >= ${pre.rate * 90} (Konverter wandelt 20 % in Stahl)`);
  });
  await shot('i-offline');
});

// =====================================================================================
await scenario('j', 'Prestige (Hochofen-Neuguss)', async () => {
  await seed({ ore: 1e6, steel: 1e5, titan: 1e4 });
  await G('(state.stats.run.ore = 1.2e7, window.__eisenwerk.refresh(), true)');
  await tab('prestige');
  let before;
  await step('Neuguss-Knopf zeigt erwarteten Ertrag (+4 Gussformen bei 1,2e7 Erz)', async () => {
    before = await G('({ ach: Object.keys(state.achievements).length, gens: Object.values(state.gens).reduce((a, b) => a + b, 0) })');
    const t = await ev(`document.querySelector('#prestige-root .btn-big').textContent`);
    assert(/\+4/.test(t), 'Knopf: ' + t);
  });
  await step('Dialog: Abbrechen lässt den Spielstand unverändert', async () => {
    await realClick('#prestige-root .btn-big');
    await waitFor(() => isVisible('dialog[open]'), 3000, 'Dialog offen');
    await shot('j-dialog');
    await realClick('dialog button[value="cancel"]');
    await sleep(200);
    assert(!(await isVisible('dialog[open]')), 'Dialog noch offen');
    assert(await G('state.prestige.count') === 0 && await G('state.prestige.points') === 0, 'Prestige trotz Abbruch');
  });
  await step('Dialog bestätigen: Reset korrekt (Gussformen +4, Generatoren/Forschung/Boosts/Queues/Erz zurück)', async () => {
    await realClick('#prestige-root .btn-big');
    await waitFor(() => isVisible('dialog[open]'), 3000, 'Dialog offen');
    await realClick('dialog button[value="ok"]');
    await sleep(500);
    const s = await G(`({ pts: state.prestige.points, tot: state.prestige.total, cnt: state.prestige.count, gens: Object.values(state.gens).reduce((a, b) => a + b, 0), res: Object.keys(state.research).length,
      boosts: Object.keys(state.boosts).length, q: state.timers.lab.length + state.timers.workshop.length, ore: state.res.ore, steel: state.res.steel, run: state.stats.run.ore, clicks: Object.values(state.clicks).reduce((a, b) => a + b, 0),
      ach: Object.keys(state.achievements).length, mult: F.prestigeMult() })`);
    assert(s.pts === 4 && s.tot === 4 && s.cnt === 1, `Prestige-Zähler: ${J(s)}`);
    assert(s.gens === 0 && s.res === 0 && s.boosts === 0 && s.q === 0 && s.clicks === 0, `Reset unvollständig: ${J(s)}`);
    assert(s.ore < 1 && s.steel < 1 && s.run < 1, `Ressourcen nicht zurückgesetzt: ${J(s)}`);
    assert(s.ach >= before.ach, 'Erfolge verloren');
    assert(s.mult > 1, 'Produktionsbonus fehlt: ' + s.mult);
    await expectToast('Hochofen-Neuguss', 2500);
  });
  await step('Werk-Tab leer: keine gebaute Spur, alle Spuren "Noch nicht gebaut"', async () => {
    await tab('works');
    const lanes = await lanesInfo();
    assert(lanes.every(l => l.slots === 0 && /empty/.test(l.cls)), 'Gebaute Spuren: ' + J(lanes.filter(l => l.slots)));
  });
  await step('Werk-Tab leer: Hinweistext #works-empty sichtbar', async () => {
    assert(await isVisible('#works-empty'), '#works-empty nicht sichtbar');
  }, { soft: true });
  await step('Sidebar nach Neuguss: Material-Meter folgen dem Reset (Kohle wieder verborgen)', async () => {
    const vis = await ev(`(() => { const m = [...document.querySelectorAll('.meter')].find(m => m.querySelector('.meter-name').textContent === 'Kohle'); return !m.hidden && m.getClientRects().length > 0; })()`);
    assert(!vis, 'Kohle-Meter bleibt nach Neuguss sichtbar (resVisible nutzt stats.total, das beim Reset erhalten bleibt) -- Forschung ist zurückgesetzt');
  }, { soft: true });
  await shot('j-nach-neuguss');
});

// =====================================================================================
await scenario('k', 'Export/Import Roundtrip', async () => {
  await seed({ ore: 1e5 });
  await tab('gens'); await realClick(card('gen', 'mine'), 3);
  let exported, snap;
  await tab('settings');
  await step('Exportieren liefert gültigen Base64-Spielstand (v4)', async () => {
    await clickText('#settings-root', 'Exportieren');
    exported = await ev(`document.getElementById('set-export').value`);
    assert(exported.length > 100, 'Export leer');
    const parsed = JSON.parse(Buffer.from(exported, 'base64').toString('utf8'));
    assert(parsed.v === 4 && parsed.state.prestige.points === 4 && parsed.state.gens.mine === 3, `Export-Inhalt: v=${parsed.v}`);
    snap = parsed.state;
  });
  await step('Stand ändern, Import per echter Texteingabe + Bestätigung: Zustand = Export', async () => {
    await G('(state.gens.mine = 99, state.prestige.points = 77, state.res.ore = 5, true)');
    await realClick('#set-import');
    await c.send('Input.insertText', { text: exported });
    await sleep(200);
    await clickText('#settings-root', 'Importieren');
    await waitFor(() => isVisible('dialog[open]'), 3000, 'Import-Dialog');
    await realClick('dialog button[value="ok"]');
    await sleep(400);
    const st = await ev(`document.querySelector('#settings-root .status').textContent`);
    assert(st === 'Spielstand importiert.', 'Status: ' + st);
    const now = await G('({ mine: state.gens.mine, pts: state.prestige.points, ore: state.res.ore, imp: document.getElementById("set-import").value })');
    assert(now.mine === 3 && now.pts === 4, `Zustand nach Import: ${J(now)}`);
    assert(Math.abs(now.ore - snap.res.ore) < 50, `Erz ${now.ore} vs Export ${snap.res.ore}`);
    assert(now.imp === '', 'Importfeld nicht geleert');
  });
  await step('Ungültiger Import ("%%%") zeigt Fehlermeldung, Zustand bleibt', async () => {
    await realClick('#set-import');
    await c.send('Input.insertText', { text: '%%%not-base64' });
    await clickText('#settings-root', 'Importieren');
    await waitFor(() => isVisible('dialog[open]'), 3000, 'Import-Dialog');
    await realClick('dialog button[value="ok"]');
    await sleep(300);
    const r = await ev(`({ txt: document.querySelector('#settings-root .status').textContent, bad: document.querySelector('#settings-root .status').classList.contains('bad') })`);
    assert(r.bad && /beschädigt|gültig/.test(r.txt), J(r));
    assert(await G('state.gens.mine') === 3, 'Zustand verändert');
  });
  await step('Spielstand aus neuerer Version (v99) wird abgelehnt', async () => {
    const fut = Buffer.from(JSON.stringify({ v: 99, t: Date.now(), state: {} })).toString('base64');
    await ev(`(() => { document.getElementById('set-import').value = ''; return true; })()`);
    await realClick('#set-import');
    await c.send('Input.insertText', { text: fut });
    await clickText('#settings-root', 'Importieren');
    await waitFor(() => isVisible('dialog[open]'), 3000, 'Import-Dialog');
    await realClick('dialog button[value="ok"]');
    await sleep(300);
    const r = await ev(`({ txt: document.querySelector('#settings-root .status').textContent, bad: document.querySelector('#settings-root .status').classList.contains('bad') })`);
    assert(r.bad && /neueren/.test(r.txt), J(r));
    await ev(`(() => { document.getElementById('set-import').value = ''; return true; })()`);
  });
  await step('Einstellungen wirken nach Import (Partikel-Checkbox schreibt in den aktuellen state.settings)', async () => {
    await realClick('#set-particles');
    const v = await G('state.settings.particles');
    await realClick('#set-particles');   // zurück
    assert(v === false, 'Nach Import ändert die Checkbox state.settings.particles nicht (settings.js hält die alte Referenz "se" = state.settings von vor replaceState)');
  });
  await shot('k-einstellungen');
});

// =====================================================================================
/** Layout-Prüfung im Seitenkontext: horizontaler Überlauf, abgeschnittene Texte, Überlappungen. */
const layoutProbe = () => ev(`(() => {
  const iw = innerWidth, out = { overflowX: document.documentElement.scrollWidth - iw, offscreen: [], clipped: [], overlaps: [] };
  const panel = [...document.querySelectorAll('section.panel')].find(p => !p.hidden);
  const vis = e => e.getClientRects().length > 0 && !e.hidden;
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/)[0] : '') + (e.dataset && (e.dataset.id || e.dataset.gen) ? '[' + (e.dataset.id || e.dataset.gen) + ']' : '');
  for (const e of panel.querySelectorAll('*')) {
    if (!vis(e) || e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > iw + 2 || r.left < -2) && !e.closest('.meters, .tabs, .lane-slots, canvas')) out.offscreen.push(name(e) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  }
  for (const e of panel.querySelectorAll('.t, .b, .d, .lane-name, .lane-next, .chip-name, .prog-text, h2, h3')) {
    if (!vis(e)) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' ) out.clipped.push(name(e) + ' "' + e.textContent.slice(0, 30) + '"');
  }
  for (const sel of ['.card', '.lane', '.slot-chip', '.panel-box']) {
    const els = [...panel.querySelectorAll(sel)].filter(vis).map(e => ({ e, r: e.getBoundingClientRect() }));
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].r, b = els[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4 && !els[i].e.contains(els[j].e) && !els[j].e.contains(els[i].e)) out.overlaps.push(name(els[i].e) + ' x ' + name(els[j].e));
    }
  }
  const sb = document.querySelector('.sidebar').getBoundingClientRect(), tb = document.querySelector('.topbar').getBoundingClientRect();
  out.sidebar = { bottom: Math.round(sb.bottom), topbarTop: Math.round(tb.top), position: getComputedStyle(document.querySelector('.sidebar')).position };
  return out;
})()`);

await scenario('l', 'Layout Desktop + Mobile (390x844)', async () => {
  await seed({ ore: 1e7, steel: 1e6, titan: 1e5 });
  // etwas Inhalt, damit Werk/Generatoren/Queues gefüllt sind
  await G(`(buy('gen', 'mine', 12), buy('gen', 'smelter', 5), true)`);
  await G(`(buy('research', 'geology'), timers.tick(10), buy('research', 'converter'), buy('research', 'deepmines'), buy('boost', 'diamond'), true)`);
  const TABS = ['works', 'gens', 'upgrades', 'research', 'prestige', 'achievements', 'stats', 'settings'];
  const sweep = async (label) => {
    for (const t of TABS) {
      await step(`${label}: Tab ${t} – kein horizontaler Überlauf, nichts abgeschnitten/überlappend`, async () => {
        await tab(t); await sleep(250);
        await shot(`l-${label}-${t}`);
        const p = await layoutProbe();
        const issues = [];
        if (p.overflowX > 1) issues.push(`Seite scrollt horizontal um ${p.overflowX}px`);
        if (p.offscreen.length) issues.push('außerhalb: ' + p.offscreen.slice(0, 3).join('; '));
        if (p.clipped.length) issues.push('abgeschnitten: ' + p.clipped.slice(0, 3).join('; '));
        if (p.overlaps.length) issues.push('Überlappung: ' + p.overlaps.slice(0, 3).join('; '));
        assert(issues.length === 0, issues.join(' | '));
      }, { soft: true });
    }
  };
  await sweep('desktop');
  for (const w of [1024, 1200]) {
    try {
      await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: 768, deviceScaleFactor: 1, mobile: false });
      await sleep(500);
      await step(`Desktop ${w} px: Tab-Leiste vollständig sichtbar`, async () => {
        await shot(`l-tabs-${w}`);
        const r = await ev(`(() => { const nav = document.getElementById('tabs'); const bad = [...nav.querySelectorAll('.tab')].filter(t => t.getBoundingClientRect().right > innerWidth + 1).map(t => t.dataset.tab); return { over: nav.scrollWidth - nav.clientWidth, bad, ox: document.documentElement.scrollWidth - innerWidth }; })()`);
        assert(r.over <= 1 && r.bad.length === 0 && r.ox <= 1, `Überlauf ${r.over}px, außerhalb: ${r.bad.join(',') || '-'}, Seite ${r.ox}px`);
      }, { soft: true });
    } finally { await c.send('Emulation.clearDeviceMetricsOverride'); await sleep(400); }
  }
  try {
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(700);
    await step('Mobil: Viewport 390 px aktiv, Sidebar wird kompakte Leiste, Erz-Knopf als Schwebeknopf sichtbar', async () => {
      assert(await ev('innerWidth') === 390, 'innerWidth ' + await ev('innerWidth'));
      const r = await ev(`({ pos: getComputedStyle(document.getElementById('click-zone')).position, vis: (() => { const b = document.getElementById('collect').getBoundingClientRect(); return b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.width > 0; })() })`);
      assert(r.pos === 'fixed' && r.vis, J(r));
    });
    await sweep('mobil');
    await step('Mobil: Schwebeknopf klickbar und erhöht das Erz', async () => {
      const b = await G('state.stats.clicks');
      await realClick('#collect');
      assert(await G('state.stats.clicks') === b + 1, 'Klick ohne Wirkung');
    });
    await step('Mobil: Tab-Leiste scrollbar, aktiver Tab im Sichtbereich', async () => {
      await tab('settings');
      const r = await ev(`(() => { const t = document.querySelector('[data-tab=settings]').getBoundingClientRect(); return { r: Math.round(t.right), l: Math.round(t.left), iw: innerWidth }; })()`);
      assert(r.r <= r.iw + 1 && r.l >= -1, J(r));
    });
    await step('Mobil: Sticky-Sidebar verdeckt Tab-Leiste nicht', async () => {
      const p = await layoutProbe();
      assert(p.sidebar.bottom <= p.sidebar.topbarTop + 2 || p.sidebar.position === 'sticky', J(p.sidebar));
    }, { soft: true });
  } finally {
    await c.send('Emulation.clearDeviceMetricsOverride');
    await sleep(500);
  }
  await step('Viewport zurückgesetzt (Desktop-Breite wieder aktiv)', async () => assert(await ev('innerWidth') > 1000, 'innerWidth ' + await ev('innerWidth')));
});

// =====================================================================================
await scenario('m', 'Performance: 30 s Laufzeit, DOM stabil, Partikel aufgeräumt', async () => {
  await G(`(Object.assign(state.res, { ore: 1e8, steel: 1e7 }), true)`);
  await tab('works');
  const counters = async () => {
    const m = await c.send('Memory.getDOMCounters');
    const part = await ev(`({ particles: document.querySelectorAll('.particle').length, sparks: document.querySelectorAll('.spark-p').length, toasts: document.querySelectorAll('.toast').length, elements: document.getElementsByTagName('*').length,
      maxPerParent: Math.max(0, ...[...document.querySelectorAll('.orb, #click-zone')].map(p => p.querySelectorAll(':scope > .particle').length)) })`);
    const heap = await c.send('Runtime.getHeapUsage');
    return { ...m, ...part, heapMB: +(heap.usedSize / 1048576).toFixed(1) };
  };
  const samples = [];
  await step('30 s laufen lassen, alle 3 s DOM-Knoten/Listener/Partikel messen', async () => {
    await wait(3);
    for (let i = 0; i < 11; i++) {
      if (i) { await realClick('#collect', 3); await wait(3); }
      samples.push(await counters());
      await say(c, `Test [m]: Messung ${i + 1}/11 – Knoten ${samples[i].nodes}, Partikel ${samples[i].particles}`);
    }
    console.log('    Knoten:   ' + samples.map(s => s.nodes).join(' '));
    console.log('    Elemente: ' + samples.map(s => s.elements).join(' '));
    console.log('    Listener: ' + samples.map(s => s.jsEventListeners).join(' '));
    console.log('    Partikel: ' + samples.map(s => s.particles).join(' ') + '   Heap MB: ' + samples.map(s => s.heapMB).join(' '));
  });
  await step('DOM-Knoten stabil (Spanne <= 60, Trend <= 40) – kein Leak', async () => {
    const n = samples.map(s => s.nodes);
    const span = Math.max(...n) - Math.min(...n), trend = n[n.length - 1] - n[0];
    assert(span <= 60 && trend <= 40, `Spanne ${span}, Trend ${trend} (${n.join(',')})`);
  });
  await step('Event-Listener und Dokumentanzahl stabil', async () => {
    const l = samples.map(s => s.jsEventListeners), d = samples.map(s => s.documents);
    const med = x => [...x].sort((p, q) => p - q)[1];   // Median aus 3 (kurzlebige Toasts/Goldbarren schwanken)
    assert(med(l.slice(-3)) - med(l.slice(0, 3)) <= 15, `Listener ${l.join(',')}`);
    assert(Math.max(...d) - Math.min(...d) <= 2, `Dokumente ${d.join(',')}`);
  });
  await step('Partikel begrenzt (<= 40 je Elternelement) und Funken/Toasts begrenzt', async () => {
    assert(Math.max(...samples.map(s => s.maxPerParent)) <= 40, 'Partikel je Eltern: ' + Math.max(...samples.map(s => s.maxPerParent)));
    assert(Math.max(...samples.map(s => s.sparks)) <= 24 * 2, 'Funken ' + Math.max(...samples.map(s => s.sparks)));
    assert(Math.max(...samples.map(s => s.toasts)) <= 5, 'Toasts ' + Math.max(...samples.map(s => s.toasts)));
  });
  await step('Schwebende +Zahlen überdecken keine Meter-Beschriftungen in der Sidebar', async () => {
    await shot('m-partikel-sidebar');
    const r = await ev(`(() => { const hit = []; const labels = [...document.querySelectorAll('.meter .amt, .meter .rps, .meter .meter-name')].filter(e => e.getClientRects().length);
      for (const p of document.querySelectorAll('.particle')) { const a = p.getBoundingClientRect(); if (!a.width) continue;
        for (const l of labels) { if (p.closest('.meter') === l.closest('.meter')) continue; const b = l.getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) { hit.push(p.textContent + ' über ' + l.className + ' "' + l.textContent.slice(0, 12) + '"'); break; } } }
      return hit; })()`);
    assert(r.length === 0, `${r.length} Partikel liegen über fremden Meter-Texten, z. B. ${r.slice(0, 3).join('; ')}`);
  }, { soft: true });
  await step('Partikel deaktivieren (Einstellungen): nach 3 s keine .particle/.spark-p mehr', async () => {
    await tab('settings');
    await realClick('#set-particles');
    assert(await G('state.settings.particles') === false, 'Einstellung nicht übernommen');
    await tab('works');
    await wait(3);
    const s = await counters();
    assert(s.particles === 0 && s.sparks === 0, `Partikel ${s.particles}, Funken ${s.sparks}`);
    await tab('settings'); await realClick('#set-particles'); await tab('works');
    assert(await G('state.settings.particles') === true, 'Partikel nicht wieder aktiviert');
  });
  await step('Keine Konsolenfehler während des gesamten Laufs', async () => noNewErrors(errStart));
});

// ---------- Abschluss ----------
console.log('\n' + C.b('Aufräumen'));
await say(c, 'E2E-Lauf beendet: frischer Spielstand wird gesetzt');
if (!KEEP) {
  await ev(`(() => { try { window.__eisenwerk.state.settings.autosave = false; } catch {} localStorage.clear(); return true; })()`);
  await reload();
  console.log('Frischer Spielstand gesetzt (Sicherung bleibt: ' + backupFile + ')');
}
await say(c, 'E2E fertig – frischer Spielstand, viel Spaß!');

const by = {};
for (const r of results) { (by[r.scenario] ??= { PASS: 0, FAIL: 0, WARN: 0 })[r.status]++; }
console.log('\n' + C.b('Zusammenfassung'));
console.log('Szenario  PASS  WARN  FAIL');
for (const [id, v] of Object.entries(by)) console.log(`   ${id}       ${String(v.PASS).padStart(3)}   ${String(v.WARN).padStart(3)}   ${String(v.FAIL).padStart(3)}`);
const tot = results.reduce((a, r) => (a[r.status]++, a), { PASS: 0, FAIL: 0, WARN: 0 });
console.log(`Gesamt: ${tot.PASS} PASS, ${tot.WARN} WARN, ${tot.FAIL} FAIL` + (HIDDEN ? '  (Fenster verborgen: Zeit simuliert)' : ''));
if (fastForwards.length) console.log('Vorgespult: ' + fastForwards.join('; '));
if (notes.length) console.log('Hinweise:\n  ' + [...new Set(notes)].join('\n  '));
for (const r of results.filter(r => r.status !== 'PASS')) console.log(`  ${r.status} [${r.scenario}] ${r.name}: ${r.msg}`);
fs.writeFileSync(path.join(OUT, 'e2e-last-result.json'), JSON.stringify({ stamp, hidden: HIDDEN, results, notes, fastForwards, shots: shotFiles, backupFile }, null, 2));
c.close();
process.exit(tot.FAIL > 0 || (STRICT && tot.WARN > 0) ? 1 : 0);
