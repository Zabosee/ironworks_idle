// Zufallsereignisse im Werk (nur aktive Spielzeit). Höchstens eines gleichzeitig; Belohnungen bewusst klein.
export const RANDOM_EVENTS = {
  interval: [480, 900],   // Sekunden aktive Spielzeit bis zum nächsten Ereignis (8 bis 15 min); gilt auch für das erste
  types: [
    { id: 'vein',     name: 'Erzader entdeckt',  hint: 'Klicken: Klick-Bonus für 30 s', life: 45, buff: 'vein' },
    { id: 'shortage', name: 'Rohstoffengpass',   hint: '{res} −50 % – Klicken behebt den Engpass', life: 60 },   // Wirkung = Buff 'shortage' mit Feld res
    { id: 'order',    name: 'Sonderauftrag',     hint: 'Liefere {need} {res} (noch {sec} s) für Produktions-Bonus', life: 90, seconds: 45, min: 10, buff: 'orderbonus' },   // need = Rate × seconds, mindestens min
  ],
};
export const RANDOM_EVENT_MAP = Object.fromEntries(RANDOM_EVENTS.types.map(e => [e.id, e]));
