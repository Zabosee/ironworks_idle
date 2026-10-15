// Zeitalter (Industrialisierung): abgeleitet von kumuliertem Erz (stats.total.ore >= at), nicht gespeichert.
// Wirksam erst ab dem 1. Neuguss (prestige.count >= 1, siehe formulas.industryUnlocked); davor gilt Zeitalter 0.
// Keine Mindest-Spielzeit; die hohen Erz-Schwellen bremsen, Forschung/Boosts beschleunigen.
// Jedes Zeitalter aktiviert neue Forschungen und Generator-Ausbauten.

export const ERAS = [
  { id: 'handcraft', name: 'Handwerk', sym: '🛠️', ico: 'hammer', at: 0, mult: 1.0, desc: 'Status quo' },
  { id: 'mechanization', name: 'Mechanisierung', sym: '⚙️', ico: 'gear', at: 1e17, mult: 1.2, desc: 'Ausbau I, Wasserenergie' },
  { id: 'steam', name: 'Dampfzeitalter', sym: '🚂', ico: 'train', at: 1e20, mult: 1.3, desc: 'Ausbau II, Dampfmaschine, Bessemer' },
  { id: 'electric', name: 'Elektrifizierung', sym: '⚡', ico: 'bolt', at: 1e22, mult: 1.5, desc: 'Ausbau III, Dynamo, Elektrostahl' },
  { id: 'automation', name: 'Automatisierung', sym: '🤖', ico: 'robot', at: 1e23, mult: 1.5, desc: 'Ausbau IV, Fließband, Robotik' },
  { id: 'digital', name: 'Digitalisierung', sym: '💾', ico: 'chip', at: 3e23, mult: 2.0, desc: 'Ausbau V, Mikrochips, Nanotech' },
  // Zeitalter 6 bis 8: Schwellen kalibriert in Schritt 6 (Bot: Zeitalter 6/7/8 bei ca. 300/390/500 h; Design-Startwerte 5e24/8e25/4e26 lagen weit unter dem gemessenen Erz). ico atom/rocket/cosmic: Sprites aus Schritt 2.
  { id: 'atomic', name: 'Atomzeitalter', sym: '⚛️', ico: 'atom', at: 8e26, mult: 1.5, desc: 'Ausbau VI' },
  { id: 'space', name: 'Raumfahrt', sym: '🚀', ico: 'rocket', at: 8e27, mult: 1.5, desc: 'Ausbau VII' },
  { id: 'cosmic', name: 'Kosmische Schmiede', sym: '⭐', ico: 'cosmic', at: 8e28, mult: 2.0, desc: 'Ausbau VIII' },
];

export const EVO_MAX = 8;
export const EVO_AT = [10, 20, 30, 45, 60, 75, 90, 100];   // Generatorenstufe, ab der Ausbau k freigeschaltet
export const EVO_MULT = [1.5, 1.5, 2, 2, 3, 2, 2, 3];          // Multiplikator für genOutputAt je Stufe (kumuliert x324)
export const EVO_COST = [25, 60, 150, 400, 1000, 2000, 3000, 4000];   // Kosten-Multiplikator je Stufe
