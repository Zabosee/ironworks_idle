import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, give } from './helpers.mjs';
import * as F from '../js/core/formulas.js';
import { GEN_MAP, MAX_LEVEL, ELITE_FROM } from '../js/data/generators.js';
import { SHOP } from '../js/data/prestige.js';

beforeEach(reset);

describe('Kosten', () => {
  test('Eisenmine Stufe 0 kostet 15 Erz, kein Titan', () => {
    assert.deepEqual(F.unitCost('gen', 'mine', 0), { ore: 15 });
  });
  test('Kosten wachsen exponentiell und werden aufgerundet', () => {
    assert.equal(F.unitCost('gen', 'mine', 1).ore, Math.ceil(15 * 1.15));
    assert.equal(F.unitCost('gen', 'mine', 9).ore, Math.ceil(15 * 1.15 ** 9));
  });
  test('Titan-Kosten erst ab Stufe 10 (Stufe 9 noch ohne)', () => {
    assert.equal(F.unitCost('gen', 'mine', ELITE_FROM - 1).titan, undefined);
    assert.equal(F.unitCost('gen', 'mine', ELITE_FROM).titan, 2);
    assert.equal(F.unitCost('gen', 'mine', 11).titan, Math.ceil(2 * 1.3));
    assert.equal(F.unitCost('gen', 'mine', 20).titan, Math.ceil(2 * 1.3 ** 10));
  });
  test('Walzwerk hat hoehere Titan-Basis (5)', () => {
    assert.equal(F.unitCost('gen', 'plant', 10).titan, 5);
  });
  test('Click-Upgrade: Stahl ab Stufe 2, Titan ab Stufe 10', () => {
    assert.deepEqual(F.unitCost('click', 'click', 0), { ore: 25 });
    assert.equal(F.unitCost('click', 'click', 1).steel, undefined);
    assert.equal(F.unitCost('click', 'click', 2).steel, 2);
    assert.equal(F.unitCost('click', 'click', 9).titan, undefined);
    assert.equal(F.unitCost('click', 'click', 10).titan, 3);
  });
  test('Kosten bleiben endlich und positiv bei extremen Stufen', () => {
    for (const lvl of [100, 1000, MAX_LEVEL - 1, MAX_LEVEL, 1e6]) {
      for (const id of Object.keys(GEN_MAP)) {
        const c = F.unitCost('gen', id, lvl);
        for (const v of Object.values(c)) assert.ok(Number.isFinite(v) && v > 0, `${id}@${lvl}: ${JSON.stringify(c)}`);
      }
    }
  });
});

describe('Multiplikatoren', () => {
  test('x2 alle 10 Stufen', () => {
    assert.equal(F.milestone(0), 1);
    assert.equal(F.milestone(9), 1);
    assert.equal(F.milestone(10), 2);
    assert.equal(F.milestone(19), 2);
    assert.equal(F.milestone(20), 4);
    assert.equal(F.milestone(100), 1024);
  });
  test('Praezisionsforschung gibt extra x2 bei 25, 50, ...', () => {
    state.research.precision = 1;
    assert.equal(F.milestone(24), 4);
    assert.equal(F.milestone(25), 8);
    assert.equal(F.milestone(50), 2 ** 5 * 4);
  });
  test('Generator-Ausgabe: base * n * milestone', () => {
    const g = GEN_MAP.mine;
    assert.equal(F.genOutputAt(g, 9), 9);
    assert.equal(F.genOutputAt(g, 10), 20);
    assert.equal(F.genOutputAt(GEN_MAP.smelter, 4), 1);
  });
  test('Prestige-Multiplikator inkl. Meilensteine', () => {
    assert.equal(F.prestigeMult(0), 1);
    assert.ok(Math.abs(F.prestigeMult(4) - 1.4) < 1e-12);
    assert.ok(Math.abs(F.prestigeMult(5) - 1.5 * 1.25) < 1e-12);
    assert.ok(Math.abs(F.prestigeMult(20) - 3 * 1.25 * 1.5) < 1e-12);
  });
  test('pp_eff erhoeht die Wirkung der Gussformen', () => {
    state.prestige.shop.pp_eff = 5;
    assert.ok(Math.abs(F.prestigeMult(4) - 1.8) < 1e-12);
  });
  test('Forschung/Boosts multiplizieren', () => {
    state.research.geology = 1; state.boosts.diamond = 1;
    assert.equal(F.researchMult('ore'), 2.5);
    assert.equal(F.researchMult('steel'), 1);
  });
  test('safe() faengt NaN und Infinity ab', () => {
    assert.equal(F.safe(NaN), 0);
    assert.equal(F.safe(Infinity), 1e300);
    assert.equal(F.safe(5), 5);
  });
  test('rates() ohne Besitz sind 0 bis auf Klickwert', () => {
    const r = F.rates();
    assert.equal(r.ore, 0); assert.equal(r.steel, 0); assert.equal(r.titan, 0);
    assert.equal(r.click, 1);
  });
  test('Konverter: 20 % Erz -> Stahl 25:1', () => {
    state.gens.mine = 9; state.research.converter = 1;
    const r = F.rates();
    assert.ok(Math.abs(r.ore - 9 * 0.8) < 1e-12);
    assert.ok(Math.abs(r.steel - 9 * 0.2 / 25) < 1e-12);
  });
  test('rates() sind bei Maximalstufen endlich', () => {
    for (const k in state.gens) state.gens[k] = MAX_LEVEL;
    state.clicks.click = MAX_LEVEL;
    state.prestige.total = 1e300;
    Object.assign(state.research, { geology: 1, converter: 1, resonance: 1, autoclick: 1, precision: 1 });
    for (const [k, v] of Object.entries(F.rates())) if (k !== 'flows') assert.ok(Number.isFinite(v) && v >= 0, `${k}=${v}`);
  });
});

