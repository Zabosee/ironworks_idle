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

## Ausbau "2. Reset-Ebene, 3 Wochen Spielzeit" (2026-10-12/13)
Auftrag: klarer Idle-Kreislauf, Industrie ausbauen, 2. Reset-Ebene nach einer Anzahl Neugüsse, mindestens 3 Wochen bis alles freigeschaltet ist. Plan, Zwischenstände und Entscheidungen D1 bis D13: `docs/PLAN-ausbau-3wochen.md`. Design: `docs/GAME-DESIGN-2.md`. UI-Spec: `docs/SPEC-design-2.md`.

- Plan-Schritte 0 bis 8 erledigt. Schritt 9: Browser-Abnahme erledigt (11 Befunde behoben: Werk-Lanes nach Gründung, Zielleisten-Balken, Mobil-Tabelle Industrie, Texte, Restzeit "> 1 Jahr", Zahlenformat Erfolge, Zeitalter-Raster, EN Lost/Kept, Sperrtext Auto-Buyer; Nachprüfung im Browser grün).
- **2. Reset-Ebene**: Konzerngründung mit Patenten (Runde 2: `CORP.divisor` 1500, Wurzelformel mit Zeitdeckel 0,68 Patente/h, siehe unten; Schritt 6: linear 52.000), Konzern-Reiter ab Neuguss 25 gesperrt sichtbar, nutzbar ab 100. Konzernstufen K1 bis K7 (Runde 2: 10 / 30 / 70 / 135 / 210 / 290 / 351 Patente; Schritt 6: 3 / 7 / 21 / 46 / 80 / 139 / 205), Konzern-Shop mit 9 Einträgen (Runde 2: Summe 351; Schritt 6: 205), Auto-Neuguss, Zielleiste, Neuguss-Vorschau. Save-Version 6 (`state.corp`, `state.autoCast`).
- **Industrie**: Zeitalter 6 -> 9 (neu: Atomzeitalter, Raumfahrt, Kosmische Schmiede bei 8e26 / 8e27 / 8e28 Erz), Generator-Ausbau VI bis VIII, zwei Meilenstein-Leisten (Fördermenge 8 Stufen, Materialvielfalt 7 Stufen).
- **Umfang (Code-Werte geprüft)**: Forschungen 76 -> 125 (49 Konzernforschung; Schritt 6: 112 mit 36), Boosts 31 -> 43 (Schritt 6: 39), Klick-Upgrades 6 -> 10 (Schritt 6: 9), Materialien 12 -> 19, Generatoren 14 -> 21, Rezepte 6 -> 10, Zeitalter 6 -> 9, Ausbaustufen 5 -> 8.
- **Kalibrierung (Schritt 6, überholt durch Runde 2, siehe unten)**: Bot `rate`, Gründung alle 40 h, `node tools/balance-full.mjs` (ca. 6 min, Exitcode 0): ALLES FREIGESCHALTET bei 591,3 h (Korridor 504 bis 700 h). Konzern-Reiter 13,4 h, K1 bis K7 bei 34 / 74 / 154 / 234 / 314 / 434 / 554 h, Zeitalter 6 / 7 / 8 bei 301 / 386 / 498 h, Fördermenge A5 bis A8 bei 177 / 370 / 470 / 590 h. Zeitalter 2 bis 5: 55 / 106 / 114 / 114 h mit Konzern, 36 / 69 / 99 / 153 h ohne (balance.test). Volle Zeitleiste: `docs/GAME-DESIGN-2.md` 6.4.
- **Tests**: Unit 423 -> 525 (Schritt 6), nach Runde 2 531/531 (519 ohne balance + 12 balance, `node --test tests/*.test.mjs`); neu `corp.test.mjs`, `corp-ext.test.mjs`. E2E sichtbar 87 -> 99 (Szenario n: Konzern-Reiter); E2E sichtbar (ohne `--fast`, Chrome :9222) 99 PASS / 0 WARN / 0 FAIL, Szenarien a-n (2026-10-14). Befehl: `node --test --test-timeout=900000 tests/*.test.mjs`.

## Runde 2 (2026-10-13/14): Konzern konkav und gedeckelt, mehr Forschung, Industrie stärker
Auftrag Lukas: A1 robuster machen (D11), Konzernforschung teurer (D10), mehr Forschung, Industrie prüfen, Goldbarren-Popup nur als Silhouette. Schritte 11 bis 13 in `docs/PLAN-ausbau-3wochen.md`.

