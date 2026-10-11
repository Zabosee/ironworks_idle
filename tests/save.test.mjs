import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage, collect, quietConsole, zeroRes } from './helpers.mjs';
import * as S from '../js/core/save.js';
import { defaultState } from '../js/core/state.js';
import { MAX_LEVEL } from '../js/data/generators.js';

let ls;
beforeEach(() => { ls = installStorage(); reset(); });

const b64 = obj => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8').toString('base64');
const wrap = st => b64({ v: 2, t: 1_700_000_000_000, state: st });

describe('Export / Import', () => {
  test('Roundtrip erhaelt den Spielstand', () => {
    state.res.ore = 1234.5; state.gens.mine = 42; state.clicks.click = 7;
    state.research.geology = 1; state.boosts.diamond = 1;
    state.prestige = { points: 3, total: 9, count: 2, shop: { pp_eff: 2 }, history: [] };
    state.achievements.click_1 = 12345;
    state.buffs = [{ id: 'frenzy', left: 30 }];
    state.settings.format = 'engineering'; state.settings.buyAmount = 'max'; state.settings.autosaveSec = 30;
    state.autobuyers.gens = true;
    state.stats.clicks = 99;
    const expected = JSON.parse(JSON.stringify(state));
    const code = S.exportSave();
    reset();
    assert.equal(state.gens.mine, 0);
    S.importSave(code);
    const got = JSON.parse(JSON.stringify(state));
    delete got.savedAt; delete expected.savedAt;
    assert.deepEqual(got, expected);
  });
  test('Export ist gueltiges Base64 und parsebares JSON', () => {
    const code = S.exportSave();
    assert.match(code, /^[A-Za-z0-9+/]+=*$/);
    const o = JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
    assert.equal(o.v, S.SAVE_VERSION);
    assert.ok(o.state && o.t > 0);
  });
  test('Import toleriert Leerzeichen/Zeilenumbrueche', () => {
    state.gens.mine = 5;
    const code = S.exportSave();
    reset();
    S.importSave('  ' + code.slice(0, 10) + '\n' + code.slice(10) + ' \r\n');
    assert.equal(state.gens.mine, 5);
  });
  test('Import speichert und sendet loaded', () => {
    const ev = collect('loaded');
    S.importSave(S.exportSave());
    assert.equal(ev.got.length, 1);
    assert.ok(ls.getItem(S.SAVE_KEY));
    ev.stop();
  });
  test('kaputte Eingaben werfen deutsche Fehler und lassen den Zustand unangetastet', () => {
    state.gens.mine = 11;
    const cases = [
      ['', /Kein Spielstand/],
      ['   \n ', /Kein Spielstand/],
      [null, /Kein Spielstand/],
      [undefined, /Kein Spielstand/],
      ['das ist kein base64!!!', /beschädigt/],
      [b64('kein json'), /beschädigt/],
      [b64('{"v":2,'), /beschädigt/],
      [b64('null'), /Format/],
      [b64('[]'), /Format/],
      [b64('42'), /Format/],
      [b64('{"v":2}'), /Daten/],
      [b64('{"v":"x","state":{}}'), /Version/],
      [b64('{"v":0,"state":{}}'), /Version/],
      [b64('{"v":1.5,"state":{}}'), /Version/],
      [b64('{"v":99,"state":{}}'), /neuer/],
      ['A'.repeat(2_000_001), /zu groß/],
    ];
    for (const [input, re] of cases) {
      assert.throws(() => S.importSave(input), re, String(input).slice(0, 30));
      assert.equal(state.gens.mine, 11);
    }
  });
  test('ungueltiges UTF-8 im Import wird abgelehnt', () => {
    assert.throws(() => S.importSave(Buffer.from([0xff, 0xfe, 0xfd]).toString('base64')), /beschädigt/);
  });
  test('Import mit Umlauten/Unicode im JSON funktioniert', () => {
    S.importSave(b64({ v: 2, t: 5, state: { settings: { format: 'standard' }, x: 'Größe ⛏️' } }));
    assert.equal(state.settings.format, 'standard');
  });
  test('Import ohne localStorage schlaegt nicht fehl', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    const code = b64({ v: 2, t: 5, state: { gens: { mine: 3 } } });
    assert.doesNotThrow(() => S.importSave(code));
    assert.equal(state.gens.mine, 3);
  });
});

