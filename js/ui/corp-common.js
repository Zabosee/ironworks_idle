// Gemeinsame Konzern-UI-Helfer (Sichtbarkeit des Reiters, Abzeichen "K3"). Ohne Abhängigkeit zu cards/research-map.
import { state } from '../core/state.js';
import { t } from '../core/i18n.js';
import { symSvg } from './assets.js';
import { corpUnlocked } from '../core/formulas.js';
import { CORP } from '../data/corp.js';
import { canCorp } from '../systems/corp.js';
import { h, setText, setAttr } from './dom.js';
import { setTabHidden } from './tabs.js';

/** Der Konzern-Reiter (und der Konzernforschungs-Ast) erscheint ab diesem Neuguss; nutzbar erst ab CORP.unlockCount. */
export const CORP_SHOW_AT = 25;
export const corpTabVisible = () => (state.prestige?.count || 0) >= CORP_SHOW_AT;

/** Abzeichen oben rechts an Konzern-Inhalten: Symbol + Text (Farbe ist nie alleiniger Träger). */
export function corpPill(stage) {
  return h('span', { class: 'corp-pill', title: t('Konzernforschung ab Konzernstufe K{n}', { n: stage }) }, symSvg('corp'), 'K' + stage);
}

let tabEls = null;
/** Reiter-Zustand (ca. 10x/s aus renderTop): sichtbar ab Neuguss 25, gesperrt (aria-disabled, Schloss) bis CORP.unlockCount, Punkt bei möglicher Gründung. */
export function renderCorpTab() {
  const vis = corpTabVisible();
  setTabHidden('corp', !vis);
  if (!vis) return;
  tabEls ??= { btn: document.getElementById('tabbtn-corp'), lock: document.getElementById('corp-lock'), dot: document.getElementById('corp-dot'), status: document.getElementById('corp-tab-status') };
  const locked = !corpUnlocked();
  setAttr(tabEls.btn, 'aria-disabled', locked);
  if (locked) tabEls.lock.removeAttribute('hidden'); else tabEls.lock.setAttribute('hidden', '');   // SVG-Element: kein .hidden
  setText(tabEls.status, locked ? t('Nach {n} Neugüssen, aktuell {cur}', { n: CORP.unlockCount, cur: state.prestige.count }) : '');
  setAttr(tabEls.btn, 'title', locked ? `${t('Konzern')}: ${t('Nach {n} Neugüssen, aktuell {cur}', { n: CORP.unlockCount, cur: state.prestige.count })}` : t('Konzern'));
  tabEls.dot.hidden = !canCorp();
}
