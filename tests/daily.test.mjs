import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage } from './helpers.mjs';
import * as S from '../js/core/save.js';
import { claimDaily } from '../js/systems/daily.js';
import { OFFLINE_EFFICIENCY } from '../js/data/timers.js';
import { DAILY, BUFFS } from '../js/data/golden.js';

beforeEach(() => { reset(); installStorage(); });
const day = (y, m, d) => new Date(y, m - 1, d, 12);

describe('Offline-Faktor', () => {
  test('60 % des Aktiv-Ertrags, Konstante 0,6, Zeit unverändert', () => {
    assert.equal(OFFLINE_EFFICIENCY, 0.6);
    state.gens.mine = 10;
    const r = S.applyOffline(1000);
    assert.equal(r.gains.ore, 20 * 1000 * 0.6);
    assert.equal(r.efficiency, 0.6); assert.equal(r.away, 1000); assert.equal(state.stats.playTime, 1000);
  });
  test('away meldet die rohe Abwesenheit, seconds die gekappte', () => {
    const r = S.applyOffline(1e7);
    assert.equal(r.away, 1e7); assert.equal(r.seconds, 8 * 3600); assert.ok(r.capped);
  });
});

describe('Tagesbonus', () => {
  test('erster Start: Serie 1, Buff vorhanden; am selben Tag nichts', () => {
    const r = claimDaily(day(2026, 10, 14));
    assert.equal(r.streak, 1); assert.equal(r.seconds, BUFFS[DAILY.buff].duration);
    assert.deepEqual(state.daily, { last: '2026-10-14', streak: 1 });
    assert.ok(state.buffs.some(b => b.id === DAILY.buff));
    assert.equal(claimDaily(day(2026, 10, 14)), null);
  });
  test('Folgetag erhöht die Serie (auch über Monatsgrenze), Lücke setzt auf 1', () => {
    claimDaily(day(2026, 1, 31));
    assert.equal(claimDaily(day(2026, 2, 1)).streak, 2);
    assert.equal(claimDaily(day(2026, 2, 3)).streak, 1);
  });
  test('Bonus wächst bis Tag 7, danach gleich; Serie zählt weiter', () => {
    const secs = [];
    for (let d = 1; d <= 9; d++) { state.buffs = []; const r = claimDaily(day(2026, 3, d)); secs.push(r.seconds); assert.equal(r.streak, d); }
    assert.ok(secs[6] > secs[0]); assert.equal(secs[7], secs[6]); assert.equal(secs[8], secs[6]);
    assert.equal(state.daily.streak, 9);
  });
  test('Uhr zurückgestellt: nichts, Zustand unverändert', () => {
    claimDaily(day(2026, 5, 10));
    state.buffs = [];
    assert.equal(claimDaily(day(2026, 5, 9)), null);
    assert.deepEqual(state.daily, { last: '2026-05-10', streak: 1 });
    assert.deepEqual(state.buffs, []);
  });
});

describe('Tagesbonus: Uhr vorgestellt', () => {
  test('last mehr als 1 Tag in der Zukunft: last = heute, Serie 1, kein Bonus; genau 1 Tag bleibt unverändert', () => {
    state.daily = { last: '2026-05-12', streak: 6 };
    assert.equal(claimDaily(day(2026, 5, 10)), null);
    assert.deepEqual(state.daily, { last: '2026-05-10', streak: 1 });
    assert.deepEqual(state.buffs, []);
    assert.equal(claimDaily(day(2026, 5, 11)).streak, 2);   // Folgetag zählt normal weiter
    state.daily = { last: '2026-05-11', streak: 6 }; state.buffs = [];
    assert.equal(claimDaily(day(2026, 5, 10)), null);   // nur 1 Tag voraus: nichts ändert sich
    assert.deepEqual(state.daily, { last: '2026-05-11', streak: 6 });
  });
});

describe('Buff-Kappe im Spielstand', () => {
  test('Tagesbonus Serie 7 mit Glücksbringer 5 (45 s x 1,5 x 2,5) wird nicht gekürzt', () => {
    const max = BUFFS[DAILY.buff].duration * 1.5 * (1 + DAILY.perStreak * (DAILY.maxStreak - 1));
    assert.equal(S.sanitize({ buffs: [{ id: DAILY.buff, left: max }] }).buffs[0].left, max);
  });
});

describe('Save v7: daily', () => {
  test('Migration v6 -> v7 leer, Eingabe unverändert', () => {
    const old = { res: { ore: 5 } };
    const m = S.migrate({ v: 6, t: 1, state: old });
    assert.equal(m.v, 9); assert.deepEqual(m.state.daily, { last: '', streak: 0 }); assert.equal(old.daily, undefined);
  });
  test('Roundtrip und sanitize (kaputtes Datum, negative Serie)', () => {
    state.daily = { last: '2026-10-14', streak: 4 };
    S.importSave(S.exportSave());
    assert.deepEqual(state.daily, { last: '2026-10-14', streak: 4 });
    assert.deepEqual(S.sanitize({ daily: { last: 'gestern', streak: 5 } }).daily, { last: '', streak: 0 });
    assert.deepEqual(S.sanitize({ daily: { last: '2026-01-01', streak: -3 } }).daily, { last: '2026-01-01', streak: 0 });
    assert.deepEqual(S.sanitize({ daily: 7 }).daily, { last: '', streak: 0 });
  });
});
