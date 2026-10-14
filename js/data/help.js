// Hilfe/Glossar: reine Ableitung aus den Spieldaten (Rezepte, Generatoren, Forschung) plus kurze Texte zu den Spielebenen.
// Texte sind deutsch und zugleich i18n-Schlüssel (EN in i18n/en-ui.js); {n}-Platzhalter füllt ui/help.js über params.
import { RES_IDS } from './resources.js';
import { RECIPES } from './recipes.js';
import { GENS } from './generators.js';
import { RESEARCH } from './research.js';
import { CORP } from './corp.js';
import { OFFLINE_EFFICIENCY } from './timers.js';
import { DAILY } from './golden.js';

export const LAYERS = [
  { id: 'click', name: 'Klicken', text: 'Mit Erz sammeln erzeugst du Erz von Hand. Klick-Upgrades und der Shop machen jeden Klick wertvoller.' },
  { id: 'gens', name: 'Generatoren', text: 'Generatoren produzieren Material von selbst. Jede Stufe kostet mehr, alle 10 Stufen verdoppelt sich die Produktion. Ab Stufe 10 (Elite) kostet jede Stufe zusätzlich Titan.' },
  { id: 'lab', name: 'Labor und Werkbank', text: 'Forschung (Labor) und Upgrades/Boosts (Werkbank) laufen als Aufträge mit Dauer in einer Warteschlange. Gesperrte Einträge nennen ihre Voraussetzung; Forschung schaltet Generatoren, Rezepte und Materialien frei.' },
  { id: 'cast', name: 'Neuguss', text: 'Der Hochofen-Neuguss setzt den Durchlauf zurück und gibt dafür Gussformen: dauerhafter Produktionsbonus plus Shop. Je mehr Erz im Durchlauf, desto mehr Gussformen. Ab dem ersten Neuguss beginnen die Zeitalter.' },
  { id: 'corp', name: 'Konzern', text: 'Die Konzerngründung ist die zweite Reset-Ebene. Sie wird ab {n} Neugüssen freigeschaltet und gibt Patente für einen eigenen Shop und Konzernforschung.' },
  { id: 'focus', name: 'Schwerpunkt', text: 'Vor dem Neuguss wählst du Stahlschmiede, Titanofen oder Goldguss: Der nächste Durchlauf bekommt Bonus auf diese Materialkette und einen kleinen Malus auf die anderen.' },
  { id: 'challenges', name: 'Herausforderungen', text: 'Optionale Aufgaben mit Sonderregel und Zeitlimit (ab dem ersten Neuguss). Kein Risiko: nichts wird zurückgesetzt. Jede geschaffte gibt dauerhaft Produktion.' },
  { id: 'events', name: 'Zufallsereignisse', text: 'Während du spielst, erscheinen gelegentlich Ereignisse: Erzader, Rohstoffengpass oder Sonderauftrag. Klicken oder Liefern bringt einen Bonus. Der goldene Barren (Taste G) gibt einen kurzen Effekt.' },
  { id: 'offline', name: 'Offline und Tagesbonus', text: 'Auch bei geschlossenem Spiel läuft die Produktion nach, mit {pct} % des Aktiv-Ertrags und einer Zeitkappe. Der Tagesbonus gibt beim ersten Start des Tages einen Effekt; eine Serie bis Tag {max} steigert ihn.' },
];

export const layerParams = id => (id === 'corp' ? { n: CORP.unlockCount } : id === 'offline' ? { pct: Math.round(OFFLINE_EFFICIENCY * 100), max: DAILY.maxStreak } : undefined);

/** Glossar-Eintrag je Material, vollständig aus den Daten abgeleitet. */
export function glossary() {
  return RES_IDS.map(id => ({
    id,
    gens: GENS.filter(g => g.res === id),
    made: RECIPES.filter(r => id in r.outputs),
    fed: RECIPES.filter(r => id in r.inputs),
    costGens: GENS.filter(g => id in g.cost).length,
    costResearch: RESEARCH.filter(r => id in (r.cost || {})).length,
  }));
}
