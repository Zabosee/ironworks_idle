// Achievement-Prüfung (zeitgesteuert, ca. 2x pro Sekunde).
import { state } from '../core/state.js';
import { emit, toast } from '../core/events.js';
import { ACHIEVEMENTS } from '../data/achievements.js';

let acc = 0;

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
    toast(`Erfolg: ${a.name} (+${(a.bonus * 100).toFixed(1).replace('.0', '')} % Produktion)`, 'gold');
  }
}
