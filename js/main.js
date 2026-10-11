// Bootstrap und Game-Loop (requestAnimationFrame mit Delta-Time).
import { state } from './core/state.js';
import { on, toast } from './core/events.js';
import { fmt, fmtTime } from './core/format.js';
import { load, save, applyOffline } from './core/save.js';
import { RES, RES_IDS } from './data/resources.js';
import { tick } from './systems/production.js';
import * as autobuyers from './systems/autobuyers.js';
import * as golden from './systems/golden.js';
import * as achievements from './systems/achievements.js';
import { initRender, frame, refresh } from './ui/render.js';
import { initTabs } from './ui/tabs.js';
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
  const loaded = load();
  applySettings();
  if (loaded.loaded) {
    if (state.savedAt > 0) announceOffline(applyOffline((Date.now() - state.savedAt) / 1000));
    if (loaded.migrated) { toast('Spielstand der alten Version wurde übernommen.', 'good'); save(); }
  }

  initToasts($('#toasts'));
  initRender();
  initTabs($('#tabs'));
  initSettings();
  initCollect($('#collect'), $('#click-zone'), refresh);
  initGoldenUI($('#goldenLayer'));
  initFlash();
  golden.init();
  achievements.check(0, true);
  on('loaded', () => { golden.init(); resetHistory(); });
  refresh();

  let last = performance.now(), sinceSave = 0;
  const loop = now => {
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > OFFLINE_MIN_SECONDS) { announceOffline(applyOffline(dt)); dt = 0; }
    const r = tick(dt);
    autobuyers.tick(dt);
    golden.tick(dt);
    achievements.check(dt);
    frame(r, dt);
    if (state.settings.autosave && (sinceSave += dt) >= state.settings.autosaveSec) { sinceSave = 0; save(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('pagehide', save);
  window.__eisenwerk = true;
}

try {
  boot();
} catch (err) {
  console.error(err);
  const box = document.getElementById('boot-error');
  if (box) { box.hidden = false; box.textContent = 'Beim Starten ist ein Fehler aufgetreten: ' + (err instanceof Error ? err.message : String(err)); }
}
