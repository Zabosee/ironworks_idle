// Herausforderungen: Variante "Modifikatoren im laufenden Durchlauf mit Zeitlimit" (kein Snapshot, kein Reset, nichts kann den Spielstand beschädigen).
// Abbruch und Scheitern kosten nichts; jede neu geschaffte Stufe gibt dauerhaften Bonus (wirkt über formulas.challengeMult). Ein Start versucht immer
// die nächste Stufe; auf der Höchststufe wird sie ohne Belohnung wiederholt.
// Offline-Stahl zählt nicht (save.applyOffline hebt a.base an); Neuguss und Konzerngründung brechen ab (prestige.resetRun).
import { state } from '../core/state.js';
import { rates } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { t, tName } from '../core/i18n.js';
import { fmt } from '../core/format.js';
import { CHALLENGE_MAP, CHALLENGE_BONUS, CHALLENGE_LEVEL_BONUS, CHALLENGE_MIN_RUN, CHALLENGE_MAX_LEVEL, challengeGoalMult } from '../data/challenges.js';

export const available = () => state.prestige.count >= 1;
/** Sekunden Durchlaufzeit, die bis zur Startfreigabe fehlen (direkt nach dem Neuguss ist die Rate noch ~0, das Ziel wäre sinnlos klein). */
export const startIn = () => Math.max(0, Math.ceil(CHALLENGE_MIN_RUN - state.stats.runTime));
/** Bisher produzierter Stahl seit dem Start der laufenden Herausforderung. */
/** Höchste geschaffte Stufe (0 = nie geschafft) und die Stufe, die ein Start versucht. */
export const levelOf = id => state.challenges.done[id] || 0;
export const nextLevel = id => Math.min(levelOf(id) + 1, CHALLENGE_MAX_LEVEL);
export const progress = () => { const a = state.challenges.active; return a ? Math.max(0, state.stats.total.steel - a.base) : 0; };

/** Stahlrate ohne Buffs (Goldene Barren, Tagesbonus, Zufallsereignisse sollen das Ziel nicht verändern). */
function steelRateNoBuffs() {
  const b = state.buffs;
  state.buffs = [];
  try { return rates().steel; } finally { state.buffs = b; }
}

export function start(id) {
  const def = CHALLENGE_MAP[id], c = state.challenges;
  if (!def || c.active || !available() || startIn() > 0) return false;
  const level = nextLevel(id);
  const goal = Math.ceil(Math.max(def.floor, steelRateNoBuffs() * def.time * def.k) * challengeGoalMult(level));
  c.active = { id, level, left: def.time, goal, base: state.stats.total.steel, gen: '' };
  emit('challenge');
  toast(t('Herausforderung gestartet: {name}', { name: tName('challenges', def) }), 'info');
  return true;
}

export function abort() {
  if (!state.challenges.active) return false;
  state.challenges.active = null;
  emit('challenge');
  return true;
}

/** Zeitschritt aktiver Spielzeit: prüft Ziel und Frist. */
export function tick(dt) {
  const a = state.challenges.active;
  if (!a || !(dt > 0)) return;
  a.left -= dt;
  const def = CHALLENGE_MAP[a.id];
  if (progress() >= a.goal) {
    const level = a.level || 1, fresh = level > levelOf(a.id);
    if (fresh) state.challenges.done[a.id] = level;
    state.challenges.active = null;
    emit('challenge', { done: a.id, level });
    const pct = Math.round((level === 1 ? CHALLENGE_BONUS : CHALLENGE_LEVEL_BONUS) * 100);
    toast(fresh ? t('Herausforderung geschafft: {name}, Stufe {level}! Dauerhaft +{pct} % Produktion.', { name: tName('challenges', def), level, pct }) : t('Herausforderung wiederholt: {name}.', { name: tName('challenges', def) }), 'gold');
  } else if (a.left <= 0) {
    const got = progress();
    state.challenges.active = null;
    emit('challenge', { failed: a.id });
    toast(t('Herausforderung gescheitert: {name} ({got} von {goal} Stahl). Kein Verlust.', { name: tName('challenges', def), got: fmt(got), goal: fmt(a.goal) }), 'warn');
  }
}
