# Eisenwerk Idle

Idle-Game (Deutsch/Englisch) im Browser: Aus Erz wird Stahl, Titan und Gold. Vanilla ES-Module, kein Build-Schritt, keine Abhängigkeiten, keine externen Ressourcen.

## Starten

ES-Module laufen nicht über `file://`. Starte einen statischen Webserver im Ordner mit `index.html`. Das Spiel braucht keine Abhängigkeiten und keinen Build.

```sh
python3 -m http.server 8080      # Windows: py -m http.server 8080
# oder: npx serve .
```

Öffne danach http://localhost:8080 (bzw. die Adresse, die `serve` ausgibt).

Hinweis: `package.json`, `server.mjs` und `public/` im Wurzelverzeichnis gehören zu einem anderen Projekt (agent-welt) und nicht zum Spiel. Du brauchst sie nicht.

Sprache: Die Oberfläche gibt es auf Deutsch und Englisch. Wechsle sie in den Einstellungen.

## Spielprinzip

- **Werkshalle (Standard-Tab "Werk")**: Zeigt für jeden Generator Bilder passend zur Anzahl. Die Bilder entwickeln sich mit der Stufe über fünf Evolutionsränge: Holz (ab Stufe 1), Eisen (10), Stahl (25), Titan (50), Gold (100).
- **Generatoren**: Hier, und nur hier, stellst du die Kaufmenge ein (x1 / x10 / x100 / Max). Alle 10 Stufen verdoppelt sich die Produktion.
- **Materialien und Produktionsketten**: 19 Materialien. Neben Erz, Stahl und Titan gibt es Kohle, Koks, Kupfer, Mangan, Chrom, Nickel, Legierung, Wolfram und Gold; nach der Konzerngründung kommen Kobalt, Molybdän, Hartmetall, Platin, Vanadium, Iridium und Superlegierung dazu (4 weitere Rezepte, 21 Generatoren insgesamt). Rezepte laufen automatisch (z. B. Kohle zu Koks, Erz und Koks zu Stahl, Wolfram zu Gold). Ein Material erscheint in der Oberfläche, sobald seine Forschung abgeschlossen ist oder ein Vorrat existiert. Details: [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md).
- **Labor und Werkbank (Timer)**: Forschung läuft im Labor, Boosts und Klick-Upgrades auf der Werkbank. Der Kauf zieht die Kosten sofort ab, der Effekt greift erst nach Ablauf der Zeit. Jede Warteschlange hat einen aktiven Slot und drei Warteplätze (im Hochofen-Shop erweiterbar). Abbrechen erstattet wartende Aufträge zu 100 %, laufende zu 50 %.
- **Hochofen-Neuguss (1. Reset-Ebene)**: Gussformen geben dauerhaft Produktionsbonus. Dazu kommen Meilensteine und ein Shop (u. a. Auto-Buyer, Zusatzplätze, Zeitraffer). Eine Vorschau zeigt den Gewinn jetzt; der Auto-Neuguss wird im Konzern-Shop freigeschaltet.
- **Konzerngründung (2. Reset-Ebene)**: Der Konzern-Reiter ist ab Neuguss 25 gesperrt sichtbar und ab 100 Neugüssen nutzbar. Die Gründung setzt Gussformen, Hochofen-Shop und normale Forschung zurück und gibt **Patente** (Wurzel aus Gussformen im Konzernlauf geteilt durch 1500, höchstens 0,68 Patente je Stunde seit der letzten Gründung; der Zeitdeckel zählt Offline-Zeit mit, der Konzern-Reiter erklärt beides). Patente erhöhen die Produktion, schalten die Konzernstufen K1 bis K7 mit der Konzernforschung (49 Forschungen, bleibt dauerhaft) frei und werden im Konzern-Shop (Summe 351 Patente; K1 bis K7 bei 10 / 30 / 70 / 135 / 210 / 290 / 351) ausgegeben. Details: [docs/GAME-DESIGN-2.md](docs/GAME-DESIGN-2.md).
- **Spielerkreislauf**: Produzieren und kaufen, Neuguss für Gussformen (Stunden), Konzerngründung für Patente (Tage), mit jeder Ebene stärker neu beginnen. Eine Zielleiste (Werk-Tab und Seitenleiste) zeigt das nächste Ziel.
- **Zeitalter und Industrie-Tab**: Ab dem 1. Neuguss gibt es neun Zeitalter (Handwerk bis Kosmische Schmiede), abgeleitet vom kumulierten Erz, mit globalem Bonus, neuen Forschungen und Generator-Ausbau (8 Stufen, Industrie-Tab). Dazu zwei Industrie-Meilenstein-Leisten (Fördermenge, Materialvielfalt) mit Produktionsboni (späte Stufen bis ×1,5). Details: [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md), Abschnitt 3a/3b, und [docs/GAME-DESIGN-2.md](docs/GAME-DESIGN-2.md).
- **Umfang und Zeitplan**: 125 Forschungen (davon 49 Konzernforschung), 43 Boosts, 10 Klick-Upgrades. Der Bot der Balance-Simulation schaltet gemessen alles bei 602,3 h aktiver Spielzeit frei (Ziel: mindestens 3 Wochen, Korridor 504 bis 700 h). Die schnellste gefundene Spielweise braucht 538,4 h; rechnerische Untergrenze durch den Patente-Deckel: 351 / 0,68 = 516 h. A1 und D11 sind damit erfüllt (D11 in [docs/PLAN-ausbau-3wochen.md](docs/PLAN-ausbau-3wochen.md)). Kein echter Spieler gemessen.
- **Erfolge** mit Produktionsbonus und **goldene Barren** (zufällig sichtbar, als reine Barren-Silhouette ohne Rahmen; per Klick oder Taste G einsammeln) mit Zeitbuffs.
- **Offline-Fortschritt**: Beim Laden wird die Abwesenheit nachgerechnet, auch laufende Timer werden abgearbeitet.
- **Mehr-Tab-Schutz**: Läuft das Spiel in einem zweiten Tab, pausiert dort das Speichern und eine Meldung erscheint. So überschreibt kein Tab den Fortschritt des anderen.
- **Einstellungen**: Zahlenformat (Standard / wissenschaftlich / Engineering), Autosave, Export und Import (Base64), Reset. Alte Spielstände werden automatisch migriert (aktuelle Save-Version: 6).

