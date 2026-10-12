// Ressourcen-Definitionen (reine Daten).
//   img:  Pfad zum Icon (Phase 3 legt fehlende Dateien an; bis dahin zeigt die UI das Emoji `icon`)
//   req:  Forschungs-IDs, die das Material in der UI sichtbar machen (ohne req: von Anfang an sichtbar).
//         Sichtbar ist ein Material außerdem, sobald davon etwas produziert wurde.
//   sym:  (optional) Symbolname in assets/sprites/items.svg (sym-<name>), nur für die Konzern-Materialien
const mk = (id, name, icon, color, req, sym) => ({ id, img: `assets/icons/res-${id}.svg`, name, icon, color, ...(req ? { req } : {}), ...(sym ? { sym } : {}) });
export const RES = Object.fromEntries([
  mk('ore',       'Eisenerz',        '🪨', '#f97316'),
  mk('steel',     'Stahlbarren',     '🔩', '#38bdf8'),
  mk('titan',     'Titan-Legierung', '💎', '#d946ef'),
  mk('coal',      'Kohle',           '⚫', '#475569', ['coalmining']),
  mk('coke',      'Koks',            '🟫', '#78716c', ['coking']),
  mk('copper',    'Kupfer',          '🟧', '#ea8a52', ['copperworks']),
  mk('manganese', 'Mangan',          '🟪', '#a78bfa', ['manganese']),
  mk('chrome',    'Chrom',           '🟦', '#5eead4', ['chromium']),
  mk('nickel',    'Nickel',          '🟩', '#a3e635', ['chromium']),
  mk('alloy',     'Legierung',       '🔗', '#38bdf8', ['alloying']),
  mk('tungsten',  'Wolfram',         '🧿', '#f472b6', ['tungsten']),
  mk('gold',      'Gold',            '🥇', '#fbbf24', ['goldsmith']),
  // Konzern-Materialien (Ausbau 2). Kobalt #60a5fa statt #3b82f6 (Kontrast, Entscheidung D6).
  mk('cobalt',     'Kobalt',         '🔵', '#60a5fa', ['c_cobalt'],   'cobalt'),
  mk('molybdenum', 'Molybdän',       '⚙️', '#94a3b8', ['c_moly'],     'molybdenum'),
  mk('carbide',    'Hartmetall',     '🔶', '#cbd5e1', ['c_sinter'],   'carbide'),
  mk('platinum',   'Platin',         '⚪', '#e2e8f0', ['c_platin'],   'platinum'),
  mk('vanadium',   'Vanadium',       '🟢', '#34d399', ['c_vanadium'], 'vanadium'),
  mk('iridium',    'Iridium',        '💠', '#fb7185', ['c_iridium'],  'iridium'),
  mk('superalloy', 'Superlegierung', '🔷', '#22d3ee', ['c_super'],    'superalloy'),
].map(r => [r.id, r]));
export const RES_IDS = Object.keys(RES);
