// Zeitalter (Industrialisierung): Ableitung aus stats.total.ore UND stats.playTime, Bonus, Event, Neuguss, Speicherstand v5.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, collect, installStorage, give, setEra } from './helpers.mjs';
import { ERAS, EVO_MAX } from '../js/data/eras.js';
import * as F from '../js/core/formulas.js';
import * as E from '../js/systems/eras.js';
import * as S from '../js/core/save.js';
import { doPrestige } from '../js/systems/prestige.js';

installStorage();
beforeEach(() => { reset(); E.reset(); });

describe('Zeitalter: Ableitung', () => {
  test('Schwellen: knapp darunter / genau darauf (Erz und Zeit erfüllt)', () => {
    for (let i = 1; i < ERAS.length; i++) {
      setEra(i - 1); state.stats.total.ore = ERAS[i].at * 0.999; state.stats.playTime = ERAS[i].minTime;
      assert.equal(F.eraIndex(), i - 1, `Erz zu wenig bei ${ERAS[i].name}`);
      state.stats.total.ore = ERAS[i].at; state.stats.playTime = ERAS[i].minTime - 1;
      assert.equal(F.eraIndex(), i - 1, `Zeit zu wenig bei ${ERAS[i].name}`);
      setEra(i); assert.equal(F.eraIndex(), i, `auf ${ERAS[i].name}`);
    }
    state.stats.total.ore = 0; state.stats.playTime = 0; assert.equal(F.eraIndex(), 0);
  });
  test('Erz allein reicht nicht, Zeit allein reicht nicht, beides reicht', () => {
    state.stats.total.ore = 1e300; state.stats.playTime = 0; assert.equal(F.eraIndex(), 0);
    state.stats.total.ore = 0; state.stats.playTime = 1e9; assert.equal(F.eraIndex(), 0);
    state.stats.total.ore = 1e300; state.stats.playTime = 1e9; assert.equal(F.eraIndex(), ERAS.length - 1);
    // explizite Parameter überschreiben den State
    assert.equal(F.eraIndex(ERAS[2].at, ERAS[2].minTime), 2);
    assert.equal(F.eraIndex(ERAS[2].at, ERAS[1].minTime), 1);
    assert.equal(F.eraIndex(ERAS[1].at, ERAS[2].minTime), 1);
  });
  test('Letztes Zeitalter frühestens nach 7 Tagen Spielzeit', () => {
    assert.equal(ERAS[ERAS.length - 1].minTime, 7 * 86400);
    state.stats.total.ore = 1e300; state.stats.playTime = 7 * 86400 - 1; assert.ok(F.eraIndex() < ERAS.length - 1);
    state.stats.playTime = 7 * 86400; assert.equal(F.eraIndex(), ERAS.length - 1);
  });
  test('Daten: Schwellen und Mindestzeiten streng steigend, Bonus >= 1', () => {
    ERAS.forEach((e, i) => {
      assert.ok(e.mult >= 1);
      if (i) { assert.ok(e.at > ERAS[i - 1].at); assert.ok(e.minTime > ERAS[i - 1].minTime); }
    });
    assert.equal(ERAS[0].at, 0); assert.equal(ERAS[0].minTime, 0);
  });
  test('eraMult ist kumulativ und wirkt auf globalMult', () => {
    assert.equal(F.eraMult(0), 1);
    assert.ok(Math.abs(F.eraMult(2) - ERAS[0].mult * ERAS[1].mult * ERAS[2].mult) < 1e-12);
    const g0 = F.globalMult();
    setEra(2);
    assert.ok(Math.abs(F.globalMult() / g0 - F.eraMult(2)) < 1e-9);
  });
  test('eraProgress: 0..1, Minimum aus Erz (log) und Zeit (linear), am Ende 1', () => {
    assert.equal(F.eraProgress(), 0);
    state.stats.total.ore = 1e3; state.stats.playTime = 1e9; assert.ok(F.eraProgress() > 0 && F.eraProgress() < 1);   // Erz bremst
    state.stats.total.ore = 1e300; state.stats.playTime = ERAS[1].minTime / 2;
    assert.ok(Math.abs(F.eraProgress() - 0.5) < 1e-9);                                                              // Zeit bremst
    setEra(ERAS.length - 1); assert.equal(F.eraProgress(), 1);
    assert.equal(F.nextEra(), null); assert.equal(F.eraNeeds(), null);
  });
  test('eraNeeds: meldet erfüllte Bedingungen und fehlende Zeit', () => {
    state.stats.total.ore = ERAS[1].at; state.stats.playTime = 100;
    assert.deepEqual(F.eraNeeds(), { ore: true, time: false, missingTime: ERAS[1].minTime - 100 });
    state.stats.total.ore = 5; state.stats.playTime = ERAS[1].minTime + 5;
    assert.deepEqual(F.eraNeeds(), { ore: false, time: true, missingTime: 0 });
    state.stats.total.ore = 0; state.stats.playTime = 0;
    assert.deepEqual(F.eraNeeds(), { ore: false, time: false, missingTime: ERAS[1].minTime });
  });
});

