// Werkshalle: pro freigeschaltetem Generator eine Spur mit Slot-Bildern, die sich mit dem Rang weiterentwickeln.
// Das DOM wird einmal gebaut; danach ändern sich nur Klassen/hidden/Text, und zwar nur bei buy/loaded/prestige/evolve.
import { state } from '../core/state.js';
import { on, toast } from '../core/events.js';
import { fmtInt } from '../core/format.js';
import { t, tName } from '../core/i18n.js';
import { levelOf, lockReason, isRevealed, genOutputAt } from '../core/formulas.js';
import { GENS, genTier, tierName, tierPips, TIER_NAMES } from '../data/generators.js';
import { h, $, setText, setAttr } from './dom.js';
import { imgFor, spriteHref } from './assets.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SLOTS = 10;
const lanes = [];   // { def, el, ... }
let root, empty;

/** SVG-Element mit <use>; h() erzeugt nur HTML-Elemente, daher hier per createElementNS. */
function useSvg(href, cls, viewBox) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (cls) svg.setAttribute('class', cls);
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', href);
  svg.append(use);
  return svg;
}

function buildLane(def) {
  const L = { def, tier: -1, shown: -1, lv: -1, evolveTimer: 0 };
  const ico = imgFor(def) ? h('img', { class: 'lane-ico', src: imgFor(def), alt: '', draggable: 'false' }) : h('span', { class: 'lane-ico lane-ico-emoji', 'aria-hidden': 'true', text: def.icon });
  L.name = h('h3', { class: 'lane-name', text: tName('generators', def) });
  L.lvlEl = h('span', { class: 'lane-level' });
  L.rank = h('span', { class: 'lane-rank' });
  L.next = h('span', { class: 'lane-next' });
  L.pips = h('span', { class: 'lane-pips', role: 'img' }, ...Array.from({ length: 5 }, () => h('i')));
  L.slots = [];
  const slotBox = h('div', { class: 'lane-slots' });
  for (let i = 0; i < MAX_SLOTS; i++) {
    const s = h('span', { class: 'slot', hidden: true }, useSvg(spriteHref(def.id), '', '0 0 64 64'));
    L.slots.push(s);
    slotBox.append(s);
  }
  L.count = h('span', { class: 'lane-count', hidden: true });
  L.none = h('p', { class: 'lane-none', text: t('Noch nicht gebaut. Kaufe die erste Stufe im Tab Generatoren.') });
  slotBox.append(L.count);
  L.smoke = h('span', { class: 'smoke', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  L.el = h('section', { class: 'lane', role: 'group', dataset: { gen: def.id } },
    h('header', { class: 'lane-head' }, ico,
      h('div', { class: 'lane-title' }, L.name, h('span', { class: 'lane-meta' }, L.lvlEl, L.rank)),
      h('div', { class: 'lane-prog' }, L.pips, L.next)),
    slotBox, L.none, L.smoke);
  // Neu-Slot-Pop und Glow räumen sich selbst auf
  L.el.addEventListener('animationend', e => {
    if (e.target.classList?.contains('slot')) e.target.classList.remove('slot--new');
    else if (e.target === L.el && e.animationName === 'lane-glow') L.el.classList.remove('evolve');
  });
  return L;
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

function updateLane(L, animate) {
  const lvl = levelOf('gen', L.def.id);
  const tier = genTier(lvl);
  const visible = lvl > 0 || (isRevealed('gen', L.def.id) && !lockReason('gen', L.def.id));
  if (L.el.hidden !== !visible) L.el.hidden = !visible;
  if (!visible) { L.lv = -1; L.shown = -1; return false; }
  if (lvl === L.lv && tier === L.tier) return true;
  const prevShown = L.shown;
  L.lv = lvl;
  const shown = Math.min(lvl, MAX_SLOTS);
  L.slots.forEach((s, i) => {
    const vis = i < shown;
    if (s.hidden === vis) s.hidden = !vis;
    if (vis && animate && prevShown >= 0 && i >= prevShown && !reduced.matches) {
      s.classList.remove('slot--new');
      void s.offsetWidth;
      s.classList.add('slot--new');
    }
  });
  L.shown = shown;
  if (lvl > MAX_SLOTS) { L.count.hidden = false; setText(L.count, '×' + fmtInt(lvl)); } else L.count.hidden = true;
  L.none.hidden = lvl > 0;
  L.el.classList.toggle('empty', lvl === 0);
  if (tier !== L.tier) {
    for (let t = 0; t < TIER_NAMES.length; t++) L.el.classList.toggle('tier-' + t, t === tier);
    L.tier = tier;
  }
  const tp = tierPips(lvl);
  setText(L.lvlEl, t('Stufe {n}', { n: lvl > 0 ? fmtInt(lvl) : 0 }));
  setText(L.rank, t('Rang {name}', { name: t(tierName(tier)) }));
  setText(L.next, tp.next ? t('Rang {name} ab Stufe {n}', { name: t(tierName(tier + 1)), n: tp.next }) : t('Höchster Rang'));
  [...L.pips.children].forEach((p, i) => p.classList.toggle('on', i < tp.pips));
  setAttr(L.pips, 'aria-label', t('Fortschritt zum nächsten Rang: {pips} von {total}', { pips: tp.pips, total: tp.total }));
  setAttr(L.el, 'aria-label', t('{name}, Stufe {n}, Rang {rank}', { name: tName('generators', L.def), n: fmtInt(lvl), rank: t(tierName(tier)) }));
  // Idle-Animation: nur wenn gebaut; Tempo wächst mit der Ausgabe (einmalig gesetzt, nicht pro Tick)
  L.el.classList.toggle('running', lvl > 0);
  const speed = Math.max(0.5, 1.6 - Math.log10(1 + genOutputAt(L.def, lvl)) * 0.15);
  L.el.style.setProperty('--idle', speed.toFixed(2) + 's');
  return true;
}

function updateAll(animate = false) {
  for (const L of lanes) updateLane(L, animate);
  if (empty) empty.hidden = lanes.some(L => L.lv > 0);
}

function evolve(id, tier) {
  const L = lanes.find(l => l.def.id === id);
  if (!L) return;
  updateLane(L, false);
  toast(t('{name}: Rang {rank}', { name: tName('generators', L.def), rank: t(tierName(tier)) }), 'gold');
  if (reduced.matches) return;
  L.el.classList.remove('evolve');
  void L.el.offsetWidth;
  L.el.classList.add('evolve');
  clearTimeout(L.evolveTimer);
  L.evolveTimer = setTimeout(() => L.el.classList.remove('evolve'), 700);   // Sicherheitsnetz, falls animationend ausbleibt
}

export function initWorks() {
  root = $('#works');
  empty = $('#works-empty');
  for (const def of GENS) {
    const L = buildLane(def);
    lanes.push(L);
    root.append(L.el);
  }
  updateAll(false);
  on('buy', e => {
    if (e.kind !== 'gen') return;
    const L = lanes.find(l => l.def.id === e.id);
    if (L) updateLane(L, !e.silent);
    updateAll(false);   // schaltet ggf. weitere Spuren frei
  });
  on('gen:evolve', ({ id, tier }) => evolve(id, tier));
  on('loaded', () => { for (const L of lanes) { L.lv = -1; L.shown = -1; } updateAll(false); });
  on('prestige', () => { for (const L of lanes) { L.lv = -1; L.shown = -1; } updateAll(false); });
  on('timer:done', e => { if (e.kind === 'research') updateAll(false); });   // neue Generatoren werden freigeschaltet
  // Animationen pausieren, solange der Browser-Tab verborgen ist
  const sync = () => root.classList.toggle('paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
}
