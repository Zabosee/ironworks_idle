// Forschungsbaum. mult wirkt als Produktionsmultiplikator; weitere Effekte
// werden in core/formulas.js über die ID abgefragt (resonance, converter, titanium, autoclick, precision).
export const RESEARCH = [
  { id: 'geology',    icon: '🧭', name: 'Geologie',                   desc: '+25 % Erzproduktion.',                                              cost: { ore: 300 },                          mult: { ore: 1.25 } },
  { id: 'resonance',  icon: '🔨', name: 'Resonanzhammer',             desc: 'Jeder Klick gibt zusätzlich 5 % deiner Erz/s.',                     cost: { ore: 1500, steel: 15 },              req: ['geology'] },
  { id: 'converter',  icon: '♻️', name: 'Auto-Konverter',             desc: 'Wandelt automatisch 20 % der Erzproduktion in Stahl um (25:1).',    cost: { ore: 3000, steel: 40 },              req: ['geology'] },
  { id: 'deepmines',  icon: '🕳️', name: 'Tiefbau',                    desc: '+50 % Erzproduktion.',                                              cost: { ore: 6000, steel: 60 },              req: ['geology'], mult: { ore: 1.5 } },
  { id: 'metallurgy', icon: '🧪', name: 'Metallurgie',                desc: '+50 % Stahlproduktion. Schaltet das Walzwerk frei.',                cost: { ore: 8000, steel: 120 },             req: ['converter'], mult: { steel: 1.5 } },
  { id: 'titanium',   icon: '💎', name: 'Titan-Extraktion',           desc: 'Schaltet die Titan-Schmiede frei.',                                 cost: { ore: 15000, steel: 250 },            req: ['metallurgy'] },
  { id: 'refining',   icon: '🔬', name: 'Titan-Raffination',          desc: '+50 % Titanproduktion.',                                            cost: { ore: 40000, steel: 800, titan: 8 },  req: ['titanium'], mult: { titan: 1.5 } },
  { id: 'efficiency', icon: '📈', name: 'Globale Effizienz',          desc: '+50 % Produktion aller Materialien.',                               cost: { steel: 800, titan: 10 },             req: ['titanium'], mult: { all: 1.5 } },
  { id: 'autoclick',  icon: '🤖', name: 'Automatisierte Spitzhacken', desc: '5 automatische Klicks pro Sekunde.',                                cost: { steel: 2000, titan: 30 },            req: ['resonance', 'efficiency'] },
  { id: 'precision',  icon: '📐', name: 'Präzisionsfertigung',        desc: 'Zusätzliche Meilensteine (×2) bei Stufe 25, 50, 100, 150, 200 ...', cost: { ore: 2e5, steel: 5000, titan: 60 },  req: ['efficiency'] },
  { id: 'quantum',    icon: '⚛️', name: 'Quantenmetallurgie',         desc: '+100 % Produktion aller Materialien.',                              cost: { ore: 1e6, steel: 1e4, titan: 250 },  req: ['autoclick', 'precision'], mult: { all: 2 } },
];
export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map(r => [r.id, r]));
