import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage, collect } from './helpers.mjs';
import * as S from '../js/core/save.js';
import * as F from '../js/core/formulas.js';
import * as R from '../js/systems/events-random.js';
import * as C from '../js/systems/challenges.js';
import { buy } from '../js/systems/production.js';
import { check } from '../js/systems/achievements.js';
import { RANDOM_EVENTS } from '../js/data/events-random.js';
import { CHALLENGES, CHALLENGE_BONUS, CHALLENGE_MIN_RUN } from '../js/data/challenges.js';
import { doPrestige } from '../js/systems/prestige.js';
import { doCorp } from '../js/systems/corp.js';

beforeEach(() => { installStorage(); reset(); });
afterEach(() => R.setRandom());
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const [MIN, MAX] = RANDOM_EVENTS.interval;

describe('Zufallsereignisse', () => {
  test('Intervall 8 bis 15 min, erst nach Ablauf der Zeit; Zufall injizierbar', () => {
    assert.deepEqual(RANDOM_EVENTS.interval, [480, 900]);
    R.setRandom(() => 0); R.init();
    assert.equal(R.timeToNext(), MIN);
    R.tick(MIN - 1); assert.equal(R.getCurrent(), null);
    R.tick(1); assert.equal(R.getCurrent().type, 'vein');
    R.setRandom(() => 0.999); R.init();
    assert.ok(Math.abs(R.timeToNext() - (MIN + 0.999 * (MAX - MIN))) < 1e-9);
  });
  test('Erzader: Klick gibt Klick-Buff, Ereignis endet, nächstes erst nach Intervall', () => {
    R.setRandom(() => 0); R.init(); R.tick(MIN);
    const ends = collect('revent:end');
    assert.equal(R.respond(), true);
    assert.equal(R.getCurrent(), null); assert.equal(ends.got.length, 1);
    assert.equal(F.buffMult('click'), 10);
    assert.equal(R.respond(), false);
    R.tick(MIN - 1); assert.equal(R.getCurrent(), null);
  });
  test('ignorierbar: Hinweis läuft ab, ohne Buff/Strafe', () => {
    R.setRandom(() => 0); R.init(); R.tick(MIN);
    assert.ok(R.getCurrent());
    R.tick(1e5);
    assert.equal(R.getCurrent(), null); assert.deepEqual(state.buffs, []);
  });
  test('Rohstoffengpass: -50 % auf die Ressource, Klick behebt ihn', () => {
    state.gens.mine = 10;
    const base = F.rates().ore;
    R.setRandom(seq(0, 0.5, 0)); R.init();   // Intervall, Typ 2 von 3, Ressource ore
    R.tick(MIN);
    assert.equal(R.getCurrent().type, 'shortage'); assert.equal(R.getCurrent().res, 'ore');
    assert.equal(F.rates().ore, base * 0.5);
    R.respond();
    assert.equal(F.rates().ore, base); assert.deepEqual(state.buffs, []);
  });
  test('Engpass ist zeitlich begrenzt (Buff läuft ab)', () => {
    state.gens.mine = 10;
    R.setRandom(seq(0, 0.5, 0)); R.init(); R.tick(MIN);
    assert.equal(state.buffs.length, 1);
    state.buffs = [];   // wie production.tick nach Ablauf
    assert.equal(F.rates().ore, 20);
  });
  test('Sonderauftrag: ohne Bestand kein Erfolg, mit Bestand wird geliefert und Bonus gegeben', () => {
    state.gens.mine = 10;
    R.setRandom(seq(0, 0.99, 0)); R.init(); R.tick(MIN);
    const ev = R.getCurrent(); assert.equal(ev.type, 'order'); assert.equal(ev.res, 'ore');
    assert.equal(ev.need, Math.max(10, Math.ceil(20 * 45)));
    assert.equal(R.respond(), false); assert.ok(R.getCurrent());
    state.res.ore = ev.need + 5;
    assert.equal(R.respond(), true);
    assert.equal(state.res.ore, 5); assert.equal(F.buffMult('prod'), 2); assert.equal(R.getCurrent(), null);
  });
  test('Sonderauftrag verfällt nach 90 s ohne Strafe', () => {
    state.gens.mine = 10; state.res.ore = 3;
    R.setRandom(seq(0, 0.99, 0)); R.init(); R.tick(MIN);
    R.tick(89); assert.ok(R.getCurrent()); R.tick(1); assert.equal(R.getCurrent(), null);
    assert.equal(state.res.ore, 3);
  });
  test('ohne Produktion gibt es nur die Erzader', () => {
    R.setRandom(seq(0, 0.99)); R.init(); R.tick(MIN);
    assert.equal(R.getCurrent().type, 'vein');
  });
  test('höchstens ein Ereignis: während eines offenen Ereignisses läuft kein Timer', () => {
    R.setRandom(() => 0); R.init(); R.tick(MIN);
    const ev = R.getCurrent(); R.tick(10);
    assert.equal(R.getCurrent(), ev);
  });
  test('Spielstand: Engpass-Buff bleibt mit gültiger Ressource, sonst verworfen', () => {
    const b = res => S.sanitize({ buffs: [{ id: 'shortage', left: 30, res }] }).buffs;
    assert.deepEqual(b('steel'), [{ id: 'shortage', left: 30, res: 'steel' }]);
    for (const bad of ['nope', 5, null, '__proto__']) assert.deepEqual(b(bad), []);
  });
});

