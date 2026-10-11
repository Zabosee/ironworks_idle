// Auto-Buyer: kaufen im festen Takt, sofern im Prestige-Shop freigeschaltet und aktiviert.
// Priorität: Klick-Upgrades > Forschung > Boosts > Generatoren. Generatoren dürfen keine Ressource aufbrauchen,
// die für eine in Reichweite liegende Forschung/einen Boost/ein Klick-Upgrade (mit aktivem Auto-Buyer) reserviert ist.
import { state } from '../core/state.js';
import { autobuyerUnlocked, autobuyerInterval, lockReason, bulkPlan, levelOf, evoLock, evoCost, canAfford } from '../core/formulas.js';
import { buy } from './production.js';
import { buyEvo } from './evolution.js';
import { GENS } from '../data/generators.js';
import { CLICKS, BOOSTS } from '../data/upgrades.js';
import { RESEARCH } from '../data/research.js';
import { AUTOBUYERS } from '../data/prestige.js';

let acc = 0;
const opt = { silent: true };

/** Ein Ziel gilt als "in Reichweite", wenn von jeder Kostenressource mindestens dieser Anteil vorhanden ist. */
export const REACH = 0.25;
export const MIN_PASSES = 5;
export const MAX_PASSES = 50;

/** Reine Logik: Reserve (je Ressource der größte Bedarf) aus Kandidaten-Kosten, deren Anteil REACH erreicht ist. */
export function reserveOf(costs, have, reach = REACH) {
  const reserve = {};
  for (const cost of costs) {
    if (!Object.keys(cost).every(k => (have[k] || 0) >= reach * cost[k])) continue;
    for (const k in cost) reserve[k] = Math.max(reserve[k] || 0, cost[k]);
  }
  return reserve;
}

/** Reine Logik: bleibt nach Zahlung von cost für jede reservierte Ressource noch mindestens die Reserve übrig? */
export function leavesReserve(cost, reserve, have) {
  for (const k in cost) if (reserve[k] && (have[k] || 0) - cost[k] < reserve[k]) return false;
  return true;
}

/** Käufe-Durchläufe pro Takt: wächst mit dem größten Generatorbestand (5 % davon, min. 5, max. 50). */
export function passesFor(maxOwned) {
  return Math.max(MIN_PASSES, Math.min(MAX_PASSES, Math.ceil(maxOwned * 0.05)));
}

/** Kosten aller Ziele, auf die ein aktiver Auto-Buyer (Forschung/Boosts/Klick) hinarbeitet. */
export function reservedCosts() {
  const costs = [];
  if (isEnabled('research')) for (const r of RESEARCH) if (!state.research[r.id] && !lockReason('research', r.id)) costs.push(r.cost);
  if (isEnabled('boosts')) for (const b of BOOSTS) if (!state.boosts[b.id] && !lockReason('boost', b.id)) costs.push(b.cost);
  if (isEnabled('click')) for (const c of CLICKS) if (!lockReason('click', c.id)) { const p = bulkPlan('click', c.id, '1'); if (p.count) costs.push(p.cost); }
  return costs;
}

const runners = {
  gens() {
    const reserve = reserveOf(reservedCosts(), state.res);
    const passes = passesFor(Math.max(0, ...GENS.map(g => levelOf('gen', g.id))));
    for (let pass = 0; pass < passes; pass++) {
      let bought = false;
      for (const g of GENS) {
        if (lockReason('gen', g.id)) continue;
        const plan = bulkPlan('gen', g.id, '1');
        if (!plan.count || !plan.affordable || !leavesReserve(plan.cost, reserve, state.res)) continue;
        if (buy('gen', g.id, 1, opt)) bought = true;
      }
      if (!bought) break;
    }
    // Generator-Ausbauten: gleiche Reserve-Regel wie bei den Generatoren
    for (const g of GENS) {
      if (evoLock(g.id)) continue;
      const cost = evoCost(g.id);
      if (cost && canAfford(cost) && leavesReserve(cost, reserve, state.res)) buyEvo(g.id, opt);
    }
  },
  click() { for (const c of CLICKS) buy('click', c.id, 1, opt); },
  research() { for (const r of RESEARCH) if (!state.research[r.id] && !lockReason('research', r.id)) buy('research', r.id, 1, opt); },
  boosts() { for (const b of BOOSTS) if (!state.boosts[b.id]) buy('boost', b.id, 1, opt); },
};
const ORDER = ['click', 'research', 'boosts', 'gens'];

/** Setzt den Takt-Zähler zurück (nach Laden/Neuguss). */
export function reset() { acc = 0; }

export const isEnabled = id => autobuyerUnlocked(id) && !!state.autobuyers[id];
export function setEnabled(id, on) {
  if (AUTOBUYERS.some(a => a.id === id) && autobuyerUnlocked(id)) state.autobuyers[id] = !!on;
}

export function tick(dt) {
  acc += dt;
  const iv = autobuyerInterval();
  if (acc < iv) return;
  acc = Math.min(acc - iv, iv);
  for (const id of ORDER) if (isEnabled(id)) runners[id]();
}
