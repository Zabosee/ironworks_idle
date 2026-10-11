// Bootstrap und Game-Loop (requestAnimationFrame mit Delta-Time).
import { state } from './core/state.js';
import { on, toast } from './core/events.js';
import { fmt, fmtTime } from './core/format.js';
import { load, save, autoSave, applyOffline } from './core/save.js';
import { RES, RES_IDS } from './data/resources.js';
import { tick, buy } from './systems/production.js';
import * as autobuyers from './systems/autobuyers.js';
import * as timers from './systems/timers.js';
import * as F from './core/formulas.js';
import * as golden from './systems/golden.js';
import * as achievements from './systems/achievements.js';
import { initRender, frame, refresh } from './ui/render.js';
import { initTabs } from './ui/tabs.js';
import { initWorks } from './ui/works.js';
import { initToasts } from './ui/toast.js';
import { initCollect, initGoldenUI, initFlash } from './ui/effects.js';
import { initSettings, applySettings } from './ui/settings.js';
import { resetHistory } from './ui/charts.js';
import { $ } from './ui/dom.js';

const OFFLINE_MIN_SECONDS = 10;   // Lücken größer als dies (z. B. Tab im Hintergrund) zählen als Offline-Zeit

function announceOffline(info) {
  if (!info) return;
  const parts = RES_IDS.filter(k => info.gains[k] > 0).map(k => `+${fmt(info.gains[k])} ${RES[k].icon}`);
  toast(`Willkommen zurück! Offline-Ertrag (${fmtTime(info.seconds)}${info.capped ? ', Maximum erreicht' : ''}): ${parts.join('  ')}`, 'good');
}

function boot() {
  initToasts($('#toasts'));   // zuerst, damit Toasts aus load()/applyOffline() nicht verloren gehen
  const loaded = load();
  applySettings();
  if (loaded.loaded) {
    if (state.savedAt > 0) announceOffline(applyOffline((Date.now() - state.savedAt) / 1000));
    if (loaded.migrated) { toast('Spielstand der alten Version wurde übernommen.', 'good'); save(); }
  } else if (loaded.error) {
    toast(loaded.backedUp
      ? 'Der Spielstand ist unlesbar oder stammt aus einer neueren Version. Eine Kopie liegt im Browser-Speicher (…-backup). Speichern ist gesperrt, bis du einen Spielstand importierst oder zurücksetzt.'
      : 'Der Spielstand ist unlesbar oder stammt aus einer neueren Version. Speichern ist gesperrt, bis du einen Spielstand importierst oder zurücksetzt.', 'warn');
  }

  initRender();
  initWorks();
  initTabs($('#tabs'));
  initSettings();
  initCollect($('#collect'), $('#click-zone'), refresh);
  initGoldenUI($('#goldenLayer'));
  initFlash();
  golden.init();
  achievements.check(0, true);
  // Zeitgeber beim Laden/Import/Reset und beim Neuguss zurücksetzen
  const resetTimers = () => { golden.init(); autobuyers.reset(); achievements.reset(); };
  on('loaded', () => { resetTimers(); resetHistory(); });
  on('prestige', resetTimers);
  refresh();

  let last = performance.now(), sinceSave = 0;
  const loop = now => {
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > OFFLINE_MIN_SECONDS) { announceOffline(applyOffline(dt, { runtime: true })); dt = 0; }
    const r = tick(dt);
    autobuyers.tick(dt);
    golden.tick(dt);
    achievements.check(dt);
    frame(r, dt);
    if (state.settings.autosave && (sinceSave += dt) >= state.settings.autosaveSec) { sinceSave = 0; save(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Beim Verlassen nur speichern, wenn der Nutzer Autosave eingeschaltet hat (und nie bei gesperrtem Speichern).
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoSave(); });
  addEventListener('pagehide', autoSave);
  // Debug-Hook nur lokal (Live-Tests per DevTools); sonst bleibt es beim Boot-Marker.
  window.__eisenwerk = ['localhost', '127.0.0.1'].includes(location.hostname) ? { state, F, timers, buy, save, refresh } : true;
}

try {
  boot();
} catch (err) {
  console.error(err);
  const box = document.getElementById('boot-error');
  if (box) { box.hidden = false; box.textContent = 'Beim Starten ist ein Fehler aufgetreten: ' + (err instanceof Error ? err.message : String(err)); }
}
