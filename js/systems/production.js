// Produktion, Klicks und Käufe.
import { state, addResource } from '../core/state.js';
import { rates, bulkPlan, lockReason, defOf } from '../core/formulas.js';
import { emit } from '../core/events.js';
import { RES_IDS } from '../data/resources.js';

/** Ein Spielschritt von dt Sekunden. Gibt die verwendeten Raten zurück. */
export function tick(dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return rates();
  const r = rates();
  for (const k of RES_IDS) addResource(k, r[k] * dt);
  const s = state.stats;
  s.playTime += dt;
  s.runTime += dt;
  if (r.ore > s.bestOreRate) s.bestOreRate = r.ore;
  if (state.buffs.length) {
    for (const b of state.buffs) b.left -= dt;
    const before = state.buffs.length;
    state.buffs = state.buffs.filter(b => b.left > 0);
    if (state.buffs.length !== before) emit('buffs');
  }
  return r;
}

/** Manueller Klick. Gibt den gutgeschriebenen Erzbetrag zurück. */
export function click() {
  const amount = rates().click;
  addResource('ore', amount);
  state.stats.clicks++;
  state.stats.runClicks++;
  emit('click', { amount });
  return amount;
}

/**
 * Kauft kind/id in der gewünschten Menge. Gibt true bei Erfolg zurück.
 * kind: 'gen' | 'click' | 'boost' | 'research'
 */
export function buy(kind, id, amount = state.settings.buyAmount, { silent = false } = {}) {
  if (!defOf(kind, id) || lockReason(kind, id)) return false;
  const plan = bulkPlan(kind, id, amount);
  if (!plan.count || !plan.affordable) return false;
  for (const k in plan.cost) state.res[k] -= plan.cost[k];
  for (const k of RES_IDS) if (state.res[k] < 0) state.res[k] = 0; // Rundungsschutz
  if (kind === 'gen') state.gens[id] += plan.count;
  else if (kind === 'click') state.click += plan.count;
  else if (kind === 'boost') state.boosts[id] = 1;
  else if (kind === 'research') state.research[id] = 1;
  state.stats.buys += plan.count;
  emit('buy', { kind, id, count: plan.count, silent });
  if (kind === 'research' && !silent) emit('toast', { msg: `Forschung abgeschlossen: ${defOf(kind, id).name}`, kind: 'good' });
  return true;
}
