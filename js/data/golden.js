// Goldene Events: Buff-Definitionen und Gewichte.
export const GOLDEN = {
  firstDelay: [45, 90],      // Sekunden bis zum ersten Event
  interval: [70, 190],       // danach zufällig in diesem Bereich
  lifetime: 15,              // Sekunden, die der goldene Barren sichtbar bleibt
};
export const BUFFS = {
  frenzy:      { id: 'frenzy', img: 'assets/icons/furnace.svg',      sym: 'flame', icon: '🔥', name: 'Schmelzrausch', kind: 'prod',  mult: 7,  duration: 45, desc: 'Produktion ×7' },
  clickfrenzy: { id: 'clickfrenzy', sym: 'hammer', icon: '🔨', name: 'Hammerwut',     kind: 'click', mult: 25, duration: 20, desc: 'Klickwert ×25' },
};
// Gewichtete Ereignisse
export const GOLDEN_EVENTS = [
  { type: 'buff',  buff: 'frenzy',      weight: 45 },
  { type: 'buff',  buff: 'clickfrenzy', weight: 25 },
  { type: 'lucky', weight: 30 },
];
