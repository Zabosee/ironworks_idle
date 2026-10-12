# Eisenwerk Idle – Spieldesign 2 (Idle-Kreislauf, Industrie-Ausbau, Konzerngründung, 3-Wochen-Ziel)

Design-Spezifikation (Schritt 1 des Plans `docs/PLAN-ausbau-3wochen.md`). Es wurde noch kein Code und keine Datendatei geändert. Alle Zahlen sind Startwerte, die in Schritt 6 (Kalibrierung) per Simulation nachgezogen werden; die Formeln und Gleichungen in Abschnitt 6 sagen, welche Stellschraube welchen Zeitpunkt bewegt. Referenz für alle Ist-Werte: `docs/GAME-DESIGN.md` (Abschnitte 1 bis 4 und 8) und der kalibrierte Sim-Lauf `node tools/balance-sim.mjs 175 4 1 30 rate`; zusätzlich wurde für dieses Dokument ein 200-h-Lauf mit denselben Parametern gemessen (siehe 6.1).

## 0. Kernentscheidungen auf einen Blick

| Thema | Entscheidung |
|---|---|
| Zweite Reset-Ebene | "Konzerngründung", Währung "Patente" (Annahme A2 bleibt) |
| Freischaltung | `prestige.count >= N` mit **N = 100** Neugüssen (A2 schlug 25 vor, begründet geändert: Abschnitt 3.1) |
| Patente-Formel | `floor(Gussformen_im_Konzernlauf / D)`, linear, **D = 34.000** (Start), mal `1 + 0,1 × Stufe "Lizenzgebühren"` |
| Zurückgesetzt / bleibt | Gussformen, Hochofen-Shop, Neuguss-Chronik und alles, was ein Neuguss zurücksetzt, **gehen**; Zeitalter, Erfolge, Statistik, Neuguss-Zähler, Patente, Konzernforschung **bleiben** (A3 bestätigt) |
| Neue Materialien | 7 (Kobalt, Molybdän, Hartmetall, Platin, Vanadium, Iridium, Superlegierung), 7 Generatoren, 4 Rezepte |
| Neue Forschung | 36 (Konzernforschung), Boosts +8, Klick-Upgrades +3 |
| Industrie | Zeitalter 6 bis 8, Ausbau VI bis VIII, zwei Meilenstein-Leisten (Fördermenge 8 Stufen, Materialvielfalt 7 Stufen) |
| Gesamtzeitplan (Bot `rate`, aktiv) | Konzern sichtbar ca. 13 h, 1. Konzerngründung ca. 34 h, letztes Material ca. 440 h, **alles frei ca. 600 h** (Korridor 504 bis 700 h) |
| Neuer Gesamtumfang | 112 Forschungen, 39 Boosts, 9 Klick-Upgrades, 21 Generatoren, 19 Materialien, 10 Rezepte, 9 Zeitalter |

## 1. Idle-Kreislauf-Analyse

### 1.1 Ist-Zustand
Der Kreislauf "produzieren, kaufen, Neuguss, stärker neu beginnen" ist vorhanden: Generatoren mit 10er-Meilensteinen (×2), Forschung/Boosts mit Timern, Hochofen-Neuguss (Gussformen, Shop, 6 Meilensteine), Zeitalter, Erfolge, goldene Events, Auto-Buyer. Was ein klassisches Inkrement-Spiel (Revolution Idle, Antimatter Dimensions) zusätzlich trägt und hier fehlt:

| Lücke | Wirkung auf das Spielgefühl | Maßnahme |
|---|---|---|
| Es gibt keine einzelne Anzeige "was ist mein nächstes Ziel und wie weit bin ich?" (Zeitalter-Balken nur in der Seitenleiste, ab dem 1. Neuguss) | Spieler weiß nicht, wofür er gerade wartet | M1 Zielleiste |
| Die Neuguss-Entscheidung "jetzt oder später" ist blind (kein Gewinn/h, kein Meilenstein-Hinweis) | Neuguss wird zu früh oder zu spät gemacht | M2 Neuguss-Vorschau |
| Bei ca. 8,6 Neugüssen/h (Sim) ist manuelles Gießen über Wochen mühsam; es gibt nur Auto-Buyer, keinen Auto-Neuguss | Spielfluss bricht, Offline-Zeit wird nicht ausgenutzt | M3 Auto-Neuguss (Patente-Shop) |
| Vor dem 1. Neuguss (ca. 1,8 h) gibt es kein sichtbares Systemziel (offener Punkt in GAME-DESIGN.md Abschnitt 8) | Frühe Ziel-Lücke | M4 Gesperrte Reiter + Fortschritt zum 1. Neuguss |
| Lange Ziele jenseits Stunde 35 fehlen: der letzte Hochofen-Meilenstein (250.000) fällt bei ca. 34,5 h, Zeitalter 5 bei ca. 192 h, danach kommt nichts mehr | Kein Langzeitziel, keine zweite Ebene | Konzerngründung (Abschnitt 3), Zeitalter 6 bis 8, Meilenstein-Leisten (Abschnitt 2) |
| Offline-Ertrag ist 1:1 und auf 8 h (+2 h je Stufe) gedeckelt; bei 600 h Zielzeit wird er zur Hauptzeit | Offline lohnt sich zu wenig | M5 Offline-Ausbau (nur Cap, kein Mehrertrag) |
| Meilensteine existieren nur auf Generatorstufe und Gussformen; keine auf Gesamtleistung | Wenig "Pling" für Gesamtfortschritt | M6 Industrie-Meilensteine (Abschnitt 2.3) |
| Generator-Meilensteine alle 10 Stufen sind nicht sichtbar auf den Karten | Kleine Ziele fehlen | M7 Hinweis "noch n Stufen bis ×2" |

### 1.2 Maßnahmen (klein, passend zum Konzept)

| Nr | Maßnahme | Inhalt | Umsetzung |
|---|---|---|---|
| M1 | **Zielleiste** ("Nächstes Ziel") | Eine Zeile oben im Werk: das nächstliegende Ziel aus der Liste (a) 1. Neuguss, (b) nächster Gussformen-Meilenstein, (c) nächstes Zeitalter, (d) nächste Industrie-Meilenstein-Stufe, (e) nächste Konzernstufe; je Ziel Fortschrittsbalken (logarithmisch bei Erz) und, falls die Rate bekannt ist, geschätzte Restzeit. | Neue reine Funktion `nextGoals()` in `js/core/goals.js` (liest nur `state`, nutzt `eraProgress`, `prestigeGain`, `oreForGain`, neue Corp-/Industry-Helfer) |
| M2 | **Neuguss-Vorschau** | Im Hochofen-Bereich: Gewinn jetzt, Gewinn/h (Gewinn / Laufzeit), nächster Gussformen-Meilenstein ("noch X"), Hinweis "lohnt sich" (Gewinnzuwachs der letzten 2 min unter dem Durchlauf-Schnitt, dieselbe Regel wie die Sim-Policy `rate`). | `state.stats.runTime`, `prestige.history`; kleine Hilfsfunktion in `formulas.js` |
| M3 | **Auto-Neuguss** | Freischaltung im Konzern-Shop (`c_autocast`). Einstellung `modus: Gewinn` (Neuguss ab Gewinn >= Wert, Vorgabe = Mittel der letzten 5 Gewinne) oder `modus: Zeit` (Neuguss nach n Minuten). Mindestlaufzeit 60 s. Es gibt **keinen** Auto-Konzern (Konzerngründung bleibt immer manuell). | `state.autoCast`, Tick in `main.js`/`systems/prestige.js` |
| M4 | **Früher Systemhinweis** | Industrie-Reiter ab Spielbeginn sichtbar, aber gesperrt ("Ab dem ersten Neuguss"), dazu Fortschritt zu 1e7 Erz. Konzern-Reiter ab Neuguss 25 gesperrt sichtbar, Freischaltung bei 100. | UI (Schritt 2/5) |
| M5 | **Offline-Ausbau** | Konzern-Shop "Nachtschicht II": +4 h Offline-Cap je Stufe (max 3). Ertrag bleibt 100 %. Der Willkommen-zurück-Toast zeigt zusätzlich "Cap erreicht in ..." beim Laden. | `offlineCapSeconds` + 4 h × Stufe |
| M6 | **Industrie-Meilensteine** | Zwei automatische Leisten (Abschnitt 2.3), Toast bei Erreichen, ein Panel im Industrie-Tab. | `systems/industry.js` (Muster `systems/eras.js`) |
| M7 | **Generator-Meilenstein-Hinweis** | Auf der Generatorkarte: "noch n Stufen bis ×2". Nur Anzeige, `MILESTONE_STEP` ist 10. | UI |

