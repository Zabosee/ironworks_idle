// Visuelles Feedback: Klick-Partikel, Ressourcen-Orbs, goldene Barren, Flash beim Neuguss.
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { fmt } from '../core/format.js';
import { click } from '../systems/production.js';
import { claim } from '../systems/golden.js';
import { RES, RES_IDS } from '../data/resources.js';
import { GOLDEN } from '../data/golden.js';
import { h, $ } from './dom.js';

const MAX_PARTICLES = 40;
const MAX_SPARKS = 24;
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const animationsOn = () => state.settings.particles && !reducedQuery.matches;

export function floatText(parent, text, color, x = '50%', y = '30%', cls = '') {
  if (!animationsOn()) return;
  if (parent.querySelectorAll(':scope > .particle').length >= MAX_PARTICLES) return;
  const p = h('span', { class: 'particle' + (cls ? ' ' + cls : ''), text });
  p.style.cssText = `left:${x};top:${y};color:${color};--dx:${((Math.random() - 0.5) * 60).toFixed(0)}px`;
  p.addEventListener('animationend', () => p.remove());
  parent.append(p);
}

export function restartAnim(el, cls = 'pop') {
  if (reducedQuery.matches) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Funkenstoß an Position (px relativ zu zone). Begrenzt und räumt sich selbst auf. */
export function sparkBurst(zone, x, y, n = 7) {
  if (!animationsOn()) return;
  const room = MAX_SPARKS - zone.querySelectorAll(':scope > .spark-p').length;
  for (let i = 0; i < Math.min(n, room); i++) {
    const a = -Math.PI * (0.1 + Math.random() * 0.8), d = 30 + Math.random() * 50;
    const sp = h('span', { class: 'spark-p' });
    sp.style.cssText = `left:${x}px;top:${y}px;--sx:${(Math.cos(a) * d).toFixed(0)}px;--sy:${(Math.sin(a) * d + 18).toFixed(0)}px`;
    sp.addEventListener('animationend', () => sp.remove());
    zone.append(sp);
  }
}

/** Kurzes goldenes Aufblitzen des ganzen Bildschirms. */
export function screenFlash() {
  if (!animationsOn()) return;
  const f = h('div', { class: 'screen-flash', 'aria-hidden': 'true' });
  f.addEventListener('animationend', () => f.remove());
  document.body.append(f);
}

/** Großer Hauptknopf. onAfter wird nach dem Klick aufgerufen (z. B. sofortiges Neuzeichnen). */
export function initCollect(btn, zone, onAfter) {
  btn.addEventListener('click', e => {
    const amount = click();
    const rect = zone.getBoundingClientRect();
    // Tastatur-Klicks haben clientX/Y = 0 -> Mitte des Knopfes verwenden
    const b = btn.getBoundingClientRect();
    const keyboard = e.detail === 0;
    const x = keyboard ? b.left + b.width / 2 : e.clientX, y = keyboard ? b.top + b.height * 0.3 : e.clientY;
    floatText(zone, '+' + fmt(amount), '#fff', `${x - rect.left}px`, `${y - rect.top}px`, 'big');
    sparkBurst(zone, x - rect.left, y - rect.top);
    restartAnim(btn);
    onAfter?.();
  });
}

const acc = Object.fromEntries(RES_IDS.map(k => [k, 0]));
/** Pulsierende Ringe und aufsteigende Partikel an den Ressourcen-Orbs; r = Raten, dt in Sekunden. */
export function updateOrbs(r, dt) {
  for (const k of RES_IDS) {
    const orb = document.getElementById('orb-' + k);
    if (!orb) continue;
    const rps = Math.max(r[k], 0), ring = orb.querySelector('.ring');
    const dur = Math.max(0.25, 2.5 / (1 + Math.log10(1 + rps * 10))).toFixed(2) + 's';
    if (ring._d !== dur) { ring._d = dur; ring.style.setProperty('--dur', dur); }
    const active = rps > 0;
    if (ring._a !== active) { ring._a = active; ring.style.visibility = active ? 'visible' : 'hidden'; }
    if (!active || !animationsOn()) continue;
    const perSec = Math.min(8, 1 + Math.log10(1 + rps) * 1.5);
    acc[k] = Math.min(acc[k] + dt * perSec, 2);
    for (; acc[k] >= 1; acc[k]--) floatText(orb, '+' + fmt(rps / perSec), RES[k].color);
  }
}

export function initGoldenUI(layer) {
  let el = null;
  const remove = () => { el?.remove(); el = null; };

  on('golden:spawn', g => {
    remove();
    el = h('button', {
      class: 'golden', type: 'button', 'aria-label': 'Goldener Barren, einsammeln (Taste G)',
      onclick: () => {
        const rect = el.getBoundingClientRect();
        floatText(layer, 'Gefangen!', '#fde047', `${rect.left}px`, `${rect.top}px`);
        claim();
      },
    }, h('span', { class: 'golden-icon', 'aria-hidden': 'true' }, h('img', { src: 'assets/icons/gold-bar.svg', alt: '', draggable: 'false' })));
    el.style.left = g.x + '%';
    el.style.top = g.y + '%';
    el.style.setProperty('--life', GOLDEN.lifetime + 's');
    layer.append(el);
    emit('toast', { msg: 'Ein goldener Barren erscheint! Schnell einsammeln (Taste G).', kind: 'gold' });
  });
  on('golden:expire', remove);
  on('golden:claim', remove);
  on('loaded', remove);

  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'g' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (el) { e.preventDefault(); el.click(); }
  });
}

export function initFlash() {
  on('achievement', screenFlash);
  on('golden:claim', screenFlash);
  on('buy', e => {
    if (e.silent || !animationsOn()) return;
    const el = document.querySelector(`.card[data-kind="${e.kind}"][data-id="${e.id}"]`);
    if (el) restartAnim(el, 'bought');
  });
  on('prestige', () => {
    const f = $('#flash');
    if (f) restartAnim(f, 'flash-go');
  });
}
