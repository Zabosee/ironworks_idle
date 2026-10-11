// Forschungsbaum. mult wirkt als Produktionsmultiplikator; weitere Effekte
// werden in core/formulas.js über die ID abgefragt (resonance, autoclick, precision, automation).
// Freischaltungen laufen über `req` in Generatoren, Rezepten, Boosts, Klick-Upgrades und Ressourcen.
//   time:   Dauer in Sekunden (Labor-Warteschlange), vor Zeitverkürzung (Shop `q_speed`, Forschung `automation`)
//   liquid: Farbe der Flüssigkeit im Labor-Gefäß
//   era:    optional, Mindest-Zeitalter (Index in data/eras.js); darunter ist die Forschung sichtbar, aber gesperrt
//   cat:    Gefäßform in der UI: 'mining' Erlenmeyer, 'metal' Reagenzglas, 'chem' Rundkolben, 'tech' Retorte
const LIQ = { ore: '#f97316', steel: '#38bdf8', titan: '#d946ef', all: '#fbbf24', coal: '#64748b', coke: '#a8a29e', copper: '#ea8a52', manganese: '#a78bfa', chrome: '#5eead4', nickel: '#a3e635', alloy: '#38bdf8', tungsten: '#f472b6', gold: '#fbbf24' };
const r = (id, icon, name, desc, cost, time, cat, liq, extra = {}) => ({ id, icon, name, desc, cost, time, cat, liquid: LIQ[liq], ...extra });

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
];
export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map(x => [x.id, x]));
