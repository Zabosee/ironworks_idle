// Zeitalter (Industrialisierung): Ableitung aus stats.total.ore (ab 1. Neuguss), Bonus, Event, Neuguss, Speicherstand v5.
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
  test('Schwellen: knapp darunter / genau darauf', () => {
    for (let i = 1; i < ERAS.length; i++) {
      setEra(i - 1); state.stats.total.ore = ERAS[i].at * 0.999;
      assert.equal(F.eraIndex(), i - 1, `Erz zu wenig bei ${ERAS[i].name}`);
      setEra(i); assert.equal(F.eraIndex(), i, `auf ${ERAS[i].name}`);
    }
    state.stats.total.ore = 0; assert.equal(F.eraIndex(), 0);
  });
  test('Vor dem 1. Neuguss gilt Zeitalter 0, egal wie viel Erz; danach greift das Erz', () => {
    state.stats.total.ore = 1e300; state.prestige.count = 0;
    assert.equal(F.industryUnlocked(), false);
    assert.equal(F.eraIndex(), 0); assert.equal(F.eraMult(), 1); assert.equal(F.nextEra(), ERAS[1]);
    assert.equal(F.eraProgress() > 0, true);
    state.prestige.count = 1;
    assert.equal(F.industryUnlocked(), true);
    assert.equal(F.eraIndex(), ERAS.length - 1);
    // explizite Parameter überschreiben den State
    assert.equal(F.eraIndex(ERAS[2].at, true), 2);
    assert.equal(F.eraIndex(ERAS[2].at, false), 0);
    assert.equal(F.eraIndex(ERAS[1].at), 1);
  });
  test('Keine Mindest-Spielzeit mehr: playTime hat keinen Einfluss', () => {
    for (const e of ERAS) assert.equal('minTime' in e, false);
    setEra(ERAS.length - 1); state.stats.playTime = 0;
    assert.equal(F.eraIndex(), ERAS.length - 1);
  });
  test('Daten: Schwellen streng steigend, Bonus >= 1', () => {
    ERAS.forEach((e, i) => {
      assert.ok(e.mult >= 1);
      if (i) assert.ok(e.at > ERAS[i - 1].at);
    });
    assert.equal(ERAS[0].at, 0);
  });
  test('eraMult ist kumulativ und wirkt auf globalMult', () => {
    assert.equal(F.eraMult(0), 1);
    assert.ok(Math.abs(F.eraMult(2) - ERAS[0].mult * ERAS[1].mult * ERAS[2].mult) < 1e-12);
    const g0 = F.globalMult();
    setEra(2);
    assert.ok(Math.abs(F.globalMult() / g0 - F.eraMult(2) * F.industryMult()) < 1e-9);   // Erz 1e17 hebt auch die Industrie-Leiste
  });
  test('eraProgress: 0..1 (log. im Erz), am Ende 1', () => {
    state.prestige.count = 1;
    assert.equal(F.eraProgress(), 0);
    state.stats.total.ore = Math.sqrt(ERAS[1].at); assert.ok(Math.abs(F.eraProgress() - 0.5) < 1e-9);
    setEra(ERAS.length - 1); assert.equal(F.eraProgress(), 1);
    assert.equal(F.nextEra(), null);
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
    state.prestige.count = 1; E.reset();   // Industrie bereits freigeschaltet (z. B. Offline-Sprung)
    setEra(4);
    E.check(1, true);
    assert.deepEqual(ev.got.map(e => e.index), [1, 2, 3, 4]);
    ev.stop();
  });
  test('Der 1. Neuguss übernimmt bereits erzielte Zeitalter still (keine Toast-Flut)', () => {
    const ev = collect('era'), toasts = collect('toast');
    state.stats.total.ore = ERAS[3].at;       // Erz reicht fuer Zeitalter 3, aber noch kein Neuguss
    E.check(1, true);
    assert.equal(ev.got.length, 0);
    state.prestige.count = 1;                  // Neuguss: Industrie schaltet frei, eraIndex springt auf 3
    E.check(1, true);
    assert.equal(F.eraIndex(), 3);
    assert.equal(ev.got.length, 0, 'keine Events fuer uebersprungene Zeitalter');
    assert.equal(toasts.got.length, 0, 'keine Toasts');
    state.stats.total.ore = ERAS[4].at;        // das naechste echte Zeitalter wird gemeldet
    E.check(1, true);
    assert.deepEqual(ev.got.map(e => e.index), [4]);
    ev.stop(); toasts.stop();
  });
});

