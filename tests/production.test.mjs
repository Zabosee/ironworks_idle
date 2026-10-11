import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, give, collect, finishAll } from './helpers.mjs';
import { tick, click, buy } from '../js/systems/production.js';
import { applyOffline } from '../js/core/save.js';
import { addResource } from '../js/core/state.js';
import { MAX_LEVEL } from '../js/data/generators.js';

beforeEach(reset);

describe('Tick', () => {
  test('Eisenmine Stufe 10 liefert 20 Erz/s', () => {
    state.gens.mine = 10;
    tick(1);
    assert.equal(state.res.ore, 20);
    assert.equal(state.stats.total.ore, 20);
    assert.equal(state.stats.run.ore, 20);
    assert.equal(state.stats.bestOreRate, 20);
  });
  test('skaliert linear mit dt und zaehlt Spielzeit', () => {
    state.gens.mine = 10;
    tick(0.5); tick(0.5);
    assert.ok(Math.abs(state.res.ore - 20) < 1e-9);
    assert.ok(Math.abs(state.stats.playTime - 1) < 1e-12);
    assert.ok(Math.abs(state.stats.runTime - 1) < 1e-12);
  });
  test('Stahl und Titan werden produziert', () => {
    state.gens.smelter = 4; state.research.titanium = 1; state.gens.forge = 50;
    tick(2);
    assert.equal(state.res.steel, 2);
    assert.ok(state.res.titan > 0);
  });
  test('ungueltiges dt (0, negativ, NaN, Infinity) aendert nichts', () => {
    state.gens.mine = 10;
    for (const dt of [0, -1, NaN, Infinity, undefined]) tick(dt);
    assert.equal(state.res.ore, 0);
    assert.equal(state.stats.playTime, 0);
  });
  test('Buffs laufen ab und werden entfernt, Event wird gesendet', () => {
    const ev = collect('buffs');
    state.buffs = [{ id: 'frenzy', left: 1 }];
    tick(0.5);
    assert.equal(state.buffs.length, 1);
    tick(0.6);
    assert.equal(state.buffs.length, 0);
    assert.equal(ev.got.length, 1);
    ev.stop();
  });
  test('Frenzy-Buff x7 wirkt auf die Produktion', () => {
    state.gens.mine = 9;
    tick(1);
    const base = state.res.ore;
    reset(); state.gens.mine = 9; state.buffs = [{ id: 'frenzy', left: 100 }];
    tick(1);
    assert.ok(Math.abs(state.res.ore - base * 7) < 1e-9);
  });
  test('Ressourcen sind bei riesigem dt auf 1e300 gedeckelt, nie Infinity/NaN', () => {
    state.gens.mine = MAX_LEVEL; state.prestige.total = 1e300;
    tick(1e300); tick(1e300);
    for (const v of Object.values(state.res)) assert.ok(Number.isFinite(v));
    assert.ok(state.res.ore <= 1e300);
  });
});

describe('Klick', () => {
  test('Klick gibt Erz und zaehlt Statistik', () => {
    const a = click();
    assert.equal(a, 1);
    assert.equal(state.res.ore, 1);
    assert.equal(state.stats.clicks, 1);
    assert.equal(state.stats.runClicks, 1);
  });
});

