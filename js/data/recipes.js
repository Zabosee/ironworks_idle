// Konverter-Rezepte (reine Daten). Ein Rezept wandelt einen Anteil der laufenden Produktion um.
//   req:     Forschungs-IDs, die freigeschaltet sein müssen
//   share:   Anteil der Brutto-Produktion jedes Eingangs, der dem Rezept zugeführt wird (0..1)
//   inputs:  Verbrauch pro Zyklus   { res: menge }
//   outputs: Ertrag pro Zyklus      { res: menge }
//   boosted: (optional, Standard true) Ausgaben werden mit den Forschungs-/Boost-Multiplikatoren der Ausgaberessource
//            multipliziert (researchMult); Prestige/Erfolge/Buffs wirken bereits über die Eingänge. false = Rohmenge.
// Zyklen/s = min über alle Eingänge von (share * Produktion[res] / inputs[res]).
// Rezepte werden in Listenreihenfolge ausgewertet; spätere Rezepte sehen die Ausgänge früherer
// (Kette Kohle -> Koks -> Stahl: Rezepte in dieser Reihenfolge eintragen).
export const RECIPES = [
  { id: 'converter', icon: '♻️', name: 'Auto-Konverter', req: ['converter'], share: 0.2, inputs: { ore: 25 }, outputs: { steel: 1 } },
  // Eisenhütten-Kette: Kohle -> Koks -> (Erz + Koks) -> Stahl, Kupfer + Mangan -> Legierung, Legierung + Chrom + Nickel -> Wolfram -> Gold
  { id: 'coking',    icon: '🧱', name: 'Verkokung',        req: ['coking'],      share: 0.4,  inputs: { coal: 5 },                        outputs: { coke: 1 } },
  { id: 'blast',     icon: '🌋', name: 'Hochofen',         req: ['blastfurnace'], share: 0.3, inputs: { ore: 12, coke: 1 },               outputs: { steel: 4 } },
  { id: 'alloying',  icon: '🧬', name: 'Legierungsmischen', req: ['alloying'],   share: 0.5,  inputs: { copper: 3, manganese: 1 },        outputs: { alloy: 1 } },
  { id: 'tungsten',  icon: '☢️', name: 'Wolfram-Veredelung', req: ['tungsten'],  share: 0.3,  inputs: { alloy: 8, chrome: 2, nickel: 2 }, outputs: { tungsten: 1 } },
  { id: 'goldsmelt', icon: '👑', name: 'Goldschmelze',     req: ['goldsmith'],   share: 0.25, inputs: { tungsten: 20 },                   outputs: { gold: 1 } },
  // Konzern-Kette (Ausbau 2): spätere Rezepte sehen die Ausgänge früherer (Wolfram-Netto nach der Goldschmelze)
  { id: 'sinter',    icon: '🔶', name: 'Hartmetall-Sinterung',    req: ['c_sinter'], share: 0.3,  inputs: { tungsten: 6, cobalt: 2 },                outputs: { carbide: 1 } },
  { id: 'platinref', icon: '⚪', name: 'Platin-Raffination',      req: ['c_platin'], share: 0.3,  inputs: { nickel: 10, gold: 1 },                   outputs: { platinum: 1 } },
  { id: 'iridsep',   icon: '💠', name: 'Iridium-Abscheidung',     req: ['c_iridium'], share: 0.25, inputs: { platinum: 10, molybdenum: 4 },          outputs: { iridium: 1 } },
  { id: 'supercast', icon: '🔷', name: 'Superlegierungs-Guss',    req: ['c_super'],  share: 0.4,  inputs: { carbide: 6, iridium: 1, vanadium: 3 },   outputs: { superalloy: 1 } },
];
export const RECIPE_MAP = Object.fromEntries(RECIPES.map(r => [r.id, r]));