Bewusst nicht aufgenommen: Soft-Caps, Challenges, Ressourcen-Verfall, zusätzliche Klick-Minispiele. Sie passen nicht zum bestehenden Konzept und würden den Umfang sprengen.

## 2. Industrie-Ausbau

### 2.1 Zeitalter 6 bis 8
Weiterhin abgeleitet aus `stats.total.ore`, kumulativer Bonus, wirksam ab dem 1. Neuguss. Die Schwellen sind aus der Zielkurve in 6.3 abgeleitet (Zeitpunkt, an dem der Bot das kumulierte Erz erreicht).

| Zeitalter | Name | Schwelle (Erz) | Bonus | Ziel-Zeit (Bot) | Freischaltung |
|---|---|---|---|---|---|
| 6 | Atomzeitalter (`atomic`, Symbol `atom`) | 5e24 | ×1,5 | ca. 300 h | Ausbau VI, Konzernforschung "Iridium-Abscheidung" und "Orbitalfertigung" |
| 7 | Raumfahrt (`space`, Symbol `rocket`) | 8e25 | ×1,5 | ca. 430 h | Ausbau VII, Konzernforschung "Superlegierungs-Guss" |
| 8 | Kosmische Schmiede (`cosmic`, Symbol `star`) | 4e26 | ×2,0 | ca. 540 h | Ausbau VIII, Konzernforschung "Weltkonzern-Charta" |

Kumulativer Zeitalter-Bonus nach Zeitalter 8: 7,02 (bisher) × 1,5 × 1,5 × 2 = 31,6.

### 2.2 Generator-Ausbau VI bis VIII
`EVO_MAX` 5 auf 8. Gleiche Regeln wie bisher: Stufe k braucht Zeitalter >= k und Generatorstufe >= `EVO_AT[k-1]`, Kosten = `unitCost('gen', id, EVO_AT[k-1]) × EVO_COST[k-1]`, Reset beim Neuguss.

| Stufe | Zeitalter | Stufe des Generators | Multiplikator | Kosten-Faktor |
|---|---|---|---|---|
| 6 | 6 | 300 | ×2 | ×2.000 |
| 7 | 7 | 325 | ×2 | ×3.000 |
| 8 | 8 | 345 | ×3 | ×4.000 |

- Kumulativer Multiplikator aller 8 Stufen: ×27 × 12 = ×324.
- Die Generatorstufen sind so gewählt, dass die billigen Generatoren (Wachstum 1,15 bis 1,17: Eisenmine, Bohrturm, Schmelzofen, Zeche) die Stufen zu ca. 1 bis 15 % der Zeitalter-Schwelle erreichen (Beispiel Eisenmine: Stufe 300 kostet 15 × 1,15^300 × 2.000 = 4,8e22 Erz bei Zeitalter 6 mit 5e24). Teure Generatoren (Wachstum >= 1,25) erreichen sie praktisch nie; das ist gewollt: Ausbau VI bis VIII ist **offen** und zählt **nicht** zu "alles freigeschaltet" (siehe 6.5, Entscheidung D2).
- Daten: `EVO_AT = [10,25,50,100,200,300,325,345]`, `EVO_MULT = [1.5,1.5,2,2,3,2,2,3]`, `EVO_COST = [25,60,150,400,1000,2000,3000,4000]`. Der Auto-Buyer "Generatoren" kauft die neuen Stufen mit (bestehende Logik, keine Änderung).

### 2.3 Industrie-Meilensteine (neue Meilenstein-Ebene)
Zwei Leisten, automatisch, kostenlos, global multiplikativ auf alle Ausgaben (neuer Faktor `industryMult()` in `globalMult`). Kein Eintrag im Spielstand nötig: Der Wert wird aus `stats.total` abgeleitet (bleibt über Neuguss und Konzerngründung erhalten). Toast in Gold bei Erreichen (Merker wie in `systems/eras.js`).

**Leiste A "Fördermenge"** (Wert = `stats.total.ore`, kumuliertes Erz):

| Stufe | Schwelle | Bonus | Kosten | Freischaltung | Ziel-Zeit (Bot) |
|---|---|---|---|---|---|
| A1 | 1e12 | ×1,05 | – | – | ca. 2,5 h |
| A2 | 1e15 | ×1,05 | – | – | ca. 5 h |
| A3 | 1e18 | ×1,05 | – | – | ca. 20 h |
| A4 | 1e21 | ×1,10 | – | – | ca. 70 h |
| A5 | 1e24 | ×1,10 | – | Titel "Montan-Imperium" (Erfolg `industry_a5`) | ca. 240 h |
| A6 | 1e25 | ×1,10 | – | – | ca. 320 h |
| A7 | 1e26 | ×1,15 | – | – | ca. 440 h |
| A8 | 1e27 | ×1,15 | – | Erfolg "Erzgott" (letzte Leiste A) | ca. 600 h |

Produkt: 2,04.

**Leiste B "Materialvielfalt"** (Wert = Anzahl der Ressourcen `k` mit `stats.total[k] > 0`; derzeit 12 mögliche, nach Ausbau 19):

| Stufe | Schwelle | Bonus | Kosten | Freischaltung | Ziel-Zeit (Bot) |
|---|---|---|---|---|---|
| B1 | 6 | ×1,05 | – | – | ca. 1 h |
| B2 | 9 | ×1,05 | – | – | ca. 2 h |
| B3 | 12 | ×1,10 | – | – (alle Materialien des Grundspiels) | ca. 3 h |
| B4 | 14 | ×1,10 | – | – (Kobalt, Molybdän) | ca. 43 h |
| B5 | 16 | ×1,15 | – | – (Hartmetall, Platin) | ca. 160 h |
| B6 | 18 | ×1,15 | – | – (Vanadium, Iridium) | ca. 320 h |
| B7 | 19 | ×1,25 | – | Erfolg "Alle Materialien" | ca. 440 h |

Produkt: 2,2. Gesamtbeitrag der Industrie-Meilensteine bei ca. 560 h: ca. ×3,2 (A bis A7, B komplett).

Begründung gegen die bestehenden Boni: Zeitalter ×31,6 und Hochofen-Meilensteine ×562 sind große, seltene Sprünge; die Leisten liefern viele kleine Schritte (14 Stufen), also das "Pling"-Gefühl in den langen Phasen zwischen den Zeitaltern (z. B. A4 bis A7 liegen in den Lücken 70 h bis 440 h).

## 3. Zweite Reset-Ebene: Konzerngründung

### 3.1 Freischaltung
- Sichtbar/aktiv ab `state.prestige.count >= N`, **N = 100** (Neuguss-Zähler, bleibt über die Konzerngründung erhalten, sonst wäre die Bedingung nach jedem Konzern erneut zu erfüllen).
- Begründung N = 100 (Sim-Werte aus GAME-DESIGN.md 3b und dem 200-h-Lauf: Neuguss 40 bei 6,5 h, 280 bei 34,5 h, ca. 8,6 Neugüsse/h dazwischen): Neuguss 100 liegt bei ca. 13,5 h, nach Zeitalter 1 (7,5 h) und weit vor Zeitalter 2 (37,9 h). Der Spieler hat die Hochofen-Schleife verstanden (6 Meilensteine erreichen 5 bis 10.000 Gussformen bis 4,3 h), das Wissensarchiv ist längst gekauft, aber der Langzeitmeilenstein 250.000 (34,5 h) ist noch offen und gibt für die nächsten 20 h ein Ziel. N = 25 (A2-Vorschlag, ca. 5,3 h) wäre noch vor Zeitalter 1: zu früh, zwei Reset-Ebenen konkurrierten um dieselbe Aufmerksamkeit. N = 250 (ca. 31 h) wäre erst mit dem letzten Hochofen-Meilenstein fällig und ließe 20 h bis zur ersten Konzerngründung leer. Zudem existiert bereits ein Erfolg für 100 Neugüsse (`prestige_100`), der als Auslöser-Toast taugt.
- Zwischen Neuguss 100 und der ersten Konzerngründung zeigt der Konzern-Reiter eine **Vorschau** (Patente-Gewinn aktuell, nötige Gussformen für die erste Patente, Liste der Belohnungen). Die erste Patente gibt es ab `Gussformen >= D` (34.000), erste Konzerngründung des Bots bei 250.000 Gussformen (ca. 34 h) mit 7 Patenten.