describe('Kaufen', () => {
  test('ohne Ressourcen: false, Zustand unveraendert', () => {
    const before = JSON.stringify(state);
    assert.equal(buy('gen', 'mine', '1'), false);
    assert.equal(buy('gen', 'mine', 'max'), false);
    assert.equal(buy('gen', 'mine', '10'), false);
    assert.equal(JSON.stringify(state), before);
  });
  test('Kauf zieht Kosten ab und erhoeht Stufe/Statistik', () => {
    give({ ore: 20 });
    assert.equal(buy('gen', 'mine', '1'), true);
    assert.equal(state.gens.mine, 1);
    assert.equal(state.res.ore, 5);
    assert.equal(state.stats.buys, 1);
  });
  test('Standardmenge kommt aus settings.buyAmount', () => {
    give({ ore: 1e6 }); state.settings.buyAmount = '10';
    buy('gen', 'mine');
    assert.equal(state.gens.mine, 10);
  });
  test('Max-Kauf bei 0 Ressourcen kauft nichts', () => {
    assert.equal(buy('gen', 'mine', 'max'), false);
    assert.equal(state.gens.mine, 0);
  });
  test('Max-Kauf gibt alles Bezahlbare aus und laesst keine negativen Bestaende', () => {
    give({ ore: 33 });
    assert.equal(buy('gen', 'mine', 'max'), true);
    assert.equal(state.gens.mine, 2);
    assert.equal(state.res.ore, 0);
  });
  test('x10 mit genau passenden Ressourcen -> Rest exakt 0', () => {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += Math.ceil(15 * 1.15 ** i);
    give({ ore: sum });
    assert.equal(buy('gen', 'mine', '10'), true);
    assert.equal(state.res.ore, 0);
    assert.equal(state.gens.mine, 10);
  });
  test('x10 mit zu wenig Ressourcen kauft nichts (kein Teilkauf)', () => {
    give({ ore: 100 });
    assert.equal(buy('gen', 'mine', '10'), false);
    assert.equal(state.gens.mine, 0);
    assert.equal(state.res.ore, 100);
  });
  test('gesperrter Generator (fehlende Forschung) ist nicht kaufbar', () => {
    give({ ore: 1e9, steel: 1e9 });
    assert.equal(buy('gen', 'plant', '1'), false);
    assert.equal(buy('gen', 'forge', '1'), false);
    state.research.metallurgy = 1;
    assert.equal(buy('gen', 'plant', '1'), true);
  });
  test('Forschung: Voraussetzungen und Einmaligkeit', () => {
    give({ ore: 1e6, steel: 1e6 });
    assert.equal(buy('research', 'resonance'), false);
    assert.equal(buy('research', 'geology'), true);
    assert.equal(buy('research', 'geology'), false, 'laeuft bereits');
    assert.equal(state.res.ore, 1e6 - 300);
    assert.equal(buy('research', 'resonance'), false, 'Voraussetzung erst nach Ablauf des Timers');
    finishAll();
    assert.equal(buy('research', 'geology'), false, 'schon erforscht');
    assert.equal(buy('research', 'resonance'), true);
  });
  test('Boost kaufen', () => {
    give({ steel: 150, titan: 5 });
    assert.equal(buy('boost', 'diamond'), true);
    assert.equal(state.boosts.diamond, undefined, 'wirkt erst nach dem Timer');
    finishAll();
    assert.equal(state.boosts.diamond, 1);
    assert.equal(state.res.steel, 0); assert.equal(state.res.titan, 0);
    assert.equal(buy('boost', 'diamond'), false);
  });
  test('Klick-Upgrade braucht ab Stufe 2 Stahl', () => {
    give({ ore: 1e6 });
    assert.equal(buy('click', 'click', '1'), true);
    finishAll();
    assert.equal(buy('click', 'click', '1'), true);
    finishAll();
    assert.equal(buy('click', 'click', '1'), false);
    give({ steel: 100 });
    assert.equal(buy('click', 'click', '1'), true);
    finishAll();
    assert.equal(state.clicks.click, 3);
  });
  test('unbekannte Kategorie/ID wirft nicht und kauft nichts', () => {
    give({ ore: 1e9 });
    assert.equal(buy('gen', 'gibtsnicht', '1'), false);
    assert.equal(buy('research', 'gibtsnicht'), false);
    assert.equal(buy('boost', 'gibtsnicht'), false);
  });
  test('silent unterdrueckt Toast, Buy-Event wird gesendet', () => {
    const b = collect('buy'), t = collect('toast');
    give({ ore: 300 });
    buy('research', 'geology', 1, { silent: true });
    assert.equal(b.got.length, 1); assert.equal(b.got[0].silent, true);
    assert.equal(t.got.length, 0);
    b.stop(); t.stop();
  });
  test('MAX_LEVEL: kein Kauf darueber', () => {
    state.gens.mine = MAX_LEVEL; give({ ore: 1e300, titan: 1e300 });
    assert.equal(buy('gen', 'mine', '1'), false);
    assert.equal(state.gens.mine, MAX_LEVEL);
  });
  test('addResource ignoriert NaN, negative und Infinity', () => {
    for (const v of [NaN, -5, Infinity, 0]) addResource('ore', v);
    assert.equal(state.res.ore, 0);
    assert.equal(state.stats.total.ore, 0);
  });
});

describe('Offline-Fortschritt', () => {
  test('unter 10 s oder ungueltig: null, nichts passiert', () => {
    state.gens.mine = 10;
    for (const s of [0, 5, 9.99, -100, NaN]) assert.equal(applyOffline(s), null);
    assert.equal(state.res.ore, 0);
  });
  test('1 Stunde = 3600 * Rate', () => {
    state.gens.mine = 10;
    const r = applyOffline(3600);
    assert.equal(r.seconds, 3600); assert.equal(r.capped, false);
    assert.equal(state.res.ore, 20 * 3600);
    assert.equal(r.gains.ore, 20 * 3600);
    assert.equal(state.stats.playTime, 3600);
  });
  test('Deckel nach 8 h (Basis)', () => {
    state.gens.mine = 10;
    const r = applyOffline(30 * 24 * 3600);
    assert.equal(r.capped, true); assert.equal(r.seconds, 8 * 3600);
    assert.equal(state.res.ore, 20 * 8 * 3600);
  });
  test('Nachtschicht-Upgrade verlaengert den Deckel', () => {
    state.gens.mine = 10; state.prestige.shop.offline = 3;
    assert.equal(applyOffline(1e9).seconds, 14 * 3600);
  });
  test('sehr lange Offline-Zeit (1e15 s) bleibt endlich', () => {
    state.gens.mine = MAX_LEVEL; state.prestige.total = 1e100;
    const r = applyOffline(1e15);
    assert.ok(r.capped);
    for (const v of Object.values(state.res)) assert.ok(Number.isFinite(v));
  });
  test('Infinity als Offline-Zeit wird ignoriert (kein Ertrag)', () => {
    state.gens.mine = 10;
    assert.equal(applyOffline(Infinity), null);
    assert.equal(state.res.ore, 0);
  });
  test('Buffs gelten nicht offline', () => {
    state.gens.mine = 10; state.buffs = [{ id: 'frenzy', left: 1000 }];
    applyOffline(100);
    assert.deepEqual(state.buffs, []);
    assert.equal(state.res.ore, 20 * 100);
  });
});
