# Logik-Review (code-reviewer, 2026-10-11) – Befunde zur Abarbeitung

## Kritisch/Hoch (vor Umbau beheben)
1. main.js:28-33 / save.js:127-130 – `load()` mit `error:true` (Parse-Fehler oder v > SAVE_VERSION) wird ignoriert → Autosave überschreibt Spielstand. Fix: Rohstring nach `SAVE_KEY+'-backup'` sichern, Toast, Autosave aussetzen bis Entscheidung.
2. main.js:31-32 vs 35 – Offline-/Migrations-Toasts feuern vor `initToasts` → gehen verloren. Fix: initToasts vorziehen oder puffern.
3. main.js:52 / save.js:179 – >10 s Tab im Hintergrund → `applyOffline` setzt `state.buffs=[]`. Fix: Laufzeitpfad zieht Buff-Restzeit ab statt zu löschen.

## Mittel
4. Kaufmenge wirkt auf Klick-Upgrade/Boosts/Forschung (render.js:204, :122, production.js:39). Fix: `buy()` nutzt settings.buyAmount nur bei kind==='gen'.
5. Doppelter refresh beim Kauf (render.js:45-51 + :123); `forceRefresh` Alias.
6. Hammerwut ×25 fließt über autoclick/resonance in Erzrate (formulas.js:88-89) → ~×6-7 Rate. Buff nur auf manuelle Klicks.
7. Konverter-Stahl ignoriert Stahl-Multiplikatoren (formulas.js:90-94) – Design entscheiden.
8. Autobuyer ohne Priorität, fix 5 Käufe/2 s (autobuyers.js:13-18).
9. Kein save() nach Prestige/Shop-Kauf → Reload-Exploit (prestige.js:9-37).
10. Performance: bulkPlan "Max" bis 1000 Iterationen pro Karte 10×/s (formulas.js:146-166) → geschlossene Formel/Cache; updateOrbs DOM-Lookups pro Tick (effects.js:71-84) cachen.
11. stats.total* ohne Deckel (state.js:46-48); kein Mehr-Tab-Schutz; visibilitychange/pagehide speichern trotz Autosave aus (main.js:63-64).

## Niedrig
12. achievements.js:27,29-30 hart codiert 11/6 → RESEARCH.length/BOOSTS.length.
13. Tooltip ore_ "1·10^3"; kind0-Wrapper (render.js:228); lastRates-Seiteneffekt (render.js:28); safe() fängt -Infinity nicht (formulas.js:13); Autobuyer-acc/Golden-Timer bei loaded/prestige nicht reset; legacy/ toter Code.

## Architektur für neue Features
- Alle Käufe: production.buy (production.js:39); Sperre: formulas.lockReason (:129-139); dazu render.describe/onCard, autobuyers.js:16-17.
- Timer-State in defaultState, sanitize, levelOf, bulkPlan, lockReason ("läuft"); Tick in main.js:53-56 und applyOffline; Prestige-Verhalten festlegen.
- Save: SAVE_VERSION=2, Key-Suffix -v2, migrate-Platzhalter save.js:89; sanitize ist Whitelist → neue Felder dort ergänzen.
- Ressourcen nur teilweise datengetrieben: formulas.rates() festes Objekt (:82), state.addResource Sonderfälle (:46-48), render.renderTop/main conv-Text.
- GEN.req nur ein String → Array; CLICK-Singleton fest verdrahtet → Liste für wiederholbare Upgrades.
- Testlücken: Ladefehler, Boot-Reihenfolge, Offline-Loop-Pfad, Hammerwut×Autoklick, safe(-Infinity), Kaufmenge Nicht-Generatoren, Prestige mit offenem Barren, Autobuyer-Priorität; keine UI-Tests.

# Security-Review (security-auditor) – Härtung
- CSP-Meta einführen (Inline-Script → js/boot-check.js, Ember-Inline-Styles → CSS nth-child): `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'`.
- legacy/ (Tailwind-CDN, innerHTML, gleicher localStorage) nicht ausliefern → entfernen.
- Stats auf 1e300 klemmen; Import-Limit 2.000.000 → ~200.000 Zeichen.

