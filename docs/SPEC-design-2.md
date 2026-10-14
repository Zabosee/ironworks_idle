# UI-Spezifikation 2 (ui-designer, 2026-10-12) – Konzern, Industrie-Leisten, Zielleiste

Verbindlich für Schritt 5. Grundlage: `docs/GAME-DESIGN-2.md` (Zahlen, Daten), Stil und Komponenten wie `docs/SPEC-design.md`. Keine neuen Tokens nötig: es gelten `--panel`, `--panel-2`, `--border`, `--gold`, `--ember`, `--good`, `--muted`, `--radius`, `--t-*` aus `css/styles.css`. Neue Akzentfarbe des Konzerns: `--corp: #22d3ee` (Kontrast auf `--panel` 8,6:1) nur für Rahmen, Balken, Überschriften; Text bleibt `--text`. Keine Emojis; Symbole nur über `symSvg`/`svgUse`. Alle Controls >= 44 px, sichtbarer Fokusring wie bestehend, Bewegung (Pling, Pop) <= 300 ms und unter `prefers-reduced-motion` aus.

## 1. Reiter "Konzern" (`#tab-corp`, `#tabbtn-corp`, Symbol `ui.svg#tab-corp`)
Position in der Tab-Leiste: direkt nach "Hochofen". Panel-Wurzel `#corp-root.panel-grid` (gleiches Raster wie `#prestige-root`).

**Sperrzustände** (Reiter ist ab Neuguss 25 sichtbar, vorher `hidden`):
| Zustand | Reiter | Inhalt |
|---|---|---|
| gesperrt (Neuguss 25 bis 99) | sichtbar, `aria-disabled="true"` (nicht `disabled`, bleibt fokussierbar und aktivierbar), Schloss-Symbol `ui.svg#lock` vor dem Label | Panel zeigt nur eine Box: Titel "Konzerngründung", Text "Wird nach 100 Neugüssen freigeschaltet.", Balken `role="progressbar"` mit Text "Neuguss 42/100", darunter Liste "Das erwartet dich" (Patente, Konzernforschung, 7 Materialien, Auto-Neuguss) als gedimmte Vorschau. Gedimmt nur über Rahmen/Fläche, nie `opacity` auf Text |
| freigeschaltet, noch keine Patente (Gussformen im Lauf < 1.500) | normal | Voller Aufbau, Gründen-Knopf `disabled` mit Text "Noch 400 Gussformen bis zur ersten Patente" |
| bereit (`corpGain >= 1`) | gold-Punkt `.dot` wie Hochofen (`sr-only`: " (Konzerngründung möglich)") | Gründen-Knopf aktiv |
Freischalt-Moment: Toast "Konzerngründung freigeschaltet" (Gold), Reiter pulst einmal 220 ms.

**Aufbau von oben nach unten** (jeweils `.panel-box`, wie Hochofen):
1. **Kopf "Konzern"**: Patente (groß, Symbol `sym-patent`), Konzernstufe "K3 von 7" mit Balken zur nächsten Schwelle (Text "45/75 Patente gesamt", Fortschritt `aria-valuetext`), aktuelle Boni als eine Zeile: "Patente-Bonus ×3,4 · Konzernstufen ×1,27".
2. **Gründen** (Hauptknopf, Breite wie Hochofen-Gießknopf): Beschriftung "Konzern gründen" + `sym-corp`. Darunter die **Vorschau**: "Du erhältst +7 Patente" (Zahl 1,5 rem fett), "Nächste Patente bei 6.000 Gussformen im Lauf (aktuell 4.300)", Mini-Balken, bei Konzernstufen-Sprung der Zusatz "Erreicht Konzernstufe K2: schaltet Hartmetall frei". Knopf aktiv nur bei `corpGain >= 1`.
3. **Konzern-Shop** (`.shop-grid`, Karten wie Hochofen-Shop): 9 Einträge aus `CORP_SHOP`. Karte: Symbol, Name, Wirkung, Stufe "2/4", Kosten "4 Patente" (`sym-patent`), Zustand `can` (Goldrahmen, wie `.card.can`), `maxed` (Haken + "Max"), nicht bezahlbar (Kosten mit `.bad` plus Text "Es fehlen 2 Patente"). Symbole siehe Abschnitt 5. Auto-Neuguss-Eintrag trägt nach Kauf den Schalter direkt auf der Karte (Abschnitt 4.4).
4. **Konzernforschung** (Zugang): Knopf-Karte "Konzernforschung" mit `sym-microscope`, Zähler "11/49 erforscht", Text "Dauerhaft, bleibt bei Neuguss und Gründung". Klick wechselt in den Forschungs-Reiter und scrollt zum Konzern-Ast (Abschnitt 2). Gesperrt (kein K1): Text "Ab Konzernstufe K1".
5. **Chronik** (`.chronicle`, Tabelle wie Neuguss-Chronik): letzte 10 Gründungen: Nr., Patente, Gussformen, Laufzeit, Zeitpunkt. Leerzustand: "Noch keine Gründung".

