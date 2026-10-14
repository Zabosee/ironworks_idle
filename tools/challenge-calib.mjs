#!/usr/bin/env node
// Kalibrierung der Herausforderungen (js/data/challenges.js): der Balance-Bot spielt normal und forkt an Messpunkten den Zustand;
// im Fork startet er jede Herausforderung und spielt sie mit demselben Bot-Schritt bis Ziel oder Frist, danach wird der Zustand zurückgesetzt.
//   [MINRUN=Sekunden kürzester Bot-Durchlauf, Standard 300; 3600 = Bot spielt lange Durchläufe wie ein Mensch]
//   node tools/challenge-calib.mjs [Stunden=6] [Klicks/s=4] [Name.Feld=Wert ...]    z. B. noclick.k=300 iron.floor=1e6
// Ausgabe je Messpunkt und Herausforderung: Ziel, Fertigstellung als Anteil der Frist ("--" = gescheitert, dann Anteil des Ziels).
import { state, replaceState } from '../js/core/state.js';
import * as F from '../js/core/formulas.js';
import * as P from '../js/systems/production.js';
import * as C from '../js/systems/challenges.js';
import { simulate, buyGens, buyEvos } from './balance-sim.mjs';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { addResource } from '../js/core/state.js';
import { CHALLENGES, CHALLENGE_MIN_RUN } from '../js/data/challenges.js';

const args = process.argv.slice(2), over = args.filter(a => a.includes('=')), pos = args.filter(a => !a.includes('='));
for (const o of over) { const [p, v] = o.split('='), [id, f] = p.split('.'); CHALLENGES.find(c => c.id === id)[f] = Number(v); }
const [hours = 6, cps = 4] = pos.map(Number);
const DT = 2;
const PROBE = process.env.PROBE === '1';   // PROBE=1: ohne Ziel spielen und k_eff = erzeugter Stahl / (Startrate x Frist) ausgeben (k muss darunter liegen)

function botStep() {
  const n = Math.round(cps * DT);
  if (n > 0) { addResource('ore', F.rates().click * n); state.stats.clicks += n; state.stats.runClicks += n; }
  P.tick(DT);
  for (const r of RESEARCH) if (!state.research[r.id] && !F.lockReason('research', r.id)) P.buy('research', r.id);
  for (const b of BOOSTS) if (!state.boosts[b.id] && !F.lockReason('boost', b.id)) P.buy('boost', b.id);
  for (const c of CLICKS) if (!F.lockReason('click', c.id) && F.bulkPlan('click', c.id, 1).affordable) P.buy('click', c.id);
  buyGens(); buyEvos();
}

function runChallenge(id) {
  if (!C.start(id)) return null;
  const a = state.challenges.active, goal = a.goal, time = a.left;
  if (PROBE) { const r0 = F.rates().steel; a.goal = 1e300; let u = 0; while (u < time) { botStep(); C.tick(DT); u += DT; } return { goal, ok: true, frac: 0, prog: 1, keff: (state.stats.total.steel - a.base) / (r0 * time), rate0: r0 }; }
  let used = 0;
  while (state.challenges.active && used < time + DT) { botStep(); C.tick(DT); used += DT; }
  const ok = !!state.challenges.done[id];
  return { goal, ok, frac: ok ? used / time : 0, prog: ok ? 1 : (state.stats.total.steel - a.base) / goal };
}

const points = [], fired = new Set();
for (const count of [1, 3, 8, 15, 30]) for (const rt of [CHALLENGE_MIN_RUN, 2400, 3600, 7200]) points.push({ label: `Neuguss ${count}, ${rt} s`, ok: () => state.prestige.count === count && state.stats.runTime >= rt });
points.push({ label: '5 h', ok: s => s >= 5 * 3600 && state.stats.runTime >= CHALLENGE_MIN_RUN });
const rows = [];
simulate({ hours: +hours, clicksPerSec: +cps, dt: DT, corp: false, minRun: +(process.env.MINRUN || 300), onStep: t => {
  for (const p of points) {
    if (fired.has(p.label) || !p.ok(t)) continue;
    fired.add(p.label);
    const snap = JSON.stringify(state);
    const line = { label: p.label };
    for (const c of CHALLENGES) {
      line[c.id] = runChallenge(c.id);
      replaceState(JSON.parse(snap));
    }
    rows.push(line);
  }
} });
const cell = r => PROBE ? (r ? `k_eff ${r.keff.toExponential(2)} (Rate0 ${r.rate0.toExponential(1)})` : 'n/a') : (!r ? 'n/a' : r.ok ? `${(r.frac * 100).toFixed(0)} %` : `-- (${(r.prog * 100).toFixed(0)} % des Ziels)`) + (r ? ` [Ziel ${r.goal.toExponential(1)}]` : '');
for (const r of rows) console.log(r.label.padEnd(22), CHALLENGES.map(c => `${c.id}: ${cell(r[c.id])}`).join('   '));
