// Forschungsbaum. mult wirkt als Produktionsmultiplikator; weitere Effekte
// werden in core/formulas.js über die ID abgefragt (resonance, autoclick, precision, automation).
// Freischaltungen laufen über `req` in Generatoren, Rezepten, Boosts, Klick-Upgrades und Ressourcen.
//   time:   Dauer in Sekunden (Labor-Warteschlange), vor Zeitverkürzung (Shop `q_speed`, Forschung `automation`)
//   liquid: Farbe der Flüssigkeit im Labor-Gefäß
//   era:    optional, Mindest-Zeitalter (Index in data/eras.js); darunter ist die Forschung sichtbar, aber gesperrt
//   cat:    Gefäßform in der UI: 'mining' Erlenmeyer, 'metal' Reagenzglas, 'chem' Rundkolben, 'tech' Retorte
const LIQ = { ore: '#f97316', steel: '#38bdf8', titan: '#d946ef', all: '#fbbf24', coal: '#64748b', coke: '#a8a29e', copper: '#ea8a52', manganese: '#a78bfa', chrome: '#5eead4', nickel: '#a3e635', alloy: '#38bdf8', tungsten: '#f472b6', gold: '#fbbf24',
  cobalt: '#60a5fa', molybdenum: '#94a3b8', carbide: '#cbd5e1', platinum: '#e2e8f0', vanadium: '#34d399', iridium: '#fb7185', superalloy: '#22d3ee' };
//   sym:    Symbolname in assets/sprites/items.svg (sym-<name>), abgeleitet vom Emoji `icon` (bleibt als Textfallback)
const SYM = { '🧭': 'target', '🔨': 'hammer', '♻️': 'converter', '🕳️': 'jackhammer', '🧪': 'petri', '💎': 'gem', '🔬': 'microscope', '📈': 'chart', '🤖': 'robot', '📐': 'nut', '⚛️': 'atom', '⛏️': 'pickaxe', '🧱': 'brick', '🌋': 'arcfurnace', '🔌': 'turbine', '⛓️': 'chain', '🛠️': 'toolbox', '🧬': 'dna', '⚗️': 'cylinder', '🛞': 'disc', '☢️': 'nanogrid', '🧲': 'magnet', '👑': 'medal', '🏭': 'factory', '🪨': 'rock', '📊': 'chart', '🔥': 'flame', '🏗️': 'press', '☀️': 'star', '🔋': 'battery', '💧': 'waterwheel', '🚂': 'train', '⚡': 'bolt', '⚙️': 'gear', '🛤️': 'conveyor', '📦': 'rollmill', '🖥️': 'chip', '🏚️': 'shower', '✨': 'sparkle' };
const r = (id, icon, name, desc, cost, time, cat, liq, extra = {}) => ({ id, icon, sym: SYM[icon], name, desc, cost, time, cat, liquid: LIQ[liq], ...extra });

