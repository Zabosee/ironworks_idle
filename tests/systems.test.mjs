import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, give, collect, fakeRandom, finishAll } from './helpers.mjs';
import * as A from '../js/systems/achievements.js';
import * as G from '../js/systems/golden.js';
import * as AB from '../js/systems/autobuyers.js';
import { tick } from '../js/systems/production.js';
import { rates, buffMult } from '../js/core/formulas.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../js/data/achievements.js';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS } from '../js/data/upgrades.js';
import { GOLDEN, BUFFS } from '../js/data/golden.js';

beforeEach(() => { reset(); G.init(); });

describe('Achievements', () => {
  test('Daten: eindeutige IDs, positive Boni, check ist Funktion', () => {
    const ids = new Set(ACHIEVEMENTS.map(a => a.id));
    assert.equal(ids.size, ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      assert.ok(a.bonus > 0 && Number.isFinite(a.bonus), a.id);
      assert.equal(typeof a.check, 'function');
      assert.equal(a.check(reset() ?? state), false, a.id + ' darf im Startzustand nicht erfuellt sein');
    }
    assert.equal(ACHIEVEMENT_MAP.click_1.id, 'click_1');
  });
  test('"alle Forschungen/Boosts" passt zur Anzahl in den Daten', () => {
    state.research = Object.fromEntries(RESEARCH.map(r => [r.id, 1]));
    state.boosts = Object.fromEntries(BOOSTS.map(b => [b.id, 1]));
    assert.equal(ACHIEVEMENT_MAP.res_3.check(state), true);
    assert.equal(ACHIEVEMENT_MAP.boost_2.check(state), true);
    delete state.research.quantum; delete state.boosts.cryo;
    assert.equal(ACHIEVEMENT_MAP.res_3.check(state), false);
    assert.equal(ACHIEVEMENT_MAP.boost_2.check(state), false);
  });
  test('vergibt Erfolg einmalig, sendet Event und Toast', () => {
    const ev = collect('achievement'), t = collect('toast');
    state.stats.clicks = 1;
    A.check(0, true);
    assert.ok(state.achievements.click_1 > 0);
    assert.equal(ev.got.filter(a => a.id === 'click_1').length, 1);
    assert.ok(t.got.some(x => /Erster Schlag/.test(x.msg)));
    const n = ev.got.length;
    A.check(0, true);
    assert.equal(ev.got.length, n, 'kein erneutes Vergeben');
    ev.stop(); t.stop();
  });
  test('Schwellen: knapp darunter nein, genau darauf ja', () => {
    state.stats.total.ore = 999.999; A.check(0, true);
    assert.equal(state.achievements.ore_1000, undefined);
    state.stats.total.ore = 1000; A.check(0, true);
    assert.ok(state.achievements.ore_1000);
  });
  test('Generator-Stufen und hoechste Stufe', () => {
    state.gens.mine = 10; A.check(0, true);
    assert.ok(state.achievements.gens_10 && state.achievements.level_10);
    assert.equal(state.achievements.gens_50, undefined);
  });
  test('zeitgesteuert: Pruefung erst nach 0,5 s angesammelter Zeit', () => {
    A.check(0, true);
    state.stats.clicks = 1;
    A.check(0.2);
    assert.equal(state.achievements.click_1, undefined);
    A.check(0.2);
    assert.equal(state.achievements.click_1, undefined);
    A.check(0.2);
    assert.ok(state.achievements.click_1);
  });
  test('Erfolge erhoehen die Produktion', () => {
    state.gens.mine = 9;
    const before = rates().ore;
    state.stats.total.ore = 1e3; A.check(0, true);
    assert.ok(rates().ore > before);
  });
  test('NaN-Statistik vergibt nichts und wirft nicht', () => {
    state.stats.clicks = NaN; state.stats.total.ore = NaN;
    assert.doesNotThrow(() => A.check(0, true));
    assert.equal(state.achievements.click_1, undefined);
  });
});

