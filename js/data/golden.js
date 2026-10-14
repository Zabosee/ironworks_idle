// Goldene Events: Buff-Definitionen und Gewichte.
export const GOLDEN = {
  firstDelay: [45, 90],      // Sekunden bis zum ersten Event
  interval: [70, 190],       // danach zufällig in diesem Bereich
  lifetime: 15,              // Sekunden, die der goldene Barren sichtbar bleibt
};
// Tagesbonus: garantierter Buff beim ersten Start an einem neuen Kalendertag; Dauer wächst mit der Serie bis maxStreak.
export const DAILY = { buff: 'frenzy', maxStreak: 7, perStreak: 0.25 };
export const BUFFS = {
  frenzy:      { id: 'frenzy', img: 'assets/icons/furnace.svg',      sym: 'flame', icon: '🔥', name: 'Schmelzrausch', kind: 'prod',  mult: 7,  duration: 45, desc: 'Produktion ×7' },
  // Zufallsereignisse (systems/events-random.js): vein/orderbonus sind normale Buffs, shortage wirkt nur auf die Ressource im Feld res (core/formulas.js rates)
  vein:        { id: 'vein', sym: 'hammer', icon: '⛏️', name: 'Erzader', kind: 'click', mult: 10, duration: 30, desc: 'Klickwert ×10' },
  orderbonus:  { id: 'orderbonus', sym: 'star', icon: '⭐', name: 'Auftragsprämie', kind: 'prod', mult: 2, duration: 60, desc: 'Produktion ×2' },
  shortage:    { id: 'shortage', sym: 'hourglass', icon: '⏳', name: 'Rohstoffengpass', kind: 'res', mult: 0.5, duration: 60, desc: 'Ein Material −50 %' },
  clickfrenzy: { id: 'clickfrenzy', sym: 'hammer', icon: '🔨', name: 'Hammerwut',     kind: 'click', mult: 25, duration: 20, desc: 'Klickwert ×25' },
};
// Gewichtete Ereignisse
export const GOLDEN_EVENTS = [
  { type: 'buff',  buff: 'frenzy',      weight: 45 },
  { type: 'buff',  buff: 'clickfrenzy', weight: 25 },
  { type: 'lucky', weight: 30 },
];
