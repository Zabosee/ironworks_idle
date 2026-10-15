// Zugängliche Tabs (WAI-ARIA Tabs-Muster mit Pfeiltasten).
import { $$ } from './dom.js';
import { emit } from '../core/events.js';

let active = 'works';
let selectFn = null;
export const activeTab = () => active;

export function initTabs(nav) {
  const all = $$('[role="tab"]', nav);
  const vis = () => all.filter(b => !b.hidden);
  const select = (name, focus = false) => {
    active = name;
    for (const b of all) {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
      const panel = document.getElementById('tab-' + b.dataset.tab);
      if (panel) panel.hidden = !on;
    }
    emit('tab', name);
  };
  nav.addEventListener('click', e => {
    const b = e.target.closest('[role="tab"]');
    if (b) select(b.dataset.tab);
  });
  nav.addEventListener('keydown', e => {
    const buttons = vis();
    const i = buttons.findIndex(b => b.dataset.tab === active);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % buttons.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = buttons.length - 1;
    if (n >= 0) { e.preventDefault(); select(buttons[n].dataset.tab, true); }
  });
  // Tasten 1 bis 9: n-ter sichtbarer Tab (nicht in Eingabefeldern oder offenen Dialogen)
  document.addEventListener('keydown', e => {
    if (!/^[1-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const b = vis()[Number(e.key) - 1];
    if (b) { e.preventDefault(); select(b.dataset.tab); }
  });
  selectFn = select;
  select(active);
  return select;
}

/** Blendet einen Tab (Button) ein/aus. Liegt der aktive Tab dort, wird auf Generatoren zurückgefallen (Standard-Tab beim Start ist Werk). */
export function setTabHidden(name, hidden) {
  const b = document.getElementById('tabbtn-' + name);
  if (!b || b.hidden === hidden) return;
  b.hidden = hidden;
  if (hidden && active === name && selectFn) selectFn('gens');
}
