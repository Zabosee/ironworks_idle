// Industrie-Meilensteine (Fördermenge, Materialvielfalt), Zielleiste und Neuguss-Vorschau.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset, installStorage, setEra } from './helpers.mjs';
import { INDUSTRY_TRACKS } from '../js/data/industry.js';
import { RES_IDS } from '../js/data/resources.js';
import { ERAS } from '../js/data/eras.js';
import { MILESTONES } from '../js/data/prestige.js';
import * as F from '../js/core/formulas.js';

installStorage();
beforeEach(() => reset());
const track = id => F.industryProgress().find(t => t.id === id);

describe('Industrie-Leisten: Daten', () => {
  test('Fördermenge 8 Stufen (Produkt ca. 3,87), Materialvielfalt 7 Stufen (Produkt ca. 2,82), Schwellen steigend, Boni > 1', () => {
    const [a, b] = INDUSTRY_TRACKS;
    assert.equal(a.steps.length, 8); assert.equal(b.steps.length, 7);
    assert.ok(Math.abs(a.steps.reduce((m, s) => m * s.mult, 1) - 3.87) < 0.01);
    assert.ok(Math.abs(b.steps.reduce((m, s) => m * s.mult, 1) - 2.82) < 0.01);
    for (const t of INDUSTRY_TRACKS) t.steps.forEach((s, i) => { assert.ok(s.mult > 1); if (i) assert.ok(s.at > t.steps[i - 1].at); });
  });
  test('Erreichbarkeit: B1-B3 mit den 12 Grundmaterialien; B4-B7 zählen die 7 Konzern-Materialien (19 gesamt)', () => {
    const b = INDUSTRY_TRACKS[1];
    assert.equal(RES_IDS.length, 19);
    assert.ok(b.steps.slice(0, 3).every(s => s.at <= 12));
    assert.equal(b.steps.at(-1).at, RES_IDS.length);   // 12 + 7 neue Materialien
  });
});

describe('Industrie-Leisten: Ableitung und Wirkung', () => {
  test('Fördermenge: Schwellen, Fortschritt (log), Monotonie', () => {
    assert.equal(track('output').reached, 0); assert.equal(track('output').next, 1e12);
    let prev = 1;
    for (const s of INDUSTRY_TRACKS[0].steps) {
      state.stats.total.ore = s.at * 0.999; const lo = track('output').reached;
      state.stats.total.ore = s.at; const hi = track('output');
      assert.equal(hi.reached, lo + 1); assert.ok(hi.mult >= prev); prev = hi.mult;
    }
    assert.equal(track('output').next, null); assert.equal(track('output').progress, 1);
    state.stats.total.ore = 1e6; assert.ok(Math.abs(track('output').progress - 0.5) < 1e-9);
    state.stats.total.ore = 10 ** 13.5; assert.ok(Math.abs(track('output').progress - 0.5) < 1e-9);
  });
  test('Materialvielfalt zählt Ressourcen mit stats.total > 0', () => {
    assert.equal(track('variety').value, 0);
    for (const k of RES_IDS.slice(0, 6)) state.stats.total[k] = 1;
    assert.equal(track('variety').value, 6); assert.equal(track('variety').reached, 1);
    assert.ok(Math.abs(track('variety').mult - 1.05) < 1e-12);
    for (const k of RES_IDS.slice(0, 12)) state.stats.total[k] = 5;
    assert.equal(track('variety').reached, 3);   // 12 Grundmaterialien
    for (const k of RES_IDS) state.stats.total[k] = 5;
    assert.equal(track('variety').reached, 7);   // alle 19: B7 erreichbar
  });
  test('industryMult ist das Produkt beider Leisten, steckt in globalMult und hängt nur an stats.total', () => {
    assert.equal(F.industryMult(), 1);
    const g0 = F.globalMult();
    for (const k of RES_IDS.slice(0, 6)) state.stats.total[k] = 1;
    state.stats.total.ore = 1e12;
    assert.ok(Math.abs(F.industryMult() - 1.05 * 1.05) < 1e-12);
    assert.ok(Math.abs(F.globalMult() / g0 - 1.05 * 1.05) < 1e-9);
    state.stats.run.ore = 0;   // Neuguss setzt nur run zurück
    assert.ok(Math.abs(F.industryMult() - 1.1025) < 1e-12);
  });
});

