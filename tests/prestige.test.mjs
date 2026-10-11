import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, collect, zeroRes } from './helpers.mjs';
import { doPrestige, canPrestige, buyShop } from '../js/systems/prestige.js';
import { prestigeGain } from '../js/core/formulas.js';
import { SHOP } from '../js/data/prestige.js';

beforeEach(reset);

describe('Hochofen-Neuguss', () => {
  test('unter der Schwelle: false, Zustand unveraendert', () => {
    state.stats.run.ore = 9.99e6; state.gens.mine = 7; state.res.ore = 123;
    const before = JSON.stringify(state);
    assert.equal(canPrestige(), false);
    assert.equal(doPrestige(), false);
    assert.equal(JSON.stringify(state), before);
  });
  test('Gussformen werden gutgeschrieben, Durchlauf wird zurueckgesetzt', () => {
    Object.assign(state.stats, { runClicks: 9, runTime: 99 });
    state.stats.run.ore = 2e7; state.stats.total.ore = 5e7;
    state.res = { ore: 1e5, steel: 50, titan: 3 };
    state.gens.mine = 12; state.clicks.click = 4;
    state.boosts.diamond = 1; state.research.geology = 1;
    state.buffs = [{ id: 'frenzy', left: 10 }];
    const ev = collect('prestige');
    assert.equal(doPrestige(), true);
    assert.equal(state.prestige.points, 2);
    assert.equal(state.prestige.total, 2);
    assert.equal(state.prestige.count, 1);
    assert.deepEqual(state.res, zeroRes());
    assert.equal(state.gens.mine, 0);
    assert.equal(state.clicks.click, 0);
    assert.deepEqual(state.boosts, {});
    assert.deepEqual(state.research, {});
    assert.deepEqual(state.buffs, []);
    assert.equal(state.stats.run.ore, 0); assert.equal(state.stats.runTime, 0); assert.equal(state.stats.runClicks, 0);
    assert.equal(state.stats.total.ore, 5e7, 'Lebenszeit-Statistik bleibt');
    assert.equal(state.stats.bestPrestige, 2);
    assert.deepEqual(ev.got, [{ gain: 2 }]);
    ev.stop();
  });
  test('direkt danach kein weiterer Neuguss moeglich', () => {
    state.stats.run.ore = 1e8;
    assert.equal(doPrestige(), true);
    assert.equal(canPrestige(), false);
    assert.equal(doPrestige(), false);
    assert.equal(state.prestige.count, 1);
  });
  test('Wissensarchiv behaelt Forschung, Boosts nicht', () => {
    state.prestige.shop.keep = 1; state.research.geology = 1; state.boosts.diamond = 1;
    state.stats.run.ore = 1e8;
    doPrestige();
    assert.equal(state.research.geology, 1);
    assert.deepEqual(state.boosts, {});
  });
  test('Erzvorrat-Upgrade: Startkapital', () => {
    state.prestige.shop.start = 2; state.stats.run.ore = 1e8;
    doPrestige();
    assert.equal(state.res.ore, 1500);
  });
  test('Gussformen summieren sich ueber mehrere Neugussvorgaenge', () => {
    state.stats.run.ore = 2e7; doPrestige();
    state.stats.run.ore = 3e7; doPrestige();
    assert.equal(state.prestige.total, 2 + 3);
    assert.equal(state.prestige.count, 2);
    assert.equal(state.stats.bestPrestige, 3);
  });
  test('Meilenstein-Toast bei Ueberschreiten von 5 Gussformen', () => {
    const t = collect('toast');
    state.stats.run.ore = 6e7; // 5 Punkte
    assert.equal(prestigeGain(), 5);
    doPrestige();
    assert.ok(t.got.some(x => /Meilenstein 5/.test(x.msg)));
    t.stop();
  });
  test('Auto-Buyer-Einstellungen und Shop bleiben nach Neuguss erhalten', () => {
    state.prestige.shop.ab_gens = 1; state.autobuyers.gens = true; state.stats.run.ore = 1e8;
    doPrestige();
    assert.equal(state.prestige.shop.ab_gens, 1);
    assert.equal(state.autobuyers.gens, true);
  });
});

describe('Prestige-Shop', () => {
  test('zu wenig Gussformen: false, nichts abgezogen', () => {
    state.prestige.points = 2;
    assert.equal(buyShop('pp_eff'), false);
    assert.equal(state.prestige.points, 2);
    assert.equal(state.prestige.shop.pp_eff, undefined);
  });
  test('Kauf zieht Kosten ab und steigert Stufe; naechste Stufe teurer', () => {
    state.prestige.points = 100;
    assert.equal(buyShop('pp_eff'), true);
    assert.equal(state.prestige.points, 97);
    assert.equal(state.prestige.shop.pp_eff, 1);
    assert.equal(buyShop('pp_eff'), true);
    assert.equal(state.prestige.points, 97 - Math.ceil(3 * 1.8));
  });
  test('Maximalstufe wird nicht ueberschritten', () => {
    state.prestige.points = 1e9;
    assert.equal(buyShop('keep'), true);
    assert.equal(buyShop('keep'), false);
    assert.equal(state.prestige.shop.keep, 1);
  });
  test('unbekannte ID', () => {
    state.prestige.points = 1e9;
    assert.equal(buyShop('nope'), false);
    assert.equal(buyShop(undefined), false);
  });
  test('alle Shop-Eintraege bis Maximum kaufbar mit genug Punkten', () => {
    state.prestige.points = 1e12;
    for (const it of SHOP) {
      for (let i = 0; i < it.max; i++) assert.equal(buyShop(it.id), true, it.id);
      assert.equal(buyShop(it.id), false, it.id);
    }
  });
  test('Gussformen-Kosten werden nie negativ (genau passend)', () => {
    state.prestige.points = 3;
    assert.equal(buyShop('pp_eff'), true);
    assert.equal(state.prestige.points, 0);
  });
});
