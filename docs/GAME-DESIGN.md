# Eisenwerk Idle – Spieldesign

Dieses Dokument beschreibt Inhalte, Zahlen und die Begründung der Balance. Es besteht aus zwei Teilen:

- **Teil A – Grundspiel**: Ressourcenkette, Timer, Generator-Evolution, Zeitalter 0 bis 5, Hochofen-Neuguss, Inhaltstabellen.
- **Teil B – Konzerngründung und Industrie-Ausbau**: zweite Reset-Ebene, Zeitalter 6 bis 8, neue Materialien und Forschungen, Zeitplan bis zum vollständigen Freischalten.

Die Tabellen in A6 zeigen das Grundspiel ohne die Erweiterungen aus Teil B. Zeiten sind als **gemessen** (Balance-Bot) oder als **Modell** gekennzeichnet; Modellwerte sind nicht nachgemessen. Maßgeblich bleibt der Code (`js/data/*.js`).

# Teil A – Grundspiel
## A1. Ressourcenkette

```
Erz ──► Stahl ──► Titan                         (Grundspiel)
Kohle ──(Verkokung 5:1)──► Koks
Erz + Koks ──(Hochofen 12:1 → 4 Stahl)──► Stahl-Bonus
Kupfer + Mangan ──(3:1 → 1)──► Legierung
Legierung + Chrom + Nickel ──(8:2:2 → 1)──► Wolfram
Wolfram ──(20:1)──► Gold
```

- 9 neue Materialien: Kohle, Koks, Kupfer, Mangan, Chrom, Nickel, Legierung, Wolfram, Gold. Jedes hat einen eigenen Generator und taucht in der UI erst auf, wenn seine Forschung abgeschlossen ist oder bereits ein Vorrat existiert (`resVisible`).
- Rezepte laufen automatisch und nehmen nur einen Anteil (`share`) der laufenden Produktion. Sie werden in Listenreihenfolge ausgewertet, spätere Rezepte sehen die Ausgänge früherer (Kohle → Koks → Stahl, Legierung → Wolfram → Gold). Dadurch kann ein Rezept nie mehr verbrauchen, als produziert wird (keine negativen Raten, durch Tests belegt).
- Rezept-Ausgaben sind „boosted“ (Flag `boosted` je Rezept, Standard true): Sie erhalten die Forschungs-/Boost-Multiplikatoren ihrer Ausgaberessource (`researchMult`, z. B. Metallurgie ×1,5, Hochofen-Turbo ×2 auf Stahl). Prestige, Erfolge und Buffs wirken bereits über die Eingänge und werden nicht doppelt angewandt. Balance geprüft: Der Konverter liefert nur ca. 0,8 % des Erzes als Stahl, der Hochofen ca. 10 %; mit dem Stahl-Stapel bleibt das ein Zusatzstrom neben den Stahl-Generatoren, keine Anpassung der Rezeptzahlen nötig.
- Zweck der Materialien: Sie sind Kosten für Generatoren, Boosts, Klick-Upgrades und Forschung der nächsten Stufe (jeder Schritt braucht das Material der vorherigen) und liefern über Boosts/Forschung Multiplikatoren auf Erz, Stahl, Titan oder alles. Rezepte bringen zusätzlichen Durchsatz, ohne dass der Spieler etwas tun muss.
- Der Neuguss-Gewinn hängt weiter nur am Erz des Durchlaufs (Formel siehe Abschnitt A4, Hochofen-Skalierung), die Kette beschleunigt ihn über die Multiplikatoren.

## A2. Timer und Warteschlangen

Kauf von Forschung, Boosts und Klick-Upgrades: Kosten sofort abziehen, Auftrag einreihen, Countdown, erst danach wirkt der Effekt (Event `timer:done`). Generatoren sind weiter sofort.

| Warteschlange | Inhalt | Aktive Slots | Wartende Plätze | Erweiterung |
|---|---|---|---|---|
| `lab` (Labor) | Forschung | 1 | 3 | Shop „Zusatz-Laborplatz“ (bis +3) |
| `workshop` (Werkbank) | Boosts, Klick-Upgrades | 1 | 3 | Shop „Zusatz-Werkbank“ (bis +3) |

- Reihenfolge: Die ersten `slots` Einträge laufen gleichzeitig, wartende Einträge verbrauchen keine Zeit. Wird ein Slot frei, startet der nächste Auftrag mit seiner vollen Dauer.
- Ein Eintrag kann nur einmal in der Schlange stehen (kein Doppelkauf, auch nicht bei Klick-Upgrades). Voraussetzungen (Forschung) müssen abgeschlossen sein, nicht nur eingereiht.
- Dauer: fester Wert `time` je Forschung/Boost, bei Klick-Upgrades `min(max, base × growth^Stufe)`. Die Dauer wird beim Einreihen festgelegt.
- Zeitverkürzung (multiplikativ, Minimum 1 s): Shop „Zeitraffer“ ×0,92 je Stufe (bis 6 Stufen, ×0,61), Forschung „Laborautomatisierung“ ×0,75.
- Abbrechen: wartend 100 % Erstattung der Kosten, laufend 50 % (unabhängig vom Fortschritt).
- Offline und Hintergrund: `applyOffline` rechnet abschnittsweise. Nach jedem Abschluss werden die Raten neu berechnet, mehrere Aufträge laufen nacheinander ab, Timer laufen auch über das Offline-Maximum hinaus weiter. Der Laufzeitpfad (Tab im Hintergrund) nutzt dieselbe Logik. Offline-Ertrag = 60 % der Aktiv-Rate (`OFFLINE_EFFICIENCY`), die Zeit (Timer, Statistik, Patente-Deckel) zählt voll.
- Neuguss: Werkbank wird immer geleert (Boosts und Klick-Upgrades werden ohnehin zurückgesetzt), das Labor nur ohne „Wissensarchiv“. Mit Wissensarchiv laufen Forschungsaufträge weiter. Es gibt keine Erstattung, weil alle Ressourcen beim Neuguss zurückgesetzt werden; der Bestätigungsdialog weist darauf hin.
- Speicherstand: Feld `timers { lab: [], workshop: [] }`, Einträge `{ kind, id, total, left, cost, silent }`. Beim Laden wird alles gegen die Daten geprüft (unbekannte IDs, falsche Queue, Bereits-Erforschtes, Duplikate, NaN, Länge).

### Dauern im Überblick
- Früh (Minute 0 bis 10): Forschung 5 bis 40 s, Boosts 15 bis 45 s, Klick-Upgrades 5 bis 10 s Startdauer.
- Mitte: Forschung 1 bis 6 min, Boosts 1 bis 5 min.
- Spät: Forschung 8 bis 30 min (Wolfram 15 min, Supraleiter 20 min, Goldschmiedekunst 30 min), Boosts bis 15 min.
- Die langen Aufträge sind bewusst zum „Einreihen und weggehen“ gedacht: Offline-Fortschritt arbeitet sie ab.

## A3. Generator-Evolution (Werkshalle)

Reine Funktionen in `js/data/generators.js` (auch über `core/formulas.js` erreichbar):

| Rang | Name | ab Stufe |
|---|---|---|
| 0 | Holz | 1 (Stufe 0 zählt ebenfalls als Rang 0) |
| 1 | Eisen | 10 |
| 2 | Stahl | 25 |
| 3 | Titan | 50 |
| 4 | Gold | 100 |

- `genTier(level)` → 0..4, `tierName(tier)` → Name, `tierPips(level)` → `{ tier, next, progress, pips, total }` (5 Pips je Etappe; im höchsten Rang `next: null`, `progress: 1`, `pips: 5`).
- Event `gen:evolve` `{ id, tier }` genau einmal pro Kauf, wenn dabei ein höherer Rang erreicht wird (auch bei Sammelkäufen).

## A3a. Zeitalter und Generator-Ausbau (Industrie-Tab)

Dieser Abschnitt beschreibt Zeitalter 0 bis 5 und Ausbaustufen 1 bis 5. Mit der Konzerngründung kommen Zeitalter 6 bis 8 (Schwellen 8e26 / 8e27 / 8e28) und Ausbaustufen 6 bis 8 hinzu, siehe Abschnitt A3c und Teil B, Abschnitt B2.

### Zeitalter (Industrialisierung)
Ein Zeitalter ist erreicht, wenn das kumulierte Erz `state.stats.total.ore >= at` ist (nicht gespeichert, abgeleitet; keine Mindest-Spielzeit mehr). Zeitalter und Industrie-Tab sind erst ab dem 1. Neuguss wirksam: `eraIndex()` liefert 0, solange `state.prestige.count < 1` (`industryUnlocked()`), egal wie viel Erz vorhanden ist. Industrie-Tab-Button und Zeitalter-Anzeige in der Seitenleiste sind bis dahin versteckt; liegt der aktive Tab dort (Reset/Import), wird auf Generatoren zurückgefallen (Start-Tab ist Werk). Gesperrte Forschung/Ausbauten nennen vor dem 1. Neuguss den Grund „Benötigt den ersten Neuguss“. Jedes Zeitalter unlocks neue Forschungen (mit optionalem Feld `era: n`) und Ausbaustufen für Generatoren. Der globale Multiplikator ist kumulativ: Mit Zeitalter 3 erhalten alle Ausgaben `×(1.0 × 1.2 × 1.3)`.

| Zeitalter | Schwelle (Erz) | Bonus | Inhalte |
|---|---|---|---|
| 0: Handwerk | 0 | ×1.0 | Status quo |
| 1: Mechanisierung | 1e17 | ×1.2 | Ausbau I, Forschung Wasserenergie |
| 2: Dampfzeitalter | 1e20 | ×1.3 | Ausbau II, Dampfmaschine, Bessemer |
| 3: Elektrifizierung | 1e22 | ×1.5 | Ausbau III, Dynamo, Elektrostahl |
| 4: Automatisierung | 1e23 | ×1.5 | Ausbau IV, Fließband, Robotik, Auto-Ausbau im Generator-Auto-Buyer |
| 5: Digitalisierung | 3e23 | ×2.0 | Ausbau V, Mikrochips, Nanotech |

- Erz-Schwellen sind streng steigend (Zeitalter 0: 0). Test `eras.test.mjs` prüft dies, die Neuguss-Bedingung und dass `eraMult()` kumulativ wirkt; `industry-tab.test.mjs` die Tab-Sichtbarkeit.
- Fortschritt: `eraProgress()` = logarithmischer Erz-Fortschritt zur nächsten Schwelle (Seitenleiste: "Nächstes: X – ab Y Erz").
- Event `era` bei Aufstieg (nicht beim Laden), Toast in Gold, je Zeitalter einzeln (auch bei Sprüngen über mehrere).
- Kalibrierung und Simulationswerte: siehe Abschnitt A3b.

### Generator-Ausbau (5 Stufen)
Jeder Generator hat optional Stufen 1–5. Stufe k braucht (a) Zeitalter >= k, (b) Generatorstufe >= `EVO_AT[k-1]`:

| Stufe | freigeschaltet ab | Stufe des Generators | Multiplikator | Kosten-Faktor |
|---|---|---|---|---|
| 1 | Zeitalter 1 | Stufe 10 | ×1.5 | ×25 |
| 2 | Zeitalter 2 | Stufe 25 | ×1.5 | ×60 |
| 3 | Zeitalter 3 | Stufe 50 | ×2.0 | ×150 |
| 4 | Zeitalter 4 | Stufe 100 | ×2.0 | ×400 |
| 5 | Zeitalter 5 | Stufe 200 | ×3.0 | ×1000 |

