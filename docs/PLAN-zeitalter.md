# Plan: Zeitalter "Industrialisierung" + Generator-Ausbau (Eisenwerk Idle) – Schritte 1-4 umgesetzt

Projekt: C:\Users\lukas\Desktop\GitHub\idle_game\eisenwerk-idle. PC-optimiert (mobil nicht nötig).
Vorläufige Annahmen (vom Assistenten als Standard gesetzt, noch NICHT vom Nutzer bestätigt): (1) Generator-Ausbau (`state.evo`) wird beim Neuguss ZURÜCKGESETZT, Zeitalter bleiben dauerhaft. (2) Zeitalter dürfen das Spiel beschleunigen; Balance/Tests werden neu kalibriert (Endspurt-Fenster möglichst 12-48 h halten, Boni notfalls senken). (3) Freischaltung über kumuliertes Erz `state.stats.total.ore` UND Mindest-Spielzeit `state.stats.playTime` (Nutzeranforderung: mind. 1 Woche bis alles frei; Offline-Zeit zählt, Neuguss setzt playTime nicht zurück).

## Kern
Zeitalter wird ABGELEITET, nicht gespeichert: eraIndex(ore, time) = höchstes i mit state.stats.total.ore >= ERAS[i].at UND state.stats.playTime >= ERAS[i].minTime. Monoton, überlebt Neuguss. Kein neues Material.

| # | Zeitalter | at (kum. Erz) | minTime (kum. Spielzeit) | globaler Bonus | Inhalte |
|---|---|---|---|---|---|
| 0 | Handwerk | 0 | 0 | x1 | Status quo |
| 1 | Mechanisierung | 3e6 | 15 min | x1.2 | Ausbau I, Forschung waterpower |
| 2 | Dampfzeitalter | 1e11 | 4 h | x1.3 | Ausbau II, steamengine, bessemer |
| 3 | Elektrifizierung | 1e15 | 36 h | x1.5 | Ausbau III, dynamo, electrosteel |
| 4 | Automatisierung | 1e19 | 4 Tage | x1.5 | Ausbau IV, assembly, robotics, Auto-Ausbau im Generatoren-Auto-Buyer |
| 5 | Digitalisierung | 1e23 | 7 Tage | x2 | Ausbau V, microchips, nanotech |
Alle Zahlen stehen in js/data/eras.js. eraProgress() = min(Erz-Fortschritt log, Zeit-Fortschritt linear); eraNeeds() -> { ore, time, missingTime } für die UI-Hinweise.

## Generator-Ausbau
- state.evo[genId] = 0..5 (EVO_MAX = 5). Stufe k kaufbar wenn eraIndex() >= k UND genLevel >= EVO_AT[k-1]; EVO_AT=[10,25,50,100,200].
- EVO_MULT=[1.5,1.5,2,2,3] (kumuliert x27), wirkt in genOutputAt zusätzlich zu Meilensteinen.
- Preis: unitCost('gen', id, EVO_AT[k-1]) * EVO_COST[k-1], EVO_COST=[25,60,150,400,1000]. Sofortkauf ohne Timer (eigene Funktion, keine Queue).
- Neuguss: state.evo wird zurückgesetzt. Auto-Buyer "Generatoren" kauft Ausbauten mit (kein neuer Shop-Eintrag).

## Forschung (neues optionales Feld `era: n`, Kosten mit vorhandenen Ressourcen)
waterpower(era1, req deepmines): Erz x1.5, Stahl x1.25 | steamengine(2, req waterpower+coalmining): alle x1.5 | bessemer(2, req steamengine): Stahl x2 | dynamo(3, req steamengine): alle x1.5 | electrosteel(3, req dynamo+bessemer): Stahl x2, Titan x1.5 | assembly(4, req dynamo): alle x1.5 | robotics(4, req assembly): Erz x2 | microchips(5, req robotics): alle x2 | nanotech(5, req microchips): alle x1.5. (9 Knoten -> 32 gesamt.)
Layout (neuer Ostarm, Raster 255): waterpower (510,-255), steamengine (765,-255), bessemer (765,-510), dynamo (1020,-255), electrosteel (1020,-510), assembly (1275,-255), robotics (1275,0), microchips (1530,-255), nanotech (1530,0). Kanten <= 600 px, Mindestabstand >= 225 px (steamengine->coalmining 570 px ok; coalmining liegt bei (255,-510)).
lockReason: bei research mit def.era > eraIndex() -> "Benötigt Zeitalter: <Name>". isRevealed: era-gesperrte Knoten sichtbar, wenn Eltern erforscht sind.

