// Reine Berechnungen auf Basis des Zustands. Kein DOM, keine Seiteneffekte.
import { state } from './state.js';
import { RES_IDS } from '../data/resources.js';
import { GENS, GEN_MAP, MILESTONE_STEP, ELITE_FROM, ELITE_GROWTH, MAX_LEVEL, EXTRA_MILESTONES } from '../data/generators.js';
import { CLICK, BOOSTS, BOOST_MAP } from '../data/upgrades.js';
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { PRESTIGE, SHOP_MAP, MILESTONES, AUTOBUYERS, AUTOBUYER_INTERVAL } from '../data/prestige.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUFFS } from '../data/golden.js';

const CAP = 1e300;
/** Schützt vor NaN/Infinity. */
export const safe = x => (Number.isNaN(x) ? 0 : Math.min(x, CAP));

// ---------- Hilfen für Kosten-Objekte ----------
export const canAfford = cost => Object.entries(cost).every(([k, v]) => state.res[k] >= v);
export function addCost(a, b) {
  const out = { ...a };
  for (const k in b) out[k] = safe((out[k] || 0) + b[k]);
  return out;
}

// ---------- Prestige-Shop ----------
export const shopLevel = id => state.prestige.shop[id] || 0;
export const shopCost = id => {
  const it = SHOP_MAP[id];
  return Math.ceil(safe(it.cost * it.growth ** shopLevel(id)));
};

// ---------- Multiplikator-Stapel ----------
export function milestone(n) {
  let m = 2 ** Math.floor(n / MILESTONE_STEP);
  if (state.research.precision) m *= 2 ** EXTRA_MILESTONES.filter(t => n >= t).length;
  return m;
}

export function researchMult(res) {
  let m = 1;
  for (const r of RESEARCH) if (state.research[r.id] && r.mult) m *= (r.mult[res] ?? 1) * (r.mult.all ?? 1);
  for (const b of BOOSTS) if (state.boosts[b.id]) m *= (b.mult[res] ?? 1) * (b.mult.all ?? 1);
  return m;
}

export function achievementBonus() {
  let sum = 0;
  for (const a of ACHIEVEMENTS) if (state.achievements[a.id]) sum += a.bonus;
  return sum;
}
export const achievementMult = () => 1 + achievementBonus();

export function prestigeMult(total = state.prestige.total) {
  const eff = 1 + 0.2 * shopLevel('pp_eff');
  let m = 1 + total * PRESTIGE.perPoint * eff;
  for (const ms of MILESTONES) if (total >= ms.at) m *= ms.mult;
  return m;
}

export function buffMult(kind) {
  let m = 1;
  for (const b of state.buffs) {
    const def = BUFFS[b.id];
    if (def && def.kind === kind && b.left > 0) m *= def.mult;
  }
  return m;
}

/** Alles, was auf jede Produktion wirkt (außer Forschung/Boosts). */
export const globalMult = () => prestigeMult() * achievementMult() * buffMult('prod');
export const mult = res => safe(researchMult(res) * globalMult());

// ---------- Produktion ----------
export const genLevel = id => state.gens[id] || 0;
export const genOutputAt = (g, n, gm = globalMult()) => safe(g.base * n * milestone(n) * researchMult(g.res) * gm);

export function clickBaseAt(n, gm = globalMult()) {
  return safe((1 + 2 * n) * milestone(n) * researchMult('ore') * gm * (1 + 0.5 * shopLevel('click')));
}

/** Gesamte Produktionsraten pro Sekunde plus Klickwert. */
export function rates() {
  const gm = globalMult();
  const r = { ore: 0, steel: 0, titan: 0, conv: 0, click: 0 };
  for (const g of GENS) {
    const n = genLevel(g.id);
    if (n > 0) r[g.res] += genOutputAt(g, n, gm);
  }
  const cm = buffMult('click');
  r.click = safe((clickBaseAt(state.click, gm) + (state.research.resonance ? 0.05 * r.ore : 0)) * cm);
  if (state.research.autoclick) r.ore += 5 * r.click;
  if (state.research.converter) {
    r.conv = r.ore * 0.2;
    r.ore -= r.conv;
    r.steel += r.conv / 25;
  }
  for (const k of RES_IDS) r[k] = safe(r[k]);
  return r;
}

// ---------- Kosten ----------
export const eliteCost = (n, base) => (n >= ELITE_FROM ? Math.ceil(safe(base * ELITE_GROWTH ** (n - ELITE_FROM))) : 0);

/** Kosten für Kauf der Stufe (lvl+1) von kind ('gen' | 'click'). */
export function unitCost(kind, id, lvl) {
  if (kind === 'gen') {
    const g = GEN_MAP[id], c = {};
    for (const k in g.cost) c[k] = Math.ceil(safe(g.cost[k] * g.growth ** lvl));
    if (lvl >= ELITE_FROM) c.titan = (c.titan || 0) + eliteCost(lvl, g.elite);
    return c;
  }
  const c = { ore: Math.ceil(safe(CLICK.oreBase * CLICK.oreGrowth ** lvl)) };
  if (lvl >= CLICK.steelFrom) c.steel = Math.ceil(safe(CLICK.steelBase * CLICK.steelGrowth ** (lvl - CLICK.steelFrom)));
  if (lvl >= CLICK.eliteFrom) c.titan = eliteCost(lvl, CLICK.eliteBase);
  return c;
}

