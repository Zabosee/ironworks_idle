// Ergänzungen zu corp.test.mjs / progression-graph.test.mjs (Schritt 7): feindliche Saves, Shop-Kostenfolge, unveränderter Zustand
// bei abgelehnter Gründung, Roundtrip nach Gründung, Graph-Invarianten (Zyklen, IDs, Tore von Generatoren/Rezepten). Werte kommen aus den Datenmodulen.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage } from './helpers.mjs';
import * as F from '../js/core/formulas.js';
import * as S from '../js/core/save.js';
import * as C from '../js/systems/corp.js';
import { CORP, CORP_SHOP, CORP_HISTORY_MAX } from '../js/data/corp.js';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { GENS } from '../js/data/generators.js';
import { RECIPES } from '../js/data/recipes.js';
import { RES, RES_IDS } from '../js/data/resources.js';
import { ERAS } from '../js/data/eras.js';

installStorage();
beforeEach(() => reset());
const snap = () => JSON.stringify(state);
const levelCost = (it, l) => (it.costs ? it.costs[l] : Math.ceil(it.cost * it.growth ** l));
const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

describe('Save v6: feindliche Werte', () => {
  test('Infinity/1e400, Strings und Objekte in corp und autoCast werden geklemmt oder auf Defaults gesetzt', () => {
    const s = S.sanitize(JSON.parse('{"corp":{"points":1e400,"total":"9","count":[1],"shop":{"c_eff":"3","c_gain":null,"c_cast":{}},"history":{"0":{"gain":5}}},"autoCast":{"on":1,"mode":["time"],"value":1e400,"minRun":1e400}}'));
    assert.ok(Number.isFinite(s.corp.points)); assert.equal(s.corp.total, 0); assert.equal(s.corp.count, 0);
    assert.ok(s.corp.shop.c_gain === undefined && s.corp.shop.c_cast === undefined);
    assert.deepEqual(s.corp.history, []);
    assert.equal(s.autoCast.on, false); assert.ok(!('mode' in s.autoCast)); assert.ok(s.autoCast.minRun <= 1e7);
    assert.ok(Number.isFinite(s.autoCast.value) && s.autoCast.value <= 1e12);
  });
  test('Prototype-Pollution-Schlüssel im Konzern-Shop erzeugen keine Einträge und verändern Object.prototype nicht', () => {
    const s = S.sanitize(JSON.parse('{"corp":{"shop":{"__proto__":{"c_eff":9},"constructor":3,"toString":1}}}'));
    assert.deepEqual(s.corp.shop, {});
    assert.equal({}.c_eff, undefined);
  });
  test('Chronik-Einträge: Gewinn < 1 und Nicht-Objekte fliegen raus, negative Werte werden 0', () => {
    const s = S.sanitize({ corp: { history: [{ gain: 0.5 }, { gain: -3 }, 7, { gain: 4, gussformen: -1, time: -50, at: -1 }] } });
    assert.deepEqual(s.corp.history, [{ gain: 4, gussformen: 0, time: 0, at: 0 }]);
  });
  test('corpRunTime: negativ/NaN/String/null -> 0', () => {
    for (const bad of [-5, NaN, 'x', null]) assert.equal(S.sanitize({ stats: { corpRunTime: bad } }).stats.corpRunTime, 0);
  });
  test('Import mit feindlichem corp lässt das Spiel spielbar: Shop-Kauf und Gründungsprüfung werfen nicht', () => {
    S.importSave(b64({ v: 6, t: 1, state: { corp: { points: -1, total: 'a', shop: { nope: 5 } }, autoCast: 7 } }));
    assert.equal(state.corp.points, 0);
    assert.equal(C.buyCorpShop(CORP_SHOP[0].id), false);
    assert.equal(C.canCorp(), false);
  });
});

