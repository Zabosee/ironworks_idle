// Strukturprüfung des Fortschrittsgraphen: Fixpunkt-Erreichbarkeit aller Forschungen/Boosts/Klick-Upgrades
// (Voraussetzungen UND Kostenressourcen irgendwo produzierbar) und Geometrie der Forschungskarte (Kanten ohne Knotentreffer).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { GENS } from '../js/data/generators.js';
import { RECIPES } from '../js/data/recipes.js';
import { RES_IDS } from '../js/data/resources.js';
import { RESEARCH_COORDS, MIN_NODE_DISTANCE } from '../js/data/research-layout.js';

const reqOf = d => (Array.isArray(d.req) ? d.req : d.req ? [d.req] : []);
const costKeys = d => (d.cost ? Object.keys(d.cost) : (d.costs || []).map(c => c.res));

/** Fixpunkt: Forschungsmenge R und produzierbare Ressourcen P wachsen gegenseitig, bis nichts mehr dazukommt. */
function fixpoint() {
  const R = new Set(), P = new Set(['ore']);
  for (let changed = true; changed;) {
    changed = false;
    for (const g of GENS) if (reqOf(g).every(q => R.has(q)) && Object.keys(g.cost).every(k => P.has(k)) && !P.has(g.res)) { P.add(g.res); changed = true; }
    for (const rc of RECIPES) if (reqOf(rc).every(q => R.has(q)) && Object.keys(rc.inputs).every(k => P.has(k))) for (const k in rc.outputs) if (!P.has(k)) { P.add(k); changed = true; }
    for (const r of RESEARCH) if (!R.has(r.id) && reqOf(r).every(q => R.has(q)) && costKeys(r).every(k => P.has(k))) { R.add(r.id); changed = true; }
  }
  return { R, P };
}

describe('Fortschrittsgraph: Erreichbarkeit', () => {
  const { R, P } = fixpoint();
  test('alle Forschungen sind über req + produzierbare Kostenressourcen erreichbar', () => {
    assert.deepEqual(RESEARCH.filter(r => !R.has(r.id)).map(r => r.id), []);
  });
  test('alle Ressourcen sind produzierbar', () => {
    assert.deepEqual(RES_IDS.filter(k => !P.has(k)), []);
  });
  test('req-Verweise zeigen auf existierende Forschungen, keine Selbst-/Zirkelbezüge (Fixpunkt terminiert mit allen)', () => {
    const ids = new Set(RESEARCH.map(r => r.id));
    for (const d of [...RESEARCH, ...BOOSTS, ...CLICKS, ...GENS, ...RECIPES]) for (const q of reqOf(d)) assert.ok(ids.has(q), `${d.id}: unbekanntes req ${q}`);
  });
  test('Boosts, Klick-Upgrades und Generatoren: Voraussetzungen erreichbar, Kostenressourcen produzierbar', () => {
    for (const d of [...BOOSTS, ...CLICKS, ...GENS]) {
      assert.ok(reqOf(d).every(q => R.has(q)), `${d.id}: req nicht erreichbar`);
      assert.ok(costKeys(d).every(k => P.has(k)), `${d.id}: Kostenressource nicht produzierbar`);
    }
  });
  test('Zeitalter-Tor eines Kindes ist nie niedriger als das des Elternteils', () => {
    const m = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
    for (const r of RESEARCH) for (const q of reqOf(r)) assert.ok((r.era ?? 0) >= (m[q].era ?? 0), `${r.id} (era ${r.era}) < Eltern ${q} (era ${m[q].era})`);
  });
  test('Kosten sind endlich, positiv und Zeiten > 0', () => {
    for (const r of RESEARCH) {
      assert.ok(r.time > 0, r.id);
      for (const [k, v] of Object.entries(r.cost)) assert.ok(Number.isFinite(v) && v > 0, `${r.id}.${k}`);
    }
  });
});

describe('Forschungskarte: Geometrie', () => {
  const dist = (p, a, b) => {   // Abstand Punkt p zur Strecke a-b
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const u = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
  };
  test('keine Kante läuft durch einen fremden Knoten', () => {
    const bad = [];
    for (const r of RESEARCH) for (const q of reqOf(r)) for (const o of RESEARCH) {
      if (o.id === r.id || o.id === q) continue;
      const d = dist(RESEARCH_COORDS[o.id], RESEARCH_COORDS[q], RESEARCH_COORDS[r.id]);
      if (d < MIN_NODE_DISTANCE * 0.3) bad.push(`${q}->${r.id} trifft ${o.id} (${d.toFixed(0)} px)`);
    }
    assert.deepEqual(bad, []);
  });
  test('keine Koordinaten für unbekannte Forschungen und keine doppelten Positionen', () => {
    const ids = new Set(RESEARCH.map(r => r.id));
    for (const k of Object.keys(RESEARCH_COORDS)) assert.ok(ids.has(k), `Koordinate ohne Forschung: ${k}`);
    const seen = new Set();
    for (const c of Object.values(RESEARCH_COORDS)) { const key = c.x + ',' + c.y; assert.ok(!seen.has(key), 'doppelt ' + key); seen.add(key); }
  });
});
