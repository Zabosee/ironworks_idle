// Balance-Simulation der Prestige-Schleife (tools/balance-sim.mjs): echte Module, gieriger Bot.
// Prüft, dass alle Meilensteine gestaffelt erreichbar sind und der Shop bezahlbar bleibt.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/balance-sim.mjs';
import { MILESTONES, SHOP } from '../js/data/prestige.js';
import { ERAS } from '../js/data/eras.js';

const H = 3600;
const at = (r, n) => r.milestones[n];

describe('Balance: Hochofen-Schleife', () => {
  // "Aktiv": Neuguss, sobald der Gewinnzuwachs abflacht. 6 h simulierte Spielzeit (ca. 5 s Rechenzeit).
  const active = simulate({ hours: 6, dt: 8, policy: 'rate', frac: 1, corp: false });

  test('erster Meilenstein nach 1-2 Neugüssen, nach spätestens 3 h', () => {
    assert.ok(at(active, MILESTONES[0].at), 'Meilenstein 1 nicht erreicht');
    assert.ok(at(active, MILESTONES[0].at).count <= 2);
    assert.ok(at(active, MILESTONES[0].at).t < 3 * H);
  });

  test('alle Meilensteine bis auf den letzten werden gestaffelt in wenigen Stunden erreicht', () => {
    let last = 0;
    for (const m of MILESTONES.slice(0, -1)) {
      const r = at(active, m.at);
      assert.ok(r, `Meilenstein ${m.at} nicht erreicht`);
      assert.ok(r.t >= last, 'Reihenfolge');
      last = r.t;
    }
    assert.ok(at(active, MILESTONES[MILESTONES.length - 2].at).t > 2 * H, 'vorletzter Meilenstein nicht zu früh');
    assert.ok(last < 6 * H);
  });

  test('letzter Meilenstein (Langzeitziel) ist erreichbar: Hochrechnung der stetigen Neuguss-Rate unter 2 Tagen', () => {
    const top = MILESTONES[MILESTONES.length - 1].at;
    const ps = active.prestiges, a = ps[ps.length - 21], b = ps[ps.length - 1];
    const rate = (b.total - a.total) / (b.t - a.t);   // Gussformen je Sekunde im eingeschwungenen Zustand
    const eta = b.t + Math.max(0, top - b.total) / rate;
    assert.ok(rate > 0);
    assert.ok(eta > 12 * H, `zu früh (${(eta / H).toFixed(1)} h)`);
    assert.ok(eta < 48 * H, `zu spät (${(eta / H).toFixed(1)} h)`);
  });

  test('gelegentlicher Spieler (Neuguss bei Gewinn >= 10 % des Bestands) erreicht die ersten fünf Meilensteine', () => {
    const casual = simulate({ hours: 10, dt: 8, policy: 'frac', frac: 0.1, corp: false });
    for (const m of MILESTONES.slice(0, -1)) assert.ok(at(casual, m.at), `Meilenstein ${m.at} nicht erreicht`);
    assert.ok(at(casual, MILESTONES[0].at).count <= 2);
  });

  test('jeder Shop-Eintrag ist bis zur Maximalstufe bezahlbar (aktiver Spieler, 6 h)', () => {
    for (const s of SHOP) assert.equal(active.shop[s.id], s.max, `${s.id}: ${active.shop[s.id]}/${s.max}`);
  });
});

describe('Balance: Zeitalter-Progression', () => {
  // Lange Simulation (bis Zeitalter 5, max. 14 Tage aktive Spielzeit, dt=30, ca. 2 Minuten Rechenzeit)
  const eras = simulate({ hours: 336, dt: 30, policy: 'rate', frac: 1, stopAtEra: 5, corp: false });
  const hours = i => eras.eraTimes[i] / H;

  test('Zeitalter 1 kommt erst nach dem 1. Neuguss und mehrere Stunden danach (2..8 h)', () => {
    assert.ok(eras.eraTimes[1] !== undefined, 'Zeitalter 1 nicht erreicht');
    const first = eras.prestiges[0].t;
    assert.ok(eras.eraTimes[1] > first, 'Zeitalter 1 vor dem 1. Neuguss');
    const after = eras.eraTimes[1] - first;
    assert.ok(after >= 2 * H && after <= 8 * H, `Zeitalter 1 ${(after / H).toFixed(2)} h nach dem 1. Neuguss`);
  });

  test('Zeitalter-Zeiten steigen streng monoton, ohne ein Zeitalter zu überspringen', () => {
    for (let i = 1; i < ERAS.length; i++) {
      if (eras.eraTimes[i] === undefined) continue;
      assert.ok(i === 1 || eras.eraTimes[i - 1] !== undefined, `Zeitalter ${i} erreicht, ${i - 1} nicht`);
      if (i > 1) assert.ok(eras.eraTimes[i] > eras.eraTimes[i - 1], `Zeitalter ${i} nicht später als ${i - 1}`);
    }
  });

  test('Kein Zeitalter vor dem 1. Neuguss', () => {
    for (let i = 1; i < ERAS.length; i++) {
      if (eras.eraTimes[i] !== undefined) assert.ok(eras.eraTimes[i] > eras.prestiges[0].t, `Zeitalter ${i} zu früh`);
    }
  });

  test('Zeitalter 2-5 sind in endlicher Zeit erreichbar (obere Schranke je Zeitalter), jeder Schritt dauert mehrere Stunden', () => {
    const upper = { 2: 100, 3: 180, 4: 240, 5: 336 };   // Stunden aktiver Spielzeit
    for (const i of [2, 3, 4, 5]) {
      assert.ok(eras.eraTimes[i] !== undefined, `Zeitalter ${i} in 14 Tagen nicht erreicht`);
      assert.ok(hours(i) <= upper[i], `Zeitalter ${i} erst nach ${hours(i).toFixed(1)} h`);
      assert.ok(hours(i) - hours(i - 1) >= 3, `Zeitalter ${i} nur ${(hours(i) - hours(i - 1)).toFixed(1)} h nach Zeitalter ${i - 1}`);
    }
  });

  test('Zeitalter 2, 3 und 5 werden nicht innerhalb der ersten 12 h erreicht', () => {
    for (const i of [2, 3, 5]) assert.ok(hours(i) > 12, `Zeitalter ${i} schon nach ${hours(i).toFixed(1)} h`);
  });
});
