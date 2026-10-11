# Eisenwerk Idle – Spieldesign Phase 2b (Eisenhütten-Kette und Timer)

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
- Speicherstand: Version 4, Feld `timers { lab: [], workshop: [] }`, Einträge `{ kind, id, total, left, cost, silent }`. Beim Laden wird alles gegen die Daten geprüft (unbekannte IDs, falsche Queue, Bereits-Erforschtes, Duplikate, NaN, Länge). Migration v3 → v4 fügt nur leere Schlangen und `stats.timersDone` hinzu.

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

### Zeitalter (Industrialisierung)
Ein Zeitalter ist erreicht, wenn BEIDE Bedingungen erfüllt sind: kumuliertes Erz `state.stats.total.ore >= at` UND kumulierte Spielzeit `state.stats.playTime >= minTime` (nicht gespeichert, abgeleitet). `playTime` zählt über alle Neugüsse hinweg, wird im Tick und bei Offline-Zeit (`applyOffline`, gedeckelt auf das Offline-Maximum) erhöht und beim Neuguss nicht zurückgesetzt. Ziel: Alles ist frühestens nach 7 Tagen Spielzeit freigeschaltet, unabhängig davon, wie schnell Erz wächst (Erz-Schwellen stauchen sich exponentiell). Jedes Zeitalter unlocks neue Forschungen (mit optionalem Feld `era: n`) und Ausbaustufen für Generatoren. Der globale Multiplikator ist kumulativ: Mit Zeitalter 3 erhalten alle Ausgaben `×(1.0 × 1.2 × 1.3)`.

| Zeitalter | Schwelle (Erz) | Mindest-Spielzeit | Bonus | Inhalte |
|---|---|---|---|---|
| 0: Handwerk | 0 | 0 | ×1.0 | Status quo |
| 1: Mechanisierung | 3e6 | 15 min | ×1.2 | Ausbau I, Forschung Wasserenergie |
| 2: Dampfzeitalter | 1e11 | 4 h | ×1.3 | Ausbau II, Dampfmaschine, Bessemer |
| 3: Elektrifizierung | 1e15 | 36 h | ×1.5 | Ausbau III, Dynamo, Elektrostahl |
| 4: Automatisierung | 1e19 | 4 Tage | ×1.5 | Ausbau IV, Fließband, Robotik, Auto-Ausbau im Generator-Auto-Buyer |
| 5: Digitalisierung | 1e23 | 7 Tage | ×2.0 | Ausbau V, Mikrochips, Nanotech |

- Erz-Schwellen und Mindest-Spielzeiten sind je streng steigend (Zeitalter 0: 0/0). Test `eras.test.mjs` prüft dies und dass `eraMult()` kumulativ wirkt.
- Fortschritt: `eraProgress()` = Minimum aus Erz-Fortschritt (logarithmisch) und Zeit-Fortschritt (linear zur nächsten `minTime`); `eraNeeds()` liefert `{ ore, time, missingTime }` für die Hinweise in Seitenleiste und Industrie-Tab ("Nächstes: X – ab Y Erz und Z Spielzeit").
- Event `era` bei Aufstieg (nicht beim Laden), Toast in Gold, je Zeitalter einzeln (auch bei Sprüngen über mehrere).
- Kalibrierung (Sim `node tools/balance-sim.mjs 175 4 1 30 rate`, 4 Klicks/s, Aktiv-Spiel ohne Offline): Zeitalter 1 bei 30 min (Erz-Schwelle bindet, minTime 15 min), Zeitalter 2 bei 4,0 h, 3 bei 36 h, 4 bei 96 h, 5 bei 168 h – ab Zeitalter 2 bindet die Mindest-Spielzeit, bei Zeitalter 5 liegt die Erz-Schwelle (1e23) knapp darunter (Sim: 1e23 bei ca. 142 h, 1,7e23 bei 168 h). Eine Erz-Schwelle von 1e24 wäre erst nach >200 h erreicht worden; sie wurde daher auf 1e23 gesenkt. Gesamt-Spielzeit bis alles frei: 7 Tage (Offline-Zeit zählt mit).

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

