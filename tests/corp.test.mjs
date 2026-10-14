// Konzerngründung (2. Reset-Ebene): Freischaltung, Formel, Reset-Regeln, Konzern-Shop, Auto-Neuguss, Save v6 und Migration v5 -> v6.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage, collect } from './helpers.mjs';
import * as F from '../js/core/formulas.js';
import * as S from '../js/core/save.js';
import * as C from '../js/systems/corp.js';
import { doPrestige } from '../js/systems/prestige.js';
import { CORP, CORP_SHOP, CORP_MILESTONES, HEIR_FLOOR } from '../js/data/corp.js';
import { RESEARCH, RESEARCH_MAP } from '../js/data/research.js';
import { RES_IDS } from '../js/data/resources.js';
import { MILESTONES } from '../js/data/prestige.js';

installStorage();
beforeEach(() => reset());

/** Zustand kurz vor der Gründung: Neuguss 120, Hochofen-Shop, Forschung (normal + Konzern), laufende Aufträge. */
function midGame() {
  state.prestige = { points: 40, total: 104000, count: 120, shop: { pp_eff: 2, keep: 1, start: 1, ab_gens: 1, q_lab: 1 }, history: [{ gain: 5, ore: 1e9, time: 100, at: 1 }] };
  state.research = { geology: 1, deepmines: 1, c_cobalt: 1, c_proc_1: 1 };
  state.boosts = { diamond: 1 };
  state.gens.mine = 40; state.evo.mine = 2; state.clicks.click = 4;
  state.res.ore = 1e9; state.res.gold = 12;
  state.autobuyers.gens = true;
  state.achievements.click_1 = 1;
  state.stats.total.ore = 1e20; state.stats.total.gold = 7; state.stats.playTime = 5000; state.stats.clicks = 33;
  state.stats.run.ore = 5e8; state.stats.runTime = 900; state.stats.corpRunTime = 10800;   // 3 h: Deckel 2 Patente
}

