// Warteschlangen für zeitgegatete Freischaltungen (Forschung im Labor; Boosts und Klick-Upgrades in der Werkbank).
// Kauf = Kosten sofort abziehen -> Auftrag einreihen -> Countdown -> erst dann wirkt der Effekt.
// Die ersten `queueSlots(q)` Einträge einer Warteschlange laufen gleichzeitig, der Rest wartet (seine Zeit läuft nicht).
// Reine Logik ohne DOM. Events: 'timer:queued', 'timer:done', 'timer:cancel' (Payload { queue, kind, id }).
import { state } from '../core/state.js';
import { emit, toast } from '../core/events.js';
import { t, tDefName } from '../core/i18n.js';
import {
  bulkPlan, lockReason, defOf, duration, queueSlots, pendingOf, safe,
} from '../core/formulas.js';
import { QUEUES, QUEUE_IDS, queueIdOf, REFUND } from '../data/timers.js';
import { RES_IDS } from '../data/resources.js';

const EPS = 1e-9;

/** true, wenn kind/id gerade läuft oder wartet. */
export const isPending = (kind, id) => pendingOf(kind, id) !== null;

/**
 * Reiht den Kauf von kind ('research' | 'boost' | 'click') ein und zieht die Kosten sofort ab.
 * Gibt true bei Erfolg zurück; false bei fehlender Voraussetzung, laufendem Auftrag, voller Warteschlange oder zu wenig Material.
 */
export function enqueue(kind, id, { silent = false } = {}) {
  const q = queueIdOf(kind);
  if (!q || !defOf(kind, id) || lockReason(kind, id)) return false;
  const plan = bulkPlan(kind, id, 1);
  if (plan.count !== 1 || !plan.affordable) return false;
  for (const k in plan.cost) state.res[k] -= plan.cost[k];
  for (const k of RES_IDS) if (state.res[k] < 0) state.res[k] = 0;   // Rundungsschutz
  const total = duration(kind, id);
  state.timers[q].push({ kind, id, total, left: total, cost: { ...plan.cost }, silent });
  state.stats.buys++;
  emit('timer:queued', { queue: q, kind, id });
  emit('buy', { kind, id, count: 1, silent, queued: true });
  return true;
}

function refundOf(entry, running) {
  const f = running ? REFUND.running : REFUND.waiting, out = {};
  for (const k in entry.cost) out[k] = entry.cost[k] * f;
  return out;
}

/**
 * Bricht den Auftrag an Position index (0 = vorderster) ab. Wartend: 100 % Erstattung, laufend: 50 %.
 * Gibt die erstatteten Kosten zurück oder null, wenn es den Auftrag nicht gibt.
 */
export function cancel(queue, index) {
  const list = state.timers[queue];
  if (!list || !Number.isInteger(index) || index < 0 || index >= list.length) return null;
  const running = index < queueSlots(queue);
  const [entry] = list.splice(index, 1);
  const refund = refundOf(entry, running);
  for (const k in refund) state.res[k] = safe((state.res[k] || 0) + refund[k]);
  emit('timer:cancel', { queue, kind: entry.kind, id: entry.id, refund, running });
  return refund;
}

function apply(kind, id) {
  if (kind === 'research') state.research[id] = 1;
  else if (kind === 'boost') state.boosts[id] = 1;
  else if (kind === 'click') state.clicks[id] = (state.clicks[id] || 0) + 1;
}

function finish(queue, entry) {
  apply(entry.kind, entry.id);
  state.stats.timersDone++;
  emit('timer:done', { queue, kind: entry.kind, id: entry.id });
  if (!entry.silent && entry.kind !== 'click') {
    const name = tDefName(entry.kind, defOf(entry.kind, entry.id));
    toast(entry.kind === 'research' ? t('Forschung abgeschlossen: {name}', { name }) : t('Boost aktiv: {name}', { name }), 'good');
  }
}

const activeEntries = queue => state.timers[queue].slice(0, queueSlots(queue));

/** Sekunden bis zum nächsten Abschluss über alle Warteschlangen (Infinity, wenn nichts läuft). */
export function timeToNext() {
  let t = Infinity;
  for (const q of QUEUE_IDS) for (const e of activeEntries(q)) t = Math.min(t, Math.max(e.left, 0));
  return t;
}

/**
 * Lässt die Zeit dt vergehen. Aufträge werden in Reihenfolge abgeschlossen; frei werdende Slots
 * werden sofort vom nächsten wartenden Auftrag belegt (auch innerhalb eines großen dt, z. B. offline).
 */
export function tick(dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return;
  let rem = dt;
  for (let guard = 0; guard < 200; guard++) {
    // bereits abgelaufene Aufträge zuerst abschließen (Slot wird frei, Nachrücker bekommt volle Zeit)
    let closed = false;
    for (const q of QUEUE_IDS) {
      const list = state.timers[q];
      for (let i = 0; i < Math.min(list.length, queueSlots(q)); i++) {
        if (list[i].left <= EPS) { const [e] = list.splice(i, 1); finish(q, e); closed = true; i--; }
      }
    }
    if (closed) continue;
    if (rem <= 0) break;
    const step = Math.min(rem, timeToNext());
    if (!Number.isFinite(step)) break;   // nichts läuft
    for (const q of QUEUE_IDS) for (const e of activeEntries(q)) e.left -= step;
    rem -= step;
    if (rem <= 0 && timeToNext() > EPS) break;
  }
}

/** Schließt alle Aufträge sofort ab (Tests/Debug). */
export function finishAll() { tick(1e9); }

/** Zustand einer Warteschlange: [{ kind, id, name, total, left, progress, running, index }]. */
export function queueState(queue) {
  const list = state.timers[queue] ?? [], slots = queueSlots(queue);
  return list.map((e, index) => {
    const running = index < slots;
    return {
      kind: e.kind, id: e.id, name: tDefName(e.kind, defOf(e.kind, e.id)) ?? e.id, total: e.total,
      left: running ? Math.max(e.left, 0) : e.total, progress: e.total > 0 ? Math.min(1, Math.max(0, 1 - e.left / e.total)) : 1,
      running, index,
    };
  });
}

/** Beim Neuguss: Werkbank leeren (Boosts/Klick-Upgrades werden zurückgesetzt); Labor nur ohne Wissensarchiv. Keine Erstattung nötig, da Ressourcen ohnehin zurückgesetzt werden. */
export function resetForPrestige(keepResearch) {
  for (const q of QUEUE_IDS) if (!(keepResearch && QUEUES[q].kinds.includes('research'))) state.timers[q] = [];
}
