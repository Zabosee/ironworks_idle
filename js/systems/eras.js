// Zeitalter-Prüfung (ca. 2x pro Sekunde): meldet den Aufstieg per Event 'era' und Toast.
// Das Zeitalter selbst ist abgeleitet (formulas.eraIndex), hier wird nur der Wechsel erkannt.
import { eraIndex, eraDef, industryUnlocked } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { t, tName } from '../core/i18n.js';
import { decimal } from '../core/format.js';

let acc = 0, last = -1, unlocked = false;

/** Setzt Zähler und Merker zurück (nach Laden/Import/Neuguss): danach kein Toast für bereits erreichte Zeitalter. */
export function reset() { acc = 0; last = eraIndex(); unlocked = industryUnlocked(); }

export function check(dt = 0, force = false) {
  acc += dt;
  if (!force && acc < 0.5) return;
  acc = 0;
  const now = eraIndex();
  if (last < 0) last = now;
  // Erster Neuguss schaltet die Zeitalter frei: bereits erzielte Zeitalter still übernehmen (keine Toast-Flut)
  if (!unlocked && industryUnlocked()) { unlocked = true; last = now; return; }
  // Bei einem Sprung über mehrere Zeitalter (z. B. Offline) je ein Toast
  for (let i = last + 1; i <= now; i++) {
    emit('era', { index: i, era: eraDef(i) });
    toast(t('Neues Zeitalter: {name}! Produktion ×{mult}', { name: tName('eras', eraDef(i)), mult: decimal(eraDef(i).mult) }), 'gold');
  }
  last = Math.max(last, now);
}
