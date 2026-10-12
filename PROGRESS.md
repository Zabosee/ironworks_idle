# Fortschritt / Übergabe (Checkpoints)

Diese Datei ist der Wiederaufsetzpunkt, falls eine Sitzung abbricht (Tokenlimit o.ä.).
Dieser Ordner ist ein Git-Repository (Remote `origin`, Branch `main`). Zwischenstände stehen in dieser Datei und in den Docs, abgeschlossene Schritte werden committet (`git log --oneline`).

## Auftrag (Lukas, 2026-10-11)
1. Gesamtes Spiel mit allen Subagents logisch reviewen.
2. Kaufmenge (x1/x10/x100/Max) nur noch im Generatoren-Tab anzeigen.
3. Hauptanzeige: echte Bilder für die Anzahl jedes Generators; Bilder entwickeln sich bei neuer Stufe (alle 10 Level / Meilenstein) weiter.
4. Forschung soll wie ein Labor aussehen.
5. Timer: Upgrades/Forschung werden nicht sofort freigeschaltet, sondern nach einer Laufzeit.
6. Weitere Upgrades, Generatoren und Materialien (Vorbild: Revolution Idle).
7. Freigabe erst, wenn der release-gatekeeper zufrieden ist (>= 7/10).
8. Zwischenstände speichern (diese Datei + Git-Commits).
9. Aufgaben und Tests live im sichtbaren Browser durchführen (Chrome via CDP, `tools/live.mjs`).

## Umgebung
- Spiel: `eisenwerk-idle/`, Server: `py -m http.server 8080` in diesem Ordner → http://localhost:8080
- Tests: `node --test --test-timeout=900000` in `eisenwerk-idle/`. `tests/balance.test.mjs` simuliert bis zu 336 h Spielzeit und braucht ca. 265 s; Aufrufe mit kürzerem Zeitlimit (unter ca. 300 s) brechen ab.
- Live-Browser: Chrome mit `--remote-debugging-port=9222`, gesteuert über `node tools/live.mjs <befehl>`

## Status
- [x] Checkpoint 0: Ausgangsstand (176/176 Tests grün, Redesign mit SVGs)
- [x] Phase 1: Review → docs/REVIEW-logic.md (Logik+Security), docs/SPEC-design.md (UX+Konzept)
- [x] Phase 2a: backend-developer – Review-Fixes + Ressourcen datengetrieben + Security-Härtung
- [x] Phase 2b: backend-developer – Timer-System, neue Materialien/Generatoren/Upgrades, Save v3, docs/GAME-DESIGN.md
- [x] Parallel zu 2b: ui-designer – SVG-Assets (assets/sprites/gens.svg, flasks.svg, ui.svg, bg/lab.svg, bg/works-floor.svg, neue res-/gen-Icons, assets/preview.html)
- [x] Phase 3: UI (Kaufmenge nur Generatoren, Generator-Showcase mit Evolutionsstufen, Labor-Look, Timer-Anzeige)
- [x] Phase 4: Live-Tests im Browser (tools/e2e.mjs, 82/82 PASS) + Fixes (Phase 4b)
- [x] Phase 5: release-gatekeeper 1. Durchlauf: 7/10, Freigabe ja (teilweise: Emojis→SVG, Review-Befunde 7/8/Mehr-Tab, README veraltet)
- [x] Release-Runde: Emojis durch SVG (items.svg) ersetzt, Befunde 7 und 8 sowie Mehr-Tab-Schutz erledigt, README aktualisiert. 299 Unit-Tests grün, E2E 82/82 PASS. Hinweis: E2E-Läufe nie parallel starten, parallele Läufe im selben Chrome erzeugen Schein-Fehler.
- [x] Gatekeeper 2. Durchlauf: 8/10, FREIGEGEBEN (keine Blocker). Offene Empfehlungen: render.js aufteilen, leere Forschungsebenen ausblenden, Werk-Hinweis max. 10 Sprites, Emoji-Fallbacks entfernen.

