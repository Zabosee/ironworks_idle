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
