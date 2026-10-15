// Reine Berechnungen auf Basis des Zustands. Kein DOM, keine Seiteneffekte.
import { state } from './state.js';
import { t, tName } from './i18n.js';
import { RES, RES_IDS } from '../data/resources.js';
import { QUEUES, queueIdOf, SPEED_SHOP, SPEED_PER_LEVEL, AUTOMATION_RESEARCH, AUTOMATION_MULT, LAB2_RESEARCH, LAB2_MULT, LAB3_RESEARCH, LAB3_MULT, NIGHT_RESEARCH, NIGHT_HOURS, MIN_DURATION } from '../data/timers.js';
import { GENS, GEN_MAP, genTier, tierName, tierPips, MILESTONE_STEP, ELITE_FROM, ELITE_GROWTH, MAX_LEVEL, EXTRA_MILESTONES } from '../data/generators.js';
import { CLICKS, CLICK_MAP, BOOSTS, BOOST_MAP } from '../data/upgrades.js';
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { RECIPES } from '../data/recipes.js';
import { PRESTIGE, FOCUS_MAP, FOCUS_RES, FOCUS_BONUS, FOCUS_MALUS, SHOP_MAP, MILESTONES, AUTOBUYERS, AUTOBUYER_INTERVAL } from '../data/prestige.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUFFS } from '../data/golden.js';
import { CHALLENGE_MAP, CHALLENGE_BONUS, CHALLENGE_LEVEL_BONUS } from '../data/challenges.js';
import { ERAS, EVO_MAX, EVO_AT, EVO_MULT, EVO_COST } from '../data/eras.js';
import { INDUSTRY_TRACKS } from '../data/industry.js';
import { CORP, CORP_SHOP_MAP, CORP_MILESTONES, HEIR_FLOOR } from '../data/corp.js';

export { genTier, tierName, tierPips };

// ---------- Zeitalter (abgeleitet von state.stats.total.ore; erst ab dem 1. Neuguss wirksam) ----------
/** Industrie/Zeitalter sind erst nach dem ersten Neuguss freigeschaltet; davor gilt faktisch Zeitalter 0. */
export const industryUnlocked = () => (state.prestige?.count || 0) >= 1;

export const eraIndex = (ore = state.stats.total.ore, unlocked = industryUnlocked()) => {
  if (!unlocked) return 0;
  for (let i = ERAS.length - 1; i >= 0; i--) {
    if (ore >= ERAS[i].at) return i;
  }
  return 0;
};

/** Kumulierter Produktionsbonus aller erreichten Zeitalter (Produkt ihrer Einzelboni). */
export const eraMult = (index = eraIndex()) => ERAS.slice(0, Math.min(index, ERAS.length - 1) + 1).reduce((m, e) => m * e.mult, 1);

export const eraDef = index => ERAS[Math.min(Math.max(0, index), ERAS.length - 1)];

export const nextEra = () => {
  const idx = eraIndex();
  return idx + 1 < ERAS.length ? ERAS[idx + 1] : null;
};

/** Fortschritt zum nächsten Zeitalter (0..1), logarithmisch im kumulierten Erz. */
export const eraProgress = () => {
  const next = nextEra();
  if (!next) return 1;
  const cur = ERAS[eraIndex()];
  const lg = v => Math.log10(Math.max(1, v));
  const clamp = x => Math.max(0, Math.min(1, x));
  return clamp((lg(state.stats.total.ore) - lg(cur.at)) / (lg(next.at) - lg(cur.at)));
};

// ---------- Generator-Ausbauten ----------
export const evoLevel = id => state.evo[id] || 0;

export const evoMult = id => {
  let m = 1;
  for (let k = 0; k < evoLevel(id); k++) m *= EVO_MULT[k];
  return m;
};

export const evoCost = id => {
  const lvl = evoLevel(id);
  if (lvl >= EVO_MAX) return null;
  const genDef = GEN_MAP[id];
  if (!genDef) return null;
  const baseCost = unitCost('gen', id, EVO_AT[lvl]);
  const c = {};
  for (const k in baseCost) c[k] = Math.ceil(safe(baseCost[k] * EVO_COST[lvl]));
  return c;
};

