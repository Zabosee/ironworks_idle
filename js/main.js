// Bootstrap und Game-Loop (requestAnimationFrame mit Delta-Time).
import { state } from './core/state.js';
import { on, emit, toast } from './core/events.js';
import { fmt, fmtTime } from './core/format.js';
import { t, tName, initLang } from './core/i18n.js';
import { applyStaticTexts } from './ui/static-i18n.js';
import { load, save, autoSave, applyOffline, pauseSaving } from './core/save.js';
import { createGuard, HEARTBEAT_MS } from './core/multitab.js';
import { RES, RES_IDS } from './data/resources.js';
import { tick, buy } from './systems/production.js';
import * as autobuyers from './systems/autobuyers.js';
import * as timers from './systems/timers.js';
import * as F from './core/formulas.js';
import * as golden from './systems/golden.js';
import * as revents from './systems/events-random.js';
import * as challenges from './systems/challenges.js';
import { initReventUI } from './ui/revent.js';
import * as achievements from './systems/achievements.js';
import * as eras from './systems/eras.js';
import * as corp from './systems/corp.js';
import * as industry from './systems/industry.js';
import { initRender, frame, refresh } from './ui/render.js';
import { initTabs } from './ui/tabs.js';
import { initWorks } from './ui/works.js';
import { claimDaily } from './systems/daily.js';
import { showWelcome, dailyText } from './ui/welcome.js';
import { initToasts } from './ui/toast.js';
import { initCollect, initGoldenUI, initFlash } from './ui/effects.js';
import { initHelp } from './ui/help.js';
import { initSound } from './ui/sound.js';
import { initSettings, applySettings } from './ui/settings.js';
import { resetHistory } from './ui/charts.js';
import { $ } from './ui/dom.js';

const WELCOME_MIN_SECONDS = 60;   // ab dieser Abwesenheit beim Laden ein Dialog statt Toast
const OFFLINE_MIN_SECONDS = 10;   // Lücken größer als dies (z. B. Tab im Hintergrund) zählen als Offline-Zeit

function announceOffline(info) {
  if (!info) return;
  const parts = RES_IDS.filter(k => info.gains[k] > 0).map(k => `+${fmt(info.gains[k])} ${tName('resources', RES[k])}`);
  toast(t('Willkommen zurück! Offline-Ertrag ({time}{capped}): {parts}', { time: fmtTime(info.seconds), capped: info.capped ? t(', Maximum erreicht') : '', parts: parts.join('  ') }), 'good');
}