### 3.2 Gewinnformel
```
Gc            = state.prestige.total              // Gussformen seit der letzten Konzerngründung (wird dort auf 0 gesetzt)
corpGain(Gc)  = floor( Gc / D_CORP × (1 + 0,1 × Stufe c_gain) )
D_CORP        = 34.000                             // Start, Stellschraube
```
- **Linear**, nicht konkav: Der Patente-Gewinn pro Stunde ist dann praktisch unabhängig davon, wie oft man gründet (nur die Wiederaufbauzeit kostet). Eine konkave Formel (z. B. Wurzel) würde häufiges Gründen belohnen und den A1-Zeitplan von der Spielweise abhängig machen (Überschlag im Entwurf, nicht simuliert: Bei Wurzel-Formel brächte eine Gründung alle 6 h statt alle 40 h ca. 1,5- bis 1,7-fach schnelleren Fortschritt, der Korridor 504 bis 700 h wäre nicht mehr einzuhalten). Mit linearer Formel gilt eine harte Obergrenze: `Patente_gesamt(t) <= Gussformen_gesamt(t) / D_CORP`, egal wie gespielt wird. Das ist die zentrale Handhabe für A1 (siehe 6.2).
- Mindestgewinn: Konzerngründung nur bei `corpGain >= 1`. Bestätigungsdialog zeigt Gewinn, die Liste "geht/bleibt" und die neue Konzernstufe.
- Auswirkung auf die Wirtschaft: Patente erhöhen die Produktion (3.4), schalten Konzernforschung frei (Abschnitt 5) und werden im Konzern-Shop ausgegeben (3.5).

### 3.3 Was zurückgesetzt wird, was bleibt (A3)

| Zurückgesetzt bei Konzerngründung | Bleibt |
|---|---|
| Alles, was ein Neuguss zurücksetzt: Ressourcen, Generatoren, Klick-Upgrades, Ausbauten (`evo`), Boosts, Buffs, normale Forschung (auch mit Wissensarchiv), Werkbank- und Labor-Warteschlange | Zeitalter (hängen an `stats.total.ore`), Industrie-Meilensteine, Erfolge, Statistik (`stats.total`, `playTime`, Klicks), Einstellungen |
| `prestige.points`, `prestige.total`, `prestige.history` (also auch alle Hochofen-Meilensteine) | `prestige.count` (Neuguss-Zähler, Erfolge und Freischaltung hängen daran) |
| `prestige.shop` (alle Hochofen-Shop-Stufen inkl. Wissensarchiv, Auto-Buyer-Freischaltungen, Zusatzplätze, Zeitraffer, Erzvorrat, Nachtschicht) | `corp.*` (Patente, Konzern-Shop, Konzernzähler), `autobuyers`-Schalter (an/aus, wirken nur bei freigeschaltetem Auto-Buyer), `autoCast` |
| Laufende Laborforschung (auch mit Wissensarchiv) | **Konzernforschung** (alle Forschungen mit Feld `corp`; sie bleibt auch bei jedem Neuguss erhalten) |

Begründung: Der Wiederaufbau nach der Konzerngründung (Bot ca. 3 h) ist der Preis; er sinkt durch den Konzern-Shop ("Hochofen-Erbe", "Konzernarchiv", "Konzern-Automatisierung") und durch Zeitalter-Bonus ×7 plus Patente-Bonus. Die Konzernforschung bleibt, weil ihre Freischaltung bewusst viele Stunden dauert (Dauer bis 4 h je Auftrag) und sie sonst bei jedem Konzern erneut abgesessen werden müsste, was den Zeitplan unkontrollierbar mit der Spielweise koppeln würde. Die zugehörigen Generatoren, Rezepte und Materialien erscheinen sofort wieder, sobald die Ressourcen reichen.

### 3.4 Wirkung der Patente
```
corpMult = (1 + 0,02 × Patente_gesamt × (1 + 0,2 × Stufe c_eff))  ×  Π (Konzern-Meilensteine)
```
Geht als weiterer Faktor in `globalMult()` ein. Patente_gesamt = `corp.total` (verdient, nicht ausgegeben). Bei 200 Patenten: ×5 (ohne `c_eff`), mit `c_eff` 4: ×8,2.

**Konzern-Meilensteine** (auf `corp.total`, analog zu `MILESTONES`; "Stufe" = Konzernstufe K):

| Stufe K | Schwelle (Patente gesamt) | Bonus | Freischaltung | Ziel-Zeit (Bot) |
|---|---|---|---|---|
| K1 | 5 | ×1,1 | Konzernforschung I: Kobalt, Molybdän; Konzern-Shop komplett sichtbar | ca. 34 h |
| K2 | 20 | ×1,1 | Konzernforschung II: Hartmetall, Werkzeug | ca. 74 h |
| K3 | 45 | ×1,15 | Konzernforschung III: Platin, Edelmetall-Netzwerk | ca. 154 h |
| K4 | 75 | ×1,15 | Konzernforschung IV: Vanadium, Laborautomatisierung II | ca. 234 h |
| K5 | 110 | ×1,2 | Konzernforschung V: Iridium (zusätzlich Zeitalter 6), Quantenfertigung | ca. 314 h |
| K6 | 150 | ×1,2 | Konzernforschung VI: Superlegierung (zusätzlich Zeitalter 7), Orbitalfertigung | ca. 434 h |
| K7 | 205 | ×1,5 | Konzernforschung VII: Weltkonzern-Charta (zusätzlich Zeitalter 8) | ca. 554 h |

Produkt aller Stufen: 3,45 (bis K6: 2,30).

### 3.5 Konzern-Shop (Patente)
Gleiches Datenformat wie `SHOP` (`cost × growth^Stufe`, abgerundet/`ceil` wie `shopCost`), eigenes Objekt `CORP_SHOP` in `js/data/corp.js`.

| id | Name | Wirkung | Kosten Stufe 1 | Wachstum | Max | Summe |
|---|---|---|---|---|---|---|
| `c_eff` | Aktienmehrheit | +20 % Wirkung der Patente je Stufe | 3 | ×1,5 | 4 | 26 |
| `c_gain` | Lizenzgebühren | +10 % Patente je Konzerngründung je Stufe | 2 | ×1,5 | 4 | 17 |
| `c_cast` | Gussformen-Fabrik | +15 % Gussformen je Neuguss je Stufe (multiplikativ zu `pp_gain`) | 4 | ×1,5 | 4 | 33 |
| `c_heir` | Hochofen-Erbe | Der Gussformen-Stand für Multiplikator und Meilensteine beginnt jeden Konzernlauf bei mindestens 5 / 150 / 1.000 / 10.000 / 250.000 (Stufe 1 bis 5); `prestige.total` bleibt unverändert, zählt also nicht für Patente | 2, 4, 7, 12, 20 (feste Liste) | – | 5 | 45 |
| `c_archive` | Konzernarchiv | Normale Forschung bleibt beim **Neuguss** erhalten (ersetzt das durch die Konzerngründung verlorene Wissensarchiv) | 6 | – | 1 | 6 |
| `c_auto` | Konzern-Automatisierung | Je Stufe ein Auto-Buyer dauerhaft freigeschaltet (Reihenfolge Generatoren, Spitzhacke, Forschung, Boosts) | 4 | ×1,3 | 4 | 26 |
| `c_offline` | Nachtschicht II | +4 h maximaler Offline-Ertrag je Stufe | 3 | ×2 | 3 | 21 |
| `c_autocast` | Auto-Neuguss | Schaltet den automatischen Neuguss frei (M3) | 10 | – | 1 | 10 |
| `c_click` | Konzern-Schmiedehand | +50 % Klickwert je Stufe | 2 | ×1,6 | 4 | 21 |
| | | | | | **Summe** | **205** |

- Die Summe 205 ist bewusst gleich der Schwelle K7 (205): Der Konzern-Shop ist erst vollständig, wenn die letzte Konzernstufe erreicht ist (Ziel ca. 554 h).
- `c_heir` Stufe 5 (250.000) stellt den größten Hochofen-Multiplikator (×562 in Meilensteinen) wieder her; die Stufe wird deshalb zuletzt gekauft.
- Technisch: `prestigeMult(total = Math.max(state.prestige.total, heirFloor()))`; `heirFloor()` = `[0,5,150,1000,10000,250000][Stufe c_heir]`.
- Reihenfolge des Bots (Sim): `c_archive`, `c_heir` 1, `c_gain` 1, `c_cast` 1, `c_auto` 1, `c_eff` 1, `c_heir` 2, `c_gain` 2 ... (Wachstum von Patenten und Gussformen zuerst, Komfort danach); `c_heir` 5 und die letzten `c_offline` zuletzt.

