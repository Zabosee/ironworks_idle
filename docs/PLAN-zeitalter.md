# Plan: Zeitalter "Industrialisierung" + Generator-Ausbau (Eisenwerk Idle) – Schritte 1-4 umgesetzt

Historischer Plan. Maßgeblich ist der Code (`js/data/eras.js`, `js/data/research.js`); der aktuelle Stand (Schwellen, Forschungen, Kalibrierung) steht in docs/GAME-DESIGN.md, Abschnitte 3a und 3b. Wo dieser Plan davon abwich, ist es unten korrigiert oder als überholt markiert.

Projekt: C:\Users\lukas\Desktop\GitHub\idle_game\eisenwerk-idle. PC-optimiert (mobil nicht nötig).
Vorläufige Annahmen (vom Assistenten als Standard gesetzt, bis heute unbestätigt/offen, nicht vom Nutzer bestätigt): (1) Generator-Ausbau (`state.evo`) wird beim Neuguss ZURÜCKGESETZT, Zeitalter bleiben dauerhaft. (2) Zeitalter dürfen das Spiel beschleunigen; Balance/Tests werden neu kalibriert (Endspurt-Fenster möglichst 12-48 h halten, Boni notfalls senken). (3) Freischaltung nur über kumuliertes Erz `state.stats.total.ore` (die frühere Mindest-Spielzeit `minTime` wurde entfernt; `playTime` ist nur noch Statistik) und erst ab dem 1. Neuguss (`prestige.count >= 1`, sonst Zeitalter 0; Industrie-Tab bis dahin versteckt).

## Kern
Zeitalter wird ABGELEITET, nicht gespeichert: eraIndex(ore, unlocked) = 0, solange prestige.count < 1; sonst höchstes i mit state.stats.total.ore >= ERAS[i].at. Monoton, überlebt Neuguss. Kein neues Material.

| # | Zeitalter | at (kum. Erz) | globaler Bonus | Inhalte |
|---|---|---|---|---|
| 0 | Handwerk | 0 | x1 | Status quo |
| 1 | Mechanisierung | 1e17 | x1.2 | Ausbau I, Energie-Forschung (Wasserkraft) |
| 2 | Dampfzeitalter | 1e20 | x1.3 | Ausbau II, Dampfmaschine, Bessemer-Konverter (Boost) |
| 3 | Elektrifizierung | 1e22 | x1.5 | Ausbau III, Dynamo, Stromversorgung, Elektrifizierung |
| 4 | Automatisierung | 1e23 | x1.5 | Ausbau IV, Fließband, Robotik, Auto-Ausbau im Generatoren-Auto-Buyer |
| 5 | Digitalisierung | 3e23 | x2 | Ausbau V, Halbleitertechnik, Nanotechnologie |
Alle Zahlen stehen in js/data/eras.js (die Schwellen im Plan waren 1e16, 1e19, 1e21, 2e22, 1e23; sie wurden bei der Kalibrierung angehoben). eraProgress() = Erz-Fortschritt (log). Details und Kalibrierung: docs/GAME-DESIGN.md Abschnitt 3a.

## Generator-Ausbau
- state.evo[genId] = 0..5 (EVO_MAX = 5). Stufe k kaufbar wenn eraIndex() >= k UND genLevel >= EVO_AT[k-1]; EVO_AT=[10,25,50,100,200].
- EVO_MULT=[1.5,1.5,2,2,3] (kumuliert x27), wirkt in genOutputAt zusätzlich zu Meilensteinen.
- Preis: unitCost('gen', id, EVO_AT[k-1]) * EVO_COST[k-1], EVO_COST=[25,60,150,400,1000]. Sofortkauf ohne Timer (eigene Funktion, keine Queue).
- Neuguss: state.evo wird zurückgesetzt. Auto-Buyer "Generatoren" kauft Ausbauten mit (kein neuer Shop-Eintrag).

