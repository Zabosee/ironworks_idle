# Design-Spezifikation (ui-designer, 2026-10-11) – verbindliche Übergabe

## Review-Befunde Ist-Zustand
1. Emoji/SVG gemischt (Forschung, Boosts, Tabs, 🤖, 🔒, ⭐, Erfolge, Kostenzeilen 🪨🔩💎) → einheitliche SVGs.
2. Kaufmenge global in Topbar, wirkt irreführend auf Einmal-Käufe.
3. Mobil: Sidebar drückt Inhalt zu weit nach unten → <1024px kompakte sticky Ressourcenleiste, Sammelknopf als FAB.
4. Kontrast: `.side-foot` ~4,1:1; gesperrte Karten mit opacity .5 → Text-Kontrast < 4,5:1. Stattdessen nur Rahmen/Fläche abdunkeln.
5. Karten: Milestone-Balken ohne Textalternative; Zustände nur per Farbe.
6. CSS-Duplikate: `toast-in` doppelt, `.flash`/`.screen-flash`, `--accent`/`--ember`, `!important` bei `.card > span`.
7. Tabs: Overflow mobil nicht erkennbar; Pfeiltasten-Navigation prüfen.

## a) Kaufmenge nur im Generatoren-Tab
- `#buyamount` → sticky `.gens-toolbar` am Anfang von `#tab-gens`, `role="radiogroup"` + `aria-checked`, Buttons ≥44px.
- Forschung/Boosts/Klick-Upgrade kaufen immer 1 Stufe.

## b) Werkshalle (neuer erster Tab „Werk“, `#tab-works`, Standard)
- Eine Spur `.lane` pro Generator: Kopf (Icon, Name, Stufe, Rang-Text) + Slots.
- n ≤ 10: n Einzelbilder; n > 10: 10 Slots + Badge `×N` (`.lane-count`).
- Neuer Kauf: `.slot--new` Pop 200 ms.
- Evolutionsränge: 0 Holz (ab 1), 1 Eisen (ab 10), 2 Stahl (ab 25), 3 Titan (ab 50), 4 Gold (ab 100); `.lane.tier-N` setzt Palette (`--g-body`/`--g-trim`) und Zusatzteile (`--show-tX`). Bis zu 5 Rang-Pips `.lane-pips` für x2-Meilensteine dazwischen.
  - Holz #8b6b43/#5b4228 · Eisen #64748b/#334155 (Nieten, Glut) · Stahl #94a3b8/#38bdf8 (Rohr, Lampe) · Titan #c084fc/#d946ef (Leuchtstreifen, Antenne) · Gold #fbbf24/#fde68a (Glanz, Krone)
- Technik: Sprite `assets/sprites/gens.svg` mit `<symbol id="gen-…">`, Nutzung `<svg><use href="…#gen-mine"/></svg>`, Fills via CSS-Variablen.
- Rangwechsel: `.lane.evolve` 600 ms Glow + Toast „<Name>: Rang <Rang>“.
- Performance: Slots einmal bauen, danach nur hidden/Klassen; Update nur bei buy/loaded/prestige; Animationen pro Spur, pausiert wenn Tab versteckt; `content-visibility:auto`.

## c) Labor (Forschung)
- Hintergrund `assets/bg/lab.svg` (Kachelwand Petrol #0f2a2e→#0b1a24, Regale, Abzug), nur in `.lab`.
- Ebenen = `.lab-shelf`; Forschung = `.flask-card` mit Gefäß (Erlenmeyer/Reagenzglas/Rundkolben/Retorte).
- Zustände: gesperrt (leer, gestrichelt, Schloss + „Benötigt: …“), verfügbar (Glimmen), läuft (Flüssigkeit füllt via `--p`, Welle 2 s, 4 Bläschen 2,4 s, Dampf), erforscht (voll, Haken + „Erforscht“).
- Flüssigkeitsfarbe `--liquid` je Material: Erz #f97316, Stahl #38bdf8, Titan #d946ef, Alle #fbbf24.
- Immer Text „Restzeit 0:42 · 63 %“; `role="progressbar"` mit aria-valuenow/valuetext.

## d) Timer
- Kauf → Kosten sofort abziehen → Warteschlange → Countdown → Effekt erst danach aktiv. Generatoren bleiben sofort.
- Slots: Labor 1 (mehr über Hochofen-Shop), Werkbank (Upgrades/Boosts/Klick) 1; je bis zu 3 wartende Plätze.
- Dauer ca. 8 s × 2,5^Ebene (Forschung), Upgrades kürzer; Shop/Forschung verkürzen.
- `.queue-bar` mit `.slot-chip` (Name, m:ss, Balken), Abbrechen (Erstattung 100 % wartend / 50 % laufend); `.timer-ring` auf Karten; Tab-Badge; Fertig-Toast.
- Update 4×/s nur Text + `--p`. Offline-Fortschritt, Save-Migration, Prestige-Reset beachten.

## e) Neue Materialien/Generatoren
| Material | Farbe | Generator |
|---|---|---|
| Kohle `coal` | #475569 | Zeche |
| Koks `coke` | #78716c | Koksofenbatterie |
| Kupfer `copper` | #ea8a52 | Kupferhütte |
| Mangan `manganese` | #a78bfa | Manganbergwerk |
| Chrom `chrome` | #5eead4 | Chromwerk |
| Nickel `nickel` | #a3e635 | Nickelraffinerie |
| Legierung `alloy` | #38bdf8 | Legierungsmischer |
| Wolfram `tungsten` | #f472b6 | Wolframreaktor |
| Gold `gold` | #fbbf24 | Edelmetall-Tiegel |
Kette: Kohle → Koks → Stahl, Kupfer/Mangan → Legierung → Chrom/Nickel → Wolfram → Gold. Sidebar: >4 Ressourcen in Gruppe „Weitere Materialien“.

## A11y / Motion
- Info nie nur per Farbe; Kontrast ≥4,5:1 Text, 3:1 UI; Deko `aria-hidden`; Buttons ≥44px.
- `role="timer"` ohne Live pro Sekunde; Start/Ende via Toast.
- reduced-motion: Wellen/Bläschen aus, keine Übergänge, Rang nur Rahmen+Text.