### 3.6 Bezug zum Hochofen
Der Hochofen-Neuguss bleibt die Quelle der Gussformen und damit die Basis der Patente (`Gc` = Gussformen im Konzernlauf). Eine Konzerngründung entwertet sie vollständig, der Konzern-Shop stellt gezielt Teile wieder her (Erbe, Archiv, Auto-Buyer). `c_cast` und `c_gain` verbinden beide Ebenen. Neuguss und Konzern haben eigene Bestätigungsdialoge; der Hochofen-Dialog bleibt unverändert.

## 4. Neue Materialien (Kette auf Gold und Wolfram)

Sieben neue Ressourcen, jede mit eigenem Generator, sichtbar erst nach der Freischalt-Forschung oder bei vorhandenem Vorrat (`resVisible`). Kette:

```
Wolfram + Kobalt ──(6:2 → 1)──► Hartmetall
Nickel + Gold ──(10:1 → 1)──► Platin
Platin + Molybdän ──(10:4 → 1)──► Iridium
Hartmetall + Iridium + Vanadium ──(6:1:3 → 1)──► Superlegierung
```

### 4.1 Ressourcen

| id | Name | Farbe | Icon (Fallback) | Sichtbar durch | Zeit (Bot) | Konzernstufe | Zeitalter |
|---|---|---|---|---|---|---|---|
| `cobalt` | Kobalt | #3b82f6 | 🔵 | `c_cobalt` | ca. 40 h | K1 | – |
| `molybdenum` | Molybdän | #94a3b8 | ⚙️ | `c_moly` | ca. 43 h | K1 | – |
| `carbide` | Hartmetall | #cbd5e1 | 🔶 | `c_sinter` | ca. 80 h | K2 | – |
| `platinum` | Platin | #e2e8f0 | ⚪ | `c_platin` | ca. 160 h | K3 | – |
| `vanadium` | Vanadium | #34d399 | 🟢 | `c_vanadium` | ca. 240 h | K4 | – |
| `iridium` | Iridium | #fb7185 | 💠 | `c_iridium` | ca. 320 h | K5 | 6 |
| `superalloy` | Superlegierung | #22d3ee | 🔷 | `c_super` | ca. 440 h | K6 | 7 |

Farben sind gegen die vorhandenen Material- und Flüssigkeitsfarben (`#475569`, `#78716c`, `#ea8a52`, `#a78bfa`, `#5eead4`, `#a3e635`, `#38bdf8`, `#f472b6`, `#fbbf24`) abgegrenzt. Icons/Sprites (SVG, `assets/sprites/items.svg` Symbol `sym-<id>`) liefert Schritt 2/5; bis dahin Emoji-Fallback.

### 4.2 Generatoren

Format wie `GENS` (`g(id, icon, name, res, base, cost, growth, elite, req)`). Die Basis fällt je Stufe um ca. ×0,5 bis ×0,6 (wie bisher: Wert pro Einheit steigt); die Kosten bestehen aus dem Vormaterial plus Titan, das Wachstum steigt von 1,28 auf 1,32.

| id | Name | Produziert | Basis/s | Start-Kosten | Wachstum | Elite (Titan ab Stufe 10) | Freigabe |
|---|---|---|---|---|---|---|---|
| `cobaltmine` | Kobaltgrube | Kobalt | 0,003 | 4e4 Titan, 400 Wolfram, 3000 Legierung | ×1,28 | 12 | `c_cobalt` |
| `molybdenumworks` | Molybdänwerk | Molybdän | 0,0025 | 6e4 Titan, 300 Kobalt, 4000 Legierung | ×1,28 | 14 | `c_moly` |
| `sinterworks` | Sinterwerk | Hartmetall | 0,002 | 1e5 Titan, 2000 Wolfram, 600 Kobalt, 300 Molybdän | ×1,29 | 16 | `c_sinter` |
| `platinummine` | Platinmine | Platin | 0,0012 | 2e5 Titan, 300 Gold, 400 Hartmetall | ×1,30 | 18 | `c_platin` |
| `vanadiumworks` | Vanadiumhütte | Vanadium | 0,0015 | 2,5e5 Titan, 800 Molybdän, 600 Hartmetall | ×1,30 | 20 | `c_vanadium` |
| `iridiumlab` | Iridiumlabor | Iridium | 0,0006 | 5e5 Titan, 800 Platin, 1500 Molybdän, 800 Gold | ×1,31 | 24 | `c_iridium` |
| `superfoundry` | Superlegierungs-Gießerei | Superlegierung | 0,0003 | 1e6 Titan, 500 Iridium, 2000 Vanadium, 3000 Hartmetall | ×1,32 | 30 | `c_super` |

### 4.3 Rezepte (am Ende von `RECIPES`, in dieser Reihenfolge)

| id | Name | Anteil | Eingang | Ausgang | Freigabe |
|---|---|---|---|---|---|
| `sinter` | Hartmetall-Sinterung | 30 % | 6 Wolfram + 2 Kobalt | 1 Hartmetall | `c_sinter` |
| `platinref` | Platin-Raffination | 30 % | 10 Nickel + 1 Gold | 1 Platin | `c_platin` |
| `iridsep` | Iridium-Abscheidung | 25 % | 10 Platin + 4 Molybdän | 1 Iridium | `c_iridium` |
| `supercast` | Superlegierungs-Guss | 40 % | 6 Hartmetall + 1 Iridium + 3 Vanadium | 1 Superlegierung | `c_super` |

Die Reihenfolge stellt sicher, dass spätere Rezepte die Ausgänge früherer sehen (`goldsmelt` steht davor, `sinter` sieht das Wolfram-Netto nach der Goldschmelze; kein Rezept verbraucht mehr als produziert wird, daher keine negativen Raten).

### 4.4 Erreichbarkeit der Kette (Fixpunkt)
Keine Zyklen: Jede Freischalt-Forschung kostet nur Vormaterialien (Abschnitt 5.2), jeder Generator nur Vormaterialien oder Material aus derselben Stufe plus Titan (Kobalt: Wolfram, Legierung, Titan; Molybdän: Kobalt, Legierung, Titan; Hartmetall: Wolfram, Kobalt, Molybdän; Platin: Gold, Hartmetall; Vanadium: Molybdän, Hartmetall; Iridium: Platin, Molybdän, Gold; Superlegierung: Iridium, Vanadium, Hartmetall). Reihenfolge der Abhängigkeiten: Kobalt, Molybdän, Hartmetall, (Platin, Vanadium), Iridium, Superlegierung.

## 5. Neue Forschung, Boosts und Klick-Upgrades

### 5.1 Neue Felder und Regeln
- Forschung/Boost/Klick-Upgrade erhalten das optionale Feld `corp: k` (Mindest-Konzernstufe, 1 bis 7), neben `era`. `lockReason` liefert "Benötigt Konzernstufe: K{k}" (Reihenfolge der Prüfungen: Voraussetzungen, Zeitalter, Konzernstufe, Queue).
- Alle 36 neuen Forschungen tragen `corp` und sind **permanent** (3.3). Boosts und Klick-Upgrades bleiben normal (Reset beim Neuguss).
- Neue Wirkungs-Schlüssel in `mult`: alle Ressourcen-IDs der neuen Materialien (sonst unverändert). Neuer Sondereffekt `timeMult2` (Forschung `c_lab2`): zusätzlicher Faktor ×0,85 in `timeMult()`.

### 5.2 Kosten- und Dauerformeln (per Skript erzeugbar)
Die Kosten werden wie bei den Zeitalter-Forschungen aus Sim-Raten abgeleitet (GAME-DESIGN.md 3b: "Kostenkalibrierung"); Schritt 6 erzeugt die Tabelle per Skript aus `simulate().runRates` für den Zeitpunkt `t_k` der Konzernstufe k:

```
T_k   = Ziel-Erz-Kurve beim Zeitpunkt der Stufe: K1 5e19, K2 2,7e21, K3 1,3e23, K4 3e23, K5 3e24, K6 5e25, K7 5,6e26
Erz    = 0,1 × T_k
Stahl  = 2,5 × Erz
Material r (je Kostenposten) = f(Art) × Rate_ref(r, k) × 1800 s     // Rate_ref = Median der Spitzenraten kurz vor dem Neuguss bei t_k
Dauer  (s)  = 1800 × 1,4^(k-1) × g(Art)                              // 30, 42, 59, 82, 115, 161, 226 min für g = 1
```

