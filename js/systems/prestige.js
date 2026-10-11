// Prestige "Hochofen-Neuguss" und Prestige-Shop.
import { state, defaultState } from '../core/state.js';
import { prestigeGain, shopCost, shopLevel, startOre } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { autoSave } from '../core/save.js';
import { SHOP_MAP, MILESTONES, PRESTIGE } from '../data/prestige.js';

export const canPrestige = () => prestigeGain() >= 1;

export function doPrestige() {
  const gain = prestigeGain();
  if (gain < 1) return false;
  const fresh = defaultState();
  const oldTotal = state.prestige.total;

  state.res = fresh.res;
  state.res.ore = startOre();
  state.gens = fresh.gens;
  state.clicks = fresh.clicks;
  state.boosts = {};
  if (shopLevel('keep') < 1) state.research = {};
  state.buffs = [];

  state.stats.run = fresh.stats.run;
  state.stats.runTime = 0;
  state.stats.runClicks = 0;
  state.stats.bestPrestige = Math.max(state.stats.bestPrestige, gain);

  const p = state.prestige;
  p.points += gain;
  p.total += gain;
  p.count += 1;

  emit('prestige', { gain });
  toast(`${PRESTIGE.name}! +${gain} ${PRESTIGE.currency}`, 'gold');
  for (const m of MILESTONES) if (oldTotal < m.at && p.total >= m.at) toast(`Meilenstein ${m.at} ${PRESTIGE.currency}: ${m.desc}`, 'gold');
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