describe('Freischaltung und Formel', () => {
  test('Konzerngründung erst ab 100 Neugüssen; Gründen zusätzlich erst ab 1 Patent', () => {
    state.prestige.count = 99; state.prestige.total = 1e6;
    assert.equal(F.corpUnlocked(), false); assert.equal(C.canCorp(), false); assert.equal(C.doCorp(), false);
    state.prestige.count = CORP.unlockCount; state.stats.corpRunTime = 1e7;
    assert.equal(F.corpUnlocked(), true); assert.equal(C.canCorp(), true);
    state.prestige.total = CORP.divisor - 1; state.stats.corpRunTime = 1e7;
    assert.equal(C.canCorp(), false); assert.equal(C.doCorp(), false);
    assert.equal(state.corp.count, 0);
  });
  test('corpGain: Wurzel sqrt(Gussformen / D), D = 1.500; c_gain +10 % je Stufe', () => {
    assert.equal(CORP.divisor, 1500);
    const D = CORP.divisor, T = 1e12;   // Zeitdeckel hier unwirksam
    assert.equal(F.corpGain(0, T), 0); assert.equal(F.corpGain(D - 1, T), 0); assert.equal(F.corpGain(D, T), 1);
    assert.equal(F.corpGain(D * 49, T), 7); assert.equal(F.corpGain(D * 64 - 1, T), 7); assert.equal(F.corpGain(D * 64, T), 8);
    state.corp.shop.c_gain = 1;
    assert.equal(F.corpGain(D * 0.83, T), 1);   // sqrt(0,83) × 1,1 = 1,002
    assert.equal(F.corpGain(D * 100, T), 11);
    state.corp.shop.c_gain = 4;
    assert.equal(F.corpGain(D * 100, T), 14);
    state.prestige.total = D * 4; state.stats.corpRunTime = T; assert.equal(F.corpGain(), 2);   // 2 × 1,4 = 2,8
    assert.equal(F.corpGain(D * 1e12, T), Math.floor(1e6 * 1.4) );
    assert.equal(F.corpGain(D * 1e12, 0), 0);   // sehr viele Gussformen: keine Überlauf-/NaN-Probleme
  });
  test('Zeitlicher Deckel: höchstens floor(CAP × Stunden seit der Gründung) Patente; corpRunTime 0 = 0 Patente', () => {
    assert.equal(CORP.capPerHour, 0.68);
    const big = CORP.divisor * 1e6;   // raw = 1000
    assert.equal(F.corpGain(big, 0), 0);
    assert.equal(F.corpGain(big, 3600), 0);          // 0,68
    assert.equal(F.corpGain(big, 2 * 3600), 1);      // 1,36
    assert.equal(F.corpGain(big, 40 * 3600), 27);    // 27,2
    assert.equal(F.corpGain(big, -5), 0);
    state.corp.shop.c_gain = 4;
    const p = F.corpGainParts(CORP.divisor * 100, 10 * 3600);   // raw 14, Deckel 6
    assert.deepEqual(p, { raw: 14, cap: 6, capped: true, gain: 6 });
    assert.equal(F.corpGainParts(CORP.divisor * 100, 100 * 3600).capped, false);
    state.stats.corpRunTime = 10 * 3600; state.prestige.total = CORP.divisor * 100;
    assert.equal(F.corpGain(), 6);   // Standardargumente: Spielstand
  });
  test('Obergrenze: Patente je Gründung <= sqrt-Wert und <= CAP × Stunden, egal wie oft gegründet wird', () => {
    state.prestige.count = 100;
    let hours = 0, total = 0;
    for (const [h, gc] of [[5, 6e4], [40, 3e5], [2, 6e4], [80, 1e7], [10, 4e6]]) {
      state.prestige.total = gc; state.stats.corpRunTime = h * 3600; hours += h;
      const g = F.corpGain(); total += g;
      assert.ok(g <= Math.sqrt(gc / CORP.divisor) + 1e-9 && g <= CORP.capPerHour * h + 1e-9, `${g} bei ${h} h`);
      if (g >= 1) assert.ok(C.doCorp());
    }
    assert.ok(state.corp.total <= CORP.capPerHour * hours + 1e-9);
    assert.equal(state.corp.total, total);
  });
  test('Konzernstufe K1..K7 und corpMult (Patente × Stufenprodukt, c_eff)', () => {
    assert.deepEqual(CORP_MILESTONES.map(m => m.at), [10, 30, 70, 135, 210, 290, 351]);
    assert.equal(F.corpStage(0), 0); assert.equal(F.corpStage(9), 0); assert.equal(F.corpStage(10), 1); assert.equal(F.corpStage(350), 6); assert.equal(F.corpStage(351), 7);
    assert.equal(F.corpMult(0), 1);
    assert.ok(Math.abs(F.corpMult(3) - (1 + 3 * 0.02)) < 1e-12);
    assert.ok(Math.abs(F.corpMult(10) - (1 + 10 * 0.02) * 1.1) < 1e-12);
    state.corp.shop.c_eff = 4;
    assert.ok(Math.abs(F.corpMult(30) - (1 + 30 * 0.02 * 1.8) * 1.1 * 1.1) < 1e-12);
    state.corp.total = 20;
    const g0 = F.globalMult(); state.corp.total = 0;
    assert.ok(Math.abs(g0 / F.globalMult() - F.corpMult(20)) < 1e-9, 'corpMult steckt in globalMult');
  });
  test('Summe der Konzern-Shop-Kosten = Schwelle K7 (351), 9 Einträge', () => {
    assert.equal(CORP_SHOP.length, 9);
    let sum = 0;
    for (const it of CORP_SHOP) for (let l = 0; l < it.max; l++) { state.corp.shop[it.id] = l; sum += F.corpCost(it.id); }
    assert.equal(sum, 351); assert.equal(sum, CORP_MILESTONES.at(-1).at);
  });
});

