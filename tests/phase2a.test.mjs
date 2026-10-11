// Phase 2a: Review-Fixes, datengetriebene Ressourcen/Rezepte/Klick-Upgrades, Save v3, Haertung.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { state, reset, give, collect, installStorage, quietConsole } from './helpers.mjs';
import { replaceState, defaultState, addResource } from '../js/core/state.js';
import * as F from '../js/core/formulas.js';
import * as S from '../js/core/save.js';
import { buy, tick } from '../js/systems/production.js';
import { doPrestige, buyShop } from '../js/systems/prestige.js';
import * as G from '../js/systems/golden.js';
import * as AB from '../js/systems/autobuyers.js';
import * as A from '../js/systems/achievements.js';
import { RES_IDS } from '../js/data/resources.js';
import { GEN_MAP, GENS } from '../js/data/generators.js';
import { CLICKS, CLICK_MAP } from '../js/data/upgrades.js';
import { RECIPES } from '../js/data/recipes.js';
import { RESEARCH } from '../js/data/research.js';
import { ACHIEVEMENT_MAP } from '../js/data/achievements.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b64 = obj => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
let ls;
beforeEach(() => { ls = installStorage(); reset(); G.init(); AB.reset(); A.reset(); });

describe('Review 4: Kaufmenge nur fuer Generatoren', () => {
  test('buy() ohne Menge: Klick-Upgrade kauft trotz "max" nur 1 Stufe, Generator die Einstellung', () => {
    give({ ore: 1e9, steel: 1e9, titan: 1e9 });
    state.settings.buyAmount = 'max';
    assert.equal(buy('click', 'click'), true);
    assert.equal(state.clicks.click, 1);
    assert.equal(buy('gen', 'mine'), true);
    assert.ok(state.gens.mine > 1);
    state.settings.buyAmount = '10';
    assert.equal(buy('click', 'click'), true);
    assert.equal(state.clicks.click, 2);
  });
  test('explizite Menge wird weiter respektiert', () => {
    give({ ore: 1e9, steel: 1e9 });
    assert.equal(buy('click', 'click', 2), true);
    assert.equal(state.clicks.click, 2);
  });
});

describe('Review 6: Hammerwut nur auf manuelle Klicks', () => {
  test('Autoklick und Erzrate bleiben vom Klick-Buff unberuehrt', () => {
    Object.assign(state.research, { geology: 1, autoclick: 1, resonance: 1 });
    state.gens.mine = 10;
    const a = F.rates();
    state.buffs = [{ id: 'clickfrenzy', left: 20 }];
    const b = F.rates();
    assert.equal(b.ore, a.ore);
    assert.ok(Math.abs(b.click - 25 * a.click) < 1e-9 * b.click);
  });
  test('Frenzy (Produktion) wirkt weiter auf alles', () => {
    Object.assign(state.research, { autoclick: 1 });
    state.gens.mine = 10;
    const a = F.rates().ore;
    state.buffs = [{ id: 'frenzy', left: 20 }];
    assert.ok(Math.abs(F.rates().ore - 7 * a) < 1e-9);
  });
});

