// Forschungsbaum. mult wirkt als Produktionsmultiplikator; weitere Effekte
// werden in core/formulas.js über die ID abgefragt (resonance, autoclick, precision, automation).
// Freischaltungen laufen über `req` in Generatoren, Rezepten, Boosts, Klick-Upgrades und Ressourcen.
//   time:   Dauer in Sekunden (Labor-Warteschlange), vor Zeitverkürzung (Shop `q_speed`, Forschung `automation`)
//   liquid: Farbe der Flüssigkeit im Labor-Gefäß
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
];
export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map(x => [x.id, x]));