**Bestätigungsdialog** (`<dialog>`, Fokus auf "Abbrechen", Esc schließt, Hintergrund inert; Muster Hochofen-Dialog):
- Titel "Konzern gründen?"; Gewinnzeile "+7 Patente (gesamt 7, Konzernstufe K1)".
- Zwei Spalten (mobil untereinander), je `<h3>` und `<ul>` mit Symbolen **und** Text (nie nur Farbe): 
  - "Geht verloren" (Symbol `ui.svg#cancel`, Rand `--bad`): Gussformen und Hochofen-Shop, Neuguss-Chronik, alle Ressourcen und Generatoren, Ausbau, Klick-Upgrades, Boosts, normale Forschung (auch mit Wissensarchiv), laufende Aufträge.
  - "Bleibt" (Symbol `ui.svg#check`, Rand `--good`): Zeitalter, Erfolge und Statistik, Neuguss-Zähler, Patente und Konzern-Shop, Konzernforschung, Auto-Buyer-Schalter, Industrie-Leisten.
- Hinweis wenn `c_heir`/`c_archive` gekauft: "Konzern-Shop stellt wieder her: ..." (Zeile je Eintrag).
- Knöpfe: "Abbrechen" (sekundär, links, Standardfokus), "Konzern gründen" (primär, Ember). Kein Doppelklick-Schutz nötig, Bestätigung ist der Schutz. Nach Erfolg: Toast "Konzern gegründet: +7 Patente", Glut-Effekt wie Neuguss.

## 2. Forschungskarte: Konzernforschung
- Eigener **Ast** am Ende der Forschungskarte mit Überschrift "Konzernforschung" (`<h2>` mit `sym-corp`, Rahmen `--corp`, Unterzeile "Dauerhaft: bleibt bei Neuguss und Gründung"). Innerhalb des Asts Knoten wie bisher, Reihenfolge nach `corp`-Stufe K1 bis K7 mit Zwischenüberschriften "K1" bis "K7" (nur Text, `<h3>`).
- **Kennzeichnung** der Karte: Abzeichen oben rechts `sym-corp` + Text "K3" (kleine Pille, Rand `--corp`); die Farbe ist nie alleiniger Träger. Erforschte Karten tragen zusätzlich den Haken und "Dauerhaft".
- **Sperrgründe** (Reihenfolge wie `lockReason`: Voraussetzung, Zeitalter, Konzernstufe, Queue). Gesperrt = gestrichelter Rahmen, Schloss, Textzeile in `--muted`-Ersatz mit Kontrast >= 4,5:1 (`#a8b4c6` auf `--panel`): "Benötigt Konzernstufe: K3" bzw. "Benötigt Zeitalter: Atomzeitalter" bzw. "Benötigt: Kobaltbergbau". Hat eine Karte mehrere Sperren, werden alle untereinander gezeigt (max 3). Zeitalter-Sperre zeigt das Zeitalter-Symbol (`sym-atom`, `sym-rocket`, `sym-cosmic`) vor dem Namen.
- Ast sichtbar, sobald Konzern-Reiter freigeschaltet ist; davor ausgeblendet (kein leerer Ast). Konzernforschung ab K2 ohne erreichbare Voraussetzung erscheint wie bisher als Platzhalter-Knoten (Schloss, "?"), wie bei verborgenen Knoten der Karte.
- Neue Boosts/Klick-Upgrades mit `corp` bekommen dasselbe Abzeichen und dieselben Sperrtexte in `#tab-upgrades`.

