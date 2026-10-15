// Generator-Ausbau: Sperren, Kosten, Kauf, Alles-ausbauen, Wirkung auf die Produktion.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, collect, installStorage, give, zeroRes , setEra } from './helpers.mjs';
import { ERAS, EVO_MAX, EVO_AT, EVO_MULT, EVO_COST } from '../js/data/eras.js';
import { GENS } from '../js/data/generators.js';
import * as F from '../js/core/formulas.js';
import { buyEvo, buyAllEvo } from '../js/systems/evolution.js';

installStorage();
beforeEach(() => reset());

describe('Generator-Ausbau', () => {
  test('Daten: je Stufe ein Eintrag, Multiplikatoren > 1', () => {
    assert.equal(EVO_AT.length, EVO_MAX); assert.equal(EVO_MULT.length, EVO_MAX); assert.equal(EVO_COST.length, EVO_MAX);
    assert.ok(EVO_MULT.every(m => m > 1));
    assert.ok(ERAS.length > EVO_MAX);   // Stufe k braucht Zeitalter k
  });
  test('Sperren: Zeitalter vor Generatorstufe, Maximum', () => {
    assert.match(F.evoLock('mine'), /ersten Neuguss/);
    state.prestige.count = 1;
    assert.match(F.evoLock('mine'), /Zeitalter/);
    setEra(1);
    assert.match(F.evoLock('mine'), /Stufe 10/);
    state.gens.mine = 10;
    assert.equal(F.evoLock('mine'), null);
    state.evo.mine = EVO_MAX;
    assert.equal(F.evoLock('mine'), 'Maximum erreicht');
    assert.equal(F.evoCost('mine'), null);
  });
  test('Kosten entsprechen unitCost(EVO_AT) x EVO_COST und steigen mit der Stufe', () => {
    const c0 = F.evoCost('mine'), u = F.unitCost('gen', 'mine', EVO_AT[0]);
    for (const k in u) assert.equal(c0[k], Math.ceil(u[k] * EVO_COST[0]));
    state.evo.mine = 1;
    assert.ok(F.evoCost('mine').ore > c0.ore);
  });
  test('buyEvo: gesperrt/unbezahlbar scheitert ohne Nebenwirkung, sonst Kauf mit Abzug und Event', () => {
    assert.equal(buyEvo('mine'), false);
    setEra(1); state.gens.mine = 10;
    assert.equal(buyEvo('mine'), false);          // zu wenig Erz
    assert.equal(state.evo.mine, 0);
    const cost = F.evoCost('mine');
    give(zeroRes({ ore: cost.ore + 5, steel: 1e9, titan: 1e9 }));
    const ev = collect('evo');
    assert.equal(buyEvo('mine', { silent: true }), true);
    assert.equal(state.evo.mine, 1); assert.equal(state.res.ore, 5);
    assert.deepEqual(ev.got, [{ id: 'mine', level: 1, silent: true }]);
    ev.stop();
    assert.equal(buyEvo('nonexistent'), false);
  });
  test('Wirkung: Ausbau multipliziert die Generator-Ausgabe', () => {
    state.gens.mine = 10;
    const g = GENS.find(x => x.id === 'mine');
    const before = F.genOutputAt(g, 10);
    state.evo.mine = 2;
    assert.ok(Math.abs(F.genOutputAt(g, 10) / before - EVO_MULT[0] * EVO_MULT[1]) < 1e-9);
  });
  test('buyAllEvo kauft alles Mögliche und meldet die Anzahl', () => {
    setEra(2);   // Stufen 1 und 2 erlaubt
    state.gens.mine = 25; state.gens.smelter = 10;
    give(zeroRes({ ore: 1e15, steel: 1e15, titan: 1e15 }));
    const n = buyAllEvo();
    assert.equal(state.evo.mine, 2); assert.equal(state.evo.smelter, 1);
    assert.equal(n, 3);
    assert.equal(buyAllEvo(), 0);
  });
});

describe('Generator-Ausbau VI bis VIII', () => {
  test('Daten laut Design: 8 Stufen, kumuliert x324, Stufe k braucht Zeitalter k', () => {
    assert.equal(EVO_MAX, 8);
    assert.deepEqual(EVO_AT, [10, 20, 30, 45, 60, 75, 90, 100]);
    assert.deepEqual(EVO_MULT, [1.5, 1.5, 2, 2, 3, 2, 2, 3]);
    assert.deepEqual(EVO_COST, [25, 60, 150, 400, 1000, 2000, 3000, 4000]);
    assert.ok(Math.abs(EVO_MULT.reduce((a, b) => a * b) - 324) < 1e-9);
    assert.ok(EVO_AT.every((a, i) => i === 0 || a > EVO_AT[i - 1]));
  });
  test('Sperren und Kosten der Stufen 6 bis 8', () => {
    for (let k = 5; k < 8; k++) {
      state.evo.mine = k; state.gens.mine = EVO_AT[k] - 1;
      setEra(k); assert.match(F.evoLock('mine'), /Zeitalter/);
      setEra(k + 1); assert.match(F.evoLock('mine'), new RegExp('Stufe ' + EVO_AT[k]));
      state.gens.mine = EVO_AT[k]; assert.equal(F.evoLock('mine'), null);
      const u = F.unitCost('gen', 'mine', EVO_AT[k]), c = F.evoCost('mine');
      for (const r in u) assert.equal(c[r], Math.ceil(u[r] * EVO_COST[k]));
    }
    state.evo.mine = 8; assert.equal(F.evoLock('mine'), 'Maximum erreicht');
  });
  test('Voller Ausbau multipliziert die Ausgabe um x324', () => {
    const g = GENS.find(x => x.id === 'mine'); state.gens.mine = 10;
    const before = F.genOutputAt(g, 10); state.evo.mine = 8;
    assert.ok(Math.abs(F.genOutputAt(g, 10) / before - 324) < 1e-6);
  });
});
