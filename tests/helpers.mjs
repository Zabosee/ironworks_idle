// Gemeinsame Test-Hilfen (keine Testdatei). Stubs nur an Systemgrenzen: localStorage, Math.random.
import { replaceState, defaultState, state } from '../js/core/state.js';
import { on } from '../js/core/events.js';

export { state };

export function installStorage() {
  const m = new Map();
  const ls = {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    _m: m,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  return ls;
}

export const reset = () => replaceState(defaultState());

/** Sammelt Events eines Namens; stop() entfernt den Handler. */
export function collect(name) {
  const got = [];
  const off = on(name, p => got.push(p));
  return { got, stop: off };
}

/** Ersetzt Math.random durch eine feste Folge; restore() stellt wieder her. */
export function fakeRandom(...values) {
  const orig = Math.random;
  let i = 0;
  Math.random = () => values[Math.min(i++, values.length - 1)];
  return () => { Math.random = orig; };
}

export const give = (res) => Object.assign(state.res, res);
export const quietConsole = () => {
  const orig = console.error;
  console.error = () => {};
  return () => { console.error = orig; };
};
