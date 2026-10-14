// Phase 2b: Timer-Warteschlangen, Eisenhuetten-Kette, Generator-Evolution, Save v4, Balance-Sanity.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, give, collect, installStorage, finishAll, zeroRes } from './helpers.mjs';
import { replaceState, defaultState } from '../js/core/state.js';
import * as F from '../js/core/formulas.js';
import * as S from '../js/core/save.js';
import * as T from '../js/systems/timers.js';
import * as AB from '../js/systems/autobuyers.js';
import * as G from '../js/systems/golden.js';
import * as A from '../js/systems/achievements.js';
import { buy, tick } from '../js/systems/production.js';
import { doPrestige } from '../js/systems/prestige.js';
import { RES, RES_IDS } from '../js/data/resources.js';
import { GENS, GEN_MAP, genTier, tierName, tierPips, TIER_AT, TIER_NAMES } from '../js/data/generators.js';
import { RESEARCH, RESEARCH_MAP } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { RECIPES } from '../js/data/recipes.js';
import { SHOP_MAP } from '../js/data/prestige.js';
import { QUEUES } from '../js/data/timers.js';
import { ACHIEVEMENTS } from '../js/data/achievements.js';
import { fmtClock } from '../js/core/format.js';

const b64 = obj => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
let ls;
beforeEach(() => { ls = installStorage(); reset(); G.init(); AB.reset(); A.reset(); });
const rich = () => { state.prestige.count = Math.max(state.prestige.count || 0, 1); state.stats.total.ore = 1e45; state.stats.playTime = 1e7; give({ ore: 1e45, steel: 1e45, titan: 1e45, coal: 1e45, coke: 1e45, copper: 1e45, manganese: 1e45, chrome: 1e45, nickel: 1e45, alloy: 1e45, tungsten: 1e45, gold: 1e45 }); };   // total.ore: alle Zeitalter erreicht

