# Eisenwerk Idle – Spieldesign (Eisenhütten-Kette, Timer, Zeitalter, Neuguss)

Dieses Dokument beschreibt Inhalte, Zahlen und die Begründung der Balance. Die Tabellen unten sind aus den Daten (`js/data/*.js`) erzeugt; maßgeblich bleibt der Code.

## 1. Ressourcenkette

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
- Der Neuguss-Gewinn hängt weiter nur am Erz des Durchlaufs (Formel siehe Abschnitt 4, Hochofen-Skalierung), die Kette beschleunigt ihn über die Multiplikatoren.

## 2. Timer und Warteschlangen

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
- Offline und Hintergrund: `applyOffline` rechnet abschnittsweise. Nach jedem Abschluss werden die Raten neu berechnet, mehrere Aufträge laufen nacheinander ab, Timer laufen auch über das Offline-Maximum hinaus weiter. Der Laufzeitpfad (Tab im Hintergrund) nutzt dieselbe Logik.
- Neuguss: Werkbank wird immer geleert (Boosts und Klick-Upgrades werden ohnehin zurückgesetzt), das Labor nur ohne „Wissensarchiv“. Mit Wissensarchiv laufen Forschungsaufträge weiter. Es gibt keine Erstattung, weil alle Ressourcen beim Neuguss zurückgesetzt werden; der Bestätigungsdialog weist darauf hin.
- Speicherstand: Timer-Felder seit Version 4 (aktuell `SAVE_VERSION` 5), Feld `timers { lab: [], workshop: [] }`, Einträge `{ kind, id, total, left, cost, silent }`. Beim Laden wird alles gegen die Daten geprüft (unbekannte IDs, falsche Queue, Bereits-Erforschtes, Duplikate, NaN, Länge). Migration v3 → v4 fügt nur leere Schlangen und `stats.timersDone` hinzu.

### Dauern im Überblick
- Früh (Minute 0 bis 10): Forschung 5 bis 40 s, Boosts 15 bis 45 s, Klick-Upgrades 5 bis 10 s Startdauer.
- Mitte: Forschung 1 bis 6 min, Boosts 1 bis 5 min.
- Spät: Forschung 8 bis 30 min (Wolfram 15 min, Supraleiter 20 min, Goldschmiedekunst 30 min), Boosts bis 15 min.
- Die langen Aufträge sind bewusst zum „Einreihen und weggehen“ gedacht: Offline-Fortschritt arbeitet sie ab.

## 3. Generator-Evolution (Werkshalle)

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

## 3a. Zeitalter und Generator-Ausbau (Industrie-Tab)

Stand vor dem Ausbau: 6 Zeitalter und 5 Ausbaustufen. Mit dem Ausbau gibt es 9 Zeitalter (Schwellen 6 bis 8: 8e26 / 8e27 / 8e28) und 8 Ausbaustufen, siehe Abschnitt 3c und [GAME-DESIGN-2.md](GAME-DESIGN-2.md) Abschnitt 2.

### Zeitalter (Industrialisierung)
Ein Zeitalter ist erreicht, wenn das kumulierte Erz `state.stats.total.ore >= at` ist (nicht gespeichert, abgeleitet; keine Mindest-Spielzeit mehr). Zeitalter und Industrie-Tab sind erst ab dem 1. Neuguss wirksam: `eraIndex()` liefert 0, solange `state.prestige.count < 1` (`industryUnlocked()`), egal wie viel Erz vorhanden ist (alte Spielstände ohne Neuguss crashen nicht, sie sind einfach in Zeitalter 0). Industrie-Tab-Button und Zeitalter-Anzeige in der Seitenleiste sind bis dahin versteckt; liegt der aktive Tab dort (Reset/Import), wird auf Generatoren zurückgefallen (Start-Tab ist Werk). Gesperrte Forschung/Ausbauten nennen vor dem 1. Neuguss den Grund „Benötigt den ersten Neuguss“. `stats.playTime` bleibt als reine Statistik erhalten. Jedes Zeitalter unlocks neue Forschungen (mit optionalem Feld `era: n`) und Ausbaustufen für Generatoren. Der globale Multiplikator ist kumulativ: Mit Zeitalter 3 erhalten alle Ausgaben `×(1.0 × 1.2 × 1.3)`.

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
- Kalibrierung und Sim-Werte: siehe Abschnitt 3b (die frühere Kalibrierung vor den Zeitalter-Forschungen und den neuen Schwellen ist entfallen).

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

