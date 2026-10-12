// Wiederholbare Klick-Upgrades (Liste) und einmalige Elite-Boosts. Beide laufen über die Werkbank-Warteschlange.
// Klickwert-Beitrag eines Upgrades auf Stufe n: (base + perLevel * n) * milestone(n).
// Die Beiträge aller Upgrades werden addiert (core/formulas.js: clickBaseTotal).
//   Kosten: entweder die festen Felder des Basis-Upgrades (oreBase/steelFrom/eliteFrom ...) oder `costs`:
//           [{ res, base, growth, from? }] = base * growth^(Stufe - from), ab Stufe `from` (Standard 0).
//   time:   Dauer in Sekunden je Stufe = min(max, base * growth^Stufe)
//   req:    Forschungs-IDs, die das Upgrade freischalten; era: optionales Zeitalter-Tor (Index in ERAS)
export const CLICKS = [
  {
    id: 'click', sym: 'pickaxe', icon: '⛏️', name: 'Verstärkte Spitzhacke',
    base: 1, perLevel: 2,
    oreBase: 25, oreGrowth: 1.5,
    steelFrom: 2, steelBase: 2, steelGrowth: 1.45,   // ab Stufe 2 zusätzlich Stahl
    eliteFrom: 10, eliteBase: 3,                      // ab Stufe 10 zusätzlich Titan
    time: { base: 5, growth: 1.12, max: 240 },
  },
  {
    id: 'sledge', sym: 'hammer', icon: '🔨', name: 'Vorschlaghammer', req: ['metallurgy'],
    base: 0, perLevel: 10,
    costs: [{ res: 'steel', base: 300, growth: 1.55 }, { res: 'titan', base: 5, growth: 1.5, from: 5 }],
    time: { base: 10, growth: 1.15, max: 420 },
  },
  {
    id: 'pneumatic', sym: 'jackhammer', icon: '💨', name: 'Koks-Presslufthammer', req: ['blastfurnace'],
    base: 0, perLevel: 150,
    costs: [{ res: 'steel', base: 5e4, growth: 1.6 }, { res: 'coke', base: 300, growth: 1.5 }],
    time: { base: 40, growth: 1.15, max: 900 },
  },
  {
    id: 'tungstenhead', sym: 'trident', icon: '🔱', name: 'Wolfram-Spitze', req: ['tungsten'],
    base: 0, perLevel: 6000,
    costs: [{ res: 'titan', base: 2e4, growth: 1.6 }, { res: 'tungsten', base: 100, growth: 1.5 }],
    time: { base: 120, growth: 1.15, max: 1500 },
  },
  {
    id: 'hydraulic', sym: 'cylinder', icon: '🔧', name: 'Hydraulikramme', req: ['ore_3'], era: 1,
    base: 0, perLevel: 2e5,
    costs: [{ res: 'steel', base: 5e15, growth: 1.6 }, { res: 'titan', base: 5e15, growth: 1.5, from: 3 }],
    time: { base: 200, growth: 1.15, max: 1500 },
  },
  {
    id: 'plasmalance', sym: 'lance', icon: '🚀', name: 'Plasmalanze', req: ['proc_3'], era: 3,
    base: 0, perLevel: 5e8,
    costs: [{ res: 'steel', base: 5e20, growth: 1.7 }, { res: 'tungsten', base: 5e20, growth: 1.55 }],
    time: { base: 400, growth: 1.15, max: 1800 },
  },
  {
    id: 'carbidechisel', sym: 'chisel', icon: '⚒️', name: 'Hartmetall-Meißel', req: ['c_tool'], corp: 2,
    base: 0, perLevel: 3e11,
    costs: [{ res: 'steel', base: 1e22, growth: 1.7 }, { res: 'carbide', base: 4.4e9, growth: 1.5 }],
    time: { base: 600, growth: 1.15, max: 2400 },
  },
  {
    id: 'iridiumram', sym: 'ram', icon: '🔨', name: 'Iridium-Ramme', req: ['c_iridium'], era: 6, corp: 5,
    base: 0, perLevel: 5e14,
    costs: [{ res: 'steel', base: 3e24, growth: 1.7 }, { res: 'iridium', base: 1.9e11, growth: 1.55 }],
    time: { base: 600, growth: 1.15, max: 2400 },
  },
  {
    id: 'superhammer', sym: 'sledge', icon: '🛠️', name: 'Superlegierungs-Schlägel', req: ['c_super'], era: 7, corp: 6,
    base: 0, perLevel: 2e18,
    costs: [{ res: 'steel', base: 1e26, growth: 1.7 }, { res: 'superalloy', base: 9.3e11, growth: 1.55 }],
    time: { base: 600, growth: 1.15, max: 2400 },
  },
];
export const CLICK_MAP = Object.fromEntries(CLICKS.map(c => [c.id, c]));

