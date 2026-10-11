// Reine Berechnungen auf Basis des Zustands. Kein DOM, keine Seiteneffekte.
import { state } from './state.js';
import { RES_IDS } from '../data/resources.js';
import { GENS, GEN_MAP, MILESTONE_STEP, ELITE_FROM, ELITE_GROWTH, MAX_LEVEL, EXTRA_MILESTONES } from '../data/generators.js';
import { CLICKS, CLICK_MAP, BOOSTS, BOOST_MAP } from '../data/upgrades.js';
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { RECIPES } from '../data/recipes.js';
import { PRESTIGE, SHOP_MAP, MILESTONES, AUTOBUYERS, AUTOBUYER_INTERVAL } from '../data/prestige.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUFFS } from '../data/golden.js';

const CAP = 1e300;
/** Schützt vor NaN/Infinity: NaN -> 0, Werte auf [-CAP, CAP] begrenzt. */
export const safe = x => (Number.isNaN(x) ? 0 : Math.max(-CAP, Math.min(x, CAP)));

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

export const clickLevel = id => state.clicks[id] || 0;

/** Klickwert-Beitrag eines Klick-Upgrades auf Stufe n (ohne Resonanz/Buffs). */
export function clickBaseAt(n, gm = globalMult(), def = CLICKS[0]) {
  return safe((def.base + def.perLevel * n) * milestone(n) * researchMult('ore') * gm * (1 + 0.5 * shopLevel('click')));
}

/** Summe der Beiträge aller Klick-Upgrades auf den aktuellen Stufen. */
export function clickBaseTotal(gm = globalMult()) {
  let sum = 0;
  for (const c of CLICKS) sum += clickBaseAt(clickLevel(c.id), gm, c);
  return safe(sum);
}

/** Zyklen/s eines Rezepts bei gegebener Brutto-Produktion (Map res -> Rate). */
export function recipeCycles(rc, gross) {
  let cycles = Infinity;
  for (const k in rc.inputs) cycles = Math.min(cycles, (rc.share * (gross[k] || 0)) / rc.inputs[k]);
  return Number.isFinite(cycles) && cycles > 0 ? cycles : 0;
}

export const recipeActive = rc => (rc.req || []).every(q => state.research[q]);

/**
 * Gesamte Produktionsraten pro Sekunde.
 * Ergebnis: { <jede Ressource aus RES_IDS>: Nettorate, click: Wert eines manuellen Klicks (inkl. Klick-Buff),
 *             flows: [{ id, cycles, inputs, outputs }] je aktivem Rezept }.
 * Der Klick-Buff (Hammerwut) wirkt nur auf manuelle Klicks, nicht auf Autoklick.
 */
export function rates() {
  const gm = globalMult();
  const r = Object.fromEntries(RES_IDS.map(k => [k, 0]));
  for (const g of GENS) {
    const n = genLevel(g.id);
    if (n > 0) r[g.res] += genOutputAt(g, n, gm);
  }
  const clickRaw = safe(clickBaseTotal(gm) + (state.research.resonance ? 0.05 * r.ore : 0));
  r.click = safe(clickRaw * buffMult('click'));
  if (state.research.autoclick) r.ore += 5 * clickRaw;
  r.flows = [];
  for (const rc of RECIPES) {
    if (!recipeActive(rc)) continue;
    const cycles = recipeCycles(rc, r);
    const flow = { id: rc.id, cycles, inputs: {}, outputs: {} };
    for (const k in rc.inputs) { flow.inputs[k] = cycles * rc.inputs[k]; r[k] -= flow.inputs[k]; }
    for (const k in rc.outputs) { flow.outputs[k] = cycles * rc.outputs[k]; r[k] += flow.outputs[k]; }
    r.flows.push(flow);
  }
  for (const k of RES_IDS) r[k] = safe(r[k]);
  return r;
}

// ---------- Kosten ----------
export const eliteCost = (n, base) => (n >= ELITE_FROM ? Math.ceil(safe(base * ELITE_GROWTH ** (n - ELITE_FROM))) : 0);

/** Kosten für Kauf der Stufe (lvl+1) von kind ('gen' | 'click'); rein, hängt nur von kind/id/lvl ab. */
export function unitCost(kind, id, lvl) {
  if (kind === 'gen') {
    const g = GEN_MAP[id], c = {};
    for (const k in g.cost) c[k] = Math.ceil(safe(g.cost[k] * g.growth ** lvl));
    if (lvl >= ELITE_FROM) c.titan = (c.titan || 0) + eliteCost(lvl, g.elite);
    return c;
  }
  const d = CLICK_MAP[id];
  const c = { ore: Math.ceil(safe(d.oreBase * d.oreGrowth ** lvl)) };
  if (lvl >= d.steelFrom) c.steel = Math.ceil(safe(d.steelBase * d.steelGrowth ** (lvl - d.steelFrom)));
  if (lvl >= d.eliteFrom) c.titan = eliteCost(lvl, d.eliteBase);
  return c;
}