describe('Reset-Regeln (D3)', () => {
  test('Gründung: Gussformen, Hochofen-Shop, Chronik, Durchlauf und normale Forschung gehen; Zeitalter, Erfolge, Statistik, Zähler, Konzernforschung bleiben', () => {
    midGame();
    state.corp.shop.c_archive = 1;   // Konzernarchiv hilft bei der Gründung nicht
    const ev = collect('corp');
    assert.ok(C.doCorp()); ev.stop();
    assert.deepEqual(ev.got, [{ gain: 2 }]);
    const p = state.prestige;
    assert.deepEqual({ ...p, history: p.history.length }, { points: 0, total: 0, count: 120, shop: {}, history: 0 });
    assert.deepEqual(state.research, { c_cobalt: 1, c_proc_1: 1 });
    assert.deepEqual(state.boosts, {});
    assert.equal(state.gens.mine, 0); assert.equal(state.evo.mine, 0); assert.equal(state.clicks.click, 0);
    assert.equal(state.res.ore, 0); assert.equal(state.res.gold, 0);   // auch der Erzvorrat (Hochofen-Shop) ist weg
    assert.equal(state.stats.run.ore, 0); assert.equal(state.stats.runTime, 0); assert.equal(state.stats.corpRunTime, 0);
    // bleibt
    assert.equal(state.stats.total.ore, 1e20); assert.equal(state.stats.total.gold, 7); assert.equal(state.stats.playTime, 5000); assert.equal(state.stats.clicks, 33);
    assert.equal(state.achievements.click_1, 1); assert.equal(state.autobuyers.gens, true);
    assert.equal(F.eraIndex(), 2, 'Zeitalter folgt stats.total.ore (1e20 = Dampfzeitalter)');
    assert.equal(state.corp.points, 2); assert.equal(state.corp.total, 2); assert.equal(state.corp.count, 1);
    assert.equal(state.corp.history.length, 1);
    assert.deepEqual({ ...state.corp.history[0], at: 0 }, { gain: 2, gussformen: 104000, time: 10800, at: 0 });
  });
  test('Gründung verwirft auch Laboraufträge (selbst mit Wissensarchiv) und Werkbank; Konzernstufen-Toast bei Sprung', () => {
    midGame();
    state.prestige.total = CORP.divisor * 100; state.stats.corpRunTime = 20 * 3600; state.res.steel = 1e30; state.res.ore = 1e30;
    state.timers.lab.push({ kind: 'research', id: 'c_moly', total: 100, left: 50, cost: {} }, { kind: 'research', id: 'converter', total: 100, left: 50, cost: {} });
    state.timers.workshop.push({ kind: 'boost', id: 'turbo', total: 100, left: 50, cost: {} });
    const toasts = collect('toast');
    assert.ok(C.doCorp()); toasts.stop();
    assert.deepEqual(state.timers, { lab: [], workshop: [] });
    assert.equal(F.corpStage(), 1);
    assert.ok(toasts.got.some(x => /K1/.test(x.msg)), 'Toast Konzernstufe K1');
  });
  test('Neuguss: Konzernforschung bleibt immer (auch Auftrag in der Warteschlange), normale Forschung nur mit Wissensarchiv/Konzernarchiv', () => {
    midGame();
    state.prestige.shop = {};
    state.stats.run.ore = 1e12;
    state.timers.lab.push({ kind: 'research', id: 'c_moly', total: 100, left: 50, cost: {} }, { kind: 'research', id: 'converter', total: 100, left: 50, cost: {} });
    assert.ok(doPrestige());
    assert.deepEqual(state.research, { c_cobalt: 1, c_proc_1: 1 });
    assert.deepEqual(state.timers.lab.map(e => e.id), ['c_moly']);
    // Konzernarchiv
    midGame(); state.prestige.shop = {}; state.corp.shop.c_archive = 1; state.stats.run.ore = 1e12;
    assert.equal(F.keepsResearch(), true);
    assert.ok(doPrestige());
    assert.deepEqual(Object.keys(state.research).sort(), ['c_cobalt', 'c_proc_1', 'deepmines', 'geology']);
    // Wissensarchiv
    midGame(); state.stats.run.ore = 1e12;
    assert.equal(F.keepsResearch(), true);
    assert.ok(doPrestige());
    assert.equal(state.research.geology, 1);
  });
  test('Neuguss lässt prestige.count, corp und Konzern-Shop unberührt', () => {
    midGame(); state.corp = { points: 3, total: 9, count: 2, shop: { c_eff: 1 }, history: [] };
    state.stats.run.ore = 1e12;
    assert.ok(doPrestige());
    assert.equal(state.prestige.count, 121);
    assert.deepEqual(state.corp, { points: 3, total: 9, count: 2, shop: { c_eff: 1 }, history: [] });
  });
});