describe('Save v6: Zustand nach Gründung', () => {
  test('Roundtrip nach doCorp ist verlustfrei, auch über mehrere Zyklen (Idempotenz)', () => {
    state.prestige = { points: 3, total: CORP.divisor * 4, count: CORP.unlockCount, shop: { pp_eff: 1 }, history: [] };
    state.stats.corpRunTime = 100 * 3600;
    state.research.c_cobalt = 1;
    state.corp.shop.c_autocast = 1; state.autoCast = { on: true, value: 7, minRun: 120 };
    assert.ok(C.doCorp());
    const dump = () => { const o = JSON.parse(S.serialize()).state; delete o.savedAt; return JSON.stringify(o); };
    const before = dump();
    for (let i = 0; i < 3; i++) S.importSave(S.exportSave());
    assert.equal(dump(), before);
    assert.equal(state.corp.count, 1); assert.equal(state.corp.history.length, 1);
    assert.deepEqual(state.autoCast, { on: true, value: 7, minRun: 120 });
  });
  test('Migrierter v5-Stand ist sofort gründungsfähig, wenn die Schwelle erreicht ist', () => {
    const old = { prestige: { points: 0, total: CORP.divisor * 2, count: CORP.unlockCount, shop: {}, history: [] } };
    S.importSave(b64({ v: 5, t: 1, state: old }));
    assert.equal(C.canCorp(), false, 'corpRunTime startet bei 0: der Zeitdeckel greift erst nach Spielzeit');
    state.stats.corpRunTime = 100 * 3600;
    assert.equal(C.canCorp(), true);
    assert.ok(C.doCorp()); assert.equal(state.corp.points, 1);
  });
});

describe('Konzern-Reset: Randfälle', () => {
  test('abgelehnte Gründung (unter Schwelle Neugüsse oder Gussformen) ändert den Zustand nicht', () => {
    state.prestige.count = CORP.unlockCount - 1; state.prestige.total = CORP.divisor * 10; state.gens.mine = 5; state.research.geology = 1;
    let s0 = snap(); assert.equal(C.doCorp(), false); assert.equal(snap(), s0);
    state.prestige.count = CORP.unlockCount; state.prestige.total = CORP.divisor - 1;
    s0 = snap(); assert.equal(C.doCorp(), false); assert.equal(snap(), s0);
  });
  test('Gründung gibt genau corpGain() Patente; zweite Gründung sofort danach ist abgelehnt (Gussformen 0)', () => {
    state.prestige.count = CORP.unlockCount; state.prestige.total = CORP.divisor * 10.2; state.stats.corpRunTime = 100 * 3600;
    const g = F.corpGain(); assert.equal(g, 3);
    assert.ok(C.doCorp()); assert.equal(state.corp.points, g);
    assert.equal(C.doCorp(), false); assert.equal(state.corp.count, 1);
  });
  test('Chronik der Gründung ist auf CORP_HISTORY_MAX begrenzt', () => {
    for (let i = 0; i < CORP_HISTORY_MAX + 3; i++) { state.prestige.count = CORP.unlockCount; state.prestige.total = CORP.divisor * 2; state.stats.corpRunTime = 100 * 3600; assert.ok(C.doCorp()); }
    assert.equal(state.corp.history.length, CORP_HISTORY_MAX);
  });
  test('Auto-Neuguss-Einstellung und Kauf überleben die Gründung; danach nicht sofort fällig', () => {
    state.corp.shop.c_autocast = 1; state.autoCast = { on: true, value: 1, minRun: 0 };
    state.prestige.count = CORP.unlockCount; state.prestige.total = CORP.divisor * 2; state.stats.corpRunTime = 100 * 3600;
    assert.ok(C.doCorp());
    assert.equal(F.corpLevel('c_autocast'), 1); assert.deepEqual(state.autoCast, { on: true, value: 1, minRun: 0 });
    assert.equal(C.autoCastDue(), false);
  });
});