describe('Zeitalter: Aufstieg (Event + Toast)', () => {
  test('Event nur beim Aufstieg, nicht beim Laden', () => {
    setEra(2);
    E.reset();                                   // Laden: kein Event für bereits erreichte Zeitalter
    const ev = collect('era'); const toasts = collect('toast');
    E.check(1, true);
    assert.equal(ev.got.length, 0);
    setEra(3);
    E.check(1, true);
    assert.equal(ev.got.length, 1); assert.equal(ev.got[0].index, 3);
    assert.ok(toasts.got.some(t => /Neues Zeitalter/.test(t.msg)));
    E.check(1, true); assert.equal(ev.got.length, 1);   // nicht doppelt
    ev.stop(); toasts.stop();
  });
  test('Sprung über mehrere Zeitalter meldet jedes einzeln', () => {
    const ev = collect('era');
    setEra(4);
    E.check(1, true);
    assert.deepEqual(ev.got.map(e => e.index), [1, 2, 3, 4]);
    ev.stop();
  });
});

describe('Zeitalter: Neuguss und Speicherstand', () => {
  test('Neuguss setzt evo zurück, das Zeitalter bleibt', () => {
    setEra(3); state.stats.run.ore = 1e9; state.evo.mine = 3;
    assert.ok(doPrestige());
    assert.equal(state.evo.mine, 0);
    assert.equal(F.eraIndex(), 3);
  });
  test('Neuguss setzt playTime nicht zurück (Zeitalter hängt an Gesamtspielzeit)', () => {
    setEra(2); state.stats.run.ore = 1e9; state.stats.runTime = 50;
    const before = state.stats.playTime;
    assert.ok(doPrestige());
    assert.equal(state.stats.playTime, before);
    assert.equal(F.eraIndex(), 2);
  });
  test('Offline-Zeit zählt zur Spielzeit und damit zum Zeitalter', () => {
    state.stats.total.ore = ERAS[1].at;
    state.stats.playTime = ERAS[1].minTime - 1000;
    assert.equal(F.eraIndex(), 0);
    const r = S.applyOffline(2000);
    assert.ok(r && r.seconds > 0 && r.seconds <= 2000);
    assert.equal(state.stats.playTime, ERAS[1].minTime - 1000 + r.seconds);
    assert.equal(F.eraIndex(), r.seconds >= 1000 ? 1 : 0);
  });
  test('Roundtrip erhält evo; sanitize klemmt und ignoriert Unbekanntes', () => {
    state.evo.mine = 2;
    const back = S.sanitize(JSON.parse(JSON.stringify(state)));
    assert.equal(back.evo.mine, 2);
    const s = S.sanitize({ evo: { mine: 99, drill: -4, foo: 1 } });
    assert.equal(s.evo.mine, EVO_MAX); assert.equal(s.evo.drill, 0); assert.equal('foo' in s.evo, false);
  });
  test('Migration v4 -> v5: evo leer, alles andere bleibt; Zeitalter folgt den Statistiken', () => {
    const old = { res: { ore: 5 }, stats: { total: { ore: 1e11 }, playTime: ERAS[2].minTime } };
    const m = S.migrate({ v: 4, t: 1, state: old });
    assert.equal(m.v, 5); assert.deepEqual(m.state.evo, {}); assert.deepEqual(old.evo, undefined);
    const s = S.sanitize(m.state);
    assert.equal(F.eraIndex(s.stats.total.ore, s.stats.playTime), 2);
    assert.equal(F.eraIndex(s.stats.total.ore, 0), 0);   // ohne Spielzeit kein Zeitalter
    assert.equal(s.evo.mine, 0);
  });
});
