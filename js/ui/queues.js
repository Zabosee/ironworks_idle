// Warteschlangen, Tab-Abzeichen und Auto-Buyer-Schalter.
import { state } from '../core/state.js';
import { fmt, fmtClock } from '../core/format.js';
import { t, tName } from '../core/i18n.js';
import { queueSlots, queueCapacity, autobuyerUnlocked } from '../core/formulas.js';
import { RES, RES_IDS } from '../data/resources.js';
import { AUTOBUYERS } from '../data/prestige.js';
import { setEnabled } from '../systems/autobuyers.js';
import { queueState, cancel } from '../systems/timers.js';
import { QUEUES, QUEUE_IDS, REFUND } from '../data/timers.js';
import { svgUse } from './assets.js';
import { h, $, clear, setText, setClass, setAttr } from './dom.js';

// ---------- Warteschlangen (.queue-bar mit .slot-chip) ----------
const qv = {};   // queue -> { root, title, list, key, chips: [{ chip, time, entry }] }
export function buildQueues(refresh) {
  for (const q of QUEUE_IDS) {
    const root = document.getElementById('queue-' + q);
    if (!root) continue;
    root.hidden = false;
    qv[q] = { root, title: h('h3', { class: 'queue-title' }), list: h('ul', { class: 'queue-list' }), key: '', chips: [] };
    root.append(qv[q].title, qv[q].list);
    qv[q].list.addEventListener('click', e => {
      const b = e.target.closest('button[data-index]');
      if (!b) return;
      cancel(q, Number(b.dataset.index));
      refresh();
    });
  }
}

/** Text der Erstattung, z. B. "50 % zurück: 150 🪨 · 20 🔩". */
function refundText(q, index, running) {
  const e = state.timers[q][index];
  const f = running ? REFUND.running : REFUND.waiting;
  const parts = e ? RES_IDS.filter(k => e.cost[k] > 0).map(k => `${fmt(e.cost[k] * f)} ${tName('resources', RES[k])}`) : [];
  return t('{pct} % zurück', { pct: Math.round(f * 100) }) + (parts.length ? ': ' + parts.join(' · ') : '');
}

export function renderQueues(only) {
  for (const q of QUEUE_IDS) {
    const v = qv[q];
    if (!v || (only && !only.includes(q))) continue;
    const st = queueState(q), slots = queueSlots(q), cap = queueCapacity(q);
    const running = st.filter(e => e.running).length;
    setText(v.title, t('{name}: {running}/{slots} aktiv · {waiting}/{wcap} wartend', { name: tName('timers', QUEUES[q]), running, slots, waiting: st.length - running, wcap: cap - slots }));
    const key = slots + '|' + st.map(e => e.kind + ':' + e.id + (e.running ? '*' : '')).join('|');
    if (key !== v.key) {
      v.key = key;
      clear(v.list);
      v.chips = [];
      st.forEach(e => {
        const time = h('span', { class: 'chip-time', role: 'timer' }), fill = h('i');
        const short = e.running ? '50 %' : '100 %';
        const btn = h('button', { class: 'btn chip-cancel', type: 'button', dataset: { index: e.index }, title: refundText(q, e.index, e.running),
          'aria-label': t('{name} abbrechen ({refund})', { name: e.name, refund: refundText(q, e.index, e.running) }) }, svgUse('cancel'), h('span', { text: t('Abbrechen ({pct} zurück)', { pct: short }) }));
        const chip = h('li', { class: 'slot-chip ' + (e.running ? 'running' : 'waiting') },
          h('span', { class: 'chip-name', text: e.name }), time, h('span', { class: 'chip-bar', 'aria-hidden': 'true' }, fill), btn);
        v.list.append(chip);
        v.chips.push({ chip, time });
      });
      for (let i = running; i < slots; i++) v.list.append(h('li', { class: 'slot-chip free' }, h('span', { class: 'chip-name', text: t('Slot frei') })));
    }
    st.forEach((e, i) => {
      const c = v.chips[i];
      if (!c) return;
      setText(c.time, e.running ? fmtClock(e.left) : t('wartet · {time}', { time: fmtClock(e.total) }));
      const pv = e.running ? e.progress.toFixed(2) : '0';
      if (c.chip._p !== pv) { c.chip._p = pv; c.chip.style.setProperty('--p', pv); }
    });
  }
}

/** Tab-Abzeichen: laufende Aufträge als Restzeit des nächsten Abschlusses, zusätzlich Wartende. */
const badgeEls = {};
export function renderBadges() {
  for (const [q, tab] of [['lab', 'research'], ['workshop', 'upgrades']]) {
    const el = badgeEls[tab] ??= document.getElementById('badge-' + tab);
    if (!el) continue;
    const st = queueState(q), run = st.filter(e => e.running);
    el.hidden = st.length === 0;
    if (!st.length) continue;
    const left = run.length ? Math.min(...run.map(e => e.left)) : 0;
    const wait = st.length - run.length;
    const txt = `${run.length}/${queueSlots(q)} · ${fmtClock(left)}${wait ? ' +' + wait : ''}`;
    if (el._t !== txt) {   // mobil nur die Restzeit (.badge-x ausgeblendet)
      el._t = txt;
      el.replaceChildren(h('span', { class: 'badge-x', text: `${run.length}/${queueSlots(q)} · ` }), fmtClock(left), wait ? h('span', { class: 'badge-x', text: ' +' + wait }) : '');
    }
    setAttr(el, 'title', t('{name}: {run} läuft, {wait} wartet', { name: tName('timers', QUEUES[q]), run: run.length, wait }));
  }
}

// ---------- Auto-Buyer ----------
const abToggles = {};
export function buildAutobuyers(refresh) {
  const root = $('#list-auto');
  for (const a of AUTOBUYERS) {
    const status = h('span', { class: 'b' });
    const btn = h('button', {
      class: 'toggle', type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        if (!autobuyerUnlocked(a.id)) return;
        setEnabled(a.id, !state.autobuyers[a.id]);
        refresh();
      },
    }, h('span', { class: 't' }, svgUse('robot'), ' ' + tName('autobuyers', a)), status);
    abToggles[a.id] = { btn, status };
    root.append(btn);
  }
}

export function renderAutobuyers() {
  for (const a of AUTOBUYERS) {
    const { btn, status } = abToggles[a.id];
    const unlocked = autobuyerUnlocked(a.id), on = unlocked && state.autobuyers[a.id];
    setAttr(btn, 'aria-pressed', on);
    setAttr(btn, 'aria-disabled', !unlocked);
    setClass(btn, 'locked', !unlocked);
    setClass(btn, 'on', on);
    setText(status, unlocked ? (on ? t('An') : t('Aus')) : t('Gesperrt (Hochofen-Shop oder Konzern-Automatisierung)'));
  }
}