## 3b. Progression (Stand)

- Der Industrie-Tab und die Zeitalter-Anzeige gibt es erst ab dem 1. Neuguss.
- Zeitalter hängen nur an kumulierten Erz-Schwellen: 1e17, 1e20, 1e22, 1e23, 3e23 (Zeitalter 1 bis 5). Es gibt kein `minTime` mehr.
- Sim-Aufruf und Parameter: `node tools/balance-sim.mjs [Stunden] [Klicks/s] [Neuguss-Anteil] [dt] [Policy]`. Defaults: 48 h, 4 Klicks/s, Anteil 0,5, dt 2 s, Policy `rate`. Stunden = simulierte aktive Spielzeit (kein Offline-Ertrag); Klicks/s = Klickrate des Bots; Anteil = Der Bot gießt neu, sobald der Gewinn >= Anteil x bisher verdiente Gussformen ist (1 = so früh wie sinnvoll möglich, 0,5 = früher); dt = Simulationsschritt in Sekunden (größer = gröber und schneller gerechnet, ändert die Ergebnisse spürbar); Policy `rate` = Neuguss nach Gewinnrate, `frac` = nach Bestandsanteil. Zusätzlich hat `simulate()` die optionale Option `workHold` (Standard aus; true = Boosts und Klick-Upgrades der Werkbank früh abwarten, Standardlauf des Bots; Zeiten nach Runde 2 siehe GAME-DESIGN-2.md 6.2).
- Kalibrierter Aufruf (Referenz für die Tabelle und für `tests/balance.test.mjs`): `tools/balance-sim.mjs 175 4 1 30 rate` (175 h, 4 Klicks/s, Anteil 1, dt 30). Bot kauft alle Forschung/Boosts/Klick-Upgrades und baut auch Chrom/Nickel/Wolfram/Gold-Generatoren aus. Gemessene Werte (Lauf vom 2026-10-11): 1. Neuguss bei 1,8 h; Zeitalter 1 bei 7,5 h (5,7 h nach dem 1. Neuguss), Zeitalter 2 bei 37,9 h, 3 bei 96,5 h, 4 bei 127,6 h. Zeitalter 5 liegt bei etwa 192 h (8 Tage, Lauf mit `stopAtEra: 5` und 336 h); der 175-h-Lauf erreicht es nicht ("NICHT erreicht"). Meilensteine: 5 und 25 bei 1,8 h, 150 bei 2,0 h, 1.000 bei 2,4 h, 10.000 bei 4,3 h, 250.000 bei 34,5 h.
- Schneller/optimistischer Bot (Aufruf ohne Parameter, also 48 h, Anteil 0,5, dt 2): 1. Neuguss bei 2,6 h; Zeitalter 1 bei 4,7 h, 2 bei 6,6 h, 3 bei 13,3 h, 4 bei 14,9 h, 5 bei 15,1 h; Meilensteine 5/25/150 bei 2,6 h, 1.000 bei 3,1 h, 10.000 bei 4,6 h, 250.000 bei 23,3 h. Der Standardlauf ist eine Untergrenze der Dauer: Er gießt häufiger neu und rechnet feiner (dt 2), kauft also effizienter als der kalibrierte Lauf. Er widerspricht dem kalibrierten Lauf nicht, er misst nur einen anderen Spielstil.
- Einordnung: Beide Läufe sind Bots, es wurde kein echter Spieler gemessen. Die Zeiten hängen stark vom Spielstil und von den Bot-Parametern ab (kalibriert mit dt 60 statt 30: Zeitalter 1 erst bei 31 h). Realistische Spielerzeiten liegen irgendwo zwischen beiden Läufen; offline verkürzt sich die Dauer zusätzlich. Die Tabelle oben in diesem Absatz gilt nur für den kalibrierten Aufruf.
- Tests: `tests/balance.test.mjs` nutzt die kalibrierte Konfiguration (336 h, dt 30, Anteil 1, `rate`, Abbruch bei Zeitalter 5) und prüft die Zeitalter-Reihenfolge, die Obergrenzen (Zeitalter 2 <= 100 h, 3 <= 180 h, 4 <= 240 h, 5 <= 336 h) und mindestens 3 h Abstand je Schritt. Dieser Abstand gilt nur für den kalibrierten Lauf; der Standardlauf unterschreitet ihn (Zeitalter 3 bis 5 liegen 0,2 bis 1,6 h auseinander).
- Kostenkalibrierung der Zeitalter-Forschung, Zeitalter-Boosts und Era-Klick-Upgrades: Die größte Kostenposition einer Zeitalter-Forschung liegt bei 0,2 bis 1,0 x Erz-Schwelle ihres Zeitalters (geometrisch gestaffelt entlang der Ketten). Jede Ressource kostet proportional zu ihrer Produktionsrate im Sim (Median der Spitzenraten kurz vor jedem Neuguss im jeweiligen Zeitalter, `simulate().runRates`), Erz mit Faktor 1, Stahl 0,7, alle anderen 0,4. Dadurch begrenzt immer die langsamste Ressource und nie eine Nebenressource mit unrealistischem Mengenverhältnis. Zeit bis bezahlbar bei Spitzenrate (ab Durchlaufstart, ohne Bestand): Zeitalter 1 bis 2: unter 1 Minute bis wenige Minuten, Zeitalter 3: 3 bis 20 Minuten, Zeitalter 4 und 5: 0,4 bis 3 Stunden. Die Zeitalter-Schwellen sind kumulativ über viele Durchläufe, die Kosten dagegen müssen innerhalb eines Durchlaufs bezahlbar sein (Forschung geht beim Neuguss verloren, außer mit Wissensarchiv); deshalb sind die Kosten in frühen Zeitalter kurz gemessen an der Schwelle.
- Bewusster Bruch: Alte Spielstände (vor Industrie/Zeitalter-Umbau) werden nicht migriert; Zeitalter und Industrie gelten erst ab dem 1. Neuguss, es gibt keinen Toast für übersprungene Zeitalter.
- Recalibration: `tools/balance-sim.mjs` liefert `runRates`; bei Änderung von Forschung, Schwellen oder Boni Sim laufen lassen und Kosten neu aus den Raten ableiten.
- 76 Forschungen, verteilt nach Zeitalter (Feld `era`; ohne Feld = 0): Zeitalter 0: 30, 1: 8, 2: 9, 3: 10, 4: 10, 5: 9.
- 15 neue Zeitalter-Boosts (`prospect` bis `fusioncat`) und 2 neue Klick-Upgrades (`hydraulic`, `plasmalance`).
- Neue `mult`-Schlüssel in Boosts: `click` (Klickwert) und `autoclick` (Autoklick-Anteil), neben Ressourcen-ID und `all`.
- Synergie (ab Zeitalter 1): +0,3 % je erledigter Forschung und +0,5 % je gekauftem Boost, flach addiert (`SYNERGY` in `core/formulas.js`).