describe('Zielleiste und Neuguss-Vorschau (rein)', () => {
  test('Vor dem 1. Neuguss: Ziel "firstcast" mit log. Fortschritt zu 1e7', () => {
    state.stats.run.ore = 1e3;
    const g = F.nextGoals().find(x => x.kind === 'firstcast');
    assert.ok(g && Math.abs(g.progress - 3 / 7) < 1e-9 && g.at === 1e7);
    assert.equal(F.nextGoals().some(x => x.kind === 'era'), false);
  });
  test('Nach dem 1. Neuguss: Meilenstein, Zeitalter, Industrie; absteigend nach Fortschritt', () => {
    setEra(1); state.prestige.total = 3;
    const gs = F.nextGoals();
    const m = gs.find(x => x.kind === 'milestone'), e = gs.find(x => x.kind === 'era');
    assert.equal(m.at, MILESTONES[0].at); assert.ok(Math.abs(m.progress - 0.6) < 1e-12);
    assert.equal(e.id, ERAS[2].id);
    assert.ok(gs.some(x => x.kind === 'industry'));
    for (let i = 1; i < gs.length; i++) assert.ok(gs[i - 1].progress >= gs[i].progress);
    for (const g of gs) assert.ok(g.progress >= 0 && g.progress <= 1);
  });
  test('Letztes Zeitalter und alle Meilensteine: nur noch Industrie-Ziele', () => {
    state.prestige.count = 1; state.prestige.total = 1e6; state.stats.total.ore = ERAS.at(-1).at;
    assert.ok(F.nextGoals().every(g => g.kind === 'industry'));
  });
  test('castPreview: Gewinn, pro Stunde, Meilenstein-Hinweis, Lohnt-sich-Regel', () => {
    state.stats.run.ore = 1e9; state.stats.runTime = 1800;
    const p = F.castPreview();
    assert.equal(p.gain, F.prestigeGain()); assert.ok(p.gain > 0);
    assert.ok(Math.abs(p.perHour - p.gain * 2) < 1e-9);
    assert.equal(p.milestone.at, 5); assert.equal(p.milestone.missing, 5); assert.equal(p.milestone.reached, p.gain >= 5);
    assert.ok(p.nextAt > 1e9); assert.equal(p.worthIt, null);
    assert.equal(F.castPreview(p.gain - 1).worthIt, true);          // +1 in 120 s < Schnitt (gain/1800)
    assert.equal(F.castPreview(0).worthIt, p.gain / 120 < p.gain / 1800);
    state.prestige.total = 250000; assert.equal(F.castPreview().milestone, null);
    state.stats.runTime = 0; assert.equal(F.castPreview(1).worthIt, null);
  });
});

describe('systems/industry.js: Event bei neuer Leisten-Stufe', () => {
  test('meldet nur neue Stufen (je Stufe ein Event), nichts nach reset() und nichts bei unveränderter Lage', async () => {
    const I = await import('../js/systems/industry.js');
    const { collect } = await import('./helpers.mjs');
    const ev = collect('industry');
    state.stats.total.ore = INDUSTRY_TRACKS[0].steps[0].at;   // A1 schon vor dem Laden erreicht
    I.reset(); I.check(1, true);
    assert.equal(ev.got.length, 0, 'kein Event für beim Laden bereits erreichte Stufen');
    state.stats.total.ore = INDUSTRY_TRACKS[0].steps[2].at;   // Sprung über A2 und A3 (z. B. Offline)
    I.check(0.1);
    assert.equal(ev.got.length, 0, 'Prüftakt 0,5 s');
    I.check(1);
    assert.deepEqual(ev.got.map(e => [e.track, e.step]), [['output', 2], ['output', 3]]);
    assert.equal(ev.got[0].mult, INDUSTRY_TRACKS[0].steps[1].mult);
    I.check(1, true);
    assert.equal(ev.got.length, 2, 'keine Wiederholung');
    ev.stop();
  });
});