describe('Review 13: safe(), Tooltip', () => {
  test('safe(-Infinity) und safe(Infinity) sind endlich', () => {
    assert.equal(F.safe(-Infinity), -1e300);
    assert.equal(F.safe(Infinity), 1e300);
    assert.equal(F.safe(NaN), 0);
  });
  test('Erz-Erfolge nennen lesbare Zahlen statt 1·10^3', () => {
    assert.ok(!ACHIEVEMENT_MAP.ore_1000.desc.includes('·'));
    assert.match(ACHIEVEMENT_MAP.ore_1000.desc, /1\.000 Erz/);
    assert.match(ACHIEVEMENT_MAP['ore_' + 1e20].desc, /10\^20/);
  });
  test('Forschungs-/Boost-Erfolge folgen den Daten', () => {
    state.research = Object.fromEntries(RESEARCH.slice(0, -1).map(r => [r.id, 1]));
    assert.equal(ACHIEVEMENT_MAP.res_3.check(state), false);
    state.research = Object.fromEntries(RESEARCH.map(r => [r.id, 1]));
    assert.equal(ACHIEVEMENT_MAP.res_3.check(state), true);
  });
  test('Zeitgeber lassen sich zuruecksetzen (Auto-Buyer, Erfolge, Golden)', () => {
    state.prestige.shop.ab_gens = 1; state.autobuyers.gens = true; give({ ore: 1e6 });
    AB.tick(1.9); AB.reset(); AB.tick(0.2);
    assert.equal(state.gens.mine, 0, 'nach reset kein Takt');
    AB.tick(2);
    assert.ok(state.gens.mine > 0);

    state.stats.total.ore = 1e3;
    A.check(0.4); A.reset(); A.check(0.2);
    assert.equal(state.achievements.ore_1000, undefined);
    A.check(0.4);
    assert.ok(state.achievements.ore_1000);

    G.tick(1000);
    assert.ok(G.getCurrent());
    const ex = collect('golden:expire');
    G.init();
    assert.equal(G.getCurrent(), null);
    assert.equal(ex.got.length, 1, 'UI erfaehrt vom verworfenen Barren');
    ex.stop();
  });
});

describe('Review 10: bulkPlan Max (Binaersuche) == alte Schleife', () => {
  // Referenz: die frueher verwendete lineare Schleife
  function reference(kind, id, amount) {
    const lvl = F.levelOf(kind, id);
    const isMax = amount === 'max';
    const want = isMax ? 1000 : Math.max(1, Number(amount) || 1);
    let total = {}, count = 0;
    for (let i = 0; i < want && lvl + i < 5000; i++) {
      const next = F.addCost(total, F.unitCost(kind, id, lvl + i));
      if (isMax && !F.canAfford(next)) break;
      total = next; count++;
    }
    if (count === 0) return { count: 0, cost: lvl < 5000 ? F.unitCost(kind, id, lvl) : {}, affordable: false };
    return { count, cost: total, affordable: F.canAfford(total) };
  }
  test('identisches Ergebnis fuer viele Level/Vermoegen', () => {
    const wealth = [0, 14, 15, 100, 1e3, 12345, 1e6, 1e9, 1e15, 1e30, 1e80, 1e300];
    for (const [kind, id] of [['gen', 'mine'], ['gen', 'drill'], ['gen', 'forge'], ['gen', 'plant'], ['click', 'click']]) {
      for (const lvl of [0, 1, 9, 10, 11, 25, 99, 300, 1200]) {
        for (const w of wealth) {
          reset();
          if (kind === 'gen') state.gens[id] = lvl; else state.clicks[id] = lvl;
          give({ ore: w, steel: w / 3, titan: w / 7 });
          for (const amount of ['max', '1', '10', '100']) {
            assert.deepEqual(F.bulkPlan(kind, id, amount), reference(kind, id, amount), `${kind}:${id} lvl=${lvl} w=${w} ${amount}`);
          }
        }
      }
    }
  });
  test('Cache erkennt Levelwechsel (Kauf, danach neuer Plan)', () => {
    give({ ore: 1e6 });
    const p1 = F.bulkPlan('gen', 'mine', 'max');
    buy('gen', 'mine', 'max');
    assert.equal(state.gens.mine, p1.count);
    give({ ore: 1e6 });
    assert.deepEqual(F.bulkPlan('gen', 'mine', 'max'), reference('gen', 'mine', 'max'));
  });
  test('genau bezahlbar: Grenzfall', () => {
    const exact = F.bulkPlan('gen', 'mine', '5').cost.ore;
    give({ ore: exact });
    const plan = F.bulkPlan('gen', 'mine', 'max');
    assert.ok(plan.count >= 5 && plan.affordable);
    assert.ok(plan.cost.ore <= exact);
    state.res.ore = exact - 1;
    assert.equal(F.bulkPlan('gen', 'mine', 'max').count, 4);
  });
});

