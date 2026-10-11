// Zeitalter-Tore an Forschungen: lockReason, Sichtbarkeit, Kauf, Auto-Buyer.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, give, zeroRes, installStorage , setEra } from './helpers.mjs';
import { ERAS } from '../js/data/eras.js';
import { RESEARCH, RESEARCH_MAP } from '../js/data/research.js';
import * as F from '../js/core/formulas.js';
import { buy } from '../js/systems/production.js';

installStorage();
beforeEach(() => reset());

const gated = RESEARCH.filter(r => r.era);

describe('Forschung mit Zeitalter-Tor', () => {
  test('Daten: era ist ein gültiger Zeitalter-Index >= 1 und mindestens so hoch wie bei allen Eltern', () => {
    assert.ok(gated.length >= 10);
    for (const r of gated) {
      assert.ok(Number.isInteger(r.era) && r.era >= 1 && r.era < ERAS.length, r.id);
      for (const q of r.req || []) assert.ok((RESEARCH_MAP[q].era || 0) <= r.era, `${r.id}: Elternteil ${q} hat höheres Zeitalter`);
    }
  });
  test('lockReason: Voraussetzungen zuerst, danach das Zeitalter', () => {
    const r = RESEARCH_MAP.energyfound;
    assert.match(F.lockReason('research', 'energyfound'), /Benötigt: /);          // resonance fehlt
    state.research.resonance = 1;
    assert.match(F.lockReason('research', 'energyfound'), /ersten Neuguss/);   // Industrie noch nicht freigeschaltet
    state.prestige.count = 1;
    assert.match(F.lockReason('research', 'energyfound'), /Zeitalter: Mechanisierung/);
    setEra(r.era);
    assert.equal(F.lockReason('research', 'energyfound'), null);
  });
  test('Sichtbar, aber gesperrt: isRevealed hängt nur an den Eltern', () => {
    state.research.resonance = 1;
    assert.equal(F.isRevealed('research', 'energyfound'), true);
    assert.ok(F.lockReason('research', 'energyfound'));
  });
  test('buy: ohne Zeitalter kein Auftrag, mit Zeitalter schon', () => {
    state.research.resonance = 1;
    give(zeroRes({ ore: 1e18, steel: 1e18, coal: 1e18 }));
    assert.equal(buy('research', 'energyfound', 1), false);
    assert.equal(F.pendingOf('research', 'energyfound'), null);
    setEra(1);
    assert.equal(buy('research', 'energyfound', 1), true);
    assert.ok(F.pendingOf('research', 'energyfound'));
  });
  test('Zeitalter-Tor braucht Erz UND den 1. Neuguss', () => {
    state.research.resonance = 1;
    state.stats.total.ore = ERAS[1].at;                       // nur Erz, kein Neuguss
    assert.match(F.lockReason('research', 'energyfound'), /ersten Neuguss/);
    state.stats.total.ore = 0; state.prestige.count = 1;      // nur Neuguss
    assert.match(F.lockReason('research', 'energyfound'), /Zeitalter: Mechanisierung/);
    state.stats.total.ore = ERAS[1].at;                       // beides
    assert.equal(F.lockReason('research', 'energyfound'), null);
  });
  test('Alle gesperrten Forschungen sind über die Zeitalter erreichbar (höchstes era <= letztes Zeitalter)', () => {
    assert.ok(Math.max(...gated.map(r => r.era)) <= ERAS.length - 1);
  });
});