describe('Golden', () => {
  test('Barren erscheint nach dem Start-Delay und verschwindet nach 15 s', () => {
    const spawn = collect('golden:spawn'), exp = collect('golden:expire');
    const restore = fakeRandom(0.5);
    G.init();
    G.tick(GOLDEN.firstDelay[1] + 1);
    assert.ok(G.getCurrent());
    assert.equal(spawn.got.length, 1);
    G.tick(GOLDEN.lifetime - 0.5);
    assert.ok(G.getCurrent());
    G.tick(1);
    assert.equal(G.getCurrent(), null);
    assert.equal(exp.got.length, 1);
    restore(); spawn.stop(); exp.stop();
  });
  test('vor dem Start-Delay erscheint nichts', () => {
    const restore = fakeRandom(0);
    G.init();
    G.tick(GOLDEN.firstDelay[0] - 1);
    assert.equal(G.getCurrent(), null);
    restore();
  });
  test('claim ohne Barren: false, keine Statistik', () => {
    assert.equal(G.claim(), false);
    assert.equal(state.stats.golden, 0);
  });
  function spawnNow(rnd) {
    const restore = fakeRandom(...rnd);
    G.init(); G.tick(1000);
    assert.ok(G.getCurrent());
    return restore;
  }
  test('Frenzy-Buff: x7 Produktion fuer 45 s', () => {
    // Random-Folge: Spawn-Position(2x), dann Event-Auswahl
    const restore = spawnNow([0.5, 0.5, 0.5, 0]);
    assert.equal(G.claim(), true);
    restore();
    assert.equal(state.stats.golden, 1);
    assert.equal(state.buffs.length, 1);
    assert.equal(state.buffs[0].id, 'frenzy');
    assert.equal(state.buffs[0].left, 45);
    assert.equal(buffMult('prod'), 7);
    assert.equal(G.getCurrent(), null);
  });
  test('Buff laeuft ueber production.tick nach exakt der Dauer ab', () => {
    state.buffs = [{ id: 'frenzy', left: BUFFS.frenzy.duration }];
    tick(BUFFS.frenzy.duration - 1);
    assert.equal(buffMult('prod'), 7);
    tick(1.5);
    assert.equal(buffMult('prod'), 1);
    assert.equal(state.buffs.length, 0);
  });
  test('Glücksbringer verlaengert die Buff-Dauer um 10 % je Stufe', () => {
    state.prestige.shop.golden = 5;
    const restore = spawnNow([0.5, 0.5, 0.5, 0]);
    G.claim(); restore();
    assert.equal(state.buffs[0].left, 45 * 1.5);
  });
  test('Hammerwut: Klick x25 fuer 20 s', () => {
    const restore = spawnNow([0.5, 0.5, 0.5, 0.5]); // 50 von 100 -> clickfrenzy
    G.claim(); restore();
    assert.equal(state.buffs[0].id, 'clickfrenzy');
    assert.equal(state.buffs[0].left, 20);
    assert.equal(rates().click, 25);
  });
  test('erneutes Einloesen verlaengert statt zu stapeln', () => {
    state.buffs = [{ id: 'frenzy', left: 10 }];
    const restore = spawnNow([0.5, 0.5, 0.5, 0]);
    G.claim(); restore();
    assert.equal(state.buffs.length, 1);
    assert.equal(state.buffs[0].left, 45);
    // laengerer Rest wird nicht gekuerzt
    state.buffs[0].left = 100;
    const r2 = spawnNow([0.5, 0.5, 0.5, 0]);
    G.claim(); r2();
    assert.equal(state.buffs[0].left, 100);
  });
  test('Gluecktreffer gibt mindestens 50 Erz und kein Buff', () => {
    const lucky = collect('golden:lucky');
    const restore = spawnNow([0.5, 0.5, 0.5, 0.99]);
    G.claim(); restore();
    assert.equal(state.buffs.length, 0);
    assert.ok(state.res.ore >= 50);
    assert.equal(lucky.got.length, 1);
    lucky.stop();
  });
  test('nach Einloesen kein zweiter Claim moeglich', () => {
    const restore = spawnNow([0.5, 0.5, 0.5, 0]);
    assert.equal(G.claim(), true);
    assert.equal(G.claim(), false);
    restore();
    assert.equal(state.stats.golden, 1);
  });
});