| Forschung | Ebene | Dauer | Kosten | Voraussetzung | Wirkung | Gefäß | Flüssigkeit |
|---|---|---|---|---|---|---|---|
| Geologie | 1 | 5 s | 300 Eisenerz | – | +25 % Erzproduktion. | mining | #f97316 |
| Resonanzhammer | 2 | 8 s | 1500 Eisenerz, 15 Stahlbarren | Geologie | Jeder Klick gibt zusätzlich 5 % deiner Erz/s. | tech | #f97316 |
| Auto-Konverter | 2 | 10 s | 3000 Eisenerz, 40 Stahlbarren | Geologie | Wandelt automatisch 20 % der Erzproduktion in Stahl um (25:1). | metal | #38bdf8 |
| Tiefbau | 2 | 15 s | 6000 Eisenerz, 60 Stahlbarren | Geologie | +50 % Erzproduktion. | mining | #f97316 |
| Metallurgie | 3 | 30 s | 8000 Eisenerz, 120 Stahlbarren | Auto-Konverter | +50 % Stahlproduktion. Schaltet das Walzwerk frei. | metal | #38bdf8 |
| Titan-Extraktion | 4 | 1 min | 1.5e4 Eisenerz, 250 Stahlbarren | Metallurgie | Schaltet die Titan-Schmiede frei. | chem | #d946ef |
| Titan-Raffination | 5 | 2 min | 4.0e4 Eisenerz, 800 Stahlbarren, 8 Titan-Legierung | Titan-Extraktion | +50 % Titanproduktion. | chem | #d946ef |
| Globale Effizienz | 5 | 2 min | 800 Stahlbarren, 10 Titan-Legierung | Titan-Extraktion | +50 % Produktion aller Materialien. | tech | #fbbf24 |
| Automatisierte Spitzhacken | 6 | 3 min | 2000 Stahlbarren, 30 Titan-Legierung | Resonanzhammer, Globale Effizienz | 5 automatische Klicks pro Sekunde. | tech | #fbbf24 |
| Präzisionsfertigung | 6 | 4 min | 2.0e5 Eisenerz, 5000 Stahlbarren, 60 Titan-Legierung | Globale Effizienz | Zusätzliche Meilensteine (×2) bei Stufe 25, 50, 100, 150, 200 ... | tech | #fbbf24 |
| Quantenmetallurgie | 7 | 12 min | 1.0e6 Eisenerz, 1.0e4 Stahlbarren, 250 Titan-Legierung | Automatisierte Spitzhacken, Präzisionsfertigung | +100 % Produktion aller Materialien. | chem | #fbbf24 |
| Kohleflöz-Erkundung | 3 | 20 s | 1.5e4 Eisenerz, 150 Stahlbarren | Tiefbau | Schaltet die Zeche frei und macht Kohle abbaubar. | mining | #64748b |
| Verkokung | 4 | 40 s | 4.0e4 Eisenerz, 600 Stahlbarren, 200 Kohle | Kohleflöz-Erkundung | Schaltet die Koksofenbatterie frei. Wandelt 40 % der Kohle in Koks um (5:1). | chem | #a8a29e |
| Hochofenprozess | 5 | 1 min 30 s | 1.0e5 Eisenerz, 2000 Stahlbarren, 300 Koks | Verkokung, Metallurgie | +25 % Stahlproduktion. Erz und Koks werden zusätzlich zu Stahl verhüttet. | metal | #a8a29e |
| Kupfermetallurgie | 4 | 1 min | 1.5e5 Eisenerz, 3000 Stahlbarren | Metallurgie | Schaltet die Kupferhütte frei. | metal | #ea8a52 |
| Manganstahl | 5 | 2 min 30 s | 8000 Stahlbarren, 300 Kupfer, 300 Koks | Kupfermetallurgie, Verkokung | Schaltet das Manganbergwerk frei. | metal | #a78bfa |
| Laborautomatisierung | 6 | 4 min | 2.0e5 Eisenerz, 1.0e4 Stahlbarren, 100 Titan-Legierung | Globale Effizienz | Alle Forschungs- und Werkbank-Zeiten dauern 25 % kürzer. | tech | #fbbf24 |
| Legierungstechnik | 6 | 6 min | 3.0e4 Stahlbarren, 1500 Kupfer, 300 Mangan | Manganstahl | Schaltet den Legierungsmischer frei. Kupfer und Mangan werden zu Legierung gemischt (3:1). | chem | #38bdf8 |
| Katalyse | 7 | 10 min | 1.5e5 Stahlbarren, 3000 Kupfer, 100 Legierung | Legierungstechnik | +50 % Produktion aller Materialien. | chem | #38bdf8 |
| Chrom & Nickel | 7 | 8 min | 2.0e5 Stahlbarren, 5000 Kupfer, 1000 Mangan, 50 Legierung | Legierungstechnik | Schaltet Chromwerk und Nickelraffinerie frei. | metal | #5eead4 |
| Wolfram-Gewinnung | 8 | 15 min | 2000 Titan-Legierung, 400 Legierung, 300 Chrom, 300 Nickel | Chrom & Nickel, Titan-Raffination | Schaltet den Wolframreaktor frei. Legierung, Chrom und Nickel werden zu Wolfram veredelt (8:2:2). | chem | #f472b6 |
| Supraleiter | 9 | 20 min | 1.0e4 Titan-Legierung, 100 Wolfram, 800 Legierung | Wolfram-Gewinnung | +100 % Produktion aller Materialien. | tech | #f472b6 |
| Goldschmiedekunst | 10 | 30 min | 3.0e4 Titan-Legierung, 300 Wolfram, 3000 Legierung | Supraleiter | Schaltet den Edelmetall-Tiegel frei. Wolfram wird teilweise zu Gold umgeschmolzen (20:1). | chem | #fbbf24 |
| **Energiehauptast (Ostarm, Phase 3)** | | | | | | | |
| Energiefundamente | 8 | 2 min | 6.0e4 Eisenerz, 1500 Stahlbarren, 500 Kohle | Resonanzhammer | +25 % Erz- und Stahlproduktion. | tech | #64748b |
| Wasserkraft | 9 | 2 min 30 s | 1.0e5 Eisenerz, 3000 Stahlbarren, 1000 Kohle | Energiefundamente | +25 % Erzproduktion. | mining | #f97316 |
| Dampfmaschine | 9 | 3 min | 1.5e5 Eisenerz, 5000 Stahlbarren, 500 Koks | Wasserkraft | +25 % Produktion aller Materialien. | tech | #a8a29e |
| Dynamo | 9 | 4 min | 8000 Stahlbarren, 1500 Kupfer, 300 Koks | Dampfmaschine | +50 % Stahlproduktion. | tech | #ea8a52 |
| Stromversorgung | 10 | 5 min | 2.0e5 Eisenerz, 1.0e4 Stahlbarren, 3000 Kupfer | Dynamo | +25 % Produktion aller Materialien. | tech | #fbbf24 |
| Elektrifizierung | 10 | 6 min | 1.5e4 Stahlbarren, 5000 Kupfer, 500 Legierung | Stromversorgung | +50 % Produktion aller Materialien. | tech | #fbbf24 |
| Fließbandproduktion | 10 | 7 min | 3.0e5 Eisenerz, 2.0e4 Stahlbarren, 1000 Legierung | Elektrifizierung | +50 % Erz- und Stahlproduktion. | tech | #f97316 |
| Robotik | 10 | 8 min | 2.5e4 Stahlbarren, 2000 Titan-Legierung, 1500 Legierung | Fließbandproduktion | +50 % Produktion aller Materialien. | tech | #fbbf24 |
| Massenproduktion | 10 | 9 min | 4.0e5 Eisenerz, 3.0e4 Stahlbarren, 3000 Legierung | Robotik | +50 % Produktion aller Materialien. | tech | #fbbf24 |
| Halbleitertechnik | 11 | 10 min | 4.0e4 Stahlbarren, 1.0e4 Kupfer, 500 Wolfram | Massenproduktion | +25 % Produktion aller Materialien. | chem | #fbbf24 |
| Nanotechnologie | 11 | 12 min | 5000 Titan-Legierung, 2000 Wolfram, 5000 Legierung | Halbleitertechnik | +100 % Produktion aller Materialien. | chem | #fbbf24 |
| Synthetische Materialien | 11 | 15 min | 8000 Titan-Legierung, 3000 Wolfram, 500 Gold, 8000 Legierung | Nanotechnologie | +50 % Produktion aller Materialien. | chem | #fbbf24 |
| **Verbesserungen in bestehenden Ästen** | | | | | | | |
| Tiefenkohlebergbau | 3 | 1 min 30 s | 8.0e4 Eisenerz, 2000 Stahlbarren, 1000 Kohle | Kohleflöz-Erkundung | +50 % Kohleproduktion. | mining | #64748b |
| Kupfererz-Konzentration | 4 | 3 min | 2.0e5 Eisenerz, 5000 Stahlbarren, 500 Kupfer | Kupfermetallurgie | +50 % Kupferproduktion. | metal | #ea8a52 |
| Quantenoptik | 7 | 20 min | 1.5e6 Eisenerz, 2.0e4 Stahlbarren, 500 Titan-Legierung, 5000 Legierung | Quantenmetallurgie | +25 % Produktion aller Materialien. | tech | #fbbf24 |