| Art | f (Material) | Posten | g (Dauer) |
|---|---|---|---|
| Freischaltung (U) | 0,3 | Vormaterialien laut 4.4 (je 2 bis 3 Posten) | 1,0 |
| Anreicherung I (A) | 0,15 eigenes + 0,15 Vormaterial | eigenes Material, ein Vormaterial | 0,6 |
| Anreicherung II (B) | 0,4 eigenes | eigenes Material, Tier +1 | 0,8 |
| Konzernprozess | 0,2 | Titan, Legierung | 1,0 |
| Spezial (S) | 0,3 | Gold, Wolfram (K3+: Platin) | 1,2 |

- Beispielreihenfolge der Größenordnung: K1: Erz 5e18, Stahl 1,25e19; K4: 3e22 / 7,5e22; K7: 5,6e25 / 1,4e26 (konsistent mit der bestehenden Regel "größter Posten 0,2 bis 1,0 × Zeitalter-Schwelle", dort bei 0,1 × kumuliertem Erz im Zeitalter-5-Bereich: Erz 1e22 bis 1e23).
- Effektive Dauer: Zeitraffer (×0,61) und Laborautomatisierung (×0,75, mit `c_lab2` ×0,64) verkürzen. Beispiel K7-Spezial: 226 min × 1,2 = 271 min × ca. 0,46 = ca. 2,1 h.

### 5.3 Die 36 Forschungen
`(U)` Freischaltung, `(A)` Anreicherung I, `(B)` Anreicherung II (Konzernstufe = Stufe des Materials + 1, höchstens 7), `(P)` Konzernprozess, `(S)` Spezial. Kategorie/Flüssigkeit: Material-Forschung `chem` mit Materialfarbe, `(P)` `tech` #fbbf24, `(S)` `tech`/`metal`.

| id | Name | Art | K | Zeitalter | Voraussetzung | Wirkung |
|---|---|---|---|---|---|---|
| `c_cobalt` | Kobaltbergbau | U | 1 | – | Goldschmiedekunst | Schaltet die Kobaltgrube frei und macht Kobalt abbaubar. |
| `c_moly` | Molybdän-Aufbereitung | U | 1 | – | Kobaltbergbau | Schaltet das Molybdänwerk frei. |
| `c_cobalt_a` | Kobalt-Anreicherung I | A | 1 | – | Kobaltbergbau | +12 % Kobaltproduktion. |
| `c_moly_a` | Molybdän-Röstung I | A | 1 | – | Molybdän-Aufbereitung | +12 % Molybdänproduktion. |
| `c_patent` | Patentwesen | S | 1 | – | Goldschmiedekunst | +8 % Produktion aller Materialien. |
| `c_proc_1` | Konzernprozess I | P | 1 | – | Kobaltbergbau | +5 % aller Materialien. |
| `c_sinter` | Hartmetall-Sinterung | U | 2 | – | Molybdän-Aufbereitung, Wolfram-Gewinnung | Schaltet das Sinterwerk frei. Wolfram und Kobalt werden zu Hartmetall gesintert (6:2). |
| `c_cobalt_b` | Kobalt-Anreicherung II | B | 2 | – | Kobalt-Anreicherung I | +12 % Kobaltproduktion. |
| `c_moly_b` | Molybdän-Röstung II | B | 2 | – | Molybdän-Röstung I | +12 % Molybdänproduktion. |
| `c_carbide_a` | Sinteroptimierung I | A | 2 | – | Hartmetall-Sinterung | +12 % Hartmetallproduktion. |
| `c_tool` | Werkzeugtechnik | S | 2 | – | Hartmetall-Sinterung | Klickwert ×1,5. Schaltet den Hartmetall-Meißel frei. |
| `c_hss` | Hochleistungsstahl | S | 2 | – | Hartmetall-Sinterung | +50 % Stahlproduktion. |
| `c_proc_2` | Konzernprozess II | P | 2 | – | Konzernprozess I | +5 % aller Materialien. |
| `c_platin` | Platinmetall-Gewinnung | U | 3 | – | Hartmetall-Sinterung, Goldschmiedekunst | Schaltet die Platinmine frei. Nickel und Gold werden zu Platin raffiniert (10:1). |
| `c_carbide_b` | Sinteroptimierung II | B | 3 | – | Sinteroptimierung I | +12 % Hartmetallproduktion. |
| `c_platin_a` | Platin-Raffination I | A | 3 | – | Platinmetall-Gewinnung | +12 % Platinproduktion. |
| `c_network` | Edelmetall-Netzwerk | S | 3 | – | Platinmetall-Gewinnung | +50 % Goldproduktion, +25 % Wolframproduktion. |
| `c_proc_3` | Konzernprozess III | P | 3 | – | Konzernprozess II | +5 % aller Materialien. |
| `c_vanadium` | Vanadium-Extraktion | U | 4 | – | Molybdän-Aufbereitung, Hartmetall-Sinterung | Schaltet die Vanadiumhütte frei. |
| `c_platin_b` | Platin-Raffination II | B | 4 | – | Platin-Raffination I | +12 % Platinproduktion. |
| `c_vanadium_a` | Vanadium-Aufschluss I | A | 4 | – | Vanadium-Extraktion | +12 % Vanadiumproduktion. |
| `c_lab2` | Laborautomatisierung II | S | 4 | – | Vanadium-Extraktion, Laborautomatisierung | Forschungs- und Werkbank-Zeiten dauern weitere 15 % kürzer. |
| `c_proc_4` | Konzernprozess IV | P | 4 | – | Konzernprozess III | +5 % aller Materialien. |
| `c_iridium` | Iridium-Abscheidung | U | 5 | 6 | Platinmetall-Gewinnung | Schaltet das Iridiumlabor frei. Platin und Molybdän werden zu Iridium (10:4). |
| `c_vanadium_b` | Vanadium-Aufschluss II | B | 5 | – | Vanadium-Aufschluss I | +12 % Vanadiumproduktion. |
| `c_iridium_a` | Iridium-Reinigung I | A | 5 | 6 | Iridium-Abscheidung | +12 % Iridiumproduktion. |
| `c_quantum` | Quantenfertigung | S | 5 | – | Iridium-Abscheidung | +20 % Produktion aller Materialien. |
| `c_proc_5` | Konzernprozess V | P | 5 | – | Konzernprozess IV | +5 % aller Materialien. |
| `c_super` | Superlegierungs-Guss | U | 6 | 7 | Iridium-Abscheidung, Vanadium-Extraktion | Schaltet die Superlegierungs-Gießerei frei (Hartmetall, Iridium, Vanadium zu Superlegierung, 6:1:3). |
| `c_iridium_b` | Iridium-Reinigung II | B | 6 | 6 | Iridium-Reinigung I | +12 % Iridiumproduktion. |
| `c_super_a` | Superlegierungs-Veredelung I | A | 6 | 7 | Superlegierungs-Guss | +12 % Superlegierungsproduktion. |
| `c_orbital` | Orbitalfertigung | S | 6 | 6 | Superlegierungs-Guss | +30 % Erz- und Stahlproduktion, Autoklick-Ertrag ×2. |
| `c_proc_6` | Konzernprozess VI | P | 6 | – | Konzernprozess V | +5 % aller Materialien. |
| `c_super_b` | Superlegierungs-Veredelung II | B | 7 | 7 | Superlegierungs-Veredelung I | +12 % Superlegierungsproduktion. |
| `c_proc_7` | Konzernprozess VII | P | 7 | – | Konzernprozess VI | +5 % aller Materialien. |
| `c_charta` | Weltkonzern-Charta | S | 7 | 8 | Orbitalfertigung, Superlegierungs-Veredelung II, Konzernprozess VII | +50 % Produktion aller Materialien. Letzte Forschung des Spiels. |

Zählung: 7 U + 7 A + 7 B + 7 P + 8 S = 36. Gesamt 112 Forschungen.
Multiplikatoren-Budget bei ca. 560 h: Konzernprozess ×1,34 (bis VI), `c_patent` ×1,08, `c_quantum` ×1,2, `c_orbital` (Erz/Stahl) ×1,3 → ca. ×2,3 auf Erz, davor die `c_charta` ×1,5 als End-Belohnung.

### 5.4 Neue Boosts (Werkbank, einmalig, Reset beim Neuguss)
Kosten: Art "Boost" = Stahl (0,25 × Rate_ref(steel) × 1800 s) plus 1 bis 2 Materialien (f = 0,3); Dauer `1200 × 1,3^(k-1)` s (20 min bis 96 min), Obergrenze 5800 s.

