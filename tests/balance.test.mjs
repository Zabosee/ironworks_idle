// Balance-Simulation der Prestige-Schleife (tools/balance-sim.mjs): echte Module, gieriger Bot.
// Prüft, dass alle Meilensteine gestaffelt erreichbar sind und der Shop bezahlbar bleibt.
// Gemessene Werte (Schritt 6, dt 30 bzw. 8, Bot 'rate'): ohne Konzern 1. Neuguss 1,6 h, Zeitalter 1/2/3/4/5 bei 6,8/36/69/99/153 h, Hochofen-Meilenstein 10.000 bei 4,1 h, 250.000 bei 33,8 h;
// mit Konzern (Schritt 13, hold 3600) Zeitalter 2/3/4/5 bei 54/101/119/137 h. Die Schranken lassen ca. 25 % Puffer. Der volle A1-Lauf (bis 'alles freigeschaltet', Bot 602 h) und die Spielweisen-Matrix liegen in tools/balance-full.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/balance-sim.mjs';
import { MILESTONES, SHOP } from '../js/data/prestige.js';
import { ERAS } from '../js/data/eras.js';
import { CORP } from '../js/data/corp.js';

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

  test('erster Neuguss mit sinnvollem Gewinn (>= 10 Gussformen) nach 45 bis 90 min aktiver Spielzeit', () => {
    // Gemessen (dt 8): +1 Gussform bei 44 min, +10 bei 46 min, +25 bei 52 min. Der 'rate'-Bot wartet länger (1,7 h), ein Spieler gießt hier bereits.
    const first = simulate({ hours: 2, dt: 8, policy: 'frac', frac: 0, corp: false, minGain: 10 }).prestiges[0];
    assert.ok(first.t >= 45 * 60 && first.t <= 90 * 60, `erster Neuguss bei ${(first.t / 60).toFixed(1)} min`);
    assert.ok(first.gain >= 10);
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
  // Lange Simulation (bis Zeitalter 5, max. 14 Tage aktive Spielzeit, dt=30, ca. 1 Minute Rechenzeit)
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

  test('Zeitalter 2-5 liegen in ihren Zeitfenstern (Industrie-Boni D7 eingerechnet), jeder Schritt dauert viele Stunden', () => {
    // Stunden aktiver Spielzeit, gemessen 36 / 59 / 132 / 155. Zeitalter 4 kam vor 2026-10 bei 98 h; seit den gesenkten Ausbau-Schwellen (EVO_AT)
    // kauft der Auto-Buyer Ausbau IV ab Generatorstufe 45 (Kosten x400) und bremst ohne Konzern bis Zeitalter 4. Mit Konzern nur +7 h (127 -> 135 h), GAME-DESIGN.md B8.
    const window = { 2: [25, 48], 3: [50, 90], 4: [75, 140], 5: [110, 190] };
    for (const i of [2, 3, 4, 5]) {
      assert.ok(eras.eraTimes[i] !== undefined, `Zeitalter ${i} in 14 Tagen nicht erreicht`);
      assert.ok(hours(i) >= window[i][0] && hours(i) <= window[i][1], `Zeitalter ${i} bei ${hours(i).toFixed(1)} h, erwartet ${window[i].join(' bis ')} h`);
      assert.ok(hours(i) - hours(i - 1) >= 15, `Zeitalter ${i} nur ${(hours(i) - hours(i - 1)).toFixed(1)} h nach Zeitalter ${i - 1}`);
    }
  });
});

describe('Balance: Konzern-Schleife (2. Reset-Ebene)', () => {
  // 100 h aktive Spielzeit mit Konzerngründung (1. Gründung bei 34 h, danach alle 40 h), dt=30, ca. 1 Minute Rechenzeit.
  // Gemessen (Schritt 13, D = 1500, CAP 0,68/h): Konzern-Reiter 13,4 h, K1 34 h (+12 Patente), 2. Gründung 74 h (+14), K2 erst bei 114 h, Kobalt 36 h, Molybdän 49 h, Hartmetall 118 h.
  const run = simulate({ hours: 100, dt: 30, policy: 'rate', frac: 1, hold: 3600 });
  const h = s => s / H, e = run.events;

  test('Konzern-Reiter ab 13,4 h (100 Neugüsse), 1. Gründung nicht vor 34 h, K1 mit der 1. Gründung, K2 nicht vor 100 h', () => {
    assert.ok(h(e.corpUnlock) >= 10.4 && h(e.corpUnlock) <= 16.4, `Konzern-Reiter bei ${h(e.corpUnlock).toFixed(1)} h`);
    assert.ok(h(e.firstCorp) >= 34 && h(e.firstCorp) <= 40, `1. Gründung bei ${h(e.firstCorp).toFixed(1)} h`);
    assert.ok(e.stage[1] !== undefined && h(e.stage[1]) <= 40, 'K1 bis 40 h');
    assert.equal(e.stage[2], undefined, 'K2 nicht vor 100 h (K1 und K2 fallen nie zusammen)');
  });

  test('Kobalt/Molybdän kommen nach K1 (30 bis 65 h), Hartmetall (K2) und Platin noch nicht', () => {
    for (const k of ['cobalt', 'molybdenum']) assert.ok(h(e.mat[k]) >= 30 && h(e.mat[k]) <= 65, `${k} bei ${h(e.mat[k]).toFixed(1)} h`);
    assert.equal(e.mat.carbide, undefined);
    assert.equal(e.mat.platinum, undefined);
  });

  test('Gründungen: jede bringt mindestens 1 Patent, die erste 10 bis 14 (sqrt(Gussformen / D), Zeitdeckel 0,68/h)', () => {
    assert.ok(run.foundings.length >= 2);
    for (const f of run.foundings) assert.ok(f.gain >= 1);
    assert.ok(run.foundings[0].gain >= 10 && run.foundings[0].gain <= 14, `1. Gründung +${run.foundings[0].gain}`);
    for (const f of run.foundings.slice(1)) assert.ok(f.gain <= Math.floor(CORP.capPerHour * 40) + 1, `+${f.gain} bei 40 h Abstand über dem Deckel`);
  });
});