## Forschung (optionales Feld `era: n`, Kosten mit vorhandenen Ressourcen)
Geplant waren 9 neue Knoten (32 gesamt, Ostarm im Raster 255). ÜBERHOLT: Umgesetzt sind 76 Forschungen (Zeitalter 0: 30, 1: 8, 2: 9, 3: 10, 4: 10, 5: 9) mit anderen Namen und IDs (z. B. `hydropower`, `steamengine`, `dynamo`, `assembly`, `robotics`, `semiconductor`, `nanotech`), dazu 15 Zeitalter-Boosts und 2 Klick-Upgrades. Vollständige Liste: docs/GAME-DESIGN.md, Abschnitt 6; Koordinaten: js/data/research-layout.js.
lockReason: bei research mit def.era > eraIndex() -> "Benötigt Zeitalter: <Name>". isRevealed: era-gesperrte Knoten sichtbar, wenn Eltern erforscht sind.

## Dateien
NEU: js/data/eras.js (ERAS=[{id,name,sym,at,mult,desc}], EVO_MAX, EVO_AT, EVO_MULT, EVO_COST; keine Imports), js/systems/eras.js (check(dt, force) alle 0.5 s, lastEra-Merker; emit('era',{index,era}) + toast 'Neues Zeitalter: ...' (gold), je Zeitalter bei Sprung; kein Toast beim Laden/Neuguss), js/systems/evolution.js (buyEvo(id):boolean, buyAllEvo():number; emit('evo',{id,level}); stats.buys++), js/ui/industry.js (Tab "Industrie"), tests/eras.test.mjs.
GEÄNDERT: core/state.js (defaultState().evo), core/formulas.js (eraIndex, eraMult, eraDef, nextEra, eraProgress 0..1, evoLevel, evoMult, evoCost (null bei Max), evoLock (Begründung|null); globalMult *= eraMult(); genOutputAt *= evoMult(g.id); lockReason/isRevealed für era), data/research.js, data/research-layout.js, systems/prestige.js (evo reset), core/save.js (SAVE_VERSION 5, migrate v4->v5 evo:{}, sanitize evo geklemmt auf 0..EVO_MAX, unbekannte IDs ignorieren), systems/autobuyers.js (runners.gens ruft nach Gen-Käufen buyAllEvo() mit gleicher Reserve-Logik), main.js (eras.check im Loop, check(0,true)/reset beim Laden/Neuguss), tools/balance-sim.mjs (Bot kauft Ausbauten, loggt Zeitalter-Zeitpunkte), index.html (Tab Industrie nach Generatoren, #era-summary in der Seitenleiste), ui/render.js (renderActive 'industry'), renderTop #era-summary (heute in ui/sidebar.js), Statistik-Zeile Zeitalter-Bonus (heute ui/panels.js), ui/research-map.js (Zeitalter-Badge/Grund bei era-gesperrten Knoten), ui/effects.js (Flash bei 'era'), css/styles.css, docs/GAME-DESIGN.md, README.md.
UI-Industrie-Tab: oben Zeitleiste der 6 Zeitalter (aktuell hervorgehoben, erreichte abgehakt, nächstes mit Fortschrittsleiste, Bonus + Inhalte); darunter Tabelle je Generator: Name, 5 Pips, nächster Multiplikator, Kosten (costEntries-Muster), Kaufen-Knopf, Grund bei Sperre (evoLock); Knopf "Alles ausbauen". DOM einmal bauen, im Frame nur Werte aktualisieren. Seitenleiste #era-summary: Zeitaltername, Bonus, dünne Fortschrittsleiste, "Nächstes: X – ab Y Erz" (die ursprünglich geplante Mindest-Spielzeit gibt es nicht mehr).

## Tests / Risiken
Bestehende Tests anpassen (SAVE_VERSION 4->5 in phase2a, Forschungsanzahl 23->32 in research-layout/phase2b, heute 76), neue tests/eras.test.mjs (Grenzwerte, evoCost/evoLock/buyEvo, Neuguss-Reset, Save-Roundtrip + Migration v4->v5 + Sanitizing, Toast nur bei Aufstieg, lockReason Zeitalter). Balance: Sim kalibrieren (damaliges Ziel: Zeitalter ca. 0.5 h/1.2 h/2 h/3 h/<=8 h; tatsächliche Werte siehe GAME-DESIGN.md 3b), tests/balance.test.mjs Fenster beachten; zuerst EVO_MULT/EVO_COST/ERAS.mult senken, PRESTIGE.growth/divisor nicht anfassen. tools/e2e.mjs auf feste Tab-Listen prüfen.
