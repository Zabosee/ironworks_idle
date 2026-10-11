// Konverter-Rezepte (reine Daten). Ein Rezept wandelt einen Anteil der laufenden Produktion um.
//   req:     Forschungs-IDs, die freigeschaltet sein müssen
//   share:   Anteil der Brutto-Produktion jedes Eingangs, der dem Rezept zugeführt wird (0..1)
//   inputs:  Verbrauch pro Zyklus   { res: menge }
//   outputs: Ertrag pro Zyklus      { res: menge }
// Zyklen/s = min über alle Eingänge von (share * Produktion[res] / inputs[res]).
// Rezepte werden in Listenreihenfolge ausgewertet; spätere Rezepte sehen die Ausgänge früherer
// (Kette Kohle -> Koks -> Stahl: Rezepte in dieser Reihenfolge eintragen).
export const RECIPES = [
  { id: 'converter', icon: '♻️', name: 'Auto-Konverter', req: ['converter'], share: 0.2, inputs: { ore: 25 }, outputs: { steel: 1 } },
];
export const RECIPE_MAP = Object.fromEntries(RECIPES.map(r => [r.id, r]));
