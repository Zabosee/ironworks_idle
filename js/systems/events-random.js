// Zufallsereignisse im Werk: alle 8 bis 15 min aktive Spielzeit höchstens eines, ignorierbar. Nur Logik; die UI hört auf 'revent'.
// Der Balance-Bot ruft tick() nie auf. Zustand ist flüchtig (nicht im Spielstand), nur die Buffs werden gespeichert.
import { state } from '../core/state.js';
import { rates } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { t, tName, tDesc } from '../core/i18n.js';
import { RES, RES_IDS } from '../data/resources.js';
import { BUFFS } from '../data/golden.js';
import { RANDOM_EVENTS, RANDOM_EVENT_MAP } from '../data/events-random.js';

let rng = Math.random;
let current = null;   // { type, left, res?, need? }
let timer = 0;

/** Zufallsquelle austauschen (Tests); ohne Argument wieder Math.random. */
export const setRandom = fn => { rng = fn || Math.random; };
const rand = (a, b) => a + rng() * (b - a);
const schedule = () => { timer = rand(...RANDOM_EVENTS.interval); };
export const getCurrent = () => current;
export const timeToNext = () => timer;

function end() {
  if (!current) return;
  current = null;
  schedule();
  emit('revent:end');
}

/** (Neu-)Start nach Laden/Import: verwirft ein offenes Ereignis und plant das nächste. */
export function init() {
  if (current) { current = null; emit('revent:end'); }
  schedule();
}

function giveBuff(id) {
  const def = BUFFS[id], b = state.buffs.find(x => x.id === id);
  if (b) b.left = Math.max(b.left, def.duration); else state.buffs.push({ id, left: def.duration });
  emit('buffs');
}

function spawn() {
  const r = rates(), live = RES_IDS.filter(k => r[k] > 0);
  const types = RANDOM_EVENTS.types.filter(e => e.id === 'vein' || live.length);
  const ty = types[Math.min(types.length - 1, Math.floor(rng() * types.length))];
  current = { type: ty.id, left: ty.life };
  if (ty.id !== 'vein') {
    current.res = live[Math.min(live.length - 1, Math.floor(rng() * live.length))];
    if (ty.id === 'shortage') {
      state.buffs = state.buffs.filter(b => b.id !== 'shortage');
      state.buffs.push({ id: 'shortage', left: ty.life, res: current.res });
      emit('buffs');
    } else current.need = Math.max(ty.min, Math.ceil(r[current.res] * ty.seconds));
  }
  emit('revent', { ...current });
}

/** Zeitschritt in Sekunden aktiver Spielzeit. */
export function tick(dt) {
  if (!(dt > 0)) return;
  if (!current) { if ((timer -= dt) <= 0) spawn(); return; }
  if ((current.left -= dt) <= 0) end();
}

/** Klick auf den Hinweis. Gibt true zurück, wenn das Ereignis damit erledigt ist. */
export function respond() {
  if (!current) return false;
  const ty = RANDOM_EVENT_MAP[current.type];
  if (current.type === 'order') {
    if (!(state.res[current.res] >= current.need)) { toast(t('Zu wenig {res} für den Sonderauftrag.', { res: tName('resources', RES[current.res]) }), 'warn'); return false; }
    state.res[current.res] -= current.need;
  }
  if (current.type === 'shortage') { state.buffs = state.buffs.filter(b => b.id !== 'shortage'); emit('buffs'); }
  else giveBuff(ty.buff);
  if (ty.buff) toast(t('{name}: {desc} für {sec} s!', { name: tName('golden', BUFFS[ty.buff]), desc: tDesc('golden', BUFFS[ty.buff]), sec: BUFFS[ty.buff].duration }), 'gold');
  end();
  return true;
}
