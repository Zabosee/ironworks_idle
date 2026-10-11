// Zeitalter-Prüfung (ca. 2x pro Sekunde): meldet den Aufstieg per Event 'era' und Toast.
// Das Zeitalter selbst ist abgeleitet (formulas.eraIndex), hier wird nur der Wechsel erkannt.
import { eraIndex, eraDef } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';

let acc = 0, last = -1;

/** Setzt Zähler und Merker zurück (nach Laden/Import/Neuguss): danach kein Toast für bereits erreichte Zeitalter. */
export function reset() { acc = 0; last = eraIndex(); }

export function check(dt = 0, force = false) {
  acc += dt;
  if (!force && acc < 0.5) return;
  acc = 0;
  const now = eraIndex();
  if (last < 0) last = now;
  // Bei einem Sprung über mehrere Zeitalter (z. B. Offline) je ein Toast
  for (let i = last + 1; i <= now; i++) {
    emit('era', { index: i, era: eraDef(i) });
    toast(`Neues Zeitalter: ${eraDef(i).name}! Produktion ×${String(eraDef(i).mult).replace('.', ',')}`, 'gold');
  }
  last = Math.max(last, now);
}
