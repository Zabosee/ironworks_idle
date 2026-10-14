import test from 'node:test';
import assert from 'node:assert';
import { RESEARCH } from '../js/data/research.js';
import { RESEARCH_COORDS, MIN_NODE_DISTANCE } from '../js/data/research-layout.js';

test('Research Layout', async t => {
  await t.test('alle Forschungs-IDs haben Koordinaten', () => {
    for (const r of RESEARCH) {
      assert(r.id in RESEARCH_COORDS, `${r.id} hat keine Koordinaten`);
      const coord = RESEARCH_COORDS[r.id];
      assert(typeof coord.x === 'number', `${r.id}: x ist keine Zahl`);
      assert(typeof coord.y === 'number', `${r.id}: y ist keine Zahl`);
      assert(Number.isFinite(coord.x), `${r.id}: x ist nicht endlich`);
      assert(Number.isFinite(coord.y), `${r.id}: y ist nicht endlich`);
    }
  });

  await t.test('geology liegt im Ursprung (0,0)', () => {
    const geologyCoord = RESEARCH_COORDS['geology'];
    assert.strictEqual(geologyCoord.x, 0, 'geology x sollte 0 sein');
    assert.strictEqual(geologyCoord.y, 0, 'geology y sollte 0 sein');
  });

  await t.test('alle Knoten haben Mindestabstand', () => {
    const coords = Object.entries(RESEARCH_COORDS);
    // Berechne durchschnittliche und minimale Abstände
    let minDistance = Infinity;
    let violations = [];

    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dx = coords[i][1].x - coords[j][1].x;
        const dy = coords[i][1].y - coords[j][1].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        minDistance = Math.min(minDistance, distance);

                if (distance < MIN_NODE_DISTANCE) {
          violations.push({ i, j, distance });
        }
      }
    }

    assert(violations.length === 0,
      `${violations.length} Verletzung(en). Min-Abstand: ${minDistance.toFixed(1)}, erlaubt: ${MIN_NODE_DISTANCE}. Violations: ${JSON.stringify(violations.slice(0, 3))}`);
  });

  await t.test('Knoten in alle vier Quadranten verteilt', () => {
    let hasNW = false, hasNE = false, hasSW = false, hasSE = false;

    for (const r of RESEARCH) {
      if (r.id === 'geology') continue; // Skip center
      const coord = RESEARCH_COORDS[r.id];

      if (coord.x < 0 && coord.y < 0) hasNW = true;
      if (coord.x >= 0 && coord.y < 0) hasNE = true;
      if (coord.x < 0 && coord.y >= 0) hasSW = true;
      if (coord.x >= 0 && coord.y >= 0) hasSE = true;
    }

    assert(hasNW && hasNE && hasSW && hasSE, 'Nicht alle vier Quadranten haben Knoten');
  });

  await t.test('Kanten (req) sind kurz: max. 600 px (1.5x skaliert), Eltern liegen nah am Kind', () => {
    for (const r of RESEARCH) for (const q of r.req || []) {
      const a = RESEARCH_COORDS[r.id], b = RESEARCH_COORDS[q];
      assert(Math.hypot(a.x - b.x, a.y - b.y) <= 600, `Kante ${q} -> ${r.id} zu lang`);
    }
  });

  await t.test('Anzahl der Koordinaten entspricht Anzahl der Forschungen', () => {
    const coordCount = Object.keys(RESEARCH_COORDS).length;
    assert.strictEqual(coordCount, RESEARCH.length, `${coordCount} Koordinaten aber ${RESEARCH.length} Forschungen`);
  });

  await t.test('alle 125 Forschungen sind vorhanden (76 + 49 Konzernforschung)', () => {
    const expectedCount = 125;
    assert.strictEqual(RESEARCH.length, expectedCount, `sollte ${expectedCount} Forschungen haben, hat ${RESEARCH.length}`);
  });
});