describe('Konzern-Shop: Kostenfolge', () => {
  for (const it of CORP_SHOP) {
    test(`${it.id}: jede Stufe kostet laut Daten, nach max Stufen ist Schluss, kein Abzug bei Fehlkauf`, () => {
      state.corp.points = 1e9;
      for (let l = 0; l < it.max; l++) {
        const exp = levelCost(it, l), p0 = state.corp.points;
        assert.equal(F.corpCost(it.id), exp, `Stufe ${l + 1}`);
        assert.ok(C.buyCorpShop(it.id)); assert.equal(p0 - state.corp.points, exp); assert.equal(F.corpLevel(it.id), l + 1);
      }
      const p = state.corp.points;
      assert.equal(C.buyCorpShop(it.id), false); assert.equal(state.corp.points, p); assert.equal(F.corpLevel(it.id), it.max);
    });
    test(`${it.id}: ein Patent zu wenig kauft nichts`, () => {
      state.corp.points = levelCost(it, 0) - 1;
      assert.equal(C.buyCorpShop(it.id), false); assert.equal(F.corpLevel(it.id), 0); assert.equal(state.corp.points, levelCost(it, 0) - 1);
    });
  }
  test('Kosten sind ganzzahlig positiv und fallen mit der Stufe nie', () => {
    for (const it of CORP_SHOP) for (let l = 0; l < it.max; l++) {
      const c = levelCost(it, l); assert.ok(Number.isInteger(c) && c > 0, it.id);
      if (l) assert.ok(c >= levelCost(it, l - 1), it.id + ' fällt');
    }
  });
});

describe('Fortschrittsgraph: Ergänzungen', () => {
  const reqOf = d => (Array.isArray(d.req) ? d.req : d.req ? [d.req] : []);
  const rmap = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
  test('IDs sind je Kategorie eindeutig', () => {
    for (const list of [RESEARCH, BOOSTS, CLICKS, GENS, RECIPES, CORP_SHOP]) assert.equal(new Set(list.map(d => d.id)).size, list.length);
  });
  test('Forschungs-Voraussetzungen sind zyklenfrei (DFS)', () => {
    const mark = {};
    const visit = id => {
      if (mark[id] === 2) return;
      assert.notEqual(mark[id], 1, 'Zyklus bei ' + id);
      mark[id] = 1; for (const q of reqOf(rmap[id])) visit(q); mark[id] = 2;
    };
    RESEARCH.forEach(r => visit(r.id));
  });
  test('Kosten, Rezept-Ein-/Ausgaben und Generator-Ressourcen verweisen nur auf bekannte Ressourcen', () => {
    const ok = k => RES_IDS.includes(k);
    for (const r of RESEARCH) for (const k in r.cost) assert.ok(ok(k), `${r.id}.${k}`);
    for (const g of GENS) { assert.ok(ok(g.res), g.id); for (const k in g.cost) assert.ok(ok(k), `${g.id}.${k}`); }
    for (const rc of RECIPES) for (const k of [...Object.keys(rc.inputs), ...Object.keys(rc.outputs)]) assert.ok(ok(k), `${rc.id}.${k}`);
    for (const d of [...BOOSTS, ...CLICKS]) for (const c of d.costs || []) assert.ok(ok(c.res), d.id);
  });
  test('Zeitalter-Tor und Konzernstufe von Boosts und Klick-Upgrades liegen nicht unter denen ihrer Voraussetzung', () => {
    for (const d of [...BOOSTS, ...CLICKS]) for (const q of reqOf(d)) {   // Generatoren/Rezepte haben kein eigenes Tor, es kommt über die Forschung
      assert.ok((d.era ?? 0) >= (rmap[q].era ?? 0), `${d.id}: Zeitalter < ${q}`);
      if (d.corp !== undefined) assert.ok(d.corp >= (rmap[q].corp ?? 0), `${d.id}: Konzernstufe < ${q}`);
    }
  });
  test('Zeitalter-Tore liegen im gültigen Bereich', () => {
    for (const d of [...RESEARCH, ...GENS, ...RECIPES, ...BOOSTS, ...CLICKS, ...Object.values(RES)]) {
      if (d.era !== undefined) assert.ok(Number.isInteger(d.era) && d.era >= 0 && d.era < ERAS.length, d.id);
    }
  });
});
