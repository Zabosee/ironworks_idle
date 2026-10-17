// Zweite Reset-Ebene "Konzerngründung" (GAME-DESIGN.md B3): Formel-Parameter, Konzern-Shop, Konzernstufen.
// Nachkalibriert mit capPerHour 0,68 (tools/balance-full.mjs): Bot (Gründung alle 40 h) ALLES bei 602,3 h, K1..K7 bei 34/114/194/274/394/514/594 h; schnellste gemessene Spielweise 537-538 h (workHold, minRun 15, hold 7200, Gründung alle 17,7 h); Untergrenze 351/0,68 = 516 h. Patente = min(Wurzel, Zeitdeckel), siehe corpGainParts in formulas.js.
export const CORP = {
  name: 'Konzerngründung',
  currency: 'Patente',
  sym: 'corp',
  icon: '🏢',
  unlockCount: 100,   // freigeschaltet ab so vielen Neugüssen (prestige.count, bleibt über die Gründung erhalten)
  divisor: 1500,      // D der Wurzelformel (Schritt 13: linear 52.000 -> konkav, D11/D12): raw = floor(sqrt(Gussformen im Konzernlauf / divisor) × (1 + 0,1 × Stufe c_gain))
  capPerHour: 0.68,   // Kalibrierung D11: Untergrenze der schnellsten Spielweise 351 (Shop-Summe) / 0,68 = 516 h (>= 504 h), Bot ca. 600 h. Zeitlicher Deckel: höchstens floor(capPerHour × Stunden seit der letzten Gründung) Patente je Gründung (stats.corpRunTime)
  perPoint: 0.02,     // +2 % Produktion je Patent (gesamt verdient), skaliert mit c_eff
};
export const CORP_HISTORY_MAX = 10;   // Einträge der Gründungs-Chronik

// Konzern-Shop (Patente). Kosten Stufe n+1 = ceil(cost × growth^n); `costs` = feste Liste je Stufe (c_heir). Summe aller Stufen = 351 (Kosten x1,705 gegenüber Schritt 6, D11 Hebel 2; Dezimalwerte werden in corpCost mit ceil gerundet).
export const CORP_SHOP = [
  { id: 'c_eff',      sym: 'share',       icon: '📊', name: 'Aktienmehrheit',          desc: '+20 % Wirkung der Patente je Stufe.',                                                           cost: 5.115,  growth: 1.5, max: 4 },
  { id: 'c_gain',     sym: 'license',     icon: '📄', name: 'Lizenzgebühren',          desc: '+10 % Patente je Konzerngründung je Stufe.',                                                    cost: 3.41,  growth: 1.5, max: 4 },
  { id: 'c_cast',     sym: 'moldfactory', icon: '🏭', name: 'Gussformen-Fabrik',       desc: '+15 % Gussformen je Neuguss je Stufe.',                                                         cost: 6.82,  growth: 1.5, max: 4 },
  { id: 'c_heir',     sym: 'heir',        icon: '👑', name: 'Hochofen-Erbe',           desc: 'Jeder Konzernlauf beginnt mit einem Gussformen-Stand von 5 / 150 / 1.000 / 10.000 / 250.000 (Stufe 1 bis 5) für Multiplikator und Meilensteine.', costs: [3, 7, 12, 20, 34], max: 5 },
  { id: 'c_archive',  sym: 'archive',     icon: '🗄️', name: 'Konzernarchiv',           desc: 'Normale Forschung bleibt beim Neuguss erhalten.',                                               cost: 10.23,  growth: 1,   max: 1 },
  { id: 'c_auto',     sym: 'robot',       icon: '🤖', name: 'Konzern-Automatisierung', desc: 'Schaltet je Stufe einen Auto-Buyer dauerhaft frei (Generatoren, Spitzhacke, Forschung, Boosts).', cost: 6.82,  growth: 1.3, max: 4 },
  { id: 'c_offline',  sym: 'moon',        icon: '🌙', name: 'Nachtschicht II',         desc: '+4 Stunden maximaler Offline-Ertrag je Stufe.',                                                 cost: 5.115,  growth: 2,   max: 3 },
  { id: 'c_autocast', sym: 'autocast',    icon: '🔁', name: 'Auto-Neuguss',            desc: 'Schaltet den automatischen Neuguss frei.',                                                      cost: 17.05, growth: 1,   max: 1 },
  { id: 'c_click',    sym: 'finger',      icon: '👆', name: 'Konzern-Schmiedehand',    desc: '+50 % Klickwert je Stufe.',                                                                     cost: 3.41,  growth: 1.6, max: 4 },
];
export const CORP_SHOP_MAP = Object.fromEntries(CORP_SHOP.map(s => [s.id, s]));

// Konzernstufen K1 bis K7 auf Basis der insgesamt verdienten Patente (corp.total); mult wirkt auf alle Ausgaben
export const CORP_MILESTONES = [
  { at: 10,   mult: 1.1,  desc: 'Produktion ×1,1' },
  { at: 30,   mult: 1.1,  desc: 'Produktion ×1,1' },
  { at: 70,  mult: 1.15, desc: 'Produktion ×1,15' },
  { at: 135,  mult: 1.15, desc: 'Produktion ×1,15' },
  { at: 210,  mult: 1.2,  desc: 'Produktion ×1,2' },
  { at: 290, mult: 1.2,  desc: 'Produktion ×1,2' },
  { at: 351, mult: 1.5,  desc: 'Produktion ×1,5' },
];

// Hochofen-Erbe: Mindest-Gussformenstand je Stufe (Index = Stufe von c_heir)
export const HEIR_FLOOR = [0, 5, 150, 1000, 10000, 250000];

// Auto-Neuguss
export const AUTOCAST = { minRun: 60, minRunFloor: 10, history: 5 };   // minRun: Vorgabe-Mindestlaufzeit (s), einstellbar ab minRunFloor