## 3c. Zweite Reset-Ebene und Ausbau auf 3 Wochen (Kurzfassung)

Auf den Hochofen-Neuguss setzt eine zweite Reset-Ebene auf, die **Konzerngründung** mit der Währung **Patente**. Sie ist ab 100 Neugüssen nutzbar (ab Neuguss 25 sichtbar, gesperrt) und setzt den Neuguss-Fortschritt zurück (Gussformen, Hochofen-Shop, normale Forschung). Zeitalter, Erfolge, Statistik, Neuguss-Zähler, Patente und Konzernforschung bleiben. Patente = `min( floor( sqrt(Gussformen im Konzernlauf / 1500) × (1 + 0,1 × Lizenzgebühren) ), floor(0,68 × Stunden seit der letzten Gründung) )` (konkav und gedeckelt, Runde 2), wirken als Produktionsbonus, schalten sieben Konzernstufen (K1 bis K7) frei und werden im Konzern-Shop (9 Einträge, Summe 351 Patente) ausgegeben.

Dazu kommen: 7 Materialien (Kobalt bis Superlegierung) mit 7 Generatoren und 4 Rezepten, 49 Konzernforschungen, 12 Boosts, 4 Klick-Upgrades, Zeitalter 6 bis 8, Generator-Ausbau VI bis VIII, zwei Industrie-Meilenstein-Leisten (Fördermenge, Materialvielfalt), Zielleiste, Neuguss-Vorschau und Auto-Neuguss. Gesamtumfang: 125 Forschungen, 43 Boosts, 10 Klick-Upgrades, 21 Generatoren, 19 Materialien, 10 Rezepte, 9 Zeitalter (die Tabellen in Abschnitt 6 und die Zeitalter-Tabelle in 3a beschreiben noch den Stand vor dem Ausbau).