describe('Ressourcen datengetrieben', () => {
  test('rates() hat einen Eintrag je RES_IDS, click und flows', () => {
    const r = F.rates();
    for (const k of RES_IDS) assert.equal(typeof r[k], 'number', k);
    assert.equal(typeof r.click, 'number');
    assert.ok(Array.isArray(r.flows));
  });
  test('addResource fuehrt Gesamt- und Durchlauf-Statistik je Ressource', () => {
    for (const k of RES_IDS) { addResource(k, 5); addResource(k, 2); }
    for (const k of RES_IDS) {
      assert.equal(state.stats.total[k], 7); assert.equal(state.stats.run[k], 7); assert.equal(state.res[k], 7);
    }
  });
  test('Statistik wird auf 1e300 geklemmt', () => {
    state.stats.total.ore = 1e300; state.stats.run.ore = 1e300;
    addResource('ore', 1e300);
    assert.equal(state.stats.total.ore, 1e300);
    assert.equal(state.stats.run.ore, 1e300);
    assert.ok(Number.isFinite(state.stats.total.ore));
  });
  test('Neuguss setzt run je Ressource zurueck, total bleibt', () => {
    for (const k of RES_IDS) addResource(k, 3);
    state.stats.run.ore = 1e8; state.stats.total.ore = 1e8;
    assert.equal(doPrestige(), true);
    for (const k of RES_IDS) { assert.equal(state.stats.run[k], 0); assert.ok(state.stats.total[k] >= 3); }
  });
  test('GENS-Daten: req ist ein Array', () => {
    for (const g of GENS) if (g.req) assert.ok(Array.isArray(g.req), g.id);
  });
});

describe('Generatoren-req: Array und String', () => {
  test('mehrere Voraussetzungen werden alle geprueft', () => {
    const old = GEN_MAP.plant.req;
    try {
      GEN_MAP.plant.req = ['metallurgy', 'titanium'];
      assert.match(F.lockReason('gen', 'plant'), /Metallurgie.*Titan-Extraktion/);
      state.research.metallurgy = 1;
      assert.match(F.lockReason('gen', 'plant'), /Titan-Extraktion/);
      assert.ok(!F.lockReason('gen', 'plant').includes('Metallurgie'));
      state.research.titanium = 1;
      assert.equal(F.lockReason('gen', 'plant'), null);
      GEN_MAP.plant.req = 'metallurgy';   // String bleibt gueltig
      delete state.research.metallurgy;
      assert.match(F.lockReason('gen', 'plant'), /Metallurgie/);
      state.research.metallurgy = 1;
      assert.equal(F.lockReason('gen', 'plant'), null);
    } finally { GEN_MAP.plant.req = old; }
  });
});

describe('Rezepte (Konverter)', () => {
  test('Standard-Rezept entspricht dem bisherigen Konverter', () => {
    state.gens.mine = 9; state.research.converter = 1;
    const r = F.rates();
    assert.equal(r.flows.length, 1);
    const f = r.flows[0];
    assert.equal(f.id, 'converter');
    assert.ok(Math.abs(f.inputs.ore - 9 * 0.2) < 1e-12);
    assert.ok(Math.abs(f.outputs.steel - 9 * 0.2 / 25) < 1e-12);
    assert.ok(Math.abs(r.ore - 9 * 0.8) < 1e-12);
  });
  test('ohne Forschung kein Fluss', () => {
    state.gens.mine = 9;
    assert.deepEqual(F.rates().flows, []);
  });
  test('Rezept mit mehreren Eingaengen: der knappere begrenzt', () => {
    const rc = { id: 't', req: [], share: 0.5, inputs: { ore: 2, steel: 1 }, outputs: { titan: 1 } };
    RECIPES.push(rc);
    try {
      state.gens.mine = 10; state.gens.smelter = 4;   // 20 Erz/s, 1 Stahl/s
      const r = F.rates();
      const f = r.flows.find(x => x.id === 't');
      assert.ok(Math.abs(f.cycles - 0.5) < 1e-12);   // min(5, 0.5)
      assert.ok(Math.abs(r.ore - (20 - 1)) < 1e-12);
      assert.ok(Math.abs(r.steel - (1 - 0.5)) < 1e-12);
      assert.ok(Math.abs(r.titan - 0.5) < 1e-12);
    } finally { RECIPES.pop(); }
  });
  test('Ketten: spaetere Rezepte sehen die Ausgaenge frueherer', () => {
    RECIPES.push(
      { id: 'c1', req: [], share: 1, inputs: { ore: 1 }, outputs: { steel: 1 } },
      { id: 'c2', req: [], share: 1, inputs: { steel: 1 }, outputs: { titan: 1 } });
    try {
      state.gens.mine = 10;
      const r = F.rates();
      assert.ok(Math.abs(r.ore) < 1e-12 && Math.abs(r.steel) < 1e-12);
      assert.ok(Math.abs(r.titan - 20) < 1e-12);
    } finally { RECIPES.pop(); RECIPES.pop(); }
  });
  test('Tick schreibt Rezept-Ertrag in die Statistik', () => {
    state.gens.mine = 10; state.research.converter = 1;
    tick(10);
    assert.ok(Math.abs(state.res.steel - 20 * 0.2 / 25 * 10) < 1e-9);
    assert.ok(state.stats.total.steel > 0);
  });
});

