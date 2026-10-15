// Generatoren. cost = Basiskosten pro Ressource, growth = Kostenwachstum je Stufe,
// elite = Basis der zusätzlichen Titan-Kosten ab Stufe ELITE_FROM, req = Array von Forschungs-IDs (ein String wird weiter akzeptiert).
// img = Icon-Pfad (Phase 3 legt fehlende Dateien an, bis dahin zeigt die UI das Emoji `icon`).
export const MILESTONE_STEP = 10;   // alle 10 Stufen Produktion x2
export const ELITE_FROM = 10;       // ab dieser Stufe kostet jede Stufe zusätzlich Titan
export const ELITE_GROWTH = 1.3;
export const MAX_LEVEL = 5000;      // harte Grenze gegen Überlauf
export const EXTRA_MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500]; // Forschung "Präzisionsfertigung"

const g = (id, icon, name, res, base, cost, growth, elite, req) =>
  ({ id, img: `assets/icons/gen-${id}.svg`, icon, name, res, base, cost, growth, elite, ...(req ? { req } : {}) });

export const GENS = [
  g('mine',        '⛏️', 'Eisenmine',         'ore',       1,     { ore: 15 },                                     1.15, 2),
  g('drill',       '🏗️', 'Bohrturm',          'ore',       12,    { ore: 400, steel: 10 },                         1.17, 2),
  g('smelter',     '🔥', 'Schmelzofen',       'steel',     0.25,  { ore: 150 },                                    1.2,  2),
  g('plant',       '🏭', 'Walzwerk',          'steel',     4,     { ore: 2e5, steel: 3000 },                       1.21, 5, ['metallurgy']),
  g('forge',       '⚗️', 'Titan-Schmiede',    'titan',     0.02,  { ore: 20000, steel: 500 },                      1.25, 2, ['titanium']),
  // Eisenhütten-Kette (Phase 2b)
  g('colliery',    '🚇', 'Zeche',             'coal',      2,     { ore: 3e4, steel: 400 },                        1.17, 3, ['coalmining']),
  g('cokery',      '🧱', 'Koksofenbatterie',  'coke',      0.5,   { ore: 8e4, steel: 1500, coal: 200 },            1.18, 3, ['coking']),
  g('copperhut',   '🏚️', 'Kupferhütte',       'copper',    0.6,   { ore: 2e5, steel: 6000 },                       1.19, 4, ['copperworks']),
  g('manganmine',  '⛓️', 'Manganbergwerk',    'manganese', 0.3,   { steel: 2e4, copper: 150, coke: 200 },          1.2,  4, ['manganese']),
  g('mixer',       '🧪', 'Legierungsmischer', 'alloy',     0.08,  { steel: 1e5, copper: 1500, manganese: 400 },    1.22, 5, ['alloying']),
  g('chromeworks', '🛞', 'Chromwerk',         'chrome',    0.12,  { steel: 3e5, manganese: 800, alloy: 30 },       1.22, 6, ['chromium']),
  g('nickelref',   '🛢️', 'Nickelraffinerie',  'nickel',    0.1,   { steel: 3e5, copper: 8000, alloy: 30 },         1.22, 6, ['chromium']),
  g('reactor',     '☢️', 'Wolframreaktor',    'tungsten',  0.02,  { titan: 3000, alloy: 300, chrome: 200, nickel: 200 }, 1.25, 8, ['tungsten']),
  g('crucible',    '👑', 'Edelmetall-Tiegel', 'gold',      0.004, { titan: 2e4, tungsten: 200, alloy: 1500 },      1.27, 10, ['goldsmith']),
  // Konzern-Materialien (Ausbau 2, GAME-DESIGN.md B4.2); Freigabe über Konzernforschung
  g('cobaltmine',      '🔵', 'Kobaltgrube',               'cobalt',     0.003,  { titan: 4e4, tungsten: 400, alloy: 3000 },                     1.28, 12, ['c_cobalt']),
  g('molybdenumworks', '⚙️', 'Molybdänwerk',              'molybdenum', 0.0025, { titan: 6e4, cobalt: 300, alloy: 4000 },                       1.28, 14, ['c_moly']),
  g('sinterworks',     '🔶', 'Sinterwerk',                'carbide',    0.002,  { titan: 1e5, tungsten: 2000, cobalt: 600, molybdenum: 300 },   1.29, 16, ['c_sinter']),
  g('platinummine',    '⚪', 'Platinmine',                'platinum',   0.0012, { titan: 2e5, gold: 300, carbide: 400 },                        1.30, 18, ['c_platin']),
  g('vanadiumworks',   '🟢', 'Vanadiumhütte',             'vanadium',   0.0015, { titan: 2.5e5, molybdenum: 800, carbide: 600 },                1.30, 20, ['c_vanadium']),
  g('iridiumlab',      '💠', 'Iridiumlabor',              'iridium',    0.0006, { titan: 5e5, platinum: 800, molybdenum: 1500, gold: 800 },     1.31, 24, ['c_iridium']),
  g('superfoundry',    '🔷', 'Superlegierungs-Gießerei',  'superalloy', 0.0003, { titan: 1e6, iridium: 500, vanadium: 2000, carbide: 3000 },    1.32, 30, ['c_super']),
];
export const GEN_MAP = Object.fromEntries(GENS.map(x => [x.id, x]));

// ---------- Evolution der Werkshalle ----------
// 20 Ränge. Rang 0 Holz (ab Stufe 1; Stufe 0 zählt ebenfalls als Rang 0), 1 Eisen (10), 2 Stahl (25), 3 Titan (50), 4 Gold (100) ... 19 Kosmos (5000 = MAX_LEVEL).
export const TIER_AT = [1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000, 2500, 3500, 5000];
export const TIER_NAMES = ['Holz', 'Eisen', 'Stahl', 'Titan', 'Gold', 'Platin', 'Iridium', 'Obsidian', 'Kristall', 'Mithril',
  'Adamant', 'Diamant', 'Äther', 'Plasma', 'Quanten', 'Nebel', 'Stern', 'Nova', 'Singularität', 'Kosmos'];
export const TIER_PIPS = 5;   // Pips pro Rang-Etappe

/** Rang 0..19 für eine Generator-Stufe. */
export function genTier(level) {
  let t = 0;
  for (let i = 1; i < TIER_AT.length; i++) if (level >= TIER_AT[i]) t = i;
  return t;
}

/** Anzeigename eines Rangs; ungültige Werte werden auf 0..19 geklemmt. */
export const tierName = tier => TIER_NAMES[Math.max(0, Math.min(TIER_NAMES.length - 1, Math.floor(Number(tier) || 0)))];

/**
 * Fortschritt bis zum nächsten Rang: { tier, next, progress, pips, total }.
 * next = Stufe des nächsten Rangs (null im höchsten Rang), progress 0..1 zwischen Rangschwelle und next,
 * pips = gefüllte von `total` (5) Etappen-Markern; im höchsten Rang immer voll.
 */
export function tierPips(level) {
  const tier = genTier(level), next = TIER_AT[tier + 1] ?? null;
  if (next === null) return { tier, next, progress: 1, pips: TIER_PIPS, total: TIER_PIPS };
  const from = tier === 0 ? 0 : TIER_AT[tier];
  const progress = Math.max(0, Math.min(1, (level - from) / (next - from)));
  return { tier, next, progress, pips: Math.min(TIER_PIPS - 1, Math.floor(progress * TIER_PIPS)), total: TIER_PIPS };
}