- Kumulativer Multiplikator: alle Stufen kaufen → ×27 (1.5 × 1.5 × 2 × 2 × 3).
- Kauf: sofort (kein Timer), Kosten = `unitCost('gen', id, EVO_AT[k-1]) × EVO_COST[k-1]`, abgerundet.
- Wirkung: wirkt auf `genOutputAt()` (also auch auf Rezepte, die diesen Generator nutzen).
- Speicherung: `state.evo[id]` (0..5), wird beim Neuguss zurückgesetzt.
- Auto-Buyer: Der Generator-Auto-Buyer (Prestige-Shop „Automatisierung", `ab_gens`) kauft Ausbauten nach den Generatoren, wenn Kosten bezahlbar und Reserve-Regel einhält. Gleiches Prestige-Level unlock wie Generatoren selbst.
- Rendering (Industrie-Tab): Tabelle je Generator (Name, 5 Ausbau-Pips, nächster Multiplikator, Kosten, Grund bei Sperre/Fehler). Knopf „Alles ausbauen" kauft alle möglichen Stufen in einem Durchgang.
- Tests: `tests/evolution.test.mjs` (Ableitung aus Zeitalter/Generatorstufe, Kosten, Neuguss-Reset), `tests/systems.test.mjs` (Auto-Buyer mit Ausbauten), `tests/balance.test.mjs` neuer Abschnitt (Zeitalter-Progression im ersten 12h, Reihenfolge streng, Zeitalter 5 nicht erreicht).

## A3b. Progression (Stand)

- Der Industrie-Tab und die Zeitalter-Anzeige gibt es erst ab dem 1. Neuguss.
- Zeitalter hängen nur an kumulierten Erz-Schwellen: 1e17, 1e20, 1e22, 1e23, 3e23 (Zeitalter 1 bis 5). Es gibt kein `minTime` mehr.
- Alle Zeiten stammen von einem Balance-Bot (`tools/balance-sim.mjs`), nicht von echten Spielern. Der kalibrierte Lauf (175 h, 4 Klicks/s, Neuguss so früh wie sinnvoll, Simulationsschritt 30 s) erreicht den 1. Neuguss bei 1,8 h, Zeitalter 1 bei 7,5 h, Zeitalter 2 bei 37,9 h, Zeitalter 3 bei 96,5 h, Zeitalter 4 bei 127,6 h und Zeitalter 5 bei etwa 192 h. Die Hochofen-Meilensteine 5 und 25 fallen bei 1,8 h, 150 bei 2,0 h, 1.000 bei 2,4 h, 10.000 bei 4,3 h und 250.000 bei 34,5 h.
- Ein schnellerer Bot (häufigerer Neuguss, feinerer Simulationsschritt) erreicht Zeitalter 5 schon nach etwa 15 h. Realistische Spielerzeiten liegen irgendwo dazwischen; Offline-Fortschritt verkürzt die Dauer zusätzlich.
- Der Test `tests/balance.test.mjs` prüft mit der kalibrierten Konfiguration die Reihenfolge der Zeitalter, Obergrenzen je Zeitalter und mindestens 3 h Abstand zwischen den Schritten.
- Kostenkalibrierung der Zeitalter-Forschung, Zeitalter-Boosts und Era-Klick-Upgrades: Die größte Kostenposition einer Zeitalter-Forschung liegt bei 0,2 bis 1,0 x Erz-Schwelle ihres Zeitalters (geometrisch gestaffelt entlang der Ketten). Jede Ressource kostet proportional zu ihrer Produktionsrate im Sim (Median der Spitzenraten kurz vor jedem Neuguss im jeweiligen Zeitalter, `simulate().runRates`), Erz mit Faktor 1, Stahl 0,7, alle anderen 0,4. Dadurch begrenzt immer die langsamste Ressource und nie eine Nebenressource mit unrealistischem Mengenverhältnis. Zeit bis bezahlbar bei Spitzenrate (ab Durchlaufstart, ohne Bestand): Zeitalter 1 bis 2: unter 1 Minute bis wenige Minuten, Zeitalter 3: 3 bis 20 Minuten, Zeitalter 4 und 5: 0,4 bis 3 Stunden. Die Zeitalter-Schwellen sind kumulativ über viele Durchläufe, die Kosten dagegen müssen innerhalb eines Durchlaufs bezahlbar sein (Forschung geht beim Neuguss verloren, außer mit Wissensarchiv); deshalb sind die Kosten in frühen Zeitalter kurz gemessen an der Schwelle.
- 76 Forschungen, verteilt nach Zeitalter (Feld `era`; ohne Feld = 0): Zeitalter 0: 30, 1: 8, 2: 9, 3: 10, 4: 10, 5: 9.
- 15 neue Zeitalter-Boosts (`prospect` bis `fusioncat`) und 2 neue Klick-Upgrades (`hydraulic`, `plasmalance`).
- Neue `mult`-Schlüssel in Boosts: `click` (Klickwert) und `autoclick` (Autoklick-Anteil), neben Ressourcen-ID und `all`.
- Synergie (ab Zeitalter 1): +0,3 % je erledigter Forschung und +0,5 % je gekauftem Boost, flach addiert (`SYNERGY` in `core/formulas.js`).

## A3c. Zweite Reset-Ebene und Ausbau auf 3 Wochen (Kurzfassung)

Auf den Hochofen-Neuguss setzt eine zweite Reset-Ebene auf, die **Konzerngründung** mit der Währung **Patente**. Sie ist ab 100 Neugüssen nutzbar (ab Neuguss 25 sichtbar, gesperrt) und setzt den Neuguss-Fortschritt zurück (Gussformen, Hochofen-Shop, normale Forschung). Zeitalter, Erfolge, Statistik, Neuguss-Zähler, Patente und Konzernforschung bleiben. Patente = `min( floor( sqrt(Gussformen im Konzernlauf / 1500) × (1 + 0,1 × Lizenzgebühren) ), floor(0,68 × Stunden seit der letzten Gründung) )` (konkav und gedeckelt), wirken als Produktionsbonus, schalten sieben Konzernstufen (K1 bis K7) frei und werden im Konzern-Shop (9 Einträge, Summe 351 Patente) ausgegeben.

Dazu kommen: 7 Materialien (Kobalt bis Superlegierung) mit 7 Generatoren und 4 Rezepten, 49 Konzernforschungen, 12 Boosts, 4 Klick-Upgrades, Zeitalter 6 bis 8, Generator-Ausbau VI bis VIII, zwei Industrie-Meilenstein-Leisten (Fördermenge, Materialvielfalt), Zielleiste, Neuguss-Vorschau und Auto-Neuguss. Gesamtumfang: 125 Forschungen, 43 Boosts, 10 Klick-Upgrades, 21 Generatoren, 19 Materialien, 10 Rezepte, 9 Zeitalter (die Tabellen in Abschnitt A6 und die Zeitalter-Tabelle in 3a zeigen das Grundspiel ohne diese Erweiterungen).

Zeitplan (Bot `rate`, gemessen mit `node tools/balance-full.mjs`): alle Inhalte bei 602,3 h, Zielkorridor 504 bis 700 h; schnellste gefundene Spielweise 538,4 h, rechnerische Untergrenze 516 h. Alle Formeln, Tabellen, kalibrierten Werte und die Zeitleiste stehen in Teil B, nicht hier.

## A4. Balance-Begründung

- Prinzip: Jedes neue Material kostet im Generator das Material davor plus Erz/Stahl, und seine Freischaltforschung kostet das Vorprodukt. Dadurch ist die Reihenfolge erzwungen und die Kette kann nicht „übersprungen“ werden. Ein Test prüft per Fixpunkt-Rechnung, dass jede Ressource, Forschung, jeder Generator, Boost und jedes Klick-Upgrade erreichbar ist und dass kein Zyklus in den Voraussetzungen existiert.
- Staffelung: Neue Gegenstände werden erst angezeigt, wenn ihre Voraussetzungen direkt freischaltbar sind (`isRevealed`), damit die Listen nicht von Anfang an mit gesperrten Karten gefüllt sind.
- Kostenkurve: Basiskosten steigen je Materialstufe etwa um den Faktor 3 bis 10, Wachstum je Stufe 1,17 (Zeche) bis 1,27 (Tiegel); die Elite-Titankosten wachsen mit den späten Generatoren (2 bis 10). Basisproduktion sinkt dafür (Zeche 2/s, Tiegel 0,004/s), weil der Wert pro Einheit steigt.
- Erster neuer Inhalt: Kohleflöz-Erkundung kostet 15.000 Erz + 150 Stahl und dauert 20 s (Geologie 5 s, Tiefbau 15 s davor). In der Simulation (greedy Bot, 4 Klicks/s, Verhalten der echten Module) erscheint die Kohle nach etwa 4:30 (Forschung) und 5:20 (Zeche), Koks nach etwa 10 min.
- Mitte: Simulation – Kupfer ca. 42 bis 50 min, Mangan ca. 56 bis 60 min, Legierung ca. 73 bis 79 min, Chrom/Nickel ca. 97 min, Wolfram ca. 109 min, Gold ca. 147 min bei einem eher passiven Bot. Ein menschlicher Spieler mit Vorplanung ist schneller, der Neuguss (bereits ab ca. 50 min möglich) verschiebt das Ende weiter nach hinten: Die Kette trägt über den ersten Neuguss hinaus, weil ohne „Wissensarchiv“ die Forschung verloren geht und die Kette erneut (schneller durch den Gussformen-Bonus) aufgebaut wird.
- Hochofen-Skalierung (exponentiell): Der Erzbedarf für insgesamt n Gussformen in einem Durchlauf beträgt `divisor * growth^(n-1)` mit `divisor = 1e7`, `growth = 1,05` (js/data/prestige.js); jede weitere Gussform braucht also ×1,05 so viel Erz. Gewinn = `floor(log(erz/divisor) / log(growth)) + 1` ab `erz >= divisor`, sonst 0, anschließend × (1 + 0,1 × Stufe „Hochofen-Kapazität“), abgerundet; Rundungsfehler von `log` fängt ein Korrekturschritt gegen die exakte Schwelle ab. `perPoint = 0,1` (+10 % je Gussform) bleibt unverändert. Der erste Neuguss ist ab 1e7 Erz (ca. 45 min) möglich. Gussformen sind ein Zähler und wachsen nur mit dem Logarithmus des Erzes; ein Faktor von ×1,5 hätte die Meilensteine ab 20 Gussformen praktisch unerreichbar gemacht (100 Gussformen bräuchten 2,7e24 Erz). Mit ×1,05 bringt eine Verdopplung des Erzes etwa +14 Gussformen. Erzbedarf vor Shop-Multiplikator:

| Gussformen | Erz im Durchlauf |
|---|---|
| 1 | 1,00e7 |
| 10 | 1,55e7 |
| 50 | 1,09e8 |
| 100 | 1,25e9 |
| 200 | 1,65e11 |
| 500 | 3,75e17 |

- Meilensteine (`MILESTONES.at` bezieht sich auf die **insgesamt verdienten** Gussformen über alle Durchläufe, `prestige.total`, nicht auf den ausgebbaren Bestand). Simulation: `tools/balance-sim.mjs` (echte Module, gieriger Bot mit 4 Klicks/s, Shop-Käufe nach fester Prioritätsliste; Zeit = aktive Spielzeit ohne Offline-Ertrag, also eine obere Schranke). Benchmark „Aktiv“: Neuguss, sobald der Gewinnzuwachs der letzten 2 min unter den Durchlauf-Schnitt fällt (ab dem Wissensarchiv dauert ein Durchlauf ca. 7 min und bringt ca. 1.200 Gussformen). Benchmark „Gelegentlich“: Neuguss bei Gewinn >= 10 % des Bestands.

| Meilenstein (Gussformen gesamt) | Wirkung | Aktiv (Neuguss Nr.) | Gelegentlich (Neuguss Nr.) |
|---|---|---|---|
| 5 | ×1,25 | 1,7 h (1) | 1,3 h (2) |
| 25 | ×1,5 | 1,7 h (1) | 3,2 h (9) |
| 150 | ×2 | 1,8 h (2) | 4,3 h (20) |
| 1.000 | ×3 | 2,1 h (5) | 4,6 h (24) |
| 10.000 | ×5 | 3,8 h (19) | 6,0 h (38) |
| 250.000 | ×10 | ca. 24 bis 30 h (ca. 250) | nicht erreicht |

  Begründung: Der Gewinn je Durchlauf pendelt sich bei ca. 1.200 Gussformen ein (er wächst nur logarithmisch mit dem Erz), der Gesamtbestand wächst danach linear mit der Anzahl der Durchläufe (ca. 10.000 je Stunde im Dauerlauf). Die unteren Meilensteine liegen deshalb nah beieinander in den ersten Stunden (Einstieg, Wissensarchiv, Snowball), der letzte (250.000) ist das Langzeitziel von etwa 1 bis 1,5 Tagen aktiver Spielzeit im ununterbrochenen Neuguss-Rhythmus. Wer nur bei Gewinn >= 25 % des Bestands gießt, stagniert bei ca. 5.000 Gussformen; das ist gewollt (Anreiz, häufiger zu gießen) und für die ersten vier Meilensteine unkritisch. Der Test `tests/balance.test.mjs` sichert die Staffelung (erster Meilenstein nach 1 bis 2 Neugüssen, Hochrechnung des letzten unter 2 Tagen, Shop komplett bezahlbar).
- Shop-Kosten (an die Gussformen-Menge angepasst, im Aktiv-Benchmark innerhalb von 6 h komplett kaufbar): Legierungskunde 3 × 2^Stufe, Hochofen-Kapazität 4 × 2,1^Stufe, Schmiedehand 2 × 1,9^Stufe, Zeitraffer 5 × 2,2^Stufe, Zusatz-Laborplatz 20 × 2,5^Stufe, Zusatz-Werkbank 15 × 2,5^Stufe, Wissensarchiv 100, Auto-Buyer 30 / 50 / 120 / 200 (Generatoren / Spitzhacke / Forschung / Boosts), Auto-Buyer-Takt 30 × 3^Stufe; Gesamtkosten aller Stufen ca. 13.000 Gussformen. Erfolge mit Gussform-Bezug zählen Neugüsse (1 / 5 / 25 / 100), keine Gussform-Mengen, und blieben unverändert.
- Timer: Die frühen Einträge sind absichtlich kurz (Spieler wartet nicht), die späten lang, damit Offline-Zeit sinnvoll ist. Parallele Slots und Zeitverkürzung sind Prestige-Ziele und machen den Neuguss attraktiver.
- Hammerwut wirkt nur auf manuelle Klicks; die neuen Klick-Upgrades haben Basis 0 und addieren sich zum Klickwert erst ab Stufe 1.

## A5. Freischaltreihenfolge (empfohlener Pfad)

1. Geologie (5 s) → Auto-Konverter / Tiefbau → Metallurgie (Walzwerk)
2. Kohleflöz-Erkundung → Zeche → Verkokung (Koks, Koksofenbatterie, Rezept Kohle → Koks)
3. Titan-Extraktion → Titan-Schmiede; Hochofenprozess (Rezept Erz + Koks → Stahl, Stahl +25 %, Pressluft-Klick-Upgrade)
4. Kupfermetallurgie → Kupferhütte; Manganstahl → Manganbergwerk
5. Laborautomatisierung (Zeiten −25 %) sobald Globale Effizienz vorhanden
6. Legierungstechnik → Legierungsmischer (Rezept Kupfer + Mangan → Legierung); Katalyse (+50 % alles)
7. Chrom & Nickel → Chromwerk, Nickelraffinerie
8. Wolfram-Gewinnung (benötigt zusätzlich Titan-Raffination) → Wolframreaktor, Wolfram-Spitze; Supraleiter (+100 % alles)
9. Goldschmiedekunst → Edelmetall-Tiegel, Goldveredelung (×2 alles)

## A6. Inhalte (aus den Daten erzeugt)

### Generatoren

| Generator | Produziert | Basis/s | Start-Kosten | Wachstum | Elite (Titan ab Stufe 10) | Freigabe |
|---|---|---|---|---|---|---|
| Eisenmine | Eisenerz | 1 | 15 Eisenerz | ×1.15 | 2 | – |
| Bohrturm | Eisenerz | 12 | 400 Eisenerz, 10 Stahlbarren | ×1.17 | 2 | – |
| Schmelzofen | Stahlbarren | 0.25 | 150 Eisenerz | ×1.2 | 2 | – |
| Walzwerk | Stahlbarren | 4 | 2.0e5 Eisenerz, 3000 Stahlbarren | ×1.21 | 5 | Metallurgie |
| Titan-Schmiede | Titan-Legierung | 0.02 | 2.0e4 Eisenerz, 500 Stahlbarren | ×1.25 | 2 | Titan-Extraktion |
| Zeche | Kohle | 2 | 3.0e4 Eisenerz, 400 Stahlbarren | ×1.17 | 3 | Kohleflöz-Erkundung |
| Koksofenbatterie | Koks | 0.5 | 8.0e4 Eisenerz, 1500 Stahlbarren, 200 Kohle | ×1.18 | 3 | Verkokung |
| Kupferhütte | Kupfer | 0.6 | 2.0e5 Eisenerz, 6000 Stahlbarren | ×1.19 | 4 | Kupfermetallurgie |
| Manganbergwerk | Mangan | 0.3 | 2.0e4 Stahlbarren, 150 Kupfer, 200 Koks | ×1.2 | 4 | Manganstahl |
| Legierungsmischer | Legierung | 0.08 | 1.0e5 Stahlbarren, 1500 Kupfer, 400 Mangan | ×1.22 | 5 | Legierungstechnik |
| Chromwerk | Chrom | 0.12 | 3.0e5 Stahlbarren, 800 Mangan, 30 Legierung | ×1.22 | 6 | Chrom & Nickel |
| Nickelraffinerie | Nickel | 0.1 | 3.0e5 Stahlbarren, 8000 Kupfer, 30 Legierung | ×1.22 | 6 | Chrom & Nickel |
| Wolframreaktor | Wolfram | 0.02 | 3000 Titan-Legierung, 300 Legierung, 200 Chrom, 200 Nickel | ×1.25 | 8 | Wolfram-Gewinnung |
| Edelmetall-Tiegel | Gold | 0.004 | 2.0e4 Titan-Legierung, 200 Wolfram, 1500 Legierung | ×1.27 | 10 | Goldschmiedekunst |

### Forschung (Labor)

Spalte „Zeitalter“ = Feld `era` (Mindest-Zeitalter, ohne Feld 0). Zeilen in Reihenfolge der Daten, gruppiert nach Zeitalter.

| Forschung | Zeitalter | Dauer | Kosten | Voraussetzung | Wirkung | Gefäß | Flüssigkeit |
|---|---|---|---|---|---|---|---|
| Geologie | 0 | 5 s | 300 Eisenerz | – | +25 % Erzproduktion. | mining | #f97316 |
| Resonanzhammer | 0 | 8 s | 1500 Eisenerz, 15 Stahlbarren | Geologie | Jeder Klick gibt zusätzlich 5 % deiner Erz/s. | tech | #f97316 |
| Auto-Konverter | 0 | 10 s | 3000 Eisenerz, 40 Stahlbarren | Geologie | Wandelt automatisch 20 % der Erzproduktion in Stahl um (25:1). | metal | #38bdf8 |
| Tiefbau | 0 | 15 s | 6000 Eisenerz, 60 Stahlbarren | Geologie | +50 % Erzproduktion. | mining | #f97316 |
| Metallurgie | 0 | 30 s | 8000 Eisenerz, 120 Stahlbarren | Auto-Konverter | +50 % Stahlproduktion. Schaltet das Walzwerk frei. | metal | #38bdf8 |
| Titan-Extraktion | 0 | 1 min | 1.5e4 Eisenerz, 250 Stahlbarren | Metallurgie | Schaltet die Titan-Schmiede frei. | chem | #d946ef |
| Titan-Raffination | 0 | 2 min | 4.0e4 Eisenerz, 800 Stahlbarren, 8 Titan-Legierung | Titan-Extraktion | +50 % Titanproduktion. | chem | #d946ef |
| Globale Effizienz | 0 | 2 min | 800 Stahlbarren, 10 Titan-Legierung | Titan-Extraktion | +50 % Produktion aller Materialien. | tech | #fbbf24 |
| Automatisierte Spitzhacken | 0 | 3 min | 2000 Stahlbarren, 30 Titan-Legierung | Resonanzhammer, Globale Effizienz | 5 automatische Klicks pro Sekunde. | tech | #fbbf24 |
| Präzisionsfertigung | 0 | 4 min | 2.0e5 Eisenerz, 5000 Stahlbarren, 60 Titan-Legierung | Globale Effizienz | Zusätzliche Meilensteine (×2) bei Stufe 25, 50, 100, 150, 200 ... | tech | #fbbf24 |
| Quantenmetallurgie | 0 | 12 min | 1.0e6 Eisenerz, 1.0e4 Stahlbarren, 250 Titan-Legierung | Automatisierte Spitzhacken, Präzisionsfertigung | +100 % Produktion aller Materialien. | chem | #fbbf24 |
| Kohleflöz-Erkundung | 0 | 20 s | 1.5e4 Eisenerz, 150 Stahlbarren | Tiefbau | Schaltet die Zeche frei und macht Kohle abbaubar. | mining | #64748b |
| Verkokung | 0 | 40 s | 4.0e4 Eisenerz, 600 Stahlbarren, 200 Kohle | Kohleflöz-Erkundung | Schaltet die Koksofenbatterie frei. Wandelt 40 % der Kohle in Koks um (5:1). | chem | #a8a29e |
| Hochofenprozess | 0 | 1 min 30 s | 1.0e5 Eisenerz, 2000 Stahlbarren, 300 Koks | Verkokung, Metallurgie | +25 % Stahlproduktion. Erz und Koks werden zusätzlich zu Stahl verhüttet. | metal | #a8a29e |
| Kupfermetallurgie | 0 | 1 min | 1.5e5 Eisenerz, 3000 Stahlbarren | Metallurgie | Schaltet die Kupferhütte frei. | metal | #ea8a52 |
| Manganstahl | 0 | 2 min 30 s | 8000 Stahlbarren, 300 Kupfer, 300 Koks | Kupfermetallurgie, Verkokung | Schaltet das Manganbergwerk frei. | metal | #a78bfa |
| Laborautomatisierung | 0 | 4 min | 2.0e5 Eisenerz, 1.0e4 Stahlbarren, 100 Titan-Legierung | Globale Effizienz | Alle Forschungs- und Werkbank-Zeiten dauern 25 % kürzer. | tech | #fbbf24 |
| Legierungstechnik | 0 | 6 min | 3.0e4 Stahlbarren, 1500 Kupfer, 300 Mangan | Manganstahl | Schaltet den Legierungsmischer frei. Kupfer und Mangan werden zu Legierung gemischt (3:1). | chem | #38bdf8 |
| Katalyse | 0 | 10 min | 1.5e5 Stahlbarren, 3000 Kupfer, 100 Legierung | Legierungstechnik | +50 % Produktion aller Materialien. | chem | #38bdf8 |
| Chrom & Nickel | 0 | 8 min | 2.0e5 Stahlbarren, 5000 Kupfer, 1000 Mangan, 50 Legierung | Legierungstechnik | Schaltet Chromwerk und Nickelraffinerie frei. | metal | #5eead4 |
| Wolfram-Gewinnung | 0 | 15 min | 2000 Titan-Legierung, 400 Legierung, 300 Chrom, 300 Nickel | Chrom & Nickel, Titan-Raffination | Schaltet den Wolframreaktor frei. Legierung, Chrom und Nickel werden zu Wolfram veredelt (8:2:2). | chem | #f472b6 |
| Supraleiter | 0 | 20 min | 1.0e4 Titan-Legierung, 100 Wolfram, 800 Legierung | Wolfram-Gewinnung | +100 % Produktion aller Materialien. | tech | #f472b6 |
| Goldschmiedekunst | 0 | 30 min | 3.0e4 Titan-Legierung, 300 Wolfram, 3000 Legierung | Supraleiter | Schaltet den Edelmetall-Tiegel frei. Wolfram wird teilweise zu Gold umgeschmolzen (20:1). | chem | #fbbf24 |
| Erzabbau I | 0 | 40 s | 4.0e4 Eisenerz, 500 Stahlbarren | Tiefbau | +10 % Erzproduktion. | mining | #f97316 |
| Erzabbau II | 0 | 1 min 30 s | 2.5e5 Eisenerz, 4000 Stahlbarren | Erzabbau I | +10 % Erzproduktion. | mining | #f97316 |
| Stahlerzeugung I | 0 | 1 min 40 s | 3.0e5 Eisenerz, 8000 Stahlbarren, 400 Koks | Hochofenprozess | +10 % Stahlproduktion. | metal | #38bdf8 |
| Flözausbau I | 0 | 1 min 10 s | 3.0e5 Eisenerz, 5000 Stahlbarren, 2500 Kohle | Tiefenkohlebergbau | +12 % Kohleproduktion. | mining | #64748b |
| Titan-Schmelzverfahren I | 0 | 3 min 20 s | 5.0e5 Eisenerz, 1.5e4 Stahlbarren, 150 Titan-Legierung | Titan-Raffination | +12 % Titanproduktion. | chem | #d946ef |
| Tiefenkohlebergbau | 0 | 1 min 30 s | 8.0e4 Eisenerz, 2000 Stahlbarren, 1000 Kohle | Kohleflöz-Erkundung | +50 % Kohleproduktion. Moderne Tiefbautechniken erschließen neue Vorkommen. | mining | #64748b |
| Kupfererz-Konzentration | 0 | 3 min | 2.0e5 Eisenerz, 5000 Stahlbarren, 500 Kupfer | Kupfermetallurgie | +50 % Kupferproduktion durch fortgeschrittene Aufbereitungstechnik. | metal | #ea8a52 |
| Erzabbau III | 1 | 3 min | 1.1e16 Eisenerz, 3.2e16 Stahlbarren | Erzabbau II | +10 % Erzproduktion. | mining | #f97316 |
| Stahlerzeugung II | 1 | 3 min 20 s | 1.4e16 Eisenerz, 4.0e16 Stahlbarren, 5.5e13 Koks | Stahlerzeugung I | +10 % Stahlproduktion. | metal | #38bdf8 |
| Koksofen-Optimierung I | 1 | 3 min 40 s | 1.7e16 Eisenerz, 5.0e16 Stahlbarren, 6.9e13 Koks | Verkokung | +12 % Koksproduktion. | chem | #a8a29e |
| Kupferwalzen | 1 | 4 min | 2.1e16 Eisenerz, 6.3e16 Stahlbarren, 1.2e12 Kupfer | Kupfererz-Konzentration | +12 % Kupferproduktion. | metal | #ea8a52 |
| Legierungsveredelung I | 1 | 4 min 20 s | 2.7e16 Eisenerz, 7.9e16 Stahlbarren, 1.5e12 Kupfer, 2.2e11 Legierung | Legierungstechnik | +12 % Legierungsproduktion. | chem | #38bdf8 |
| Prozessoptimierung I | 1 | 5 min | 3.4e16 Eisenerz, 1.0e17 Stahlbarren, 3.0e11 Titan-Legierung | Energiefundamente | +5 % aller Materialien. | tech | #fbbf24 |
| Energiefundamente | 1 | 2 min | 6.8e15 Eisenerz, 2.0e16 Stahlbarren, 9.2e12 Kohle | Resonanzhammer | +25 % Erz- und Stahlproduktion. Grundlagen der modernen Energiewirtschaft. | tech | #64748b |
| Wasserkraft | 1 | 2 min 30 s | 8.6e15 Eisenerz, 2.5e16 Stahlbarren, 1.2e13 Kohle | Energiefundamente | +25 % Erzproduktion durch Wasserkraftwerke. | mining | #f97316 |
| Erzabbau IV | 2 | 6 min 40 s | 9.8e18 Eisenerz, 2.4e19 Stahlbarren | Erzabbau III | +10 % Erzproduktion. | mining | #f97316 |
| Stahlerzeugung III | 2 | 7 min 30 s | 1.2e19 Eisenerz, 3.0e19 Stahlbarren, 3.8e15 Koks | Stahlerzeugung II | +10 % Stahlproduktion. | metal | #38bdf8 |
| Flözausbau II | 2 | 7 min | 1.5e19 Eisenerz, 3.7e19 Stahlbarren, 1.3e15 Kohle | Flözausbau I | +12 % Kohleproduktion. | mining | #64748b |
| Titan-Schmelzverfahren II | 2 | 8 min 40 s | 1.8e19 Eisenerz, 4.5e19 Stahlbarren, 8.8e12 Titan-Legierung | Titan-Schmelzverfahren I | +12 % Titanproduktion. | chem | #d946ef |
| Mangan-Tiefbau | 2 | 9 min 20 s | 2.2e19 Eisenerz, 5.5e19 Stahlbarren, 3.0e11 Mangan | Manganstahl | +12 % Manganproduktion. | metal | #a78bfa |
| Chrom- und Nickelhütte | 2 | 10 min | 2.7e19 Eisenerz, 6.7e19 Stahlbarren, 8.6e9 Chrom, 6.7e9 Nickel | Chrom & Nickel | +10 % Chrom- und Nickelproduktion. | metal | #5eead4 |
| Hochdruckkessel | 2 | 10 min 40 s | 3.3e19 Eisenerz, 8.2e19 Stahlbarren, 1.1e16 Koks | Dampfmaschine | +5 % aller Materialien. | tech | #a8a29e |
| Prozessoptimierung II | 2 | 11 min 40 s | 4.0e19 Eisenerz, 1.0e20 Stahlbarren, 2.0e13 Titan-Legierung | Prozessoptimierung I | +5 % aller Materialien. | tech | #fbbf24 |
| Dampfmaschine | 2 | 3 min | 8.1e18 Eisenerz, 2.0e19 Stahlbarren, 2.6e15 Koks | Wasserkraft | +25 % aller Materialien. Die Kraft des Dampfes revolutioniert die Fertigung. | tech | #a8a29e |
| Erzabbau V | 3 | 13 min 20 s | 1.7e21 Eisenerz, 3.4e21 Stahlbarren | Erzabbau IV | +10 % Erzproduktion. | mining | #f97316 |
| Stahlerzeugung IV | 3 | 14 min 10 s | 2.1e21 Eisenerz, 4.1e21 Stahlbarren, 1.1e18 Koks | Stahlerzeugung III | +10 % Stahlproduktion. | metal | #38bdf8 |
| Koksofen-Optimierung II | 3 | 14 min 40 s | 2.5e21 Eisenerz, 4.9e21 Stahlbarren, 1.3e18 Koks | Koksofen-Optimierung I | +12 % Koksproduktion. | chem | #a8a29e |
| Kupfer-Feinzug | 3 | 15 min | 3.0e21 Eisenerz, 5.8e21 Stahlbarren, 7.0e15 Kupfer | Kupferwalzen | +12 % Kupferproduktion. | metal | #ea8a52 |
| Legierungsveredelung II | 3 | 15 min 50 s | 3.5e21 Eisenerz, 7.0e21 Stahlbarren, 7.1e13 Legierung | Legierungsveredelung I | +12 % Legierungsproduktion. | chem | #38bdf8 |
| Hochspannungsnetz | 3 | 16 min 40 s | 4.2e21 Eisenerz, 8.4e21 Stahlbarren, 1.0e16 Kupfer | Elektrifizierung | +5 % aller Materialien. | tech | #ea8a52 |
| Prozessoptimierung III | 3 | 17 min 30 s | 5.1e21 Eisenerz, 1.0e22 Stahlbarren, 2.1e15 Titan-Legierung | Prozessoptimierung II | +5 % aller Materialien. | tech | #fbbf24 |
| Dynamo | 3 | 4 min | 1.0e21 Eisenerz, 2.0e21 Stahlbarren, 2.4e15 Kupfer | Dampfmaschine | +50 % Stahlproduktion durch elektrische Generierung. | tech | #ea8a52 |
| Stromversorgung | 3 | 5 min | 1.2e21 Eisenerz, 2.4e21 Stahlbarren, 2.9e15 Kupfer | Dynamo | +25 % aller Materialien. Flächendeckende elektrische Netze. | tech | #fbbf24 |
| Elektrifizierung | 3 | 6 min | 1.4e21 Eisenerz, 2.9e21 Stahlbarren, 3.4e15 Kupfer, 2.9e13 Legierung | Stromversorgung | +50 % aller Materialien. Alle Prozesse laufen elektrisch. | tech | #fbbf24 |
| Erzabbau VI | 4 | 18 min 20 s | 1.3e22 Eisenerz, 4.1e22 Stahlbarren | Erzabbau V | +10 % Erzproduktion. | mining | #f97316 |
| Stahlerzeugung V | 4 | 19 min 10 s | 1.5e22 Eisenerz, 4.9e22 Stahlbarren, 2.7e19 Koks | Stahlerzeugung IV | +10 % Stahlproduktion. | metal | #38bdf8 |
| Titan-Schmelzverfahren III | 4 | 20 min | 1.8e22 Eisenerz, 5.8e22 Stahlbarren, 2.5e16 Titan-Legierung | Titan-Schmelzverfahren II | +12 % Titanproduktion. | chem | #d946ef |
| Wolfram-Zentrifugen | 4 | 20 min 50 s | 2.1e22 Eisenerz, 7.0e22 Stahlbarren, 5.0e13 Wolfram | Wolfram-Gewinnung | +12 % Wolframproduktion. | chem | #f472b6 |
| Kraftwerksverbund | 4 | 21 min 40 s | 2.6e22 Eisenerz, 8.4e22 Stahlbarren, 2.0e17 Kupfer, 2.0e15 Legierung | Fließbandproduktion | +5 % aller Materialien. | tech | #fbbf24 |
| Prozessoptimierung IV | 4 | 22 min 30 s | 3.1e22 Eisenerz, 1.0e23 Stahlbarren, 4.3e16 Titan-Legierung | Prozessoptimierung III | +5 % aller Materialien. | tech | #fbbf24 |
| Fließbandproduktion | 4 | 7 min | 6.1e21 Eisenerz, 2.0e22 Stahlbarren, 4.7e14 Legierung | Elektrifizierung | +50 % Erz- und Stahlproduktion durch automatisierte Fertigungslinien. | tech | #f97316 |
| Robotik | 4 | 8 min | 7.3e21 Eisenerz, 2.4e22 Stahlbarren, 1.0e16 Titan-Legierung, 5.6e14 Legierung | Fließbandproduktion | +50 % aller Materialien. Intelligente Roboter übernehmen die Fertigung. | tech | #fbbf24 |
| Massenproduktion | 4 | 9 min | 8.8e21 Eisenerz, 2.9e22 Stahlbarren, 6.7e14 Legierung | Robotik | +50 % aller Materialien. Unbegrenzte Skalierung der Fertigungskapazität. | tech | #fbbf24 |
| Quantenoptik | 4 | 20 min | 1.0e22 Eisenerz, 3.4e22 Stahlbarren, 1.5e16 Titan-Legierung, 8.0e14 Legierung | Quantenmetallurgie | +25 % aller Materialien. Licht und Quantenmechanik in der Messtechnik. | tech | #fbbf24 |
| Erzabbau VII | 5 | 24 min 10 s | 3.8e22 Eisenerz, 1.1e23 Stahlbarren | Erzabbau VI | +10 % Erzproduktion. | mining | #f97316 |
| Stahlerzeugung VI | 5 | 25 min | 4.7e22 Eisenerz, 1.3e23 Stahlbarren, 6.0e19 Koks | Stahlerzeugung V | +10 % Stahlproduktion. | metal | #38bdf8 |
| Legierungsveredelung III | 5 | 25 min 50 s | 5.7e22 Eisenerz, 1.6e23 Stahlbarren, 3.8e15 Legierung | Legierungsveredelung II | +12 % Legierungsproduktion. | chem | #38bdf8 |
| Edelmetall-Raffination | 5 | 26 min 40 s | 7.0e22 Eisenerz, 2.0e23 Stahlbarren, 4.5e13 Gold | Goldschmiedekunst | +12 % Goldproduktion. | chem | #fbbf24 |
| Kernfusion | 5 | 28 min 20 s | 8.6e22 Eisenerz, 2.5e23 Stahlbarren, 1.6e14 Wolfram | Synthetische Materialien | +7 % aller Materialien. | tech | #fbbf24 |
| Prozessoptimierung V | 5 | 30 min | 1.0e23 Eisenerz, 3.0e23 Stahlbarren, 1.5e17 Titan-Legierung | Prozessoptimierung IV | +5 % aller Materialien. | tech | #fbbf24 |
| Halbleitertechnik | 5 | 10 min | 2.1e22 Eisenerz, 6.0e22 Stahlbarren, 1.2e17 Kupfer, 4.0e13 Wolfram | Massenproduktion | +25 % aller Materialien. Mikroelektronische Revolution der Industrie. | chem | #fbbf24 |
| Nanotechnologie | 5 | 12 min | 2.6e22 Eisenerz, 7.3e22 Stahlbarren, 4.9e13 Wolfram, 1.7e15 Legierung | Halbleitertechnik | +100 % aller Materialien. Manipulation auf atomarer Ebene. | chem | #fbbf24 |
| Synthetische Materialien | 5 | 15 min | 3.1e22 Eisenerz, 9.0e22 Stahlbarren, 2.0e13 Gold, 6.0e13 Wolfram, 2.1e15 Legierung | Nanotechnologie | +50 % aller Materialien. Künstlich erzeugte Stoffe übertreffen Natur. | chem | #fbbf24 |

Insgesamt 76 Forschungen.

### Boosts (Werkbank)

| Boost | Zeitalter | Dauer | Kosten | Freigabe | Wirkung |
|---|---|---|---|---|---|
| Diamantbohrer | 0 | 15 s | 150 Stahlbarren, 5 Titan-Legierung | – | Erzproduktion ×2. |
| Hochofen-Turbo | 0 | 25 s | 500 Stahlbarren, 20 Titan-Legierung | – | Stahlproduktion ×2. |
| Quantenpresse | 0 | 45 s | 2000 Stahlbarren, 60 Titan-Legierung | – | Titanproduktion ×2. |
| Overclocking | 0 | 1 min 30 s | 5.0e5 Eisenerz, 150 Titan-Legierung | – | Alle Materialien ×1,5. |
| Magnetscheider | 0 | 2 min 30 s | 5.0e4 Stahlbarren, 800 Titan-Legierung | – | Erzproduktion ×2. |
| Kryo-Veredelung | 0 | 4 min | 2.0e5 Stahlbarren, 2500 Titan-Legierung | – | Titanproduktion ×2. |
| Zechen-Förderband | 0 | 20 s | 2000 Stahlbarren, 500 Kohle | Kohleflöz-Erkundung | Kohleproduktion ×2. |
| Koks-Löschanlage | 0 | 35 s | 8000 Stahlbarren, 300 Koks | Verkokung | Koksproduktion ×2. |
| Sinteranlage | 0 | 1 min 20 s | 1.0e5 Stahlbarren, 2000 Koks | Hochofenprozess | Erzproduktion ×2. |
| Kupferelektrolyse | 0 | 1 min | 5.0e4 Stahlbarren, 800 Kupfer | Kupfermetallurgie | Kupferproduktion ×2. |
| Mangan-Härtung | 0 | 2 min | 1.0e5 Stahlbarren, 500 Mangan | Manganstahl | Stahlproduktion ×1,5, Manganproduktion ×2. |
| Mischer-Katalysator | 0 | 3 min 20 s | 5000 Kupfer, 2000 Mangan, 100 Legierung | Legierungstechnik | Legierungsproduktion ×2. |
| Verchromung | 0 | 5 min | 5.0e5 Stahlbarren, 1000 Chrom, 500 Nickel | Chrom & Nickel | Alle Materialien ×1,25. |
| Nickel-Superlegierung | 0 | 7 min | 5000 Titan-Legierung, 1000 Nickel, 300 Legierung | Chrom & Nickel | Titanproduktion ×2. |
| Wolframkarbid-Bohrer | 0 | 10 min | 2.0e4 Titan-Legierung, 200 Wolfram | Wolfram-Gewinnung | Erzproduktion ×3. |
| Goldveredelung | 0 | 15 min | 500 Wolfram, 50 Gold | Goldschmiedekunst | Alle Materialien ×2. |
| Erzprobenanalyse | 0 | 2 min 30 s | 3.0e6 Stahlbarren, 2.0e4 Titan-Legierung | Erzabbau I | Erzproduktion ×1,25. |
| Schlackenverwertung | 0 | 3 min 20 s | 2.0e6 Stahlbarren, 5.0e4 Koks | Stahlerzeugung I | Stahlproduktion ×1,25. |
| Wasserrad-Antrieb | 1 | 5 min | 2.0e16 Stahlbarren, 6.0e10 Titan-Legierung | Erzabbau III | Erzproduktion ×1,5. |
| Walzstraße | 1 | 6 min | 1.0e17 Stahlbarren, 1.4e14 Koks | Stahlerzeugung II | Stahlproduktion ×1,5. |
| Schmiedeautomat | 1 | 7 min | 4.5e16 Stahlbarren, 8.2e11 Kupfer | Erzabbau III | Klickwert ×2. |
| Dampfbohrer | 2 | 9 min | 3.4e19 Stahlbarren, 4.4e15 Koks | Erzabbau IV | Erzproduktion ×1,5. |
| Bessemer-Konverter | 2 | 10 min | 5.8e19 Stahlbarren, 7.5e15 Koks, 3.2e11 Mangan | Stahlerzeugung III | Stahlproduktion ×2. |
| Servo-Klopfer | 2 | 8 min | 2.0e19 Stahlbarren, 2.4e13 Kupfer | Automatisierte Spitzhacken | Autoklick-Ertrag ×2. |
| Überdruckventile | 2 | 12 min | 1.0e20 Stahlbarren, 1.2e14 Kupfer, 1.3e16 Koks | Hochdruckkessel | Alle Materialien ×1,25. |
| Lichtbogenofen | 3 | 14 min | 2.0e21 Stahlbarren, 2.4e15 Kupfer, 2.7e11 Chrom | Stahlerzeugung IV | Stahlproduktion ×2. |
| Kupfersammelschiene | 3 | 16 min | 1.0e22 Stahlbarren, 1.2e16 Kupfer | Hochspannungsnetz | Alle Materialien ×1,25. |
| Taktstraßen-Optimierung | 4 | 20 min | 2.0e22 Stahlbarren, 4.7e14 Legierung | Prozessoptimierung IV | Alle Materialien ×1,5. |
| Roboterarm-Kalibrierung | 4 | 21 min 40 s | 1.0e23 Stahlbarren, 2.3e15 Legierung, 7.2e13 Wolfram | Kraftwerksverbund | Klickwert ×2, Autoklick-Ertrag ×1,5. |
| Nano-Beschichtung | 5 | 23 min 20 s | 6.0e22 Stahlbarren, 3.0e16 Titan-Legierung | Prozessoptimierung V | Erzproduktion ×2. |
| Fusions-Katalysator | 5 | 26 min 40 s | 3.0e23 Stahlbarren, 2.0e14 Wolfram, 6.8e13 Gold | Kernfusion | Alle Materialien ×1,5. |

Insgesamt 31 Boosts.

### Klick-Upgrades (Werkbank, wiederholbar)

| Upgrade | Zeitalter | Klickwert/Stufe | Kosten Stufe 1 → 10 | Dauer Stufe 1 / 10 / Max | Freigabe |
|---|---|---|---|---|---|
| Verstärkte Spitzhacke | 0 | +2 (×Meilenstein) | 25 Eisenerz → 962 Eisenerz, 27 Stahlbarren | 5 s / 13 s / 4 min | – |
| Vorschlaghammer | 0 | +10 (×Meilenstein) | 300 Stahlbarren → 1.55e4 Stahlbarren, 26 Titan-Legierung | 10 s / 35 s / 7 min | Metallurgie |
| Koks-Presslufthammer | 0 | +150 (×Meilenstein) | 5.0e4 Stahlbarren, 300 Koks → 3.44e6 Stahlbarren, 1.15e4 Koks | 40 s / 2 min 20 s / 15 min | Hochofenprozess |
| Wolfram-Spitze | 0 | +6000 (×Meilenstein) | 2.0e4 Titan-Legierung, 100 Wolfram → 1.37e6 Titan-Legierung, 3845 Wolfram | 2 min / 7 min 2 s / 25 min | Wolfram-Gewinnung |
| Hydraulikramme | 1 | +2.0e5 (×Meilenstein) | 5.0e15 Stahlbarren → 3.44e17 Stahlbarren, 5.70e16 Titan-Legierung | 3 min 20 s / 11 min 43 s / 25 min | Erzabbau III |
| Plasmalanze | 3 | +5.0e8 (×Meilenstein) | 5.0e20 Stahlbarren, 5.0e20 Wolfram → 5.93e22 Stahlbarren, 2.58e22 Wolfram | 6 min 40 s / 23 min 27 s / 30 min | Prozessoptimierung III |

### Rezepte

| Rezept | Anteil | Eingang | Ausgang | Freigabe |
|---|---|---|---|---|
| Auto-Konverter | 20 % | 25 Eisenerz | 1 Stahlbarren | Auto-Konverter |
| Verkokung | 40 % | 5 Kohle | 1 Koks | Verkokung |
| Hochofen | 30 % | 12 Eisenerz + 1 Koks | 4 Stahlbarren | Hochofenprozess |
| Legierungsmischen | 50 % | 3 Kupfer + 1 Mangan | 1 Legierung | Legierungstechnik |
| Wolfram-Veredelung | 30 % | 8 Legierung + 2 Chrom + 2 Nickel | 1 Wolfram | Wolfram-Gewinnung |
| Goldschmelze | 25 % | 20 Wolfram | 1 Gold | Goldschmiedekunst |

### Hochofen-Shop (neu)

| Eintrag | Wirkung | Kosten | Max |
|---|---|---|---|
| Zusatz-Laborplatz | +1 gleichzeitig laufende Forschung je Stufe. | 20 × 2.5^Stufe | 3 |
| Zusatz-Werkbank | +1 gleichzeitig laufendes Upgrade/Boost je Stufe. | 15 × 2.5^Stufe | 3 |
| Zeitraffer | Forschung, Boosts und Klick-Upgrades dauern 8 % kürzer je Stufe. | 5 × 2.2^Stufe | 6 |

### Neue Erfolge
Kohle (10.000), Koks (1.000), Kupfer (1.000), Legierung (100), Wolfram (50), Gold (10 und 10.000) insgesamt produziert; 15 Forschungen; 10 Boosts; 10 / 50 / 200 abgeschlossene Aufträge.

## A7. Schnittstellen für die UI

Timer-API (`js/systems/timers.js`): `enqueue(kind, id)`, `cancel(queue, index)`, `tick(dt)`, `queueState(queue)` → `[{ kind, id, name, total, left, progress, running, index }]`, `isPending(kind, id)`, `timeToNext()`, `finishAll()` (Test/Debug). Lesende Helfer in `core/formulas.js`: `queueSlots`, `queueCapacity`, `duration(kind, id)`, `pendingOf(kind, id)`, `lockReason` (liefert „Läuft“, „In Warteschlange“, „Labor: Warteschlange voll“), `isRevealed`, `resVisible`.

Events: `timer:queued`, `timer:done`, `timer:cancel` (`{ queue, kind, id }`, bei Abbruch zusätzlich `refund`, `running`), `gen:evolve` (`{ id, tier }`), `buy` mit `queued: true` bei Aufträgen.

Datenfelder: `img` je Material und Generator (`assets/icons/res-<id>.svg`, `gen-<id>.svg`; vorhandene Dateien stehen in `js/ui/assets.js`, für alle anderen zeigt die UI das Emoji `icon` als Textfallback), `sym` (Symbolname in `assets/sprites/items.svg`, id `sym-<name>`; die UI zeigt das SVG per `symSvg`, bei Forschung wird `sym` über die Tabelle `SYM` in `data/research.js` aus dem Emoji abgeleitet), `liquid` (Farbe) und `cat` (`mining` Erlenmeyer, `metal` Reagenzglas, `chem` Rundkolben, `tech` Retorte) je Forschung, `time` je Forschung/Boost/Klick-Upgrade.

## A8. Hinweise zur Balance

- Der erste Neuguss kommt nach etwa 2 h Spielzeit (Bot: 1,8 bis 2,6 h). Bis dahin sind Industrie-Tab und Zeitalter-Anzeige ausgeblendet.
- Alle Zeiten stammen von Bots. Echte Spielzeiten schwanken je nach Spielstil, besonders bei den Zeitaltern 3 bis 5 (schneller Bot: 13 bis 15 h, kalibrierter Lauf: 96 bis 192 h).

## A9. Zufallsereignisse und Herausforderungen
- Zufallsereignisse (`data/events-random.js`, `systems/events-random.js`): alle 8 bis 15 min aktive Spielzeit höchstens eines, Hinweisknopf oben rechts (`ui/revent.js`), ignorierbar. Typen: Erzader (Klickwert ×10 für 30 s), Rohstoffengpass (ein Material −50 % für 60 s als Buff `shortage` mit Feld `res`, Klick behebt ihn), Sonderauftrag (90 s Frist, Rate × 45 s Einheiten liefern, Belohnung Produktion ×2 für 60 s). Zufallsquelle über `setRandom` injizierbar; der Balance-Bot ruft `tick` nie auf.
- Herausforderungen (`data/challenges.js`, `systems/challenges.js`, `ui/challenges.js`, Hochofen-Panel, ab 1. Neuguss): gewählt wurde die einfache sichere Variante "Sonderregel als Modifikator im laufenden Durchlauf mit Zeitlimit", ohne Snapshot und ohne Reset, daher kann nichts beschädigt werden; Abbruch und Scheitern kosten nichts. Ziel = Stahl seit Start: max(floor, Stahlrate beim Start × Frist × k). Belohnung einmalig +3 % Produktion je Herausforderung (`challengeMult`) plus Erfolge `challenge_1`/`challenge_3`. `state.challenges = { done, active }`, Migration `migrateV8toV9`, strenge Prüfung in `sanitize`.

# Teil B – Konzerngründung und Industrie-Ausbau

## B0. Kernentscheidungen auf einen Blick

| Thema | Entscheidung |
|---|---|
| Zweite Reset-Ebene | "Konzerngründung", Währung "Patente" |
| Freischaltung | `prestige.count >= N` mit **N = 100** Neugüssen (Begründung: Abschnitt B3.1) |
| Patente-Formel | `min( floor( sqrt(Gussformen_im_Konzernlauf / D) × (1 + 0,1 × Stufe "Lizenzgebühren") ), floor(0,68 × Stunden seit der letzten Gründung) )`, konkav (Wurzel) und gedeckelt, **D = 1500** |
| Zurückgesetzt / bleibt | Gussformen, Hochofen-Shop, Neuguss-Chronik und alles, was ein Neuguss zurücksetzt, **gehen**; Zeitalter, Erfolge, Statistik, Neuguss-Zähler, Patente, Konzernforschung **bleiben** |
| Neue Materialien | 7 (Kobalt, Molybdän, Hartmetall, Platin, Vanadium, Iridium, Superlegierung), 7 Generatoren, 4 Rezepte |
| Neue Forschung | 49 (alle Konzernforschung), Boosts +12, Klick-Upgrades +4 |
| Industrie | Zeitalter 6 bis 8 (8e26 / 8e27 / 8e28), Ausbau VI bis VIII, zwei Meilenstein-Leisten (Fördermenge 8 Stufen, Materialvielfalt 7 Stufen) |
| Gesamtzeitplan (Bot `rate`, aktiv, **gemessen**) | Konzern-Reiter 13,4 h, 1. Konzerngründung 34 h, letztes Material (Superlegierung) 527 h, **alles frei 602,3 h** (Korridor 504 bis 700 h); schnellste gefundene Spielweise 538,4 h (>= 504 h) |
| Neuer Gesamtumfang | 125 Forschungen (49 Konzern), 43 Boosts, 10 Klick-Upgrades, 21 Generatoren, 19 Materialien, 10 Rezepte, 9 Zeitalter |

## B1. Idle-Kreislauf-Analyse

### B1.1 Ist-Zustand
Der Kreislauf "produzieren, kaufen, Neuguss, stärker neu beginnen" ist vorhanden: Generatoren mit 10er-Meilensteinen (×2), Forschung/Boosts mit Timern, Hochofen-Neuguss (Gussformen, Shop, 6 Meilensteine), Zeitalter, Erfolge, goldene Events, Auto-Buyer. Was ein klassisches Inkrement-Spiel (Revolution Idle, Antimatter Dimensions) zusätzlich trägt und hier fehlt:

| Lücke | Wirkung auf das Spielgefühl | Maßnahme |
|---|---|---|
| Es gibt keine einzelne Anzeige "was ist mein nächstes Ziel und wie weit bin ich?" (Zeitalter-Balken nur in der Seitenleiste, ab dem 1. Neuguss) | Spieler weiß nicht, wofür er gerade wartet | M1 Zielleiste |
| Die Neuguss-Entscheidung "jetzt oder später" ist blind (kein Gewinn/h, kein Meilenstein-Hinweis) | Neuguss wird zu früh oder zu spät gemacht | M2 Neuguss-Vorschau |
| Bei ca. 8,6 Neugüssen/h (Sim) ist manuelles Gießen über Wochen mühsam; es gibt nur Auto-Buyer, keinen Auto-Neuguss | Spielfluss bricht, Offline-Zeit wird nicht ausgenutzt | M3 Auto-Neuguss (Patente-Shop) |
| Vor dem 1. Neuguss (ca. 1,8 h) gibt es kein sichtbares Systemziel (siehe A8) | Frühe Ziel-Lücke | M4 Gesperrte Reiter + Fortschritt zum 1. Neuguss |
| Lange Ziele jenseits Stunde 35 fehlen: der letzte Hochofen-Meilenstein (250.000) fällt bei ca. 34,5 h, Zeitalter 5 bei ca. 192 h, danach kommt nichts mehr | Kein Langzeitziel, keine zweite Ebene | Konzerngründung (Abschnitt B3), Zeitalter 6 bis 8, Meilenstein-Leisten (Abschnitt B2) |
| Offline-Ertrag ist 1:1 und auf 8 h (+2 h je Stufe) gedeckelt; bei 600 h Zielzeit wird er zur Hauptzeit | Offline lohnt sich zu wenig | M5 Offline-Ausbau (nur Cap, kein Mehrertrag) |
| Meilensteine existieren nur auf Generatorstufe und Gussformen; keine auf Gesamtleistung | Wenig "Pling" für Gesamtfortschritt | M6 Industrie-Meilensteine (Abschnitt B2.3) |
| Generator-Meilensteine alle 10 Stufen sind nicht sichtbar auf den Karten | Kleine Ziele fehlen | M7 Hinweis "noch n Stufen bis ×2" |

### B1.2 Maßnahmen (klein, passend zum Konzept)

| Nr | Maßnahme | Inhalt | Umsetzung |
|---|---|---|---|
| M1 | **Zielleiste** ("Nächstes Ziel") | Eine Zeile oben im Werk: das nächstliegende Ziel aus der Liste (a) 1. Neuguss, (b) nächster Gussformen-Meilenstein, (c) nächstes Zeitalter, (d) nächste Industrie-Meilenstein-Stufe, (e) nächste Konzernstufe; je Ziel Fortschrittsbalken (logarithmisch bei Erz) und, falls die Rate bekannt ist, geschätzte Restzeit. | Neue reine Funktion `nextGoals()` in `js/core/goals.js` (liest nur `state`, nutzt `eraProgress`, `prestigeGain`, `oreForGain`, neue Corp-/Industry-Helfer) |
| M2 | **Neuguss-Vorschau** | Im Hochofen-Bereich: Gewinn jetzt, Gewinn/h (Gewinn / Laufzeit), nächster Gussformen-Meilenstein ("noch X"), Hinweis "lohnt sich" (Gewinnzuwachs der letzten 2 min unter dem Durchlauf-Schnitt, dieselbe Regel wie die Sim-Policy `rate`). | `state.stats.runTime`, `prestige.history`; kleine Hilfsfunktion in `formulas.js` |
| M3 | **Auto-Neuguss** | Freischaltung im Konzern-Shop (`c_autocast`). Einstellung `modus: Gewinn` (Neuguss ab Gewinn >= Wert, Vorgabe = Mittel der letzten 5 Gewinne) oder `modus: Zeit` (Neuguss nach n Minuten). Mindestlaufzeit 60 s. Es gibt **keinen** Auto-Konzern (Konzerngründung bleibt immer manuell). | `state.autoCast`, Tick in `main.js`/`systems/prestige.js` |
| M4 | **Früher Systemhinweis** | Industrie-Reiter ab Spielbeginn sichtbar, aber gesperrt ("Ab dem ersten Neuguss"), dazu Fortschritt zu 1e7 Erz. Konzern-Reiter ab Neuguss 25 gesperrt sichtbar, Freischaltung bei 100. | UI |
| M5 | **Offline-Ausbau** | Konzern-Shop "Nachtschicht II": +4 h Offline-Cap je Stufe (max 3). Ertrag bleibt 100 %. Der Willkommen-zurück-Toast zeigt zusätzlich "Cap erreicht in ..." beim Laden. | `offlineCapSeconds` + 4 h × Stufe |
| M6 | **Industrie-Meilensteine** | Zwei automatische Leisten (Abschnitt B2.3), Toast bei Erreichen, ein Panel im Industrie-Tab. | `systems/industry.js` (Muster `systems/eras.js`) |
| M7 | **Generator-Meilenstein-Hinweis** | Auf der Generatorkarte: "noch n Stufen bis ×2". Nur Anzeige, `MILESTONE_STEP` ist 10. | UI |

Bewusst nicht aufgenommen: Soft-Caps, Challenges, Ressourcen-Verfall, zusätzliche Klick-Minispiele. Sie passen nicht zum bestehenden Konzept und würden den Umfang sprengen.

## B2. Industrie-Ausbau

### B2.1 Zeitalter 6 bis 8
Weiterhin abgeleitet aus `stats.total.ore`, kumulativer Bonus, wirksam ab dem 1. Neuguss. Die Schwellen sind kalibriert (B6.3); die Zeiten sind gemessen.

| Zeitalter | Name | Schwelle (Erz, kalibriert) | Bonus | Zeit (Bot, gemessen) | Freischaltung |
|---|---|---|---|---|---|
| 6 | Atomzeitalter (`atomic`, Symbol `atom`) | 8e26 | ×1,5 | 258 h | Ausbau VI, Konzernforschung "Iridium-Abscheidung" und "Orbitalfertigung" |
| 7 | Raumfahrt (`space`, Symbol `rocket`) | 8e27 | ×1,5 | 344 h | Ausbau VII, Konzernforschung "Superlegierungs-Guss" |
| 8 | Kosmische Schmiede (`cosmic`, Symbol `star`) | 8e28 | ×2,0 | 462 h | Ausbau VIII, Konzernforschung "Weltkonzern-Charta" |

Kumulativer Zeitalter-Bonus nach Zeitalter 8: 7,02 (bisher) × 1,5 × 1,5 × 2 = 31,6.

### B2.2 Generator-Ausbau VI bis VIII
`EVO_MAX` 5 auf 8. Gleiche Regeln wie bisher: Stufe k braucht Zeitalter >= k und Generatorstufe >= `EVO_AT[k-1]`, Kosten = `unitCost('gen', id, EVO_AT[k-1]) × EVO_COST[k-1]`, Reset beim Neuguss.

| Stufe | Zeitalter | Stufe des Generators | Multiplikator | Kosten-Faktor |
|---|---|---|---|---|
| 6 | 6 | 300 | ×2 | ×2.000 |
| 7 | 7 | 325 | ×2 | ×3.000 |
| 8 | 8 | 345 | ×3 | ×4.000 |

- Kumulativer Multiplikator aller 8 Stufen: ×27 × 12 = ×324.
- Die Generatorstufen sind so gewählt, dass die billigen Generatoren (Wachstum 1,15 bis 1,17: Eisenmine, Bohrturm, Schmelzofen, Zeche) die Stufen zu ca. 1 bis 15 % der Zeitalter-Schwelle erreichen (Beispiel Eisenmine: Stufe 300 kostet 15 × 1,15^300 × 2.000 = 4,8e22 Erz bei Zeitalter 6 mit 8e26). Teure Generatoren (Wachstum >= 1,25) erreichen sie praktisch nie; das ist gewollt: Ausbau VI bis VIII ist **offen** und zählt **nicht** zu "alles freigeschaltet" (siehe B6.5).
- Daten: `EVO_AT = [10,25,50,100,200,300,325,345]`, `EVO_MULT = [1.5,1.5,2,2,3,2,2,3]`, `EVO_COST = [25,60,150,400,1000,2000,3000,4000]`. Der Auto-Buyer "Generatoren" kauft die neuen Stufen mit (bestehende Logik, keine Änderung).

### B2.3 Industrie-Meilensteine (neue Meilenstein-Ebene)
Zwei Leisten, automatisch, kostenlos, global multiplikativ auf alle Ausgaben (neuer Faktor `industryMult()` in `globalMult`). Kein Eintrag im Spielstand nötig: Der Wert wird aus `stats.total` abgeleitet (bleibt über Neuguss und Konzerngründung erhalten). Toast in Gold bei Erreichen (Merker wie in `systems/eras.js`).

**Leiste A "Fördermenge"** (Wert = `stats.total.ore`, kumuliertes Erz):

| Stufe | Schwelle (kalibriert) | Bonus | Kosten | Freischaltung | Zeit (Bot) |
|---|---|---|---|---|---|
| A1 | 1e12 | ×1,05 | – | – | ca. 2,5 h (Modell) |
| A2 | 1e15 | ×1,05 | – | – | ca. 5 h (Modell) |
| A3 | 1e18 | ×1,05 | – | – | ca. 20 h (Modell) |
| A4 | 1e21 | ×1,10 | – | – | ca. 70 h (Modell) |
| A5 | 2e25 | ×1,20 | – | Titel "Montan-Imperium" (Erfolg `industry_a5`) | 176 h |
| A6 | 5e27 | ×1,25 | – | – | 371 h |
| A7 | 5e28 | ×1,35 | – | – | 474 h |
| A8 | 1e30 | ×1,50 | – | Erfolg "Erzgott" (letzte Leiste A) | 539 h |

Produkt: 2,04. Die Zeiten von A1 bis A4 sind Modellwerte, nicht gemessen.

**Leiste B "Materialvielfalt"** (Wert = Anzahl der Ressourcen `k` mit `stats.total[k] > 0`; derzeit 12 mögliche, nach Ausbau 19):

| Stufe | Schwelle | Bonus | Kosten | Freischaltung | Zeit (Bot, Modell) |
|---|---|---|---|---|---|
| B1 | 6 | ×1,05 | – | – | ca. 1 h |
| B2 | 9 | ×1,05 | – | – | ca. 2 h |
| B3 | 12 | ×1,10 | – | – (alle Materialien des Grundspiels) | ca. 3 h |
| B4 | 14 | ×1,15 | – | – (Kobalt, Molybdän) | ca. 43 h |
| B5 | 16 | ×1,20 | – | – (Hartmetall, Platin) | ca. 160 h |
| B6 | 18 | ×1,25 | – | – (Vanadium, Iridium) | ca. 320 h |
| B7 | 19 | ×1,35 | – | Erfolg "Alle Materialien" | ca. 440 h |

Produkt aller Stufen: ca. ×10,9. Die späten Stufen sind bewusst stark, damit die Leisten wahrnehmbar bleiben (sonst höchstens ca. 4 % des Gesamtmultiplikators, logarithmisch gemessen).

Begründung gegen die bestehenden Boni: Zeitalter ×31,6 und Hochofen-Meilensteine ×562 sind große, seltene Sprünge; die Leisten liefern viele kleine Schritte (14 Stufen), also das "Pling"-Gefühl in den langen Phasen zwischen den Zeitaltern (z. B. A5 bis A7 liegen gemessen bei 177 h bis 470 h).

## B3. Zweite Reset-Ebene: Konzerngründung

### B3.1 Freischaltung
- Sichtbar/aktiv ab `state.prestige.count >= N`, **N = 100** (Neuguss-Zähler, bleibt über die Konzerngründung erhalten, sonst wäre die Bedingung nach jedem Konzern erneut zu erfüllen).
- Begründung N = 100 (Sim-Werte aus A3b und dem 200-h-Lauf: Neuguss 40 bei 6,5 h, 280 bei 34,5 h, ca. 8,6 Neugüsse/h dazwischen): Neuguss 100 liegt bei ca. 13,5 h, nach Zeitalter 1 (7,5 h) und weit vor Zeitalter 2 (37,9 h). Der Spieler hat die Hochofen-Schleife verstanden (6 Meilensteine erreichen 5 bis 10.000 Gussformen bis 4,3 h), das Wissensarchiv ist längst gekauft, aber der Langzeitmeilenstein 250.000 (34,5 h) ist noch offen und gibt für die nächsten 20 h ein Ziel. N = 25 (ca. 5,3 h) wäre noch vor Zeitalter 1: zu früh, zwei Reset-Ebenen konkurrierten um dieselbe Aufmerksamkeit. N = 250 (ca. 31 h) wäre erst mit dem letzten Hochofen-Meilenstein fällig und ließe 20 h bis zur ersten Konzerngründung leer. Zudem existiert bereits ein Erfolg für 100 Neugüsse (`prestige_100`), der als Auslöser-Toast taugt.
- Zwischen Neuguss 100 und der ersten Konzerngründung zeigt der Konzern-Reiter eine **Vorschau** (Patente-Gewinn aktuell, nötige Gussformen für die erste Patente, Liste der Belohnungen). Die erste Patente gibt es ab `Gussformen >= D` (kalibriert 1500, Wurzelformel; im Code `corpThreshold` über `corpGainParts().raw`). Die erste Konzerngründung des Bots liegt gemessen bei 34 h und erreicht K1 (10 Patente).

### B3.2 Gewinnformel (konkav und gedeckelt)
```
Gc            = state.prestige.total              // Gussformen seit der letzten Konzerngründung (wird dort auf 0 gesetzt)
raw           = floor( sqrt(Gc / D_CORP) × (1 + 0,1 × Stufe c_gain) )
cap           = floor( CAP_PRO_STUNDE × Stunden seit der letzten Gründung )   // stats.corpRunTime, zählt Offline-Zeit mit
corpGain      = min(raw, cap)
D_CORP        = 1500                               // CORP.divisor
CAP_PRO_STUNDE = 0,68                              // CORP.capPerHour
```
Im Code: `corpGainParts(gc, sec)` in `js/core/formulas.js` liefert `{ raw, cap, capped, gain }`, `corpGain` ist `gain`.

- **Warum konkav und gedeckelt:** Eine lineare Formel (`floor(Gc / 52.000)`) hätte die Patente-Summe nur an die Gussformen gebunden, nicht an die Spielzeit. Schnelle Spielweisen (frühe Boosts, kurze Güsse, häufiges Gründen) hätten ALLES schon nach 319 bis 370 h freigeschaltet. Die Wurzel bremst große Gussformen-Mengen je Lauf; der Zeitdeckel setzt eine harte Untergrenze: Die Shop-Summe von 351 Patenten braucht mindestens 351 / 0,68 = 516 h, egal wie gespielt wird (Ziel: schnellste Spielweise >= 504 h).
- **Deckel zählt Offline-Zeit mit:** `stats.corpRunTime` wächst auch offline (`save.js`). Der Deckel ist deshalb nicht umgehbar und Offline-Spiel ist in Wandzeit nie schneller als Online-Spiel.
- **Folge für das Spielverhalten:** Sehr seltene Gründungen werden bestraft (Bot mit 80 h Takt: 762,2 h, nur Info), sehr häufige bringen wenig, weil der Deckel bindet. Der Konzern-Reiter erklärt Wurzel und Deckel dem Spieler.
- Die frühere Aussage "`Patente_gesamt(t) <= Gussformen_gesamt(t) / D`" gilt nicht mehr. Stattdessen gilt `Patente_gesamt(t) <= CAP_PRO_STUNDE × Zeit seit Beginn` (Summe der Deckel, nur die Laufzeiten zählen).
- Mindestgewinn: Konzerngründung nur bei `corpGain >= 1`. Bestätigungsdialog zeigt Gewinn, die Liste "geht/bleibt" und die neue Konzernstufe.
- Auswirkung auf die Wirtschaft: Patente erhöhen die Produktion (B3.4), schalten Konzernforschung frei (Abschnitt B5) und werden im Konzern-Shop ausgegeben (B3.5).

### B3.3 Was zurückgesetzt wird, was bleibt

| Zurückgesetzt bei Konzerngründung | Bleibt |
|---|---|
| Alles, was ein Neuguss zurücksetzt: Ressourcen, Generatoren, Klick-Upgrades, Ausbauten (`evo`), Boosts, Buffs, normale Forschung (auch mit Wissensarchiv), Werkbank- und Labor-Warteschlange | Zeitalter (hängen an `stats.total.ore`), Industrie-Meilensteine, Erfolge, Statistik (`stats.total`, `playTime`, Klicks), Einstellungen |
| `prestige.points`, `prestige.total`, `prestige.history` (also auch alle Hochofen-Meilensteine) | `prestige.count` (Neuguss-Zähler, Erfolge und Freischaltung hängen daran) |
| `prestige.shop` (alle Hochofen-Shop-Stufen inkl. Wissensarchiv, Auto-Buyer-Freischaltungen, Zusatzplätze, Zeitraffer, Erzvorrat, Nachtschicht) | `corp.*` (Patente, Konzern-Shop, Konzernzähler), `autobuyers`-Schalter (an/aus, wirken nur bei freigeschaltetem Auto-Buyer), `autoCast` |
| Laufende Laborforschung (auch mit Wissensarchiv) | **Konzernforschung** (alle Forschungen mit Feld `corp`; sie bleibt auch bei jedem Neuguss erhalten) |

Begründung: Der Wiederaufbau nach der Konzerngründung (Bot ca. 3 h) ist der Preis; er sinkt durch den Konzern-Shop ("Hochofen-Erbe", "Konzernarchiv", "Konzern-Automatisierung") und durch Zeitalter-Bonus ×7 plus Patente-Bonus. Die Konzernforschung bleibt, weil ihre Freischaltung bewusst viele Stunden dauert (Dauer bis 4 h je Auftrag) und sie sonst bei jedem Konzern erneut abgesessen werden müsste, was den Zeitplan unkontrollierbar mit der Spielweise koppeln würde. Die zugehörigen Generatoren, Rezepte und Materialien erscheinen sofort wieder, sobald die Ressourcen reichen.

### B3.4 Wirkung der Patente
```
corpMult = (1 + 0,02 × Patente_gesamt × (1 + 0,2 × Stufe c_eff))  ×  Π (Konzern-Meilensteine)
```
Geht als weiterer Faktor in `globalMult()` ein. Patente_gesamt = `corp.total` (verdient, nicht ausgegeben). Bei 200 Patenten: ×5 (ohne `c_eff`), mit `c_eff` 4: ×8,2.

**Konzern-Meilensteine** (auf `corp.total`, analog zu `MILESTONES`; "Stufe" = Konzernstufe K):

| Stufe K | Schwelle (Patente gesamt, kalibriert) | Bonus | Freischaltung | Zeit (Bot, gemessen) |
|---|---|---|---|---|
| K1 | 10 | ×1,1 | Konzernforschung I: Kobalt, Molybdän; Konzern-Shop komplett sichtbar | 34 h |
| K2 | 30 | ×1,1 | Konzernforschung II: Hartmetall, Werkzeug | 114 h |
| K3 | 70 | ×1,15 | Konzernforschung III: Platin, Edelmetall-Netzwerk | 194 h |
| K4 | 135 | ×1,15 | Konzernforschung IV: Vanadium, Laborautomatisierung II | 274 h |
| K5 | 210 | ×1,2 | Konzernforschung V: Iridium (zusätzlich Zeitalter 6), Quantenfertigung | 394 h |
| K6 | 290 | ×1,2 | Konzernforschung VI: Superlegierung (zusätzlich Zeitalter 7), Orbitalfertigung | 514 h |
| K7 | 351 | ×1,5 | Konzernforschung VII: Weltkonzern-Charta (zusätzlich Zeitalter 8) | 594 h |

Die Schwellen K1 bis K7 sind 10 / 30 / 70 / 135 / 210 / 290 / 351 Patente; K7 entspricht der Shop-Summe (351 Patente). Die Zuordnung der Konzernforschung zu den K-Stufen steht in B5.3.

Produkt aller Stufen: 3,45 (bis K6: 2,30). Bei Patente_gesamt = 351 (ohne `c_eff`) zusätzlich der lineare Teil 1 + 0,02 × 351 = 8,02.

### B3.5 Konzern-Shop (Patente)
Gleiches Datenformat wie `SHOP` (`cost × growth^Stufe`, abgerundet/`ceil` wie `shopCost`), eigenes Objekt `CORP_SHOP` in `js/data/corp.js`.

| id | Name | Wirkung | Kosten je Stufe | Wachstum | Max | Summe |
|---|---|---|---|---|---|---|
| `c_eff` | Aktienmehrheit | +20 % Wirkung der Patente je Stufe | 6, 8, 12, 18 | ×1,5 | 4 | 44 |
| `c_gain` | Lizenzgebühren | +10 % Patente je Konzerngründung je Stufe (wirkt auf die Wurzel, nicht auf den Deckel) | 4, 6, 8, 12 | ×1,5 | 4 | 30 |
| `c_cast` | Gussformen-Fabrik | +15 % Gussformen je Neuguss je Stufe (multiplikativ zu `pp_gain`) | 7, 11, 16, 24 | ×1,5 | 4 | 58 |
| `c_heir` | Hochofen-Erbe | Der Gussformen-Stand für Multiplikator und Meilensteine beginnt jeden Konzernlauf bei mindestens 5 / 150 / 1.000 / 10.000 / 250.000 (Stufe 1 bis 5); `prestige.total` bleibt unverändert, zählt also nicht für Patente | 3, 7, 12, 20, 34 (feste Liste) | – | 5 | 76 |
| `c_archive` | Konzernarchiv | Normale Forschung bleibt beim **Neuguss** erhalten (ersetzt das durch die Konzerngründung verlorene Wissensarchiv) | 11 | – | 1 | 11 |
| `c_auto` | Konzern-Automatisierung | Je Stufe ein Auto-Buyer dauerhaft freigeschaltet (Reihenfolge Generatoren, Spitzhacke, Forschung, Boosts) | 7, 9, 12, 15 | ×1,3 | 4 | 43 |
| `c_offline` | Nachtschicht II | +4 h maximaler Offline-Ertrag je Stufe | 6, 11, 21 | ×2 | 3 | 38 |
| `c_autocast` | Auto-Neuguss | Schaltet den automatischen Neuguss frei (M3) | 18 | – | 1 | 18 |
| `c_click` | Konzern-Schmiedehand | +50 % Klickwert je Stufe | 4, 6, 9, 14 | ×1,6 | 4 | 33 |
| | | | | | **Summe** | **351** |

- Die Summe 351 ist bewusst gleich der Schwelle K7 (351): Der Konzern-Shop ist erst vollständig, wenn die letzte Konzernstufe erreicht ist (Bot gemessen 594 h). Sie bestimmt zusammen mit dem Deckel die Untergrenze 351 / 0,68 = 516 h.
- Dezimalwerte in `js/data/corp.js` (z. B. `c_eff` 5,115) werden in `corpCost` mit `ceil` gerundet. Die Liste oben ist aus dem Code berechnet.
- `c_heir` Stufe 5 (250.000) stellt den größten Hochofen-Multiplikator (×562 in Meilensteinen) wieder her; die Stufe wird deshalb zuletzt gekauft.
- Technisch: `prestigeMult(total = Math.max(state.prestige.total, heirFloor()))`; `heirFloor()` = `[0,5,150,1000,10000,250000][Stufe c_heir]`.
- Reihenfolge des Bots (Sim): `c_archive`, `c_heir` 1, `c_gain` 1, `c_cast` 1, `c_auto` 1, `c_eff` 1, `c_heir` 2, `c_gain` 2 ... (Wachstum von Patenten und Gussformen zuerst, Komfort danach); `c_heir` 5 und die letzten `c_offline` zuletzt.

### B3.6 Bezug zum Hochofen
Der Hochofen-Neuguss bleibt die Quelle der Gussformen und damit die Basis der Patente (`Gc` = Gussformen im Konzernlauf). Eine Konzerngründung entwertet sie vollständig, der Konzern-Shop stellt gezielt Teile wieder her (Erbe, Archiv, Auto-Buyer). `c_cast` und `c_gain` verbinden beide Ebenen. Neuguss und Konzern haben eigene Bestätigungsdialoge; der Hochofen-Dialog bleibt unverändert.

## B4. Neue Materialien (Kette auf Gold und Wolfram)

Sieben neue Ressourcen, jede mit eigenem Generator, sichtbar erst nach der Freischalt-Forschung oder bei vorhandenem Vorrat (`resVisible`). Kette:

```
Wolfram + Kobalt ──(6:2 → 1)──► Hartmetall
Nickel + Gold ──(10:1 → 1)──► Platin
Platin + Molybdän ──(10:4 → 1)──► Iridium
Hartmetall + Iridium + Vanadium ──(6:1:3 → 1)──► Superlegierung
```

### B4.1 Ressourcen

| id | Name | Farbe | Icon (Fallback) | Sichtbar durch | Zeit (Bot) | Konzernstufe | Zeitalter |
|---|---|---|---|---|---|---|---|
| `cobalt` | Kobalt | #60a5fa | 🔵 | `c_cobalt` | 52 h (nicht neu gemessen) | K1 | – |
| `molybdenum` | Molybdän | #94a3b8 | ⚙️ | `c_moly` | ca. 43 h (Modell) | K1 | – |
| `carbide` | Hartmetall | #cbd5e1 | 🔶 | `c_sinter` | 118 h (gemessen) | K2 | – |
| `platinum` | Platin | #e2e8f0 | ⚪ | `c_platin` | 202 h (gemessen) | K3 | – |
| `vanadium` | Vanadium | #34d399 | 🟢 | `c_vanadium` | 290 h (gemessen) | K4 | – |
| `iridium` | Iridium | #fb7185 | 💠 | `c_iridium` | 408 h (gemessen) | K5 | 6 |
| `superalloy` | Superlegierung | #22d3ee | 🔷 | `c_super` | 527 h (gemessen) | K6 | 7 |

Kobalt hat #60a5fa statt des Entwurfswerts #3b82f6 (Kontrast). Farben sind gegen die vorhandenen Material- und Flüssigkeitsfarben (`#475569`, `#78716c`, `#ea8a52`, `#a78bfa`, `#5eead4`, `#a3e635`, `#38bdf8`, `#f472b6`, `#fbbf24`) abgegrenzt. Icons/Sprites sind SVG (`assets/sprites/items.svg`, Symbol `sym-<id>`).

### B4.2 Generatoren

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

### B4.3 Rezepte (am Ende von `RECIPES`, in dieser Reihenfolge)

| id | Name | Anteil | Eingang | Ausgang | Freigabe |
|---|---|---|---|---|---|
| `sinter` | Hartmetall-Sinterung | 30 % | 6 Wolfram + 2 Kobalt | 1 Hartmetall | `c_sinter` |
| `platinref` | Platin-Raffination | 30 % | 10 Nickel + 1 Gold | 1 Platin | `c_platin` |
| `iridsep` | Iridium-Abscheidung | 25 % | 10 Platin + 4 Molybdän | 1 Iridium | `c_iridium` |
| `supercast` | Superlegierungs-Guss | 40 % | 6 Hartmetall + 1 Iridium + 3 Vanadium | 1 Superlegierung | `c_super` |

Die Reihenfolge stellt sicher, dass spätere Rezepte die Ausgänge früherer sehen (`goldsmelt` steht davor, `sinter` sieht das Wolfram-Netto nach der Goldschmelze; kein Rezept verbraucht mehr als produziert wird, daher keine negativen Raten).

### B4.4 Erreichbarkeit der Kette (Fixpunkt)
Keine Zyklen: Jede Freischalt-Forschung kostet nur Vormaterialien (Abschnitt B5.2), jeder Generator nur Vormaterialien oder Material aus derselben Stufe plus Titan (Kobalt: Wolfram, Legierung, Titan; Molybdän: Kobalt, Legierung, Titan; Hartmetall: Wolfram, Kobalt, Molybdän; Platin: Gold, Hartmetall; Vanadium: Molybdän, Hartmetall; Iridium: Platin, Molybdän, Gold; Superlegierung: Iridium, Vanadium, Hartmetall). Reihenfolge der Abhängigkeiten: Kobalt, Molybdän, Hartmetall, (Platin, Vanadium), Iridium, Superlegierung.

## B5. Neue Forschung, Boosts und Klick-Upgrades

### B5.1 Neue Felder und Regeln
- Forschung/Boost/Klick-Upgrade erhalten das optionale Feld `corp: k` (Mindest-Konzernstufe, 1 bis 7), neben `era`. `lockReason` liefert "Benötigt Konzernstufe: K{k}" (Reihenfolge der Prüfungen: Voraussetzungen, Zeitalter, Konzernstufe, Queue).
- Alle 49 neuen Forschungen tragen `corp` und sind **permanent** (B3.3). Boosts und Klick-Upgrades bleiben normal (Reset beim Neuguss).
- Neue Wirkungs-Schlüssel in `mult`: alle Ressourcen-IDs der neuen Materialien (sonst unverändert). Neuer Sondereffekt `timeMult2` (Forschung `c_lab2`): zusätzlicher Faktor ×0,85 in `timeMult()`.

### B5.2 Kosten- und Dauerformeln (per Skript erzeugbar)
Die Kosten werden wie bei den Zeitalter-Forschungen aus Sim-Raten abgeleitet (A3b: "Kostenkalibrierung"); die Tabelle wird per Skript aus `simulate().runRates` für den Zeitpunkt `t_k` der Konzernstufe k:

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

### B5.3 Die 49 Konzernforschungen
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

Die Tabelle oben nennt 36 Einträge (7 U + 7 A + 7 B + 7 P + 8 S). Dazu kommen 13 weitere Konzernforschungen, zusammen 49 Konzernforschungen und 125 Forschungen insgesamt (76 Grundspiel + 49):

| id | Name | K | Zeitalter | Wirkung |
|---|---|---|---|---|
| `c_carbide_c` | Sinteroptimierung III | 4 | – | +15 % Hartmetallproduktion |
| `c_cobalt_c` | Kobalt-Verbundanlage | 4 | – | +20 % Kobalt und Molybdän |
| `c_night` | Konzern-Schichtbetrieb | 4 | – | Maximaler Offline-Ertrag +2 h (`NIGHT_HOURS`, `js/data/timers.js`) |
| `c_platin_c` | Platin-Raffination III | 5 | – | +15 % Platin |
| `c_lab3` | Laborautomatisierung III | 5 | 6 | Forschungs- und Werkbank-Zeiten weitere 10 % kürzer (`LAB3_MULT`) |
| `c_atomic` | Atomlagen-Abscheidung | 5 | 6 | +10 % aller Materialien |
| `c_vanadium_c` | Vanadium-Aufschluss III | 6 | – | +15 % Vanadium |
| `c_iridium_c` | Iridium-Reinigung III | 6 | – | +15 % Iridium |
| `c_asteroid` | Asteroidenbergbau | 6 | 7 | +50 % Erz |
| `c_drones` | Prospektor-Drohnen | 6 | 7 | Klickwert ×2, Autoklick-Ertrag ×1,5; schaltet die Asteroiden-Spitzhacke frei |
| `c_super_c` | Superlegierungs-Veredelung III | 7 | – | +15 % Superlegierung |
| `c_proc_8` | Konzernprozess VIII | 7 | – | +5 % aller Materialien |
| `c_cosmic` | Kosmische Schmiede | 7 | 8 | +25 % aller Materialien; **letzte Forschung des Spiels** |

Die Weltkonzern-Charta (`c_charta`) ist damit nicht mehr die letzte Forschung; `c_cosmic` verlangt `c_charta`, `c_super_c` und `c_proc_8`. Die Spalte K gibt `corp` im Code an (geprüft gegen `js/data/research.js`).

Multiplikatoren-Budget bei ca. 560 h: Konzernprozess ×1,34 (bis VI), `c_patent` ×1,08, `c_quantum` ×1,2, `c_orbital` (Erz/Stahl) ×1,3 → ca. ×2,3 auf Erz, davor die `c_charta` ×1,5 als End-Belohnung.

### B5.4 Neue Boosts (Werkbank, einmalig, Reset beim Neuguss)
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

Insgesamt 43 Boosts (39 in der Tabelle oben, dazu 4 weitere):

| id | Name | K | Zeitalter | Freigabe | Wirkung |
|---|---|---|---|---|---|
| `cb_moly` | Molybdän-Stahlveredelung | 4 | – | `c_moly_b` | Molybdän ×2, Hartmetall ×1,5 |
| `cb_redox` | Vanadium-Redox-Speicher | 5 | – | `c_vanadium_b` | Vanadium ×2, alle Materialien ×1,1 |
| `cb_atomic` | Atomlagen-Beschichtung | 5 | 6 | `c_atomic` | Platin ×2, Iridium ×1,5 |
| `cb_cosmic` | Kosmischer Hochofen | 7 | 8 | `c_super_c` | Superlegierung ×2, alle Materialien ×1,2 |

Globale Boosts der Tabelle oben: ×1,1 · ×1,15 · ×1,25 = ×1,58 (im Budget); die neuen `cb_redox` (×1,1) und `cb_cosmic` (×1,2) kommen darauf.

### B5.5 Neue Klick-Upgrades (Werkbank, wiederholbar)
Format wie `CLICKS` (`costs`, `time`, `perLevel`, `base 0`); Zeit `base 600 s, growth 1,15, max 2400 s`; Kostenwachstum 1,6 bis 1,7 (Stahl) und 1,5 bis 1,55 (Material).

| id | Name | K | Zeitalter | Freigabe | Klickwert je Stufe | Kosten (Stufe 1) |
|---|---|---|---|---|---|---|
| `carbidechisel` | Hartmetall-Meißel | 2 | – | Werkzeugtechnik | +3e11 | Stahl 1e22 (×1,7), Hartmetall 0,3 × Rate_ref × 1800 (×1,5) |
| `iridiumram` | Iridium-Ramme | 5 | 6 | Iridium-Abscheidung | +5e14 | Stahl 3e24 (×1,7), Iridium wie oben (×1,55) |
| `superhammer` | Superlegierungs-Schlägel | 6 | 7 | Superlegierungs-Guss | +2e18 | Stahl 1e26 (×1,7), Superlegierung wie oben (×1,55) |

Insgesamt 10 Klick-Upgrades: 9 in der Tabelle oben, dazu `asteroidpick` (Asteroiden-Spitzhacke, K6, Zeitalter 7, Freigabe `c_drones`, +1e19 Klickwert je Stufe, Stahl 4e26 ×1,7 und Superlegierung 3e12 ×1,55) dazu. Klickwert-Vergleich zum Grundspiel: Plasmalanze +5e8 je Stufe, Hydraulikramme +2e5. Der Konzern-Shop-Eintrag `c_click` skaliert alle (+50 % je Stufe).

### B5.6 Erfolge (klein)
7 Erfolge "Produziere insgesamt X {Material}" (Schwellen 100 bis 1e6 je Material, additiver Bonus +0,01 bis 0,03 wie bestehende Materialerfolge), 3 für Konzerngründungen (1 / 5 / 15), 3 für Patente gesamt (50 / 100 / 200), 2 aus der Industrie (A5, B7). Gesamtbonus der neuen Erfolge höchstens +0,25, also weniger als die bestehende Erfolgsschicht.

## B6. Zeitplan und Kalibrierung

### B6.1 Ausgangsdaten (Sim, kalibrierter Aufruf `175/4/1/30/rate`, hier auf 200 h erweitert)
- Neugüsse: Nr. 1 bei 1,8 h, 40 bei 6,5 h, Nr. 280 bei 34,5 h (250.000 Gussformen), 1.698 in 200 h; Durchlauf ca. 7 min, ca. 800 Gussformen je Durchlauf bei 6,5 h, ca. 1.200 ab ca. 100 h.
- Gussformen kumuliert: 20.554 bei 5,8 h, 2,0 Mio. bei 200 h, das sind ca. 7.000 bis 10.000 je Stunde (stetig, nahezu linear).
- Zeitalter: 1 bei 7,5 h, 2 bei 37,9 h, 3 bei 96,5 h, 4 bei 127,6 h, 5 bei 192,1 h; kumuliertes Erz lokal ca. `T(t) = 3e23 × (t/192)^2,7`.
- Dauer des Sim-Laufs: 200 h bei dt 30 brauchen ca. 4 min Rechenzeit; der volle Lauf `node tools/balance-full.mjs` (ca. 600 h, dt 30) dauert ca. 13 min.

### B6.2 Patente und Konzernstufen (gemessen)
Zeitdeckel (B3.2): `Patente_gesamt(t) <= 0,68 × t` mit t = Zeit seit Spielbeginn. Die Shop-Summe 351 braucht daher mindestens 351 / 0,68 = 516 h. Das ist die rechnerische Untergrenze für jede Spielweise; der Wurzelteil (D = 1500) bremst zusätzlich, wenn der Deckel nicht bindet.

Gemessen im Lauf `node tools/balance-full.mjs` (Bot `rate`, Gründung alle 40 h, erste bei 34 h, D = 1500, Deckel 0,68):

| Konzernstufe | Patente gesamt | Zeit (Bot, gemessen) |
|---|---|---|
| K1 | 10 | 34 h |
| K2 | 30 | 114 h |
| K3 | 70 | 194 h |
| K4 | 135 | 274 h |
| K5 | 210 | 394 h |
| K6 | 290 | 514 h |
| K7, Konzern-Shop komplett | 351 | 594 h |

Die Gründungszeitpunkte folgen dem Bot-Rhythmus (erste Gründung bei 34 h, danach alle 40 h); die Stufen-Zeiten sind aus dem Lauf gemessen. Summen je Gründung sind nicht dokumentiert.

**Robustheit gegen schnelle Spielweisen (erfüllt):** Ziel ist, dass der Bot im Korridor 504 bis 700 h liegt und die schnellste Spielweise mindestens 504 h braucht. Gemessene Ergebnisse (`balance-full`, aktive Spielzeit bis ALLES; bei allen ist das letzte Tor der Konzern-Shop bzw. K7):

| Spielweise | ALLES |
|---|---|
| Bot `rate` (Gründung alle 40 h) | **602,3 h** |
| `workHold`, `minRun` 15 s, `hold` 7200 s, Gründung alle 17,7 h (schnellste gefundene) | **538,4 h** |
| dieselbe Spielweise, Takt 14,7 h | 552,0 h |
| dieselbe Spielweise, Takt 12,5 h | 557,5 h |
| Bot, Gründung nur alle 80 h (nur Info) | 762,2 h |

Der Deckel erklärt, warum schnellere Gründungstakte nichts mehr bringen: Bei Takt 12,5 h gibt der Deckel höchstens 8 bis 9 Patente je Gründung. Die rechnerische Untergrenze 516 h wird nicht unterschritten. Spreizung (Bot gegen schnellste Spielweise: 602,3 / 538,4) ca. 1,12; vor der Umstellung (lineare Formel, 52.000) lag sie bei 1,85.

### B6.3 Kumuliertes Erz (Zeitalter 6 bis 8, Industrie-Leiste A)
Das Start-Design modellierte `T(t) = 3e23 × (t/192)^2,7 × B(t)` mit einem Zusatzfaktor B(t) für Konzern- und Industrie-Inhalte. Dieses Modell traf die gemessene Erz-Kurve nicht. Maßgeblich sind die kalibrierten Schwellen und die gemessenen Zeitpunkte:

| Schwelle | Start-Design | Kalibriert | Zeit (Bot, gemessen) |
|---|---|---|---|
| Zeitalter 6 | 5e24 | 8e26 | 301 h |
| Zeitalter 7 | 8e25 | 8e27 | 386 h |
| Zeitalter 8 | 4e26 | 8e28 | 498 h |
| Fördermenge A5 | 1e24 | 2e25 | 177 h |
| Fördermenge A6 | 1e25 | 5e27 | 371 h |
| Fördermenge A7 | 1e26 | 5e28 | 474 h |
| Fördermenge A8 | 1e27 | 1e30 | 590 h |

Ein Durchlauf von 20 bis 60 min bringt ca. 1e5-mal so viel Erz wie ein 6-min-Zyklus. Die Erz-Tore sind deshalb gegen lange Durchläufe schwach.

### B6.4 ZEITPLAN-TABELLE (aktive Bot-Stunden, kalibrierter Bot `rate`)
Spalte "Quelle": GEM = gemessen im Lauf `node tools/balance-full.mjs` (Gründung alle 40 h) oder im Test `tests/balance.test.mjs` (ohne Konzern), SIM = gemessen im Grundspiel-Sim (A3b), MOD = Modellwert des Designs, nicht nachgemessen. "GEM (alt)" = früher gemessen, nicht neu gemessen.

| Zeit (h) | Ereignis | Gate | Quelle |
|---|---|---|---|
| 1,8 | 1. Neuguss, Hochofen-Meilensteine 5 und 25 | Erz 1e7 | SIM |
| 2,4 / 4,3 | 1.000 / 10.000 Gussformen (Meilensteine ×3, ×5) | Neuguss 5 / 21 | SIM |
| 2,5 bis 5 | Industrie A1, A2 (Erz 1e12, 1e15); B1 bis B3 (Materialvielfalt 6, 9, 12) | stats.total | MOD |
| 7,5 | Zeitalter 1 (Grundspiel) | Erz 1e17 | SIM |
| **13,4** | **Konzern-Reiter freigeschaltet** (Neuguss 100) | N = 100 | GEM |
| 20 | A3 (1e18) | | MOD |
| 34,5 | Hochofen-Meilenstein 250.000 (Neuguss 280) | Gussformen | SIM |
| **34** | **1. Konzerngründung, K1 (10 Patente)** | Wurzelformel, D = 1500, Bot-Rhythmus | GEM |
| 36 / 69 / 99 / 153 | Zeitalter 2 / 3 / 4 / 5 **ohne Konzern** (balance.test) | Erz 1e20 / 1e22 / 1e23 / 3e23 | GEM |
| 43 | Molybdän, B4 | K1 | MOD |
| 52 | Kobalt (Konzernforschung I), nicht neu gemessen | K1 | GEM (alt) |
| 55 / 106 / 114 / 114 | Zeitalter 2 / 3 / 4 / 5 **mit Konzern**, nicht neu gemessen | Erz | GEM (alt) |
| 70 | A4 (1e21) | | MOD |
| 114 | Gründung 3, K2 (30 Patente) | | GEM |
| 118 | Hartmetall (Konzernforschung II) | K2 | GEM |
| 176 | Fördermenge A5 (2e25) | Erz | GEM |
| 194 | K3 (70) | | GEM |
| 202 | Platin | K3 | GEM |
| 258 | **Zeitalter 6** (8e26) | Erz | GEM |
| 274 | K4 (135) | | GEM |
| 290 | Vanadium | K4 | GEM |
| 344 | **Zeitalter 7** (8e27) | Erz | GEM |
| 371 | A6 (5e27) | Erz | GEM |
| 394 | K5 (210) | | GEM |
| 408 | Iridium (braucht Zeitalter 6) | K5 + Z6 | GEM |
| 462 | **Zeitalter 8** (8e28) | Erz | GEM |
| 474 | A7 (5e28) | Erz | GEM |
| 514 | K6 (290) | | GEM |
| 527 | Superlegierung (braucht Zeitalter 7) | K6 + Z7 | GEM |
| 539 | **Fördermenge A8 (1e30)** | Erz | GEM |
| 594 | K7 (351 Patente), Konzern-Shop komplett | Patente (Deckel 0,68/h) | GEM |
| **602,3** | **ALLES FREIGESCHALTET** (letzter Erstkauf: Konzern-Shop bzw. K7) | | GEM |

**Gesamt: alle Inhalte (125 Forschungen, 43 Boosts, 10 Klick-Upgrades, 19 Materialien, beide Reset-Ebenen, alle Meilensteine) bei 602,3 h gemessen (Bot `rate`, Korridor 504 bis 700 h).** Die schnellste gefundene Spielweise braucht 538,4 h (B6.2). Ausbau VI bis VIII und weitere Klick-/Shop-Stufen nach Maximum sind offen und zählen nicht zu "alles". Die Erzkosten der Konzernforschung sind nach Konzernstufe skaliert (B5.2).

Die Zeitalter 2 bis 5 liegen mit Konzern später als ohne (55 / 106 / 114 / 114 h gegen 36 / 69 / 99 / 153 h); die Ursache ist hier nicht untersucht. Gegenüber dem Grundspiel (7,5 / 37,9 / 96,5 / 127,6 / 192 h) sind die Zeiten ohne Konzern durch die Industrie-Boni nach vorn verschoben.

### B6.5 Stellschrauben (kalibrierter Stand)

| Stellschraube | Start-Design | Kalibriert | Hinweis |
|---|---|---|---|
| `CORP.divisor` (`D_CORP`) | 34.000 (linear) | **1500** (Wurzelformel) | Stellgröße des Wurzelteils; D = 2250 ließ den Bot bei 842 h |
| `CORP.capPerHour` | – | **0,68** Patente je Stunde (zuerst 0,72) | Zeitdeckel; Untergrenze = Shop-Summe / 0,68 = 516 h. 0,72 ergab eine schnellste Spielweise von 494,9 h (< 504 h) |
| Konzern-Shop-Summe | 205 | **351** (Kosten ×1,705, Hebel 2) | Gleich K7 |
| Konzern-Meilensteine K1 bis K7 (Patente) | 5 / 20 / 45 / 75 / 110 / 150 / 205 | **10 / 30 / 70 / 135 / 210 / 290 / 351** | K7 = Shop-Summe |
| Zeitalter 6 bis 8 (Erz) | 5e24 / 8e25 / 4e26 | **8e26 / 8e27 / 8e28** | Bonus ×1,5 / ×1,5 / ×2 unverändert |
| Fördermenge A5 bis A8 (Erz) | 1e24 / 1e25 / 1e26 / 1e27 | **2e25 / 5e27 / 5e28 / 1e30** | A1 bis A4 unverändert |
| `c_gain` / `c_cast` je Stufe | 10 % / 15 % | unverändert | |
| Konzernforschungs-Kosten | Modellformel 5.2, gegenüber späten Raten billig | Faktor je Konzernstufe auf die Basiskosten: Erz/Stahl `CORP_COST_ORE` = 1 / 1 / 54 / 360 / 360 / 340 / 360, Materialien `CORP_COST_MAT` = 1 / 1 / 2 / 3 / 4 / 5 / 6 (je K1 bis K7, `js/data/research.js`) | Erz geeicht auf ca. 14 / 30 / 20 / 25 / 30 / 40 / 50 min Spitzen-Erzrate je K1 bis K7; K4 >= 1e25, K7 >= 1e28 Erz. Dauer 1800 s mal 1,4^(k-1) bleibt (Test: Dauer <= 22000 s) |
| Generator-Basen/Wachstum der 7 neuen Materialien (B4.2) | siehe B4.2 | unverändert | |
| Bonus-Größen (K-Bonus, Patent-Bonus 0,02, Prozess +5 %, Industrie) | siehe oben | unverändert | |
| N | 100 | 100 | nur Dramaturgie, nicht Zeitplan |
| Industrie-Stufen | A5 bis A8 1,10 / 1,10 / 1,15 / 1,15; B4 bis B7 1,10 / 1,15 / 1,15 / 1,25 | A5 bis A8 **1,20 / 1,25 / 1,35 / 1,50**; B4 bis B7 **1,15 / 1,20 / 1,25 / 1,35** | Produkt beider Leisten ca. ×4,9 -> ×10,9 |
| Bot-Einstellung | | Gründung alle 40 h (erste bei 34 h), Hold 3600 s, dt 30 | `tools/balance-full.mjs`; kein Auto-Neuguss, Boosts erst im Endspiel |

Neu kalibrieren: `node tools/balance-full.mjs` (Exitcode 0 im Korridor 504 bis 700 h), danach die Schranken in `tests/balance.test.mjs` anpassen. Reihenfolge: `capPerHour`, Shop-Summe und K-Stufen zuerst (Patente-Tor), dann `D_CORP`, dann Zeitalter-Schwellen und Fördermenge aus den gemessenen Erz-Werten.

Andere Spielweisen messen (Optionen in `tools/balance-full.mjs`, Name=Wert oder positionell): `workHold=1` (Werkbank-Erstaufträge früh abwarten), `minRun=<s>` (kürzester Durchlauf je Neuguss, Standard 300), `corpEvery=<h>` (Gründungstakt, Standard 40), `hold=<s>` (Standard 3600), `maxHours=<h>` (Standard 800); Konstanten überschreiben mit `Name.Pfad=Wert`, z. B. `CORP.divisor=2000` oder `CORP.capPerHour=0.7`. Beispiel der schnellsten gefundenen Spielweise: `node tools/balance-full.mjs workHold=1 minRun=15 hold=7200 corpEvery=17.7`. Der Exitcode ist nur für den Bot aussagekräftig (Obergrenze 700 h); für andere Spielweisen zählt nur >= 504 h. Die erste Gründung (`corpFirst`) kennt `balance-full.mjs` nicht (nur `tools/balance-sim.mjs`).

## B7. Technische Hinweise

### B7.1 Spielstand
```js
state.corp = { points: 0, total: 0, count: 0, shop: {}, history: [] }   // history: letzte 10 Gründungen { gain, gussformen, time, at }
state.autoCast = { on: false, mode: 'gain', value: 0 }                // Auto-Neuguss
```
- Kein neues Feld für Zeitalter oder Industrie (abgeleitet). `stats` bekommt `corpRunTime: 0` (Sekunden seit der letzten Gründung, nur Anzeige und Auswertung).
- Sanitizing (`save.js`): `corp.points/total` über `num`, `corp.count` über `int(.., 1e9)`, `corp.shop` nur bekannte IDs mit `min(stufe, max)` (wie `SHOP`), `corp.history` höchstens 10 gültige Einträge, `autoCast.mode ∈ {'gain','time'}`, `value` über `num(.., 0, 0, 1e12)`. Forschungsaufträge in den Queues: unbekannte oder bereits abgeschlossene Forschung wird wie bisher verworfen (neue IDs sind Teil von `RESEARCH`, das sanitizing läuft automatisch über die Datenlisten).
- Neue Ressourcen und Generatoren werden von `sanitize` automatisch über `RES_IDS`/`GENS` behandelt; fehlende Felder in alten v5-Spielständen werden zu 0. `evo` wird bei `EVO_MAX = 8` weiterhin über `int(.., EVO_MAX)` begrenzt.
- Keine inhaltliche Migration: `migrateV5toV6` ergänzt nur `corp` (leer) und `autoCast`.

### B7.2 Schnittstellen für die UI
- Reine Lesefunktionen in `core/formulas.js`: `corpUnlocked()`, `corpGain()`, `corpStage()` (0 bis 7), `corpMult()`, `corpLevel(id)`, `corpCost(id)`, `industryProgress()` → `[{ id, value, next, progress, reached, mult }]`, `heirFloor()`.
- Events: `corp` (`{ gain }`), `corpshop` (`{ id }`), `industry` (`{ track, step }`). Systeme: `doCorp()`, `buyCorpShop(id)`.

## B8. Hinweise zur Balance

- Die Zeiten in B6.4 sind für den Bot gemessen, die Kosten der Konzerninhalte bleiben Modellwerte (B5.2).
- Der Wiederaufbau nach der Konzerngründung (3 h) ist geschätzt; er bestimmt, wie oft ein Spieler sinnvollerweise gründet, hat wegen des Zeitdeckels (B3.2) nur geringen Einfluss auf die Mindestdauer (516 h).
- Es wurde kein echter Spieler gemessen (siehe A8). Reale Spieler können schneller sein (Offline-Ertrag, bessere Entscheidungen).
- Ausbau VI bis VIII ist nur auf billigen Generatoren erreichbar. Falls das als Lücke wirkt, könnten die Stufen-Schwellen je Generator gestaffelt werden (z. B. `EVO_AT` abhängig vom Wachstum des Generators).