## 3. Industrie-Tab
- **Zeitalter-Liste** erweitert auf 9 Einträge. Neue Symbole: Zeitalter 6 `sym-atom`, 7 `sym-rocket`, 8 `sym-cosmic`. Liste zeigt je Zeitalter Schwelle, Bonus, Status (erreicht/aktuell/gesperrt als Text), aktuelles mit Balken (logarithmisch). Gesperrte Zeitalter 6 bis 8 erst sichtbar, wenn Zeitalter 5 erreicht ist, vorher eine Zeile "Weitere Zeitalter folgen".
- **Ausbau-Pips**: 8 statt 5. Pips in `.lane-pips` und Ausbau-Karte; ab 6 Pips Zeilenumbruch nicht erlaubt: Pip-Größe 0,5 rem, Abstand 0,15 rem (8 Pips = 5,2 rem). Ausbau VI bis VIII erscheinen erst mit Zeitalter 6 bis 8; Pips 6 bis 8 tragen Römische Ziffer als `title`/`sr-only`. Rangnamen der Spur bleiben bei 5, Stufen 6 bis 8 nur als Pips (Rang unverändert Gold).
- **Meilenstein-Leisten** (neuer Block "Meilensteine" oben im Tab, zwei `.panel-box`, auf Breite >= 900 px nebeneinander):
  - Kopf: Name ("Fördermenge" / "Materialvielfalt"), Symbol `sym-chart` / `sym-variety`, Gesamtbonus "×1,29".
  - **Leiste**: Reihe von Stufenmarken (8 bzw. 7) als `<ol>`; je Marke Kreis 1,5 rem mit Nummer, Text darunter (Schwelle "1e15" bzw. "9 Materialien") und Bonus ("×1,05"). Erreicht = gefüllt in `--gold` mit Haken, nächste = Rand `--corp`-frei: Ember-Rand + Beschriftung "Nächste", künftige = nur Rand. Jede Marke `aria-label` "Stufe 3, 1e18, ×1,05, erreicht".
  - **Fortschritt zur nächsten Stufe**: Balken unter der Leiste (A logarithmisch von letzter zu nächster Schwelle, B linear), Text "1,2e19 / 1e21 Erz" bzw. "13/14 Materialien" und, falls Rate bekannt, "in ca. 5 h". Letzte Stufe erreicht: "Alle Stufen erreicht" mit Haken.
  - Mobil (< 640 px): Marken umbrechen auf zwei Zeilen (4+4 bzw. 4+3), Texte unter den Marken bleiben.
  - Bei Erreichen: goldener Toast "Fördermenge Stufe 5: ×1,10", Marke pulst 300 ms.

## 4. Seitenleiste
### 4.1 Neue Materialien und Gruppe "Weitere Materialien"
Mit 19 Materialien umfasst die Gruppe 14 Einträge (statt 7). Vorschlag, verbindlich:
- Die Gruppe behält den vorhandenen Kopf-Knopf `.more-toggle` (`aria-expanded`), wird aber in **zwei Untergruppen** geteilt: "Weitere Materialien" (Kohle bis Gold) und "Konzern-Materialien" (die 7 neuen, mit `sym-corp` im Kopf), jede einzeln einklappbar. Zustand wird in den Einstellungen gespeichert (UI-Präferenz, nicht Spielstand). Vorgabe: Konzern-Materialien offen, sobald mindestens eins sichtbar ist (`resVisible`), sonst Gruppe nicht gerendert.
- Desktop: Der Seitenleisten-Container scrollt bereits (`overflow-y: auto`); die Untergruppen nutzen **keine** eigene Höhenbegrenzung, damit kein verschachteltes Scrollen entsteht. Zeile `.meter` unverändert (Icon `res-<id>.svg`, Name, Menge, Rate).
- Mobil (< 1024 px): kompakte sticky Leiste wie bisher; Untergruppen standardmäßig **eingeklappt**, Kopf zeigt Zähler und Gesamtrate nicht, nur "Konzern-Materialien (3)".

### 4.2 Zielleiste (M1)
Neues Element `#goal-bar` oben im Werk-Tab (über der Werkshalle, nicht in der Seitenleiste, damit mobil sichtbar) und als Einzeiler auch in der Seitenleiste unter `#era-summary` (nur Desktop). Inhalt: Symbol `sym-flag`, "Nächstes Ziel: <Name>", Fortschrittsbalken (`role="progressbar"`, `aria-valuetext` "Erz 3,2e16 von 1e17"), rechts Restzeit "ca. 2 h" oder "Rate unbekannt". Nur ein Ziel gleichzeitig; Klick (Karte als Button) springt in den passenden Reiter (Neuguss: Hochofen; Zeitalter/Leiste: Industrie; Konzern: Konzern). Aktualisierung 1x/s nur Text und `--p`. Ziel-Wechsel ohne Animation außer 120 ms Einblenden. Nach dem letzten Ziel: "Alle Ziele erreicht".

