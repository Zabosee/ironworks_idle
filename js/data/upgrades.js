// Wiederholbare Klick-Upgrades (Liste) und einmalige Elite-Boosts. Beide laufen über die Werkbank-Warteschlange.
// Klickwert-Beitrag eines Upgrades auf Stufe n: (base + perLevel * n) * milestone(n).
// Die Beiträge aller Upgrades werden addiert (core/formulas.js: clickBaseTotal).
//   Kosten: entweder die festen Felder des Basis-Upgrades (oreBase/steelFrom/eliteFrom ...) oder `costs`:
//           [{ res, base, growth, from? }] = base * growth^(Stufe - from), ab Stufe `from` (Standard 0).
//   time:   Dauer in Sekunden je Stufe = min(max, base * growth^Stufe)
//   req:    Forschungs-IDs, die das Upgrade freischalten
export const CLICKS = [
  {
    id: 'click', icon: '⛏️', name: 'Verstärkte Spitzhacke',
    base: 1, perLevel: 2,
    oreBase: 25, oreGrowth: 1.5,
    steelFrom: 2, steelBase: 2, steelGrowth: 1.45,   // ab Stufe 2 zusätzlich Stahl
    eliteFrom: 10, eliteBase: 3,                      // ab Stufe 10 zusätzlich Titan
    time: { base: 5, growth: 1.12, max: 240 },
  },
  {
    id: 'sledge', icon: '🔨', name: 'Vorschlaghammer', req: ['metallurgy'],
    base: 0, perLevel: 10,
    costs: [{ res: 'steel', base: 300, growth: 1.55 }, { res: 'titan', base: 5, growth: 1.5, from: 5 }],
    time: { base: 10, growth: 1.15, max: 420 },
  },
  {
    id: 'pneumatic', icon: '💨', name: 'Koks-Presslufthammer', req: ['blastfurnace'],
    base: 0, perLevel: 150,
    costs: [{ res: 'steel', base: 5e4, growth: 1.6 }, { res: 'coke', base: 300, growth: 1.5 }],
    time: { base: 40, growth: 1.15, max: 900 },
  },
  {
    id: 'tungstenhead', icon: '🔱', name: 'Wolfram-Spitze', req: ['tungsten'],
    base: 0, perLevel: 6000,
    costs: [{ res: 'titan', base: 2e4, growth: 1.6 }, { res: 'tungsten', base: 100, growth: 1.5 }],
    time: { base: 120, growth: 1.15, max: 1500 },
  },
];
export const CLICK_MAP = Object.fromEntries(CLICKS.map(c => [c.id, c]));

//   Boost: cost (einmalig), mult (Produktionsmultiplikator), time (Sekunden), req (Forschungs-IDs, optional)
export const BOOSTS = [
  { id: 'diamond',   icon: '💠', name: 'Diamantbohrer',   desc: 'Erzproduktion ×2.',       cost: { steel: 150, titan: 5 },     mult: { ore: 2 },   time: 15 },
  { id: 'turbo',     icon: '🌀', name: 'Hochofen-Turbo',  desc: 'Stahlproduktion ×2.',     cost: { steel: 500, titan: 20 },    mult: { steel: 2 }, time: 25 },
  { id: 'press',     icon: '🗜️', name: 'Quantenpresse',   desc: 'Titanproduktion ×2.',     cost: { steel: 2000, titan: 60 },   mult: { titan: 2 }, time: 45 },
  { id: 'overclock', icon: '⚡', name: 'Overclocking',    desc: 'Alle Materialien ×1,5.',  cost: { ore: 5e5, titan: 150 },     mult: { all: 1.5 }, time: 90 },
  { id: 'magnet',    icon: '🧲', name: 'Magnetscheider',  desc: 'Erzproduktion ×2.',       cost: { steel: 5e4, titan: 800 },   mult: { ore: 2 },   time: 150 },
  { id: 'cryo',      icon: '❄️', name: 'Kryo-Veredelung', desc: 'Titanproduktion ×2.',     cost: { steel: 2e5, titan: 2500 },  mult: { titan: 2 }, time: 240 },

  // Eisenhütten-Kette (Phase 2b)
  { id: 'conveyor',  icon: '🛤️', name: 'Zechen-Förderband',      desc: 'Kohleproduktion ×2.',      cost: { steel: 2000, coal: 500 },                      mult: { coal: 2 },      time: 20,  req: ['coalmining'] },
  { id: 'quench',    icon: '🚿', name: 'Koks-Löschanlage',       desc: 'Koksproduktion ×2.',       cost: { steel: 8000, coke: 300 },                      mult: { coke: 2 },      time: 35,  req: ['coking'] },
  { id: 'sinter',    icon: '🔥', name: 'Sinteranlage',           desc: 'Erzproduktion ×2.',        cost: { steel: 1e5, coke: 2000 },                      mult: { ore: 2 },       time: 80,  req: ['blastfurnace'] },
  { id: 'electro',   icon: '🔋', name: 'Kupferelektrolyse',      desc: 'Kupferproduktion ×2.',     cost: { steel: 5e4, copper: 800 },                     mult: { copper: 2 },    time: 60,  req: ['copperworks'] },
  { id: 'manganin',  icon: '🧰', name: 'Mangan-Härtung',         desc: 'Stahlproduktion ×1,5, Manganproduktion ×2.', cost: { steel: 1e5, manganese: 500 }, mult: { steel: 1.5, manganese: 2 }, time: 120, req: ['manganese'] },
  { id: 'mixcat',    icon: '🧫', name: 'Mischer-Katalysator',    desc: 'Legierungsproduktion ×2.', cost: { copper: 5000, manganese: 2000, alloy: 100 },   mult: { alloy: 2 },     time: 200, req: ['alloying'] },
  { id: 'plating',   icon: '🪞', name: 'Verchromung',            desc: 'Alle Materialien ×1,25.',  cost: { steel: 5e5, chrome: 1000, nickel: 500 },       mult: { all: 1.25 },    time: 300, req: ['chromium'] },
  { id: 'superalloy', icon: '🛡️', name: 'Nickel-Superlegierung', desc: 'Titanproduktion ×2.',      cost: { titan: 5000, nickel: 1000, alloy: 300 },       mult: { titan: 2 },     time: 420, req: ['chromium'] },
  { id: 'carbide',   icon: '💿', name: 'Wolframkarbid-Bohrer',   desc: 'Erzproduktion ×3.',        cost: { titan: 2e4, tungsten: 200 },                   mult: { ore: 3 },       time: 600, req: ['tungsten'] },
  { id: 'goldplate', icon: '🏅', name: 'Goldveredelung',         desc: 'Alle Materialien ×2.',     cost: { tungsten: 500, gold: 50 },                     mult: { all: 2 },       time: 900, req: ['goldsmith'] },
];
export const BOOST_MAP = Object.fromEntries(BOOSTS.map(b => [b.id, b]));