## Dateien
NEU: js/data/eras.js (ERAS=[{id,name,sym,at,minTime,mult,desc}], EVO_MAX, EVO_AT, EVO_MULT, EVO_COST; keine Imports), js/systems/eras.js (check(dt, force) alle 0.5 s, lastEra-Merker; emit('era',{index,era}) + toast 'Neues Zeitalter: ...' (gold), je Zeitalter bei Sprung; kein Toast beim Laden/Neuguss), js/systems/evolution.js (buyEvo(id):boolean, buyAllEvo():number; emit('evo',{id,level}); stats.buys++), js/ui/industry.js (Tab "Industrie"), tests/eras.test.mjs.
GEÄNDERT: core/state.js (defaultState().evo), core/formulas.js (eraIndex, eraMult, eraDef, nextEra, eraProgress 0..1, evoLevel, evoMult, evoCost (null bei Max), evoLock (Begründung|null); globalMult *= eraMult(); genOutputAt *= evoMult(g.id); lockReason/isRevealed für era), data/research.js, data/research-layout.js, systems/prestige.js (evo reset), core/save.js (SAVE_VERSION 5, migrate v4->v5 evo:{}, sanitize evo geklemmt auf 0..EVO_MAX, unbekannte IDs ignorieren), systems/autobuyers.js (runners.gens ruft nach Gen-Käufen buyAllEvo() mit gleicher Reserve-Logik), main.js (eras.check im Loop, check(0,true)/reset beim Laden/Neuguss), tools/balance-sim.mjs (Bot kauft Ausbauten, loggt Zeitalter-Zeitpunkte), index.html (Tab Industrie nach Generatoren, #era-summary in der Seitenleiste), ui/render.js (renderActive 'industry', renderTop #era-summary, Statistik-Zeile Zeitalter-Bonus), ui/research-map.js (Zeitalter-Badge/Grund bei era-gesperrten Knoten), ui/effects.js (Flash bei 'era'), css/styles.css, docs/GAME-DESIGN.md, README.md.
UI-Industrie-Tab: oben Zeitleiste der 6 Zeitalter (aktuell hervorgehoben, erreichte abgehakt, nächstes mit Fortschrittsleiste, Bonus + Inhalte); darunter Tabelle je Generator: Name, 5 Pips, nächster Multiplikator, Kosten (costEntries-Muster), Kaufen-Knopf, Grund bei Sperre (evoLock); Knopf "Alles ausbauen". DOM einmal bauen, im Frame nur Werte aktualisieren. Seitenleiste #era-summary: Zeitaltername, Bonus, dünne Fortschrittsleiste, "Nächstes: X – ab Y Erz und Z Spielzeit" (mit Hinweis auf die fehlende Bedingung).

## Tests / Risiken
Bestehende Tests anpassen (SAVE_VERSION 4->5 in phase2a, Forschungsanzahl 23->32 in research-layout/phase2b), neue tests/eras.test.mjs (Grenzwerte, evoCost/evoLock/buyEvo, Neuguss-Reset, Save-Roundtrip + Migration v4->v5 + Sanitizing, Toast nur bei Aufstieg, lockReason Zeitalter). Balance: Sim kalibrieren (Zeitalter ca. 0.5 h/1.2 h/2 h/3 h/<=8 h), tests/balance.test.mjs Fenster beachten; zuerst EVO_MULT/EVO_COST/ERAS.mult senken, PRESTIGE.growth/divisor nicht anfassen. tools/e2e.mjs auf feste Tab-Listen prüfen.