describe('Timer: Kauf, Reihenfolge, Abbruch', () => {
  test('Kosten sofort abgezogen, Effekt erst nach Ablauf, Event timer:done', () => {
    give({ ore: 1000 });
    const done = collect('timer:done'), queued = collect('timer:queued');
    assert.equal(buy('research', 'geology'), true);
    assert.equal(state.res.ore, 700);
    assert.equal(state.research.geology, undefined);
    assert.equal(T.isPending('research', 'geology'), true);
    assert.deepEqual(queued.got, [{ queue: 'lab', kind: 'research', id: 'geology' }]);
    tick(4.9);
    assert.equal(state.research.geology, undefined);
    tick(0.2);
    assert.equal(state.research.geology, 1);
    assert.equal(T.isPending('research', 'geology'), false);
    assert.deepEqual(done.got, [{ queue: 'lab', kind: 'research', id: 'geology' }]);
    assert.equal(state.stats.timersDone, 1);
    done.stop(); queued.stop();
  });

  test('queueState: Form, Fortschritt, Wartende zeigen volle Dauer', () => {
    rich();
    state.research.geology = 1;
    buy('research', 'converter'); buy('research', 'deepmines');
    tick(4);
    const q = T.queueState('lab');
    assert.equal(q.length, 2);
    assert.deepEqual(Object.keys(q[0]).sort(), ['id', 'index', 'kind', 'left', 'name', 'progress', 'running', 'total']);
    assert.equal(q[0].id, 'converter'); assert.equal(q[0].running, true);
    assert.equal(q[0].total, 10); assert.ok(Math.abs(q[0].left - 6) < 1e-9); assert.ok(Math.abs(q[0].progress - 0.4) < 1e-9);
    assert.equal(q[1].running, false); assert.equal(q[1].left, 15); assert.equal(q[1].progress, 0);
    assert.equal(q[0].name, RESEARCH_MAP.converter.name);
  });

  test('ein Slot: Auftraege laufen nacheinander, Nachruecker startet mit voller Zeit', () => {
    rich();
    state.research.geology = 1;
    const done = collect('timer:done');
    buy('research', 'converter'); buy('research', 'deepmines'); buy('research', 'resonance');
    tick(10);                                   // converter fertig, deepmines startet erst jetzt
    assert.deepEqual(done.got.map(e => e.id), ['converter']);
    assert.equal(T.queueState('lab')[0].id, 'deepmines');
    assert.equal(T.queueState('lab')[0].left, 15);
    tick(15);
    assert.deepEqual(done.got.map(e => e.id), ['converter', 'deepmines']);
    tick(8);
    assert.deepEqual(done.got.map(e => e.id), ['converter', 'deepmines', 'resonance']);
    assert.deepEqual(T.queueState('lab'), []);
    done.stop();
  });

  test('ein einziger grosser Tick arbeitet alle Auftraege der Reihe nach ab', () => {
    rich();
    state.research.geology = 1;
    buy('research', 'converter'); buy('research', 'deepmines'); buy('research', 'resonance');
    T.tick(10 + 15 + 8);
    assert.ok(state.research.converter && state.research.deepmines && state.research.resonance);
  });

  test('Warteschlange: 1 aktiv + 3 wartend, der fuenfte Kauf wird abgelehnt und kostet nichts', () => {
    rich();
    state.research.geology = 1;
    for (const id of ['converter', 'deepmines', 'resonance']) assert.equal(buy('research', id), true);
    // Labor: ein weiterer unabhaengiger Auftrag passt noch (Kapazitaet 4), danach ist voll
    state.research.converter = 1;   // schaltet metallurgy frei, ohne den Timer zu beruehren
    assert.equal(buy('research', 'metallurgy'), true);
    assert.equal(T.queueState('lab').length, 4);
    state.research.deepmines = 1;
    const before = state.res.ore;
    assert.match(F.lockReason('research', 'coalmining') ?? '', /voll/);
    assert.equal(buy('research', 'coalmining'), false);
    assert.equal(state.res.ore, before);
  });

  test('Abbruch: wartend 100 %, laufend 50 % Erstattung, Nachruecker startet', () => {
    give({ ore: 1e6, steel: 1e6 });
    state.research.geology = 1;
    buy('research', 'converter'); buy('research', 'deepmines');   // 3000+40 / 6000+60
    const after = { ...state.res };
    const cancelEv = collect('timer:cancel');
    const rWait = T.cancel('lab', 1);
    assert.deepEqual(rWait, { ore: 6000, steel: 60 });
    assert.equal(state.res.ore, after.ore + 6000);
    const rRun = T.cancel('lab', 0);
    assert.deepEqual(rRun, { ore: 1500, steel: 20 });
    assert.equal(state.res.ore, after.ore + 6000 + 1500);
    assert.deepEqual(T.queueState('lab'), []);
    assert.equal(state.research.converter, undefined);
    assert.equal(cancelEv.got.length, 2);
    assert.equal(cancelEv.got[0].running, false); assert.equal(cancelEv.got[1].running, true);
    cancelEv.stop();
    // Abgebrochenes ist wieder kaufbar
    assert.equal(buy('research', 'converter'), true);
  });

  test('cancel ungueltig: unbekannte Queue / Index -> null, nichts passiert', () => {
    assert.equal(T.cancel('lab', 0), null);
    assert.equal(T.cancel('nope', 0), null);
    assert.equal(T.cancel('lab', -1), null);
    assert.equal(T.cancel('lab', 1.5), null);
  });

  test('Abbruch nach Teilfortschritt: laufend weiterhin nur 50 % der Kosten', () => {
    give({ ore: 1000 });
    buy('research', 'geology');
    tick(4);
    T.cancel('lab', 0);
    assert.equal(state.res.ore, 700 + 150);
  });

  test('kein Doppelkauf: gleicher Eintrag und Klick-Upgrade laufen nur einmal', () => {
    rich();
    assert.equal(buy('boost', 'diamond'), true);
    assert.equal(buy('boost', 'diamond'), false);
    assert.equal(F.lockReason('boost', 'diamond'), 'Läuft');
    assert.equal(buy('click', 'click'), true);
    assert.equal(buy('click', 'click'), false);
    assert.equal(state.clicks.click, 0);
    // Werkbank: diamond laeuft, click wartet -> Text "In Warteschlange"
    assert.equal(F.lockReason('click', 'click'), 'In Warteschlange');
    assert.equal(F.bulkPlan('click', 'click', 1).count, 0);
  });

  test('Werkbank (Boosts + Klick) und Labor sind getrennte Warteschlangen und laufen parallel', () => {
    rich();
    buy('research', 'geology'); buy('boost', 'diamond');
    assert.equal(T.queueState('lab').length, 1);
    assert.equal(T.queueState('workshop').length, 1);
    assert.equal(T.queueState('lab')[0].running && T.queueState('workshop')[0].running, true);
    tick(15);
    assert.ok(state.research.geology && state.boosts.diamond);
  });

  test('Klick-Upgrade: Stufe steigt erst nach Timer, Dauer waechst mit der Stufe', () => {
    give({ ore: 1e6, steel: 1e6, titan: 1e6 });
    const d0 = F.duration('click', 'click');
    buy('click', 'click');
    assert.equal(state.clicks.click, 0);
    finishAll();
    assert.equal(state.clicks.click, 1);
    assert.ok(F.duration('click', 'click') > d0);
    assert.equal(F.rates().click, F.clickBaseTotal());
  });

  test('Generatoren bleiben sofort', () => {
    give({ ore: 100 });
    assert.equal(buy('gen', 'mine', 1), true);
    assert.equal(state.gens.mine, 1);
    assert.deepEqual(T.queueState('workshop'), []);
  });

  test('Zu wenig Material: kein Auftrag', () => {
    give({ ore: 299 });
    assert.equal(buy('research', 'geology'), false);
    assert.deepEqual(T.queueState('lab'), []);
    assert.equal(state.res.ore, 299);
  });

  test('Zeit-Kurzformen: fmtClock', () => {
    assert.equal(fmtClock(0), '0:00');
    assert.equal(fmtClock(4.2), '0:05');
    assert.equal(fmtClock(65), '1:05');
    assert.equal(fmtClock(3725), '1:02:05');
    assert.equal(fmtClock(-3), '0:00');
    assert.equal(fmtClock(NaN), '0:00');
  });
});

