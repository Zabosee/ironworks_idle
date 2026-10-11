// Generatoren. cost = Basiskosten pro Ressource, growth = Kostenwachstum je Stufe,
// elite = Basis der zusätzlichen Titan-Kosten ab Stufe ELITE_FROM.
export const MILESTONE_STEP = 10;   // alle 10 Stufen Produktion x2
export const ELITE_FROM = 10;       // ab dieser Stufe kostet jede Stufe zusätzlich Titan
export const ELITE_GROWTH = 1.3;
export const MAX_LEVEL = 5000;      // harte Grenze gegen Überlauf
export const EXTRA_MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500]; // Forschung "Präzisionsfertigung"

export const GENS = [
  { id: 'mine', img: 'assets/icons/gen-mine.svg',    icon: '⛏️', name: 'Eisenmine',      res: 'ore',   base: 1,    cost: { ore: 15 },                 growth: 1.15, elite: 2 },
  { id: 'drill', img: 'assets/icons/gen-drill.svg',   icon: '🏗️', name: 'Bohrturm',       res: 'ore',   base: 12,   cost: { ore: 400, steel: 10 },     growth: 1.17, elite: 2 },
  { id: 'smelter', img: 'assets/icons/gen-smelter.svg', icon: '🔥', name: 'Schmelzofen',    res: 'steel', base: 0.25, cost: { ore: 150 },                growth: 1.2,  elite: 2 },
  { id: 'plant', img: 'assets/icons/gen-plant.svg',   icon: '🏭', name: 'Walzwerk',       res: 'steel', base: 4,    cost: { ore: 2e5, steel: 3000 },   growth: 1.21, elite: 5, req: 'metallurgy' },
  { id: 'forge', img: 'assets/icons/gen-forge.svg',   icon: '⚗️', name: 'Titan-Schmiede', res: 'titan', base: 0.02, cost: { ore: 20000, steel: 500 },  growth: 1.25, elite: 2, req: 'titanium' },
];
export const GEN_MAP = Object.fromEntries(GENS.map(g => [g.id, g]));