| id | Name | K | Zeitalter | Freigabe | Wirkung |
|---|---|---|---|---|---|
| `cb_cobalt` | Kobalt-Katalysator | 1 | – | Kobaltbergbau | Kobaltproduktion ×2, Molybdänproduktion ×1,5. |
| `cb_sinter` | Sinterpresse | 2 | – | Hartmetall-Sinterung | Hartmetallproduktion ×2, Wolframproduktion ×1,5. |
| `cb_platin` | Platin-Elektrolyse | 3 | – | Platinmetall-Gewinnung | Platinproduktion ×2, Goldproduktion ×1,5. |
| `cb_vanadium` | Vanadium-Stahlbad | 4 | – | Vanadium-Extraktion | Vanadiumproduktion ×2, Stahlproduktion ×2. |
| `cb_iridium` | Iridium-Tiegel | 5 | 6 | Iridium-Abscheidung | Iridiumproduktion ×2, alle Materialien ×1,1. |
| `cb_vacuum` | Vakuumguss | 6 | 7 | Superlegierungs-Guss | Superlegierungsproduktion ×2, alle Materialien ×1,15. |
| `cb_line` | Konzern-Fließbandsystem | 6 | 6 | Orbitalfertigung | Erzproduktion ×2, Stahlproduktion ×2. |
| `cb_center` | Weltkonzern-Rechenzentrum | 7 | 8 | Weltkonzern-Charta | Alle Materialien ×1,25. |

Insgesamt 39 Boosts. Globale Boosts: ×1,1 · ×1,15 · ×1,25 = ×1,58 (im Budget).

### 5.5 Neue Klick-Upgrades (Werkbank, wiederholbar)
Format wie `CLICKS` (`costs`, `time`, `perLevel`, `base 0`); Zeit `base 600 s, growth 1,15, max 2400 s`; Kostenwachstum 1,6 bis 1,7 (Stahl) und 1,5 bis 1,55 (Material).

| id | Name | K | Zeitalter | Freigabe | Klickwert je Stufe | Kosten (Stufe 1) |
|---|---|---|---|---|---|---|
| `carbidechisel` | Hartmetall-Meißel | 2 | – | Werkzeugtechnik | +3e11 | Stahl 1e22 (×1,7), Hartmetall 0,3 × Rate_ref × 1800 (×1,5) |
| `iridiumram` | Iridium-Ramme | 5 | 6 | Iridium-Abscheidung | +5e14 | Stahl 3e24 (×1,7), Iridium wie oben (×1,55) |
| `superhammer` | Superlegierungs-Schlägel | 6 | 7 | Superlegierungs-Guss | +2e18 | Stahl 1e26 (×1,7), Superlegierung wie oben (×1,55) |

Insgesamt 9 Klick-Upgrades; Klickwert-Vergleich zu bisher: Plasmalanze +5e8 je Stufe, Hydraulikramme +2e5. Der Konzern-Shop-Eintrag `c_click` skaliert alle (+50 % je Stufe).

### 5.6 Erfolge (klein)
7 Erfolge "Produziere insgesamt X {Material}" (Schwellen 100 bis 1e6 je Material, additiver Bonus +0,01 bis 0,03 wie bestehende Materialerfolge), 3 für Konzerngründungen (1 / 5 / 15), 3 für Patente gesamt (50 / 100 / 200), 2 aus der Industrie (A5, B7). Gesamtbonus der neuen Erfolge höchstens +0,25, also weniger als die bestehende Erfolgsschicht.

## 6. Zeitplan und Kalibrierung

### 6.1 Ausgangsdaten (Sim, kalibrierter Aufruf `175/4/1/30/rate`, hier auf 200 h erweitert)
- Neugüsse: Nr. 1 bei 1,8 h, 40 bei 6,5 h, Nr. 280 bei 34,5 h (250.000 Gussformen), 1.698 in 200 h; Durchlauf ca. 7 min, ca. 800 Gussformen je Durchlauf bei 6,5 h, ca. 1.200 ab ca. 100 h.
- Gussformen kumuliert: 20.554 bei 5,8 h, 2,0 Mio. bei 200 h, das sind ca. 7.000 bis 10.000 je Stunde (stetig, nahezu linear).
- Zeitalter: 1 bei 7,5 h, 2 bei 37,9 h, 3 bei 96,5 h, 4 bei 127,6 h, 5 bei 192,1 h; kumuliertes Erz lokal ca. `T(t) = 3e23 × (t/192)^2,7`.
- Dauer des Sim-Laufs: 200 h bei dt 30 brauchen ca. 4 min Rechenzeit; ein 600-h-Lauf braucht mit 21 Generatoren hochgerechnet ca. 12 bis 15 min (siehe 7.4).

### 6.2 Modell Patente (Zeitplan der Konzernstufen)
Zentrale Ungleichung (lineare Formel, 3.2): `Patente_gesamt(t) <= G(t) / D_CORP`, wobei G(t) die kumulierten Gussformen sind. Mit der Näherung `G(34 h) = 2,5e5` und `r(t) ≈ 10.500/h` (Start) steigend auf ca. 13.700/h durch `c_cast`/`c_gain`/Zeitalter und `D = 34.000` ergibt sich bei einer Gründung alle 40 h (Standardrhythmus des Bots):

| Gründung Nr. | Zeit (h) | Patente gesamt (nach Gründung) | Konzernstufe erreicht |
|---|---|---|---|
| 1 | 34 | 7 | K1 (5) |
| 2 | 74 | 20 | K2 (20) |
| 3 | 114 | 34 | |
| 4 | 154 | 48 | K3 (45) |
| 5 | 194 | 63 | |
| 6 | 234 | 79 | K4 (75) |
| 7 | 274 | 95 | |
| 8 | 314 | 111 | K5 (110) |
| 9 | 354 | 127 | |
| 10 | 394 | 143 | |
| 11 | 434 | 159 | K6 (150) |
| 12 | 474 | 175 | |
| 13 | 514 | 191 | |
| 14 | 554 | 207 | K7 (205), Konzern-Shop komplett (205) |

Näherung je Gründung: Patente = (verdiente Gussformen im Lauf, ca. 40 h minus ca. 3 h Wiederaufbau) / 34.000. Wiederaufbau ca. 3 h begründet aus der Sim: ohne Hochofen-Boni braucht der Bot 4,3 h bis 10.000 Gussformen; mit Zeitalter-Bonus ×7 und Patente-Bonus verkürzt sich das auf ca. 1 bis 3 h.

**Grenzen für A1:** Schnellste mögliche Spielweise (sofort gründen, keine Wiederaufbauzeit, Boni voll) ist durch `G(t)/D` begrenzt und erreicht 205 Patente bei ca. 520 h (`G` aus der obigen Näherung, `D = 34.000`); der Standardrhythmus (alle 40 h, Rundungsverlust bis 1 Patent je Gründung) bei ca. 554 h. Beide liegen im Korridor 504 bis 700 h. Das Ergebnis hängt durch die lineare Formel kaum vom Rhythmus ab (schlechtester Fall: alle 150 h, ca. 600 h).

### 6.3 Modell kumuliertes Erz (Zeitalter 6 bis 8, Industrie-Meilensteine A)
`T(t) = 3e23 × (t/192)^2,7 × B(t)` für `t >= 192 h`, mit dem Zusatzfaktor B(t) durch Konzern- und Industrie-Inhalte (B(192) = 1). Budget B(560 h) ca. 120:

| Faktor bei 560 h | Wert |
|---|---|
| Patente `1 + 0,02 × 170` (ohne `c_eff`) | 4,4 |
| Konzern-Meilensteine bis K6 | 2,30 |
| Neue Forschung/Boosts (Prozess, Patentwesen, Quantenfertigung, Orbital, Boosts) | ca. 2,0 |
| Zeitalter 6 und 7 | 2,25 |
| Industrie-Meilensteine | ca. 3,2 |

Produkt ca. 145 (Ziel 120; die Differenz fängt die höhere Wiederaufbauzeit durch Konzerngründungen auf). Stützstellen von B(t): 192 h: 1; 250 h: 2,5; 350 h: 12; 450 h: 40; 560 h: 120; 650 h: 250. Daraus:

| t (h) | T(t) kumuliertes Erz | Ableitung |
|---|---|---|
| 250 | 1,5e24 | A5 (1e24) bei ca. 240 h |
| 300 | 5,5e24 | **Zeitalter 6 (5e24)** |
| 350 | 1,8e25 | A6 (1e25) bei ca. 320 h |
| 430 | 8e25 | **Zeitalter 7 (8e25)** |
| 450 | 1,2e26 | A7 (1e26) bei ca. 440 h |
| 540 | 4,4e26 | **Zeitalter 8 (4e26)** |
| 560 | 6,5e26 | |
| 650 | 2e27 | A8 (1e27) bei ca. 590 bis 610 h |

