// Balance-Simulation der Prestige-Schleife (tools/balance-sim.mjs): echte Module, gieriger Bot.
// Prüft, dass alle Meilensteine gestaffelt erreichbar sind und der Shop bezahlbar bleibt.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/balance-sim.mjs';
import { MILESTONES, SHOP } from '../js/data/prestige.js';

const H = 3600;
const at = (r, n) => r.milestones[n];

describe('Balance: Hochofen-Schleife', () => {
  // "Aktiv": Neuguss, sobald der Gewinnzuwachs abflacht. 6 h simulierte Spielzeit (ca. 5 s Rechenzeit).
  const active = simulate({ hours: 6, dt: 8, policy: 'rate', frac: 1 });

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
    const casual = simulate({ hours: 10, dt: 8, policy: 'frac', frac: 0.1 });
    for (const m of MILESTONES.slice(0, -1)) assert.ok(at(casual, m.at), `Meilenstein ${m.at} nicht erreicht`);
    assert.ok(at(casual, MILESTONES[0].at).count <= 2);
  });

  test('jeder Shop-Eintrag ist bis zur Maximalstufe bezahlbar (aktiver Spieler, 6 h)', () => {
    for (const s of SHOP) assert.equal(active.shop[s.id], s.max, `${s.id}: ${active.shop[s.id]}/${s.max}`);
  });
});
