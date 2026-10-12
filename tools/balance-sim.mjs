#!/usr/bin/env node
// Balance-Simulation der Prestige-Schleife: gieriger Bot gegen die echten Spielmodule (kein Mock der Formeln).
//
//   node tools/balance-sim.mjs [Stunden=48] [Klicks/s=4] [Neuguss-Anteil=0.5] [dt=2] [policy=rate] [corpEvery=40] [Name=Wert ...]
//
// Name=Wert setzt vor dem Lauf eine Konstante (nur CLI, zur parallelen Kalibrierung), z. B. CORP.divisor=40000 ERAS.6.at=5e24
//   Wurzeln: CORP, ERAS, CORP_MILESTONES, CORP_SHOP_MAP, INDUSTRY_TRACKS, GEN_MAP, RESEARCH_MAP, BOOST_MAP, CLICK_MAP.
//
// Der Bot spielt beide Reset-Ebenen: Neuguss wie unten, Konzerngründung alle `corpEvery` Stunden (corpEvery=0: sobald corpGain >= minCorpGain)
// und/oder sobald der Patente-Gewinn >= corpFrac * bisherige Patente (corpFrac > 0); danach kauft er den Konzern-Shop nach CORP_PLAN.
// Der Bot klickt, kauft Forschung/Boosts/Klick-Upgrades/Generatoren nach Amortisation und führt einen Neuguss durch,
// sobald der Gewinn >= Anteil * bisher verdiente Gussformen (und mindestens 1) beträgt und der Durchlauf mind. MIN_RUN s
// alt ist. Gussformen werden nach fester Prioritätsliste im Shop ausgegeben. Die Zeit entspricht aktiver Spielzeit
// (Offline-Ertrag ist nicht eingerechnet: Obergrenze für die Dauer, Offline-Spiel macht es schneller).
// Importierbar: simulate(opts) -> { milestones, prestiges, shop, hours }.
import { pathToFileURL } from 'node:url';
import { state, replaceState, defaultState, addResource } from '../js/core/state.js';
import * as F from '../js/core/formulas.js';
import * as P from '../js/systems/production.js';
import { doPrestige, buyShop } from '../js/systems/prestige.js';
import { GENS } from '../js/data/generators.js';
import { ERAS } from '../js/data/eras.js';
import { buyEvo } from '../js/systems/evolution.js';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { MILESTONES, SHOP, PRESTIGE } from '../js/data/prestige.js';
import { doCorp, buyCorpShop } from '../js/systems/corp.js';
import { CORP, CORP_SHOP, CORP_SHOP_MAP, CORP_MILESTONES } from '../js/data/corp.js';
import { INDUSTRY_TRACKS } from '../js/data/industry.js';
import { RES_IDS } from '../js/data/resources.js';
import { GEN_MAP } from '../js/data/generators.js';
import { RESEARCH_MAP } from '../js/data/research.js';
import { BOOST_MAP, CLICK_MAP } from '../js/data/upgrades.js';

if (typeof globalThis.localStorage === 'undefined') {
  const m = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, clear: () => m.clear() } });
}

// Grobe Wertigkeit je Ressource (in Erz) für die Amortisationsrechnung
const W = { ore: 1, steel: 20, titan: 1500, coal: 15, coke: 60, copper: 80, manganese: 150, chrome: 600, nickel: 600, alloy: 2000, tungsten: 20000, gold: 2e5,
  cobalt: 2e6, molybdenum: 3e6, carbide: 2e7, platinum: 3e8, vanadium: 5e7, iridium: 5e9, superalloy: 1e11 };
const worth = c => Object.entries(c).reduce((a, [k, v]) => a + v * (W[k] || 1), 0);

