// Achievement-Prüfung (zeitgesteuert, ca. 2x pro Sekunde).
import { state } from '../core/state.js';
import { emit, toast } from '../core/events.js';
import { t, tName } from '../core/i18n.js';
import { decimal } from '../core/format.js';
import { ACHIEVEMENTS } from '../data/achievements.js';

let acc = 0;

/** Setzt den Prüf-Zähler zurück (nach Laden/Neuguss). */
export function reset() { acc = 0; }

export function check(dt = 0, force = false) {
  acc += dt;
  if (!force && acc < 0.5) return;
  acc = 0;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.check(state); } catch { ok = false; }
    if (!ok) continue;
    state.achievements[a.id] = Date.now();
    emit('achievement', a);
    toast(t('Erfolg: {name} (+{bonus} % Produktion)', { name: tName('achievements', a), bonus: decimal((a.bonus * 100).toFixed(1).replace('.0', '')) }), 'gold');
  }
}
