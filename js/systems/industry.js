// Industrie-Leisten (GAME-DESIGN-2.md 2.3): meldet das Erreichen einer Stufe per Event 'industry' { track, step, mult }
// (step = Nummer der Stufe, 1-basiert). Kein Toast hier: Texte gehören der UI (Muster systems/eras.js, aber ohne t()).
// Die Stufen sind abgeleitet (formulas.industryProgress); hier wird nur der Wechsel erkannt.
import { industryProgress } from '../core/formulas.js';
import { INDUSTRY_TRACKS } from '../data/industry.js';
import { emit } from '../core/events.js';

let acc = 0, last = null;

const snapshot = () => Object.fromEntries(industryProgress().map(p => [p.id, p.reached]));

/** Setzt Zähler und Merker zurück (nach Laden/Import/Neuguss/Gründung): danach kein Event für bereits erreichte Stufen. */
export function reset() { acc = 0; last = snapshot(); }

export function check(dt = 0, force = false) {
  acc += dt;
  if (!force && acc < 0.5) return;
  acc = 0;
  const now = snapshot();
  if (!last) last = now;
  for (const tr of INDUSTRY_TRACKS) {
    // Sprung über mehrere Stufen (z. B. Offline): je Stufe ein Event
    for (let s = (last[tr.id] || 0) + 1; s <= now[tr.id]; s++) emit('industry', { track: tr.id, step: s, mult: tr.steps[s - 1].mult });
    last[tr.id] = Math.max(last[tr.id] || 0, now[tr.id]);
  }
}