/** Kaufreihenfolge im Shop: [id, Zielstufe]; es wird der erste noch nicht erreichte, bezahlbare Eintrag gekauft. */
export const SHOP_PLAN = [
  ['click', 1], ['start', 1], ['pp_eff', 1], ['pp_gain', 1], ['q_speed', 1], ['q_lab', 1], ['q_work', 1],
  ['pp_eff', 3], ['pp_gain', 3], ['click', 3], ['q_speed', 3], ['keep', 1], ['offline', 1], ['ab_gens', 1], ['ab_click', 1],
  ['pp_eff', 5], ['pp_gain', 5], ['q_lab', 2], ['q_work', 2], ['golden', 1], ['ab_boosts', 1], ['ab_research', 1],
  ['pp_eff', 10], ['pp_gain', 10], ['q_speed', 6], ['q_lab', 3], ['q_work', 3], ['click', 10], ['start', 5], ['offline', 5], ['golden', 5], ['ab_speed', 4],
];

/** Konzern-Shop: [id, Zielstufe]; Wachstum von Patenten und Gussformen zuerst, Komfort danach, c_heir 5 zuletzt (GAME-DESIGN-2.md 3.5). */
export const CORP_PLAN = [
  ['c_archive', 1], ['c_heir', 1], ['c_gain', 1], ['c_cast', 1], ['c_auto', 1], ['c_eff', 1], ['c_heir', 2], ['c_gain', 2], ['c_cast', 2], ['c_eff', 2],
  ['c_click', 1], ['c_auto', 2], ['c_gain', 3], ['c_cast', 3], ['c_heir', 3], ['c_eff', 3], ['c_offline', 1], ['c_auto', 3], ['c_click', 2], ['c_gain', 4],
  ['c_cast', 4], ['c_heir', 4], ['c_eff', 4], ['c_autocast', 1], ['c_auto', 4], ['c_click', 3], ['c_offline', 2], ['c_click', 4], ['c_offline', 3], ['c_heir', 5],
];

// Seltene Materialien (Anteil an der Mixer-Stufe, den der Bot hält, auch wenn sich der Generator nach Amortisation nicht lohnt)
const RARE = [['chromeworks', 1], ['nickelref', 1], ['reactor', 0.8], ['crucible', 0.6],
  ['cobaltmine', 0.5], ['molybdenumworks', 0.5], ['sinterworks', 0.4], ['platinummine', 0.3], ['vanadiumworks', 0.3], ['iridiumlab', 0.25], ['superfoundry', 0.2]];

