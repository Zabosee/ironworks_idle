import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sprite = readFileSync(new URL('../assets/sprites/items.svg', import.meta.url), 'utf8');
const ids = new Set([...sprite.matchAll(/<symbol id="sym-([\w-]+)"/g)].map(m => m[1]));

test('Symbole: jede sym-ID aus den Daten existiert in items.svg', async () => {
  const { CLICKS, BOOSTS } = await import('../js/data/upgrades.js');
  const { SHOP, PRESTIGE } = await import('../js/data/prestige.js');
  const { ACHIEVEMENTS } = await import('../js/data/achievements.js');
  const { BUFFS } = await import('../js/data/golden.js');
  const all = [...CLICKS, ...BOOSTS, ...SHOP, PRESTIGE, ...ACHIEVEMENTS, ...Object.values(BUFFS)];
  assert.ok(all.length > 60);
  for (const d of all) {
    assert.ok(d.sym, 'sym fehlt: ' + (d.id || d.name));
    assert.ok(ids.has(d.sym), `sym "${d.sym}" (${d.id || d.name}) fehlt in items.svg`);
  }
});