describe('Kaufplan (bulkPlan)', () => {
  test('x1 bei genug Erz', () => {
    give({ ore: 15 });
    assert.deepEqual(F.bulkPlan('gen', 'mine', '1'), { count: 1, cost: { ore: 15 }, affordable: true });
  });
  test('x1 ohne Ressourcen: nicht bezahlbar', () => {
    const p = F.bulkPlan('gen', 'mine', '1');
    assert.equal(p.count, 1); assert.equal(p.affordable, false); assert.deepEqual(p.cost, { ore: 15 });
  });
  test('x10 summiert die Einzelkosten', () => {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += F.unitCost('gen', 'mine', i).ore;
    give({ ore: 1e9 });
    const p = F.bulkPlan('gen', 'mine', '10');
    assert.equal(p.count, 10);
    assert.equal(p.cost.ore, sum);
    assert.equal(p.cost.titan, undefined);
    assert.ok(p.affordable);
  });
  test('x10 ueber die Titan-Schwelle hinweg', () => {
    state.gens.mine = 5; give({ ore: 1e9, titan: 1000 });
    const p = F.bulkPlan('gen', 'mine', '10');
    let t = 0; for (let l = 5; l < 15; l++) t += F.unitCost('gen', 'mine', l).titan || 0;
    assert.equal(p.cost.titan, t);
    assert.ok(p.cost.titan > 0);
  });
  test('x100 und numerische Mengen', () => {
    give({ ore: 1e300 });
    assert.equal(F.bulkPlan('gen', 'mine', '100').count, 100);
    assert.equal(F.bulkPlan('gen', 'mine', 100).count, 100);
  });
  test('Max bei 0 Ressourcen: count 0, zeigt Preis der naechsten Stufe', () => {
    assert.deepEqual(F.bulkPlan('gen', 'mine', 'max'), { count: 0, cost: { ore: 15 }, affordable: false });
  });
  test('Max kauft genau so viel wie bezahlbar', () => {
    give({ ore: 15 + 18 });
    const p = F.bulkPlan('gen', 'mine', 'max');
    assert.equal(p.count, 2); assert.equal(p.cost.ore, 33); assert.ok(p.affordable);
  });
  test('Max stoppt an fehlendem Titan (nur Erz vorhanden)', () => {
    give({ ore: 1e15 });
    assert.equal(F.bulkPlan('gen', 'mine', 'max').count, ELITE_FROM);
  });
  test('Max ist auf 1000 pro Aktion begrenzt', () => {
    give({ ore: 1e300, titan: 1e300 });
    assert.ok(F.bulkPlan('gen', 'mine', 'max').count <= 1000);
  });
  test('MAX_LEVEL wird nie ueberschritten', () => {
    state.gens.mine = MAX_LEVEL - 1; give({ ore: 1e300, titan: 1e300 });
    assert.equal(F.bulkPlan('gen', 'mine', '10').count, 1);
    state.gens.mine = MAX_LEVEL;
    const p = F.bulkPlan('gen', 'mine', 'max');
    assert.equal(p.count, 0); assert.equal(p.affordable, false);
  });
  test('ungueltige Mengen fallen auf 1', () => {
    for (const a of ['abc', '-5', 0, NaN, undefined, null]) assert.equal(F.bulkPlan('gen', 'mine', a).count, 1, String(a));
  });
  test('Einmalkaeufe ignorieren amount und sind nur einmal kaufbar', () => {
    give({ ore: 300 });
    assert.deepEqual(F.bulkPlan('research', 'geology', 'max'), { count: 1, cost: { ore: 300 }, affordable: true });
    state.research.geology = 1;
    assert.deepEqual(F.bulkPlan('research', 'geology', '10'), { count: 0, cost: {}, affordable: false });
  });
  test('Float: exakt gleiche Ressourcen wie Kosten sind bezahlbar', () => {
    const cost = F.bulkPlan('gen', 'smelter', '7').cost.ore;
    give({ ore: cost });
    assert.ok(F.bulkPlan('gen', 'smelter', '7').affordable);
    give({ ore: cost - 1e-9 });
    assert.ok(!F.bulkPlan('gen', 'smelter', '7').affordable);
  });
  test('lockReason: Walzwerk braucht Forschung', () => {
    assert.match(F.lockReason('gen', 'plant'), /Metallurgie/);
    state.research.metallurgy = 1;
    assert.equal(F.lockReason('gen', 'plant'), null);
    assert.match(F.lockReason('research', 'resonance'), /Geologie/);
  });
});