describe('Herausforderungen', () => {
  const unlock = () => { state.prestige.count = 1; state.stats.runTime = CHALLENGE_MIN_RUN; };
  test('Ab dem ersten Neuguss; Start setzt nichts zurück, nur eine aktive', () => {
    assert.equal(C.start('noclick'), false);
    unlock(); state.gens.mine = 5; state.res.ore = 99;
    state.stats.runTime = CHALLENGE_MIN_RUN - 1; assert.equal(C.start('noclick'), false); assert.equal(C.startIn(), 1);   // Mindestlaufzeit seit dem Neuguss
    state.stats.runTime = CHALLENGE_MIN_RUN;
    assert.equal(C.start('noclick'), true);
    assert.equal(C.start('iron'), false);
    assert.equal(state.gens.mine, 5); assert.equal(state.res.ore, 99);
    assert.equal(state.challenges.active.goal, CHALLENGES[0].floor);
    C.abort();
    assert.equal(C.start('unbekannt'), false);
  });
  test('Ohne Klicken: Klickertrag 0', () => {
    unlock();
    assert.ok(F.rates().click > 0);
    C.start('noclick'); assert.equal(F.rates().click, 0);
    C.abort(); assert.ok(F.rates().click > 0);
  });
  test('Ein Generator: erster Kauf legt den Typ fest, andere gesperrt', () => {
    unlock(); state.res.ore = 1e9; state.res.coal = 1e9; state.res.steel = 1e9;
    C.start('onegen');
    assert.equal(buy('gen', 'mine', 1), true);
    assert.equal(state.challenges.active.gen, 'mine');
    assert.equal(buy('gen', 'drill', 1), false); assert.equal(state.gens.drill, 0);
    assert.ok(F.lockReason('gen', 'drill'));
    assert.equal(buy('gen', 'mine', 1), true);
    C.abort(); assert.equal(buy('gen', 'drill', 1), true);
  });
  test('Eiserne Frist: Produktion halbiert', () => {
    unlock(); state.gens.mine = 10;
    const base = F.rates().ore;
    C.start('iron'); assert.equal(F.rates().ore, base * 0.5);
  });
  test('Abschluss: Bonus +3 % einmalig, Erfolg, Wiederholung ohne weiteren Bonus', () => {
    unlock(); state.gens.mine = 10;
    const base = F.rates().ore;
    C.start('noclick');
    const ev = collect('challenge');
    state.stats.total.steel += CHALLENGES[0].floor; C.tick(1);
    assert.equal(state.challenges.active, null); assert.equal(state.challenges.done.noclick, true);
    assert.equal(ev.got.at(-1).done, 'noclick');
    assert.ok(Math.abs(F.rates().ore - base * (1 + CHALLENGE_BONUS)) < 1e-9);
    check(0, true); assert.ok(state.achievements.challenge_1); assert.ok(!state.achievements.challenge_3);
    C.start('noclick'); state.stats.total.steel += CHALLENGES[0].floor; C.tick(1);
    assert.equal(Object.keys(state.challenges.done).length, 1);
    for (const c of CHALLENGES) state.challenges.done[c.id] = true;
    check(0, true); assert.ok(state.achievements.challenge_3);
    assert.ok(Math.abs(F.challengeMult() - (1 + 3 * CHALLENGE_BONUS)) < 1e-12);
  });
  test('Scheitern bei Fristablauf: nichts verloren, kein Bonus', () => {
    unlock(); state.res.ore = 77;
    C.start('iron');
    C.tick(1799); assert.ok(state.challenges.active);
    C.tick(2); assert.equal(state.challenges.active, null);
    assert.deepEqual(state.challenges.done, {}); assert.equal(state.res.ore, 77);
  });
  test('Abbruch ohne Verlust; Stahlfortschritt zählt erst ab Start', () => {
    unlock(); state.stats.total.steel = 1000;
    C.start('noclick'); assert.equal(C.progress(), 0);
    state.stats.total.steel = 1100; assert.equal(C.progress(), 100);
    assert.equal(C.abort(), true); assert.equal(C.abort(), false);
    assert.equal(state.stats.total.steel, 1100);
  });
  test('Ziel skaliert mit der Stahlrate beim Start', () => {
    unlock(); state.gens.smelter = 50;
    const r = F.rates().steel; assert.ok(r > 0);
    C.start('iron');
    const d = CHALLENGES.find(c => c.id === 'iron');
    assert.equal(state.challenges.active.goal, Math.ceil(Math.max(d.floor, r * d.time * d.k)));
  });
  test('Ziel ignoriert Buffs (Tagesbonus, goldene Barren, Engpass) und bleibt gleich', () => {
    unlock(); state.gens.smelter = 50; state.gens.mine = 50;
    C.start('iron'); const plain = state.challenges.active.goal; C.abort();
    state.buffs = [{ id: 'frenzy', left: 40 }, { id: 'shortage', left: 40, res: 'steel' }];
    C.start('iron'); assert.equal(state.challenges.active.goal, plain);
    assert.equal(state.buffs.length, 2);   // Buffs bleiben erhalten
  });
  test('Offline-Stahl (8 h) zählt nicht: Herausforderung bleibt aktiv, Fortschritt 0', () => {
    unlock(); state.gens.smelter = 50; state.gens.mine = 50; state.res.ore = 1e9; state.res.coke = 1e9;
    assert.ok(F.rates().steel > 0);
    C.start('noclick');
    const a = state.challenges.active, steel0 = state.stats.total.steel;
    const r = S.applyOffline(8 * 3600);
    assert.ok(r.gains.steel > 0); assert.ok(state.stats.total.steel > steel0);
    assert.equal(C.progress(), 0);
    C.tick(1); assert.equal(state.challenges.active, a); assert.deepEqual(state.challenges.done, {});
    assert.equal(a.left, CHALLENGES[0].time - 1);   // Frist läuft nur in aktiver Spielzeit
    // Laufzeitpfad (Hintergrund-Tab) ebenso
    S.applyOffline(3600, { runtime: true }); assert.equal(C.progress(), 0);
  });
  test('Neuguss und Konzerngründung brechen ab (Toast, kein Bonus) und planen Zufallsereignisse neu', () => {
    for (const reset of [() => { state.stats.run.ore = 1e30; return doPrestige(); }, () => { state.corp.total = 0; state.prestige.total = 1e9; state.prestige.count = 100; state.stats.corpRunTime = 1e6; return doCorp(); }]) {
      reset_();
      unlock();
      R.setRandom(() => 0); R.init(); R.tick(MIN);
      assert.ok(R.getCurrent());   // offenes Ereignis
      C.start('iron'); assert.ok(state.challenges.active);
      const toasts = collect('toast'), ends = collect('revent:end');
      assert.equal(reset(), true);
      assert.equal(state.challenges.active, null); assert.deepEqual(state.challenges.done, {});
      assert.ok(toasts.got.some(x => x.kind === 'warn' && /abgebrochen/.test(x.msg)));
      assert.equal(R.getCurrent(), null); assert.ok(ends.got.length >= 1); assert.equal(R.timeToNext(), MIN);
    }
    function reset_() { S.resetGame(); }
  });
});

