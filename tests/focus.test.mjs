import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage } from './helpers.mjs';
import { setFocus, doPrestige } from '../js/systems/prestige.js';
import { doCorp } from '../js/systems/corp.js';
import { focusMult, rates, genOutputAt } from '../js/core/formulas.js';
import { GEN_MAP } from '../js/data/generators.js';
import { FOCUS, FOCUS_BONUS, FOCUS_MALUS, FOCUS_RES } from '../js/data/prestige.js';
import { RES_IDS } from '../js/data/resources.js';
import * as S from '../js/core/save.js';

beforeEach(() => { installStorage(); reset(); });

describe('Schwerpunkt (Fokus)', () => {
  test('jede Fokus-Ressource gehört zu genau einer Kette, Erz ist neutral', () => {
    const all = FOCUS.flatMap(f => f.res);
    assert.equal(new Set(all).size, all.length);
    for (const k of all) assert.ok(RES_IDS.includes(k), k);
    assert.ok(!FOCUS_RES.has('ore'));
  });
  test('focusMult: Bonus auf eigene Kette, Malus auf andere, Erz und ohne Fokus 1', () => {
    assert.equal(focusMult('steel'), 1);
    state.focus = 'steel';
    assert.equal(focusMult('steel'), 1 + FOCUS_BONUS);
    assert.equal(focusMult('titan'), 1 - FOCUS_MALUS);
    assert.equal(focusMult('gold'), 1 - FOCUS_MALUS);
    assert.equal(focusMult('ore'), 1);
  });
  test('Wirkung auf Generator-Ausgabe und rates()', () => {
    state.gens.smelter = 5; state.gens.mine = 5;
    const base = genOutputAt(GEN_MAP.smelter, 5), r0 = rates();
    state.focus = 'steel';
    assert.ok(Math.abs(genOutputAt(GEN_MAP.smelter, 5) / base - (1 + FOCUS_BONUS)) < 1e-9);
    const r1 = rates();
    assert.ok(Math.abs(r1.steel / r0.steel - (1 + FOCUS_BONUS)) < 1e-9);
    assert.equal(r1.ore, r0.ore);
    state.focus = 'gold';
    assert.ok(rates().steel < r0.steel);
  });
  test('setFocus nimmt nur bekannte IDs; wirkt erst mit dem Neuguss, danach neu wählen', () => {
    assert.equal(setFocus('nope'), false); assert.equal(setFocus('__proto__'), false);
    assert.equal(setFocus('titan'), true);
    assert.equal(state.focusNext, 'titan'); assert.equal(state.focus, '');
    state.stats.run.ore = 1e8;
    assert.equal(doPrestige(), true);
    assert.equal(state.focus, 'titan'); assert.equal(state.focusNext, '');
    state.stats.run.ore = 1e8;
    doPrestige();
    assert.equal(state.focus, '', 'ohne neue Wahl kein Fokus im folgenden Durchlauf');
    assert.equal(setFocus(''), true);
  });
  test('Auto-Neuguss an: letzte Wahl bleibt in focusNext, aus: wird geleert', () => {
    state.autoCast.on = true; setFocus('gold');
    state.stats.run.ore = 1e8; assert.equal(doPrestige(), true);
    assert.equal(state.focus, 'gold'); assert.equal(state.focusNext, 'gold');
    state.stats.run.ore = 1e8; doPrestige();
    assert.equal(state.focus, 'gold');
    state.autoCast.on = false; state.stats.run.ore = 1e8; doPrestige();
    assert.equal(state.focusNext, '');
  });
  test('Konzerngründung setzt Fokus zurück', () => {
    state.focus = 'gold'; state.focusNext = 'steel';
    state.prestige.count = 100; state.prestige.total = 1e6; state.stats.corpRunTime = 36000;
    state.stats.total.ore = 1e30; state.stats.run.ore = 1e30;
    assert.equal(doCorp(), true);
    assert.equal(state.focus, ''); assert.equal(state.focusNext, '');
  });
});

describe('Save v8', () => {
  test('SAVE_VERSION 9, Migration v7 -> v8 setzt leeren Fokus, Eingabe bleibt unverändert', () => {
    assert.equal(S.SAVE_VERSION, 9);
    const old = { res: {} };
    assert.deepEqual(S.migrateV7toV8(old), { res: {}, focus: '', focusNext: '' });
    assert.equal(old.focus, undefined);
    const m = S.migrate({ v: 7, t: 1, state: {} });
    assert.equal(m.v, 9); assert.equal(m.state.focus, '');
  });
  test('sanitize: gültige IDs bleiben, Müll wird zu leer', () => {
    assert.equal(S.sanitize({ focus: 'gold', focusNext: 'titan' }).focus, 'gold');
    assert.equal(S.sanitize({ focus: 'gold', focusNext: 'titan' }).focusNext, 'titan');
    for (const bad of ['nope', 5, null, {}, '__proto__', 'constructor']) {
      const s = S.sanitize({ focus: bad, focusNext: bad });
      assert.equal(s.focus, ''); assert.equal(s.focusNext, '');
    }
    assert.equal(S.sanitize({}).focus, '');
  });
  test('Roundtrip erhält Fokus', () => {
    state.focus = 'steel'; state.focusNext = 'gold';
    const back = S.sanitize(S.migrate(JSON.parse(S.serialize())).state);
    assert.equal(back.focus, 'steel'); assert.equal(back.focusNext, 'gold');
  });
});