Zeitplan (Bot `rate`, gemessen mit `node tools/balance-full.mjs`): alle Inhalte bei 602,3 h, Zielkorridor 504 bis 700 h; schnellste gefundene Spielweise 538,4 h, rechnerische Untergrenze 516 h. Alle Formeln, Tabellen, kalibrierten Werte und die Zeitleiste stehen in [GAME-DESIGN-2.md](GAME-DESIGN-2.md), nicht hier. Entscheidungen und Abweichungen vom Design: [PLAN-ausbau-3wochen.md](PLAN-ausbau-3wochen.md) (D1 bis D13).

## 4. Balance-Begründung

- Prinzip: Jedes neue Material kostet im Generator das Material davor plus Erz/Stahl, und seine Freischaltforschung kostet das Vorprodukt. Dadurch ist die Reihenfolge erzwungen und die Kette kann nicht „übersprungen“ werden. Ein Test prüft per Fixpunkt-Rechnung, dass jede Ressource, Forschung, jeder Generator, Boost und jedes Klick-Upgrade erreichbar ist und dass kein Zyklus in den Voraussetzungen existiert.
- Staffelung: Neue Gegenstände werden erst angezeigt, wenn ihre Voraussetzungen direkt freischaltbar sind (`isRevealed`), damit die Listen nicht von Anfang an mit gesperrten Karten gefüllt sind.
- Kostenkurve: Basiskosten steigen je Materialstufe etwa um den Faktor 3 bis 10, Wachstum je Stufe 1,17 (Zeche) bis 1,27 (Tiegel); die Elite-Titankosten wachsen mit den späten Generatoren (2 bis 10). Basisproduktion sinkt dafür (Zeche 2/s, Tiegel 0,004/s), weil der Wert pro Einheit steigt.
- Erster neuer Inhalt: Kohleflöz-Erkundung kostet 15.000 Erz + 150 Stahl und dauert 20 s (Geologie 5 s, Tiefbau 15 s davor). In der Simulation (greedy Bot, 4 Klicks/s, Verhalten der echten Module) erscheint die Kohle nach etwa 4:30 (Forschung) und 5:20 (Zeche), Koks nach etwa 10 min.
- Mitte: Simulation – Kupfer ca. 42 bis 50 min, Mangan ca. 56 bis 60 min, Legierung ca. 73 bis 79 min, Chrom/Nickel ca. 97 min, Wolfram ca. 109 min, Gold ca. 147 min bei einem eher passiven Bot. Ein menschlicher Spieler mit Vorplanung ist schneller, der Neuguss (bereits ab ca. 50 min möglich) verschiebt das Ende weiter nach hinten: Die Kette trägt über den ersten Neuguss hinaus, weil ohne „Wissensarchiv“ die Forschung verloren geht und die Kette erneut (schneller durch den Gussformen-Bonus) aufgebaut wird.
- Hochofen-Skalierung (exponentiell): Der Erzbedarf für insgesamt n Gussformen in einem Durchlauf beträgt `divisor * growth^(n-1)` mit `divisor = 1e7`, `growth = 1,05` (js/data/prestige.js); jede weitere Gussform braucht also ×1,05 so viel Erz. Gewinn = `floor(log(erz/divisor) / log(growth)) + 1` ab `erz >= divisor`, sonst 0, anschließend × (1 + 0,1 × Stufe „Hochofen-Kapazität“), abgerundet; Rundungsfehler von `log` fängt ein Korrekturschritt gegen die exakte Schwelle ab. `perPoint = 0,1` (+10 % je Gussform) bleibt unverändert. Der erste Neuguss ist ab 1e7 Erz (ca. 45 min) möglich. Der Faktor 1,5 (Commit 9fb69f7) war zu steil: Gussformen sind ein Zähler und wachsen nur mit dem Logarithmus des Erzes, bei ×1,5 blieben die Meilensteine ab 20 Gussformen praktisch außer Reichweite (100 Gussformen bräuchten 2,7e24 Erz). Mit ×1,05 bringt eine Verdopplung des Erzes etwa +14 Gussformen. Bereits erhaltene Gussformen sind Zähler im Spielstand (keine Migration). Erzbedarf vor Shop-Multiplikator:

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
- Hammerwut wirkt nur auf manuelle Klicks (Phase 2a); die neuen Klick-Upgrades haben Basis 0 und addieren sich zum Klickwert erst ab Stufe 1.

