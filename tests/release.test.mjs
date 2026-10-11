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
