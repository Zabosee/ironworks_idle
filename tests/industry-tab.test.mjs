// Industrie-Tab: erst ab dem 1. Neuguss sichtbar/anwählbar; aktiver Tab fällt auf Generatoren zurück.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state, reset, installStorage } from './helpers.mjs';
import { industryUnlocked } from '../js/core/formulas.js';
import { doPrestige } from '../js/systems/prestige.js';

installStorage();

// Minimaler DOM-Ersatz (nur was tabs.js braucht)
const NAMES = ['works', 'gens', 'industry', 'upgrades'];
const els = new Map();
const mk = name => ({ dataset: { tab: name }, hidden: false, tabIndex: 0, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
const panels = {};
for (const n of NAMES) { els.set('tabbtn-' + n, mk(n)); panels[n] = { hidden: true }; els.set('tab-' + n, panels[n]); }
els.get('tabbtn-industry').hidden = true;   // wie in index.html
const nav = { querySelectorAll: () => NAMES.map(n => els.get('tabbtn-' + n)), addEventListener() {} };
globalThis.document = { getElementById: id => els.get(id) ?? null, addEventListener() {} };
globalThis.Node = class {};
const { initTabs, setTabHidden, activeTab } = await import('../js/ui/tabs.js');
const select = initTabs(nav);

beforeEach(() => { reset(); setTabHidden('industry', true); select('works'); });

describe('Industrie-Tab', () => {
  test('index.html: Industrie-Button und Zeitalter-Anzeige starten versteckt', () => {
    const html = readFileSync('index.html', 'utf8');
    assert.match(html, /id="tabbtn-industry"[^>]*\shidden/);
    assert.match(html, /id="era-summary"[^>]*\shidden/);
  });
  test('Freischaltung hängt nur an prestige.count >= 1', () => {
    assert.equal(industryUnlocked(), false);
    state.stats.total.ore = 1e300; assert.equal(industryUnlocked(), false);
    state.prestige.count = 1; assert.equal(industryUnlocked(), true);
  });
  test('Der 1. Neuguss schaltet frei', () => {
    state.stats.run.ore = 1e9; state.stats.runTime = 50;
    assert.equal(industryUnlocked(), false);
    assert.ok(doPrestige());
    assert.equal(industryUnlocked(), true);
  });
  test('Einblenden/Ausblenden des Tab-Buttons', () => {
    const b = els.get('tabbtn-industry');
    setTabHidden('industry', false); assert.equal(b.hidden, false);
    select('industry'); assert.equal(activeTab(), 'industry'); assert.equal(panels.industry.hidden, false);
    setTabHidden('industry', true); assert.equal(b.hidden, true);
  });
  test('Liegt der aktive Tab auf Industrie und wird versteckt (Reset/Import), fällt er auf Generatoren zurück', () => {
    setTabHidden('industry', false); select('industry');
    setTabHidden('industry', true);
    assert.equal(activeTab(), 'gens');
    assert.equal(panels.gens.hidden, false); assert.equal(panels.industry.hidden, true);
  });
  test('Ausblenden eines nicht aktiven Tabs ändert den aktiven Tab nicht', () => {
    setTabHidden('industry', false); select('upgrades');
    setTabHidden('industry', true);
    assert.equal(activeTab(), 'upgrades');
  });
});