- **Goldbarren-Popup (Schritt 11)**: `.golden` ohne Hintergrund, Rahmen und box-shadow; Glow per `drop-shadow` an der Silhouette, Glanzstreifen per `mask` auf die Barrenform begrenzt, Fokus als blauer `drop-shadow` (`:focus-visible`). Button, aria-label und reduced-motion unverändert. Der Glanz ist nur als Standbild geprüft.
- **Umfang (Schritt 12a)**: +13 Konzernforschungen (jetzt 125 Forschungen, davon 49 Konzern), +4 Boosts (43), +1 Klick-Upgrade (`asteroidpick`, 10). Letzte Forschung ist `c_cosmic` (Kosmische Schmiede). Neue Effektkonstanten in `js/data/timers.js` (`timeMult`, `offlineCapSeconds`).
- **D10 Kosten**: Konzernforschungs-Kosten nach Konzernstufe skaliert (`CORP_COST_ORE` = 1 / 1 / 54 / 360 / 360 / 340 / 360 für Erz und Stahl, `CORP_COST_MAT` = 1 / 1 / 2 / 3 / 4 / 5 / 6 für Materialien, `js/data/research.js`). K4 mindestens 1e25 Erz, K7 mindestens 1e28 Erz. Test: Erzkosten je Stufe mindestens x5, Dauer <= 22000 s.
- **D11/D12 Patente**: `corpGain = min( floor( sqrt(Gussformen / D) × (1 + 0,1 × c_gain) ), floor(capPerHour × Stunden seit der letzten Gründung) )` mit `CORP.divisor` = 1500 und `CORP.capPerHour` = 0,68 (zuerst 0,72, nach Nachmessung gesenkt). Ersetzt die lineare Formel (D4). Der Deckel zählt Offline-Zeit mit (`stats.corpRunTime`) und ist nicht umgehbar. Shop-Summe 351, K1 bis K7 = 10 / 30 / 70 / 135 / 210 / 290 / 351. Der Konzern-Reiter erklärt Wurzel und Deckel.
- **D13 Industrie**: späte Stufen angehoben, A5 bis A8 = 1,20 / 1,25 / 1,35 / 1,50, B4 bis B7 = 1,15 / 1,20 / 1,25 / 1,35 (Produkt beider Leisten ca. x4,9 -> x10,9).
- **Gemessene Zeiten** (`tools/balance-full.mjs`, aktive Spielzeit bis ALLES FREIGESCHALTET; nach Runde 2 neu gemessen, schnellste Spielweise 538,4 h, vom release-gatekeeper unabhängig mit 537,2 h reproduziert; release-gatekeeper Runde 2 am 2026-10-14: Freigabe 8/10, Unit 532/532): Bot `rate` (Gründung alle 40 h) **602,3 h** (Korridor 504 bis 700 h). K1 bis K7 bei 34 / 114 / 194 / 274 / 394 / 514 / 594 h, Zeitalter 6 / 7 / 8 bei 258 / 344 / 462 h, Superlegierung 527 h, Fördermenge A8 539 h. Letztes Tor ist überall der Konzern-Shop (K7).

  | Spielweise | ALLES |
  |---|---|
  | Bot `rate`, Gründung alle 40 h | 602,3 h |
  | `workHold`, `minRun` 15, `hold` 7200, Gründung alle 17,7 h (schnellste gefundene) | **538,4 h** |
  | dieselbe Spielweise, Takt 14,7 h | 552,0 h |
  | dieselbe Spielweise, Takt 12,5 h | 557,5 h |
  | Bot, Gründung nur alle 80 h (nur Info) | 762,2 h |

  Rechnerische Untergrenze: 351 / 0,68 = 516 h. A1 und D11 sind erfüllt (schnellste Spielweise >= 504 h, Bot <= 700 h). Frühere Stände zum Vergleich: Schritt 6 (linear 52.000) Bot 591,3 h, schnelle Spielweisen 319 bis 520 h.
- **Einschränkungen**: A1 ist weiter nur für den Bot und einige gesuchte Spielweisen gemessen, kein echter Spieler. Sehr seltene Gründungen werden bestraft (80 h Takt: 762 h). Zeitalter 2 bis 5 (Schritt 6: 55 / 106 / 114 / 114 h mit Konzern) und die Zeit der Kobalt-Forschung wurden nach Runde 2 nicht neu gemessen. Offen laut Plan: Titan und Legierung in Konzernprozessen billig, Forschungskarte im Browser ungeprüft.
- **UI offen (Stand Schritt 9, nicht neu geprüft)**: Einklapp-Zustand der Materialgruppen nicht gespeichert; Konzern-Ast zeigt K1 bis K7 als Knoten-Abzeichen statt Zwischenüberschriften; Kartenansicht nach "Konzernforschung öffnen" wird teils vom Auto-Fit überschrieben; E2E deckt Mobil-Layout des Konzern-Reiters, Chronik-Tabelle und v5-Import-Migration nicht ab.