describe('Klick-Upgrades als Liste', () => {
  test('zweites Upgrade: Zustand, Kauf, Summe, Save-Roundtrip', () => {
    const def = { id: 'click2', icon: 'x', name: 'Test', base: 0, perLevel: 5, oreBase: 10, oreGrowth: 1.1, steelFrom: 99, steelBase: 1, steelGrowth: 1, eliteFrom: 99, eliteBase: 1 };
    CLICKS.push(def); CLICK_MAP.click2 = def;
    try {
      replaceState(defaultState());
      assert.equal(state.clicks.click2, 0);
      assert.equal(F.rates().click, 1);
      give({ ore: 1e6 });
      assert.equal(buy('click', 'click2'), true);
      assert.equal(state.clicks.click2, 1);
      assert.equal(F.rates().click, 1 + 5);
      assert.equal(F.levelOf('click', 'click2'), 1);
      const code = S.exportSave();
      reset();
      S.importSave(code);
      assert.equal(state.clicks.click2, 1);
      state.stats.run.ore = 1e8;
      doPrestige();
      assert.deepEqual(state.clicks, { click: 0, click2: 0 });
    } finally { CLICKS.pop(); delete CLICK_MAP.click2; replaceState(defaultState()); }
  });
  test('unbekannte Klick-ID kauft nichts', () => {
    give({ ore: 1e9 });
    assert.equal(buy('click', 'gibtsnicht'), false);
  });
});

