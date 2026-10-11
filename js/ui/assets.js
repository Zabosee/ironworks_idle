// Welche Icon-/Sprite-Dateien tatsächlich existieren. Für alle anderen zeigt die UI das Emoji `icon`.
const RES_FILES = ['ore', 'steel', 'titan', 'coal', 'coke', 'copper', 'manganese', 'chrome', 'nickel', 'alloy', 'tungsten', 'gold'];
const GEN_FILES = ['mine', 'drill', 'smelter', 'plant', 'forge', 'coal', 'coke', 'copper', 'manganese', 'chrome', 'nickel', 'alloy', 'tungsten', 'gold'];
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
};
export const spriteHref = id => `assets/sprites/gens.svg#gen-${GEN_SPRITE[id] ?? id}`;
export const UI_SPRITE = 'assets/sprites/ui.svg';
export const ITEM_SPRITE = 'assets/sprites/items.svg';   // Symbole der Daten-Felder `sym` (id im Sprite: sym-<sym>)
export const FLASK_SPRITE = 'assets/sprites/flasks.svg';

/** Bildpfad der Definition, falls die Datei existiert, sonst null (dann Emoji verwenden). */
export function imgFor(def) {
  if (!def || !def.img) return null;
  const path = GEN_SPRITE[def.id] && def.img.includes('/gen-') ? `assets/icons/gen-${GEN_SPRITE[def.id]}.svg` : def.img;
  return READY.has(path) ? path : null;
}
