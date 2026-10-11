// Zugängliche Tabs (WAI-ARIA Tabs-Muster mit Pfeiltasten).
import { $$ } from './dom.js';
import { emit } from '../core/events.js';

let active = 'works';
export const activeTab = () => active;

export function initTabs(nav) {
  const buttons = $$('[role="tab"]', nav);
  const select = (name, focus = false) => {
    active = name;
    for (const b of buttons) {
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
    const i = buttons.findIndex(b => b.dataset.tab === active);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % buttons.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = buttons.length - 1;
    if (n >= 0) { e.preventDefault(); select(buttons[n].dataset.tab, true); }
  });
  select(active);
  return select;
}