describe('Konzern-Shop', () => {
  test('Kauf zieht Patente ab, respektiert Maximum und Guthaben; Event corpshop', () => {
    const ev = collect('corpshop');
    state.corp.points = 7;
    assert.equal(C.buyCorpShop('c_autocast'), false);   // kostet 18
    assert.equal(C.buyCorpShop('c_eff'), true);          // 6
    assert.equal(state.corp.points, 1); assert.equal(F.corpLevel('c_eff'), 1);
    assert.equal(C.buyCorpShop('c_eff'), false);         // Stufe 2 kostet 8
    assert.equal(C.buyCorpShop('gibt-es-nicht'), false);
    state.corp.points = 1e6;
    for (let i = 0; i < 10; i++) C.buyCorpShop('c_archive');
    assert.equal(F.corpLevel('c_archive'), 1);
    ev.stop(); assert.deepEqual(ev.got.map(e => e.id), ['c_eff', 'c_archive']);
  });
  test('c_heir: Gussformen-Boden für Multiplikator und Meilensteine, prestige.total bleibt', () => {
    state.corp.points = 1e6;
    assert.equal(F.prestigeMult(), 1);
    const costs = []; for (let i = 0; i < 5; i++) { costs.push(F.corpCost('c_heir')); assert.ok(C.buyCorpShop('c_heir')); }
    assert.deepEqual(costs, [3, 7, 12, 20, 34]);
    assert.equal(F.corpCost('c_heir'), 34, 'nach Maximum keine Überschreitung');
    assert.equal(F.heirFloor(), HEIR_FLOOR[5]);
    assert.equal(state.prestige.total, 0);
    const expected = (1 + 250000 * 0.1) * MILESTONES.reduce((m, x) => m * x.mult, 1);
    assert.ok(Math.abs(F.prestigeMult() - expected) < 1e-6 * expected);
    state.prestige.total = 300000;   // über dem Boden zählt der echte Stand
    assert.ok(Math.abs(F.prestigeMult() - (1 + 300000 * 0.1) * MILESTONES.reduce((m, x) => m * x.mult, 1)) < 1);
  });
  test('c_cast: +15 % Gussformen je Stufe, oreForGain bleibt konsistent', () => {
    state.stats.run.ore = 1e7 * 1.05 ** 99;   // Basis 100
    assert.equal(F.prestigeGain(), 100);
    state.corp.shop.c_cast = 2; state.prestige.shop.pp_gain = 1;
    assert.equal(F.prestigeGain(), Math.floor(100 * 1.1 * 1.3));
    const g = F.prestigeGain();
    assert.ok(F.prestigeGain(F.oreForGain(g)) >= g + 1);
    assert.ok(F.prestigeGain(F.oreForGain(g) * 0.999) <= g);
  });
  test('c_offline: +4 h Offline-Cap je Stufe; c_click: +50 % Klickwert je Stufe', () => {
    assert.equal(F.offlineCapSeconds(), 8 * 3600);
    state.corp.shop.c_offline = 3; assert.equal(F.offlineCapSeconds(), 20 * 3600);
    state.prestige.shop.offline = 2; assert.equal(F.offlineCapSeconds(), 24 * 3600);
    const c0 = F.clickBaseAt(3);
    state.corp.shop.c_click = 2;
    assert.ok(Math.abs(F.clickBaseAt(3) / c0 - 2) < 1e-9);
  });
  test('c_auto: Stufe n schaltet die ersten n Auto-Buyer frei (Generatoren, Spitzhacke, Forschung, Boosts)', () => {
    const ids = ['gens', 'click', 'research', 'boosts'];
    assert.deepEqual(ids.map(F.autobuyerUnlocked), [false, false, false, false]);
    for (let n = 1; n <= 4; n++) { state.corp.shop.c_auto = n; assert.deepEqual(ids.map(F.autobuyerUnlocked), ids.map((_, i) => i < n)); }
    state.corp.shop.c_auto = 0; state.prestige.shop.ab_boosts = 1;
    assert.equal(F.autobuyerUnlocked('boosts'), true);   // Hochofen-Shop weiterhin gültig
  });
  test('c_lab2 (Forschung): Dauern x0,85 zusätzlich', () => {
    const t0 = F.timeMult();
    state.research.c_lab2 = 1;
    assert.ok(Math.abs(F.timeMult() / t0 - 0.85) < 1e-12);
  });
  test('c_lab3 (Forschung): Dauern x0,9 zusätzlich; c_night: Offline-Cap +2 h', () => {
    const t0 = F.timeMult(), o0 = F.offlineCapSeconds();
    state.research.c_lab3 = 1; state.research.c_night = 1;
    assert.ok(Math.abs(F.timeMult() / t0 - 0.9) < 1e-12);
    assert.equal(F.offlineCapSeconds() - o0, 2 * 3600);
  });
});