### Boosts (Werkbank)

| Boost | Dauer | Kosten | Freigabe | Wirkung |
|---|---|---|---|---|
| Diamantbohrer | 15 s | 150 Stahlbarren, 5 Titan-Legierung | – | Erzproduktion ×2. |
| Hochofen-Turbo | 25 s | 500 Stahlbarren, 20 Titan-Legierung | – | Stahlproduktion ×2. |
| Quantenpresse | 45 s | 2000 Stahlbarren, 60 Titan-Legierung | – | Titanproduktion ×2. |
| Overclocking | 1 min 30 s | 5.0e5 Eisenerz, 150 Titan-Legierung | – | Alle Materialien ×1,5. |
| Magnetscheider | 2 min 30 s | 5.0e4 Stahlbarren, 800 Titan-Legierung | – | Erzproduktion ×2. |
| Kryo-Veredelung | 4 min | 2.0e5 Stahlbarren, 2500 Titan-Legierung | – | Titanproduktion ×2. |
| Zechen-Förderband | 20 s | 2000 Stahlbarren, 500 Kohle | Kohleflöz-Erkundung | Kohleproduktion ×2. |
| Koks-Löschanlage | 35 s | 8000 Stahlbarren, 300 Koks | Verkokung | Koksproduktion ×2. |
| Sinteranlage | 1 min 20 s | 1.0e5 Stahlbarren, 2000 Koks | Hochofenprozess | Erzproduktion ×2. |
| Kupferelektrolyse | 1 min | 5.0e4 Stahlbarren, 800 Kupfer | Kupfermetallurgie | Kupferproduktion ×2. |
| Mangan-Härtung | 2 min | 1.0e5 Stahlbarren, 500 Mangan | Manganstahl | Stahlproduktion ×1,5, Manganproduktion ×2. |
| Mischer-Katalysator | 3 min 20 s | 5000 Kupfer, 2000 Mangan, 100 Legierung | Legierungstechnik | Legierungsproduktion ×2. |
| Verchromung | 5 min | 5.0e5 Stahlbarren, 1000 Chrom, 500 Nickel | Chrom & Nickel | Alle Materialien ×1,25. |
| Nickel-Superlegierung | 7 min | 5000 Titan-Legierung, 1000 Nickel, 300 Legierung | Chrom & Nickel | Titanproduktion ×2. |
| Wolframkarbid-Bohrer | 10 min | 2.0e4 Titan-Legierung, 200 Wolfram | Wolfram-Gewinnung | Erzproduktion ×3. |
| Goldveredelung | 15 min | 500 Wolfram, 50 Gold | Goldschmiedekunst | Alle Materialien ×2. |

