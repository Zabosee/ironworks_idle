// Strukturprüfung des Fortschrittsgraphen: Fixpunkt-Erreichbarkeit aller Forschungen/Boosts/Klick-Upgrades
// (Voraussetzungen UND Kostenressourcen irgendwo produzierbar) und Geometrie der Forschungskarte (Kanten ohne Knotentreffer).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH } from '../js/data/research.js';
import { BOOSTS, CLICKS } from '../js/data/upgrades.js';
import { GENS } from '../js/data/generators.js';
import { RECIPES } from '../js/data/recipes.js';
import { RES_IDS, RES } from '../js/data/resources.js';
import { CORP_SHOP, CORP_MILESTONES } from '../js/data/corp.js';
import { ERAS } from '../js/data/eras.js';
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

describe('Konzern-Inhalte (Ausbau 2)', () => {
  const { R, P } = fixpoint();
  test('Umfang laut Design: 112 Forschungen (36 Konzern), 39 Boosts, 9 Klick-Upgrades, 21 Generatoren, 19 Materialien, 10 Rezepte', () => {
    assert.equal(RESEARCH.length, 112); assert.equal(RESEARCH.filter(r => r.corp).length, 36);
    assert.equal(BOOSTS.length, 39); assert.equal(CLICKS.length, 9); assert.equal(GENS.length, 21);
    assert.equal(RES_IDS.length, 19); assert.equal(RECIPES.length, 10);
  });
  test('corp ist 1..7; eine Forschung ist nie früher freigeschaltet als ihre Voraussetzung (Konzernstufe und Zeitalter)', () => {
    const m = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
    for (const d of [...RESEARCH, ...BOOSTS, ...CLICKS].filter(d => d.corp !== undefined)) {
      assert.ok(Number.isInteger(d.corp) && d.corp >= 1 && d.corp <= 7, d.id);
      assert.ok((d.era ?? 0) < ERAS.length, d.id);
      assert.ok(reqOf(d).length, d.id + ': Konzerninhalt ohne Voraussetzung');
    }
    for (const r of RESEARCH.filter(r => r.corp)) for (const q of reqOf(r)) assert.ok((r.corp ?? 0) >= (m[q].corp ?? 0), `${r.id} (K${r.corp}) vor Eltern ${q} (K${m[q].corp})`);
    for (const d of [...BOOSTS, ...CLICKS].filter(d => d.corp)) for (const q of reqOf(d)) assert.ok(d.corp >= (m[q].corp ?? 0) && (d.era ?? 0) >= (m[q].era ?? 0), d.id + ' vor ' + q);
  });
  test('Fixpunkt mit Konzernstufe 7 / Zeitalter 8: alle Konzern-Inhalte und die 7 neuen Materialien erreichbar', () => {
    for (const r of RESEARCH.filter(r => r.corp)) assert.ok(R.has(r.id), r.id);
    for (const k of ['cobalt', 'molybdenum', 'carbide', 'platinum', 'vanadium', 'iridium', 'superalloy']) assert.ok(P.has(k), k);
  });
  test('Jedes Konzern-Material: Freischalt-Forschung existiert und schaltet auch den Generator frei; img und sym gesetzt', () => {
    for (const k of ['cobalt', 'molybdenum', 'carbide', 'platinum', 'vanadium', 'iridium', 'superalloy']) {
      const req = RES[k].req; assert.ok(req?.length === 1 && RESEARCH.some(r => r.id === req[0] && r.corp), k);
      assert.deepEqual(GENS.find(g => g.res === k).req, req);
      assert.equal(RES[k].img, `assets/icons/res-${k}.svg`); assert.ok(RES[k].sym);
    }
    assert.equal(RES.cobalt.color, '#60a5fa');
  });
  test('Konzern-Meilensteine erreichbar (steigend) und Shop-Summe = Schwelle K7', () => {
    CORP_MILESTONES.forEach((ms, i) => { if (i) assert.ok(ms.at > CORP_MILESTONES[i - 1].at); assert.ok(ms.mult > 1); });
    const sum = CORP_SHOP.reduce((a, it) => a + (it.costs ? it.costs.reduce((x, y) => x + y, 0) : Array.from({ length: it.max }, (_, l) => Math.ceil(it.cost * it.growth ** l)).reduce((x, y) => x + y, 0)), 0);
    assert.equal(sum, CORP_MILESTONES.at(-1).at);
  });
  test('Konzernforschung: Kosten steigen mit der Konzernstufe (größter Posten), Dauer bis ca. 4,5 h', () => {
    const maxCost = r => Math.max(...Object.values(r.cost));
    const minBy = k => Math.min(...RESEARCH.filter(r => r.corp === k).map(maxCost));
    for (let k = 2; k <= 7; k++) assert.ok(minBy(k) > minBy(k - 1), 'Staffelung K' + k);
    for (const r of RESEARCH.filter(r => r.corp)) assert.ok(r.time >= 1000 && r.time <= 17000, r.id);
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
