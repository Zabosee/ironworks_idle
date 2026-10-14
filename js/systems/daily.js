// Tagesbonus: beim ersten Start an einem neuen lokalen Kalendertag ein garantierter Buff, Serie bis DAILY.maxStreak.
import { state } from '../core/state.js';
import { goldenDuration } from '../core/formulas.js';
import { emit } from '../core/events.js';
import { BUFFS, DAILY } from '../data/golden.js';

const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Gibt { streak, shown, seconds } zurück oder null (heute schon erhalten bzw. Uhr zurückgestellt). */
export function claimDaily(now = new Date()) {
  const today = key(now), { last } = state.daily;
  if (last > key(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))) {   // mehr als 1 Tag in der Zukunft (Uhr war vorgestellt): Serie neu, kein Bonus
    state.daily.last = today; state.daily.streak = 1;
    return null;
  }
  if (last && today <= last) return null;   // gleicher Tag oder Uhr zurückgestellt: nichts, last bleibt
  const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  state.daily.streak = last === yesterday ? state.daily.streak + 1 : 1;
  state.daily.last = today;
  const shown = Math.min(state.daily.streak, DAILY.maxStreak);
  const def = BUFFS[DAILY.buff];
  const seconds = def.duration * goldenDuration() * (1 + DAILY.perStreak * (shown - 1));
  const existing = state.buffs.find(b => b.id === def.id);
  if (existing) existing.left = Math.max(existing.left, seconds); else state.buffs.push({ id: def.id, left: seconds });
  emit('buffs');
  return { streak: state.daily.streak, shown, seconds };
}
