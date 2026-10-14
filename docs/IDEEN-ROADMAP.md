# Ideen-Roadmap

Stand: 2026-10-14. Quellen: Recherche zu Cookie Clicker, Mr. Mine, Revolution Idle und Weltraum-Idles (Belege dünn, siehe unten) und Abgleich mit dem Spiel.

## Bereits umgesetzt

Offline-Effizienz 60 % und Willkommen-Dialog, Tagesbonus, Schwerpunkt je Neuguss, Zufallsereignisse, Herausforderungen. Siehe README und PROGRESS.md.

## In Arbeit

1. Hilfe und Glossar im Spiel (Kritik an Revolution Idle: zu wenig Erklärung).

## Offen

### 2. Meisterstück-Währung (zurückgestellt, Aufwand niedrig bis mittel)

Vorbild: Zuckerklumpen aus Cookie Clicker. Eine begonnene Umsetzung wurde wieder entfernt, sie ist nicht im Spiel.

- Alle 6 Stunden realer Zeit reift ein Meisterstück, höchstens 3 warten ungeholt, Holen per Klick in der Seitenleiste.
- Die Währung überlebt Neuguss und Konzerngründung.
- Ausgaben: Generator-Meisterung (+5 % Produktion auf einen gewählten Generator-Typ je Stufe, bis Stufe 5, Kosten 1 bis 5), Glücksbarren (goldene Barren 10 % öfter, 3 Stufen), Tagesbonus-Verlängerung (+20 % Dauer je Stufe).
- Uhr-Schutz wie beim Tagesbonus: zurückgestellte Uhr bringt nichts, weit vorgestellte Uhr zählt höchstens als ein Meisterstück.
- Neuer State (`state.mastery`), Save-Migration, Tests. Der Balance-Bot kauft nichts, Boni klein halten (Korridor 504 bis 700 h).

### 3. Expeditionen und Relikte (Aufwand mittel)

Vorbild: Mr. Mine (Expeditionen, Relikte, Artefakte).

- Geologen werden über das vorhandene Timer-System (`js/data/timers.js`, `js/systems/timers.js`) auf Expedition geschickt.
- Ergebnis: Relikte. Eine Sammlung gibt kleine, dauerhafte Boni, die Neuguss und Konzerngründung überleben.
- Neuer State (`state.relics`), Save-Migration, Tests. Boni klein halten, damit der Balance-Korridor (504 bis 700 h) hält.
- Ziel: Sammelziel für die mittlere Spielphase.

### 4. Rohstoffbörse als Minispiel (Aufwand mittel bis hoch)

Vorbild: Börse in Cookie Clicker.

- Materialpreise schwanken deterministisch (seed-basiert, testbar). Spieler kauft billig und verkauft teuer.
- Risiko: sprengt leicht die Balance. Deckel für Gewinne, Handelsvolumen begrenzen, Balance-Bot ignoriert die Börse.
- Erst nach 3 angehen, weil es die meisten Tests braucht.

### 5. Minispiele über Generatoren freischalten (Aufwand mittel)

Vorbild: Cookie Clicker schaltet Garten, Börse, Tempel und Zauberbuch über Gebäudestufen frei.

- Beispiel: Ofentemperatur-Regelung ab einer bestimmten Generatorstufe.
- Das Spiel wächst dadurch durch Entdecken statt nur durch Zahlen.
- Sinnvoll als Rahmen für 4.

## Bewusst nicht geplant

- Gilden, Werbung, Bezahlmodelle: Revolution Idle wird dafür kritisiert.
- Weitere Reset-Ebenen: mit zwei Ebenen und etwa 600 Stunden ist das Spiel schon sehr lang.

## Quellen und Vorbehalt

Die Suche war dünn. Spielmechaniken stammen aus Wikis und Store-Seiten, Meinungen aus Foren. "Spacecraft Idle" wurde nicht gefunden, ersatzweise gelten ähnliche Weltraum-Idles.

- https://cookieclicker.wiki.gg/wiki/Sugar_Lumps
- https://cookieclicker.wiki.gg/wiki/Minigames
- https://blog.mrmine.com/?p=740
- https://www.notebookcheck.net/Free-to-play-this-free-idle-game-is-purely-addictive-and-climbs-to-1-on-the-Steam-charts.1009139.0.html
- https://www.dekudeals.com/items/orebit
- https://apps.appfollow.io/ios/idle-skies/1435039979?country=us