describe('Offline-Faktor im Laufzeitpfad', () => {
  test('beim Laden 60 %, im Hintergrund-Tab (runtime) 100 %', () => {
    state.gens.mine = 10;
    assert.equal(S.applyOffline(1000).gains.ore, 20 * 1000 * 0.6);
    reset();
    state.gens.mine = 10;
    const r = S.applyOffline(1000, { runtime: true });
    assert.equal(r.gains.ore, 20 * 1000); assert.equal(r.efficiency, 1);
  });
});

describe('Save v9: challenges', () => {
  test('SAVE_VERSION 9, Migration v8 -> v9 leer, Eingabe unverändert', () => {
    assert.equal(S.SAVE_VERSION, 9);
    const old = { res: {} };
    assert.deepEqual(S.migrateV8toV9(old).challenges, { done: {}, active: null });
    assert.equal(old.challenges, undefined);
    const m = S.migrate({ v: 8, t: 1, state: {} });
    assert.equal(m.v, 9); assert.deepEqual(m.state.challenges, { done: {}, active: null });
  });
  test('Roundtrip erhält done und aktiven Lauf', () => {
    state.prestige.count = 1; state.stats.runTime = CHALLENGE_MIN_RUN; C.start('onegen'); state.challenges.done.iron = true; state.challenges.active.gen = 'mine';
    const before = JSON.parse(JSON.stringify(state.challenges));
    S.importSave(S.exportSave());
    assert.deepEqual(state.challenges, before);
  });
  test('sanitize streng: Müll wird verworfen, Werte geklemmt', () => {
    const s = d => S.sanitize({ challenges: d }).challenges;
    const empty = { done: {}, active: null };
    for (const bad of [null, 5, 'x', [], { done: 3, active: 'x' }]) assert.deepEqual(s(bad), empty);
    assert.deepEqual(s({ done: { noclick: true, iron: 1, foo: true, onegen: 'ja' } }).done, { noclick: true });
    for (const a of [{ id: 'nope', left: 5, goal: 5 }, { id: 'iron', left: 'x', goal: 5 }, { id: 'iron', left: 5, goal: -1 }, { id: 'iron', left: 0, goal: 5 }, { id: 'iron', left: NaN, goal: 5 }, { id: '__proto__', left: 5, goal: 5 }, 7])
      assert.equal(s({ active: a }).active, null);
    assert.deepEqual(s({ active: { id: 'iron', left: 99999, goal: 50, base: -3, gen: 'xx', extra: 1 } }).active, { id: 'iron', left: 1800, goal: 50, base: 0, gen: '' });
    assert.equal(s({ active: { id: 'iron', left: 5, goal: 5, gen: 'mine' } }).active.gen, 'mine');
  });
});
