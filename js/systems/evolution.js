// Generator-Ausbau (Zeitalter-System): sofortiger Kauf ohne Timer. Stufe k braucht Zeitalter >= k und Generatorstufe >= EVO_AT[k-1].
import { state } from '../core/state.js';
import { GENS } from '../data/generators.js';
import { RES_IDS } from '../data/resources.js';
import { evoCost, evoLock, evoLevel, canAfford } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { t, tName } from '../core/i18n.js';
import { GEN_MAP } from '../data/generators.js';

/** Kauft die nächste Ausbaustufe des Generators. Gibt true bei Erfolg zurück. */
export function buyEvo(id, { silent = false } = {}) {
  if (!GEN_MAP[id] || evoLock(id)) return false;
  const cost = evoCost(id);
  if (!cost || !canAfford(cost)) return false;
  for (const k in cost) state.res[k] -= cost[k];
  for (const k of RES_IDS) if (state.res[k] < 0) state.res[k] = 0;   // Rundungsschutz
  state.evo[id] = evoLevel(id) + 1;
  state.stats.buys += 1;
  emit('evo', { id, level: state.evo[id], silent });
  if (!silent) toast(t('{name}: Ausbau {n} abgeschlossen', { name: tName('generators', GEN_MAP[id]), n: state.evo[id] }), 'gold');
  return true;
}

/** Kauft alle derzeit möglichen Ausbaustufen (billigste Reihenfolge ist egal, jede Stufe wird einzeln geprüft). Gibt die Anzahl zurück. */
export function buyAllEvo() {
  let n = 0, again = true;
  while (again) {
    again = false;
    for (const g of GENS) if (buyEvo(g.id, { silent: true })) { n++; again = true; }
  }
  if (n) toast(n > 1 ? t('{n} Ausbauten gekauft', { n }) : t('1 Ausbau gekauft'), 'gold');
  return n;
}