describe('Timer: Slots und Zeitverkuerzung', () => {
  test('Hochofen-Shop: Zusatz-Laborplatz laesst zwei Forschungen parallel laufen', () => {
    rich();
    state.research.geology = 1;
    state.prestige.shop.q_lab = 1;
    assert.equal(F.queueSlots('lab'), 2);
    assert.equal(F.queueCapacity('lab'), 5);
    buy('research', 'converter'); buy('research', 'deepmines');
    assert.deepEqual(T.queueState('lab').map(e => e.running), [true, true]);
    tick(10);
    assert.ok(state.research.converter); assert.equal(state.research.deepmines, undefined);
    tick(5);
    assert.ok(state.research.deepmines);
  });

  test('Zusatz-Werkbank, Zeitraffer (8 %/Stufe) und Laborautomatisierung (-25 %) verkuerzen Dauern', () => {
    assert.equal(F.duration('boost', 'diamond'), 15);
    state.prestige.shop.q_speed = 2;
    assert.ok(Math.abs(F.duration('boost', 'diamond') - 15 * 0.92 ** 2) < 1e-9);
    state.research.automation = 1;
    assert.ok(Math.abs(F.duration('boost', 'diamond') - 15 * 0.92 ** 2 * 0.75) < 1e-9);
    assert.ok(F.duration('research', 'geology') >= 1, 'Mindestdauer');
    state.prestige.shop.q_work = 3;
    assert.equal(F.queueSlots('workshop'), 4);
    assert.ok(SHOP_MAP.q_lab && SHOP_MAP.q_work && SHOP_MAP.q_speed);
  });

  test('Dauer wird beim Einreihen festgelegt (spaetere Verkuerzung aendert laufende Auftraege nicht)', () => {
    give({ steel: 1e6, titan: 1e6 });
    buy('boost', 'diamond');
    state.prestige.shop.q_speed = 5;
    assert.equal(T.queueState('workshop')[0].total, 15);
  });
});

describe('Timer: Offline und Hintergrund', () => {
  test('applyOffline arbeitet mehrere Auftraege ab und rechnet Raten abschnittsweise', () => {
    give({ ore: 1e9, steel: 1e9, titan: 1e9 });
    state.research.geology = 1;
    state.gens.mine = 10;
    buy('research', 'deepmines');    // 15 s, +50 % Erz
    buy('boost', 'diamond');         // 15 s, x2 Erz
    buy('boost', 'magnet');          // wartet bis 15 s, dann 150 s -> fertig bei 165 s, x2 Erz
    const r0 = F.rates().ore;
    const ore0 = state.res.ore;
    const info = S.applyOffline(200);
    const expected = 15 * r0 + 150 * 3 * r0 + 35 * 6 * r0;
    assert.ok(Math.abs(info.gains.ore - expected) < 1e-9 * expected, `${info.gains.ore} vs ${expected}`);
    assert.ok(Math.abs(state.res.ore - ore0 - expected) < 1e-9 * expected);
    assert.ok(state.research.deepmines && state.boosts.diamond && state.boosts.magnet);
    assert.deepEqual(T.queueState('lab'), []); assert.deepEqual(T.queueState('workshop'), []);
  });

  test('Offline-Maximum begrenzt Ertrag, nicht aber den Timerfortschritt', () => {
    give({ steel: 1e9, titan: 1e9 });
    buy('boost', 'cryo');            // 240 s
    state.prestige.shop.offline = 0;
    const cap = F.offlineCapSeconds();
    S.applyOffline(cap + 1000);
    assert.ok(state.boosts.cryo);
  });

  test('Laufzeitpfad (Hintergrund-Tab) bringt Timer ebenfalls voran', () => {
    give({ ore: 1000 });
    buy('research', 'geology');
    S.applyOffline(30, { runtime: true });
    assert.equal(state.research.geology, 1);
  });

  test('laeuft ein Timer erst nach dem Offline-Zeitraum ab, bleibt sein Rest erhalten', () => {
    give({ steel: 1e9, titan: 1e9 });
    buy('boost', 'press');           // 45 s
    S.applyOffline(20);
    const q = T.queueState('workshop')[0];
    assert.ok(Math.abs(q.left - 25) < 1e-9);
    assert.equal(state.boosts.press, undefined);
  });
});