### Klick-Upgrades (Werkbank, wiederholbar)

| Upgrade | Klickwert/Stufe | Kosten Stufe 1 → 10 | Dauer Stufe 1 / 10 / Max | Freigabe |
|---|---|---|---|---|
| Verstärkte Spitzhacke | +2 (×Meilenstein) | 25 Eisenerz → 962 Eisenerz, 27 Stahlbarren | 5 s / 14 s / 4 min | – |
| Vorschlaghammer | +10 (×Meilenstein) | 300 Stahlbarren → 1.5e4 Stahlbarren, 26 Titan-Legierung | 10 s / 35 s / 7 min | Metallurgie |
| Koks-Presslufthammer | +150 (×Meilenstein) | 5.0e4 Stahlbarren, 300 Koks → 3.4e6 Stahlbarren, 1.2e4 Koks | 40 s / 2 min 21 s / 15 min | Hochofenprozess |
| Wolfram-Spitze | +6000 (×Meilenstein) | 2.0e4 Titan-Legierung, 100 Wolfram → 1.4e6 Titan-Legierung, 3845 Wolfram | 2 min / 7 min 2 s / 25 min | Wolfram-Gewinnung |

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

Datenfelder: `img` je Material und Generator (`assets/icons/res-<id>.svg`, `gen-<id>.svg`; vorhandene Dateien stehen in `js/ui/assets.js`, für alle anderen zeigt die UI das Emoji `icon`), `liquid` (Farbe) und `cat` (`mining` Erlenmeyer, `metal` Reagenzglas, `chem` Rundkolben, `tech` Retorte) je Forschung, `time` je Forschung/Boost/Klick-Upgrade.
