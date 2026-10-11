// Auto-Buyer: kaufen im festen Takt, sofern im Prestige-Shop freigeschaltet und aktiviert.
import { state } from '../core/state.js';
import { autobuyerUnlocked, autobuyerInterval, lockReason } from '../core/formulas.js';
import { buy } from './production.js';
import { GENS } from '../data/generators.js';
import { BOOSTS } from '../data/upgrades.js';
import { RESEARCH } from '../data/research.js';
import { AUTOBUYERS } from '../data/prestige.js';

let acc = 0;
const opt = { silent: true };

const runners = {
  gens() { for (let pass = 0; pass < 5; pass++) for (const g of GENS) buy('gen', g.id, 1, opt); },
  click() { buy('click', 'click', 1, opt); },
  research() { for (const r of RESEARCH) if (!state.research[r.id] && !lockReason('research', r.id)) buy('research', r.id, 1, opt); },
  boosts() { for (const b of BOOSTS) if (!state.boosts[b.id]) buy('boost', b.id, 1, opt); },
};

export const isEnabled = id => autobuyerUnlocked(id) && !!state.autobuyers[id];
export function setEnabled(id, on) {
  if (AUTOBUYERS.some(a => a.id === id) && autobuyerUnlocked(id)) state.autobuyers[id] = !!on;
}

export function tick(dt) {
  acc += dt;
  const iv = autobuyerInterval();
  if (acc < iv) return;
  acc = Math.min(acc - iv, iv);
  for (const a of AUTOBUYERS) if (isEnabled(a.id)) runners[a.id]();
}