describe('Zeitalter: Neuguss und Speicherstand', () => {
  test('Neuguss setzt evo zurück, das Zeitalter bleibt', () => {
    setEra(3); state.stats.run.ore = 1e9; state.evo.mine = 3;
    assert.ok(doPrestige());
    assert.equal(state.evo.mine, 0);
    assert.equal(F.eraIndex(), 3);
  });
  test('Neuguss setzt playTime nicht zurück (reine Statistik)', () => {
    setEra(2); state.stats.run.ore = 1e9; state.stats.runTime = 50; state.stats.playTime = 1234;
    assert.ok(doPrestige());
    assert.equal(state.stats.playTime, 1234);
    assert.equal(F.eraIndex(), 2);
  });
  test('Der 1. Neuguss schaltet die Industrie frei und aktiviert die Zeitalter', () => {
    state.stats.total.ore = ERAS[2].at; state.stats.run.ore = 1e9; state.stats.runTime = 50;
    assert.equal(F.industryUnlocked(), false); assert.equal(F.eraIndex(), 0);
    assert.ok(doPrestige());
    assert.equal(state.prestige.count, 1);
    assert.equal(F.industryUnlocked(), true); assert.equal(F.eraIndex(), 2);
  });
  test('Alter Spielstand mit viel Erz, aber ohne Neuguss: kein Crash, Zeitalter 0', () => {
    const s = S.sanitize({ stats: { total: { ore: 1e30 } }, evo: { mine: 2 } });
    assert.equal(s.prestige.count, 0);
    assert.equal(F.eraIndex(s.stats.total.ore, s.prestige.count >= 1), 0);
  });
  test('Offline-Zeit erhöht playTime weiter (Statistik)', () => {
    state.stats.playTime = 100;
    const r = S.applyOffline(2000);
    assert.ok(r && r.seconds > 0 && r.seconds <= 2000);
    assert.equal(state.stats.playTime, 100 + r.seconds);
  });
  test('Roundtrip erhält evo; sanitize klemmt und ignoriert Unbekanntes', () => {
    state.evo.mine = 2;
    const back = S.sanitize(JSON.parse(JSON.stringify(state)));
    assert.equal(back.evo.mine, 2);
    const s = S.sanitize({ evo: { mine: 99, drill: -4, foo: 1 } });
    assert.equal(s.evo.mine, EVO_MAX); assert.equal(s.evo.drill, 0); assert.equal('foo' in s.evo, false);
  });
  test('Migration v4 -> v5: evo leer, alles andere bleibt; Zeitalter folgt den Statistiken', () => {
    const old = { res: { ore: 5 }, stats: { total: { ore: ERAS[2].at }, playTime: 5000 }, prestige: { count: 1 } };
    const m = S.migrate({ v: 4, t: 1, state: old });
    assert.equal(m.v, S.SAVE_VERSION); assert.deepEqual(m.state.evo, {}); assert.deepEqual(old.evo, undefined);
    const s = S.sanitize(m.state);
    assert.equal(s.stats.playTime, 5000);
    assert.equal(F.eraIndex(ERAS[2].at, s.prestige.count >= 1), 2);
    assert.equal(s.evo.mine, 0);
  });
});

describe('Zeitalter 6 bis 8 (Industrie-Ausbau)', () => {
  test('9 Zeitalter, Namen/Schwellen/Boni laut Design, kumulativ x31,6', () => {
    assert.equal(ERAS.length, 9);
    assert.deepEqual(ERAS.slice(6).map(e => [e.id, e.at, e.mult]), [['atomic', 8e26, 1.5], ['space', 8e27, 1.5], ['cosmic', 8e28, 2]]);
    assert.ok(Math.abs(F.eraMult(8) - 7.02 * 4.5) < 0.01);
  });
  test('Schwellen 6 bis 8 greifen', () => {
    setEra(5); state.stats.total.ore = 7.9e26; assert.equal(F.eraIndex(), 5);
    state.stats.total.ore = 8e26; assert.equal(F.eraIndex(), 6);
    state.stats.total.ore = 8e28; assert.equal(F.eraIndex(), 8); assert.equal(F.nextEra(), null);
  });
  test('Spielstand: evo bis EVO_MAX = 8 bleibt, darüber wird geklemmt', () => {
    assert.equal(EVO_MAX, 8);
    const s = S.sanitize({ evo: { mine: 8, drill: 9 } });
    assert.equal(s.evo.mine, 8); assert.equal(s.evo.drill, 8);
  });
});
