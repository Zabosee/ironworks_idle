// Release-Runde: Rezept-Multiplikatoren (boosted), Autobuyer-Priorität, Mehr-Tab-Schutz.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, give, zeroRes, installStorage } from './helpers.mjs';
import * as F from '../js/core/formulas.js';
import { RECIPES, RECIPE_MAP } from '../js/data/recipes.js';

beforeEach(() => { installStorage(); reset(); });

describe('Rezepte: boosted', () => {
  test('Konverter-Stahl erhält Stahl-Multiplikatoren (Metallurgie ×1,5)', () => {
    state.gens.mine = 9; state.research.converter = 1;
    const base = F.rates().flows[0].outputs.steel;
    state.research.metallurgy = 1;
    const r = F.rates();
    assert.ok(Math.abs(r.flows[0].outputs.steel - base * 1.5) < 1e-12);
    assert.ok(Math.abs(r.flows[0].inputs.ore - 9 * 0.2) < 1e-12);   // Eingang unverändert
  });
  test('Boost auf Stahl wirkt, "alle" ebenfalls; boosted:false = Rohmenge', () => {
    state.gens.mine = 9; state.research.converter = 1; state.boosts.turbo = 1;
    const boosted = F.rates().flows[0].outputs.steel;
    assert.ok(Math.abs(boosted - 9 * 0.2 / 25 * 2) < 1e-12);
    RECIPE_MAP.converter.boosted = false;
    try { assert.ok(Math.abs(F.rates().flows[0].outputs.steel - 9 * 0.2 / 25) < 1e-12); }
    finally { delete RECIPE_MAP.converter.boosted; }
  });
  test('Standard ist boosted (kein Flag gesetzt)', () => {
    assert.ok(RECIPES.every(r => r.boosted === undefined || typeof r.boosted === 'boolean'));
    assert.equal(RECIPE_MAP.converter.boosted, undefined);
  });
});

import * as AB from '../js/systems/autobuyers.js';
import { RESEARCH_MAP } from '../js/data/research.js';

describe('Autobuyer-Priorität (reine Logik)', () => {
  test('reserveOf: nur Ziele in Reichweite, je Ressource das Maximum', () => {
    const have = { ore: 100, steel: 10 };
    const r = AB.reserveOf([{ ore: 200, steel: 5 }, { ore: 1000 }, { ore: 150 }], have);
    assert.deepEqual(r, { ore: 200, steel: 5 });   // 1000er: 100 < 250 -> ausgenommen
  });
  test('reserveOf: eine fehlende Kostenressource schließt das Ziel aus', () => {
    assert.deepEqual(AB.reserveOf([{ ore: 10, titan: 5 }], { ore: 100 }), {});
  });
  test('leavesReserve', () => {
    assert.equal(AB.leavesReserve({ ore: 30 }, { ore: 100 }, { ore: 120 }), false);
    assert.equal(AB.leavesReserve({ ore: 20 }, { ore: 100 }, { ore: 120 }), true);
    assert.equal(AB.leavesReserve({ steel: 5 }, { ore: 100 }, { ore: 0, steel: 5 }), true);   // andere Ressource
  });
  test('passesFor skaliert 5..50', () => {
    assert.equal(AB.passesFor(0), 5);
    assert.equal(AB.passesFor(200), 10);
    assert.equal(AB.passesFor(1e6), 50);
  });
});

describe('Autobuyer-Priorität (System)', () => {
  const drain = () => { AB.tick(100); AB.tick(0); };
  beforeEach(drain);
  const enable = (...ids) => { for (const id of ids) { state.prestige.shop['ab_' + id] = 1; AB.setEnabled(id, true); } };

  test('Generator-Autobuyer lässt Erz für eine erreichbare Forschung übrig', () => {
    const cost = RESEARCH_MAP.geology.cost;
    give({ ore: cost.ore * 0.5 });   // in Reichweite, aber noch nicht bezahlbar
    enable('gens', 'research');
    AB.tick(2);
    assert.equal(state.gens.mine, 0);
    assert.equal(state.res.ore, cost.ore * 0.5);
  });
  test('ohne aktiven Forschungs-Autobuyer keine Reserve', () => {
    give({ ore: RESEARCH_MAP.geology.cost.ore * 0.5 });
    enable('gens');
    AB.tick(2);
    assert.ok(state.gens.mine > 0);
  });
  test('Überschuss über die Reserve darf in Generatoren fließen', () => {
    const cost = RESEARCH_MAP.geology.cost;
    give({ ore: cost.ore + 200 });
    enable('gens');
    state.prestige.shop.ab_research = 1; AB.setEnabled('research', true);
    AB.tick(2);
    assert.equal(state.research.geology, undefined);   // läuft in der Warteschlange
    assert.ok(state.gens.mine > 0);
    assert.ok(state.res.ore >= 0);
  });
  test('Käufe pro Takt skalieren mit dem Bestand', () => {
    state.gens.mine = 400; give({ ore: 1e300, titan: 1e300 });
    enable('gens');
    const before = state.gens.mine;
    AB.tick(2);
    assert.ok(state.gens.mine - before > 5, 'mehr als 5 Käufe pro Takt bei großem Bestand');
  });
});
