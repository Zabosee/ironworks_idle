// Soundeffekte per WebAudio (synthetisch, keine Audiodateien). Hängt sich an vorhandene Events; Einstellung state.settings.sound/volume.
import { state } from '../core/state.js';
import { on } from '../core/events.js';

let ctx = null;

/** Spielt Töne nacheinander: notes = [[Frequenz Hz, Dauer s], ...]. Ohne WebAudio oder bei aus: nichts. */
function play(notes, { type = 'triangle', gain = 0.2 } = {}) {
  const vol = state.settings.sound ? state.settings.volume * gain : 0;
  // Vor der ersten Nutzeraktion bleibt es still: Browser blockieren Audio dann und melden eine Konsolenwarnung
  if (!(vol > 0) || navigator.userActivation?.hasBeenActive === false) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur] of notes) {
      const osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(vol, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // kurzes Ausklingen, kein Knacken
      osc.connect(amp).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur * 0.8;
    }
  } catch { /* ohne Audio-Unterstützung stumm */ }
}

const SOUNDS = {
  click:   () => play([[180, 0.05]], { type: 'square', gain: 0.05 }),
  buy:     () => play([[520, 0.07]], { gain: 0.12 }),
  done:    () => play([[660, 0.1], [880, 0.15]]),
  golden:  () => play([[880, 0.08], [1175, 0.08], [1568, 0.2]], { type: 'sine' }),
  achieve: () => play([[523, 0.1], [659, 0.1], [784, 0.25]], { type: 'sine' }),
  big:     () => play([[262, 0.15], [330, 0.15], [392, 0.15], [523, 0.4]], { type: 'sawtooth', gain: 0.12 }),
};

// Derselbe Sound höchstens alle 120 ms (mehrere Erfolge oder Käufe im selben Frame klingen nicht übereinander)
const lastAt = {};
function fire(key) {
  const now = performance.now();
  if (now - (lastAt[key] ?? -1e9) < 120) return;
  lastAt[key] = now;
  SOUNDS[key]();
}

export function initSound() {
  on('click', () => fire('click'));
  on('buy', e => { if (!e?.silent) fire('buy'); });   // Auto-Buyer kaufen still
  on('timer:done', () => fire('done'));
  on('golden:claim', () => fire('golden'));
  on('achievement', () => fire('achieve'));
  for (const ev of ['prestige', 'corp', 'era']) on(ev, () => fire('big'));
}

export const previewSound = () => SOUNDS.achieve();
