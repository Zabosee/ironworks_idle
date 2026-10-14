// Prestige "Hochofen-Neuguss": Formel-Parameter, Shop, Meilensteine, Auto-Buyer.
export const PRESTIGE = {
  name: 'Hochofen-Neuguss',
  currency: 'Gussformen',
  sym: 'flame',
  icon: '🔥',
  divisor: 1e7,     // Erz (in diesem Durchlauf) für die erste Gussform
  growth: 1.05,     // jede weitere Gussform braucht ×growth so viel Erz: Bedarf(n) = divisor * growth^(n-1)
  perPoint: 0.1,    // +10 % Produktion je Punkt (gesamt verdient)
};

// kind 'level': mehrstufig, kind 'unlock': einmalig. cost = Basiskosten in Gussformen.
export const SHOP = [
  { id: 'pp_eff',   sym: 'dna', icon: '🧬', name: 'Legierungskunde',    desc: '+20 % Wirkung deiner Gussformen je Stufe.',                 cost: 3,  growth: 2,   max: 10 },
  { id: 'pp_gain',  sym: 'urn', icon: '🏺', name: 'Hochofen-Kapazität', desc: '+10 % Gussformen bei jedem Neuguss je Stufe.',              cost: 4,  growth: 2.1, max: 10 },
  { id: 'click',    sym: 'hammer', icon: '🔨', name: 'Schmiedehand',       desc: '+50 % Klickwert je Stufe.',                                 cost: 2,  growth: 1.9, max: 10 },
  { id: 'start',    sym: 'rock', icon: '🪨', name: 'Erzvorrat',          desc: 'Starte jeden Durchlauf mit Erz (500 × 3^(Stufe-1)).',       cost: 2,  growth: 2.5, max: 5 },
  { id: 'offline',  sym: 'moon', icon: '🌙', name: 'Nachtschicht',       desc: '+2 Stunden maximaler Offline-Ertrag je Stufe (Basis 8 h).', cost: 3,  growth: 2,   max: 5 },
  { id: 'golden',   sym: 'clover', icon: '🍀', name: 'Glücksbringer',      desc: 'Goldene Events 10 % häufiger, Effekte 10 % länger je Stufe.', cost: 5, growth: 2,  max: 5 },
  { id: 'keep',     sym: 'books', icon: '📚', name: 'Wissensarchiv',      desc: 'Forschung bleibt beim Neuguss erhalten.',                   cost: 100, growth: 1,  max: 1 },
  { id: 'q_lab',     sym: 'petri', icon: '🧫', name: 'Zusatz-Laborplatz',   desc: '+1 gleichzeitig laufende Forschung je Stufe.',               cost: 20, growth: 2.5, max: 3 },
  { id: 'q_work',    sym: 'wrench', icon: '🛠️', name: 'Zusatz-Werkbank',     desc: '+1 gleichzeitig laufendes Upgrade/Boost je Stufe.',          cost: 15, growth: 2.5, max: 3 },
  { id: 'q_speed',   sym: 'stopwatch', icon: '⏲️', name: 'Zeitraffer',          desc: 'Forschung, Boosts und Klick-Upgrades dauern 8 % kürzer je Stufe.', cost: 5, growth: 2.2, max: 6 },
  { id: 'ab_gens',     sym: 'robot', icon: '🤖', name: 'Auto-Buyer: Generatoren', desc: 'Kauft automatisch Generator-Stufen.',    cost: 30, growth: 1, max: 1 },
  { id: 'ab_click',    sym: 'robot', icon: '🤖', name: 'Auto-Buyer: Spitzhacke',  desc: 'Kauft automatisch Klick-Upgrades.',      cost: 50, growth: 1, max: 1 },
  { id: 'ab_research', sym: 'robot', icon: '🤖', name: 'Auto-Buyer: Forschung',   desc: 'Erforscht automatisch verfügbare Technologien.', cost: 120, growth: 1, max: 1 },
  { id: 'ab_boosts',   sym: 'robot', icon: '🤖', name: 'Auto-Buyer: Boosts',      desc: 'Kauft automatisch Elite-Boosts.',        cost: 200, growth: 1, max: 1 },
  { id: 'ab_speed',    sym: 'clock', icon: '⏱️', name: 'Auto-Buyer-Takt',         desc: 'Auto-Buyer arbeiten +50 % schneller je Stufe.', cost: 30, growth: 3, max: 4 },
];
export const SHOP_MAP = Object.fromEntries(SHOP.map(s => [s.id, s]));

// Auto-Buyer (freigeschaltet durch den jeweiligen Shop-Eintrag)
export const AUTOBUYERS = [
  { id: 'gens',     name: 'Generatoren', unlock: 'ab_gens' },
  { id: 'click',    name: 'Spitzhacke',  unlock: 'ab_click' },
  { id: 'research', name: 'Forschung',   unlock: 'ab_research' },
  { id: 'boosts',   name: 'Boosts',      unlock: 'ab_boosts' },
];
export const AUTOBUYER_INTERVAL = 2; // Sekunden Basis-Takt

// Meilensteine auf Basis der insgesamt verdienten Gussformen
export const MILESTONES = [
  { at: 5,      mult: 1.25, desc: 'Produktion ×1,25' },
  { at: 25,     mult: 1.5,  desc: 'Produktion ×1,5' },
  { at: 150,    mult: 2,    desc: 'Produktion ×2' },
  { at: 1000,   mult: 3,    desc: 'Produktion ×3' },
  { at: 10000,  mult: 5,    desc: 'Produktion ×5' },
  { at: 250000, mult: 10,   desc: 'Produktion ×10' },
];
export const HISTORY_MAX = 10;   // Einträge der Neuguss-Chronik

// Schwerpunkt ("Fokus") für den NÄCHSTEN Durchlauf: wird vor dem Neuguss gewählt (state.focusNext), mit dem Neuguss aktiv (state.focus),
// Konzerngründung setzt beides zurück. +FOCUS_BONUS Produktion auf die Materialien der gewählten Kette, -FOCUS_MALUS auf die der anderen (Erz bleibt neutral).
export const FOCUS_BONUS = 0.25;
export const FOCUS_MALUS = 0.05;
export const FOCUS = [
  { id: 'steel', name: 'Stahlschmiede', desc: 'Stahlkette: Stahl, Kohle, Koks, Kupfer, Mangan, Vanadium.',
    res: ['steel', 'coal', 'coke', 'copper', 'manganese', 'vanadium'] },
  { id: 'titan', name: 'Titanofen', desc: 'Titankette: Titan, Chrom, Nickel, Legierung, Kobalt, Molybdän, Hartmetall.',
    res: ['titan', 'chrome', 'nickel', 'alloy', 'cobalt', 'molybdenum', 'carbide'] },
  { id: 'gold', name: 'Goldguss', desc: 'Edelkette: Gold, Wolfram, Platin, Iridium, Superlegierung.',
    res: ['gold', 'tungsten', 'platinum', 'iridium', 'superalloy'] },
];
export const FOCUS_MAP = Object.fromEntries(FOCUS.map(f => [f.id, f]));
export const FOCUS_RES = new Set(FOCUS.flatMap(f => f.res));
export const FOCUS_DEFAULT = 'steel';   // feste Wahl des Balance-Bots