### 4.3 Neuguss-Vorschau (M2)
Im Hochofen-Tab oberhalb des Gießknopfs, zusätzlich als Zeile in `#cast-summary` (Tooltip). Felder als `<dl>`: "Gussformen jetzt: +1.240", "Marginalwert: +12 in den letzten 2 min" (Zuwachs der letzten 2 Minuten), "Gewinn pro Stunde: 9.800", "Nächster Meilenstein: noch 310". Bewertung "Lohnt sich jetzt" / "Noch warten" als **Text-Pille mit Symbol** (`ui.svg#check` bzw. `ui.svg#hourglass`), nicht nur Farbe. Zahlen in Tabellenziffern (`font-variant-numeric: tabular-nums`), Werte aktualisieren 1x/s ohne Layoutsprung (feste Breite).

### 4.4 Auto-Neuguss (M3)
Schalter erst nach Kauf von `c_autocast` sichtbar (davor Konzern-Shop-Karte als Hinweis). Ort: Karte im Hochofen-Tab neben der Vorschau, Kopie als Karte im Konzern-Shop. Bedienelemente: Schalter `role="switch"` "Auto-Neuguss" (`sym-autocast`), Auswahl "Modus" (Gewinn / Zeit, als `role="radiogroup"`), Zahlenfeld "ab Gewinn" bzw. "nach Minuten" (`<input type="number" inputmode="numeric">`, min 1, Label sichtbar), Hinweis "Mindestlaufzeit 60 s". Läuft ein Auto-Neuguss, erscheint ein kurzer Toast "Auto-Neuguss: +1.240 Gussformen" (gedrosselt auf 1 je 10 s). Bei aktivem Auto-Neuguss zeigt der Gießknopf zusätzlich den Text "Auto aktiv". Es gibt keinen Auto-Konzern.

## 5. Neue SVG-Symbole (alle angelegt)
Kontur 2 px, `round`, `currentColor`, viewBox 24 (Items/UI) bzw. 64 (Icons, Sprite-Generatoren). Alle in `items.svg` (`sym-…`), außer Reiter (`ui.svg`), Generatoren (`gens.svg`) und Dateien in `assets/icons/`.

**Materialien**: Icons `assets/icons/res-<id>.svg` (farbig) + Kleinsymbol `sym-<id>` in `items.svg` (für Kosten-/Rezeptzeilen):
| id | Motiv (Icon / Kleinsymbol) |
|---|---|
| `cobalt` | Kristallwürfel mit Kantenlinien / Würfel |
| `molybdenum` | Zahnrad mit Strahlen (Röstung) / Strahlenkranz |
| `carbide` | Schneideinsatz (Sechseck-Plättchen) mit dunkler Mitte / Plättchen mit Loch |
| `platinum` | gestapelte Barren / Barrenstapel |
| `vanadium` | großes "V"-Prisma / "V" mit Querbalken |
| `iridium` | vierzackiger Stern (Kristall) / Stern |
| `superalloy` | Sechseck mit innerem Sechseck / Doppelsechseck |

**Generatoren** (`assets/icons/gen-<materialname>.svg` und `gens.svg#gen-<materialname>`; Zuordnung Generator-ID zu Dateiname in `GEN_SPRITE`): `cobaltmine` -> `cobalt` (Fördergerüst/A-Rahmen), `molybdenumworks` -> `molybdenum` (zwei Schornsteine), `sinterworks` -> `carbide` (Presse mit Kolben), `platinummine` -> `platinum` (Kristallspitzen), `vanadiumworks` -> `vanadium` (V-Rinne), `iridiumlab` -> `iridium` (Kolben), `superfoundry` -> `superalloy` (Tiegel mit Flamme). Das Sprite nutzt `--g-body`/`--g-trim` (Rangpalette), die Zusatzteile `t1` bis `t4` der älteren Generatoren fehlen (Rang zeigt sich nur über Palette und Pips; offene Frage unten).

