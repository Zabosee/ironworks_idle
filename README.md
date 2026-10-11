# Eisenwerk Idle

Ein deutschsprachiges Idle-Game im Browser (Vanilla ES-Module, kein Build-Schritt, keine Abhängigkeiten).

## Starten

ES-Module funktionieren nicht über `file://`. Zuerst in den Spielordner wechseln, dann einen beliebigen statischen Webserver starten:

```sh
cd eisenwerk-idle
python -m http.server 8080
# oder: npx serve .
```

Danach `http://localhost:8080` (bzw. die von `serve` angezeigte Adresse) öffnen.

## Spielprinzip

- Erz sammeln (großer Knopf), Generatoren kaufen (alle 10 Stufen Produktion x2, ab Stufe 10 kostet jede Stufe Titan).
- Forschung und Elite-Boosts erhöhen die Produktion; Kaufmenge x1 / x10 / x100 / Max.
- Hochofen-Neuguss (Prestige): Gussformen geben dauerhaft +% Produktion, Meilensteine und einen Shop (inkl. Auto-Buyer).
- Erfolge mit Produktionsbonus, goldene Barren (zufällig, 15 s sichtbar, Taste G) mit Zeitbuffs.
- Einstellungen: Zahlenformat (Standard / wissenschaftlich / Engineering), Autosave, Export/Import (Base64), Reset.
- Alte Spielstände (`eisenwerk-idle-save`) werden automatisch übernommen.

## Struktur

```
eisenwerk-idle/
index.html              Markup-Gerüst (mit CSP-Meta), lädt js/main.js
css/styles.css
js/main.js              Bootstrap, Game-Loop, Autosave
js/boot-check.js        Fehlerhinweis bei file:// / Ladefehler (eigene Datei wegen CSP)
js/data/                reine Konfiguration (Ressourcen, Generatoren, Upgrades, Rezepte, Forschung, Erfolge, Prestige, Golden)
js/core/                state, formulas, format, save (Migration, Export/Import, Offline), events
js/systems/             production, prestige, achievements, golden, autobuyers (kein DOM)
js/ui/                  render, tabs, toast, effects, charts, settings, dom
README.md
```

Logik (`core/`, `systems/`, `data/`) berührt nie das DOM; die UI kommuniziert über Funktionsaufrufe und den Event-Bus (`core/events.js`).
