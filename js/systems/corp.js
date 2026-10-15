// Zweite Reset-Ebene "Konzerngründung" (GAME-DESIGN.md B3): Gründung, Konzern-Shop, Auto-Neuguss.
// Events: 'corp' { gain }, 'corpshop' { id }, 'corpunlock', 'autocast' { gain }, 'autocastset'.
import { state } from '../core/state.js';
import { corpGain, corpUnlocked, corpStage, corpCost, corpLevel, prestigeGain } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { t } from '../core/i18n.js';
import { autoSave } from '../core/save.js';
import { resetRun, doPrestige } from './prestige.js';
import { CORP, CORP_SHOP_MAP, CORP_MILESTONES, CORP_HISTORY_MAX, AUTOCAST } from '../data/corp.js';

export const canCorp = () => corpUnlocked() && corpGain() >= 1;

/**
 * Konzern gründen. Zurückgesetzt: alles eines Neuguss, dazu Gussformen (Punkte, Summe, Chronik), Hochofen-Shop und normale Forschung
 * (auch mit Wissensarchiv/Konzernarchiv) samt Laboraufträgen. Bleibt: Zeitalter, Erfolge, Statistik, Neuguss-Zähler, Patente,
 * Konzern-Shop, Konzernforschung, Auto-Buyer-Schalter, Auto-Neuguss-Einstellung.
 */
export function doCorp() {
  if (!canCorp()) return false;
  const gain = corpGain();
  const entry = { gain, gussformen: state.prestige.total, time: Math.max(0, state.stats.corpRunTime || 0), at: Date.now() };
  const oldStage = corpStage();

  resetRun({ keepResearch: false, keepCorpQueue: false });
  const p = state.prestige;
  p.points = 0;
  p.total = 0;
  p.history = [];
  p.shop = {};   // Erzvorrat (start) und alle anderen Hochofen-Shop-Stufen sind weg, state.res.ore bleibt 0
  state.stats.corpRunTime = 0;
  state.focus = ''; state.focusNext = '';   // Schwerpunkt gehört zum Neuguss-Zyklus: neuer Konzern, neue Wahl

  const c = state.corp;
  c.points += gain;
  c.total += gain;
  c.count += 1;
  c.history.push(entry);
  if (c.history.length > CORP_HISTORY_MAX) c.history.splice(0, c.history.length - CORP_HISTORY_MAX);

  emit('corp', { gain });
  toast(t('Konzern gegründet: +{gain} {currency}', { gain, currency: t(CORP.currency) }), 'gold');
  const stage = corpStage();
  for (let k = oldStage; k < stage; k++) toast(t('Konzernstufe K{n}: {desc}', { n: k + 1, desc: t(CORP_MILESTONES[k].desc) }), 'gold');
  autoSave();
  return true;
}

export function buyCorpShop(id) {
  const it = CORP_SHOP_MAP[id];
  if (!it) return false;
  const lvl = corpLevel(id);
  if (lvl >= it.max) return false;
  const cost = corpCost(id);
  if (state.corp.points < cost) return false;
  state.corp.points -= cost;
  state.corp.shop[id] = lvl + 1;
  emit('corpshop', { id });
  autoSave();
  return true;
}

// ---------- Auto-Neuguss (M3) ----------
/** Mittel der letzten Neuguss-Gewinne als Vorgabe-Schwelle (mindestens 1). */
export function autoCastDefaultGain() {
  const h = state.prestige.history.slice(-AUTOCAST.history);
  return h.length ? Math.max(1, Math.round(h.reduce((a, e) => a + e.gain, 0) / h.length)) : 1;
}

/** Soll jetzt automatisch gegossen werden? (rein) */
export function autoCastDue() {
  const a = state.autoCast;
  if (!a.on || corpLevel('c_autocast') < 1) return false;
  const gain = prestigeGain();
  if (state.stats.runTime < AUTOCAST.minRun || gain < 1) return false;
  if (a.mode === 'time') return state.stats.runTime >= Math.max(AUTOCAST.minRun, (a.value > 0 ? a.value : AUTOCAST.defaultMinutes) * 60);
  return gain >= (a.value > 0 ? a.value : autoCastDefaultGain());
}

/** Einstellung ändern ({ on, mode, value }); ungültige Werte werden ignoriert. Nur nach Kauf von c_autocast. */
export function setAutoCast(patch = {}) {
  if (corpLevel('c_autocast') < 1) return false;
  const a = state.autoCast;
  if (typeof patch.on === 'boolean') a.on = patch.on;
  if (AUTOCAST.modes.includes(patch.mode)) a.mode = patch.mode;
  if (Number.isFinite(patch.value)) a.value = Math.min(Math.max(patch.value, 0), 1e12);
  emit('autocastset');
  return true;
}

let acc = 0, unlocked = false;
/** Setzt Merker zurück (nach Laden/Import/Neuguss/Gründung): kein Toast für bereits freigeschaltete Konzerngründung. */
export function reset() { acc = 0; unlocked = corpUnlocked(); }

/** Ca. 1x pro Sekunde: Freischalt-Toast und Auto-Neuguss. */
export function tick(dt = 0, force = false) {
  acc += dt;
  if (!force && acc < 1) return;
  acc = 0;
  if (!unlocked && corpUnlocked()) { unlocked = true; emit('corpunlock'); toast(t('Konzerngründung freigeschaltet'), 'gold'); }
  if (autoCastDue()) {
    const gain = prestigeGain();
    if (doPrestige()) emit('autocast', { gain });
  }
}