## Projektstruktur

```
index.html            Markup-Gerüst mit CSP-Meta, lädt js/main.js
css/styles.css
js/main.js            Bootstrap, Game-Loop, Autosave, Mehr-Tab-Schutz
js/boot-check.js      Fehlerhinweis bei file:// / Ladefehler (eigene Datei wegen CSP)
js/data/              reine Konfiguration: resources, generators, upgrades, recipes,
                      research, research-layout, eras, industry (Meilenstein-Leisten), corp (Konzern), timers, achievements, prestige, golden
js/core/              state, formulas, format, save (Migration, Export/Import, Offline),
                      events, multitab, i18n
js/i18n/              englische Texte (en-ui, en-data)
js/systems/           production, timers, prestige, achievements, golden, autobuyers,
                      eras, evolution, corp (Konzerngründung), industry (kein DOM)
js/ui/                render (Frame-Schleife), sidebar, cards, queues, panels, industry, corp, goals,
                      research-map, works (Werkshalle), lab (Labor), tabs,
                      assets (Icon-/Sprite-Zuordnung, symSvg), toast, effects, charts,
                      settings, static-i18n, dom
assets/sprites/       SVG-Sprites: gens, flasks, ui, items (Symbole statt Emojis, Datenfeld `sym`)
assets/icons/         einzelne res-* und gen-* Icons, Goldbarren
assets/bg/            Hintergründe: lab, works-floor, skyline
assets/preview.html   Vorschau aller Assets
tests/                Unit-Tests (node:test)
tools/                live.mjs, e2e.mjs, cdp.mjs, balance-sim.mjs (Prestige-Balance-Simulation: node tools/balance-sim.mjs [Stunden] [Klicks/s] [Anteil] [dt] [rate|frac]), balance-full.mjs (voller A1-Lauf beider Reset-Ebenen)
docs/                 Design und Reviews
```

Logik (`core/`, `systems/`, `data/`) berührt nie das DOM. Die UI spricht über Funktionsaufrufe und den Event-Bus (`core/events.js`).

## Tests

Unit-Tests (Node, keine Installation nötig):

```sh
node --test --test-timeout=900000 tests/*.test.mjs
```

`tests/balance.test.mjs` simuliert Spielzeit des Bots (beide Reset-Ebenen) und ist der längste Test. Der Balance-Test dauerte zuletzt ca. 163 s (Runde 2); frühere Messungen lagen bei ca. 147 s bis ca. 300 s (anderer Rechner). Setze das Zeitlimit großzügig hoch, wie oben.

Aktueller Stand: 531 Unit-Tests grün (519 + 12 in `balance.test.mjs`, `node --test tests/*.test.mjs`, Stand Runde 2; `balance.test.mjs` braucht zuletzt ca. 163 s). E2E sichtbar (ohne `--fast`, Chrome :9222): 99 PASS / 0 WARN / 0 FAIL, Szenarien a-n (2026-10-14).

### Balance-Lauf A1 (3 Wochen Spielzeit)

Der volle Lauf prüft, dass der Bot erst nach mindestens 504 h alles freigeschaltet hat (Korridor 504 bis 700 h):

```sh
node tools/balance-full.mjs
```

Dauer ca. 6 min in Schritt 6 (nach Runde 2 nicht neu gemessen). Exitcode 0, wenn der Zeitpunkt "ALLES FREIGESCHALTET" im Korridor liegt (zuletzt 602,3 h). Bot: Policy `rate`, Konzerngründung alle 40 h.