describe('Auto-Neuguss', () => {
  const ready = () => { state.corp.shop.c_autocast = 1; state.autoCast.on = true; state.stats.run.ore = 1e12; state.stats.runTime = 600; };
  test('Einstellung nur nach Kauf; ungültige Werte werden ignoriert', () => {
    assert.equal(C.setAutoCast({ on: true }), false); assert.equal(state.autoCast.on, false);
    state.corp.shop.c_autocast = 1;
    assert.equal(C.setAutoCast({ on: true, mode: 'time', value: 5 }), true);
    assert.deepEqual(state.autoCast, { on: true, mode: 'time', value: 5 });
    C.setAutoCast({ mode: 'x', value: NaN, on: 'ja' });
    assert.deepEqual(state.autoCast, { on: true, mode: 'time', value: 5 });
  });
  test('Modus Gewinn: Vorgabe = Mittel der letzten 5 Gewinne; Mindestlaufzeit 60 s', () => {
    ready();
    state.prestige.history = [10, 20, 30].map(gain => ({ gain, ore: 1, time: 1, at: 1 }));
    assert.equal(C.autoCastDefaultGain(), 20);
    const g = F.prestigeGain();
    assert.ok(g > 20, 'Gewinn ' + g);
    assert.equal(C.autoCastDue(), true);
    state.stats.runTime = 59; assert.equal(C.autoCastDue(), false);
    state.stats.runTime = 600; state.autoCast.value = g + 1; assert.equal(C.autoCastDue(), false);
    state.autoCast.value = g; assert.equal(C.autoCastDue(), true);
    state.autoCast.on = false; assert.equal(C.autoCastDue(), false);
  });
  test('Modus Zeit: nach n Minuten (Vorgabe 10 min)', () => {
    ready(); state.autoCast.mode = 'time'; state.autoCast.value = 0;
    state.stats.runTime = 599; assert.equal(C.autoCastDue(), false);
    state.stats.runTime = 600; assert.equal(C.autoCastDue(), true);
    state.autoCast.value = 15; assert.equal(C.autoCastDue(), false);
    state.stats.runTime = 900; assert.equal(C.autoCastDue(), true);
  });
  test('tick gießt automatisch (Event autocast), nie ohne Kauf; Gründung bleibt manuell', () => {
    ready(); state.autoCast.mode = 'gain'; state.autoCast.value = 1;
    const ev = collect('autocast');
    state.corp.shop.c_autocast = 0;
    C.tick(1, true); assert.equal(state.prestige.count, 0);
    state.corp.shop.c_autocast = 1;
    const gain = F.prestigeGain();
    C.tick(1, true); ev.stop();
    assert.equal(state.prestige.count, 1); assert.equal(state.prestige.points, gain);
    assert.deepEqual(ev.got, [{ gain }]);
    assert.equal(state.corp.count, 0);
  });
});