describe('Validierung (sanitize) – negative / NaN / Muell-Werte', () => {
  test('negative, NaN, String, null, Infinity-Werte werden auf 0 bzw. Grenzen gesetzt', () => {
    S.importSave(wrap({
      res: { ore: -5, steel: 'abc', titan: null },
      gens: { mine: -3, drill: 1e9, smelter: 2.9, plant: 'x', forge: NaN },
      click: -1,
      prestige: { points: -1, total: 'x', count: -4, shop: { pp_eff: 999, pp_gain: -2, keep: 5 } },
    }));
    assert.deepEqual(state.res, zeroRes());
    assert.equal(state.gens.mine, 0);
    assert.equal(state.gens.drill, MAX_LEVEL);
    assert.equal(state.gens.smelter, 2);
    assert.equal(state.gens.plant, 0);
    assert.equal(state.gens.forge, 0);
    assert.equal(state.clicks.click, 0);
    assert.equal(state.prestige.points, 0);
    assert.equal(state.prestige.total, 0);
    assert.equal(state.prestige.count, 0);
    assert.equal(state.prestige.shop.pp_eff, 10);
    assert.equal(state.prestige.shop.pp_gain, undefined);
    assert.equal(state.prestige.shop.keep, 1);
  });
  test('1e400 (parst zu Infinity) wird verworfen, riesige Werte gedeckelt', () => {
    S.importSave(b64('{"v":2,"t":1,"state":{"res":{"ore":1e400,"steel":1e305,"titan":1e299}}}'));
    assert.equal(state.res.ore, 0);
    assert.equal(state.res.steel, 1e300);
    assert.equal(state.res.titan, 1e299);
  });
  test('unbekannte Schluessel, Prototype-Pollution und falsche Typen werden ignoriert', () => {
    S.importSave(b64('{"v":2,"t":1,"state":{"__proto__":{"polluted":1},"constructor":{"prototype":{"p2":1}},"evil":1,"gens":{"__proto__":{"x":1},"hack":5},"research":{"nope":1,"geology":1},"res":[1,2],"stats":"x","settings":[]}}'));
    assert.equal({}.polluted, undefined);
    assert.equal({}.p2, undefined);
    assert.equal(state.evil, undefined);
    assert.equal(state.gens.hack, undefined);
    assert.deepEqual(state.research, { geology: 1 });
    assert.deepEqual(state.res, zeroRes());
  });
  test('Einstellungen: ungueltige Werte -> Defaults', () => {
    S.importSave(wrap({ settings: { format: 'hex', autosave: 'ja', autosaveSec: 7, particles: 0, buyAmount: '5' } }));
    assert.deepEqual(state.settings, { format: 'standard', autosave: true, autosaveSec: 10, particles: true, buyAmount: '1' });
  });
  test('Buffs: unbekannte, abgelaufene, negative gedroppt; Restzeit geklemmt', () => {
    S.importSave(wrap({ buffs: [
      { id: 'frenzy', left: 10 }, { id: 'nope', left: 10 }, { id: 'frenzy', left: -5 },
      { id: 'clickfrenzy', left: 1e9 }, null, 'x', { id: 'frenzy', left: NaN },
    ] }));
    assert.deepEqual(state.buffs.map(b => [b.id, b.left]), [['frenzy', 10], ['clickfrenzy', 60]]);
  });
  test('Buff-Liste wird auf 10 Eintraege begrenzt', () => {
    S.importSave(wrap({ buffs: Array.from({ length: 50 }, () => ({ id: 'frenzy', left: 5 })) }));
    assert.ok(state.buffs.length <= 10);
  });
  test('savedAt und Statistik werden geklemmt', () => {
    S.importSave(b64({ v: 2, t: 1e300, state: { stats: { clicks: -9, totalOre: 'x', playTime: 5 } } }));   // v2-Feldnamen werden migriert
    assert.ok(state.savedAt <= 8.64e15);
    assert.equal(state.stats.clicks, 0);
    assert.equal(state.stats.total.ore, 0);
    assert.equal(state.stats.playTime, 5);
  });
  test('Erfolge: nur bekannte IDs', () => {
    S.importSave(wrap({ achievements: { click_1: 5, fake: 1 } }));
    assert.deepEqual(Object.keys(state.achievements), ['click_1']);
  });
  test('sanitize(non-object) wirft', () => {
    for (const x of [null, 1, 'x', [], undefined]) assert.throws(() => S.sanitize(x), /Format/);
  });
  test('sanitize({}) ergibt Standardzustand (bis auf startedAt)', () => {
    const a = S.sanitize({}), b = defaultState();
    a.stats.startedAt = b.stats.startedAt = 0;
    assert.deepEqual(a, b);
  });
});