describe('Save v4: Timer, Sanitize, Migration', () => {
  test('SAVE_VERSION 6; Roundtrip behaelt Auftraege (Rest, Kosten, Reihenfolge)', () => {
    assert.equal(S.SAVE_VERSION, 6);
    rich();
    state.research.geology = 1;
    buy('research', 'converter'); buy('research', 'deepmines'); buy('boost', 'diamond');
    tick(3);
    const before = JSON.stringify(state.timers);
    const code = S.exportSave();
    reset();
    S.importSave(code);
    assert.equal(JSON.stringify(state.timers), before);
    assert.equal(T.queueState('lab')[0].id, 'converter');
    assert.ok(Math.abs(T.queueState('lab')[0].left - 7) < 1e-9);
    assert.equal(T.isPending('boost', 'diamond'), true);
    // und laeuft nach dem Laden normal weiter
    tick(7);
    assert.ok(state.research.converter);
  });

  test('Save/Load ueber localStorage inkl. Timer', () => {
    give({ ore: 1000 });
    buy('research', 'geology');
    assert.equal(S.save(), true);
    reset();
    assert.deepEqual(S.load(), { loaded: true, migrated: false });
    assert.equal(T.isPending('research', 'geology'), true);
  });

  test('sanitize verwirft Muell: unbekannte IDs, falsche Queue, Bereits-Erforschtes, Duplikate, NaN', () => {
    const entry = (kind, id, extra = {}) => ({ kind, id, total: 10, left: 5, cost: { ore: 3 }, ...extra });
    S.importSave(b64({
      v: 4, t: 1,
      state: {
        research: { converter: 1 },
        timers: {
          lab: [entry('research', 'geology'), entry('research', 'geology'), entry('research', 'gibtsnicht'), entry('boost', 'diamond'),
            entry('research', 'converter'), 'x', null, entry('research', 'deepmines', { total: 'NaN', left: -4, cost: { ore: -9, evil: 5, steel: 'a' } })],
          workshop: [entry('boost', 'diamond'), entry('click', 'click'), entry('research', 'resonance'), entry('click', '__proto__')],
          evil: [entry('boost', 'turbo')],
        },
      },
    }));
    assert.deepEqual(T.queueState('lab').map(e => e.id), ['geology', 'deepmines']);
    assert.deepEqual(T.queueState('workshop').map(e => e.id), ['diamond', 'click']);
    const dm = state.timers.lab[1];
    assert.ok(dm.total > 0 && dm.left >= 0 && dm.left <= dm.total);
    assert.deepEqual(dm.cost, {});
    assert.equal(state.timers.evil, undefined);
    assert.deepEqual(Object.keys(state.timers).sort(), ['lab', 'workshop']);
  });

  test('left wird auf total begrenzt, Eintraege pro Queue gedeckelt', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ kind: 'boost', id: BOOSTS[i % BOOSTS.length].id, total: 10, left: 99, cost: {} }));
    S.importSave(b64({ v: 4, t: 1, state: { timers: { workshop: many } } }));
    assert.ok(state.timers.workshop.length <= BOOSTS.length);
    for (const e of state.timers.workshop) assert.ok(e.left <= e.total);
  });

  const v3 = {
    v: 3, t: 1_700_000_000_000,
    state: {
      res: { ore: 500, steel: 20, titan: 3 }, gens: { mine: 12, forge: 2 }, clicks: { click: 5 },
      research: { geology: 1, converter: 1 }, boosts: { diamond: 1 },
      prestige: { points: 2, total: 6, count: 1, shop: { pp_eff: 1, keep: 1 } },
      autobuyers: { gens: true },
      achievements: { click_1: 123 },
      stats: { clicks: 7, runClicks: 3, total: { ore: 1e6, steel: 200, titan: 30 }, run: { ore: 5e5 }, runTime: 9, playTime: 99, golden: 2, buys: 8, bestOreRate: 12, bestPrestige: 2, startedAt: 1_600_000_000_000 },
      settings: { format: 'scientific', autosave: false, autosaveSec: 30, particles: false, buyAmount: '10' },
      buffs: [{ id: 'frenzy', left: 10 }],
    },
  };
  test('Migration v3 -> v4 verlustfrei: alle Felder bleiben, Timer leer', () => {
    ls.setItem(S.SAVE_KEY, JSON.stringify(v3));
    assert.deepEqual(S.load(), { loaded: true, migrated: false });
    assert.deepEqual(state.res, zeroRes({ ore: 500, steel: 20, titan: 3 }));
    assert.equal(state.gens.mine, 12); assert.equal(state.gens.forge, 2); assert.equal(state.gens.colliery, 0);
    assert.equal(state.clicks.click, 5); assert.equal(state.clicks.sledge, 0);
    assert.deepEqual(state.research, { geology: 1, converter: 1 });
    assert.deepEqual(state.boosts, { diamond: 1 });
    assert.deepEqual(state.prestige, { points: 2, total: 6, count: 1, shop: { pp_eff: 1, keep: 1 }, history: [] });
    assert.equal(state.autobuyers.gens, true);
    assert.equal(state.achievements.click_1, 123);
    assert.deepEqual(state.stats.total, zeroRes({ ore: 1e6, steel: 200, titan: 30 }));
    assert.equal(state.stats.timersDone, 0);
    assert.equal(state.stats.playTime, 99); assert.equal(state.stats.startedAt, 1_600_000_000_000);
    assert.deepEqual(state.buffs, [{ id: 'frenzy', left: 10 }]);
    assert.equal(state.settings.buyAmount, '10');
    assert.deepEqual(state.timers, { lab: [], workshop: [] });
    S.save();
    assert.equal(JSON.parse(ls.getItem(S.SAVE_KEY)).v, S.SAVE_VERSION);
  });

  test('migrateV3toV4 veraendert die Eingabe nicht; v2 -> v4 laeuft ueber beide Schritte', () => {
    const copy = JSON.stringify(v3.state);
    const out = S.migrateV3toV4(v3.state);
    assert.equal(JSON.stringify(v3.state), copy);
    assert.deepEqual(out.timers, { lab: [], workshop: [] });
    assert.equal(out.stats.timersDone, 0);
    assert.equal(out.stats.total.ore, 1e6);
    const v2 = { v: 2, t: 5, state: { res: { ore: 9 }, click: 3, gens: { mine: 1 }, stats: { totalOre: 100, totalSteel: 1, totalTitan: 2, runOre: 50 } } };
    const m = S.migrate(v2);
    assert.equal(m.v, S.SAVE_VERSION);
    assert.equal(m.state.clicks.click, 3);
    assert.deepEqual(m.state.timers, { lab: [], workshop: [] });
    ls.setItem(S.SAVE_KEY, JSON.stringify(v2));
    assert.equal(S.load().loaded, true);
    assert.equal(state.stats.total.ore, 100); assert.equal(state.stats.run.ore, 50); assert.equal(state.clicks.click, 3);
  });

  test('v7 wird abgelehnt (zu neu)', () => {
    assert.throws(() => S.migrate({ v: 7, state: {} }), /neueren/);
  });
});

