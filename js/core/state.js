// Zentraler Spielzustand (veränderbares Singleton) + kleine Zustands-Helfer.
import { RES_IDS } from '../data/resources.js';
import { GENS } from '../data/generators.js';
import { AUTOBUYERS } from '../data/prestige.js';

export const FORMAT_IDS = ['standard', 'scientific', 'engineering'];
export const BUY_AMOUNTS = ['1', '10', '100', 'max'];
export const AUTOSAVE_OPTIONS = [5, 10, 30, 60];

export function defaultState() {
  return {
    res: Object.fromEntries(RES_IDS.map(k => [k, 0])),
    gens: Object.fromEntries(GENS.map(g => [g.id, 0])),
    click: 0,
    research: {},
    boosts: {},
    prestige: { points: 0, total: 0, count: 0, shop: {} },
    autobuyers: Object.fromEntries(AUTOBUYERS.map(a => [a.id, false])),
    achievements: {},
    buffs: [],   // { id, left }  (Definition in data/golden.js)
    stats: {
      clicks: 0, runClicks: 0,
      totalOre: 0, totalSteel: 0, totalTitan: 0,
      runOre: 0, runTime: 0, playTime: 0,
      golden: 0, buys: 0, bestOreRate: 0,
      bestPrestige: 0, startedAt: Date.now(),
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

/** Schreibt Produktion gut und führt Statistik. */
export function addResource(id, amount) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  state.res[id] = Math.min(state.res[id] + amount, 1e300);
  const s = state.stats;
  if (id === 'ore') { s.totalOre += amount; s.runOre += amount; }
  else if (id === 'steel') s.totalSteel += amount;
  else if (id === 'titan') s.totalTitan += amount;
}