function buyGens(max = 30, pbLimit = 3000) {
  const need = new Set();
  const add = c => { for (const k in c) if (state.res[k] < c[k]) need.add(k); };
  // Bedarf: Kosten aller Forschungen/Boosts, deren Voraussetzungen erfüllt sind (Zeitalter-Tor zählt nicht, sonst
  // würden Nebenressourcen erst nach Zeitalter-Eintritt produziert und die Kalibrierung wäre blind dafür).
  const reqsDone = d => F.reqList(d.req).every(q => state.research[q]);
  for (const r of RESEARCH) if (!state.research[r.id] && reqsDone(r)) add(r.cost);
  for (const b of BOOSTS) if (!state.boosts[b.id] && reqsDone(b)) add(b.cost);
  // Seltene Materialien (Chrom, Nickel, Wolfram, Gold): Generatoren sind billig, rechnen sich aber nie nach Amortisation.
  // Ein echter Spieler baut sie trotzdem aus, also hält der Bot sie auf einem festen Anteil der Mischer-Stufe.
  const mixerLvl = F.genLevel('mixer');
  for (const [id, share] of RARE) {
    for (let n = 0; n < 5 && !F.lockReason('gen', id) && F.genLevel(id) < share * mixerLvl && F.bulkPlan('gen', id, 1).affordable; n++) P.buy('gen', id, 1);
  }
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

/**
 * Hält den Neuguss zurück, solange eine freischaltbare Forschung oder ein Boost in höchstens maxSec Sekunden bezahlbar wird
 * (wie ein Spieler, der für ein Ziel noch ein Stück weiterspielt). Der Neuguss setzt den Bestand auf 0; ohne diese Regel könnte der
 * Bot Posten, die mehr als einen kurzen Durchlauf an Produktion kosten, nie bezahlen.
 */
function wantsHold(maxSec) {
  const r = F.rates();
  const wait = c => Object.keys(c).reduce((m, k) => Math.max(m, state.res[k] >= c[k] ? 0 : r[k] > 0 ? (c[k] - state.res[k]) / r[k] : Infinity), 0);
  for (const [list, owned, kind] of [[RESEARCH, state.research, 'research'], [BOOSTS, state.boosts, 'boost']]) {
    for (const d of list) if (!owned[d.id] && !F.lockReason(kind, d.id) && wait(d.cost) <= maxSec) return true;
  }
  return false;
}

function spendCorp(log) {
  for (let again = true; again;) {
    again = false;
    for (const [id, lvl] of CORP_PLAN) {
      if (F.corpLevel(id) >= lvl) continue;
      if (state.corp.points >= F.corpCost(id) && buyCorpShop(id)) { log?.push(id + F.corpLevel(id)); again = true; }
      break;
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
 *       minRun (min. Sekunden je Durchlauf), dt (Schrittweite), stopAtAll (Abbruch, wenn alle Hochofen-Meilensteine erreicht),
 *       stopAtEra (Abbruch, sobald dieses Zeitalter erreicht ist), stopAtDone (Abbruch bei "alles freigeschaltet", siehe D2).
 *       Konzern: corp (Bot spielt die 2. Ebene, Vorgabe true), corpFirst (Stunde der 1. Gründung), corpEvery (Stunden zwischen Gründungen;
 *       0 = sobald Gewinn >= minCorpGain), corpFrac (zusätzlich gründen, wenn Gewinn >= corpFrac * bisherige Patente, 0 = aus), minCorpGain.
 *       hold (Sekunden: Neuguss/Gründung zurückhalten, solange eine freischaltbare Forschung/ein Boost in <= hold s bezahlbar wird, 0 = aus),
 *       progressEvery (simulierte Stunden zwischen Fortschrittszeilen auf stderr, 0 = still).
 * Rückgabe zusätzlich: eraTimes, snaps (Raten/Bestand beim Zeitalter-Eintritt), runRates (Raten kurz vor jedem Neuguss, Grundlage der
 *       Kostenkalibrierung der Zeitalter-Forschung), events { corpUnlock, firstCorp, stage[1..7], mat{id}, industry{track:[t je Stufe]},
 *       corpShopDone, all } (Sekunden aktiver Spielzeit), foundings [{ t, gain, total, stage }].
 */
export function simulate({ hours = 48, clicksPerSec = 4, frac = 0.5, policy = 'rate', minGain = 3, minRun = 300, dt = 2, stopAtAll = false, stopAtEra = 0, stopAtDone = false, probe = [],
  corp = true, corpFirst = 34, corpEvery = 40, corpFrac = 0, minCorpGain = 1, hold = 0, progressEvery = 0 } = {}) {
  replaceState(defaultState());
  state.settings.autosave = false;
  const milestones = {}, prestiges = [], shopLog = [], eraTimes = {}, probes = {}, snaps = {}, runRates = [], foundings = [];
  const ev = { corpUnlock: null, firstCorp: null, stage: {}, mat: {}, industry: Object.fromEntries(INDUSTRY_TRACKS.map(tr => [tr.id, []])), corpShopDone: null, all: null };
  const everR = new Set(), everB = new Set(), everC = new Set();
  let t = 0, lastCorpT = 0, nextProgress = progressEvery * 3600;
  const wall0 = Date.now();
  const hist = [], WIN = 120;
  while (t < hours * 3600) {
    // n Klicks eines Schritts mit einem rates()-Aufruf (die Klickstärke ändert sich innerhalb eines Schritts nicht): ca. 10x schneller als n-mal P.click()
    { const n = Math.round(clicksPerSec * dt); if (n > 0) { addResource('ore', F.rates().click * n); state.stats.clicks += n; state.stats.runClicks += n; } }
    P.tick(dt); t += dt;
    for (const r of RESEARCH) if (!state.research[r.id] && !F.lockReason('research', r.id)) P.buy('research', r.id);
    for (const b of BOOSTS) if (!state.boosts[b.id] && !F.lockReason('boost', b.id)) P.buy('boost', b.id);
    for (const c of CLICKS) if (!F.lockReason('click', c.id) && worth(F.bulkPlan('click', c.id, 1).cost) < 0.3 * state.res.ore) P.buy('click', c.id);
    buyGens();
    buyEvos();
    for (let i = 1; i < ERAS.length; i++) if (!(i in eraTimes) && F.eraIndex() >= i) { eraTimes[i] = t; const q = F.rates(); delete q.flows; snaps[i] = { t, rates: q, res: { ...state.res } }; }
    if (stopAtEra && stopAtEra in eraTimes) break;
    for (const ph of probe) if (!(ph in probes) && t >= ph * 3600) probes[ph] = state.stats.total.ore;

    // Zeitstempel (aktive Sekunden) für Konzern-Reiter, Konzernstufen, Materialien, Industrie-Leisten und "alles freigeschaltet"
    if (ev.corpUnlock === null && F.corpUnlocked()) ev.corpUnlock = t;
    for (let k = F.corpStage(); k >= 1 && !(k in ev.stage); k--) ev.stage[k] = t;
    for (const k of RES_IDS) if (!(k in ev.mat) && state.stats.total[k] > 0) ev.mat[k] = t;
    for (const p of F.industryProgress()) for (let i = ev.industry[p.id].length; i < p.reached; i++) ev.industry[p.id][i] = t;
    for (const r of RESEARCH) if (state.research[r.id]) everR.add(r.id);
    for (const b of BOOSTS) if (state.boosts[b.id]) everB.add(b.id);
    for (const c of CLICKS) if (state.clicks[c.id] > 0) everC.add(c.id);
    if (ev.all === null && ev.corpShopDone !== null && everR.size === RESEARCH.length && everB.size === BOOSTS.length && everC.size === CLICKS.length
      && Object.keys(ev.mat).length === RES_IDS.length && Object.keys(milestones).length === MILESTONES.length && F.corpStage() === CORP_MILESTONES.length
      && F.eraIndex() === ERAS.length - 1 && INDUSTRY_TRACKS.every(tr => ev.industry[tr.id].length === tr.steps.length)) ev.all = t;
    if (stopAtDone && ev.all !== null) break;
    if (progressEvery && t >= nextProgress) {
      nextProgress += progressEvery * 3600;
      console.error(`[sim] ${(t / 3600).toFixed(0)} h  Rechenzeit ${((Date.now() - wall0) / 60000).toFixed(1)} min  Zeitalter ${F.eraIndex()}  Neugüsse ${state.prestige.count}  Konzern ${state.corp.count}x K${F.corpStage()} (${state.corp.total} Patente)`);
    }

    // Konzerngründung (2. Ebene)
    if (corp && F.corpUnlocked() && state.stats.runTime >= minRun) {
      const g = F.corpGain();
      const timeOk = state.corp.count === 0 ? t >= corpFirst * 3600 : t - lastCorpT >= corpEvery * 3600;
      if (g >= minCorpGain && g >= 1 && !(hold && wantsHold(hold)) && (timeOk || (corpFrac > 0 && g >= corpFrac * state.corp.total))) {
        const gussformen = state.prestige.total;
        doCorp();
        hist.length = 0; lastCorpT = t;
        foundings.push({ t, gain: g, gussformen, total: state.corp.total, stage: F.corpStage(), count: state.corp.count });
        if (ev.firstCorp === null) ev.firstCorp = t;
        spendCorp(shopLog);
        if (ev.corpShopDone === null && CORP_SHOP.every(s => F.corpLevel(s.id) >= s.max)) ev.corpShopDone = t;
        continue;
      }
    }

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
    if (go && hold && wantsHold(hold)) go = false;
    if (go) {
      hist.length = 0;
      const runTime = state.stats.runTime;
      { const q = F.rates(); delete q.flows; runRates.push({ era: F.eraIndex(), t, rates: q }); }   // Spitzenraten des Durchlaufs je Zeitalter (Kalibrierung der Forschungskosten)
      doPrestige();
      prestiges.push({ t, runTime, gain, total: state.prestige.total, count: state.prestige.count });
      spendShop(shopLog);
      for (const m of MILESTONES) if (!(m.at in milestones) && state.prestige.total >= m.at) milestones[m.at] = { t, count: state.prestige.count };
      if (stopAtAll && Object.keys(milestones).length === MILESTONES.length) break;
    }
  }
  return { probes, eraTimes, snaps, runRates, milestones, prestiges, foundings, events: ev, shop: Object.fromEntries(SHOP.map(s => [s.id, F.shopLevel(s.id)])),
    corpShop: Object.fromEntries(CORP_SHOP.map(s => [s.id, F.corpLevel(s.id)])), shopLog, hours: t / 3600, total: state.prestige.total, wallSeconds: (Date.now() - wall0) / 1000 };
}

export const fh = s => (s == null ? '-' : s < 3600 ? `${(s / 60).toFixed(0)} min` : `${(s / 3600).toFixed(1)} h`);

/** Konstanten überschreiben ("ERAS.6.at=5e24"); Wurzeln siehe Kopfkommentar. Nur für CLI/Kalibrierung. */
export function applyOverrides(list) {
  const roots = { CORP, ERAS, CORP_MILESTONES, CORP_SHOP_MAP, INDUSTRY_TRACKS, GEN_MAP, RESEARCH_MAP, BOOST_MAP, CLICK_MAP };
  for (const a of list) {
    const [path, raw] = a.split('=');
    const keys = path.split('.');
    let o = roots[keys.shift()];
    while (keys.length > 1) o = o[keys.shift()];
    o[keys[0]] = Number(raw);
  }
}

/** Mehrzeiliger Bericht aller Zeitstempel eines Laufs (Text). */
export function report(r) {
  const e = r.events, L = [];
  L.push(`${r.prestiges.length} Neugüsse, ${r.hours.toFixed(1)} h, Gussformen im Konzernlauf ${r.total}`);
  ERAS.slice(1).forEach((x, i) => L.push(`Zeitalter ${i + 1} ${x.name}: ${r.eraTimes[i + 1] !== undefined ? fh(r.eraTimes[i + 1]) : 'NICHT erreicht'}`));
  for (const m of MILESTONES) L.push(`Hochofen-Meilenstein ${m.at}: ${r.milestones[m.at] ? fh(r.milestones[m.at].t) + ' (Neuguss ' + r.milestones[m.at].count + ')' : 'NICHT erreicht'}`);
  L.push(`Konzern-Reiter: ${fh(e.corpUnlock)}, 1. Gründung: ${fh(e.firstCorp)}, Gründungen: ${r.foundings.length}`);
  L.push('Konzernstufen: ' + CORP_MILESTONES.map((_, k) => `K${k + 1} ${fh(e.stage[k + 1])}`).join(', '));
  L.push('Materialien: ' + RES_IDS.slice(12).map(k => `${k} ${fh(e.mat[k])}`).join(', '));
  for (const tr of INDUSTRY_TRACKS) L.push(`Leiste ${tr.id}: ` + tr.steps.map((_, i) => fh(e.industry[tr.id][i])).join(', '));
  L.push(`Konzern-Shop komplett: ${fh(e.corpShopDone)}, ALLES FREIGESCHALTET: ${fh(e.all)}`);
  L.push('Gründungen: ' + r.foundings.map(f => `${fh(f.t)} +${f.gain}`).join(', '));
  L.push(`Rechenzeit ${(r.wallSeconds / 60).toFixed(1)} min`);
  return L.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), over = args.filter(a => a.includes('=')), pos = args.filter(a => !a.includes('='));
  applyOverrides(over);
  const [hours = 48, clicksPerSec = 4, frac = 0.5, dt = 2, policy = 'rate', corpEvery = 40] = pos;
  const r = simulate({ hours: +hours, clicksPerSec: +clicksPerSec, frac: +frac, dt: +dt, policy, corpEvery: +corpEvery, progressEvery: 50 });
  console.log(`growth=${PRESTIGE.growth} perPoint=${PRESTIGE.perPoint} frac=${frac} clicks/s=${clicksPerSec} corpEvery=${corpEvery} ${over.join(' ')}`);
  r.prestiges.slice(0, 40).forEach(p => console.log(`#${p.count} bei ${fh(p.t)} (Durchlauf ${fh(p.runTime)}) +${p.gain} -> ${p.total}`));
  console.log(report(r));
  console.log('Shop:', JSON.stringify(r.shop));
  console.log('Konzern-Shop:', JSON.stringify(r.corpShop));
}