describe('Prestige und Timer', () => {
  const ready = () => { state.stats.run.ore = 4e7; give({ ore: 1e9, steel: 1e9, titan: 1e9 }); };
  test('Neuguss leert Labor und Werkbank (keine Erstattung, Ressourcen werden ohnehin zurueckgesetzt)', () => {
    ready();
    buy('research', 'geology'); buy('boost', 'diamond');
    assert.equal(doPrestige(), true);
    assert.deepEqual(state.timers, { lab: [], workshop: [] });
    assert.equal(state.res.steel, 0);
    tick(100);
    assert.deepEqual(state.research, {}); assert.deepEqual(state.boosts, {});
  });
  test('mit Wissensarchiv laufen Forschungsauftraege weiter, die Werkbank verfaellt', () => {
    ready();
    state.prestige.shop.keep = 1;
    buy('research', 'geology'); buy('boost', 'diamond'); buy('click', 'click');
    tick(2);
    assert.equal(doPrestige(), true);
    assert.deepEqual(T.queueState('lab').map(e => e.id), ['geology']);
    assert.deepEqual(T.queueState('workshop'), []);
    tick(3.1);
    assert.equal(state.research.geology, 1);
    assert.deepEqual(state.boosts, {});
  });
});

describe('Auto-Buyer und Timer', () => {
  test('Forschungs-Auto-Buyer reiht ein, aber nie doppelt und nie ueber die Kapazitaet', () => {
    rich();
    state.prestige.shop.ab_research = 1;
    AB.setEnabled('research', true);
    for (let i = 0; i < 5; i++) AB.tick(2);
    const q = T.queueState('lab');
    assert.ok(q.length >= 1 && q.length <= F.queueCapacity('lab'));
    assert.equal(new Set(q.map(e => e.id)).size, q.length);
    for (let i = 0; i < 2400; i++) { AB.tick(2); tick(30); }
    for (const r of RESEARCH.filter(r => !r.corp)) assert.equal(state.research[r.id], 1, r.id + ' wurde nicht erforscht');   // Konzernforschung ist an die Konzernstufe gebunden
  });
  test('Boost- und Klick-Auto-Buyer: pro Takt hoechstens ein laufender Auftrag je Eintrag', () => {
    rich();
    state.prestige.shop.ab_boosts = 1; state.prestige.shop.ab_click = 1;
    AB.setEnabled('boosts', true); AB.setEnabled('click', true);
    state.res.steel = 1e12;   // klein genug, dass der Abzug im Double sichtbar bleibt
    const cost0 = state.res.steel;
    AB.tick(2); AB.tick(2);
    const clickJobs = T.queueState('workshop').filter(e => e.kind === 'click' && e.id === 'click');
    assert.equal(clickJobs.length, 1);
    assert.ok(state.res.steel < cost0);
  });
});

describe('Generator-Evolution', () => {
  test('genTier: 20 Raenge, Schwellen 1/10/25/50/100/...', () => {
    assert.equal(TIER_AT.length, 20); assert.equal(TIER_NAMES.length, 20);
    assert.deepEqual(TIER_AT.slice(0, 5), [1, 10, 25, 50, 100]);
    assert.ok(TIER_AT.every((v, i) => i === 0 || v > TIER_AT[i - 1]) && TIER_AT[19] <= 5000);
    const at = n => genTier(n);
    assert.deepEqual([0, 1, 9, 10, 24, 25, 49, 50, 99, 100, 149, 150, 5000].map(at), [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 19]);
  });
  test('tierName', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(tierName), ['Holz', 'Eisen', 'Stahl', 'Titan', 'Gold']);
    assert.equal(tierName(19), 'Kosmos');
    assert.equal(tierName(-3), 'Holz'); assert.equal(tierName(99), 'Kosmos'); assert.equal(tierName(NaN), 'Holz');
  });
  test('tierPips: Fortschritt bis zum naechsten Rang', () => {
    assert.deepEqual(tierPips(0), { tier: 0, next: 10, progress: 0, pips: 0, total: 5 });
    assert.equal(tierPips(5).pips, 2); assert.equal(tierPips(5).progress, 0.5);
    assert.equal(tierPips(9).pips, 4);
    assert.equal(tierPips(10).tier, 1); assert.equal(tierPips(10).next, 25); assert.equal(tierPips(10).pips, 0);
    assert.equal(tierPips(24).pips, 4);
    assert.equal(tierPips(100).tier, 4); assert.equal(tierPips(100).next, 150);
    assert.deepEqual(tierPips(5000), { tier: 19, next: null, progress: 1, pips: 5, total: 5 });
    for (let n = 0; n < 150; n++) { const p = tierPips(n); assert.ok(p.pips >= 0 && p.pips <= 5 && p.progress >= 0 && p.progress <= 1); }
  });
  test('gen:evolve beim Erreichen eines neuen Rangs, nicht dazwischen; Sammelkauf meldet den hoechsten Rang einmal', () => {
    give({ ore: 1e15, steel: 1e15, titan: 1e15 });
    const ev = collect('gen:evolve');
    buy('gen', 'mine', 9);
    assert.deepEqual(ev.got, []);
    buy('gen', 'mine', 1);
    assert.deepEqual(ev.got, [{ id: 'mine', tier: 1 }]);
    buy('gen', 'mine', 1);
    assert.equal(ev.got.length, 1);
    buy('gen', 'mine', 20);        // 11 -> 31: ueberspringt nichts, Rang 2 ab 25
    assert.deepEqual(ev.got[1], { id: 'mine', tier: 2 });
    buy('gen', 'drill', 60);       // 0 -> 60: Rang 3 in einem Schritt, ein Event
    assert.deepEqual(ev.got.slice(2), [{ id: 'drill', tier: 3 }]);
    ev.stop();
  });
  test('exportiert ueber formulas', () => {
    assert.equal(F.genTier(10), 1); assert.equal(F.tierName(1), 'Eisen'); assert.equal(F.tierPips(0).tier, 0);
  });
});

