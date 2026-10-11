// Zentraler Spielzustand (veränderbares Singleton) + kleine Zustands-Helfer.
import { RES_IDS } from '../data/resources.js';
import { GENS } from '../data/generators.js';
import { CLICKS } from '../data/upgrades.js';
import { AUTOBUYERS } from '../data/prestige.js';
import { QUEUE_IDS } from '../data/timers.js';

export const FORMAT_IDS = ['standard', 'scientific', 'engineering'];
export const BUY_AMOUNTS = ['1', '10', '100', 'max'];
export const AUTOSAVE_OPTIONS = [5, 10, 30, 60];

export function defaultState() {
  return {
    res: Object.fromEntries(RES_IDS.map(k => [k, 0])),
    gens: Object.fromEntries(GENS.map(g => [g.id, 0])),
    clicks: Object.fromEntries(CLICKS.map(c => [c.id, 0])),   // Stufen der wiederholbaren Klick-Upgrades
    research: {},
    boosts: {},
    timers: Object.fromEntries(QUEUE_IDS.map(q => [q, []])),   // Warteschlangen: je [{ kind, id, total, left, cost }], die ersten `slots` Einträge laufen
    prestige: { points: 0, total: 0, count: 0, shop: {}, history: [] },   // history: letzte Neugüsse { gain, ore, time, at }, älteste zuerst
    autobuyers: Object.fromEntries(AUTOBUYERS.map(a => [a.id, false])),
    achievements: {},
    buffs: [],   // { id, left }  (Definition in data/golden.js)
    stats: {
      clicks: 0, runClicks: 0,
      total: Object.fromEntries(RES_IDS.map(k => [k, 0])),   // je Ressource insgesamt produziert
      run: Object.fromEntries(RES_IDS.map(k => [k, 0])),     // je Ressource in diesem Durchlauf produziert
      runTime: 0, playTime: 0,
      golden: 0, buys: 0, bestOreRate: 0, timersDone: 0,
      bestPrestige: 0, fastestPrestige: 0, startedAt: Date.now(),
    },
    settings: { format: 'standard', autosave: true, autosaveSec: 10, particles: true, buyAmount: '1' },
    savedAt: 0,
  };
}

export const state = defaultState();

/** Ersetzt den Inhalt des Singletons, damit alle Importe gültig bleiben. */
export function replaceState(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
}

/** Schreibt immer ins aktuelle state.settings (bleibt nach replaceState gueltig). */
export function setSetting(key, value) { state.settings[key] = value; }

/** Schreibt Produktion gut und führt Statistik. */
export function addResource(id, amount) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  const cap = 1e300, s = state.stats;
  state.res[id] = Math.min(state.res[id] + amount, cap);
  s.total[id] = Math.min((s.total[id] || 0) + amount, cap);
  s.run[id] = Math.min((s.run[id] || 0) + amount, cap);
}
