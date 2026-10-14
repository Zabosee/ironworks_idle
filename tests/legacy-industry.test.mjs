// Alter Spielstand (Format v5) mit viel Erz und Ausbauten, aber ohne Neuguss: Industrie/Zeitalter bleiben bis zum 1. Neuguss aus.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage } from './helpers.mjs';
import * as S from '../js/core/save.js';
import { defaultState } from '../js/core/state.js';
import { eraIndex, eraMult, industryUnlocked, evoLock, lockReason, synergyMult, rates } from '../js/core/formulas.js';
import { doPrestige } from '../js/systems/prestige.js';
import { tick } from '../js/systems/production.js';
import { buyEvo } from '../js/systems/evolution.js';
import { setLang } from '../js/core/i18n.js';

beforeEach(() => { installStorage(); reset(); setLang('de'); });

const b64 = obj => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
function oldSave(mut) {
  const st = JSON.parse(JSON.stringify(defaultState()));
  st.stats.total.ore = 5e22;                      // würde nach neuer Regel Zeitalter 3 ergeben
  st.stats.run.ore = 5e22; st.stats.runTime = 3600;
  st.res.ore = 1e21; st.res.steel = 1e20;
  st.gens.mine = 300; st.gens.smelter = 120;
  st.evo.mine = 3; st.evo.smelter = 2;            // Ausbauten aus der alten Zeitalter-Logik
  st.research = { geology: 1, converter: 1, deepmines: 1, ore_3: 1, energyfound: 1 };   // inkl. Zeitalter-Forschung
  st.prestige.count = 0;
  mut?.(st);
  return b64({ v: 5, t: 1_700_000_000_000, state: st });
}

describe('Alter v5-Spielstand ohne Neuguss', () => {
  test('lädt ohne Fehler; Industrie gesperrt, Zeitalter 0, Bonus neutral', () => {
    S.importSave(oldSave());
    assert.equal(state.prestige.count, 0);
    assert.equal(state.stats.total.ore, 5e22);
    assert.equal(industryUnlocked(), false);
    assert.equal(eraIndex(), 0);
    assert.equal(eraMult(), 1);
    assert.equal(synergyMult(), 1);
    assert.equal(state.evo.mine, 3);              // Ausbau-Stufen bleiben im Save erhalten
  });
  test('Ausbau und Zeitalter-Forschung sind ohne Neuguss gesperrt, trotz 5e22 Erz', () => {
    S.importSave(oldSave());
    assert.match(evoLock('mine') ?? '', /Neuguss/);
    assert.match(lockReason('research', 'ore_4') ?? '', /Neuguss/);
    state.res.ore = 1e30; state.res.steel = 1e30;
    assert.equal(buyEvo('mine', { silent: true }), false);
    assert.equal(state.evo.mine, 3);
  });
  test('Produktion und Tick liefern endliche Werte (kein Crash, kein NaN)', () => {
    S.importSave(oldSave());
    const r = rates();
    for (const k of Object.keys(state.res)) assert.ok(Number.isFinite(r[k]), k);
    const before = state.res.ore;
    tick(10);
    assert.ok(Number.isFinite(state.res.ore) && state.res.ore > before);
  });
  test('Zeitalter-Forschung im Save liefert ohne Zeitalter weiterhin ihren Bonus nicht verloren/negativ (Rate bleibt positiv)', () => {
    S.importSave(oldSave());
    assert.ok(rates().ore > 0);
  });
  test('Nach dem 1. Neuguss: Industrie frei, Zeitalter aus dem Gesamt-Erz, Ausbauten zurückgesetzt', () => {
    S.importSave(oldSave());
    assert.ok(doPrestige());
    assert.equal(industryUnlocked(), true);
    assert.equal(eraIndex(), 3);                  // 5e22 >= 1e21 (Elektrifizierung), < 2e23
    assert.ok(eraMult() > 1);
    assert.equal(state.evo.mine, 0);
  });
  test('Sprache DE/EN ändert Zeitalter, Sperren und Raten nicht', () => {
    S.importSave(oldSave(st => { st.prestige.count = 1; }));
    const snap = () => JSON.stringify([eraIndex(), eraMult(), industryUnlocked(), !!evoLock('mine'), !!lockReason('research', 'ore_4'), rates().ore]);
    setLang('de'); const de = snap();
    setLang('en'); const en = snap();
    assert.equal(en, de);
  });
  test('Import eines Saves ohne Neuguss sperrt die Industrie wieder; Reset ebenso', () => {
    state.prestige.count = 4; state.stats.total.ore = 1e24;   // Zeitalter 5 (unter 8e26)
    assert.equal(eraIndex(), 5);
    S.importSave(oldSave());
    assert.equal(industryUnlocked(), false); assert.equal(eraIndex(), 0);
    state.prestige.count = 2; assert.ok(eraIndex() > 0);
    S.resetGame();
    assert.equal(industryUnlocked(), false); assert.equal(eraIndex(), 0);
  });
});