### 6.4 ZEITPLAN-TABELLE (aktive Bot-Stunden, kalibrierter Bot `rate`)
Die Spalte "Quelle" verweist auf die Gating-Art: SIM = gemessener Sim-Wert (GAME-DESIGN.md 3b), MOD = Modell aus 6.2/6.3.

| Zeit (h) | Ereignis | Gate | Quelle |
|---|---|---|---|
| 1,8 | 1. Neuguss, Hochofen-Meilensteine 5 und 25 | Erz 1e7 | SIM |
| 2,4 / 4,3 | 1.000 / 10.000 Gussformen (Meilensteine ×3, ×5) | Neuguss 5 / 21 | SIM |
| 2,5 bis 5 | Industrie A1, A2 (Erz 1e12, 1e15); B1 bis B3 (Materialvielfalt 6, 9, 12) | stats.total | MOD |
| 7,5 | Zeitalter 1 | Erz 1e17 | SIM |
| 13,5 | **Konzern-Reiter freigeschaltet** (Neuguss 100) | N = 100 | SIM |
| 20 | A3 (1e18) | | MOD |
| 34,5 | Hochofen-Meilenstein 250.000 (Neuguss 280) | Gussformen | SIM |
| **34** | **1. Konzerngründung (7 Patente), K1** | `Gc >= 34.000`, Bot-Rhythmus | MOD |
| 40 / 43 | Kobalt, Molybdän (Konzernforschung I), B4 | K1 | MOD |
| 37,9 | Zeitalter 2 | Erz 1e20 | SIM |
| 70 | A4 (1e21) | | MOD |
| 74 | Gründung 2, K2 (20 Patente) | | MOD |
| 80 | Hartmetall, Hartmetall-Meißel, Werkzeugtechnik, `cb_sinter` | K2 | MOD |
| 96,5 | Zeitalter 3 | Erz 1e22 | SIM |
| 127,6 | Zeitalter 4 | Erz 1e23 | SIM |
| 154 | Gründung 4, K3 (45) | | MOD |
| 160 | Platin, Edelmetall-Netzwerk, B5 (16 Materialien) | K3 | MOD |
| 192 | Zeitalter 5 | Erz 3e23 | SIM |
| 234 | K4 (75) | | MOD |
| 240 | Vanadium, Laborautomatisierung II; A5 (1e24) | K4 | MOD |
| 300 | **Zeitalter 6** (5e24) | Erz | MOD |
| 314 | K5 (110) | | MOD |
| 320 | Iridium (braucht Zeitalter 6), Quantenfertigung, B6 (18), A6 (1e25) | K5 + Z6 | MOD |
| 430 | **Zeitalter 7** (8e25) | Erz | MOD |
| 434 | K6 (150) | | MOD |
| 440 | Superlegierung (braucht Zeitalter 7), Orbitalfertigung, `cb_line`, B7 (19), A7 (1e26) | K6 + Z7 | MOD |
| 540 | **Zeitalter 8** (4e26) | Erz | MOD |
| 554 | K7 (205 Patente), Konzern-Shop komplett | Patente | MOD |
| 557 | Weltkonzern-Charta (Dauer 2,1 h effektiv) | K7 + Z8 | MOD |
| 590 bis 610 | **Industrie A8 (1e27)** = letzter Inhalt | Erz | MOD |

**Gesamt: alle Inhalte (112 Forschungen, 39 Boosts, 9 Klick-Upgrades, 19 Materialien, beide Reset-Ebenen, alle Meilensteine) frühestens ca. 520 h (schnellste Spielweise), Bot-Standard ca. 600 h, Obergrenze Korridor 700 h.** Ausbau VI bis VIII und weitere Klick-/Shop-Stufen nach Maximum sind offen und zählen nicht zu "alles" (Entscheidung D2).

Rechnerische Prüfung der Mindestdauer: Die Kette ist auf drei unabhängigen Toren aufgebaut, von denen jedes allein >= 504 h verlangt: (1) Patente 205 braucht `G >= 205 × 34.000 = 7,0e6` Gussformen, bei <= 13.700/h also > 504 h; (2) Zeitalter 8 (4e26) wird bei ca. 540 h erreicht; (3) A8 bei ca. 600 h. Wenn die Kalibrierung eines der Tore zu früh liefert, halten die anderen beiden die Untergrenze.

### 6.5 Stellschrauben für Schritt 6 (Kalibrierung)

| Stellschraube | Startwert | Bewegt | Hinweis |
|---|---|---|---|
| `D_CORP` | 34.000 | Patente-Rate, damit K1 bis K7 und Konzern-Shop-Ende (1 : 1 proportional zur Zeit) | Erste Stellgröße. Zeit bis 205 Patente ≈ proportional zu D |
| `corp.gainMult` je `c_gain`/`c_cast` | 10 % / 15 % | Beschleunigung ab ca. 80 h | |
| Konzern-Meilenstein-Schwellen | 5 / 20 / 45 / 75 / 110 / 150 / 205 | Zeitpunkt der Materialien | Aus der 6.2-Tabelle (Gründung-Rhythmus) ableiten |
| Zeitalter-Schwellen 6 bis 8 | 5e24 / 8e25 / 4e26 | Zeitpunkte Zeitalter 6 bis 8 | Per `simulate({stopAtEra})`: Schwelle = gemessenes `T(t_Ziel)` |
| Industrie A-Schwellen | 1e12 bis 1e27 | Pling-Abstände | Folgen den Zeitalter-Schwellen |
| Forschungs-Kostenfaktoren f (5.2), Dauer 1800 s und 1,4^(k-1) | siehe 5.2 | Zeit bis Material bezahlbar; Warteschlangen | Aus `runRates` skripten |
| Generator-Basen/Wachstum der 7 neuen Materialien (4.2) | siehe 4.2 | Produktionsrate Material | Ziel: Material k ist ca. 10 bis 30 min nach Forschungsende bezahlbar |
| Bonus-Größen (K-Bonus, Patent-Bonus 0,02, Prozess +5 %, Industrie) | siehe oben | Gesamtwachstum B(t) | Budget aus 6.3 prüfen |
| Wiederaufbau-Zeit nach Gründung (aus `c_heir` etc.) | ca. 3 h | Obergrenze | |
| N | 100 | Sichtbarkeit | nur Dramaturgie, nicht Zeitplan |

Kalibrierreihenfolge: (1) Sim erweitern (7.4) mit Policy `corp40` (alle 40 h) und `corpFast` (Gründung, sobald `corpGain >= 3`). (2) `D_CORP` so setzen, dass `corpFast` K7 und Shop-Ende erst nach >= 520 h erreicht und `corp40` nach <= 640 h. (3) Zeitalter-Schwellen und A-Leiste aus `T(t)` des Sim übernehmen. (4) Forschungskosten aus `runRates` per Skript erzeugen. (5) `tests/balance.test.mjs` auf die neuen Zeiten anpassen.

## 7. Technische Hinweise für die Umsetzung

### 7.1 Neue Dateien
| Datei | Inhalt |
|---|---|
| `js/data/corp.js` | `CORP` (Name, Währung "Patente", `divisor`, `unlockCount` = 100, Symbol), `CORP_SHOP`, `CORP_MILESTONES`, `HEIR_FLOOR` |
| `js/data/industry.js` | Leisten `INDUSTRY_TRACKS` (id, Name, `value(state)`, `steps[{ at, mult, desc }]`) |
| `js/systems/corp.js` | `canCorp()`, `doCorp()`, `buyCorpShop(id)`; ruft dieselben Reset-Teile wie `doPrestige` (gemeinsame Funktion `resetRun({ keepResearch, resetShop })` aus `systems/prestige.js` extrahieren) |
| `js/systems/industry.js` | Prüfung der Leisten (ca. 2×/s), Event `industry`, Toast (Muster `systems/eras.js`) |
| `js/core/goals.js` | `nextGoals()` (M1) |
| `tests/corp.test.mjs`, `tests/industry.test.mjs` | siehe 7.5 |