/** Begründung, warum die nächste Ausbaustufe nicht kaufbar ist (ohne Kostenprüfung), sonst null. */
export const evoLock = id => {
  const lvl = evoLevel(id);
  if (lvl >= EVO_MAX) return t('Maximum erreicht');
  if (!industryUnlocked()) return t('Benötigt den ersten Neuguss');
  if (eraIndex() < lvl + 1) return t('Benötigt Zeitalter: {name}', { name: tName('eras', ERAS[lvl + 1]) });
  if (genLevel(id) < EVO_AT[lvl]) return t('Benötigt Stufe {n}', { n: EVO_AT[lvl] });
  return null;
};

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

// ---------- Konzern (2. Reset-Ebene, GAME-DESIGN.md B3) ----------
export const corpLevel = id => state.corp?.shop[id] || 0;
export const corpCost = id => {
  const it = CORP_SHOP_MAP[id], lvl = corpLevel(id);
  if (it.costs) return it.costs[Math.min(lvl, it.costs.length - 1)];
  return Math.ceil(safe(it.cost * it.growth ** lvl));
};
/** Konzern-Reiter nutzbar: ab CORP.unlockCount Neugüssen (prestige.count bleibt über die Gründung erhalten). */
export const corpUnlocked = () => (state.prestige?.count || 0) >= CORP.unlockCount;
/**
 * Patente bei einer Gründung (D12): min(raw, cap). raw = floor(sqrt(Gussformen im Konzernlauf / D) × (1 + 0,1 × c_gain)),
 * cap = floor(CAP × Stunden seit der letzten Gründung). Rein; sec = stats.corpRunTime. Einzige Quelle für Gründung, Vorschau und Ziele.
 */
export function corpGainParts(gc = state.prestige.total, sec = state.stats.corpRunTime) {
  const raw = Math.floor(safe(Math.sqrt(Math.max(0, gc) / CORP.divisor) * (1 + 0.1 * corpLevel('c_gain'))) + 1e-9);
  const cap = Math.floor(safe(CORP.capPerHour * Math.max(0, sec) / 3600) + 1e-9);
  return { raw, cap, capped: cap < raw, gain: Math.min(raw, cap) };
}
export const corpGain = (gc, sec) => corpGainParts(gc, sec).gain;
/** Konzernstufe 0..7 (erreichte Schwellen in corp.total). */
export const corpStage = (total = state.corp?.total || 0) => CORP_MILESTONES.filter(m => total >= m.at).length;
export function corpMult(total = state.corp?.total || 0) {
  let m = 1 + total * CORP.perPoint * (1 + 0.2 * corpLevel('c_eff'));
  for (const ms of CORP_MILESTONES) if (total >= ms.at) m *= ms.mult;
  return m;
}
/** Hochofen-Erbe: Mindest-Gussformenstand für Multiplikator und Meilensteine. */
export const heirFloor = () => HEIR_FLOOR[Math.min(corpLevel('c_heir'), HEIR_FLOOR.length - 1)];
/** Wirksamer Gussformenstand (Erbe als Untergrenze). */
export const effectivePrestigeTotal = () => Math.max(state.prestige.total, heirFloor());
/** Bleibt normale Forschung beim Neuguss erhalten: Wissensarchiv (Hochofen-Shop) oder Konzernarchiv. */
export const keepsResearch = () => shopLevel('keep') >= 1 || corpLevel('c_archive') >= 1;

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

/** Produkt eines reinen Sondersschlüssels (z. B. 'click', 'autoclick') über Forschung und Boosts; `all` zählt hier nicht. */
export function keyMult(key) {
  let m = 1;
  for (const r of RESEARCH) if (state.research[r.id] && r.mult) m *= r.mult[key] ?? 1;
  for (const b of BOOSTS) if (state.boosts[b.id]) m *= b.mult[key] ?? 1;
  return m;
}

/** Sammel-Synergie (erst ab Zeitalter 1): kleiner Bonus je erledigter Forschung und je gekauftem Boost (flach addiert, daher moderat). */
export const SYNERGY = { perResearch: 0.003, perBoost: 0.005 };
export function synergyMult() {
  if (eraIndex() < 1) return 1;
  let r = 0, b = 0;
  for (const x of RESEARCH) if (state.research[x.id]) r++;
  for (const x of BOOSTS) if (state.boosts[x.id]) b++;
  return 1 + SYNERGY.perResearch * r + SYNERGY.perBoost * b;
}

