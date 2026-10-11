import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, setEra } from './helpers.mjs';
import * as F from '../js/core/formulas.js';
import { BOOSTS, CLICKS, BOOST_MAP } from '../js/data/upgrades.js';
import { ERAS } from '../js/data/eras.js';
import { RESEARCH, RESEARCH_MAP } from '../js/data/research.js';

describe('Upgrades: click/autoclick-Boosts, Synergie, Zeitalter-Staffelung', () => {
  beforeEach(() => reset());

  test('mult.click wirkt auf den Klickwert, nicht auf Produktion; all zählt nicht mit', () => {
    const before = F.clickBaseAt(3, 1), ore = F.researchMult('ore');
    state.boosts.clickforge = 1;
    assert.equal(F.keyMult('click'), 2);
    assert.ok(Math.abs(F.clickBaseAt(3, 1) / before - 2) < 1e-12);
    assert.equal(F.researchMult('ore'), ore);
    delete state.boosts.clickforge;
    state.boosts.valves = 1;   // all ×1,25 beeinflusst keyMult('click') nicht
    assert.equal(F.keyMult('click'), 1);
  });

  test('mult.autoclick skaliert nur den Autoklick-Anteil an Erz', () => {
    state.research.autoclick = true;
    const r0 = F.rates().ore, c0 = F.clickBaseTotal();
    state.boosts.autotap = 1;
    const r1 = F.rates().ore, c1 = F.clickBaseTotal();
    assert.ok(Math.abs(r0 - 5 * c0) < 1e-9 * Math.max(1, r0));
    assert.ok(Math.abs(r1 - 10 * c1) < 1e-9 * Math.max(1, r1), 'Autoklick ×2');
  });

  test('Synergie: +0,3 % je Forschung, +0,5 % je Boost, moderat im Endausbau', () => {
    state.research.geology = true; state.boosts.diamond = 1;
    assert.equal(F.synergyMult(), 1, 'vor Zeitalter 1 inaktiv');
    reset(); setEra(1);
    assert.equal(F.synergyMult(), 1);
    state.research.geology = true;
    assert.ok(Math.abs(F.synergyMult() - 1.003) < 1e-12);
    state.boosts.diamond = 1;
    assert.ok(Math.abs(F.synergyMult() - 1.008) < 1e-12);
    setEra(1);
    for (const id of Object.keys(RESEARCH_MAP)) state.research[id] = true;
    for (const b of BOOSTS) state.boosts[b.id] = 1;
    assert.ok(F.synergyMult() < 1.6, 'Synergie ' + F.synergyMult());
    assert.ok(F.globalMult() > 0 && Number.isFinite(F.globalMult()));
  });

  test('Era-Boosts und Era-Forschung: Kosten liegen im Band [1e-6, 1] x Erz-Schwelle ihres Zeitalters und steigen mit dem Tor', () => {
    const maxCost = b => Math.max(...Object.values(b.cost));
    const band = (x, label) => {
      assert.ok(x.era >= 1 && x.era < ERAS.length, label);
      assert.ok(maxCost(x) <= ERAS[x.era].at * 1.0, `${label} teurer als die Schwelle von Zeitalter ${x.era}`);
      assert.ok(maxCost(x) >= ERAS[x.era].at * 1e-6, `${label} zu billig fuer Zeitalter ${x.era}`);
    };
    for (const b of BOOSTS.filter(b => b.era)) band(b, b.id);
    for (const r of RESEARCH.filter(r => r.era)) {
      band(r, r.id);
      assert.ok(r.cost.ore === undefined || r.cost.ore <= ERAS[r.era].at, `${r.id}: Erzkosten ueber der Schwelle`);
    }
    for (const list of [BOOSTS, RESEARCH]) {
      let last = 0;
      for (const e of [1, 2, 3, 4, 5]) {
        const m = Math.min(...list.filter(x => x.era === e).map(maxCost));
        assert.ok(m > last, 'Staffelung Zeitalter ' + e);
        last = m;
      }
    }
    for (const c of CLICKS.filter(c => c.era)) assert.ok(F.lockReason('click', c.id));
  });

  test('Era-Tor sperrt Boosts vor dem Zeitalter (lockReason)', () => {
    for (const q of Object.keys(RESEARCH_MAP)) state.research[q] = true;
    assert.ok(F.lockReason('boost', 'waterwheel'));   // Zeitalter 0
    assert.ok(BOOST_MAP.fusioncat.era === 5);
  });
});