export function levelOf(kind, id) {
  if (kind === 'gen') return genLevel(id);
  if (kind === 'click') return clickLevel(id);
  if (kind === 'boost') return state.boosts[id] ? 1 : 0;
  if (kind === 'research') return state.research[id] ? 1 : 0;
  return 0;
}

export function defOf(kind, id) {
  return kind === 'gen' ? GEN_MAP[id] : kind === 'boost' ? BOOST_MAP[id] : kind === 'research' ? RESEARCH_MAP[id] : kind === 'click' ? CLICK_MAP[id] : undefined;
}

/** GEN.req darf String oder Array sein. */
export const reqList = req => (req == null ? [] : Array.isArray(req) ? req : [req]);

/** Liefert null, wenn kaufbar, sonst Begründung. */
export function lockReason(kind, id) {
  if (kind === 'gen') {
    const miss = reqList(GEN_MAP[id].req).filter(q => !state.research[q]);
    return miss.length ? 'Benötigt Forschung: ' + miss.map(q => RESEARCH_MAP[q].name).join(', ') : null;
  }
  if (kind === 'research') {
    const miss = (RESEARCH_MAP[id].req || []).filter(q => !state.research[q]);
    return miss.length ? 'Benötigt: ' + miss.map(q => RESEARCH_MAP[q].name).join(', ') : null;
  }
  return null;
}

const MAX_BULK = 1000;

// Kumulierte Kosten: prefix[i] = Gesamtkosten der nächsten i Stufen ab Stufe lvl. Die Stückkosten sind rein
// (nur kind/id/lvl), daher wird je kind:id genau eine Reihe für das aktuelle lvl gecacht und bei Bedarf
// in derselben Summationsreihenfolge verlängert wie die frühere Schleife (identische Zahlen).
const prefixCache = new Map();
function prefixOf(kind, id, lvl, n) {
  const key = kind + ':' + id;
  let e = prefixCache.get(key);
  if (!e || e.lvl !== lvl) { e = { lvl, prefix: [{}] }; prefixCache.set(key, e); }
  const pre = e.prefix;
  while (pre.length <= n) pre.push(addCost(pre[pre.length - 1], unitCost(kind, id, lvl + pre.length - 1)));
  return pre;
}

/**
 * Kaufplan: { count, cost, affordable }.
 * amount: Zahl/String '1' | '10' | '100' | 'max'. Einmalkäufe (boost/research) ignorieren amount.
 * 'max' sucht die größte bezahlbare Menge (max. MAX_BULK) per Galopp + Binärsuche über die gecachten Summen.
 */
export function bulkPlan(kind, id, amount = '1') {
  const lvl = levelOf(kind, id);
  if (kind === 'boost' || kind === 'research') {
    if (lvl) return { count: 0, cost: {}, affordable: false };
    const cost = defOf(kind, id).cost;
    return { count: 1, cost, affordable: canAfford(cost) };
  }
  const limit = Math.max(0, Math.min(amount === 'max' ? MAX_BULK : Math.max(1, Number(amount) || 1), MAX_LEVEL - lvl));
  let count = limit;
  if (amount === 'max') {
    // größtes n <= limit mit canAfford(prefix[n]); die Kosten wachsen monoton in n
    let lo = 0, hi = 1;
    while (hi <= limit && canAfford(prefixOf(kind, id, lvl, hi)[hi])) { lo = hi; hi *= 2; }
    hi = Math.min(hi, limit + 1);          // hi: erste nicht bezahlbare Menge (oder limit+1)
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (canAfford(prefixOf(kind, id, lvl, mid)[mid])) lo = mid; else hi = mid;
    }
    count = lo;
  }
  if (count === 0) {
    // Max: nicht einmal 1 Stufe bezahlbar -> Preis der nächsten Stufe zeigen
    return { count: 0, cost: lvl < MAX_LEVEL ? unitCost(kind, id, lvl) : {}, affordable: false };
  }
  const total = prefixOf(kind, id, lvl, count)[count];
  return { count, cost: total, affordable: canAfford(total) };
}

// ---------- Prestige ----------
export function prestigeGain(runOre = state.stats.run.ore) {
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
