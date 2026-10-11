// Warteschlangen für zeitgegatete Freischaltungen (reine Daten).
//   kinds:   welche Kaufarten in diese Warteschlange laufen
//   slots:   Basis-Anzahl gleichzeitig laufender Aufträge (Erweiterung über den Hochofen-Shop: slotShop)
//   waiting: Plätze für wartende Aufträge (zusätzlich zu den Slots)
export const QUEUES = {
  lab:      { id: 'lab',      name: 'Labor',     kinds: ['research'],       slots: 1, waiting: 3, slotShop: 'q_lab' },
  workshop: { id: 'workshop', name: 'Werkbank',  kinds: ['boost', 'click'], slots: 1, waiting: 3, slotShop: 'q_work' },
};
export const QUEUE_IDS = Object.keys(QUEUES);
export const queueIdOf = kind => QUEUE_IDS.find(q => QUEUES[q].kinds.includes(kind)) ?? null;

export const REFUND = { waiting: 1, running: 0.5 };   // Anteil der Kosten bei Abbruch
export const SPEED_SHOP = 'q_speed';                   // Shop-Eintrag: je Stufe Dauer x SPEED_PER_LEVEL
export const SPEED_PER_LEVEL = 0.92;
export const AUTOMATION_RESEARCH = 'automation';       // Forschung: alle Dauern x AUTOMATION_MULT
export const AUTOMATION_MULT = 0.75;
export const MIN_DURATION = 1;                         // Sekunden
export const MAX_ENTRIES = 12;                         // Obergrenze beim Laden eines Spielstands
