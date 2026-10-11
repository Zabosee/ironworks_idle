import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');

for (const dir of ['core', 'systems', 'data']) {
  for (const f of readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js'))) {
    test(`Smoke: js/${dir}/${f} laesst sich ohne DOM importieren`, async () => {
      assert.equal(typeof document, 'undefined');
      assert.equal(typeof window, 'undefined');
      const mod = await import(pathToFileURL(path.join(root, dir, f)).href);
      assert.ok(Object.keys(mod).length > 0, 'Modul exportiert nichts');
    });
  }
}

test('Daten-Konsistenz: Forschung-Voraussetzungen, Generator-req, Shop-Freischaltungen existieren', async () => {
  const { RESEARCH, RESEARCH_MAP } = await import('../js/data/research.js');
  const { GENS } = await import('../js/data/generators.js');
  const { SHOP_MAP, AUTOBUYERS } = await import('../js/data/prestige.js');
  for (const r of RESEARCH) for (const q of r.req || []) assert.ok(RESEARCH_MAP[q], `${r.id} -> ${q}`);
  for (const g of GENS) if (g.req) assert.ok(RESEARCH_MAP[g.req], g.id);
  for (const a of AUTOBUYERS) assert.ok(SHOP_MAP[a.unlock], a.id);
  const { researchDepth } = await import('../js/core/formulas.js');
  for (const r of RESEARCH) assert.ok(Number.isInteger(researchDepth(r.id)), r.id + ' (Zyklus?)');
});
