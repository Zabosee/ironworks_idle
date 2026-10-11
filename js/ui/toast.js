// Toasts in einer aria-live-Region.
import { on } from '../core/events.js';
import { h } from './dom.js';

const MAX = 5;
const LIFETIME = 4500;

export function initToasts(container) {
  on('toast', ({ msg, kind }) => {
    const el = h('div', { class: `toast toast-${kind || 'info'}`, text: String(msg) });
    container.append(el);
    while (container.children.length > MAX) container.firstChild.remove();
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 400);
    }, LIFETIME);
  });
}
