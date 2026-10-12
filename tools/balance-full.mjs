#!/usr/bin/env node
// Voller Kalibrierlauf des kalibrierten Bots (beide Reset-Ebenen) bis "alles freigeschaltet" (GAME-DESIGN-2.md 6.4, Entscheidung D2).
// Dauer: ca. 10 bis 20 min Rechenzeit (nicht Teil von `node --test`). Gehört nicht in den normalen Testlauf.
//
//   node tools/balance-full.mjs [maxStunden=800] [corpEvery=40] [hold=3600] [Name=Wert ...]
//
// Name=Wert überschreibt vor dem Lauf Konstanten (siehe balance-sim.mjs, applyOverrides), z. B. CORP.divisor=40000.
// Ausgabe: Bericht aller Zeitstempel und Prüfung gegen den Korridor 504 bis 700 h (Annahme A1). Exitcode 1 außerhalb.
import { simulate, applyOverrides, report } from './balance-sim.mjs';

export const CORRIDOR_H = [504, 700];

const args = process.argv.slice(2), over = args.filter(a => a.includes('=')), pos = args.filter(a => !a.includes('='));
applyOverrides(over);
const [maxHours = 800, corpEvery = 40, hold = 3600] = pos;
const r = simulate({ hours: +maxHours, dt: 30, clicksPerSec: 4, frac: 1, policy: 'rate', corpEvery: +corpEvery, hold: +hold, stopAtDone: true, progressEvery: 25 });
console.log(`balance-full: maxHours=${maxHours} corpEvery=${corpEvery} hold=${hold} ${over.join(' ')}`);
console.log(report(r));
const all = r.events.all == null ? null : r.events.all / 3600;
const ok = all != null && all >= CORRIDOR_H[0] && all <= CORRIDOR_H[1];
console.log(all == null ? `ALLES FREIGESCHALTET: nicht erreicht in ${maxHours} h` : `ALLES FREIGESCHALTET: ${all.toFixed(1)} h, Korridor ${CORRIDOR_H.join(' bis ')} h: ${ok ? 'OK' : 'AUSSERHALB'}`);
process.exit(ok ? 0 : 1);
