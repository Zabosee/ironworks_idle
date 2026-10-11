// Welche Icon-Dateien tatsächlich existieren. Für alle anderen zeigt die UI das Emoji `icon`.
// Phase 3: neue SVGs unter assets/icons/ anlegen und hier eintragen (oder die Liste durch einen Dateicheck ersetzen).
const READY = new Set([
  'assets/icons/res-ore.svg', 'assets/icons/res-steel.svg', 'assets/icons/res-titan.svg',
  'assets/icons/gen-mine.svg', 'assets/icons/gen-drill.svg', 'assets/icons/gen-smelter.svg', 'assets/icons/gen-plant.svg', 'assets/icons/gen-forge.svg',
  'assets/icons/furnace.svg',
]);
/** Bildpfad der Definition, falls die Datei existiert, sonst null (dann Emoji verwenden). */
export const imgFor = def => (def && def.img && READY.has(def.img) ? def.img : null);