describe('Auto-Buyer', () => {
  // Takt-Akkumulator zuruecksetzen (Modulzustand): nichts aktiv -> tick(100); tick(0)
  const drain = () => { AB.tick(100); AB.tick(0); };
  beforeEach(drain);

  test('gesperrt: setEnabled hat keine Wirkung', () => {
    AB.setEnabled('gens', true);
    assert.equal(state.autobuyers.gens, false);
    assert.equal(AB.isEnabled('gens'), false);
  });
  test('unbekannte ID wird ignoriert', () => {
    state.prestige.shop.ab_gens = 1;
    AB.setEnabled('quatsch', true);
    assert.equal(state.autobuyers.quatsch, undefined);
  });
  test('freigeschaltet + aktiviert: kauft im Takt (2 s)', () => {
    state.prestige.shop.ab_gens = 1; give({ ore: 100 });
    AB.setEnabled('gens', true);
    AB.tick(1.9);
    assert.equal(state.gens.mine, 0);
    AB.tick(0.2);
    assert.ok(state.gens.mine > 0);
  });
  test('freigeschaltet aber ausgeschaltet: kauft nichts', () => {
    state.prestige.shop.ab_gens = 1; give({ ore: 100 });
    AB.tick(10);
    assert.equal(state.gens.mine, 0);
  });
  test('ohne Ressourcen passiert nichts', () => {
    state.prestige.shop.ab_gens = 1; AB.setEnabled('gens', true);
    AB.tick(10);
    assert.equal(state.gens.mine, 0);
    assert.equal(state.stats.buys, 0);
  });
  test('Takt-Upgrade verkuerzt das Intervall', () => {
    state.prestige.shop.ab_gens = 1; state.prestige.shop.ab_speed = 2; give({ ore: 100 });
    AB.setEnabled('gens', true);
    AB.tick(1.01);
    assert.ok(state.gens.mine > 0);
  });
  test('Forschungs-Auto-Buyer respektiert Voraussetzungen', () => {
    state.prestige.shop.ab_research = 1; give({ ore: 1e4, steel: 100 });
    AB.setEnabled('research', true);
    AB.tick(2);
    finishAll();
    assert.equal(state.research.geology, 1);
    assert.equal(state.research.metallurgy, undefined);
    assert.equal(state.research.titanium, undefined);
  });
  test('Boost-Auto-Buyer kauft Boost, aber keinen doppelt', () => {
    state.prestige.shop.ab_boosts = 1; give({ steel: 300, titan: 10 });
    AB.setEnabled('boosts', true);
    AB.tick(2); AB.tick(2);
    finishAll();
    assert.equal(state.boosts.diamond, 1);
    assert.equal(state.res.steel, 150); assert.equal(state.res.titan, 5);
  });
  test('Klick-Auto-Buyer', () => {
    state.prestige.shop.ab_click = 1; give({ ore: 25 });
    AB.setEnabled('click', true);
    AB.tick(2);
    finishAll();
    assert.equal(state.clicks.click, 1);
  });
  test('nie negative Ressourcen', () => {
    state.prestige.shop.ab_gens = 1; state.prestige.shop.ab_click = 1; give({ ore: 77 });
    AB.setEnabled('gens', true); AB.setEnabled('click', true);
    for (let i = 0; i < 20; i++) AB.tick(2);
    for (const v of Object.values(state.res)) assert.ok(v >= 0);
  });
  test('riesiges dt loest nur einen Durchlauf aus (kein Nachholen)', () => {
    state.prestige.shop.ab_click = 1; give({ ore: 1e12, steel: 1e12, titan: 1e12 });
    AB.setEnabled('click', true);
    AB.tick(1e6);
    finishAll();
    assert.equal(state.clicks.click, 1);
  });
});
