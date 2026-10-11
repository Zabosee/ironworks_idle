// Zeitalter (Industrialisierung): abgeleitet von kumuliertem Erz (stats.total.ore >= at), nicht gespeichert.
// Wirksam erst ab dem 1. Neuguss (prestige.count >= 1, siehe formulas.industryUnlocked); davor gilt Zeitalter 0.
// Keine Mindest-Spielzeit; die hohen Erz-Schwellen bremsen, Forschung/Boosts beschleunigen.
// Jedes Zeitalter aktiviert neue Forschungen und Generator-Ausbauten.

export const ERAS = [
  { id: 'handcraft', name: 'Handwerk', sym: '🛠️', at: 0, mult: 1.0, desc: 'Status quo' },
  { id: 'mechanization', name: 'Mechanisierung', sym: '⚙️', at: 1e17, mult: 1.2, desc: 'Ausbau I, Wasserenergie' },
  { id: 'steam', name: 'Dampfzeitalter', sym: '🚂', at: 1e20, mult: 1.3, desc: 'Ausbau II, Dampfmaschine, Bessemer' },
  { id: 'electric', name: 'Elektrifizierung', sym: '⚡', at: 1e22, mult: 1.5, desc: 'Ausbau III, Dynamo, Elektrostahl' },
  { id: 'automation', name: 'Automatisierung', sym: '🤖', at: 1e23, mult: 1.5, desc: 'Ausbau IV, Fließband, Robotik' },
  { id: 'digital', name: 'Digitalisierung', sym: '💾', at: 3e23, mult: 2.0, desc: 'Ausbau V, Mikrochips, Nanotech' },
];

export const EVO_MAX = 5;
export const EVO_AT = [10, 25, 50, 100, 200];         // Generatorenstufe, ab der Ausbau k freigeschaltet
export const EVO_MULT = [1.5, 1.5, 2, 2, 3];         // Multiplikator für genOutputAt je Stufe (kumuliert x27)
export const EVO_COST = [25, 60, 150, 400, 1000];    // Kosten-Multiplikator je Stufe
