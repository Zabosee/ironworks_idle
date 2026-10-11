// Mehr-Tab-Schutz: localStorage-Lock mit Heartbeat. Der erste Tab hält den Lock; ein zweiter Tab erkennt ihn,
// pausiert das Speichern (save.pauseSaving) und meldet das Event 'multitab'. Kein DOM; Speicher und Uhr sind injizierbar.
export const LOCK_KEY = 'eisenwerk-idle-lock';
export const HEARTBEAT_MS = 2000;
export const LOCK_TTL_MS = 7000;   // Lock gilt als verwaist, wenn der Heartbeat so lange ausbleibt

const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Liest den Lock; null bei fehlend/kaputt. */
export function readLock(storage, key = LOCK_KEY) {
  try {
    const d = JSON.parse(storage.getItem(key));
    return d && typeof d.id === 'string' && Number.isFinite(d.t) ? d : null;
  } catch { return null; }
}

/** Reine Entscheidung: gehört der Lock einer anderen, noch lebenden Instanz? */
export const heldByOther = (lock, id, now, ttl = LOCK_TTL_MS) => !!lock && lock.id !== id && now - lock.t < ttl && now - lock.t > -ttl;

/**
 * Erzeugt einen Wächter. claim() beim Start, beat() periodisch, release() beim Verlassen.
 * Rückgabe von claim()/beat(): true = diese Instanz darf speichern, false = andere Instanz aktiv (Lock bleibt unberührt).
 * Wurde einmal "fremd" erkannt, bleibt der Wächter dauerhaft gesperrt (Neuladen nötig, sonst würde ein veralteter Stand den neueren überschreiben).
 */
export function createGuard({ storage, now = Date.now, id = newId(), ttl = LOCK_TTL_MS, onConflict = () => {} } = {}) {
  let blocked = false;
  const write = () => { try { storage.setItem(LOCK_KEY, JSON.stringify({ id, t: now() })); } catch { /* Speicher gesperrt: kein Schutz möglich */ } };
  const check = () => {
    if (blocked) return false;
    if (heldByOther(readLock(storage), id, now(), ttl)) { blocked = true; onConflict(); return false; }
    write();
    return true;
  };
  return {
    id,
    claim: check,
    beat: check,
    release() {
      if (!blocked && readLock(storage)?.id === id) { try { storage.removeItem(LOCK_KEY); } catch { /* ignorieren */ } }
    },
    get blocked() { return blocked; },
  };
}
