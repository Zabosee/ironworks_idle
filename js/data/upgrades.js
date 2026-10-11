// Wiederholbares Klick-Upgrade und einmalige Elite-Boosts.
export const CLICK = {
  id: 'click', icon: '⛏️', name: 'Verstärkte Spitzhacke',
  oreBase: 25, oreGrowth: 1.5,
  steelFrom: 2, steelBase: 2, steelGrowth: 1.45,   // ab Stufe 2 zusätzlich Stahl
  eliteFrom: 10, eliteBase: 3,                      // ab Stufe 10 zusätzlich Titan
};

export const BOOSTS = [
  { id: 'diamond',   icon: '💠', name: 'Diamantbohrer',   desc: 'Erzproduktion ×2.',       cost: { steel: 150, titan: 5 },     mult: { ore: 2 } },
  { id: 'turbo',     icon: '🌀', name: 'Hochofen-Turbo',  desc: 'Stahlproduktion ×2.',     cost: { steel: 500, titan: 20 },    mult: { steel: 2 } },
  { id: 'press',     icon: '🗜️', name: 'Quantenpresse',   desc: 'Titanproduktion ×2.',     cost: { steel: 2000, titan: 60 },   mult: { titan: 2 } },
  { id: 'overclock', icon: '⚡', name: 'Overclocking',    desc: 'Alle Materialien ×1,5.',  cost: { ore: 5e5, titan: 150 },     mult: { all: 1.5 } },
  { id: 'magnet',    icon: '🧲', name: 'Magnetscheider',  desc: 'Erzproduktion ×2.',       cost: { steel: 5e4, titan: 800 },   mult: { ore: 2 } },
  { id: 'cryo',      icon: '❄️', name: 'Kryo-Veredelung', desc: 'Titanproduktion ×2.',     cost: { steel: 2e5, titan: 2500 },  mult: { titan: 2 } },
];
export const BOOST_MAP = Object.fromEntries(BOOSTS.map(b => [b.id, b]));
