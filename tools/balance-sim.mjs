#!/usr/bin/env node
// Balance-Simulation der Prestige-Schleife: gieriger Bot gegen die echten Spielmodule (kein Mock der Formeln).
//
//   node tools/balance-sim.mjs [Stunden=48] [Klicks/s=4] [Neuguss-Anteil=0.5] [dt=2]
//
// Der Bot klickt, kauft Forschung/Boosts/Klick-Upgrades/Generatoren nach Amortisation und führt einen Neuguss durch,
// sobald der Gewinn >= Anteil * bisher verdiente Gussformen (und mindestens 1) beträgt und der Durchlauf mind. MIN_RUN s
// alt ist. Gussformen werden nach fester Prioritätsliste im Shop ausgegeben. Die Zeit entspricht aktiver Spielzeit
// (Offline-Ertrag ist nicht eingerechnet: Obergrenze für die Dauer, Offline-Spiel macht es schneller).
// Importierbar: simulate(opts) -> { milestones, prestiges, shop, hours }.
import { state, replaceState, defaultState } from '../js/core/state.js';
import * as F from '../js/core/formulas.js';
import * as P from '../js/systems/production.js';
import { doPrestige, buyShop } from '../js/systems/prestige.js';
import { GENS } from '../js/data/generators.js';
import { ERAS } from '../js/data/eras.js';
import { buyEvo } from '../js/systems/evolution.js';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { MILESTONES, SHOP, PRESTIGE } from '../js/data/prestige.js';

if (typeof globalThis.localStorage === 'undefined') {
  const m = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, clear: () => m.clear() } });
}

// Grobe Wertigkeit je Ressource (in Erz) für die Amortisationsrechnung
const W = { ore: 1, steel: 20, titan: 1500, coal: 15, coke: 60, copper: 80, manganese: 150, chrome: 600, nickel: 600, alloy: 2000, tungsten: 20000, gold: 2e5 };
const worth = c => Object.entries(c).reduce((a, [k, v]) => a + v * (W[k] || 1), 0);

/** Kaufreihenfolge im Shop: [id, Zielstufe]; es wird der erste noch nicht erreichte, bezahlbare Eintrag gekauft. */
export const SHOP_PLAN = [
  ['click', 1], ['start', 1], ['pp_eff', 1], ['pp_gain', 1], ['q_speed', 1], ['q_lab', 1], ['q_work', 1],
  ['pp_eff', 3], ['pp_gain', 3], ['click', 3], ['q_speed', 3], ['keep', 1], ['offline', 1], ['ab_gens', 1], ['ab_click', 1],
  ['pp_eff', 5], ['pp_gain', 5], ['q_lab', 2], ['q_work', 2], ['golden', 1], ['ab_boosts', 1], ['ab_research', 1],
  ['pp_eff', 10], ['pp_gain', 10], ['q_speed', 6], ['q_lab', 3], ['q_work', 3], ['click', 10], ['start', 5], ['offline', 5], ['golden', 5], ['ab_speed', 4],
];

function buyGens(max = 30, pbLimit = 3000) {
  const need = new Set();
  const add = c => { for (const k in c) if (state.res[k] < c[k]) need.add(k); };
  for (const r of RESEARCH) if (!state.research[r.id] && !F.lockReason('research', r.id)) add(r.cost);
  for (const b of BOOSTS) if (!state.boosts[b.id] && !F.lockReason('boost', b.id)) add(b.cost);
  for (let n = 0; n < max; n++) {
    let best = null;
    for (const g of GENS) {
      if (F.lockReason('gen', g.id)) continue;
      const plan = F.bulkPlan('gen', g.id, 1);
      if (!plan.affordable) continue;
      const lvl = F.genLevel(g.id);
      const gain = (F.genOutputAt(g, lvl + 1) - F.genOutputAt(g, lvl)) * W[g.res];
      let pb = worth(plan.cost) / Math.max(gain, 1e-12);
      if (need.has(g.res)) pb = Math.min(pb, 1000 + 0.001 * pb);
      if (!best || pb < best.pb) best = { g, pb };
    }
    if (!best || best.pb > pbLimit) break;
    P.buy('gen', best.g.id, 1);
  }
}

/** Ausbauten: kaufen, sobald bezahlbar und die Kosten höchstens 40 % des (gewichteten) Vorrats ausmachen. */
function buyEvos() {
  for (let again = true; again;) {
    again = false;
    for (const g of GENS) {
      if (F.evoLock(g.id)) continue;
      const cost = F.evoCost(g.id);
      if (cost && F.canAfford(cost) && worth(cost) < 0.4 * worth(state.res) && buyEvo(g.id, { silent: true })) again = true;
    }
  }
}

function spendShop(log) {
  for (let again = true; again;) {
    again = false;
    for (const [id, lvl] of SHOP_PLAN) {
      if (F.shopLevel(id) >= lvl) continue;
      if (state.prestige.points >= F.shopCost(id) && buyShop(id)) { log?.push(id + F.shopLevel(id)); again = true; }
      break;   // erst der erste offene Eintrag; wird gespart, wenn er noch nicht bezahlbar ist
    }
  }
}