describe('Save v3 / Migration', () => {
  test('SAVE_VERSION ist 3, serialize schreibt v:3', () => {
    assert.equal(S.SAVE_VERSION, 3);
    assert.equal(JSON.parse(S.serialize()).v, 3);
  });
  const v2 = {
    v: 2, t: 1_700_000_000_000,
    state: {
      res: { ore: 500, steel: 20, titan: 3 }, gens: { mine: 12 }, click: 5,
      research: { geology: 1 }, boosts: { diamond: 1 },
      prestige: { points: 2, total: 6, count: 1, shop: { pp_eff: 1 } },
      stats: { clicks: 7, runClicks: 3, totalOre: 1e6, totalSteel: 200, totalTitan: 30, runOre: 5e5, runTime: 9, playTime: 99, golden: 2, buys: 8, bestOreRate: 12, bestPrestige: 2, startedAt: 1_600_000_000_000 },
      settings: { format: 'scientific', autosave: false, autosaveSec: 30, particles: false, buyAmount: '10' },
    },
  };
  test('v2-Spielstand laedt verlustfrei', () => {
    ls.setItem(S.SAVE_KEY, JSON.stringify(v2));
    assert.deepEqual(S.load(), { loaded: true, migrated: false });
    assert.equal(state.clicks.click, 5);
    assert.deepEqual(state.stats.total, { ore: 1e6, steel: 200, titan: 30 });
    assert.deepEqual(state.stats.run, { ore: 5e5, steel: 0, titan: 0 });
    assert.equal(state.stats.clicks, 7); assert.equal(state.stats.runClicks, 3);
    assert.equal(state.stats.playTime, 99); assert.equal(state.stats.golden, 2);
    assert.equal(state.stats.startedAt, 1_600_000_000_000);
    assert.equal(state.stats.bestOreRate, 12);
    assert.equal(state.res.ore, 500); assert.equal(state.gens.mine, 12);
    assert.deepEqual(state.prestige, { points: 2, total: 6, count: 1, shop: { pp_eff: 1 } });
    assert.equal(state.settings.format, 'scientific'); assert.equal(state.settings.buyAmount, '10');
    assert.equal(state.settings.autosave, false);
    // nach dem Speichern liegt v3 vor und laedt gleich
    S.save();
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).v, 3);
    const snap = JSON.stringify({ ...state, savedAt: 0 });
    S.load();
    assert.equal(JSON.stringify({ ...state, savedAt: 0 }), snap);
  });
  test('migrateV2toV3 veraendert die Eingabe nicht', () => {
    const copy = JSON.stringify(v2.state);
    const out = S.migrateV2toV3(v2.state);
    assert.equal(JSON.stringify(v2.state), copy);
    assert.equal(out.click, undefined);
    assert.deepEqual(out.clicks, { click: 5 });
    assert.equal(out.stats.totalOre, undefined);
    assert.equal(out.stats.total.ore, 1e6);
  });
  test('v2 ohne stats/click migriert ohne Fehler', () => {
    assert.equal(S.migrate({ v: 2, t: 5, state: {} }).v, 3);
    ls.setItem(S.SAVE_KEY, JSON.stringify({ v: 2, t: 5, state: { gens: { mine: 2 } } }));
    assert.equal(S.load().loaded, true);
    assert.equal(state.gens.mine, 2);
    assert.equal(state.clicks.click, 0);
  });
  test('Import ueber 200000 Zeichen wird abgelehnt', () => {
    assert.throws(() => S.importSave('A'.repeat(200_001)), /zu groß/);
  });
});

describe('Review 1: Ladefehler sichern den Spielstand', () => {
  test('korrupter Save: Backup, Speichern gesperrt, Rohdaten bleiben', () => {
    const restore = quietConsole();
    ls.setItem(S.SAVE_KEY, '{kaputt');
    const r = S.load();
    restore();
    assert.deepEqual(r, { loaded: false, error: true, backedUp: true });
    assert.equal(ls.getItem(S.BACKUP_KEY), '{kaputt');
    assert.equal(S.isSaveLocked(), true);
    state.gens.mine = 5;
    const failed = collect('save-failed');
    assert.equal(S.save(), false);
    assert.equal(S.autoSave(), false);
    assert.equal(failed.got.length >= 1, true);
    failed.stop();
    assert.equal(ls.getItem(S.SAVE_KEY), '{kaputt', 'Original bleibt unangetastet');
  });
  test('Spielstand aus neuerer Version wird ebenfalls gesichert', () => {
    const restore = quietConsole();
    const raw = JSON.stringify({ v: 99, t: 1, state: {} });
    ls.setItem(S.SAVE_KEY, raw);
    assert.equal(S.load().error, true);
    restore();
    assert.equal(ls.getItem(S.BACKUP_KEY), raw);
    assert.equal(S.save(), false);
  });
  test('Import und Reset heben die Sperre auf; erfolgreiches load() auch', () => {
    const restore = quietConsole();
    ls.setItem(S.SAVE_KEY, 'x'); S.load(); restore();
    assert.equal(S.isSaveLocked(), true);
    S.importSave(b64({ v: 3, t: 5, state: { gens: { mine: 4 } } }));
    assert.equal(S.isSaveLocked(), false);
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).state.gens.mine, 4);

    const r2 = quietConsole();
    ls.setItem(S.SAVE_KEY, 'x'); S.load(); r2();
    assert.equal(S.isSaveLocked(), true);
    S.resetGame();
    assert.equal(S.isSaveLocked(), false);
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).state.gens.mine, 0);

    ls.setItem(S.SAVE_KEY, S.serialize());
    assert.equal(S.load().loaded, true);
    assert.equal(S.isSaveLocked(), false);
  });
});

