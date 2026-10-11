// Prestige "Hochofen-Neuguss": Formel-Parameter, Shop, Meilensteine, Auto-Buyer.
export const PRESTIGE = {
  name: 'Hochofen-Neuguss',
  currency: 'Gussformen',
  icon: '🔥',
  minRun: 1e7,      // Mindest-Erzmenge (in diesem Durchlauf produziert) für den ersten Punkt
  divisor: 1e7,
  exponent: 0.5,    // Punkte = floor(sqrt(runOre / divisor))
  perPoint: 0.1,    // +10 % Produktion je Punkt (gesamt verdient)
};

// kind 'level': mehrstufig, kind 'unlock': einmalig. cost = Basiskosten in Gussformen.
export const SHOP = [
  { id: 'pp_eff',   icon: '🧬', name: 'Legierungskunde',    desc: '+20 % Wirkung deiner Gussformen je Stufe.',                 cost: 3,  growth: 1.8, max: 10 },
  { id: 'pp_gain',  icon: '🏺', name: 'Hochofen-Kapazität', desc: '+10 % Gussformen bei jedem Neuguss je Stufe.',              cost: 4,  growth: 1.9, max: 10 },
  { id: 'click',    icon: '🔨', name: 'Schmiedehand',       desc: '+50 % Klickwert je Stufe.',                                 cost: 2,  growth: 1.7, max: 10 },
  { id: 'start',    icon: '🪨', name: 'Erzvorrat',          desc: 'Starte jeden Durchlauf mit Erz (500 × 3^(Stufe-1)).',       cost: 2,  growth: 2.5, max: 5 },
  { id: 'offline',  icon: '🌙', name: 'Nachtschicht',       desc: '+2 Stunden maximaler Offline-Ertrag je Stufe (Basis 8 h).', cost: 3,  growth: 2,   max: 5 },
  { id: 'golden',   icon: '🍀', name: 'Glücksbringer',      desc: 'Goldene Events 10 % häufiger, Effekte 10 % länger je Stufe.', cost: 5, growth: 2,  max: 5 },
  { id: 'keep',     icon: '📚', name: 'Wissensarchiv',      desc: 'Forschung bleibt beim Neuguss erhalten.',                   cost: 25, growth: 1,   max: 1 },
  { id: 'ab_gens',     icon: '🤖', name: 'Auto-Buyer: Generatoren', desc: 'Kauft automatisch Generator-Stufen.',    cost: 5,  growth: 1, max: 1 },
  { id: 'ab_click',    icon: '🤖', name: 'Auto-Buyer: Spitzhacke',  desc: 'Kauft automatisch Klick-Upgrades.',      cost: 8,  growth: 1, max: 1 },
  { id: 'ab_research', icon: '🤖', name: 'Auto-Buyer: Forschung',   desc: 'Erforscht automatisch verfügbare Technologien.', cost: 15, growth: 1, max: 1 },
  { id: 'ab_boosts',   icon: '🤖', name: 'Auto-Buyer: Boosts',      desc: 'Kauft automatisch Elite-Boosts.',        cost: 20, growth: 1, max: 1 },
  { id: 'ab_speed',    icon: '⏱️', name: 'Auto-Buyer-Takt',         desc: 'Auto-Buyer arbeiten +50 % schneller je Stufe.', cost: 10, growth: 2.5, max: 4 },
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
  { at: 5,    mult: 1.25, desc: 'Produktion ×1,25' },
  { at: 20,   mult: 1.5,  desc: 'Produktion ×1,5' },
  { at: 100,  mult: 2,    desc: 'Produktion ×2' },
  { at: 500,  mult: 3,    desc: 'Produktion ×3' },
  { at: 2500, mult: 5,    desc: 'Produktion ×5' },
  { at: 10000, mult: 10,  desc: 'Produktion ×10' },
];
