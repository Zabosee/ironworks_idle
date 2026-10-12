// Industrie-Meilensteine (GAME-DESIGN-2.md 2.3): zwei automatische Leisten, kostenlos, global multiplikativ.
// Der Wert wird aus dem Spielstand abgeleitet (nichts gespeichert); `value(state)` ist rein. Schwellen sind Startwerte (Schritt 6).
//   log: Fortschritt zur nächsten Stufe logarithmisch (Erz) statt linear (Anzahl).
const ownedMaterials = s => Object.values(s.stats.total).filter(v => v > 0).length;

export const INDUSTRY_TRACKS = [
  { id: 'output', name: 'Fördermenge', log: true, value: s => s.stats.total.ore,
    steps: [
      { at: 1e12, mult: 1.05 }, { at: 1e15, mult: 1.05 }, { at: 1e18, mult: 1.05 }, { at: 1e21, mult: 1.10 },
      { at: 1e24, mult: 1.10 }, { at: 1e25, mult: 1.10 }, { at: 1e26, mult: 1.15 }, { at: 1e27, mult: 1.15 },
    ] },
  // Stufen B4 bis B7 (14 bis 19 Materialien) werden erst mit den 7 neuen Materialien (Schritt 4) erreichbar.
  { id: 'variety', name: 'Materialvielfalt', log: false, value: ownedMaterials,
    steps: [
      { at: 6, mult: 1.05 }, { at: 9, mult: 1.05 }, { at: 12, mult: 1.10 }, { at: 14, mult: 1.10 },
      { at: 16, mult: 1.15 }, { at: 18, mult: 1.15 }, { at: 19, mult: 1.25 },
    ] },
];
