# Eisenwerk Idle

Deutschsprachiges Idle-Game im Browser: Aus Erz wird Stahl, Titan und Gold. Vanilla ES-Module, kein Build-Schritt, keine Abhängigkeiten, keine externen Ressourcen.

## Starten

ES-Module laufen nicht über `file://`. Starte einen statischen Webserver im Ordner `eisenwerk-idle`.

```sh
cd eisenwerk-idle
py -m http.server 8080      # Windows (dort ist `python` oft nur der Store-Stub)
# oder: npx serve .
```

Öffne danach http://localhost:8080 (bzw. die Adresse, die `serve` ausgibt).

## Spielprinzip

- **Werkshalle (Standard-Tab "Werk")**: Zeigt für jeden Generator Bilder passend zur Anzahl. Die Bilder entwickeln sich mit der Stufe über fünf Evolutionsränge: Holz (ab Stufe 1), Eisen (10), Stahl (25), Titan (50), Gold (100).
- **Generatoren**: Hier, und nur hier, stellst du die Kaufmenge ein (x1 / x10 / x100 / Max). Alle 10 Stufen verdoppelt sich die Produktion.
- **Materialien und Produktionsketten**: Neben Erz, Stahl und Titan gibt es Kohle, Koks, Kupfer, Mangan, Chrom, Nickel, Legierung, Wolfram und Gold. Rezepte laufen automatisch (z. B. Kohle zu Koks, Erz und Koks zu Stahl, Wolfram zu Gold). Ein Material erscheint in der Oberfläche, sobald seine Forschung abgeschlossen ist oder ein Vorrat existiert. Details: [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md).
- **Labor und Werkbank (Timer)**: Forschung läuft im Labor, Boosts und Klick-Upgrades auf der Werkbank. Der Kauf zieht die Kosten sofort ab, der Effekt greift erst nach Ablauf der Zeit. Jede Warteschlange hat einen aktiven Slot und drei Warteplätze (im Hochofen-Shop erweiterbar). Abbrechen erstattet wartende Aufträge zu 100 %, laufende zu 50 %.
- **Hochofen-Neuguss (Prestige)**: Gussformen geben dauerhaft Produktionsbonus. Dazu kommen Meilensteine und ein Shop (u. a. Auto-Buyer, Zusatzplätze, Zeitraffer).
- **Erfolge** mit Produktionsbonus und **goldene Barren** (zufällig sichtbar, per Klick oder Taste G einsammeln) mit Zeitbuffs.
- **Offline-Fortschritt**: Beim Laden wird die Abwesenheit nachgerechnet, auch laufende Timer werden abgearbeitet.
- **Mehr-Tab-Schutz**: Läuft das Spiel in einem zweiten Tab, pausiert dort das Speichern und eine Meldung erscheint. So überschreibt kein Tab den Fortschritt des anderen.
- **Einstellungen**: Zahlenformat (Standard / wissenschaftlich / Engineering), Autosave, Export und Import (Base64), Reset. Alte Spielstände werden automatisch migriert (aktuelle Save-Version: 4).

## Projektstruktur

```
index.html            Markup-Gerüst mit CSP-Meta, lädt js/main.js
css/styles.css
js/main.js            Bootstrap, Game-Loop, Autosave, Mehr-Tab-Schutz
js/boot-check.js      Fehlerhinweis bei file:// / Ladefehler (eigene Datei wegen CSP)
js/data/              reine Konfiguration: resources, generators, upgrades, recipes,
                      research, timers, achievements, prestige, golden
js/core/              state, formulas, format, save (Migration, Export/Import, Offline),
                      events, multitab
js/systems/           production, timers, prestige, achievements, golden, autobuyers (kein DOM)
js/ui/                render, tabs, works (Werkshalle), lab (Labor), assets (Icon-/Sprite-Zuordnung),
                      toast, effects, charts, settings, dom
assets/sprites/       SVG-Sprites: gens, flasks, ui, items
assets/icons/         einzelne res-* und gen-* Icons, Goldbarren
assets/bg/            Hintergründe: lab, works-floor, skyline
assets/preview.html   Vorschau aller Assets
tests/                Unit-Tests (node:test)
tools/                live.mjs, e2e.mjs, cdp.mjs, balance-sim.mjs (Prestige-Balance-Simulation: node tools/balance-sim.mjs [Stunden] [Klicks/s] [Anteil] [dt] [rate|frac])
docs/                 Design und Reviews
```

Logik (`core/`, `systems/`, `data/`) berührt nie das DOM. Die UI spricht über Funktionsaufrufe und den Event-Bus (`core/events.js`).

## Tests

Unit-Tests (Node, keine Installation nötig):

```sh
node --test
```

### Live-E2E im sichtbaren Chrome

`tools/e2e.mjs` steuert ein laufendes Chrome per DevTools-Protokoll (Szenarien a bis m: Start, Klick, Generatoren, Werk, Labor, Werkbank, Materialien, Speichern/Offline, Prestige, Export/Import, Layout, Performance).

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

### Live-Steuerung

`tools/live.mjs` bedient dasselbe Chrome-Fenster von Hand:

| Befehl | Wirkung |
|---|---|
| `eval "<js>"` | JS im Spiel ausführen, Ergebnis ausgeben |
| `click "<selector>" [n]` | Element n-mal sichtbar anklicken |
| `tab <name>` | Tab wechseln (works, gens, upgrades, research, prestige, achievements, stats, settings) |
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
- [docs/SPEC-design.md](docs/SPEC-design.md): UX- und Design-Spezifikation
- [docs/REVIEW-logic.md](docs/REVIEW-logic.md): Logik- und Security-Review