Andere Spielweisen und Konstanten lassen sich per Option messen (positionell oder `Name=Wert`): `maxHours` (Standard 800), `corpEvery` (Gründungstakt in Stunden, Standard 40), `hold` (Sekunden, Standard 3600), `minRun` (kürzester Durchlauf je Neuguss in Sekunden, Standard 300), `workHold` (1 = Werkbank-Erstaufträge früh abwarten). Konstanten überschreibt `Name.Pfad=Wert`. Für andere Spielweisen zählt nur die Untergrenze 504 h, der Exitcode gilt nur für den Bot:

```sh
node tools/balance-full.mjs workHold=1 minRun=15 hold=7200 corpEvery=17.7   # schnellste gefundene Spielweise, 538,4 h
node tools/balance-full.mjs CORP.capPerHour=0.7                           # Konstante überschreiben
``` Die Zeitleiste steht in [docs/GAME-DESIGN-2.md](docs/GAME-DESIGN-2.md), Abschnitt 6.4.

### Live-E2E im sichtbaren Chrome

`tools/e2e.mjs` steuert ein laufendes Chrome per DevTools-Protokoll (Szenarien a bis n: Start, Klick, Generatoren, Werk, Labor, Werkbank, Materialien, Speichern/Offline, Prestige, Export/Import, Layout, Performance, Konzern-Reiter).

Voraussetzungen:

1. Spiel-Server läuft auf http://localhost:8080.
2. Chrome läuft mit Debug-Port und hat einen Tab auf dem Spiel:

```sh
"C:/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir=<temp-ordner> http://localhost:8080/
```

```sh
node tools/e2e.mjs                    # alles, mit Pausen zum Zusehen
node tools/e2e.mjs --fast             # ohne Pausen
node tools/e2e.mjs --only=c,d,e       # nur bestimmte Szenarien (a läuft immer zuerst)
node tools/e2e.mjs --strict           # WARN zählen als Fehler
node tools/e2e.mjs --keep             # am Ende nicht auf frischen Spielstand zurücksetzen
```

Wichtig:

- Der Lauf **setzt den Spielstand im Browser zurück**. Vorher sichert er den localStorage als JSON in `E2E_DIR` (Standard: Scratchpad bzw. Temp-Ordner der Sitzung, sonst `tools/.e2e-out`). Er spielt die Sicherung nicht automatisch zurück.
- **Nie zwei E2E-Läufe parallel** starten. Parallele Läufe im selben Chrome erzeugen Schein-Fehler.
- Exit-Code 1 bei mindestens einem FAIL. Umgebungsvariablen: `CDP_PORT`, `GAME_URL`, `E2E_PAUSE_MS`, `E2E_DIR`.
- Der Lauf braucht ein **sichtbares** Chrome-Fenster. Ist `document.hidden` true (Fenster verdeckt), schlagen Toast- und Dialog-Schritte fehl. Abhilfe: Fenster in den Vordergrund holen oder per CDP `Target.createTarget({newWindow:true})` ein neues Fenster öffnen.

### Live-Steuerung

`tools/live.mjs` bedient dasselbe Chrome-Fenster von Hand:

| Befehl | Wirkung |
|---|---|
| `eval "<js>"` | JS im Spiel ausführen, Ergebnis ausgeben |
| `click "<selector>" [n]` | Element n-mal sichtbar anklicken |
| `tab <name>` | Tab wechseln (works, gens, industry, upgrades, research, prestige, corp, achievements, stats, settings) |
| `say "<text>"` | Statuszeile im Browser anzeigen |
| `reload` | Seite ohne Cache neu laden |
| `shot <datei.png>` | Screenshot speichern |
| `errors [ms]` | Konsolenfehler sammeln (Standard 3000 ms) |
| `check` | Reload, Fehler sammeln, Basis-DOM-Prüfung |

## Sicherheit

- Content-Security-Policy per Meta-Tag: `default-src 'none'`, Skripte, Styles und Bilder nur von `'self'`, `connect-src 'none'`. Es gibt keine Inline-Skripte und keine externen Ressourcen.
- Das Debug-Objekt `window.__eisenwerk` (state, Formeln, Timer, Kauf, Speichern) wird nur auf `localhost` und `127.0.0.1` bereitgestellt. Die Tools nutzen es.
- Import-Daten werden beim Laden gegen die Spieldaten geprüft und begrenzt.

## Dokumentation

- [PROGRESS.md](PROGRESS.md): Auftrag, Stand und Entscheidungen der Entwicklung
- [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md): Ressourcenkette, Timer, Evolution, Balance
- [docs/GAME-DESIGN-2.md](docs/GAME-DESIGN-2.md): 2. Reset-Ebene (Konzerngründung), Industrie-Ausbau, kalibrierte Werte und Zeitleiste
- [docs/PLAN-ausbau-3wochen.md](docs/PLAN-ausbau-3wochen.md): Plan, Zwischenstände und Entscheidungen D1 bis D13 des Ausbaus
- [docs/SPEC-design.md](docs/SPEC-design.md): UX- und Design-Spezifikation
- [docs/SPEC-design-2.md](docs/SPEC-design-2.md): UI-Spezifikation des Ausbaus (Konzern-Reiter, Industrie-Leisten)
- [docs/REVIEW-logic.md](docs/REVIEW-logic.md): Logik- und Security-Review