describe('Migration alter Saves (eisenwerk-idle-save)', () => {
  const legacy = {
    S: { ore: 5000, steel: 20, titan: 3, click: 4, gens: { mine: 12, drill: 3, smelter: 0, forge: 1 },
      research: { geology: 1, converter: 1 }, boosts: { diamond: 1 } },
    t: 1_700_000_000_000,
  };
  test('Legacy-Key wird geladen und als migriert gemeldet', () => {
    ls.setItem(S.LEGACY_KEY, JSON.stringify(legacy));
    const r = S.load();
    assert.deepEqual(r, { loaded: true, migrated: true });
    assert.equal(state.res.ore, 5000); assert.equal(state.res.steel, 20); assert.equal(state.res.titan, 3);
    assert.equal(state.clicks.click, 4);
    assert.equal(state.gens.mine, 12); assert.equal(state.gens.forge, 1); assert.equal(state.gens.plant, 0);
    assert.deepEqual(state.research, { geology: 1, converter: 1 });
    assert.deepEqual(state.boosts, { diamond: 1 });
    assert.equal(state.savedAt, legacy.t);
    assert.equal(state.prestige.count, 0);
  });
  test('Neuer Key hat Vorrang vor Legacy', () => {
    ls.setItem(S.LEGACY_KEY, JSON.stringify(legacy));
    state.gens.mine = 99; S.save();
    reset();
    const r = S.load();
    assert.deepEqual(r, { loaded: true, migrated: false });
    assert.equal(state.gens.mine, 99);
  });
  test('Legacy-Save mit fehlenden Feldern / Muell wird bereinigt', () => {
    ls.setItem(S.LEGACY_KEY, JSON.stringify({ S: { ore: -1, steel: 'x', gens: null, research: [] }, t: 'heute' }));
    assert.equal(S.load().loaded, true);
    assert.deepEqual(state.res, zeroRes());
    assert.deepEqual(state.research, {});
    assert.ok(state.savedAt > 0, 'Fallback-Zeitstempel statt NaN');
  });
  test('migrate: v2 passt durch, falsche Versionen werfen', () => {
    assert.equal(S.migrate({ v: 2, t: 5, state: {} }).v, 5);
    assert.equal(S.migrate({ v: 3, t: 5, state: {} }).v, 5);
    assert.equal(S.migrate({ v: 4, t: 5, state: {} }).v, 5);
    assert.throws(() => S.migrate({ v: 6, state: {} }), /neueren/);
    assert.throws(() => S.migrate({ state: {} }), /Version/);
    assert.throws(() => S.migrate(null), /Format/);
  });
  test('Altes Format als Export-String importierbar', () => {
    S.importSave(b64(legacy));
    assert.equal(state.gens.mine, 12);
  });
});