//   mult-Schlüssel: Ressourcen-ID | all | click (Klickwert) | autoclick (Autoklick-Anteil)
//   Boost: cost (einmalig), mult (Produktionsmultiplikator), time (Sekunden), req (Forschungs-IDs, optional)
export const BOOSTS = [
  { id: 'diamond',   sym: 'gem', icon: '💠', name: 'Diamantbohrer',   desc: 'Erzproduktion ×2.',       cost: { steel: 150, titan: 5 },     mult: { ore: 2 },   time: 15 },
  { id: 'turbo',     sym: 'turbine', icon: '🌀', name: 'Hochofen-Turbo',  desc: 'Stahlproduktion ×2.',     cost: { steel: 500, titan: 20 },    mult: { steel: 2 }, time: 25 },
  { id: 'press',     sym: 'press', icon: '🗜️', name: 'Quantenpresse',   desc: 'Titanproduktion ×2.',     cost: { steel: 2000, titan: 60 },   mult: { titan: 2 }, time: 45 },
  { id: 'overclock', sym: 'bolt', icon: '⚡', name: 'Overclocking',    desc: 'Alle Materialien ×1,5.',  cost: { ore: 5e5, titan: 150 },     mult: { all: 1.5 }, time: 90 },
  { id: 'magnet',    sym: 'magnet', icon: '🧲', name: 'Magnetscheider',  desc: 'Erzproduktion ×2.',       cost: { steel: 5e4, titan: 800 },   mult: { ore: 2 },   time: 150 },
  { id: 'cryo',      sym: 'snowflake', icon: '❄️', name: 'Kryo-Veredelung', desc: 'Titanproduktion ×2.',     cost: { steel: 2e5, titan: 2500 },  mult: { titan: 2 }, time: 240 },

  // Eisenhütten-Kette (Phase 2b)
  { id: 'conveyor',  sym: 'conveyor', icon: '🛤️', name: 'Zechen-Förderband',      desc: 'Kohleproduktion ×2.',      cost: { steel: 2000, coal: 500 },                      mult: { coal: 2 },      time: 20,  req: ['coalmining'] },
  { id: 'quench',    sym: 'shower', icon: '🚿', name: 'Koks-Löschanlage',       desc: 'Koksproduktion ×2.',       cost: { steel: 8000, coke: 300 },                      mult: { coke: 2 },      time: 35,  req: ['coking'] },
  { id: 'sinter',    sym: 'flame', icon: '🔥', name: 'Sinteranlage',           desc: 'Erzproduktion ×2.',        cost: { steel: 1e5, coke: 2000 },                      mult: { ore: 2 },       time: 80,  req: ['blastfurnace'] },
  { id: 'electro',   sym: 'battery', icon: '🔋', name: 'Kupferelektrolyse',      desc: 'Kupferproduktion ×2.',     cost: { steel: 5e4, copper: 800 },                     mult: { copper: 2 },    time: 60,  req: ['copperworks'] },
  { id: 'manganin',  sym: 'toolbox', icon: '🧰', name: 'Mangan-Härtung',         desc: 'Stahlproduktion ×1,5, Manganproduktion ×2.', cost: { steel: 1e5, manganese: 500 }, mult: { steel: 1.5, manganese: 2 }, time: 120, req: ['manganese'] },
  { id: 'mixcat',    sym: 'petri', icon: '🧫', name: 'Mischer-Katalysator',    desc: 'Legierungsproduktion ×2.', cost: { copper: 5000, manganese: 2000, alloy: 100 },   mult: { alloy: 2 },     time: 200, req: ['alloying'] },
  { id: 'plating',   sym: 'mirror', icon: '🪞', name: 'Verchromung',            desc: 'Alle Materialien ×1,25.',  cost: { steel: 5e5, chrome: 1000, nickel: 500 },       mult: { all: 1.25 },    time: 300, req: ['chromium'] },
  { id: 'superalloy', sym: 'shield', icon: '🛡️', name: 'Nickel-Superlegierung', desc: 'Titanproduktion ×2.',      cost: { titan: 5000, nickel: 1000, alloy: 300 },       mult: { titan: 2 },     time: 420, req: ['chromium'] },
  { id: 'carbide',   sym: 'disc', icon: '💿', name: 'Wolframkarbid-Bohrer',   desc: 'Erzproduktion ×3.',        cost: { titan: 2e4, tungsten: 200 },                   mult: { ore: 3 },       time: 600, req: ['tungsten'] },
  { id: 'goldplate', sym: 'medal', icon: '🏅', name: 'Goldveredelung',         desc: 'Alle Materialien ×2.',     cost: { tungsten: 500, gold: 50 },                     mult: { all: 2 },       time: 900, req: ['goldsmith'] },
  // Zeitalter-Boosts: Kosten staffeln sich entlang der Zeitalter-Erz-Schwellen (1e17, 1e20, 1e22, 1e23, 3e23); Kosten je Ressource proportional zu deren Produktionsrate (tools/balance-sim.mjs, runRates)
  { id: 'prospect',  sym: 'microscope', icon: '🔬', name: 'Erzprobenanalyse',       desc: 'Erzproduktion ×1,25.',     cost: { steel: 3e6, titan: 2e4 },                       mult: { ore: 1.25 },    time: 150,  req: ['ore_1'] },
  { id: 'slagrecycle', sym: 'brick', icon: '🧱', name: 'Schlackenverwertung',     desc: 'Stahlproduktion ×1,25.',   cost: { steel: 2e6, coke: 5e4 },                        mult: { steel: 1.25 },  time: 200,  req: ['steel_1'] },
  { id: 'waterwheel', sym: 'waterwheel', icon: '💧', name: 'Wasserrad-Antrieb',      desc: 'Erzproduktion ×1,5.',      cost: { steel: 2e16, titan: 6e10 },                      mult: { ore: 1.5 },     time: 300,  req: ['ore_3'], era: 1 },
  { id: 'rollingmill', sym: 'rollmill', icon: '🟫', name: 'Walzstraße',              desc: 'Stahlproduktion ×1,5.',    cost: { steel: 1e17, coke: 1.4e14 },                       mult: { steel: 1.5 },   time: 360,  req: ['steel_2'], era: 1 },
  { id: 'clickforge', sym: 'forgehammer', icon: '👆', name: 'Schmiedeautomat',         desc: 'Klickwert ×2.',            cost: { steel: 4.5e16, copper: 8.2e11 },                     mult: { click: 2 },     time: 420,  req: ['ore_3'], era: 1 },
  { id: 'steamdrill', sym: 'steamdrill', icon: '♨️', name: 'Dampfbohrer',             desc: 'Erzproduktion ×1,5.',      cost: { steel: 3.4e19, coke: 4.4e15 },                      mult: { ore: 1.5 },     time: 540,  req: ['ore_4'], era: 2 },
  { id: 'bessemer',  sym: 'converter', icon: '🔥', name: 'Bessemer-Konverter',       desc: 'Stahlproduktion ×2.',      cost: { steel: 5.8e19, coke: 7.5e15, manganese: 3.2e11 },     mult: { steel: 2 },     time: 600,  req: ['steel_3'], era: 2 },
  { id: 'autotap',   sym: 'stopwatch', icon: '⏱️', name: 'Servo-Klopfer',        desc: 'Autoklick-Ertrag ×2.',     cost: { steel: 2e19, copper: 2.4e13 },                    mult: { autoclick: 2 }, time: 480,  req: ['autoclick'], era: 2 },
  { id: 'valves',    sym: 'press', icon: '🗜️', name: 'Überdruckventile',         desc: 'Alle Materialien ×1,25.',  cost: { steel: 1e20, copper: 1.2e14, coke: 1.3e16 },        mult: { all: 1.25 },    time: 720,  req: ['boiler'], era: 2 },
  { id: 'arcfurnace', sym: 'arcfurnace', icon: '⚡', name: 'Lichtbogenofen',           desc: 'Stahlproduktion ×2.',      cost: { steel: 2e21, copper: 2.4e15, chrome: 2.7e11 },      mult: { steel: 2 },     time: 840,  req: ['steel_4'], era: 3 },
  { id: 'copperbus', sym: 'chain', icon: '🔗', name: 'Kupfersammelschiene',      desc: 'Alle Materialien ×1,25.',  cost: { steel: 1e22, copper: 1.2e16 },                    mult: { all: 1.25 },    time: 960,  req: ['grid'], era: 3 },
  { id: 'assemblyopt', sym: 'factory', icon: '🏭', name: 'Taktstraßen-Optimierung', desc: 'Alle Materialien ×1,5.', cost: { steel: 2e22, alloy: 4.7e14 },                     mult: { all: 1.5 },     time: 1200, req: ['proc_4'], era: 4 },
  { id: 'robotarm',  sym: 'robot', icon: '🤖', name: 'Roboterarm-Kalibrierung',  desc: 'Klickwert ×2, Autoklick-Ertrag ×1,5.', cost: { steel: 1e23, alloy: 2.3e15, tungsten: 7.2e13 }, mult: { click: 2, autoclick: 1.5 }, time: 1300, req: ['plantnet'], era: 4 },
  { id: 'nanocoat',  sym: 'nanogrid', icon: '✨', name: 'Nano-Beschichtung',      desc: 'Erzproduktion ×2.',        cost: { steel: 6e22, titan: 3e16 },                     mult: { ore: 2 },       time: 1400, req: ['proc_5'], era: 5 },
  { id: 'fusioncat', sym: 'atom', icon: '☀️', name: 'Fusions-Katalysator',       desc: 'Alle Materialien ×1,5.',   cost: { steel: 3e23, tungsten: 2e14, gold: 6.8e13 },      mult: { all: 1.5 },     time: 1600, req: ['fusion'], era: 5 },

  // Konzern-Boosts (Ausbau 2, GAME-DESIGN-2.md 5.4): corp = Mindest-Konzernstufe; Reset beim Neuguss wie alle Boosts
  { id: 'cb_cobalt', sym: 'cobalt', icon: '🔵', name: 'Kobalt-Katalysator', desc: 'Kobaltproduktion ×2, Molybdänproduktion ×1,5.', cost: { steel: 1.2e18, cobalt: 6e8, molybdenum: 4.8e8 }, mult: { cobalt: 2, molybdenum: 1.5 }, time: 1200, req: ['c_cobalt'], corp: 1 },
  { id: 'cb_sinter', sym: 'carbide', icon: '🔶', name: 'Sinterpresse', desc: 'Hartmetallproduktion ×2, Wolframproduktion ×1,5.', cost: { steel: 3.1e19, carbide: 4.4e9, tungsten: 3e10 }, mult: { carbide: 2, tungsten: 1.5 }, time: 1560, req: ['c_sinter'], corp: 2 },
  { id: 'cb_platin', sym: 'platinum', icon: '⚪', name: 'Platin-Elektrolyse', desc: 'Platinproduktion ×2, Goldproduktion ×1,5.', cost: { steel: 7.1e20, platinum: 3.4e10, gold: 2.4e11 }, mult: { platinum: 2, gold: 1.5 }, time: 2028, req: ['c_platin'], corp: 3 },
  { id: 'cb_vanadium', sym: 'vanadium', icon: '🟢', name: 'Vanadium-Stahlbad', desc: 'Vanadiumproduktion ×2, Stahlproduktion ×2.', cost: { steel: 1.1e21, vanadium: 1e11, molybdenum: 4.2e11 }, mult: { vanadium: 2, steel: 2 }, time: 2636, req: ['c_vanadium'], corp: 4 },
  { id: 'cb_iridium', sym: 'iridium', icon: '💠', name: 'Iridium-Tiegel', desc: 'Iridiumproduktion ×2, alle Materialien ×1,1.', cost: { steel: 8.1e21, iridium: 1.9e11 }, mult: { iridium: 2, all: 1.1 }, time: 3427, req: ['c_iridium'], era: 6, corp: 5 },
  { id: 'cb_vacuum', sym: 'superalloy', icon: '🔷', name: 'Vakuumguss', desc: 'Superlegierungsproduktion ×2, alle Materialien ×1,15.', cost: { steel: 9.7e22, superalloy: 9.3e11 }, mult: { superalloy: 2, all: 1.15 }, time: 4456, req: ['c_super'], era: 7, corp: 6 },
  { id: 'cb_line', sym: 'conveyor', icon: '🛤️', name: 'Konzern-Fließbandsystem', desc: 'Erzproduktion ×2, Stahlproduktion ×2.', cost: { steel: 9.7e22, iridium: 2.3e12 }, mult: { ore: 2, steel: 2 }, time: 4456, req: ['c_orbital'], era: 7, corp: 6 },
  { id: 'cb_center', sym: 'chip', icon: '🖥️', name: 'Weltkonzern-Rechenzentrum', desc: 'Alle Materialien ×1,25.', cost: { steel: 8.5e23, superalloy: 8.2e12 }, mult: { all: 1.25 }, time: 5792, req: ['c_charta'], era: 8, corp: 7 },
];
export const BOOST_MAP = Object.fromEntries(BOOSTS.map(b => [b.id, b]));
