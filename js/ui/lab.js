// Labor-Gefäße für die Forschung: Kolbenform nach `cat`, Flüssigkeit füllt sich per CSS-Variable --p.
// Die Innenformen sind aus assets/sprites/flasks.svg kopiert (clipPath braucht inline-Pfade).
import { FLASK_SPRITE } from './assets.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const FLASK_OF = { mining: 'erlenmeyer', metal: 'tube', chem: 'round', tech: 'retort' };
const INNER = {
  erlenmeyer: 'M26.5 8H37.5V29L55 66Q56 69 53 69H11Q8 69 9 66L26.5 29Z',
  tube: 'M24 10V62A8 8 0 0 0 40 62V10Z',
  round: 'M28 8H36V27A23 23 0 1 1 28 27Z',
  retort: 'M8.5 52a15.5 15.5 0 1 0 31 0a15.5 15.5 0 1 0 -31 0Z',
};
const WAVE = 'M-32 0q8-5 16 0' + 't16 0'.repeat(8) + 'V90H-32Z';

const svgEl = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};
const use = (href, attrs = {}) => svgEl('use', { href, ...attrs });

/** Einmal pro Dokument: unsichtbares SVG mit den clipPaths clip-<form>. */
export function ensureClipDefs(parent) {
  if (parent.querySelector('#clip-defs')) return;
  const defs = svgEl('defs');
  for (const [form, d] of Object.entries(INNER)) defs.append(svgEl('clipPath', { id: 'clip-' + form }, svgEl('path', { d })));
  parent.prepend(svgEl('svg', { id: 'clip-defs', width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false', class: 'clip-defs' }, defs));
}

/** Erzeugt das dekorative Gefäß-SVG (aria-hidden). Gefüllt wird über `--p` (0..1) am Eltern-Element. */
export function buildFlask(def) {
  const form = FLASK_OF[def.cat] ?? 'erlenmeyer';
  const bubbles = [20, 30, 38, 46].map((x, i) => use(FLASK_SPRITE + '#bubble', { class: 'bub', x: String(x), y: '60', width: '7', height: '7', 'data-i': String(i) }));
  const liq = svgEl('g', { class: 'liq' }, svgEl('path', { class: 'wave', d: WAVE }), svgEl('rect', { class: 'body', x: '-32', y: '0', width: '128', height: '90' }), ...bubbles);
  const svg = svgEl('svg', { class: `flask flask--${form}`, viewBox: '0 0 64 80', 'aria-hidden': 'true', focusable: 'false' },
    svgEl('g', { 'clip-path': `url(#clip-${form})` }, liq),
    use(`${FLASK_SPRITE}#flask-${form}`),
    use(FLASK_SPRITE + '#steam', { class: 'steam', x: '24', y: '-22', width: '16', height: '24' }));
  return svg;
}