**Weitere Symbole** (`items.svg`):
| Symbol | Motiv | Einsatz |
|---|---|---|
| `sym-patent` | Urkunde mit Siegel | Patente (Währung, Kosten) |
| `sym-corp` | Firmengebäude mit Giebel | Konzern, Abzeichen, Ast-Überschrift |
| `sym-share` | Kreisdiagramm | `c_eff` Aktienmehrheit |
| `sym-license` | Dokument mit Münze | `c_gain` Lizenzgebühren |
| `sym-moldfactory` | Gussform (Kasten mit Rinne) | `c_cast` Gussformen-Fabrik |
| `sym-heir` | Krone | `c_heir` Hochofen-Erbe |
| `sym-archive` | Aktenschrank | `c_archive` Konzernarchiv |
| `sym-autocast` | Kreispfeil mit Flamme | `c_autocast`, Auto-Neuguss-Schalter |
| `sym-variety` | drei Sechsecke | Leiste Materialvielfalt |
| `sym-flag` | Fahne | Zielleiste, Konzernstufe |
| `sym-cosmic` | Stern mit Umlaufbahn | Zeitalter 8 "Kosmische Schmiede" |
| `sym-chisel` | Meißel | Klick-Upgrade `carbidechisel` |
| `sym-ram` | Ramme | `iridiumram` |
| `sym-sledge` | Vorschlaghammer | `superhammer` |
Wiederverwendet (vorhanden): Zeitalter 6 `sym-atom`, Zeitalter 7 `sym-rocket`, Leiste Fördermenge `sym-chart`, `c_auto` `sym-robot`, `c_offline` `sym-moon`, `c_click` `sym-finger`, Konzernforschung `sym-microscope`. `ui.svg#tab-corp`: Firmengebäude mit Kreuz (Reiter). Die Eintragsnamen (`sym`-Feld in den Daten) müssen exakt diesen Namen ohne Präfix `sym-` entsprechen.

## 6. Farben, Mobil, A11y
**Materialfarben** (Fläche und Text; Kontrast gegen `--panel` #1e293b, Text >= 4,5:1; gegen `--panel-2` ebenfalls geprüft):
| Material | Farbe | Kontrast auf `--panel` |
|---|---|---|
| Kobalt | `#60a5fa` (Design: `#3b82f6`, nur 4,0:1, daher aufgehellt) | 5,5:1 |
| Molybdän | `#94a3b8` | 5,7:1 |
| Hartmetall | `#cbd5e1` | 9,5:1 |
| Platin | `#e2e8f0` | 11:1 |
| Vanadium | `#34d399` | 8,3:1 |
| Iridium | `#fb7185` | 5,1:1 |
| Superlegierung | `#22d3ee` | 8,6:1 |
Hartmetall und Platin sowie Kobalt und Legierung (`#38bdf8`) sind farblich nahe; Unterscheidung immer über Name und Symbol (Icon und Kleinsymbol sind formverschieden). Die Icons selbst behalten die Designfarbe `#3b82f6` für Kobalt (Fläche, nicht Text). Meter-Balken verwenden `--c` wie bisher.

**Mobil**: Konzern-Reiter zeigt nur das Symbol (wie alle Reiter < 1024 px, Label per `sr-only`, gewählter Reiter zeigt Label); 10 Reiter dürfen die Leiste scrollen lassen (`overflow-x: auto`, Fokus scrollt in Sicht), Konzern-Reiter bleibt in gesperrtem Zustand sichtbar mit Schloss. Shop-Raster 1 Spalte < 640 px, 2 Spalten ab 640, 3 ab 1024. Dialogspalten untereinander, Knöpfe vollbreit. Zielleiste als zweizeilige Karte (Name/Restzeit oben, Balken unten).

**A11y**: Gesperrter Reiter mit `aria-disabled`, Statustext über `aria-describedby` ("Nach 100 Neugüssen, aktuell 42"). Alle Balken `role="progressbar"` mit `aria-valuenow/min/max/valuetext`, Aktualisierung ohne Live-Region (nur Toast bei Ereignissen, `role="status"`). Dialog: Fokusfalle, Rückgabe des Fokus an den Gründen-Knopf. Sperrgründe und Zustände immer als Text. Tastatur: Shop-Karten und Leistenmarken per Tab erreichbar (Marken nur lesend, `tabindex="0"` nicht nötig, Info steht im `aria-label` der Liste). Reduced Motion: Pop, Pulse, Glut, Balkenübergänge aus.

## 7. Offene Fragen
1. Rang-Zusatzteile (`t1` bis `t4`) für die 7 neuen Generatoren im Sprite: aktuell nur Palette; nachliefern oder bewusst weglassen?
2. Reiter ab Neuguss 25 sichtbar (M4 in GAME-DESIGN-2) oder erst ab 100? Spec folgt M4.
3. Kobalt-Farbe `#60a5fa` statt `#3b82f6` (Kontrast) bitte in `js/data/resources.js` übernehmen (Backend).
4. Datenfelder `sym` für Shop, Klick-Upgrades und Zeitalter 6 bis 8 setzt das Backend gemäß Tabelle 5.
