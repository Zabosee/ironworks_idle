// Achievements. check(state) ist rein lesend. bonus = additiver Anteil am globalen Produktionsbonus (0.01 = +1 %).
import { RESEARCH } from './research.js';
import { BOOSTS } from './upgrades.js';

const ACH = [];
const fmtBig = n => (n >= 1e15 ? `10^${Math.round(Math.log10(n))}` : n.toLocaleString('de-DE'));
// Emoji (Fallback) -> Symbol-ID im Sprite assets/sprites/items.svg
const SYM = { '👆': 'finger', '🪨': 'rock', '🏭': 'factory', '⭐': 'star', '🔩': 'nut', '💎': 'gem', '⚫': 'coal', '🟫': 'brick', '🟧': 'ingot', '🔗': 'chain', '🧿': 'target',
  '🥇': 'medal', '🔬': 'microscope', '🧠': 'brain', '🚀': 'rocket', '⏱️': 'stopwatch', '🔥': 'flame', '🌟': 'sparkle', '⏳': 'hourglass' };
const add = (id, icon, name, desc, bonus, check) => ACH.push({ id, icon, sym: SYM[icon], name, desc, bonus, check });
const sumGens = s => Object.values(s.gens).reduce((a, b) => a + b, 0);
const maxGen = s => Math.max(0, ...Object.values(s.gens));
const researchCount = s => Object.keys(s.research).length;

[[1, 'Erster Schlag'], [100, 'Fleißige Hände'], [1000, 'Schwielen'], [10000, 'Hammerfaust'], [100000, 'Schmiedegott']]
  .forEach(([n, name], i) => add('click_' + n, '👆', name, `Klicke ${n.toLocaleString('de-DE')} Mal.`, 0.01 * (i + 1) / 2 + 0.005, s => s.stats.clicks >= n));

[[1e3, 'Erzfunde'], [1e6, 'Millionenmine'], [1e9, 'Berg abgetragen'], [1e12, 'Erzbaron'], [1e15, 'Montan-Imperium'], [1e20, 'Planetenfresser']]
  .forEach(([n, name], i) => add('ore_' + n, '🪨', name, `Produziere insgesamt ${fmtBig(n)} Erz.`, 0.01 * (i + 1), s => s.stats.total.ore >= n));

[[10, 'Kleiner Betrieb'], [50, 'Werkshalle'], [150, 'Industriepark'], [400, 'Konzern'], [1000, 'Weltkonzern']]
  .forEach(([n, name], i) => add('gens_' + n, '🏭', name, `Besitze insgesamt ${n} Generator-Stufen.`, 0.01 * (i + 1), s => sumGens(s) >= n));

[[10, 'Elite-Stufe'], [25, 'Präziser Takt'], [50, 'Meisterbetrieb'], [100, 'Hundertschaft']]
  .forEach(([n, name], i) => add('level_' + n, '⭐', name, `Bringe einen Generator auf Stufe ${n}.`, 0.01 * (i + 1), s => maxGen(s) >= n));

add('steel_1', '🔩', 'Stahlhart', 'Produziere insgesamt 1.000 Stahl.', 0.01, s => s.stats.total.steel >= 1e3);
add('steel_2', '🔩', 'Stahlwerk', 'Produziere insgesamt 1 Mio. Stahl.', 0.02, s => s.stats.total.steel >= 1e6);
add('titan_1', '💎', 'Titanfunke', 'Produziere insgesamt 100 Titan.', 0.01, s => s.stats.total.titan >= 100);
add('titan_2', '💎', 'Titanschmied', 'Produziere insgesamt 100.000 Titan.', 0.02, s => s.stats.total.titan >= 1e5);

// Eisenhütten-Kette
[['coal', 1e4, '⚫', 'Kohlenstaub', 'Kohle'], ['coke', 1e3, '🟫', 'Koksfeuer', 'Koks'], ['copper', 1e3, '🟧', 'Kupferdach', 'Kupfer'], ['alloy', 100, '🔗', 'Legierungskunst', 'Legierung'],
  ['tungsten', 50, '🧿', 'Wolframwerker', 'Wolfram'], ['gold', 10, '🥇', 'Goldrausch', 'Gold']]
  .forEach(([k, n, icon, name, label], i) => add(k + '_1', icon, name, `Produziere insgesamt ${fmtBig(n)} ${label}.`, 0.01 + 0.002 * i, s => s.stats.total[k] >= n));
add('gold_2', '🥇', 'Goldreserve', 'Produziere insgesamt 10.000 Gold.', 0.03, s => s.stats.total.gold >= 1e4);

add('res_1', '🔬', 'Wissbegierig', 'Schließe 3 Forschungen ab.', 0.01, s => researchCount(s) >= 3);
add('res_2', '🔬', 'Forscherdrang', 'Schließe 7 Forschungen ab.', 0.02, s => researchCount(s) >= 7);
add('res_4', '🔬', 'Laborleiter', 'Schließe 15 Forschungen ab.', 0.03, s => researchCount(s) >= 15);
add('res_3', '🧠', 'Allwissend', 'Schließe alle Forschungen ab.', 0.05, s => researchCount(s) >= RESEARCH.length);
add('boost_1', '🚀', 'Turbo', 'Kaufe 3 Elite-Boosts.', 0.02, s => Object.keys(s.boosts).length >= 3);
add('boost_3', '🚀', 'Werkbankprofi', 'Kaufe 10 Elite-Boosts.', 0.03, s => Object.keys(s.boosts).length >= 10);
add('boost_2', '🚀', 'Vollgas', 'Kaufe alle Elite-Boosts.', 0.04, s => Object.keys(s.boosts).length >= BOOSTS.length);

[[10, 'Geduldsprobe'], [50, 'Zeitplaner'], [200, 'Taktgeber']]
  .forEach(([n, name], i) => add('timer_' + n, '⏱️', name, `Schließe ${n} Aufträge in Labor und Werkbank ab.`, 0.01 * (i + 1), s => s.stats.timersDone >= n));

[[1, 'Neuguss'], [5, 'Gussprofi'], [25, 'Gießmeister'], [100, 'Ewige Esse']]
  .forEach(([n, name], i) => add('prestige_' + n, '🔥', name, `Führe ${n} Hochofen-Neuguss${n > 1 ? 'e' : ''} durch.`, 0.02 * (i + 1), s => s.prestige.count >= n));

[[1, 'Goldener Moment'], [10, 'Glückspilz'], [50, 'Goldgräber'], [200, 'Midas']]
  .forEach(([n, name], i) => add('golden_' + n, '🌟', name, `Fange ${n} goldene Barren.`, 0.01 * (i + 1), s => s.stats.golden >= n));

[[3600, 'Eine Schicht', '1 Stunde'], [86400, 'Rund um die Uhr', '24 Stunden'], [604800, 'Stammbelegschaft', '7 Tage']]
  .forEach(([n, name, label], i) => add('time_' + n, '⏳', name, `Spiele insgesamt ${label}.`, 0.01 * (i + 1), s => s.stats.playTime >= n));

export const ACHIEVEMENTS = ACH;
export const ACHIEVEMENT_MAP = Object.fromEntries(ACH.map(a => [a.id, a]));
