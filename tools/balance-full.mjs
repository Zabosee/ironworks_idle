#!/usr/bin/env node
// Voller Kalibrierlauf des kalibrierten Bots (beide Reset-Ebenen) bis "alles freigeschaltet" (GAME-DESIGN.md B6.4).
// Dauer: ca. 10 bis 20 min Rechenzeit (nicht Teil von `node --test`). Gehört nicht in den normalen Testlauf.
//
//   node tools/balance-full.mjs [maxStunden=800] [corpEvery=40] [hold=3600] [workHold=1] [minRun=60] [Name.Pfad=Wert ...]
//
// Spielweisen (Standard = Bot, unverändert): workHold=1 (Werkbank-Erstaufträge schon früh abwarten), minRun=<Sekunden> (kürzester Durchlauf je Neuguss, Standard 300),
// corpEvery=<Stunden> (Gründungstakt), hold=<Sekunden>; auch als Name=Wert statt positionell (maxHours=, corpEvery=, hold=).
// Name.Pfad=Wert (mit Punkt, Großbuchstabe) überschreibt vor dem Lauf Konstanten (siehe balance-sim.mjs, applyOverrides), z. B. CORP.divisor=2500.
// Ausgabe: Bericht aller Zeitstempel und Prüfung gegen den Korridor 504 bis 700 h (Annahme A1). Exitcode 1 außerhalb.
import { simulate, applyOverrides, report } from './balance-sim.mjs';

export const CORRIDOR_H = [504, 700];

const args = process.argv.slice(2), over = args.filter(a => /^[A-Z_]+./.test(a));
const kv = Object.fromEntries(args.filter(a => /^[a-zA-Z]+=/.test(a)).map(a => a.split('=')));
const pos = args.filter(a => !a.includes('='));
applyOverrides(over);
const maxHours = +(kv.maxHours ?? pos[0] ?? 800), corpEvery = +(kv.corpEvery ?? pos[1] ?? 40), hold = +(kv.hold ?? pos[2] ?? 3600), minRun = +(kv.minRun ?? 300), workHold = !!+(kv.workHold ?? 0);
const r = simulate({ hours: maxHours, dt: 30, clicksPerSec: 4, frac: 1, policy: 'rate', corpEvery, hold, minRun, workHold, stopAtDone: true, progressEvery: 25 });
console.log(`balance-full: maxHours=${maxHours} corpEvery=${corpEvery} hold=${hold} minRun=${minRun} workHold=${+workHold} ${over.join(' ')}`);
console.log(report(r));
const all = r.events.all == null ? null : r.events.all / 3600;
const ok = all != null && all >= CORRIDOR_H[0] && all <= CORRIDOR_H[1];   // Obergrenze gilt nur für den Bot; für andere Spielweisen zählt nur >= 504 h (Exitcode dann ignorieren)
console.log(all == null ? `ALLES FREIGESCHALTET: nicht erreicht in ${maxHours} h` : `ALLES FREIGESCHALTET: ${all.toFixed(1)} h, Korridor ${CORRIDOR_H.join(' bis ')} h: ${ok ? 'OK' : 'AUSSERHALB'}`);
process.exit(ok ? 0 : 1);
