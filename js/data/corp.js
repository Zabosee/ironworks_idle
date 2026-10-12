// Zweite Reset-Ebene "Konzerngründung" (GAME-DESIGN-2.md Abschnitt 3): Formel-Parameter, Konzern-Shop, Konzernstufen.
// Zahlen sind Startwerte; D_CORP und die Schwellen werden in Schritt 6 kalibriert.
export const CORP = {
  name: 'Konzerngründung',
  currency: 'Patente',
  sym: 'corp',
  icon: '🏢',
  unlockCount: 100,   // freigeschaltet ab so vielen Neugüssen (prestige.count, bleibt über die Gründung erhalten)
  divisor: 34000,     // Patente = floor(Gussformen im Konzernlauf / divisor × (1 + 0,1 × Stufe c_gain))
  perPoint: 0.02,     // +2 % Produktion je Patent (gesamt verdient), skaliert mit c_eff
};
export const CORP_HISTORY_MAX = 10;   // Einträge der Gründungs-Chronik

// Konzern-Shop (Patente). Kosten Stufe n+1 = ceil(cost × growth^n); `costs` = feste Liste je Stufe (c_heir). Summe aller Stufen = 205.
export const CORP_SHOP = [
  { id: 'c_eff',      sym: 'share',       icon: '📊', name: 'Aktienmehrheit',          desc: '+20 % Wirkung der Patente je Stufe.',                                                           cost: 3,  growth: 1.5, max: 4 },
  { id: 'c_gain',     sym: 'license',     icon: '📄', name: 'Lizenzgebühren',          desc: '+10 % Patente je Konzerngründung je Stufe.',                                                    cost: 2,  growth: 1.5, max: 4 },
  { id: 'c_cast',     sym: 'moldfactory', icon: '🏭', name: 'Gussformen-Fabrik',       desc: '+15 % Gussformen je Neuguss je Stufe.',                                                         cost: 4,  growth: 1.5, max: 4 },
  { id: 'c_heir',     sym: 'heir',        icon: '👑', name: 'Hochofen-Erbe',           desc: 'Jeder Konzernlauf beginnt mit einem Gussformen-Stand von 5 / 150 / 1.000 / 10.000 / 250.000 (Stufe 1 bis 5) für Multiplikator und Meilensteine.', costs: [2, 4, 7, 12, 20], max: 5 },
  { id: 'c_archive',  sym: 'archive',     icon: '🗄️', name: 'Konzernarchiv',           desc: 'Normale Forschung bleibt beim Neuguss erhalten.',                                               cost: 6,  growth: 1,   max: 1 },
  { id: 'c_auto',     sym: 'robot',       icon: '🤖', name: 'Konzern-Automatisierung', desc: 'Schaltet je Stufe einen Auto-Buyer dauerhaft frei (Generatoren, Spitzhacke, Forschung, Boosts).', cost: 4,  growth: 1.3, max: 4 },
  { id: 'c_offline',  sym: 'moon',        icon: '🌙', name: 'Nachtschicht II',         desc: '+4 Stunden maximaler Offline-Ertrag je Stufe.',                                                 cost: 3,  growth: 2,   max: 3 },
  { id: 'c_autocast', sym: 'autocast',    icon: '🔁', name: 'Auto-Neuguss',            desc: 'Schaltet den automatischen Neuguss frei.',                                                      cost: 10, growth: 1,   max: 1 },
  { id: 'c_click',    sym: 'finger',      icon: '👆', name: 'Konzern-Schmiedehand',    desc: '+50 % Klickwert je Stufe.',                                                                     cost: 2,  growth: 1.6, max: 4 },
];
export const CORP_SHOP_MAP = Object.fromEntries(CORP_SHOP.map(s => [s.id, s]));

// Konzernstufen K1 bis K7 auf Basis der insgesamt verdienten Patente (corp.total); mult wirkt auf alle Ausgaben
export const CORP_MILESTONES = [
  { at: 5,   mult: 1.1,  desc: 'Produktion ×1,1' },
  { at: 20,  mult: 1.1,  desc: 'Produktion ×1,1' },
  { at: 45,  mult: 1.15, desc: 'Produktion ×1,15' },
  { at: 75,  mult: 1.15, desc: 'Produktion ×1,15' },
  { at: 110, mult: 1.2,  desc: 'Produktion ×1,2' },
  { at: 150, mult: 1.2,  desc: 'Produktion ×1,2' },
  { at: 205, mult: 1.5,  desc: 'Produktion ×1,5' },
];

// Hochofen-Erbe: Mindest-Gussformenstand je Stufe (Index = Stufe von c_heir)
export const HEIR_FLOOR = [0, 5, 150, 1000, 10000, 250000];

// Auto-Neuguss
export const AUTOCAST = { minRun: 60, defaultMinutes: 10, history: 5, modes: ['gain', 'time'] };