## 5. Freischaltreihenfolge (empfohlener Pfad)

1. Geologie (5 s) → Auto-Konverter / Tiefbau → Metallurgie (Walzwerk)
2. Kohleflöz-Erkundung → Zeche → Verkokung (Koks, Koksofenbatterie, Rezept Kohle → Koks)
3. Titan-Extraktion → Titan-Schmiede; Hochofenprozess (Rezept Erz + Koks → Stahl, Stahl +25 %, Pressluft-Klick-Upgrade)
4. Kupfermetallurgie → Kupferhütte; Manganstahl → Manganbergwerk
5. Laborautomatisierung (Zeiten −25 %) sobald Globale Effizienz vorhanden
6. Legierungstechnik → Legierungsmischer (Rezept Kupfer + Mangan → Legierung); Katalyse (+50 % alles)
7. Chrom & Nickel → Chromwerk, Nickelraffinerie
8. Wolfram-Gewinnung (benötigt zusätzlich Titan-Raffination) → Wolframreaktor, Wolfram-Spitze; Supraleiter (+100 % alles)
9. Goldschmiedekunst → Edelmetall-Tiegel, Goldveredelung (×2 alles)

## 6. Inhalte (aus den Daten erzeugt)

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

## 7. Schnittstellen für die UI (Phase 3)

Timer-API (`js/systems/timers.js`): `enqueue(kind, id)`, `cancel(queue, index)`, `tick(dt)`, `queueState(queue)` → `[{ kind, id, name, total, left, progress, running, index }]`, `isPending(kind, id)`, `timeToNext()`, `finishAll()` (Test/Debug). Lesende Helfer in `core/formulas.js`: `queueSlots`, `queueCapacity`, `duration(kind, id)`, `pendingOf(kind, id)`, `lockReason` (liefert „Läuft“, „In Warteschlange“, „Labor: Warteschlange voll“), `isRevealed`, `resVisible`.

Events: `timer:queued`, `timer:done`, `timer:cancel` (`{ queue, kind, id }`, bei Abbruch zusätzlich `refund`, `running`), `gen:evolve` (`{ id, tier }`), `buy` mit `queued: true` bei Aufträgen.

Datenfelder: `img` je Material und Generator (`assets/icons/res-<id>.svg`, `gen-<id>.svg`; vorhandene Dateien stehen in `js/ui/assets.js`, für alle anderen zeigt die UI das Emoji `icon` als Textfallback), `sym` (Symbolname in `assets/sprites/items.svg`, id `sym-<name>`; die UI zeigt das SVG per `symSvg`, bei Forschung wird `sym` über die Tabelle `SYM` in `data/research.js` aus dem Emoji abgeleitet), `liquid` (Farbe) und `cat` (`mining` Erlenmeyer, `metal` Reagenzglas, `chem` Rundkolben, `tech` Retorte) je Forschung, `time` je Forschung/Boost/Klick-Upgrade.

## 8. Offene Punkte

- Designrisiko: Der erste Neuguss kommt nach etwa 2 h (kalibrierter Bot 1,8 h, schneller Bot 2,6 h). Bis dahin gibt es weder Industrie-Tab noch Zeitalter-Anzeige. Der Spieler sieht lange keine neue Systemebene. Ideen (nicht umgesetzt, kein Code geändert): Industrie-Tab als gesperrten Reiter mit Hinweis "Ab dem ersten Neuguss" anzeigen; früheren Meilenstein-Hinweis oder Fortschrittsanzeige zum ersten Neuguss einblenden; Schwelle des ersten Neugusses (`divisor` 1e7) prüfen.
- Kein echter Spieler gemessen: Alle Zeiten stammen von Bots. Playtest nötig, bevor die Zeitalter-Schwellen als final gelten.
- Zeitalter 3 bis 5 liegen im schnellen Bot dicht beieinander (13,3 / 14,9 / 15,1 h); im kalibrierten Lauf sind es 96 / 128 / 192 h. Die Spreizung hängt stark vom Spielstil ab.
