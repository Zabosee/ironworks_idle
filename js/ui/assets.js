// Welche Icon-/Sprite-Dateien tatsächlich existieren. Für alle anderen zeigt die UI das Emoji `icon`.
const RES_FILES = ['ore', 'steel', 'titan', 'coal', 'coke', 'copper', 'manganese', 'chrome', 'nickel', 'alloy', 'tungsten', 'gold',
  'cobalt', 'molybdenum', 'carbide', 'platinum', 'vanadium', 'iridium', 'superalloy'];   // Ausbau 2 (Konzern)
const GEN_FILES = ['mine', 'drill', 'smelter', 'plant', 'forge', 'coal', 'coke', 'copper', 'manganese', 'chrome', 'nickel', 'alloy', 'tungsten', 'gold',
  'cobalt', 'molybdenum', 'carbide', 'platinum', 'vanadium', 'iridium', 'superalloy'];   // Ausbau 2 (Konzern)
const READY = new Set([
  ...RES_FILES.map(f => `assets/icons/res-${f}.svg`),
  ...GEN_FILES.map(f => `assets/icons/gen-${f}.svg`),
  'assets/icons/furnace.svg',
]);

/** Generator-ID -> Dateiname von Icon und Sprite (die Dateien heißen nach dem Material, nicht nach der Generator-ID). */
export const GEN_SPRITE = {
  mine: 'mine', drill: 'drill', smelter: 'smelter', plant: 'plant', forge: 'forge',
  colliery: 'coal', cokery: 'coke', copperhut: 'copper', manganmine: 'manganese', mixer: 'alloy',
  chromeworks: 'chrome', nickelref: 'nickel', reactor: 'tungsten', crucible: 'gold',
  cobaltmine: 'cobalt', molybdenumworks: 'molybdenum', sinterworks: 'carbide', platinummine: 'platinum',   // Ausbau 2 (Konzern)
  vanadiumworks: 'vanadium', iridiumlab: 'iridium', superfoundry: 'superalloy',
};
export const spriteHref = id => `assets/sprites/gens.svg#gen-${GEN_SPRITE[id] ?? id}`;
export const UI_SPRITE = 'assets/sprites/ui.svg';
export const ITEM_SPRITE = 'assets/sprites/items.svg';   // Symbole der Daten-Felder `sym` (id im Sprite: sym-<sym>)
const NS = 'http://www.w3.org/2000/svg';
function svgOf(cls, href) {
  const svg = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
  svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  u.setAttribute('href', href); svg.append(u);
  return svg;
}
/** Item-Symbol aus items.svg (id sym-<name>); `cat` färbt per CSS-Klasse (sym-click, sym-boost, sym-shop, sym-ach, sym-buff, sym-prestige). */
export function symSvg(name, cls = '', cat = '') {
  return svgOf(('ico sym ' + (cat ? 'sym-' + cat + ' ' : '') + cls).trim(), `${ITEM_SPRITE}#sym-${name}`);
}
/** Kleines ui.svg-Symbol (currentColor). */
export function svgUse(name, cls = '') {
  return svgOf(('ico ' + cls).trim(), UI_SPRITE + '#' + name);
}
export const FLASK_SPRITE = 'assets/sprites/flasks.svg';

/** Bildpfad der Definition, falls die Datei existiert, sonst null (dann Emoji verwenden). */
export function imgFor(def) {
  if (!def || !def.img) return null;
  const path = GEN_SPRITE[def.id] && def.img.includes('/gen-') ? `assets/icons/gen-${GEN_SPRITE[def.id]}.svg` : def.img;
  return READY.has(path) ? path : null;
}
