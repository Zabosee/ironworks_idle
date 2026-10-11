// Minimaler Event-Bus. Systeme emittieren, die UI abonniert.
const handlers = new Map();

export function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name).add(fn);
  return () => off(name, fn);
}

export function off(name, fn) {
  handlers.get(name)?.delete(fn);
}

export function emit(name, payload) {
  const set = handlers.get(name);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(payload); } catch (err) { console.error(`Event-Handler für "${name}" fehlgeschlagen`, err); }
  }
}

/** Kurzform für Toast-Nachrichten (kind: info | good | gold | warn). Nur Text, kein HTML. */
export const toast = (msg, kind = 'info') => emit('toast', { msg: String(msg), kind });