/**
 * opts: hours (Obergrenze der aktiven Spielzeit), clicksPerSec, frac (Neuguss ab Gewinn >= frac * Gesamt),
 *       minRun (min. Sekunden je Durchlauf), dt (Schrittweite), stopAtAll (Abbruch, wenn alle Meilensteine erreicht).
 */
export function simulate({ hours = 48, clicksPerSec = 4, frac = 0.5, policy = 'rate', minGain = 3, minRun = 300, dt = 2, stopAtAll = false, probe = [] } = {}) {
  replaceState(defaultState());
  state.settings.autosave = false;
  const milestones = {}, prestiges = [], shopLog = [], eraTimes = {}, probes = {};
  let t = 0;
  const hist = [], WIN = 120;
  while (t < hours * 3600) {
    for (let i = 0, n = Math.round(clicksPerSec * dt); i < n; i++) P.click();
    P.tick(dt); t += dt;
    for (const r of RESEARCH) if (!state.research[r.id] && !F.lockReason('research', r.id)) P.buy('research', r.id);
    for (const b of BOOSTS) if (!state.boosts[b.id] && !F.lockReason('boost', b.id)) P.buy('boost', b.id);
    for (const c of CLICKS) if (!F.lockReason('click', c.id) && worth(F.bulkPlan('click', c.id, 1).cost) < 0.3 * state.res.ore) P.buy('click', c.id);
    buyGens();
    buyEvos();
    for (let i = 1; i < ERAS.length; i++) if (!(i in eraTimes) && F.eraIndex() >= i) eraTimes[i] = t;
    for (const ph of probe) if (!(ph in probes) && t >= ph * 3600) probes[ph] = state.stats.total.ore;
    const gain = F.prestigeGain();
    let go = false;
    if (state.stats.runTime < 5) hist.length = 0;
    if (gain >= minGain && state.stats.runTime >= minRun) {
      if (policy === 'frac') go = gain >= frac * state.prestige.total;
      else {   // 'rate': Neuguss, sobald die Gewinn-Zuwachsrate unter frac * Durchlauf-Schnitt (Gussformen je Sekunde) fällt
        hist.push([state.stats.runTime, gain]);
        while (hist.length > 1 && state.stats.runTime - hist[1][0] >= WIN) hist.shift();
        const [t0, g0] = hist[0];
        go = state.stats.runTime - t0 >= WIN * 0.9 && (gain - g0) / (state.stats.runTime - t0) < frac * gain / state.stats.runTime;
      }
    }
    if (go) {
      hist.length = 0;
      const runTime = state.stats.runTime;
      doPrestige();
      prestiges.push({ t, runTime, gain, total: state.prestige.total, count: state.prestige.count });
      spendShop(shopLog);
      for (const m of MILESTONES) if (!(m.at in milestones) && state.prestige.total >= m.at) milestones[m.at] = { t, count: state.prestige.count };
      if (stopAtAll && Object.keys(milestones).length === MILESTONES.length) break;
    }
  }
  return { probes, eraTimes, milestones, prestiges, shop: Object.fromEntries(SHOP.map(s => [s.id, F.shopLevel(s.id)])), shopLog, hours: t / 3600, total: state.prestige.total };
}

const fh = s => (s < 3600 ? `${(s / 60).toFixed(0)} min` : `${(s / 3600).toFixed(1)} h`);

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const [hours = 48, clicksPerSec = 4, frac = 0.5, dt = 2, policy = 'rate'] = process.argv.slice(2);
  const r = simulate({ hours: +hours, clicksPerSec: +clicksPerSec, frac: +frac, dt: +dt, policy });
  console.log(`growth=${PRESTIGE.growth} perPoint=${PRESTIGE.perPoint} frac=${frac} clicks/s=${clicksPerSec}`);
  r.prestiges.slice(0, 40).forEach(p => console.log(`#${p.count} bei ${fh(p.t)} (Durchlauf ${fh(p.runTime)}) +${p.gain} -> ${p.total}`));
  console.log(`... ${r.prestiges.length} Neugüsse, ${r.hours.toFixed(1)} h, Gesamt ${r.total}`);
  ERAS.slice(1).forEach((e, i) => console.log(`Zeitalter ${e.name}: ${r.eraTimes[i + 1] !== undefined ? fh(r.eraTimes[i + 1]) : 'NICHT erreicht'}`));
  for (const m of MILESTONES) console.log(`Meilenstein ${m.at}: ${r.milestones[m.at] ? fh(r.milestones[m.at].t) + ' (Neuguss ' + r.milestones[m.at].count + ')' : 'NICHT erreicht'}`);
  console.log('Shop:', JSON.stringify(r.shop));
  console.log('Käufe:', r.shopLog.join(' '));
}
