// Prestige "Hochofen-Neuguss" und Prestige-Shop.
import { state, defaultState } from '../core/state.js';
import { prestigeGain, shopCost, shopLevel, startOre, keepsResearch } from '../core/formulas.js';
import { RESEARCH } from '../data/research.js';
import { emit, toast } from '../core/events.js';
import { t, tName } from '../core/i18n.js';
import { autoSave } from '../core/save.js';
import { resetForPrestige } from './timers.js';
import { abort as abortChallenge } from './challenges.js';
import { init as initRandomEvents } from './events-random.js';
import { CHALLENGE_MAP } from '../data/challenges.js';
import { SHOP_MAP, MILESTONES, PRESTIGE, HISTORY_MAX, FOCUS_MAP } from '../data/prestige.js';


export const canPrestige = () => prestigeGain() >= 1;

/** Wählt den Schwerpunkt für den NÄCHSTEN Durchlauf ('' = keiner). Wirkt erst mit dem Neuguss. */
export function setFocus(id) {
  if (id !== '' && !Object.hasOwn(FOCUS_MAP, id)) return false;
  state.focusNext = id;
  emit('focus', { id });
  return true;
}

/**
 * Gemeinsamer Durchlauf-Reset von Neuguss und Konzerngründung: Ressourcen, Generatoren, Klick-Upgrades, Ausbau, Boosts, Buffs,
 * Werkbank-Aufträge und Statistik des Durchlaufs (stats.run, runTime, runClicks). Konzernforschung (Feld corp) bleibt immer.
 * keepResearch: normale Forschung samt Laboraufträgen bleibt; keepCorpQueue: laufende Konzernforschungs-Aufträge bleiben.
 * Setzt weder Hochofen-Punkte noch Startvorrat (das übernimmt der Aufrufer).
 */
export function resetRun({ keepResearch, keepCorpQueue }) {
  const fresh = defaultState();
  state.res = fresh.res;
  state.gens = fresh.gens;
  state.clicks = fresh.clicks;
  state.evo = fresh.evo;   // Generator-Ausbau beginnt jeden Durchlauf neu; das Zeitalter (aus stats.total) bleibt
  state.boosts = {};
  if (!keepResearch) state.research = Object.fromEntries(RESEARCH.filter(r => r.corp && state.research[r.id]).map(r => [r.id, 1]));
  state.buffs = [];
  resetForPrestige(keepResearch, keepCorpQueue);   // Werkbank-Aufträge verfallen; Laboraufträge laufen mit Wissensarchiv weiter
  state.stats.run = fresh.stats.run;
  state.stats.runTime = 0;
  state.stats.runClicks = 0;
  const ch = state.challenges.active;
  if (ch && abortChallenge()) toast(t('Herausforderung abgebrochen: {name} (Neuguss bzw. Konzerngründung). Kein Verlust.', { name: tName('challenges', CHALLENGE_MAP[ch.id]) }), 'warn');
  initRandomEvents();   // ein offenes Zufallsereignis verfällt, das nächste wird neu geplant
}

export function doPrestige() {
  const gain = prestigeGain();
  if (gain < 1) return false;
  const oldTotal = state.prestige.total;

  // Chronik: Daten des beendeten Durchlaufs festhalten, bevor sie zurückgesetzt werden
  const runTime = Math.max(0, state.stats.runTime || 0);
  const entry = { gain, ore: state.stats.run.ore || 0, time: runTime, at: Date.now() };

  resetRun({ keepResearch: keepsResearch(), keepCorpQueue: true });
  state.res.ore = startOre();
  state.focus = state.focusNext;   // gewählter Schwerpunkt gilt ab jetzt; für den übernächsten Durchlauf neu wählen
  if (!state.autoCast?.on) state.focusNext = '';   // mit Auto-Neuguss bleibt die letzte Wahl, sonst würde der Automat ohne Schwerpunkt gießen
  state.stats.bestPrestige = Math.max(state.stats.bestPrestige, gain);
  if (runTime > 0 && (!(state.stats.fastestPrestige > 0) || runTime < state.stats.fastestPrestige)) state.stats.fastestPrestige = runTime;

  const p = state.prestige;
  p.points += gain;
  p.total += gain;
  p.count += 1;
  if (!Array.isArray(p.history)) p.history = [];
  p.history.push(entry);
  if (p.history.length > HISTORY_MAX) p.history.splice(0, p.history.length - HISTORY_MAX);

  emit('prestige', { gain });
  toast(t('{name}! +{gain} {currency}', { name: t(PRESTIGE.name), gain, currency: t(PRESTIGE.currency) }), 'gold');
  for (const m of MILESTONES) if (oldTotal < m.at && p.total >= m.at) toast(t('Meilenstein {at} {currency}: {desc}', { at: m.at, currency: t(PRESTIGE.currency), desc: t(m.desc) }), 'gold');
  autoSave();
  return true;
}

export function buyShop(id) {
  const it = SHOP_MAP[id];
  if (!it) return false;
  const lvl = shopLevel(id);
  if (lvl >= it.max) return false;
  const cost = shopCost(id);
  if (state.prestige.points < cost) return false;
  state.prestige.points -= cost;
  state.prestige.shop[id] = lvl + 1;
  emit('shop', { id });
  autoSave();
  return true;
}