# Erledigt in Phase 2a
Punkt -> Datei (Tests: tests/phase2a.test.mjs, angepasst: formulas/production/prestige/save/smoke/systems)
1. Ladefehler überschreiben Spielstand nicht mehr (Backup `…-backup`, Speichern gesperrt bis Import/Reset, Toast) -> js/core/save.js (load, save, isSaveLocked), js/main.js, js/ui/settings.js (Meldung)
2. Toasts vor load() initialisiert -> js/main.js (initToasts als erster Schritt in boot)
3. Hintergrund-Tab löscht Buffs nicht mehr (applyOffline(dt, { runtime: true }) kürzt Restzeit) -> js/core/save.js, js/main.js
4. Kaufmenge nur für Generatoren (buy ohne Menge: 1 für alle anderen; UI übergibt 1) -> js/systems/production.js, js/ui/render.js
5. Doppelter Refresh entfernt, forceRefresh-Alias gelöscht -> js/ui/render.js
6. Hammerwut nur auf manuelle Klicks (Autoklick nutzt den ungebufften Klickwert) -> js/core/formulas.js (rates)
9. Speichern nach Neuguss/Shop-Kauf (bei Autosave an) -> js/systems/prestige.js, js/core/save.js (autoSave)
10. bulkPlan Max: gecachte Summenreihe + Galopp/Binärsuche (Ergebnis identisch zur alten Schleife, per Referenztest belegt) -> js/core/formulas.js; updateOrbs cached Elemente -> js/ui/effects.js
11. Stats auf 1e300 geklemmt -> js/core/state.js; pagehide/visibilitychange speichern nur bei Autosave an -> js/main.js. Offen: kein Mehr-Tab-Schutz.
12. Erfolge "alle Forschungen/Boosts" aus Datenlänge -> js/data/achievements.js
13. Tooltip `1·10^3` -> js/data/achievements.js; kind0 entfernt, lastRates-Seiteneffekt beim Modulladen entfernt -> js/ui/render.js; safe(-Infinity) -> js/core/formulas.js; acc/Golden-Reset bei loaded/prestige -> js/systems/{autobuyers,achievements,golden}.js + js/main.js; legacy/ gelöscht -> README.md

Fundament (Punkt 2 der Aufgabe)
- rates(): Objekt mit Eintrag je RES_IDS + `click` + `flows` -> js/core/formulas.js
- Stats je Ressource `stats.total{}` / `stats.run{}`, generisches addResource -> js/core/state.js
- Rezepte (inputs/outputs/share/req, Kettenreihenfolge) -> js/data/recipes.js, js/core/formulas.js; ersetzt hart codierten Konverter (`rates().conv` entfällt)
- Klick-Upgrades als Liste `CLICKS`/`CLICK_MAP`, State `clicks{id:Stufe}` -> js/data/upgrades.js, js/core/state.js
- GEN.req als Array (String weiter akzeptiert, `reqList`) -> js/data/generators.js, js/core/formulas.js
- renderTop/Stats/Konverter-Text generisch aus RES/RECIPES -> js/ui/render.js
- Save v3 + Migration v2->v3 (`migrateV2toV3`); Key bleibt `eisenwerk-idle-save-v2` -> js/core/save.js

Härtung
- CSP-Meta, Inline-Script -> js/boot-check.js, Ember-Inline-Styles -> CSS nth-child -> index.html, css/styles.css
- `style` in dom.h über CSSOM (vereinbar mit style-src 'self') -> js/ui/dom.js
- Import-Limit 200000 Zeichen -> js/core/save.js
- legacy/ entfernt, README angepasst

# Erledigt in Phase 2b
Details und Zahlen: docs/GAME-DESIGN.md. Tests: tests/phase2b.test.mjs (56 Tests; Gesamtstand 277 grün).
- Timer-Warteschlangen `lab`/`workshop` -> js/systems/timers.js (enqueue, cancel, tick, queueState, isPending, timeToNext), js/data/timers.js; Lesehelfer in js/core/formulas.js (queueSlots, duration, pendingOf, lockReason mit „Läuft“/„In Warteschlange“/„voll“); buy() reiht Forschung/Boost/Klick ein, Generatoren bleiben sofort -> js/systems/production.js
- Offline/Hintergrund: abschnittsweise Berechnung, Raten nach jedem Abschluss neu -> js/core/save.js (applyOffline)
- Save v4 (`timers`, `stats.timersDone`), sanitize prüft Aufträge gegen die Daten, Migration v3->v4 -> js/core/save.js, js/core/state.js
- Prestige: Werkbank leeren, Labor nur ohne Wissensarchiv leeren, keine Erstattung -> js/systems/prestige.js
- Fund: `defOf('click','__proto__')` lieferte Object.prototype -> `Object.hasOwn` in formulas.defOf
- Inhalte: +9 Materialien, +9 Generatoren, +12 Forschungen, +10 Boosts, +3 Klick-Upgrades, +5 Rezepte, +3 Shop-Einträge, +14 Erfolge -> js/data/*
- Evolution: genTier/tierName/tierPips, Event gen:evolve -> js/data/generators.js, js/systems/production.js
- Minimal-UI: Warteschlangen-Listen mit Abbrechen, Restzeit auf Karten, gestaffelte Sichtbarkeit, Emoji-Fallback für fehlende Icons (js/ui/assets.js) -> js/ui/render.js, index.html, css/styles.css
- Debug-Hook `window.__eisenwerk = { state, F, timers, buy, save, refresh }` nur auf localhost/127.0.0.1 -> js/main.js