describe('Eisenhuetten-Kette: Rezepte', () => {
  const research = (...ids) => ids.forEach(id => { state.research[id] = 1; });
  const flow = (r, id) => r.flows.find(f => f.id === id);

  test('Kohle -> Koks (Verkokung) nur mit Forschung; verbraucht 40 % der Kohle im Verhaeltnis 5:1', () => {
    state.gens.colliery = 10; research('coalmining');
    const base = F.rates();
    assert.equal(flow(base, 'coking'), undefined);
    research('coking');
    const r = F.rates();
    const f = flow(r, 'coking');
    assert.ok(f.cycles > 0);
    assert.ok(Math.abs(f.inputs.coal - 0.4 * base.coal) < 1e-9 * base.coal);
    assert.ok(Math.abs(f.outputs.coke - f.inputs.coal / 5) < 1e-12);
    assert.ok(Math.abs(r.coal - 0.6 * base.coal) < 1e-9 * base.coal);
    assert.ok(Math.abs(r.coke - f.outputs.coke) < 1e-12);
  });

  test('Erz + Koks -> Stahl-Bonus (Hochofen), begrenzt durch den knappen Eingang', () => {
    research('coalmining', 'coking', 'blastfurnace');
    state.gens.mine = 30; state.gens.colliery = 5; state.gens.cokery = 5;
    const r = F.rates();
    const f = flow(r, 'blast');
    assert.ok(f.cycles > 0);
    assert.ok(f.outputs.steel > 0);
    assert.ok(Math.abs(f.inputs.ore / f.inputs.coke - 12) < 1e-9);
    assert.ok(r.steel >= f.outputs.steel - 1e-9);
    // Stahl-Rate waere ohne Koks nur durch Konverter/Forschung bestimmt -> mit Hochofen mehr
    const noCoke = { ...state.gens }; state.gens.cokery = 0; state.gens.colliery = 0;
    const rNo = F.rates();
    assert.ok(r.steel > rNo.steel);
    Object.assign(state.gens, noCoke);
  });

  test('Kupfer + Mangan -> Legierung (3:1:1)', () => {
    research('copperworks', 'manganese', 'alloying');
    state.gens.copperhut = 10; state.gens.manganmine = 10;
    const r = F.rates();
    const f = flow(r, 'alloying');
    assert.ok(f.outputs.alloy > 0);
    assert.ok(Math.abs(f.inputs.copper / f.outputs.alloy - 3) < 1e-9);
    assert.ok(Math.abs(f.inputs.manganese / f.outputs.alloy - 1) < 1e-9);
    assert.ok(r.alloy >= f.outputs.alloy);
  });

  test('Legierung + Chrom + Nickel -> Wolfram -> Gold: Kette greift Ausgaenge der Vorgaenger auf', () => {
    research('copperworks', 'manganese', 'alloying', 'chromium', 'tungsten', 'goldsmith');
    Object.assign(state.gens, { copperhut: 20, manganmine: 20, mixer: 20, chromeworks: 20, nickelref: 20, reactor: 20 });
    const r = F.rates();
    for (const id of ['alloying', 'tungsten', 'goldsmelt']) assert.ok(flow(r, id)?.cycles > 0, id);
    assert.ok(r.gold > 0);
    const g = flow(r, 'goldsmelt');
    assert.ok(Math.abs(g.inputs.tungsten / g.outputs.gold - 20) < 1e-9);
    for (const k of RES_IDS) assert.ok(r[k] >= 0, k + ' negativ');
  });

  test('Rezept-Reihenfolge: ein Rezept liest nur Ausgaenge frueherer Rezepte', () => {
    const order = Object.fromEntries(RECIPES.map((r, i) => [r.id, i]));
    for (const rc of RECIPES) for (const inp of Object.keys(rc.inputs)) {
      for (const other of RECIPES) if (other.outputs[inp] && other !== rc) assert.ok(order[other.id] < order[rc.id], `${other.id} muss vor ${rc.id} stehen`);
    }
  });

  test('Tick mit allen Rezepten bringt nie negative Ressourcen', () => {
    rich();
    Object.keys(state.research).length;
    for (const r of RESEARCH) state.research[r.id] = 1;
    for (const g of GENS) state.gens[g.id] = 15;
    for (let i = 0; i < 50; i++) tick(1);
    for (const k of RES_IDS) assert.ok(state.res[k] >= 0 && Number.isFinite(state.res[k]), k);
  });
});

describe('Gestaffelte Freischaltung', () => {
  test('Material erscheint erst nach Forschung oder wenn Vorrat da ist', () => {
    assert.equal(F.resVisible('ore'), true);
    assert.equal(F.resVisible('coal'), false);
    state.research.coalmining = 1;
    assert.equal(F.resVisible('coal'), true);
    reset();
    state.res.copper = 1;
    assert.equal(F.resVisible('copper'), true);
    reset();
    state.stats.run.gold = 5;
    assert.equal(F.resVisible('gold'), true);
    reset();
    state.stats.total.gold = 5;   // nur frueherer Lauf: nach Neuguss verborgen
    assert.equal(F.resVisible('gold'), false);
  });
  test('isRevealed: nur Eintraege, deren Voraussetzungen direkt erreichbar sind', () => {
    assert.equal(F.isRevealed('research', 'geology'), true);
    assert.equal(F.isRevealed('research', 'deepmines'), true);       // req geology: geology selbst ohne Voraussetzung
    assert.equal(F.isRevealed('research', 'coalmining'), false);     // req deepmines, das noch geology braucht
    state.research.geology = 1;
    assert.equal(F.isRevealed('research', 'coalmining'), true);
    assert.equal(F.isRevealed('gen', 'colliery'), false);
    assert.equal(F.isRevealed('research', 'goldsmith'), false);
    state.research.deepmines = 1;
    assert.equal(F.isRevealed('gen', 'colliery'), true);
    assert.equal(F.isRevealed('boost', 'conveyor'), true);
    assert.equal(F.isRevealed('click', 'sledge'), false);
  });
  test('Generatoren, Boosts und Klick-Upgrades der Kette sind ohne Forschung gesperrt', () => {
    give({ ore: 1e12, steel: 1e12, titan: 1e12, coal: 1e9 });
    assert.match(F.lockReason('gen', 'colliery'), /Kohleflöz/);
    assert.equal(buy('gen', 'colliery', 1), false);
    assert.equal(buy('boost', 'conveyor'), false);
    assert.equal(buy('click', 'sledge'), false);
    state.research.coalmining = 1;
    assert.equal(buy('gen', 'colliery', 1), true);
    assert.equal(buy('boost', 'conveyor'), true);
  });
});

