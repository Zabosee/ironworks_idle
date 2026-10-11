// Zeitalter (Industrialisierung): abgeleitet von kumuliertem Erz UND kumulierter Spielzeit, nicht gespeichert.
// Ein Zeitalter gilt als erreicht, wenn BEIDE Bedingungen erfüllt sind: stats.total.ore >= at und stats.playTime >= minTime (s).
// minTime: 15 min, 4 h, 36 h, 4 Tage, 7 Tage -> alles frühestens nach einer Woche Spielzeit (Offline-Zeit zählt mit).
// Jedes Zeitalter aktiviert neue Forschungen und Generator-Ausbauten.

export const ERAS = [
  { id: 'handcraft', name: 'Handwerk', sym: '🛠️', at: 0, minTime: 0, mult: 1.0, desc: 'Status quo' },
  { id: 'mechanization', name: 'Mechanisierung', sym: '⚙️', at: 3e6, minTime: 900, mult: 1.2, desc: 'Ausbau I, Wasserenergie' },
  { id: 'steam', name: 'Dampfzeitalter', sym: '🚂', at: 1e11, minTime: 14400, mult: 1.3, desc: 'Ausbau II, Dampfmaschine, Bessemer' },
  { id: 'electric', name: 'Elektrifizierung', sym: '⚡', at: 1e15, minTime: 129600, mult: 1.5, desc: 'Ausbau III, Dynamo, Elektrostahl' },
  { id: 'automation', name: 'Automatisierung', sym: '🤖', at: 1e19, minTime: 345600, mult: 1.5, desc: 'Ausbau IV, Fließband, Robotik' },
  { id: 'digital', name: 'Digitalisierung', sym: '💾', at: 1e23, minTime: 604800, mult: 2.0, desc: 'Ausbau V, Mikrochips, Nanotech' },
];

export const EVO_MAX = 5;
export const EVO_AT = [10, 25, 50, 100, 200];         // Generatorenstufe, ab der Ausbau k freigeschaltet
export const EVO_MULT = [1.5, 1.5, 2, 2, 3];         // Multiplikator für genOutputAt je Stufe (kumuliert x27)
export const EVO_COST = [25, 60, 150, 400, 1000];    // Kosten-Multiplikator je Stufe