describe('save / load', () => {
  test('save() schreibt unter dem v2-Key und load() liest zurueck', () => {
    state.gens.mine = 8; state.res.ore = 77;
    assert.equal(S.save(), true);
    reset();
    assert.deepEqual(S.load(), { loaded: true, migrated: false });
    assert.equal(state.gens.mine, 8); assert.equal(state.res.ore, 77);
  });
  test('load ohne Save', () => {
    assert.deepEqual(S.load(), { loaded: false });
  });
  test('load ohne localStorage', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    assert.deepEqual(S.load(), { loaded: false });
  });
  test('korrupter Save: loaded false + error, Zustand bleibt', () => {
    const restore = quietConsole();
    state.gens.mine = 4;
    ls.setItem(S.SAVE_KEY, '{kaputt');
    assert.deepEqual(S.load(), { loaded: false, error: true, backedUp: true });
    assert.equal(state.gens.mine, 4);
    restore();
  });
  test('save() bei vollem/fehlendem Speicher gibt false zurueck und sendet save-failed', () => {
    const ev = collect('save-failed');
    ls.setItem = () => { throw new Error('Quota'); };
    assert.equal(S.save(), false);
    assert.equal(ev.got.length, 1);
    ev.stop();
  });
  test('resetGame setzt auf Standard und speichert', () => {
    state.gens.mine = 5;
    S.resetGame();
    assert.equal(state.gens.mine, 0);
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).state.gens.mine, 0);
  });
  test('Speichern/Laden-Roundtrip aendert Zustand nicht (Idempotenz ueber 3 Zyklen)', () => {
    state.gens.mine = 3; state.stats.total.ore = 1e20;
    let prev;
    for (let i = 0; i < 3; i++) {
      S.save(); const snap = JSON.stringify({ ...state, savedAt: 0 });
      S.load();
      assert.equal(JSON.stringify({ ...state, savedAt: 0 }), snap);
      if (prev) assert.equal(snap, prev);
      prev = snap;
    }
  });
});

describe('Neuguss-Chronik im Spielstand', () => {
  test('Alter Spielstand ohne history: leere Liste, Zaehler bleibt', () => {
    const s = S.sanitize({ prestige: { points: 2, total: 7, count: 3, shop: {} } });
    assert.deepEqual(s.prestige.history, []);
    assert.equal(s.prestige.count, 3);
    assert.equal(s.stats.fastestPrestige, 0);
  });
  test('sanitize: Whitelist, Klemmen, max. 10, ungueltige Eintraege verworfen', () => {
    const hist = [{ gain: 0, ore: 1, time: 1, at: 1 }, 'x', null, [], { gain: 'a' }];
    for (let i = 1; i <= 14; i++) hist.push({ gain: i, ore: -5, time: 'x', at: 1e30, evil: '<b>' });
    const s = S.sanitize({ prestige: { history: hist } });
    assert.equal(s.prestige.history.length, 10);
    assert.equal(s.prestige.history[0].gain, 5);
    assert.equal(s.prestige.history.at(-1).gain, 14);
    const e = s.prestige.history[0];
    assert.deepEqual(Object.keys(e).sort(), ['at', 'gain', 'ore', 'time']);
    assert.equal(e.ore, 0); assert.equal(e.time, 0); assert.ok(e.at <= 8.64e15);
  });
  test('history ist kein Array: leer', () => {
    assert.deepEqual(S.sanitize({ prestige: { history: { a: 1 } } }).prestige.history, []);
  });
  test('Roundtrip serialize/sanitize erhaelt Historie', () => {
    state.prestige.history = [{ gain: 4, ore: 5e7, time: 90, at: 1700000000000 }];
    const back = S.sanitize(JSON.parse(S.serialize()).state);
    assert.deepEqual(back.prestige.history, state.prestige.history);
  });
});