describe('Sperren und Sichtbarkeit (corp)', () => {
  test('lockReason: Voraussetzung vor Zeitalter vor Konzernstufe', () => {
    assert.match(F.lockReason('research', 'c_sinter'), /Benötigt: /);   // c_moly fehlt
    state.research.c_moly = 1;
    assert.equal(F.lockReason('research', 'c_sinter'), 'Benötigt Konzernstufe: K2');
    state.corp.total = 30; assert.equal(F.lockReason('research', 'c_sinter'), null);
    // Zeitalter vor Konzernstufe
    state.research.c_platin = 1; state.research.c_sinter = 1; state.corp.total = 0;
    assert.match(F.lockReason('research', 'c_iridium'), /Zeitalter|Neuguss/);
    // Boost und Klick-Upgrade tragen dieselbe Sperre
    state.research.c_tool = 1;
    assert.equal(F.lockReason('click', 'carbidechisel'), 'Benötigt Konzernstufe: K2');
    state.corp.total = 30; assert.equal(F.lockReason('click', 'carbidechisel'), null);
  });
  test('isRevealed: Konzernforschung erst eine Stufe vor der Freischaltung sichtbar', () => {
    state.research.goldsmith = 1;
    assert.equal(F.isRevealed('research', 'c_cobalt'), true);   // K1 bei Stufe 0 sichtbar (gesperrt)
    state.research.c_cobalt = 1; state.research.c_moly = 1;
    assert.equal(F.isRevealed('research', 'c_sinter'), false);   // K2 bei Stufe 0
    state.corp.total = 10; assert.equal(F.isRevealed('research', 'c_sinter'), true);
  });
  test('Materialien sind sichtbar nach Freischalt-Forschung oder Bestand', () => {
    assert.equal(F.resVisible('cobalt'), false);
    state.research.c_cobalt = 1; assert.equal(F.resVisible('cobalt'), true);
    state.res.iridium = 1; assert.equal(F.resVisible('iridium'), true);
  });
  test('Neue Kette: Kobalt-Forschung schaltet Grube frei; Sintern wird zum Rezept', () => {
    assert.ok(F.lockReason('gen', 'cobaltmine'));
    state.research.c_cobalt = 1; assert.equal(F.lockReason('gen', 'cobaltmine'), null);
    state.gens.cobaltmine = 5; state.gens.sinterworks = 1; state.gens.reactor = 10;
    state.research.c_sinter = 1;
    const r = F.rates();
    assert.ok(r.cobalt > 0);
    assert.ok(r.flows.some(f => f.id === 'sinter'));
  });
});

describe('Industrie-Leiste Materialvielfalt zählt die neuen Materialien', () => {
  test('B4-B7 ab 14 / 16 / 18 / 19 produzierten Materialien', () => {
    const track = () => F.industryProgress().find(x => x.id === 'variety');
    for (const [n, reached] of [[12, 3], [14, 4], [16, 5], [18, 6], [19, 7]]) {
      RES_IDS.forEach((k, i) => { state.stats.total[k] = i < n ? 1 : 0; });
      assert.equal(track().reached, reached, `${n} Materialien`);
    }
  });
});

