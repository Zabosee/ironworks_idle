// Goldene Zufalls-Events mit Zeitbuff. Hält nur Logik; die UI zeigt das Ereignis an.
import { state, addResource } from '../core/state.js';
import { rates, goldenFreq, goldenDuration } from '../core/formulas.js';
import { emit, toast } from '../core/events.js';
import { GOLDEN, BUFFS, GOLDEN_EVENTS } from '../data/golden.js';

let current = null;   // { id, left, x, y } (x/y in Prozent der Spielfläche)
let timer = 0;
let seq = 0;

const rand = (a, b) => a + Math.random() * (b - a);
const schedule = first => { const [a, b] = first ? GOLDEN.firstDelay : GOLDEN.interval; timer = rand(a, b) / goldenFreq(); };

/** (Neu-)Start: verwirft einen offenen Barren (UI bekommt golden:expire) und plant das erste Event neu. */
export function init() {
  if (current) { const id = current.id; current = null; emit('golden:expire', { id }); }
  schedule(true);
}
export const getCurrent = () => current;

function spawn() {
  current = { id: ++seq, left: GOLDEN.lifetime, x: rand(8, 82), y: rand(14, 78) };
  emit('golden:spawn', { ...current });
}

export function tick(dt) {
  if (current) {
    current.left -= dt;
    if (current.left <= 0) { const id = current.id; current = null; schedule(false); emit('golden:expire', { id }); }
    return;
  }
  timer -= dt;
  if (timer <= 0) spawn();
}

function pick() {
  const total = GOLDEN_EVENTS.reduce((a, e) => a + e.weight, 0);
  let x = Math.random() * total;
  for (const e of GOLDEN_EVENTS) { if ((x -= e.weight) < 0) return e; }
  return GOLDEN_EVENTS[0];
}

/** Löst den aktuellen goldenen Barren ein. Gibt true zurück, wenn einer da war. */
export function claim() {
  if (!current) return false;
  const id = current.id;
  current = null;
  schedule(false);
  state.stats.golden++;
  const ev = pick();
  if (ev.type === 'buff') {
    const def = BUFFS[ev.buff];
    const dur = def.duration * goldenDuration();
    const existing = state.buffs.find(b => b.id === def.id);
    if (existing) existing.left = Math.max(existing.left, dur); else state.buffs.push({ id: def.id, left: dur });
    toast(`${def.name}: ${def.desc} für ${Math.round(dur)} s!`, 'gold');
    emit('buffs');
  } else {
    const r = rates();
    const gain = Math.max(Math.min(state.res.ore * 0.15, r.ore * 900), r.ore * 60) + 50;
    addResource('ore', gain);
    emit('toast', { msg: 'Glückstreffer!', kind: 'gold' });
    emit('golden:lucky', { gain });
  }
  emit('golden:claim', { id, type: ev.type });
  return true;
}