## Notizen / Entscheidungen
- Live-Browser starten: `"C:/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir=<tmp> http://localhost:8080/`
- Security-Review (fertig): keine ausnutzbare Lücke. To-do: CSP-Meta (Inline-Script nach js/boot-check.js, Ember-Inline-Styles in CSS), legacy/ nicht deployen, Stats auf 1e300 klemmen, Import-Limit ~200k.
- Phase 3A erledigt: Kaufmenge als sticky radiogroup (.gens-toolbar) nur im Generatoren-Tab; Tabs mit ui.svg-Icons, Tab-Werk als Standard (HTML-Gerüst).
- Phase 3B erledigt: js/ui/works.js (Werkshalle, Lanes, Rang-Paletten, Evolve-Glow/Toast, Pop, Idle-Anim), GEN_SPRITE-Mapping in js/ui/assets.js, tests/phase3.test.mjs.
- Phase 3C erledigt: Labor-Look (js/ui/lab.js, .flask-card, Kolben nach cat, --p Füllstand, Wellen/Bläschen/Dampf, progressbar).
- Phase 3D erledigt: .queue-bar/.slot-chip (Abbrechen mit Erstattung), .timer-ring auf Boost/Klick-Karten, Tab-Badges, Fertig-Aufblitzen (render.js).
- Phase 3E erledigt: Sidebar-Gruppe 'Weitere Materialien', res-/gen-Icons (assets.js), Emojis durch ui.svg ersetzt, Kontrast/CSS-Duplikate, mobile Leiste + FAB.
- Phase 4b erledigt (E2E-Befunde): settings.js ohne gecachte state-Referenz (setSetting in state.js, tests/settings-ui.test.mjs); resVisible nutzt stats.run statt stats.total (Meter nach Neuguss wieder verborgen); #works-empty erscheint ohne gebauten Generator; Tab-Leiste umbricht (Desktop) bzw. zeigt mobil nur Symbole + aktives Label (title-Attribute); Orb-Zahlen klein/kurz/geclippt (max. 3 je Orb), Partikel-Sicherheitsnetz (1,6 s). E2E 82 PASS / 0 WARN / 0 FAIL, 280 Unit-Tests grün. Offen: Befund 6 (Emojis in Upgrades/Hochofen-Shop/Erfolgen durch SVG ersetzen, ca. 40+ Symbole) nicht umgesetzt.
- Nach Freigabe (Nutzerwünsche): Hochofen exponentiell (growth 1,05, Meilensteine 5/25/150/1.000/10.000/250.000, Shop neu balanciert, tools/balance-sim.mjs); Neuguss-Chronik + Sidebar-Zähler; Kachel-Aufleuchten beim Tabwechsel behoben (Einmal-Animationsklassen werden entfernt). E2E-Szenario m misst nach erzwungener GC (vorher Schein-Leak direkt nach Reload). Stand: 315 Unit-Tests, E2E 86/86 PASS.

## Aktueller Stand (2026-10-11, Zeitalter/Industrie/Sprache)
- Sprachauswahl DE/EN (`js/core/i18n.js`, `js/i18n/`, `js/ui/static-i18n.js`, Einstellungen).
- Langsamere Progression: Zeitalter hängen an kumulierten Erz-Schwellen; kalibrierter Sim-Lauf (`tools/balance-sim.mjs 175 4 1 30 rate`): 1. Neuguss 1,8 h, Zeitalter 1 bei 7,5 h, 2 bei 38 h, 3 bei 96 h, 4 bei 128 h, 5 bei ca. 192 h. Schneller Standardlauf (ohne Parameter): 1. Neuguss 2,6 h, Zeitalter 1 bis 5 bei 4,7 / 6,6 / 13,3 / 14,9 / 15,1 h. Details und Einordnung: docs/GAME-DESIGN.md, Abschnitt 3b.
- Industrie-Tab (Generator-Ausbau) und Zeitalter erst ab dem 1. Neuguss; alte Spielstände werden nicht migriert.
- 76 Forschungen (Zeitalter 0 bis 5), 15 neue Zeitalter-Boosts, 2 neue Klick-Upgrades (`hydraulic`, `plasmalance`).
- Tests: 423 Unit-Tests grün (`tests/balance.test.mjs` besteht 10/10, Laufzeit ca. 265 s, Gesamtlauf mit `--test-timeout=900000` bzw. Zeitlimit >= 300 s), E2E 87/87 PASS (E2E nicht erneut ausgeführt; Angabe aus dem früheren Lauf).
- Freigabe: release-gatekeeper 8/10.
- UI-Umbau (nach der Freigabe):
  - Sidebar: Der Ofen (Klickzone `#click-zone`) steht oben. Die Konvertierungsraten stehen unter dem jeweiligen Output-Material (`.meter-flows`); der eigene Block `#conv` ist entfernt.
  - `render.js` ist aufgeteilt: `render.js` (120 Zeilen, Frame-Schleife), `sidebar.js`, `cards.js`, `queues.js`, `panels.js`.
  - Emojis sind durch SVG ersetzt: Sprites `assets/sprites/items.svg` und `ui.svg`, Helfer `symSvg`/`svgUse` in `js/ui/assets.js`. Das Forschungs-`sym` kommt über die Tabelle `SYM` in `js/data/research.js` aus dem Emoji `icon`. Die Statusbadges der Forschungskarte laufen bereits über SVG (`research-map.js`).
  - Bug behoben: `sym-factory` in `items.svg` hatte einen falschen `viewBox`.
  - Docs mit dem Code abgeglichen (Zeitalter-Schwellen, Forschungs-/Boost-/Klick-Tabellen in GAME-DESIGN.md, Plan und Spec als historisch markiert).
- Offene Punkte: Erster Neuguss erst nach ca. 2 h, bis dahin kein Industrie-Tab (Designrisiko, siehe GAME-DESIGN.md Abschnitt 8); kein echter Spieler gemessen.
- Frühere Empfehlungen, aktueller Stand:
  - render.js aufteilen: erledigt (siehe oben).
  - Leere Forschungsebenen ausblenden: gegenstandslos. Die Forschungskarte hat keine Ebenen/Regale; Knoten werden per `hidden` ausgeblendet.
  - Emoji-Fallbacks entfernen: teilweise erledigt. Die Oberfläche zeigt SVG; die Datenfelder `icon` (und `sym` als SVG-Name) bleiben als Textfallback in den Daten und werden z. B. in `cards.js`, `panels.js`, `research-map.js` genutzt, wenn kein `sym`/Bild existiert.
  - Werk-Hinweis max. 10 Sprites: unklar/offen, im Code nicht geprüft.
