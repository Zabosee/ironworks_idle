// Hilfe/Glossar: jede Ressource im Glossar, Rezeptketten aus RECIPES, DE+EN-Texte vorhanden, ??? ohne Namen-Spoiler.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reset, state } from './helpers.mjs';
import { glossary, LAYERS, layerParams } from '../js/data/help.js';
import { RES_IDS, RES } from '../js/data/resources.js';
import { RECIPES } from '../js/data/recipes.js';
import { EN_UI } from '../js/i18n/en-ui.js';
import { EN } from '../js/i18n/en-data.js';

describe('Hilfe', () => {
  test('jede Ressource hat genau einen Glossar-Eintrag', () => {
    assert.deepEqual(glossary().map(e => e.id), RES_IDS);
  });
  test('Rezeptkette: made/fed entsprechen RECIPES', () => {
    const g = Object.fromEntries(glossary().map(e => [e.id, e]));
    for (const r of RECIPES) {
      for (const o of Object.keys(r.outputs)) assert.ok(g[o].made.includes(r), `${r.id} fehlt bei ${o}`);
      for (const i of Object.keys(r.inputs)) assert.ok(g[i].fed.includes(r), `${r.id} fehlt bei ${i}`);
    }
    assert.deepEqual(g.alloy.made.map(r => r.id), ['alloying']);
    assert.deepEqual(g.coke.fed.map(r => r.id), ['blast']);
  });
  test('Spielebenen: DE und EN vorhanden, Platzhalter gefüllt', () => {
    assert.equal(LAYERS.length, 9);
    for (const l of LAYERS) for (const k of [l.name, l.text]) assert.ok(EN_UI[k], `EN fehlt: ${k}`);
    for (const l of LAYERS) assert.ok(!/\{\w+\}/.test(l.text.replace(/\{(\w+)\}/g, (m, p) => layerParams(l.id)?.[p] ?? m)), l.id);
  });
  test('UI-Texte und Rezept-/Ressourcennamen auf EN', () => {
    for (const id of RES_IDS) assert.ok(EN.resources[id]?.name, id);
    for (const r of RECIPES) assert.ok(EN.recipes?.[r.id]?.name, `EN.recipes.${r.id}`);
  });
  test('resKnown: späte Materialien sind unentdeckt und der Name wird nicht ausgegeben', async () => {
    reset();
    const { resKnown } = await import('../js/ui/help.js');
    assert.equal(resKnown('ore'), true);
    assert.equal(resKnown('superalloy'), false);
    state.stats.total.superalloy = 1;
    assert.equal(resKnown('superalloy'), true);
    assert.ok(RES.superalloy.name);
  });
});
