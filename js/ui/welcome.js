// "Willkommen zurück"-Dialog: Offline-Ertrag und Tagesbonus (natives <dialog>, nur textContent).
import { h } from './dom.js';
import { t, tName } from '../core/i18n.js';
import { fmt, fmtTime } from '../core/format.js';
import { RES, RES_IDS } from '../data/resources.js';
import { DAILY, BUFFS } from '../data/golden.js';

/** Text zum Tagesbonus (Ergebnis von claimDaily), auch für den Hinweis, wenn der Tag im laufenden Spiel wechselt. */
export function dailyText(daily) {
  const def = BUFFS[DAILY.buff];
  return t('Tagesbonus: {name} für {sec} s. Serie: Tag {n} von {max}{plus}.', { name: tName('golden', def), sec: Math.round(daily.seconds), n: daily.shown, max: DAILY.maxStreak, plus: daily.streak > DAILY.maxStreak ? '+' : '' });
}

/** off: Ergebnis von applyOffline oder null; daily: Ergebnis von claimDaily oder null. */
export function showWelcome(off, daily) {
  if (!off && !daily) return;
  const kids = [h('h2', { id: 'dlg-welcome', text: t('Willkommen zurück!') })];
  if (off) {
    kids.push(h('p', { text: t('Du warst {time} weg.', { time: fmtTime(off.away) }) }));
    const gained = RES_IDS.filter(k => off.gains[k] > 0);
    if (gained.length) kids.push(h('ul', {}, gained.map(k => h('li', { text: `+${fmt(off.gains[k])} ${tName('resources', RES[k])}` }))));
    kids.push(h('p', { text: t('Offline-Ertrag: {pct} % der aktiven Produktion, höchstens für {cap}.', { pct: Math.round(off.efficiency * 100), cap: fmtTime(off.seconds) }) + (off.capped ? ' ' + t('Maximum erreicht.') : '') }));
  }
  if (daily) kids.push(h('p', { text: dailyText(daily) }));
  kids.push(h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', type: 'submit', value: 'ok', text: t('Weiter') })));
  if (typeof HTMLDialogElement === 'undefined') return;
  const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-welcome' }, h('form', { method: 'dialog' }, kids));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
