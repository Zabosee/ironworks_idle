import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GENS } from '../js/data/generators.js';
import { RESEARCH } from '../js/data/research.js';
import { GEN_SPRITE, spriteHref, imgFor } from '../js/ui/assets.js';

const sprite = fs.readFileSync(new URL('../assets/sprites/gens.svg', import.meta.url), 'utf8');

test('jeder Generator hat ein Sprite-Symbol und ein Icon', () => {
  for (const g of GENS) {
    assert.ok(GEN_SPRITE[g.id], 'Sprite-Zuordnung ' + g.id);
    assert.ok(sprite.includes(`id="gen-${GEN_SPRITE[g.id]}"`), 'Symbol ' + g.id);
    assert.ok(spriteHref(g.id).endsWith('#gen-' + GEN_SPRITE[g.id]));
    assert.ok(imgFor(g), 'Icon ' + g.id);
    assert.ok(fs.existsSync(new URL('../' + imgFor(g), import.meta.url)), 'Datei ' + imgFor(g));
  }
});

test('Forschungen haben eine bekannte Gefäßform', () => {
  for (const r of RESEARCH) assert.ok(['mining', 'metal', 'chem', 'tech'].includes(r.cat), r.id);
});
