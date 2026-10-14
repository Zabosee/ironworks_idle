// Herausforderungen (ab dem 1. Neuguss): laufen als Modifikatoren im laufenden Durchlauf mit Zeitlimit, ohne Reset.
// Ziel = Stahl, der seit dem Start produziert wurde: max(floor, buff-freie Stahlrate beim Start x time x k). Offline-Stahl zählt nicht.
// Start erst nach CHALLENGE_MIN_RUN s Durchlaufzeit: direkt nach dem Neuguss wächst die Rate um Faktoren von 1e2 bis 1e7 je 20 min (Ziel wäre
// vom Startzeitpunkt abhängig, k_eff = erzeugter Stahl / (Startrate x Frist) liegt bei 300 s Durchlauf zwischen 3 und 8000); nach 30 min flacht die Rate ab
// (k_eff 1,3 bis 15, nach 60 min ca. 1), darum gilt k nahe 1 (iron: halbe Produktion, also k nahe 0,5). floor ist nur Mindestziel für sehr schwache Durchläufe.
// Kalibrierung: tools/challenge-calib.mjs (balance-sim.mjs-Bot, aktiv 4 Klicks/s, Bot spielt Durchläufe von mind. 60 min: MINRUN=3600 node tools/challenge-calib.mjs 30 4;
// Messpunkte 30/40/60 min Durchlaufzeit nach dem 1./3./8./15. Neuguss und nach 5 h; mit 1 Klick/s fast gleich). Alle drei sind immer schaffbar.
// Bot-Fertigstellung (Anteil der Frist), k = noclick 0,85 / onegen 0,85 / iron 0,43:
//   Plateau (Rate flach: 40 bis 60 min Durchlaufzeit ab dem 3. Neuguss): 78 bis 86 %;
//   Start bei 30 min oder im 1. Neuguss (Rate wächst noch): 33 bis 68 %. Wachstumsstarts sind leichter (früher fertig), nie unschaffbar.
// Ein Mensch ist langsamer als der Bot, k nicht weiter erhöhen.
export const CHALLENGE_MIN_RUN = 1800;   // Start erst, wenn der Durchlauf so viele Sekunden alt ist (direkt nach dem Neuguss ist die Stahlrate ~0)
export const CHALLENGE_BONUS = 0.03;   // dauerhaft je geschaffter Herausforderung (Produktion)
export const CHALLENGES = [
  { id: 'noclick', sym: 'finger', name: 'Ohne Klicken', desc: 'Klickertrag 0. Produziere das Stahlziel in 20 min.', time: 1200, k: 0.85, floor: 1e7, mods: { click: 0 } },
  { id: 'onegen',  sym: 'factory', name: 'Ein Generator', desc: 'Nur ein Generator-Typ darf gekauft werden (der erste Kauf legt ihn fest). Stahlziel in 20 min.', time: 1200, k: 0.85, floor: 1e7, mods: { oneGen: true } },
  { id: 'iron',    sym: 'hourglass', name: 'Eiserne Frist', desc: 'Produktion halbiert. Stahlziel in 30 min.', time: 1800, k: 0.43, floor: 1e7, mods: { prod: 0.5 } },
];
export const CHALLENGE_MAP = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