describe('Save v6', () => {
  const wrap = (st, v = 6) => Buffer.from(JSON.stringify({ v, t: 1_700_000_000_000, state: st }), 'utf8').toString('base64');
  test('SAVE_VERSION 9; Roundtrip erhält corp, Konzernforschung, autoCast und corpRunTime', () => {
    assert.equal(S.SAVE_VERSION, 9);
    state.corp = { points: 7, total: 31, count: 4, shop: { c_eff: 2, c_heir: 3 }, history: [{ gain: 3, gussformen: 1e5, time: 1234, at: 99 }] };
    state.research.c_cobalt = 1; state.autoCast = { on: true, mode: 'time', value: 12 }; state.stats.corpRunTime = 777;
    const o = JSON.parse(S.serialize()); assert.equal(o.v, 9);
    S.importSave(S.exportSave());
    assert.deepEqual(state.corp, { points: 7, total: 31, count: 4, shop: { c_eff: 2, c_heir: 3 }, history: [{ gain: 3, gussformen: 1e5, time: 1234, at: 99 }] });
    assert.equal(state.research.c_cobalt, 1); assert.deepEqual(state.autoCast, { on: true, mode: 'time', value: 12 }); assert.equal(state.stats.corpRunTime, 777);
  });
  test('Sanitize: unbekannte Shop-IDs, zu hohe Stufen, NaN/negativ, zu lange oder kaputte Chronik, korrupter autoCast', () => {
    const s = S.sanitize({
      corp: { points: NaN, total: -5, count: 'x', shop: { c_eff: 99, c_gain: -2, foo: 1, c_click: 2.7 },
        history: [null, { gain: 0 }, 'x', ...Array.from({ length: 15 }, (_, i) => ({ gain: i + 1, gussformen: 5, time: 1, at: 1 }))] },
      autoCast: { on: 'ja', mode: 'zufall', value: -4 },
    });
    assert.equal(s.corp.points, 0); assert.equal(s.corp.total, 0); assert.equal(s.corp.count, 0);
    assert.deepEqual(s.corp.shop, { c_eff: 4, c_click: 2 });
    assert.equal(s.corp.history.length, 10); assert.equal(s.corp.history.at(-1).gain, 15);
    assert.deepEqual(s.autoCast, { on: false, mode: 'gain', value: 0 });
    assert.deepEqual(S.sanitize({ corp: 5, autoCast: [] }).corp, { points: 0, total: 0, count: 0, shop: {}, history: [] });
  });
  test('Migration v5 -> v6: leere Defaults, Eingabe unverändert, alte Daten bleiben', () => {
    const old = { res: { ore: 5 }, research: { geology: 1 }, prestige: { points: 2, total: 6, count: 7, shop: {}, history: [] } };
    const m = S.migrate({ v: 5, t: 1, state: old });
    assert.equal(m.v, 9);
    assert.deepEqual(m.state.corp, { points: 0, total: 0, count: 0, shop: {}, history: [] });
    assert.deepEqual(m.state.autoCast, { on: false, mode: 'gain', value: 0 });
    assert.equal(old.corp, undefined);
    S.importSave(wrap(old, 5));
    assert.equal(state.res.ore, 5); assert.equal(state.prestige.count, 7); assert.equal(state.research.geology, 1);
    assert.deepEqual(state.corp, { points: 0, total: 0, count: 0, shop: {}, history: [] });
    for (const k of RES_IDS) assert.equal(state.res[k] >= 0, true);
    assert.equal(state.gens.cobaltmine, 0); assert.equal(state.stats.corpRunTime, 0);
  });
  test('Spielstand aus neuerer Version (v10) wird abgelehnt', () => {
    assert.throws(() => S.migrate({ v: 10, state: {} }), /neueren/);
  });
  test('Konzernforschung im Spielstand wird übernommen (alle 49), unbekannte IDs nicht', () => {
    const ids = RESEARCH.filter(r => r.corp).map(r => r.id);
    assert.equal(ids.length, 49);
    const s = S.sanitize({ research: { ...Object.fromEntries(ids.map(i => [i, 1])), c_fake: 1 } });
    assert.equal(Object.keys(s.research).length, 49); assert.equal(s.research.c_fake, undefined);
    assert.ok(RESEARCH_MAP.c_charta);
  });
  test('Offline-Fortschritt zählt corpRunTime mit', () => {
    S.applyOffline(100); assert.equal(state.stats.corpRunTime, 100);
  });
});

describe('EN-Texte der Konzernstufen', () => {
  test('jede CORP_MILESTONES-Stufe hat EN-Text (en-data nach at, en-ui nach desc)', async () => {
    const { EN } = await import('../js/i18n/en-data.js');
    const { EN_UI } = await import('../js/i18n/en-ui.js');
    assert.deepEqual(Object.keys(EN.corpMilestones).map(Number), CORP_MILESTONES.map(m => m.at));
    for (const m of CORP_MILESTONES) {
      const en = 'Production ×' + String(m.mult).replace('.', ',') ;
      assert.equal(EN.corpMilestones[m.at].desc, 'Production ×' + m.mult, 'en-data at=' + m.at);
      assert.equal(EN_UI[m.desc], en.replace(',', '.'), 'en-ui ' + m.desc);
    }
  });
});
