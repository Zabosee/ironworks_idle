// Herausforderungen im Hochofen-Panel: 3 Zeilen mit Start/Abbruch und Fortschritt. Sichtbar ab dem 1. Neuguss.
import { state } from '../core/state.js';
import { fmt, fmtTime } from '../core/format.js';
import { t, tName, tDesc } from '../core/i18n.js';
import { CHALLENGES, CHALLENGE_BONUS } from '../data/challenges.js';
import { available, start, abort, progress, startIn } from '../systems/challenges.js';
import { h, setText, setAttr } from './dom.js';

const rows = [];
let box;

export function buildChallenges() {
  const list = h('ul', { class: 'challenges' });
  for (const c of CHALLENGES) {
    const info = h('span', { class: 'hint' }), btn = h('button', { class: 'btn', type: 'button' });
    btn.addEventListener('click', () => { if (state.challenges.active?.id === c.id) abort(); else start(c.id); });
    list.append(h('li', {}, h('strong', { text: tName('challenges', c) }), ' ', h('span', { class: 'hint', text: tDesc('challenges', c) }), h('br'), info, ' ', btn));
    rows.push({ c, info, btn });
  }
  box = h('div', { class: 'panel-box wide', hidden: true },
    h('h2', { text: t('Herausforderungen') }),
    h('p', { class: 'hint', text: t('Optional und ohne Risiko: Der Durchlauf wird nicht zurückgesetzt, nur die Sonderregel gilt bis zum Ziel oder Ablauf. Einmalig je Herausforderung +{pct} % Produktion dauerhaft.', { pct: CHALLENGE_BONUS * 100 }) }),
    list);
  return box;
}

export function renderChallenges() {
  const ok = available();
  if (box.hidden === ok) box.hidden = !ok;
  if (!ok) return;
  const act = state.challenges.active;
  for (const { c, info, btn } of rows) {
    const mine = act?.id === c.id, done = !!state.challenges.done[c.id];
    setText(info, mine ? t('Läuft: {got} von {goal} Stahl · noch {time}', { got: fmt(progress()), goal: fmt(act.goal), time: fmtTime(act.left) }) : done ? t('Geschafft') : t('Frist {time}', { time: fmtTime(c.time) }));
    const wait = startIn(), name = tName('challenges', c);
    if (!mine && !act && wait > 0) setText(info, t('Start frühestens nach {time} Durchlaufzeit (das Ziel richtet sich nach der Stahlrate, ohne Buffs gemessen).', { time: fmtTime(wait) }));
    setText(btn, mine ? t('Abbrechen') : done ? t('Wiederholen') : t('Starten'));
    setAttr(btn, 'aria-label', mine ? t('Abbrechen: {name}', { name }) : done ? t('Wiederholen: {name}', { name }) : t('Starten: {name}', { name }));
    const off = !mine && (!!act || wait > 0);
    setAttr(btn, 'aria-disabled', off);
    btn.disabled = off;
  }
}