### 7.2 Betroffene bestehende Dateien
`js/core/state.js` (Felder), `js/core/save.js` (Version 6, Sanitizing, `migrateV5toV6`), `js/core/formulas.js` (`corpUnlocked`, `corpGain`, `corpStage`, `corpMult`, `corpLevel`, `industryMult`, `heirFloor`, Erweiterung von `globalMult`, `prestigeMult`, `prestigeGain` (`c_cast`), `offlineCapSeconds` (`c_offline`), `clickBaseAt` (`c_click`), `timeMult` (`c_lab2`), `autobuyerUnlocked` (`c_auto`), `lockReason` (`corp`), `keepsResearch()`), `js/systems/prestige.js` (`shopLevel('keep')` an zwei Stellen durch `keepsResearch()` ersetzen, Konzernforschung nie löschen, Hochofen-Meilenstein-Toast), `js/systems/timers.js` (`resetForPrestige`), `js/data/eras.js`, `generators.js`, `recipes.js`, `resources.js`, `research.js`, `upgrades.js`, `achievements.js`, `js/i18n/en-data.js` und `en-ui.js` (neue Texte), `js/main.js` (Tick Konzern/Industrie/Auto-Neuguss), `tools/balance-sim.mjs`, `tests/*`, `docs/GAME-DESIGN.md` (Schritt 8).

### 7.3 Spielstand (SAVE_VERSION 6)
```js
state.corp = { points: 0, total: 0, count: 0, shop: {}, history: [] }   // history: letzte 10 Gründungen { gain, gussformen, time, at }
state.autoCast = { on: false, mode: 'gain', value: 0 }                // M3
```
- Kein neues Feld für Zeitalter oder Industrie (abgeleitet). `stats` bekommt `corpRunTime: 0` (Sekunden seit der letzten Gründung, nur Anzeige und Auswertung).
- Sanitizing (`save.js`): `corp.points/total` über `num`, `corp.count` über `int(.., 1e9)`, `corp.shop` nur bekannte IDs mit `min(stufe, max)` (wie `SHOP`), `corp.history` höchstens 10 gültige Einträge, `autoCast.mode ∈ {'gain','time'}`, `value` über `num(.., 0, 0, 1e12)`. Forschungsaufträge in den Queues: unbekannte oder bereits abgeschlossene Forschung wird wie bisher verworfen (neue IDs sind Teil von `RESEARCH`, das sanitizing läuft automatisch über die Datenlisten).
- Neue Ressourcen und Generatoren werden von `sanitize` automatisch über `RES_IDS`/`GENS` behandelt; fehlende Felder in alten v5-Spielständen werden zu 0. `evo` wird bei `EVO_MAX = 8` weiterhin über `int(.., EVO_MAX)` begrenzt.
- A4 bleibt: keine inhaltliche Migration; `migrateV5toV6` ergänzt nur `corp` (leer) und `autoCast`. `SAVE_VERSION = 6`, `SAVE_KEY` unverändert.

### 7.4 Simulation (Schritt 6)
- `tools/balance-sim.mjs` erweitern: Konzern-Policy (`corp40`, `corpFast`, Option `corpEvery` in Stunden), Konzern-Shop-Kaufliste (3.5), Industrie-Leisten in den Rückgabewerten, neue `W`-Werte: Kobalt 2e6, Molybdän 3e6, Hartmetall 2e7, Platin 3e8, Vanadium 5e7, Iridium 5e9, Superlegierung 1e11 (grob je Stufe ×10 bis ×100 über Gold 2e5); Seltene-Material-Regel in `buyGens` um die sieben neuen Generatoren erweitern (Anteil an der Mixer-Stufe: 0,5 bis 0,2).
- Laufzeit: 600 h bei dt 30 brauchen ca. 12 bis 15 min. Für Tests ein schneller Pfad: Nur die Schritte bis zur 1. Gründung simulieren (ca. 40 h) und den Rest über das Patente-Modell prüfen (Ungleichung aus 6.2), die vollen Läufe gehören in ein separates Skript (`npm run balance:full`) mit Timeout >= 1.800 s. A5 gilt weiter: bestehende `balance.test.mjs` braucht ca. 265 s (Timeout >= 300 s), ein zusätzlicher Konzern-Lauf bis 80 h ca. 2 min mehr.
- Hinweis aus GAME-DESIGN.md 3b: Die Ergebnisse hängen stark von `dt` ab (dt 60 statt 30 verschiebt Zeitalter 1 von 7,5 h auf 31 h). Die Kalibrierung bleibt bei dt 30.

### 7.5 Tests
1. **Erreichbarkeits-Test** (`tests/progression-graph.test.mjs` erweitern): Fixpunkt über Ressourcen, Forschungen, Boosts, Klick-Upgrades, Generatoren, Rezepte mit "unendlich" großen Beständen, Zeitalter 8 und Konzernstufe 7: Jede der 19 Ressourcen ist produzierbar, jede der 112 Forschungen/39 Boosts/9 Klick-Upgrades kaufbar, keine Zyklen in `req`, `corp` und `era` jeder Forschung <= Stufe der Voraussetzungen (eine Forschung darf nicht früher freigeschaltet sein als ihre Voraussetzung), jedes `corp` ∈ 1..7, jeder Konzern-Meilenstein erreichbar, Konzern-Shop-Summe = Schwelle K7.
2. `tests/corp.test.mjs`: `corpGain`-Formel (Grenzen 0/1, `c_gain`), Freischaltung bei `prestige.count = 100`, Reset-Umfang (Tabelle 3.3: `prestige.shop`/`points`/`total` weg, `count`, `corp`, Zeitalter, Erfolge, Konzernforschung bleiben), `c_heir`-Boden, `c_archive`, `c_auto`, `c_offline`, `c_autocast`, `corpMult` im `globalMult`, Patente-Ungleichung.
3. `tests/industry.test.mjs`: beide Leisten ableitbar und monoton, `industryMult` im Stapel, EVO 6 bis 8, Zeitalter 6 bis 8.
4. Save: Roundtrip v6, v5 laden (neue Felder leer), unbekannte `corp.shop`-IDs, `NaN`/negative Patente, zu große `evo`, korrupte `autoCast`.
5. `tests/balance.test.mjs`: bestehende Tests bleiben (A5), neue Schranken: Konzern-Reiter ab 13,5 h ± 3 h im Sim, erste Gründung <= 40 h, `corpFast` erreicht K7 nicht vor 520 h (siehe 7.4).
6. E2E (Schritt 9): Konzern-Reiter, Dialog, Shop-Kauf, Industrie-Panel, Zielleiste, neue Materialien in der Seitenleiste.

### 7.6 Hinweise für die UI (Schritt 2)
- Neuer Reiter "Konzern" (Patente, Gewinn jetzt, Konzernstufe mit Fortschrittsbalken, Konzern-Shop, Liste "geht/bleibt", Bestätigungsdialog) sowie Industrie-Reiter mit den zwei Leisten (Stufen als Pips, Toast), Zielleiste im Werk, sieben neue Materialien/Generatoren (Sprites `items.svg`, `gens.svg`), Zeitalter-Symbole für Zeitalter 6 bis 8, 8 Ausbau-Pips statt 5.
- API für die UI (reine Lesefunktionen in `core/formulas.js`): `corpUnlocked()`, `corpGain()`, `corpStage()` (0 bis 7), `corpMult()`, `corpLevel(id)`, `corpCost(id)`, `industryProgress()` → `[{ id, value, next, progress, reached, mult }]`, `heirFloor()`; Events `corp` (`{ gain }`), `corpshop` (`{ id }`), `industry` (`{ track, step }`); Systeme `doCorp()`, `buyCorpShop(id)`.

## 8. Offene Punkte dieses Designs
- Alle Zeiten und Größenordnungen der Kosten sind Modellwerte; erst Schritt 6 bestätigt sie. Größtes Risiko: die Erz-Kurve `T(t)` in 6.3 (Unsicherheit ca. ±30 % in der Zeit, ±1 Größenordnung in den Schwellen).
- Der Wiederaufbau nach der Konzerngründung (3 h) ist geschätzt; er bestimmt, wie oft ein Spieler sinnvollerweise gründet, hat aber wegen der linearen Formel nur geringen Einfluss auf die Mindestdauer.
- Kein echter Spieler gemessen (wie in GAME-DESIGN.md 8): Reale Spieler sind schneller (Offline-Ertrag, bessere Entscheidungen); A1 misst bewusst nur den Bot.
- Ausbau VI bis VIII ist nur auf billigen Generatoren erreichbar. Falls das als Lücke wirkt, könnten Schritt 6 oder 7 die Stufen-Schwellen je Generator staffeln (z. B. `EVO_AT` abhängig vom Wachstum des Generators).