// ---------- Balance- und Daten-Sanity ----------
describe('Daten- und Balance-Sanity', () => {
  const finitePos = (c, label) => {
    assert.ok(Object.keys(c).length > 0, label + ': leere Kosten');
    for (const [k, v] of Object.entries(c)) { assert.ok(RES[k], label + ': unbekannte Ressource ' + k); assert.ok(Number.isFinite(v) && v > 0, `${label}: ${k}=${v}`); }
  };
  test('alle Kosten sind endlich und positiv (Generatoren bis Stufe 300, Klick-Upgrades bis 200)', () => {
    for (const g of GENS) for (let l = 0; l < 300; l += 7) finitePos(F.unitCost('gen', g.id, l), `gen ${g.id}@${l}`);
    for (const c of CLICKS) for (let l = 0; l < 200; l += 5) finitePos(F.unitCost('click', c.id, l), `click ${c.id}@${l}`);
    for (const r of RESEARCH) finitePos(r.cost, 'research ' + r.id);
    for (const b of BOOSTS) finitePos(b.cost, 'boost ' + b.id);
  });
  test('Kosten wachsen monoton mit der Stufe', () => {
    for (const g of GENS) for (const k of Object.keys(F.unitCost('gen', g.id, 0))) {
      let prev = 0;
      for (let l = 0; l < 120; l++) { const v = F.unitCost('gen', g.id, l)[k]; assert.ok(v >= prev, `${g.id}.${k}@${l}`); prev = v; }
    }
  });
  test('Dauern: jeder Forschungs-/Boost-Eintrag hat time > 0, Klick-Upgrades time-Formel; Spanne passt', () => {
    for (const r of RESEARCH) assert.ok(r.time > 0 && r.time <= (r.corp ? 22000 : 1800), 'research ' + r.id);   // Konzernforschung: bis 6 h (Formel 1800 s × 1,4^(K-1), Ausbau 3 länger)
    for (const b of BOOSTS) assert.ok(b.time > 0 && b.time <= (b.corp ? 7000 : 1800), 'boost ' + b.id);
    for (const c of CLICKS) { assert.ok(c.time.base > 0 && c.time.growth >= 1 && c.time.max >= c.time.base, 'click ' + c.id); assert.ok(F.baseTime('click', c.id, 500) <= c.time.max); }
    assert.ok(Math.min(...RESEARCH.map(r => r.time)) >= 5 && Math.min(...RESEARCH.map(r => r.time)) <= 20, 'fruehe Forschung 5-20 s');
    assert.ok(Math.max(...RESEARCH.filter(r => !r.corp).map(r => r.time)) >= 600 && Math.max(...RESEARCH.filter(r => !r.corp).map(r => r.time)) <= 1800, 'spaete Forschung bis ~30 min');
  });
  test('req-Verweise existieren und bilden keinen Zyklus (Forschung, Generatoren, Boosts, Klick, Rezepte, Material)', () => {
    const known = id => assert.ok(RESEARCH_MAP[id], 'unbekannte Forschung ' + id);
    for (const g of GENS) F.reqList(g.req).forEach(known);
    for (const b of BOOSTS) F.reqList(b.req).forEach(known);
    for (const c of CLICKS) F.reqList(c.req).forEach(known);
    for (const r of RECIPES) F.reqList(r.req).forEach(known);
    for (const r of Object.values(RES)) F.reqList(r.req).forEach(known);
    const state_ = new Map();
    const visit = (id, path) => {
      if (state_.get(id) === 2) return;
      assert.notEqual(state_.get(id), 1, 'Zyklus: ' + [...path, id].join(' -> '));
      state_.set(id, 1);
      for (const q of RESEARCH_MAP[id].req ?? []) visit(q, [...path, id]);
      state_.set(id, 2);
    };
    RESEARCH.forEach(r => visit(r.id, []));
    assert.equal(new Set(RESEARCH.map(r => r.id)).size, RESEARCH.length, 'doppelte Forschungs-IDs');
    assert.equal(new Set([...GENS, ...BOOSTS, ...CLICKS].map(x => x.id)).size, GENS.length + BOOSTS.length + CLICKS.length, 'doppelte IDs');
  });
  test('jede Ressource, jede Forschung, jeder Generator, jeder Boost und jedes Klick-Upgrade ist erreichbar (Fixpunkt)', () => {
    const have = new Set(), res = new Set(['ore']);   // ore: Klick
    const ok = c => Object.keys(c).every(k => res.has(k));
    let changed = true;
    const gens = new Set(), boosts = new Set(), clicks = new Set();
    while (changed) {
      changed = false;
      for (const r of RESEARCH) if (!have.has(r.id) && (r.req ?? []).every(q => have.has(q)) && ok(r.cost)) { have.add(r.id); changed = true; }
      for (const g of GENS) if (!gens.has(g.id) && F.reqList(g.req).every(q => have.has(q)) && ok(g.cost)) { gens.add(g.id); res.add(g.res); changed = true; }
      for (const rc of RECIPES) if (F.reqList(rc.req).every(q => have.has(q)) && Object.keys(rc.inputs).every(k => res.has(k))) for (const k in rc.outputs) if (!res.has(k)) { res.add(k); changed = true; }
      for (const b of BOOSTS) if (!boosts.has(b.id) && F.reqList(b.req).every(q => have.has(q)) && ok(b.cost)) { boosts.add(b.id); changed = true; }
      for (const c of CLICKS) if (!clicks.has(c.id) && F.reqList(c.req).every(q => have.has(q)) && ok(F.unitCost('click', c.id, 0))) { clicks.add(c.id); changed = true; }
    }
    for (const k of RES_IDS) assert.ok(res.has(k), 'Ressource nicht erreichbar: ' + k);
    for (const r of RESEARCH) assert.ok(have.has(r.id), 'Forschung nicht erreichbar: ' + r.id);
    for (const g of GENS) assert.ok(gens.has(g.id), 'Generator nicht erreichbar: ' + g.id);
    for (const b of BOOSTS) assert.ok(boosts.has(b.id), 'Boost nicht erreichbar: ' + b.id);
    for (const c of CLICKS) assert.ok(clicks.has(c.id), 'Klick-Upgrade nicht erreichbar: ' + c.id);
  });
  test('jede Ressource hat einen Generator; Kosten-Ressourcen werden durch Generatoren/Rezepte erzeugt', () => {
    for (const k of RES_IDS) assert.ok(GENS.some(g => g.res === k), 'kein Generator fuer ' + k);
    // Freigabe-Forschung eines Materials = Forschung seines Generators (Material erscheint, wenn es produzierbar wird)
    for (const g of GENS) if (g.req) for (const q of F.reqList(RES[g.res].req)) assert.ok(F.reqList(g.req).includes(q) || RESEARCH_MAP[q], g.id);
  });
  test('Umfang der Phase 2b: Mengen laut Auftrag', () => {
    assert.ok(RES_IDS.length >= 3 + 6, 'mind. 6 neue Materialien');
    assert.ok(GENS.length >= 5 + 6, 'mind. 6 neue Generatoren');
    assert.ok(BOOSTS.length >= 6 + 8, 'mind. 8 neue Boosts');
    assert.ok(RESEARCH.length >= 70, 'mind. 70 Forschungen');
    assert.ok(CLICKS.length >= 1 + 2 && CLICKS.length <= 1 + 5 + 4, '2-5 neue Klick-Upgrades (+4 Konzern)');
    assert.ok(RECIPES.length >= 1 + 3, 'neue Rezeptketten');
    for (const id of ['q_lab', 'q_work', 'q_speed']) assert.ok(SHOP_MAP[id], id);
    assert.ok(RESEARCH_MAP.automation && RESEARCH_MAP.automation.time > 0);
    assert.ok(Object.keys(QUEUES).length === 2);
    assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length, 'Erfolg-IDs eindeutig');
    assert.ok(ACHIEVEMENTS.some(a => a.id === 'gold_1') && ACHIEVEMENTS.some(a => a.id === 'timer_10'));
  });
  test('UI-Felder: img-Pfad je Material/Generator, liquid + cat je Forschung', () => {
    for (const r of Object.values(RES)) assert.equal(r.img, `assets/icons/res-${r.id}.svg`);
    for (const g of GENS) { assert.equal(g.img, `assets/icons/gen-${g.id}.svg`); assert.ok(g.icon, 'Emoji-Fallback ' + g.id); }
    for (const r of Object.values(RES)) assert.ok(r.icon, 'Emoji-Fallback ' + r.id);
    for (const r of RESEARCH) {
      assert.match(r.liquid, /^#[0-9a-f]{6}$/i, r.id);
      assert.ok(['mining', 'metal', 'chem', 'tech'].includes(r.cat), r.id + ' cat ' + r.cat);
    }
    for (const r of Object.values(RES)) assert.match(r.color, /^#[0-9a-f]{6}$/i);
  });
  test('Erster neuer Inhalt zeitnah: Kohleflöz ist nach den fruehen Forschungen bezahlbar und kurz', () => {
    const chain = ['geology', 'deepmines', 'coalmining'];
    const total = chain.reduce((a, id) => a + RESEARCH_MAP[id].time, 0);
    assert.ok(total <= 60, 'Zeit bis zur Kohle ' + total);
    assert.ok(RESEARCH_MAP.coalmining.cost.ore <= 20000);
  });
  test('Spielbarkeit: Bot-lose Pruefung - mit ausreichend Material wird die gesamte Forschung durchlaufen und alles erforscht', () => {
    rich();
    state.corp.total = 351;   // Konzernstufe K7 (Konzernforschung ist daran gebunden)
    for (const k of RES_IDS) state.res[k] = 1e45;   // auch die 7 Konzern-Materialien
    state.prestige.shop.ab_research = 1;
    for (let guard = 0; guard < 1200 && Object.keys(state.research).length < RESEARCH.length; guard++) {
      for (const r of RESEARCH) if (!state.research[r.id] && !F.lockReason('research', r.id)) buy('research', r.id);
      T.tick(600);
    }
    assert.equal(Object.keys(state.research).length, RESEARCH.length);
  });
});