export function levelOf(kind, id) {
  if (kind === 'gen') return genLevel(id);
  if (kind === 'click') return state.click;
  if (kind === 'boost') return state.boosts[id] ? 1 : 0;
  if (kind === 'research') return state.research[id] ? 1 : 0;
  return 0;
}

export function defOf(kind, id) {
  return kind === 'gen' ? GEN_MAP[id] : kind === 'boost' ? BOOST_MAP[id] : kind === 'research' ? RESEARCH_MAP[id] : CLICK;
}

/** Liefert null, wenn kaufbar, sonst Begründung. */
export function lockReason(kind, id) {
  if (kind === 'gen') {
    const req = GEN_MAP[id].req;
    return req && !state.research[req] ? `Benötigt Forschung: ${RESEARCH_MAP[req].name}` : null;
  }
  if (kind === 'research') {
    const miss = (RESEARCH_MAP[id].req || []).filter(q => !state.research[q]);
    return miss.length ? 'Benötigt: ' + miss.map(q => RESEARCH_MAP[q].name).join(', ') : null;
  }
  return null;
}

const MAX_BULK = 1000;
/**
 * Kaufplan: { count, cost, affordable }.
 * amount: Zahl/String '1' | '10' | '100' | 'max'. Einmalkäufe (boost/research) ignorieren amount.
 */
export function bulkPlan(kind, id, amount = '1') {
  const lvl = levelOf(kind, id);
  if (kind === 'boost' || kind === 'research') {
    if (lvl) return { count: 0, cost: {}, affordable: false };
    const cost = defOf(kind, id).cost;
    return { count: 1, cost, affordable: canAfford(cost) };
  }
  const isMax = amount === 'max';
  const want = isMax ? MAX_BULK : Math.max(1, Number(amount) || 1);
  let total = {}, count = 0;
  for (let i = 0; i < want && lvl + i < MAX_LEVEL; i++) {
    const next = addCost(total, unitCost(kind, id, lvl + i));
    if (isMax && !canAfford(next)) break;
    total = next; count++;
  }
  if (count === 0) {
    // Max: nicht einmal 1 Stufe bezahlbar -> Preis der nächsten Stufe zeigen
    return { count: 0, cost: lvl < MAX_LEVEL ? unitCost(kind, id, lvl) : {}, affordable: false };
  }
  return { count, cost: total, affordable: canAfford(total) };
}

// ---------- Prestige ----------
export function prestigeGain(runOre = state.stats.runOre) {
  if (runOre < PRESTIGE.minRun) return 0;
  const base = Math.floor(Math.pow(runOre / PRESTIGE.divisor, PRESTIGE.exponent));
  return Math.floor(safe(base * (1 + 0.1 * shopLevel('pp_gain'))));
}

/** Erz (in diesem Durchlauf), ab dem es einen Punkt mehr gibt. */
export function oreForGain(gain) {
  const mult = 1 + 0.1 * shopLevel('pp_gain');
  const oreOf = b => Math.max(PRESTIGE.minRun, PRESTIGE.divisor * b ** (1 / PRESTIGE.exponent));
  // Exakt konsistent mit prestigeGain: kleinste Basis, deren Gewinn >= gain+1 ist.
  const ok = b => Math.floor(safe(b * mult)) >= gain + 1 && prestigeGain(oreOf(b)) >= gain + 1;
  let need = Math.max(1, Math.ceil((gain + 1) / mult - 1e-9));
  for (let i = 0; i < 4 && !ok(need); i++) need++;
  while (need > 1 && ok(need - 1)) need--;
  return oreOf(need);
}

export const startOre = () => {
  const l = shopLevel('start');
  return l > 0 ? 500 * 3 ** (l - 1) : 0;
};
export const offlineCapSeconds = () => (8 + 2 * shopLevel('offline')) * 3600;

// ---------- Auto-Buyer ----------
export const autobuyerUnlocked = id => shopLevel(AUTOBUYERS.find(a => a.id === id).unlock) > 0;
export const autobuyerInterval = () => AUTOBUYER_INTERVAL / (1 + 0.5 * shopLevel('ab_speed'));

// ---------- Golden ----------
export const goldenFreq = () => 1 + 0.1 * shopLevel('golden');
export const goldenDuration = () => 1 + 0.1 * shopLevel('golden');

// ---------- Forschungsbaum: Tiefe für Gruppierung ----------
export function researchDepth(id) {
  const r = RESEARCH_MAP[id];
  return r.req ? 1 + Math.max(...r.req.map(researchDepth)) : 0;
}