export const RESEARCH = [
  r('geology',    '🧭', 'Geologie',                   '+25 % Erzproduktion.',                                              { ore: 300 },                          5,    'mining', 'ore',   { mult: { ore: 1.25 } }),
  r('resonance',  '🔨', 'Resonanzhammer',             'Jeder Klick gibt zusätzlich 5 % deiner Erz/s.',                     { ore: 1500, steel: 15 },              8,    'tech',   'ore',   { req: ['geology'] }),
  r('converter',  '♻️', 'Auto-Konverter',             'Wandelt automatisch 20 % der Erzproduktion in Stahl um (25:1).',    { ore: 3000, steel: 40 },              10,   'metal',  'steel', { req: ['geology'] }),
  r('deepmines',  '🕳️', 'Tiefbau',                    '+50 % Erzproduktion.',                                              { ore: 6000, steel: 60 },              15,   'mining', 'ore',   { req: ['geology'], mult: { ore: 1.5 } }),
  r('metallurgy', '🧪', 'Metallurgie',                '+50 % Stahlproduktion. Schaltet das Walzwerk frei.',                { ore: 8000, steel: 120 },             30,   'metal',  'steel', { req: ['converter'], mult: { steel: 1.5 } }),
  r('titanium',   '💎', 'Titan-Extraktion',           'Schaltet die Titan-Schmiede frei.',                                 { ore: 15000, steel: 250 },            60,   'chem',   'titan', { req: ['metallurgy'] }),
  r('refining',   '🔬', 'Titan-Raffination',          '+50 % Titanproduktion.',                                            { ore: 40000, steel: 800, titan: 8 },  120,  'chem',   'titan', { req: ['titanium'], mult: { titan: 1.5 } }),
  r('efficiency', '📈', 'Globale Effizienz',          '+50 % Produktion aller Materialien.',                               { steel: 800, titan: 10 },             120,  'tech',   'all',   { req: ['titanium'], mult: { all: 1.5 } }),
  r('autoclick',  '🤖', 'Automatisierte Spitzhacken', '5 automatische Klicks pro Sekunde.',                                { steel: 2000, titan: 30 },            180,  'tech',   'all',   { req: ['resonance', 'efficiency'] }),
  r('precision',  '📐', 'Präzisionsfertigung',        'Zusätzliche Meilensteine (×2) bei Stufe 25, 50, 100, 150, 200 ...', { ore: 2e5, steel: 5000, titan: 60 },  240,  'tech',   'all',   { req: ['efficiency'] }),
  r('quantum',    '⚛️', 'Quantenmetallurgie',         '+100 % Produktion aller Materialien.',                              { ore: 1e6, steel: 1e4, titan: 250 },  720,  'chem',   'all',   { req: ['autoclick', 'precision'], mult: { all: 2 } }),

  // Eisenhütten-Kette (Phase 2b)
  r('coalmining', '⛏️', 'Kohleflöz-Erkundung',        'Schaltet die Zeche frei und macht Kohle abbaubar.',                 { ore: 15000, steel: 150 },            20,   'mining', 'coal',  { req: ['deepmines'] }),
  r('coking',     '🧱', 'Verkokung',                  'Schaltet die Koksofenbatterie frei. Wandelt 40 % der Kohle in Koks um (5:1).', { ore: 40000, steel: 600, coal: 200 }, 40, 'chem', 'coke', { req: ['coalmining'] }),
  r('blastfurnace', '🌋', 'Hochofenprozess',          '+25 % Stahlproduktion. Erz und Koks werden zusätzlich zu Stahl verhüttet.', { ore: 1e5, steel: 2000, coke: 300 }, 90, 'metal', 'coke', { req: ['coking', 'metallurgy'], mult: { steel: 1.25 } }),
  r('copperworks', '🔌', 'Kupfermetallurgie',         'Schaltet die Kupferhütte frei.',                                    { ore: 1.5e5, steel: 3000 },           60,   'metal',  'copper', { req: ['metallurgy'] }),
  r('manganese',  '⛓️', 'Manganstahl',                'Schaltet das Manganbergwerk frei.',                                 { steel: 8000, copper: 300, coke: 300 }, 150, 'metal',  'manganese', { req: ['copperworks', 'coking'] }),
  r('automation', '🛠️', 'Laborautomatisierung',       'Alle Forschungs- und Werkbank-Zeiten dauern 25 % kürzer.',         { ore: 2e5, steel: 1e4, titan: 100 },  240,  'tech',   'all',   { req: ['efficiency'] }),
  r('alloying',   '🧬', 'Legierungstechnik',          'Schaltet den Legierungsmischer frei. Kupfer und Mangan werden zu Legierung gemischt (3:1).', { steel: 3e4, copper: 1500, manganese: 300 }, 360, 'chem', 'alloy', { req: ['manganese'] }),
  r('catalysis',  '⚗️', 'Katalyse',                   '+50 % Produktion aller Materialien.',                               { steel: 1.5e5, copper: 3000, alloy: 100 }, 600, 'chem', 'alloy', { req: ['alloying'], mult: { all: 1.5 } }),
  r('chromium',   '🛞', 'Chrom & Nickel',             'Schaltet Chromwerk und Nickelraffinerie frei.',                     { steel: 2e5, copper: 5000, manganese: 1000, alloy: 50 }, 480, 'metal', 'chrome', { req: ['alloying'] }),
  r('tungsten',   '☢️', 'Wolfram-Gewinnung',          'Schaltet den Wolframreaktor frei. Legierung, Chrom und Nickel werden zu Wolfram veredelt (8:2:2).', { titan: 2000, alloy: 400, chrome: 300, nickel: 300 }, 900, 'chem', 'tungsten', { req: ['chromium', 'refining'] }),
  r('supercond',  '🧲', 'Supraleiter',                '+100 % Produktion aller Materialien.',                              { titan: 1e4, tungsten: 100, alloy: 800 }, 1200, 'tech', 'tungsten', { req: ['tungsten'], mult: { all: 2 } }),
  r('goldsmith',  '👑', 'Goldschmiedekunst',          'Schaltet den Edelmetall-Tiegel frei. Wolfram wird teilweise zu Gold umgeschmolzen (20:1).', { titan: 3e4, tungsten: 300, alloy: 3000 }, 1800, 'chem', 'gold', { req: ['supercond'] }),

  // Ausbau-Ketten (kleine Schritte mit steigenden Kosten und Zeiten; höhere Stufen sind an Zeitalter gebunden)
  // Erzabbau I-VII
  r('ore_1', '⛏️', 'Erzabbau I',    '+10 % Erzproduktion.', { ore: 4e4, steel: 500 },   40,   'mining', 'ore', { req: ['deepmines'], mult: { ore: 1.1 } }),
  r('ore_2', '⛏️', 'Erzabbau II',   '+10 % Erzproduktion.', { ore: 2.5e5, steel: 4000 }, 90,  'mining', 'ore', { req: ['ore_1'], mult: { ore: 1.1 } }),
  r('ore_3', '⛏️', 'Erzabbau III',  '+10 % Erzproduktion.', { ore: 1.1e16, steel: 3.2e16 }, 180, 'mining', 'ore', { era: 1, req: ['ore_2'], mult: { ore: 1.1 } }),
  r('ore_4', '⛏️', 'Erzabbau IV',   '+10 % Erzproduktion.', { ore: 9.8e18, steel: 2.4e19 },  400, 'mining', 'ore', { era: 2, req: ['ore_3'], mult: { ore: 1.1 } }),
  r('ore_5', '⛏️', 'Erzabbau V',    '+10 % Erzproduktion.', { ore: 1.7e21, steel: 3.4e21 },  800, 'mining', 'ore', { era: 3, req: ['ore_4'], mult: { ore: 1.1 } }),
  r('ore_6', '⛏️', 'Erzabbau VI',   '+10 % Erzproduktion.', { ore: 1.3e22, steel: 4.1e22 },  1100, 'mining', 'ore', { era: 4, req: ['ore_5'], mult: { ore: 1.1 } }),
  r('ore_7', '⛏️', 'Erzabbau VII',  '+10 % Erzproduktion.', { ore: 3.8e22, steel: 1.1e23 }, 1450, 'mining', 'ore', { era: 5, req: ['ore_6'], mult: { ore: 1.1 } }),
  // Stahlerzeugung I-VI
  r('steel_1', '🏭', 'Stahlerzeugung I',   '+10 % Stahlproduktion.', { ore: 3e5, steel: 8000, coke: 400 },            100,  'metal', 'steel', { req: ['blastfurnace'], mult: { steel: 1.1 } }),
  r('steel_2', '🏭', 'Stahlerzeugung II',  '+10 % Stahlproduktion.', { ore: 1.4e16, steel: 4e16, coke: 5.5e13 },            200,  'metal', 'steel', { era: 1, req: ['steel_1'], mult: { steel: 1.1 } }),
  r('steel_3', '🏭', 'Stahlerzeugung III', '+10 % Stahlproduktion.', { ore: 1.2e19, steel: 3e19, coke: 3.8e15 },      450,  'metal', 'steel', { era: 2, req: ['steel_2'], mult: { steel: 1.1 } }),
  r('steel_4', '🏭', 'Stahlerzeugung IV',  '+10 % Stahlproduktion.', { ore: 2.1e21, steel: 4.1e21, coke: 1.1e18 },        850,  'metal', 'steel', { era: 3, req: ['steel_3'], mult: { steel: 1.1 } }),
  r('steel_5', '🏭', 'Stahlerzeugung V',   '+10 % Stahlproduktion.', { ore: 1.5e22, steel: 4.9e22, coke: 2.7e19 },          1150, 'metal', 'steel', { era: 4, req: ['steel_4'], mult: { steel: 1.1 } }),
  r('steel_6', '🏭', 'Stahlerzeugung VI',  '+10 % Stahlproduktion.', { ore: 4.7e22, steel: 1.3e23, coke: 6e19 },        1500, 'metal', 'steel', { era: 5, req: ['steel_5'], mult: { steel: 1.1 } }),
  // Kohle und Koks
  r('coal_2', '🪨', 'Flözausbau I',   '+12 % Kohleproduktion.', { ore: 3e5, steel: 5000, coal: 2500 },        70,  'mining', 'coal', { req: ['deepcoal'], mult: { coal: 1.12 } }),
  r('coal_3', '🪨', 'Flözausbau II',  '+12 % Kohleproduktion.', { ore: 1.5e19, steel: 3.7e19, coal: 1.3e15 },     420, 'mining', 'coal', { era: 2, req: ['coal_2'], mult: { coal: 1.12 } }),
  r('coke_1', '🧱', 'Koksofen-Optimierung I',  '+12 % Koksproduktion.', { ore: 1.7e16, steel: 5e16, coke: 6.9e13 },     220, 'chem', 'coke', { era: 1, req: ['coking'], mult: { coke: 1.12 } }),
  r('coke_2', '🧱', 'Koksofen-Optimierung II', '+12 % Koksproduktion.', { ore: 2.5e21, steel: 4.9e21, coke: 1.3e18 },   880, 'chem', 'coke', { era: 3, req: ['coke_1'], mult: { coke: 1.12 } }),
  // Kupfer
  r('copper_2', '🔌', 'Kupferwalzen',          '+12 % Kupferproduktion.', { ore: 2.1e16, steel: 6.3e16, copper: 1.2e12 },    240, 'metal', 'copper', { era: 1, req: ['copperenrich'], mult: { copper: 1.12 } }),
  r('copper_3', '🔌', 'Kupfer-Feinzug',        '+12 % Kupferproduktion.', { ore: 3e21, steel: 5.8e21, copper: 7e15 },  900, 'metal', 'copper', { era: 3, req: ['copper_2'], mult: { copper: 1.12 } }),
  // Titan
  r('titan_1', '💎', 'Titan-Schmelzverfahren I',   '+12 % Titanproduktion.', { ore: 5e5, steel: 1.5e4, titan: 150 },        200, 'chem', 'titan', { req: ['refining'], mult: { titan: 1.12 } }),
  r('titan_2', '💎', 'Titan-Schmelzverfahren II',  '+12 % Titanproduktion.', { ore: 1.8e19, steel: 4.5e19, titan: 8.8e12 },     520, 'chem', 'titan', { era: 2, req: ['titan_1'], mult: { titan: 1.12 } }),
  r('titan_3', '💎', 'Titan-Schmelzverfahren III', '+12 % Titanproduktion.', { ore: 1.8e22, steel: 5.8e22, titan: 2.5e16 },   1200, 'chem', 'titan', { era: 4, req: ['titan_2'], mult: { titan: 1.12 } }),
  // Legierungen und Edelmetalle
  r('alloy_1', '🧬', 'Legierungsveredelung I',   '+12 % Legierungsproduktion.', { ore: 2.7e16, steel: 7.9e16, copper: 1.5e12, alloy: 2.2e11 },              260, 'chem', 'alloy', { era: 1, req: ['alloying'], mult: { alloy: 1.12 } }),
  r('alloy_2', '🧬', 'Legierungsveredelung II',  '+12 % Legierungsproduktion.', { ore: 3.5e21, steel: 7e21, alloy: 7.1e13 },            950, 'chem', 'alloy', { era: 3, req: ['alloy_1'], mult: { alloy: 1.12 } }),
  r('alloy_3', '🧬', 'Legierungsveredelung III', '+12 % Legierungsproduktion.', { ore: 5.7e22, steel: 1.6e23, alloy: 3.8e15 },            1550, 'chem', 'alloy', { era: 5, req: ['alloy_2'], mult: { alloy: 1.12 } }),
  r('mang_1',   '⛓️', 'Mangan-Tiefbau',          '+12 % Manganproduktion.', { ore: 2.2e19, steel: 5.5e19, manganese: 3e11 },              560, 'metal', 'manganese', { era: 2, req: ['manganese'], mult: { manganese: 1.12 } }),
  r('chrome_1', '🛞', 'Chrom- und Nickelhütte',  '+10 % Chrom- und Nickelproduktion.', { ore: 2.7e19, steel: 6.7e19, chrome: 8.6e9, nickel: 6.7e9 }, 600, 'metal', 'chrome', { era: 2, req: ['chromium'], mult: { chrome: 1.1, nickel: 1.1 } }),
  r('tung_1',   '☢️', 'Wolfram-Zentrifugen',     '+12 % Wolframproduktion.', { ore: 2.1e22, steel: 7e22, tungsten: 5e13 },            1250, 'chem', 'tungsten', { era: 4, req: ['tungsten'], mult: { tungsten: 1.12 } }),
  r('gold_1',   '👑', 'Edelmetall-Raffination',  '+12 % Goldproduktion.', { ore: 7e22, steel: 2e23, gold: 4.5e13 },                 1600, 'chem', 'gold', { era: 5, req: ['goldsmith'], mult: { gold: 1.12 } }),
  // Energie und Prozessoptimierung (je +5 % auf alles, Kernfusion +7 %)
  r('boiler', '🔥', 'Hochdruckkessel',     '+5 % aller Materialien.', { ore: 3.3e19, steel: 8.2e19, coke: 1.1e16 },       640, 'tech', 'coke', { era: 2, req: ['steamengine'], mult: { all: 1.05 } }),
  r('grid',   '🔌', 'Hochspannungsnetz',   '+5 % aller Materialien.', { ore: 4.2e21, steel: 8.4e21, copper: 1e16 },       1000, 'tech', 'copper', { era: 3, req: ['electrify'], mult: { all: 1.05 } }),
  r('plantnet', '🏗️', 'Kraftwerksverbund', '+5 % aller Materialien.', { ore: 2.6e22, steel: 8.4e22, copper: 2e17, alloy: 2e15 }, 1300, 'tech', 'all', { era: 4, req: ['assembly'], mult: { all: 1.05 } }),
  r('fusion', '☀️', 'Kernfusion',          '+7 % aller Materialien.', { ore: 8.6e22, steel: 2.5e23, tungsten: 1.6e14 },     1700, 'tech', 'all', { era: 5, req: ['synthmatter'], mult: { all: 1.07 } }),
  r('proc_1', '📊', 'Prozessoptimierung I',   '+5 % aller Materialien.', { ore: 3.4e16, steel: 1e17, titan: 3e11 },      300,  'tech', 'all', { era: 1, req: ['energyfound'], mult: { all: 1.05 } }),
  r('proc_2', '📊', 'Prozessoptimierung II',  '+5 % aller Materialien.', { ore: 4e19, steel: 1e20, titan: 2e13 },     700,  'tech', 'all', { era: 2, req: ['proc_1'], mult: { all: 1.05 } }),
  r('proc_3', '📊', 'Prozessoptimierung III', '+5 % aller Materialien.', { ore: 5.1e21, steel: 1e22, titan: 2.1e15 },     1050, 'tech', 'all', { era: 3, req: ['proc_2'], mult: { all: 1.05 } }),
  r('proc_4', '📊', 'Prozessoptimierung IV',  '+5 % aller Materialien.', { ore: 3.1e22, steel: 1e23, titan: 4.3e16 }, 1350, 'tech', 'all', { era: 4, req: ['proc_3'], mult: { all: 1.05 } }),
  r('proc_5', '📊', 'Prozessoptimierung V',   '+5 % aller Materialien.', { ore: 1e23, steel: 3e23, titan: 1.5e17 },     1800, 'tech', 'all', { era: 5, req: ['proc_4'], mult: { all: 1.05 } }),

  // Ostast: Energie und Industrialisierung (Phase 3). Kosten skalieren mit den Erz-Schwellen der Zeitalter.
  r('energyfound',  '🔋', 'Energiefundamente',          '+25 % Erz- und Stahlproduktion. Grundlagen der modernen Energiewirtschaft.',  { ore: 6.8e15, steel: 2e16, coal: 9.2e12 }, 120, 'tech', 'coal', { era: 1, req: ['resonance'], mult: { ore: 1.25, steel: 1.25 } }),
  r('hydropower',   '💧', 'Wasserkraft',                '+25 % Erzproduktion durch Wasserkraftwerke.',                              { ore: 8.6e15, steel: 2.5e16, coal: 1.2e13 }, 150, 'mining', 'ore', { era: 1, req: ['energyfound'], mult: { ore: 1.25 } }),
  r('steamengine',  '🚂', 'Dampfmaschine',              '+25 % aller Materialien. Die Kraft des Dampfes revolutioniert die Fertigung.', { ore: 8.1e18, steel: 2e19, coke: 2.6e15 }, 180, 'tech', 'coke', { era: 2, req: ['hydropower'], mult: { all: 1.25 } }),
  r('dynamo',       '⚡', 'Dynamo',                      '+50 % Stahlproduktion durch elektrische Generierung.',                     { ore: 1e21, steel: 2e21, copper: 2.4e15 }, 240, 'tech', 'copper', { era: 3, req: ['steamengine'], mult: { steel: 1.5 } }),
  r('powersupply',  '🔌', 'Stromversorgung',            '+25 % aller Materialien. Flächendeckende elektrische Netze.',              { ore: 1.2e21, steel: 2.4e21, copper: 2.9e15 }, 300, 'tech', 'all', { era: 3, req: ['dynamo'], mult: { all: 1.25 } }),
  r('electrify',    '⚙️', 'Elektrifizierung',           '+50 % aller Materialien. Alle Prozesse laufen elektrisch.',                { ore: 1.4e21, steel: 2.9e21, copper: 3.4e15, alloy: 2.9e13 }, 360, 'tech', 'all', { era: 3, req: ['powersupply'], mult: { all: 1.5 } }),
  r('assembly',     '🛤️', 'Fließbandproduktion',        '+50 % Erz- und Stahlproduktion durch automatisierte Fertigungslinien.',    { ore: 6.1e21, steel: 2e22, alloy: 4.7e14 }, 420, 'tech', 'ore', { era: 4, req: ['electrify'], mult: { ore: 1.5, steel: 1.5 } }),
  r('robotics',     '🤖', 'Robotik',                     '+50 % aller Materialien. Intelligente Roboter übernehmen die Fertigung.',  { ore: 7.3e21, steel: 2.4e22, titan: 1e16, alloy: 5.6e14 }, 480, 'tech', 'all', { era: 4, req: ['assembly'], mult: { all: 1.5 } }),
  r('massproduct',  '📦', 'Massenproduktion',            '+50 % aller Materialien. Unbegrenzte Skalierung der Fertigungskapazität.', { ore: 8.8e21, steel: 2.9e22, alloy: 6.7e14 }, 540, 'tech', 'all', { era: 4, req: ['robotics'], mult: { all: 1.5 } }),
  r('semiconductor','🖥️', 'Halbleitertechnik',          '+25 % aller Materialien. Mikroelektronische Revolution der Industrie.',     { ore: 2.1e22, steel: 6e22, copper: 1.2e17, tungsten: 4e13 }, 600, 'chem', 'all', { era: 5, req: ['massproduct'], mult: { all: 1.25 } }),
  r('nanotech',     '🔬', 'Nanotechnologie',            '+100 % aller Materialien. Manipulation auf atomarer Ebene.',               { ore: 2.6e22, steel: 7.3e22, tungsten: 4.9e13, alloy: 1.7e15 }, 720, 'chem', 'all', { era: 5, req: ['semiconductor'], mult: { all: 2 } }),
  r('synthmatter',  '🧪', 'Synthetische Materialien',   '+50 % aller Materialien. Künstlich erzeugte Stoffe übertreffen Natur.',    { ore: 3.1e22, steel: 9e22, gold: 2e13, tungsten: 6e13, alloy: 2.1e15 }, 900, 'chem', 'all', { era: 5, req: ['nanotech'], mult: { all: 1.5 } }),

  // Verbesserungen in bestehenden Ästen
  r('deepcoal',     '⛏️', 'Tiefenkohlebergbau',         '+50 % Kohleproduktion. Moderne Tiefbautechniken erschließen neue Vorkommen.', { ore: 8e4, steel: 2000, coal: 1000 }, 90, 'mining', 'coal', { req: ['coalmining'], mult: { coal: 1.5 } }),
  r('copperenrich', '🏚️', 'Kupfererz-Konzentration',   '+50 % Kupferproduktion durch fortgeschrittene Aufbereitungstechnik.',       { ore: 2e5, steel: 5000, copper: 500 }, 180, 'metal', 'copper', { req: ['copperworks'], mult: { copper: 1.5 } }),
  r('quantumopt',   '✨', 'Quantenoptik',                '+25 % aller Materialien. Licht und Quantenmechanik in der Messtechnik.',   { ore: 1e22, steel: 3.4e22, titan: 1.5e16, alloy: 8e14 }, 1200, 'tech', 'all', { era: 4, req: ['quantum'], mult: { all: 1.25 } }),

  // Konzernforschung (Ausbau 2, GAME-DESIGN-2.md 5.3): corp = Mindest-Konzernstufe (1 bis 7), permanent (bleibt bei Neuguss und Konzerngründung).
  // Kosten/Dauer sind Modellwerte aus Formel 5.2 (Kalibrierung in Schritt 6).
  r('c_cobalt', '🔵', 'Kobaltbergbau', 'Schaltet die Kobaltgrube frei und macht Kobalt abbaubar.', { ore: 5e18, steel: 1.3e19, tungsten: 1.2e9, gold: 4.2e8 }, 1800, 'chem', 'cobalt', { corp: 1, req: ['goldsmith'], sym: 'cobalt' }),
  r('c_moly', '⚙️', 'Molybdän-Aufbereitung', 'Schaltet das Molybdänwerk frei.', { ore: 5e18, steel: 1.3e19, cobalt: 6e8, alloy: 3.9e10 }, 1800, 'chem', 'molybdenum', { corp: 1, req: ['c_cobalt'], sym: 'molybdenum' }),
  r('c_cobalt_a', '🔵', 'Kobalt-Anreicherung I', '+12 % Kobaltproduktion.', { ore: 5e18, steel: 1.3e19, cobalt: 3e8, tungsten: 6e8 }, 1080, 'chem', 'cobalt', { corp: 1, req: ['c_cobalt'], mult: { cobalt: 1.12 }, sym: 'cobalt' }),
  r('c_moly_a', '⚙️', 'Molybdän-Röstung I', '+12 % Molybdänproduktion.', { ore: 5e18, steel: 1.3e19, molybdenum: 2.4e8, cobalt: 3e8 }, 1080, 'chem', 'molybdenum', { corp: 1, req: ['c_moly'], mult: { molybdenum: 1.12 }, sym: 'molybdenum' }),
  r('c_patent', '📜', 'Patentwesen', '+8 % Produktion aller Materialien.', { ore: 5e18, steel: 1.3e19, gold: 4.2e8, tungsten: 1.2e9 }, 2160, 'tech', 'all', { corp: 1, req: ['goldsmith'], mult: { all: 1.08 }, sym: 'patent' }),
  r('c_proc_1', '📊', 'Konzernprozess I', '+5 % aller Materialien.', { ore: 5e18, steel: 1.3e19, titan: 6e11, alloy: 2.6e10 }, 1800, 'tech', 'all', { corp: 1, req: ['c_cobalt'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_sinter', '🔶', 'Hartmetall-Sinterung', 'Schaltet das Sinterwerk frei. Wolfram und Kobalt werden zu Hartmetall gesintert (6:2).', { ore: 2.7e20, steel: 6.8e20, tungsten: 3e10, cobalt: 1.5e10, molybdenum: 1.2e10 }, 2520, 'chem', 'carbide', { corp: 2, req: ['c_moly'], sym: 'carbide' }),
  r('c_cobalt_b', '🔵', 'Kobalt-Anreicherung II', '+12 % Kobaltproduktion.', { ore: 2.7e20, steel: 6.8e20, cobalt: 2e10 }, 2020, 'chem', 'cobalt', { corp: 2, req: ['c_cobalt_a'], mult: { cobalt: 1.12 }, sym: 'cobalt' }),
  r('c_moly_b', '⚙️', 'Molybdän-Röstung II', '+12 % Molybdänproduktion.', { ore: 2.7e20, steel: 6.8e20, molybdenum: 1.6e10 }, 2020, 'chem', 'molybdenum', { corp: 2, req: ['c_moly_a'], mult: { molybdenum: 1.12 }, sym: 'molybdenum' }),
  r('c_carbide_a', '🔶', 'Sinteroptimierung I', '+12 % Hartmetallproduktion.', { ore: 2.7e20, steel: 6.8e20, carbide: 2.2e9, cobalt: 7.4e9 }, 1510, 'chem', 'carbide', { corp: 2, req: ['c_sinter'], mult: { carbide: 1.12 }, sym: 'carbide' }),
  r('c_tool', '⚒️', 'Werkzeugtechnik', 'Klickwert ×1,5. Schaltet den Hartmetall-Meißel frei.', { ore: 2.7e20, steel: 6.8e20, gold: 1e10, tungsten: 3e10 }, 3020, 'tech', 'carbide', { corp: 2, req: ['c_sinter'], mult: { click: 1.5 }, sym: 'chisel' }),
  r('c_hss', '🔩', 'Hochleistungsstahl', '+50 % Stahlproduktion.', { ore: 2.7e20, steel: 6.8e20, gold: 1e10, tungsten: 3e10 }, 3020, 'tech', 'steel', { corp: 2, req: ['c_sinter'], mult: { steel: 1.5 }, sym: 'arcfurnace' }),
  r('c_proc_2', '📊', 'Konzernprozess II', '+5 % aller Materialien.', { ore: 2.7e20, steel: 6.8e20, titan: 1.5e13, alloy: 6.4e11 }, 2520, 'tech', 'all', { corp: 2, req: ['c_proc_1'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_platin', '⚪', 'Platinmetall-Gewinnung', 'Schaltet die Platinmine frei. Nickel und Gold werden zu Platin raffiniert (10:1).', { ore: 1.3e22, steel: 3.2e22, nickel: 1e11, gold: 2.4e11, carbide: 1e11 }, 3530, 'chem', 'platinum', { corp: 3, req: ['c_sinter'], sym: 'platinum' }),
  r('c_carbide_b', '🔶', 'Sinteroptimierung II', '+12 % Hartmetallproduktion.', { ore: 1.3e22, steel: 3.2e22, carbide: 1.4e11 }, 2820, 'chem', 'carbide', { corp: 3, req: ['c_carbide_a'], mult: { carbide: 1.12 }, sym: 'carbide' }),
  r('c_platin_a', '⚪', 'Platin-Raffination I', '+12 % Platinproduktion.', { ore: 1.3e22, steel: 3.2e22, platinum: 1.7e10, gold: 1.2e11 }, 2120, 'chem', 'platinum', { corp: 3, req: ['c_platin'], mult: { platinum: 1.12 }, sym: 'platinum' }),
  r('c_network', '🏅', 'Edelmetall-Netzwerk', '+50 % Goldproduktion, +25 % Wolframproduktion.', { ore: 1.3e22, steel: 3.2e22, gold: 2.4e11, tungsten: 6.8e11, platinum: 3.4e10 }, 4230, 'tech', 'gold', { corp: 3, req: ['c_platin'], mult: { gold: 1.5, tungsten: 1.25 }, sym: 'medal' }),
  r('c_proc_3', '📊', 'Konzernprozess III', '+5 % aller Materialien.', { ore: 1.3e22, steel: 3.2e22, titan: 3.4e14, alloy: 1.5e13 }, 3530, 'tech', 'all', { corp: 3, req: ['c_proc_2'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_vanadium', '🟢', 'Vanadium-Extraktion', 'Schaltet die Vanadiumhütte frei.', { ore: 3e22, steel: 7.5e22, molybdenum: 4.2e11, carbide: 1.6e11 }, 4940, 'chem', 'vanadium', { corp: 4, req: ['c_sinter'], sym: 'vanadium' }),
  r('c_platin_b', '⚪', 'Platin-Raffination II', '+12 % Platinproduktion.', { ore: 3e22, steel: 7.5e22, platinum: 6.9e10 }, 3950, 'chem', 'platinum', { corp: 4, req: ['c_platin_a'], mult: { platinum: 1.12 }, sym: 'platinum' }),
  r('c_vanadium_a', '🟢', 'Vanadium-Aufschluss I', '+12 % Vanadiumproduktion.', { ore: 3e22, steel: 7.5e22, vanadium: 5.2e10, molybdenum: 2.1e11 }, 2960, 'chem', 'vanadium', { corp: 4, req: ['c_vanadium'], mult: { vanadium: 1.12 }, sym: 'vanadium' }),
  r('c_lab2', '🛠️', 'Laborautomatisierung II', 'Forschungs- und Werkbank-Zeiten dauern weitere 15 % kürzer.', { ore: 3e22, steel: 7.5e22, gold: 3.6e11, tungsten: 1e12, vanadium: 1e11 }, 5930, 'tech', 'all', { corp: 4, req: ['c_vanadium', 'automation'], sym: 'toolbox' }),
  r('c_proc_4', '📊', 'Konzernprozess IV', '+5 % aller Materialien.', { ore: 3e22, steel: 7.5e22, titan: 5.2e14, alloy: 2.3e13 }, 4940, 'tech', 'all', { corp: 4, req: ['c_proc_3'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_iridium', '💠', 'Iridium-Abscheidung', 'Schaltet das Iridiumlabor frei. Platin und Molybdän werden zu Iridium (10:4).', { ore: 3e23, steel: 7.5e23, platinum: 3.9e11, molybdenum: 3.1e12, gold: 2.7e12 }, 6910, 'chem', 'iridium', { corp: 5, era: 6, req: ['c_platin'], sym: 'iridium' }),
  r('c_vanadium_b', '🟢', 'Vanadium-Aufschluss II', '+12 % Vanadiumproduktion.', { ore: 3e23, steel: 7.5e23, vanadium: 1e12 }, 5530, 'chem', 'vanadium', { corp: 5, req: ['c_vanadium_a'], mult: { vanadium: 1.12 }, sym: 'vanadium' }),
  r('c_iridium_a', '💠', 'Iridium-Reinigung I', '+12 % Iridiumproduktion.', { ore: 3e23, steel: 7.5e23, iridium: 9.7e10, molybdenum: 1.5e12 }, 4150, 'chem', 'iridium', { corp: 5, era: 6, req: ['c_iridium'], mult: { iridium: 1.12 }, sym: 'iridium' }),
  r('c_quantum', '⚛️', 'Quantenfertigung', '+20 % Produktion aller Materialien.', { ore: 3e23, steel: 7.5e23, gold: 2.7e12, platinum: 3.9e11, iridium: 1.9e11 }, 8300, 'tech', 'all', { corp: 5, era: 6, req: ['c_iridium'], mult: { all: 1.2 }, sym: 'atom' }),
  r('c_proc_5', '📊', 'Konzernprozess V', '+5 % aller Materialien.', { ore: 3e23, steel: 7.5e23, titan: 3.9e15, alloy: 1.7e14 }, 6910, 'tech', 'all', { corp: 5, req: ['c_proc_4'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_super', '🔷', 'Superlegierungs-Guss', 'Schaltet die Superlegierungs-Gießerei frei (Hartmetall, Iridium, Vanadium zu Superlegierung, 6:1:3).', { ore: 5e24, steel: 1.3e25, iridium: 2.3e12, vanadium: 9.3e12, carbide: 1.4e13 }, 9680, 'chem', 'superalloy', { corp: 6, era: 7, req: ['c_iridium', 'c_vanadium'], sym: 'superalloy' }),
  r('c_iridium_b', '💠', 'Iridium-Reinigung II', '+12 % Iridiumproduktion.', { ore: 5e24, steel: 1.3e25, iridium: 3.1e12 }, 7740, 'chem', 'iridium', { corp: 6, era: 6, req: ['c_iridium_a'], mult: { iridium: 1.12 }, sym: 'iridium' }),
  r('c_super_a', '🔷', 'Superlegierungs-Veredelung I', '+12 % Superlegierungsproduktion.', { ore: 5e24, steel: 1.3e25, superalloy: 4.7e11, carbide: 7e12 }, 5810, 'chem', 'superalloy', { corp: 6, era: 7, req: ['c_super'], mult: { superalloy: 1.12 }, sym: 'superalloy' }),
  r('c_orbital', '🚀', 'Orbitalfertigung', '+30 % Erz- und Stahlproduktion, Autoklick-Ertrag ×2.', { ore: 5e24, steel: 1.3e25, gold: 3.3e13, platinum: 4.7e12, superalloy: 9.3e11 }, 11620, 'tech', 'ore', { corp: 6, era: 7, req: ['c_super'], mult: { ore: 1.3, steel: 1.3, autoclick: 2 }, sym: 'rocket' }),
  r('c_proc_6', '📊', 'Konzernprozess VI', '+5 % aller Materialien.', { ore: 5e24, steel: 1.3e25, titan: 4.7e16, alloy: 2e15 }, 9680, 'tech', 'all', { corp: 6, req: ['c_proc_5'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_super_b', '🔷', 'Superlegierungs-Veredelung II', '+12 % Superlegierungsproduktion.', { ore: 5.6e25, steel: 1.4e26, superalloy: 1.1e13 }, 10840, 'chem', 'superalloy', { corp: 7, era: 7, req: ['c_super_a'], mult: { superalloy: 1.12 }, sym: 'superalloy' }),
  r('c_proc_7', '📊', 'Konzernprozess VII', '+5 % aller Materialien.', { ore: 5.6e25, steel: 1.4e26, titan: 4.1e17, alloy: 1.8e16 }, 13550, 'tech', 'all', { corp: 7, req: ['c_proc_6'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_charta', '🏢', 'Weltkonzern-Charta', '+50 % Produktion aller Materialien.', { ore: 5.6e25, steel: 1.4e26, platinum: 4.1e13, iridium: 2e13, superalloy: 8.2e12 }, 16260, 'tech', 'all', { corp: 7, era: 8, req: ['c_orbital', 'c_super_b', 'c_proc_7'], mult: { all: 1.5 }, sym: 'corp' }),
  // Konzernforschung Ausbau 3 (Runde 2, Spätspiel K4-K7): längere Dauern und höhere Basiskosten (je ca. 1,5x Erz/Stahl) als die Forschungen der gleichen Stufe.
  // Kosten stehen wie oben auf der Basisskala; die Stufenfaktoren (CORP_COST_ORE/MAT) unten skalieren alle Konzernforschungen.
  r('c_carbide_c', '🔶', 'Sinteroptimierung III', '+15 % Hartmetallproduktion.', { ore: 4.5e22, steel: 1.1e23, carbide: 4e11, molybdenum: 3e11 }, 4700, 'chem', 'carbide', { corp: 4, req: ['c_carbide_b'], mult: { carbide: 1.15 }, sym: 'carbide' }),
  r('c_cobalt_c', '🔵', 'Kobalt-Verbundanlage', '+20 % Kobalt- und Molybdänproduktion.', { ore: 4.5e22, steel: 1.1e23, cobalt: 1.5e11, molybdenum: 1.2e11 }, 5200, 'chem', 'cobalt', { corp: 4, req: ['c_cobalt_b'], mult: { cobalt: 1.2, molybdenum: 1.2 }, sym: 'cobalt' }),
  r('c_night', '🌙', 'Konzern-Schichtbetrieb', 'Maximaler Offline-Ertrag +2 Stunden.', { ore: 4.5e22, steel: 1.1e23, gold: 6e11, vanadium: 1.5e11 }, 7200, 'tech', 'all', { corp: 4, req: ['c_lab2'], sym: 'moon' }),
  r('c_platin_c', '⚪', 'Platin-Raffination III', '+15 % Platinproduktion.', { ore: 4.5e23, steel: 1.1e24, platinum: 3e11, gold: 2e12 }, 6400, 'chem', 'platinum', { corp: 5, req: ['c_platin_b'], mult: { platinum: 1.15 }, sym: 'platinum' }),
  r('c_lab3', '🛠️', 'Laborautomatisierung III', 'Forschungs- und Werkbank-Zeiten dauern weitere 10 % kürzer.', { ore: 4.5e23, steel: 1.1e24, gold: 5e12, vanadium: 1e12, iridium: 3e11 }, 11000, 'tech', 'all', { corp: 5, era: 6, req: ['c_lab2'], sym: 'hourglass' }),
  r('c_atomic', '⚛️', 'Atomlagen-Abscheidung', '+10 % Produktion aller Materialien.', { ore: 4.5e23, steel: 1.1e24, iridium: 4e11, platinum: 6e11, gold: 4e12 }, 9500, 'tech', 'all', { corp: 5, era: 6, req: ['c_quantum'], mult: { all: 1.1 }, sym: 'nanogrid' }),
  r('c_vanadium_c', '🟢', 'Vanadium-Aufschluss III', '+15 % Vanadiumproduktion.', { ore: 7.5e24, steel: 2e25, vanadium: 3e12, molybdenum: 5e12 }, 8500, 'chem', 'vanadium', { corp: 6, req: ['c_vanadium_b'], mult: { vanadium: 1.15 }, sym: 'vanadium' }),
  r('c_iridium_c', '💠', 'Iridium-Reinigung III', '+15 % Iridiumproduktion.', { ore: 7.5e24, steel: 2e25, iridium: 6e12, platinum: 6e12 }, 9500, 'chem', 'iridium', { corp: 6, era: 7, req: ['c_iridium_b'], mult: { iridium: 1.15 }, sym: 'iridium' }),
  r('c_asteroid', '☄️', 'Asteroidenbergbau', '+50 % Erzproduktion.', { ore: 7.5e24, steel: 2e25, gold: 6e13, platinum: 8e12, superalloy: 1.5e12 }, 15000, 'mining', 'ore', { corp: 6, era: 7, req: ['c_orbital'], mult: { ore: 1.5 }, sym: 'rocket' }),
  r('c_drones', '🛰️', 'Prospektor-Drohnen', 'Klickwert ×2, Autoklick-Ertrag ×1,5. Schaltet die Asteroiden-Spitzhacke frei.', { ore: 7.5e24, steel: 2e25, platinum: 8e12, iridium: 6e12, superalloy: 1.2e12 }, 13500, 'tech', 'ore', { corp: 6, era: 7, req: ['c_asteroid'], mult: { click: 2, autoclick: 1.5 }, sym: 'robot' }),
  r('c_super_c', '🔷', 'Superlegierungs-Veredelung III', '+15 % Superlegierungsproduktion.', { ore: 8.4e25, steel: 2.1e26, superalloy: 2e13, platinum: 7e13 }, 16500, 'chem', 'superalloy', { corp: 7, era: 8, req: ['c_super_b'], mult: { superalloy: 1.15 }, sym: 'superalloy' }),
  r('c_proc_8', '📊', 'Konzernprozess VIII', '+5 % aller Materialien.', { ore: 8.4e25, steel: 2.1e26, titan: 8e17, alloy: 3e16 }, 15500, 'tech', 'all', { corp: 7, req: ['c_proc_7'], mult: { all: 1.05 }, sym: 'chart' }),
  r('c_cosmic', '⭐', 'Kosmische Schmiede', '+25 % Produktion aller Materialien. Letzte Forschung des Spiels.', { ore: 8.4e25, steel: 2.1e26, platinum: 8e13, iridium: 4e13, superalloy: 2e13 }, 21600, 'tech', 'all', { corp: 7, era: 8, req: ['c_charta', 'c_super_c', 'c_proc_8'], mult: { all: 1.25 }, sym: 'cosmic' }),
];
// Kostenskalierung der Konzernforschung (D10, Runde 2): Erz/Stahl = Minuten Erzproduktion der Spitzenrate (Bot-Neuguss, Median im Zeitfenster der Stufe)
// zur Freischaltzeit; Faktor auf die Basiskosten oben. Alle anderen Posten (Materialien, Titan, Legierung) skalieren schwächer, weil die Netto-Raten der
// Zwischenprodukte stark schwanken (Rezepte verbrauchen sie). Index = Konzernstufe - 1.
export const CORP_COST_ORE = [1, 1, 54, 360, 360, 340, 360];
export const CORP_COST_MAT = [1, 1, 2, 3, 4, 5, 6];
const sig2 = v => Number(v.toPrecision(2));
for (const x of RESEARCH) if (x.corp) for (const k in x.cost) x.cost[k] = sig2(x.cost[k] * (k === 'ore' || k === 'steel' ? CORP_COST_ORE : CORP_COST_MAT)[x.corp - 1]);
export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map(x => [x.id, x]));
