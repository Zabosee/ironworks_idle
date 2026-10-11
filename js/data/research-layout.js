// Koordinaten der Forschungskarte (Raster 170 px × 1.5 = 255 px, Mitte = Geologie bei 0,0, x nach rechts, y nach unten).
// Arme: Kohle/Koks nach Nordost, Metall/Legierungen nach West/Nordwest, Titan/Wolfram nach Südwest,
// Tech-Gruppe (Effizienz ...) nach Süd/Südost. Jede Kante verbindet benachbarte Rasterpunkte.
import { RESEARCH_MAP } from './research.js';

const SCALE = 1.5;  // Größere Knoten und mehr Abstand
export const MIN_NODE_DISTANCE = 150 * SCALE;  // ~225 px

export const RESEARCH_COORDS = {
  geology:      { x: 0,      y: 0 },
  // Nordost: Kohle
  deepmines:    { x: 255,    y: -255 },
  coalmining:   { x: 255,    y: -510 },
  coking:       { x: 0,      y: -765 },
  deepcoal:     { x: 255,    y: -765 },
  // West / Nordwest: Metall, Legierungen
  converter:    { x: -255,   y: 0 },
  metallurgy:   { x: -510,   y: 0 },
  copperworks:  { x: -510,   y: -255 },
  blastfurnace: { x: -255,   y: -510 },
  manganese:    { x: -510,   y: -765 },
  alloying:     { x: -765,   y: -510 },
  catalysis:    { x: -1020,  y: -765 },
  chromium:     { x: -1020,  y: -255 },
  copperenrich: { x: -765,   y: -255 },
  // Südwest: Titan, Wolfram, Gold
  titanium:     { x: -510,   y: 255 },
  refining:     { x: -765,   y: 255 },
  tungsten:     { x: -1020,  y: 0 },
  supercond:    { x: -1275,  y: 255 },
  goldsmith:    { x: -1275,  y: 510 },
  // Süd / Südost: Tech
  efficiency:   { x: -255,   y: 510 },
  resonance:    { x: 255,    y: 255 },
  autoclick:    { x: 0,      y: 510 },
  precision:    { x: -255,   y: 765 },
  automation:   { x: -510,   y: 765 },
  quantum:      { x: 0,      y: 765 },
  quantumopt:   { x: 0,      y: 1020 },
  // Ost: Energie und Industrialisierung (Phase 3)
  energyfound:  { x: 510, y: 0 },
  hydropower:   { x: 765, y: -255 },
  steamengine:  { x: 1020, y: -255 },
  dynamo:       { x: 1020, y: 0 },
  powersupply:  { x: 1275, y: 0 },
  electrify:    { x: 1275, y: 255 },
  assembly:     { x: 1530, y: 255 },
  robotics:     { x: 1530, y: 0 },
  massproduct:  { x: 1530, y: -255 },
  semiconductor:{ x: 1785, y: -255 },
  nanotech:     { x: 1785, y: 0 },
  synthmatter:  { x: 1785, y: 255 },
};

for (const id of Object.keys(RESEARCH_MAP)) {
  if (!(id in RESEARCH_COORDS)) throw new Error(`Research layout missing coordinates for ${id}`);
}
