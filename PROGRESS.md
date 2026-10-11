# Fortschritt / Übergabe (Checkpoints)

Diese Datei ist der Wiederaufsetzpunkt, falls eine Sitzung abbricht (Tokenlimit o.ä.).
Jeder abgeschlossene Schritt wird als Git-Commit in diesem Ordner gesichert (`git log --oneline`).

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
- Tests: `node --test` in `eisenwerk-idle/`
- Live-Browser: Chrome mit `--remote-debugging-port=9222`, gesteuert über `node tools/live.mjs <befehl>`

## Status
- [x] Checkpoint 0: Ausgangsstand (176/176 Tests grün, Redesign mit SVGs)
- [x] Phase 1: Review → docs/REVIEW-logic.md (Logik+Security), docs/SPEC-design.md (UX+Konzept)
- [x] Phase 2a: backend-developer – Review-Fixes + Ressourcen datengetrieben + Security-Härtung
- [x] Phase 2b: backend-developer – Timer-System, neue Materialien/Generatoren/Upgrades, Save v3, docs/GAME-DESIGN.md
- [x] Parallel zu 2b: ui-designer – SVG-Assets (assets/sprites/gens.svg, flasks.svg, ui.svg, bg/lab.svg, bg/works-floor.svg, neue res-/gen-Icons, assets/preview.html)
- [x] Phase 3: UI (Kaufmenge nur Generatoren, Generator-Showcase mit Evolutionsstufen, Labor-Look, Timer-Anzeige)
- [ ] Phase 4: Live-Tests im Browser
- [ ] Phase 5: release-gatekeeper >= 7

## Notizen / Entscheidungen
- Live-Browser starten: `"C:/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir=<tmp> http://localhost:8080/`
- Security-Review (fertig): keine ausnutzbare Lücke. To-do: CSP-Meta (Inline-Script nach js/boot-check.js, Ember-Inline-Styles in CSS), legacy/ nicht deployen, Stats auf 1e300 klemmen, Import-Limit ~200k.
- Phase 3A erledigt: Kaufmenge als sticky radiogroup (.gens-toolbar) nur im Generatoren-Tab; Tabs mit ui.svg-Icons, Tab-Werk als Standard (HTML-Gerüst).
- Phase 3B erledigt: js/ui/works.js (Werkshalle, Lanes, Rang-Paletten, Evolve-Glow/Toast, Pop, Idle-Anim), GEN_SPRITE-Mapping in js/ui/assets.js, tests/phase3.test.mjs.
- Phase 3C erledigt: Labor-Look (js/ui/lab.js, .flask-card, Kolben nach cat, --p Füllstand, Wellen/Bläschen/Dampf, progressbar).
- Phase 3D erledigt: .queue-bar/.slot-chip (Abbrechen mit Erstattung), .timer-ring auf Boost/Klick-Karten, Tab-Badges, Fertig-Aufblitzen (render.js).
- Phase 3E erledigt: Sidebar-Gruppe 'Weitere Materialien', res-/gen-Icons (assets.js), Emojis durch ui.svg ersetzt, Kontrast/CSS-Duplikate, mobile Leiste + FAB.