describe('Review 3: Hintergrund-Tab behaelt Buffs', () => {
  test('Laufzeitpfad kuerzt Buff-Restzeit statt sie zu loeschen', () => {
    state.gens.mine = 10; state.buffs = [{ id: 'frenzy', left: 100 }, { id: 'clickfrenzy', left: 20 }];
    const ev = collect('buffs');
    const r = S.applyOffline(30, { runtime: true });
    assert.equal(state.res.ore, 20 * 30, 'Ertrag ohne Buff');
    assert.equal(r.seconds, 30);
    assert.deepEqual(state.buffs.map(b => [b.id, b.left]), [['frenzy', 70]]);
    assert.equal(ev.got.length, 1, 'abgelaufener Buff meldet buffs');
    ev.stop();
  });
  test('Laden (ohne runtime) verwirft Buffs weiterhin', () => {
    state.gens.mine = 10; state.buffs = [{ id: 'frenzy', left: 100 }];
    S.applyOffline(30);
    assert.deepEqual(state.buffs, []);
  });
});

describe('Review 9/11: Speichern nach Neuguss/Shop, Autosave-Schalter', () => {
  test('Neuguss und Shop-Kauf speichern bei aktivem Autosave', () => {
    state.stats.run.ore = 1e8;
    assert.equal(doPrestige(), true);
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).state.prestige.count, 1);
    state.prestige.points = 100;
    assert.equal(buyShop('click'), true);
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).state.prestige.shop.click, 1);
  });
  test('bei ausgeschaltetem Autosave wird nichts geschrieben', () => {
    state.settings.autosave = false;
    state.stats.run.ore = 1e8;
    doPrestige();
    state.prestige.points = 100; buyShop('click');
    assert.equal(S.autoSave(), false);
    assert.equal(ls.getItem(S.SAVE_KEY), null);
  });
  test('autoSave() speichert bei aktivem Autosave', () => {
    assert.equal(S.autoSave(), true);
    assert.ok(ls.getItem(S.SAVE_KEY));
  });
});

describe('Haertung (statische Pruefungen)', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  test('CSP-Meta mit strengen Direktiven', () => {
    const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    assert.ok(m, 'CSP-Meta fehlt');
    for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
      assert.ok(m[1].includes(d), d);
    }
    assert.ok(!/unsafe-inline|unsafe-eval/.test(m[1]));
  });
  test('keine Inline-Skripte oder Inline-Styles in index.html', () => {
    for (const tag of html.match(/<script\b[^>]*>/g)) assert.match(tag, /\bsrc="/, tag);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html));
    assert.ok(!/\sstyle=/.test(html));
    assert.ok(!/<style\b/.test(html));
    assert.ok(existsSync(path.join(root, 'js', 'boot-check.js')));
  });
  test('legacy/ ist entfernt, README erwaehnt es nicht mehr', () => {
    assert.equal(existsSync(path.join(root, 'legacy')), false);
    assert.ok(!/legacy/i.test(readFileSync(path.join(root, 'README.md'), 'utf8')));
  });
  test('UI setzt style nie per setAttribute/innerHTML (CSP)', () => {
    const dir = path.join(root, 'js', 'ui');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      assert.ok(!/setAttribute\(\s*['"]style/.test(src), f);
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(src.replace(/\/\/.*$/gm, '')), f);
    }
  });
  test('alle JS-Dateien (auch UI) sind syntaktisch gueltig', () => {
    const files = [];
    const walk = d => { for (const e of readdirSync(d)) { const p = path.join(d, e); statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } };
    walk(path.join(root, 'js'));
    assert.ok(files.length > 20);
    for (const f of files) execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  });
});