describe('Prestige-Formeln', () => {
  test('Gussformen = floor(sqrt(runOre/1e7)), erst ab 1e7', () => {
    assert.equal(F.prestigeGain(0), 0);
    assert.equal(F.prestigeGain(9.99e6), 0);
    assert.equal(F.prestigeGain(1e7), 1);
    assert.equal(F.prestigeGain(3.99e7), 1);
    assert.equal(F.prestigeGain(4e7), 2);
    assert.equal(F.prestigeGain(9e9), 30);
  });
  test('pp_gain Bonus', () => {
    state.prestige.shop.pp_gain = 5;
    assert.equal(F.prestigeGain(4e7), 3);
  });
  test('NaN / negative / riesige Laufwerte bleiben endlich', () => {
    assert.equal(F.prestigeGain(NaN), 0);
    assert.equal(F.prestigeGain(-1e9), 0);
    assert.ok(Number.isFinite(F.prestigeGain(1e300)));
    assert.ok(Number.isFinite(F.prestigeGain(Infinity)));
  });
  test('oreForGain ist konsistent mit prestigeGain (alle pp_gain-Stufen)', () => {
    for (let lvl = 0; lvl <= 10; lvl++) {
      state.prestige.shop.pp_gain = lvl;
      for (let g = 0; g <= 300; g++) {
        const ore = F.oreForGain(g);
        assert.ok(F.prestigeGain(ore) >= g + 1, `lvl ${lvl} g ${g}: gain(${ore}) = ${F.prestigeGain(ore)}`);
      }
    }
  });
  test('oreForGain liefert die minimale Erzmenge (nicht eine Stufe zu viel)', () => {
    for (let lvl = 0; lvl <= 10; lvl++) {
      state.prestige.shop.pp_gain = lvl;
      for (let g = 0; g <= 300; g++) {
        assert.ok(F.prestigeGain(F.oreForGain(g) * (1 - 1e-9)) <= g, `lvl ${lvl} g ${g}`);
      }
    }
  });
  test('startOre / offlineCap / Auto-Buyer-Takt / Golden', () => {
    assert.equal(F.startOre(), 0);
    state.prestige.shop.start = 3; assert.equal(F.startOre(), 4500);
    assert.equal(F.offlineCapSeconds(), 8 * 3600);
    state.prestige.shop.offline = 5; assert.equal(F.offlineCapSeconds(), 18 * 3600);
    assert.equal(F.autobuyerInterval(), 2);
    state.prestige.shop.ab_speed = 2; assert.equal(F.autobuyerInterval(), 1);
    assert.equal(F.goldenDuration(), 1);
    state.prestige.shop.golden = 5; assert.equal(F.goldenDuration(), 1.5);
  });
  test('Shop-Kosten wachsen, sind ganzzahlig und endlich', () => {
    for (const it of SHOP) {
      state.prestige.shop[it.id] = 0;
      assert.equal(F.shopCost(it.id), it.cost);
      state.prestige.shop[it.id] = it.max;
      const c = F.shopCost(it.id);
      assert.ok(Number.isInteger(c) && c >= it.cost && Number.isFinite(c), it.id);
    }
  });
});

describe('Erfolgsbonus', () => {
  test('summiert additiv', () => {
    state.achievements.click_1 = 1; state.achievements.steel_1 = 1;
    assert.ok(Math.abs(F.achievementBonus() - (0.01 / 2 + 0.005 + 0.01)) < 1e-12);
    assert.ok(Math.abs(F.achievementMult() - (1 + F.achievementBonus())) < 1e-12);
  });
});