export function achievementBonus() {
  let sum = 0;
  for (const a of ACHIEVEMENTS) if (state.achievements[a.id]) sum += a.bonus;
  return sum;
}
export const achievementMult = () => 1 + achievementBonus();

export function prestigeMult(total = effectivePrestigeTotal()) {
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

// ---------- Industrie-Meilensteine (abgeleitet aus stats.total, bleiben über Neuguss erhalten) ----------
/** Je Leiste: { id, value, next (nächste Schwelle oder null), progress (0..1 zur nächsten Stufe), reached (Anzahl Stufen), total, mult (Produkt der erreichten Stufen) }. */
export function industryProgress() {
  const lg = v => Math.log10(Math.max(1, v));
  return INDUSTRY_TRACKS.map(tr => {
    const value = tr.value(state);
    const reached = tr.steps.filter(st => value >= st.at).length;
    const nextStep = tr.steps[reached] || null, prev = reached ? tr.steps[reached - 1].at : 0;
    let progress = 1;
    if (nextStep) {
      const f = tr.log ? lg : v => v;
      const lo = tr.log && !prev ? 0 : f(prev);
      progress = Math.max(0, Math.min(1, (f(value) - lo) / (f(nextStep.at) - lo)));
    }
    return { id: tr.id, value, next: nextStep ? nextStep.at : null, progress, reached, total: tr.steps.length, mult: tr.steps.slice(0, reached).reduce((m, st) => m * st.mult, 1) };
  });
}
export const industryMult = () => industryProgress().reduce((m, tr) => m * tr.mult, 1);

/** Fokus-Faktor auf die Produktion einer Ressource (state.focus, siehe data/prestige.js FOCUS). */
export function focusMult(res) {
  const f = FOCUS_MAP[state.focus];
  if (!f) return 1;
  return f.res.includes(res) ? 1 + FOCUS_BONUS : FOCUS_RES.has(res) ? 1 - FOCUS_MALUS : 1;
}

// ---------- Herausforderungen (state.challenges, siehe systems/challenges.js) ----------
export const challengeDef = () => CHALLENGE_MAP[state.challenges?.active?.id] || null;
/** Dauerhafter Bonus der geschafften Stufen (Stufe 1: CHALLENGE_BONUS, jede weitere CHALLENGE_LEVEL_BONUS) mal Malus der laufenden (Eiserne Frist). */
export function challengeMult() {
  let bonus = 0;
  for (const lvl of Object.values(state.challenges?.done || {})) if (lvl >= 1) bonus += CHALLENGE_BONUS + CHALLENGE_LEVEL_BONUS * (lvl - 1);
  return (1 + bonus) * (challengeDef()?.mods.prod ?? 1);
}
/** true, wenn die laufende Herausforderung 'Ein Generator' diesen Generator-Typ sperrt. */
export const oneGenBlocked = id => { const a = state.challenges?.active; return !!(a && a.gen && a.gen !== id && challengeDef()?.mods.oneGen); };

/** Alles, was auf jede Produktion wirkt (außer Forschung/Boosts). */
export const globalMult = () => prestigeMult() * corpMult() * achievementMult() * buffMult('prod') * eraMult() * synergyMult() * industryMult() * challengeMult();
export const mult = res => safe(researchMult(res) * globalMult());

// ---------- Produktion ----------
export const genLevel = id => state.gens[id] || 0;
export const genOutputAt = (g, n, gm = globalMult()) => safe(g.base * n * milestone(n) * researchMult(g.res) * focusMult(g.res) * gm * evoMult(g.id));

export const clickLevel = id => state.clicks[id] || 0;

/** Klickwert-Beitrag eines Klick-Upgrades auf Stufe n (ohne Resonanz/Buffs). */
export function clickBaseAt(n, gm = globalMult(), def = CLICKS[0]) {
  return safe((def.base + def.perLevel * n) * milestone(n) * researchMult('ore') * keyMult('click') * gm * (1 + 0.5 * shopLevel('click')) * (1 + 0.5 * corpLevel('c_click')));
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
  r.click = challengeDef()?.mods.click === 0 ? 0 : safe(clickRaw * buffMult('click'));
  if (state.research.autoclick) r.ore += 5 * clickRaw * keyMult('autoclick');
  r.flows = [];
  for (const rc of RECIPES) {
    if (!recipeActive(rc)) continue;
    const cycles = recipeCycles(rc, r);
    const flow = { id: rc.id, cycles, inputs: {}, outputs: {} };
    for (const k in rc.inputs) { flow.inputs[k] = cycles * rc.inputs[k]; r[k] -= flow.inputs[k]; }
    // boosted (Standard true): Ausgaben erhalten die Forschungs-/Boost-Multiplikatoren ihrer Ressource.
    // Globale Faktoren (Prestige, Erfolge, Buffs) stecken bereits in den Eingängen und werden nicht doppelt angewandt.
    for (const k in rc.outputs) {
      flow.outputs[k] = cycles * rc.outputs[k] * (rc.boosted === false ? 1 : researchMult(k)) * focusMult(k);
      r[k] += flow.outputs[k];
    }
    r.flows.push(flow);
  }
  for (const b of state.buffs) if (b.id === 'shortage' && b.left > 0 && r[b.res] > 0) r[b.res] *= BUFFS.shortage.mult;   // Rohstoffengpass (Zufallsereignis)
  const chRes = challengeDef()?.mods.res;   // Herausforderung 'Erzmangel': Nettorate einzelner Materialien
  if (chRes) for (const k in chRes) if (r[k] > 0) r[k] *= chRes[k];
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
  if (d.costs) {
    const c = {};
    for (const k of d.costs) if (lvl >= (k.from || 0)) c[k.res] = Math.ceil(safe(k.base * k.growth ** (lvl - (k.from || 0))));
    return c;
  }
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
  const map = kind === 'gen' ? GEN_MAP : kind === 'boost' ? BOOST_MAP : kind === 'research' ? RESEARCH_MAP : kind === 'click' ? CLICK_MAP : null;
  return map && Object.hasOwn(map, id) ? map[id] : undefined;   // hasOwn: keine Treffer auf __proto__/constructor
}

/** GEN.req darf String oder Array sein. */
export const reqList = req => (req == null ? [] : Array.isArray(req) ? req : [req]);

// ---------- Warteschlangen (Zustand lesen; Änderungen in systems/timers.js) ----------
export const queueSlots = q => QUEUES[q].slots + shopLevel(QUEUES[q].slotShop);
export const queueCapacity = q => queueSlots(q) + QUEUES[q].waiting;
/** Faktor auf alle Dauern: Shop 'Zeitraffer', Forschung 'Laborautomatisierung' (und II, Konzern). */
export const timeMult = () => SPEED_PER_LEVEL ** shopLevel(SPEED_SHOP) * (state.research[AUTOMATION_RESEARCH] ? AUTOMATION_MULT : 1) * (state.research[LAB2_RESEARCH] ? LAB2_MULT : 1) * (state.research[LAB3_RESEARCH] ? LAB3_MULT : 1);

/** Dauer in Sekunden vor Zeitverkürzung; Klick-Upgrades wachsen mit ihrer Stufe. */
export function baseTime(kind, id, lvl = levelOf(kind, id)) {
  const d = defOf(kind, id);
  if (kind === 'click') { const t = d.time ?? { base: 0, growth: 1, max: 0 }; return Math.min(t.max, t.base * t.growth ** lvl); }
  return d.time ?? 0;
}
/** Tatsächliche Dauer eines Auftrags, wenn er jetzt eingereiht wird. */
export const duration = (kind, id) => Math.max(MIN_DURATION, safe(baseTime(kind, id) * timeMult()));

/** { queue, index, entry, running } wenn kind/id in einer Warteschlange steckt, sonst null. */
export function pendingOf(kind, id) {
  const q = queueIdOf(kind);
  if (!q) return null;
  const list = state.timers[q];
  const index = list.findIndex(e => e.kind === kind && e.id === id);
  return index < 0 ? null : { queue: q, index, entry: list[index], running: index < queueSlots(q) };
}

const missingReqs = d => reqList(d?.req).filter(q => !state.research[q]);

/** Liefert null, wenn kaufbar, sonst Begründung (Forschung fehlt, läuft bereits, Warteschlange voll). */
export function lockReason(kind, id) {
  const miss = missingReqs(defOf(kind, id));
  if (miss.length) return (kind === 'research' ? t('Benötigt: {list}', { list: miss.map(q => tName('research', RESEARCH_MAP[q])).join(', ') }) : t('Benötigt Forschung: {list}', { list: miss.map(q => tName('research', RESEARCH_MAP[q])).join(', ') }));
  const d = defOf(kind, id);
  if (d?.era > eraIndex() && !industryUnlocked()) return t('Benötigt den ersten Neuguss');
  if (d?.era > eraIndex()) return t('Benötigt Zeitalter: {name}', { name: tName('eras', ERAS[d.era]) });
  if (d?.corp > corpStage()) return t('Benötigt Konzernstufe: K{n}', { n: d.corp });
  if (kind === 'gen' && oneGenBlocked(id)) return t('Herausforderung: nur ein Generator-Typ');
  const q = queueIdOf(kind);
  if (q) {
    const p = pendingOf(kind, id);
    if (p) return p.running ? t('Läuft') : t('In Warteschlange');
    if (challengeDef()?.mods.noQueue) return t('Herausforderung: keine neuen Aufträge');
    if (state.timers[q].length >= queueCapacity(q)) return t('{name}: Warteschlange voll', { name: tName('timers', QUEUES[q]) });
  }
  return null;
}

/** Gestaffelte Anzeige: sichtbar ist, was schon erforscht/gekauft ist oder dessen fehlende Voraussetzungen direkt freischaltbar sind. */
export function isRevealed(kind, id) {
  if (levelOf(kind, id) > 0) return true;
  if (defOf(kind, id)?.corp > corpStage() + 1) return false;   // Konzernforschung erst eine Stufe vor der Freischaltung zeigen (sonst Platzhalter)
  return missingReqs(defOf(kind, id)).every(q => missingReqs(RESEARCH_MAP[q]).length === 0);
}
/** Material erscheint im aktuellen Lauf: Forschung fertig, Bestand oder Produktion dieses Laufs (nicht Gesamtstatistik). */
export function resVisible(id) {
  const req = RES[id].req;
  return !req || req.every(q => state.research[q]) || state.res[id] > 0 || state.stats.run[id] > 0;
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
  if (pendingOf(kind, id)) return { count: 0, cost: {}, affordable: false };   // läuft bereits: kein Doppelkauf
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
/** Basis-Erzbedarf (vor pp_gain) für insgesamt n Gussformen: divisor * growth^(n-1). */
const oreForBase = n => PRESTIGE.divisor * PRESTIGE.growth ** (n - 1);

/** Basis-Gussformen (vor pp_gain): größtes n mit oreForBase(n) <= runOre; 0 darunter / bei NaN. */
function baseGain(runOre) {
  if (!(runOre >= PRESTIGE.divisor)) return 0;
  if (runOre > CAP) runOre = CAP;
  let n = Math.floor(Math.log(runOre / PRESTIGE.divisor) / Math.log(PRESTIGE.growth)) + 1;
  // Korrekturschritt gegen Rundung von log() an exakten Potenzen
  while (n > 1 && oreForBase(n) > runOre) n--;
  while (oreForBase(n + 1) <= runOre) n++;
  return n;
}

/** Faktor auf die Gussformen je Neuguss: Hochofen-Kapazität (pp_gain) und Gussformen-Fabrik (c_cast, Konzern). */
const castMult = () => (1 + 0.1 * shopLevel('pp_gain')) * (1 + 0.15 * corpLevel('c_cast'));

export function prestigeGain(runOre = state.stats.run.ore) {
  return Math.floor(safe(baseGain(runOre) * castMult()));
}

/** Erz (in diesem Durchlauf), ab dem es mindestens gain+1 Gussformen gibt. */
export function oreForGain(gain) {
  const mult = castMult();
  // Kleinste Basis b mit floor(b * mult) >= gain + 1; Erzbedarf exakt wie in baseGain.
  const ok = b => Math.floor(safe(b * mult)) >= gain + 1;
  let need = Math.max(1, Math.ceil((gain + 1) / mult - 1e-9));
  for (let i = 0; i < 4 && !ok(need); i++) need++;
  while (need > 1 && ok(need - 1)) need--;
  return oreForBase(need);
}

/**
 * Neuguss-Vorschau (rein). prevGain: Gewinn vor ca. 2 min (optional, vom Aufrufer gemerkt) für die Lohnt-sich-Regel der Sim-Policy 'rate':
 * worthIt = Gewinnzuwachs/s der letzten 2 min liegt unter dem Durchlauf-Schnitt (gain/runTime); null, wenn prevGain fehlt.
 * Ergebnis: { gain, perHour, nextAt (Erz für gain+1), milestone: { at, missing, reached } | null, worthIt }.
 */
export function castPreview(prevGain = null, windowSec = 120) {
  const gain = prestigeGain(), runTime = state.stats.runTime || 0;
  const total = effectivePrestigeTotal(), ms = MILESTONES.find(m => m.at > total) || null;
  const rate = runTime > 0 ? gain / runTime : 0;
  return {
    gain,
    perHour: rate * 3600,
    nextAt: oreForGain(gain),
    milestone: ms ? { at: ms.at, missing: Math.max(0, ms.at - total), reached: total + gain >= ms.at } : null,
    worthIt: prevGain == null || runTime <= 0 || gain < 1 ? null : (gain - prevGain) / windowSec < rate,
  };
}

/**
 * Zielleiste (rein): Kandidaten für "Nächstes Ziel", absteigend nach Fortschritt (0..1). Einträge: { kind: 'firstcast'|'milestone'|'era'|'industry'|'corpunlock'|'corp', id, progress, at }.
 */
export function nextGoals() {
  const lg = v => Math.log10(Math.max(1, v));
  const goals = [];
  if (!industryUnlocked()) goals.push({ kind: 'firstcast', id: 'firstcast', at: PRESTIGE.divisor, progress: Math.min(1, lg(state.stats.run.ore) / lg(PRESTIGE.divisor)) });
  else {
    const total = effectivePrestigeTotal(), ms = MILESTONES.find(m => m.at > total);
    if (ms) goals.push({ kind: 'milestone', id: String(ms.at), at: ms.at, progress: Math.min(1, total / ms.at) });
    const ne = nextEra();
    if (ne) goals.push({ kind: 'era', id: ne.id, at: ne.at, progress: eraProgress() });
  }
  if (industryUnlocked() && !corpUnlocked() && state.prestige.count >= 25) goals.push({ kind: 'corpunlock', id: 'corpunlock', at: CORP.unlockCount, progress: Math.min(1, state.prestige.count / CORP.unlockCount) });
  if (corpUnlocked()) {
    const ms = CORP_MILESTONES.find(m => m.at > state.corp.total);
    if (ms) goals.push({ kind: 'corp', id: 'K' + (CORP_MILESTONES.indexOf(ms) + 1), at: ms.at, progress: Math.min(1, (state.corp.total + corpGain()) / ms.at) });
  }
  for (const tr of industryProgress()) if (tr.next != null) goals.push({ kind: 'industry', id: tr.id, at: tr.next, progress: tr.progress });
  return goals.sort((a, b) => b.progress - a.progress);
}

export const startOre = () => {
  const l = shopLevel('start');
  return l > 0 ? 500 * 3 ** (l - 1) : 0;
};
export const offlineCapSeconds = () => (8 + 2 * shopLevel('offline') + 4 * corpLevel('c_offline') + (state.research[NIGHT_RESEARCH] ? NIGHT_HOURS : 0)) * 3600;

// ---------- Auto-Buyer ----------
/** Hochofen-Shop-Kauf oder Konzern-Automatisierung (c_auto: Stufe n schaltet die ersten n Auto-Buyer in Listenreihenfolge frei). */
export const autobuyerUnlocked = id => shopLevel(AUTOBUYERS.find(a => a.id === id).unlock) > 0 || AUTOBUYERS.findIndex(a => a.id === id) < corpLevel('c_auto');
export const autobuyerInterval = () => AUTOBUYER_INTERVAL / (1 + 0.5 * shopLevel('ab_speed'));

// ---------- Golden ----------
export const goldenFreq = () => 1 + 0.1 * shopLevel('golden');
export const goldenDuration = () => 1 + 0.1 * shopLevel('golden');

// ---------- Forschungsbaum: Tiefe für Gruppierung ----------
export function researchDepth(id) {
  const r = RESEARCH_MAP[id];
  return r.req ? 1 + Math.max(...r.req.map(researchDepth)) : 0;
}
