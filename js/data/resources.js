// Ressourcen-Definitionen (reine Daten).
//   img:  Pfad zum Icon (Phase 3 legt fehlende Dateien an; bis dahin zeigt die UI das Emoji `icon`)
//   req:  Forschungs-IDs, die das Material in der UI sichtbar machen (ohne req: von Anfang an sichtbar).
//         Sichtbar ist ein Material außerdem, sobald davon etwas produziert wurde.
const mk = (id, name, icon, color, req) => ({ id, img: `assets/icons/res-${id}.svg`, name, icon, color, ...(req ? { req } : {}) });
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
].map(r => [r.id, r]));
export const RES_IDS = Object.keys(RES);