function boot() {
  initToasts($('#toasts'));   // zuerst, damit Toasts aus load()/applyOffline() nicht verloren gehen
  // Mehr-Tab-Schutz vor dem Laden: ein zweiter Tab pausiert das Speichern und meldet 'multitab'.
  on('multitab', () => toast(t('Das Spiel läuft bereits in einem anderen Tab. Speichern ist hier pausiert, damit kein Fortschritt überschrieben wird. Schließe diesen Tab oder lade ihn neu, sobald der andere zu ist.'), 'warn'));
  // Tab-ID in sessionStorage: ein Neuladen desselben Tabs erbt den Lock (auch wenn pagehide ihn nicht freigegeben hat).
  let tabId; try { tabId = sessionStorage.getItem('eisenwerk-tab-id') || undefined; if (!tabId) { tabId = Math.random().toString(36).slice(2); sessionStorage.setItem('eisenwerk-tab-id', tabId); } } catch { /* ohne sessionStorage: Zufalls-ID */ }
  const guard = createGuard({ storage: globalThis.localStorage, id: tabId, onConflict: () => { pauseSaving(true); emit('multitab'); } });
  guard.claim();
  setInterval(() => guard.beat(), HEARTBEAT_MS);
  addEventListener('pagehide', () => guard.release());
  const loaded = load();
  initLang();   // Sprache aus localStorage-Fallback bzw. Spielstand; schreibt state.settings.lang
  applyStaticTexts();
  applySettings();
  let welcomeOff = null, welcomeDaily = null;
  if (loaded.loaded) {
    if (state.savedAt > 0) welcomeOff = applyOffline((Date.now() - state.savedAt) / 1000);
    if (welcomeOff && welcomeOff.away < WELCOME_MIN_SECONDS) { announceOffline(welcomeOff); welcomeOff = null; }
    if (loaded.migrated) { toast(t('Spielstand der alten Version wurde übernommen.'), 'good'); save(); }
    welcomeDaily = claimDaily();
  } else if (loaded.error) {
    toast(loaded.backedUp
      ? t('Der Spielstand ist unlesbar oder stammt aus einer neueren Version. Eine Kopie liegt im Browser-Speicher (…-backup). Speichern ist gesperrt, bis du einen Spielstand importierst oder zurücksetzt.')
      : t('Der Spielstand ist unlesbar oder stammt aus einer neueren Version. Speichern ist gesperrt, bis du einen Spielstand importierst oder zurücksetzt.'), 'warn');
  }

  initRender();
  initWorks();
  initTabs($('#tabs'));
  initSettings();
  initHelp();
  initSound();
  initCollect($('#collect'), $('#click-zone'), refresh);
  initGoldenUI($('#goldenLayer'));
  initFlash();
  initReventUI($('#revent'));
  golden.init();
  revents.init();
  achievements.check(0, true);
  eras.reset();
  corp.reset();
  industry.reset();
  // Zeitgeber beim Laden/Import/Reset und beim Neuguss zurücksetzen
  const resetTimers = () => { golden.init(); autobuyers.reset(); achievements.reset(); eras.reset(); corp.reset(); industry.reset(); };
  on('loaded', () => { resetTimers(); revents.init(); resetHistory(); });
  on('prestige', resetTimers);
  on('corp', resetTimers);
  refresh();
  showWelcome(welcomeOff, welcomeDaily);

  let last = performance.now(), sinceSave = 0, dailyAt = last;
  const loop = now => {
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > OFFLINE_MIN_SECONDS) { announceOffline(applyOffline(dt, { runtime: true })); dt = 0; }
    // Tageswechsel bei offenem Spiel (läuft durch oder kommt aus dem Hintergrund): Tagesbonus nachreichen, nach der Offline-Verrechnung,
    // sonst würde sie den frischen Buff gleich um die Abwesenheit kürzen. performance.now läuft im Hintergrund weiter.
    if (now - dailyAt >= 60_000) { dailyAt = now; const d = claimDaily(); if (d) toast(dailyText(d), 'gold'); }
    const r = tick(dt);
    autobuyers.tick(dt);
    golden.tick(dt);
    revents.tick(dt);   // Zufallsereignisse: nur aktive Spielzeit (dt ist bei Offline-Lücken 0)
    challenges.tick(dt);
    achievements.check(dt);
    eras.check(dt);
    industry.check(dt);   // Event 'industry' bei neuer Leisten-Stufe
    corp.tick(dt);   // Freischalt-Toast und Auto-Neuguss
    frame(r, dt);
    if (state.settings.autosave && (sinceSave += dt) >= state.settings.autosaveSec) { sinceSave = 0; save(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Beim Verlassen nur speichern, wenn der Nutzer Autosave eingeschaltet hat (und nie bei gesperrtem Speichern).
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoSave(); });
  // Tab-Titel als Hinweis im Hintergrund: Der Loop (requestAnimationFrame) pausiert dort, deshalb rechnet ein Intervall
  // mit der beim Verstecken verbleibenden Zeit des nächsten Auftrags (Timer laufen offline mit vollem Tempo).
  const baseTitle = document.title;
  let hiddenAt = 0, doneIn = Infinity;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); doneIn = timers.timeToNext(); } else document.title = baseTitle;
  });
  setInterval(() => {
    if (document.hidden && (performance.now() - hiddenAt) / 1000 >= doneIn) document.title = '✔ ' + t('Auftrag fertig') + ' · ' + baseTitle;
  }, 5000);
  addEventListener('pagehide', autoSave);
  // Debug-Hook nur lokal (Live-Tests per DevTools); sonst bleibt es beim Boot-Marker.
  window.__eisenwerk = ['localhost', '127.0.0.1'].includes(location.hostname) ? { state, F, timers, buy, save, refresh } : true;
}

try {
  boot();
} catch (err) {
  console.error(err);
  const box = document.getElementById('boot-error');
  if (box) { box.hidden = false; box.textContent = t('Beim Starten ist ein Fehler aufgetreten:') + ' ' + (err instanceof Error ? err.message : String(err)); }
}
