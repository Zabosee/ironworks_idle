# Ironworks Idle

English | [Deutsch](README.md)

Browser idle game: ore becomes steel, titanium and gold. Vanilla ES modules, no build, no dependencies, German and English.

![Factory hall with generators evolving through rank tiers](docs/screenshots-en/01-werk.png)

## Features

- **Generators and recipe chains**: 21 generators and 19 materials (coal, coke, copper, alloy, tungsten, gold and more). Recipes run automatically, for example coal to coke or ore and coke to steel. Production doubles every 10 levels, and from level 10 (Elite) each level also costs titanium. The factory hall shows generators in five evolution ranks (wood, iron, steel, titanium, gold).
- **Lab and workbench**: Research (lab) and boosts and click upgrades (workbench) run as timers. The cost is paid at once, the effect applies when the timer ends. Each queue has one active slot and three waiting slots.
- **Blast furnace recast (reset layer 1)**: Casting molds give a permanent production bonus. Milestones and a shop (auto-buyers, extra slots, time warp and more) add to it.
- **Focus**: Before each recast you choose Steel Forge, Titan Furnace or Gold Casting. The chosen chain gets +25 % production in the next run, the others -5 %.
- **Corporation (reset layer 2)**: From 100 recasts you can found a corporation and earn patents. Patents raise production, unlock corporation tiers K1 to K7 and are spent in the corporation shop. There are also 49 permanent corporation researches and four more material recipes.
- **Eras and industry**: From the first recast there are nine eras (Handcraft to Cosmic Forge) with a global bonus, new research and generator expansion. Two milestone bars (output, material variety) give further production bonuses.
- **Challenges**: From the first recast you can take on five tasks with a special rule and a deadline (No Clicking, One Generator, Iron Deadline, Research Freeze, Ore Shortage). Each has 5 levels with a rising goal: level 1 gives a permanent +3 % production, each further level +1 %.
- **Random events**: Every 8 to 15 minutes of active play an event appears in the factory: ore vein (click bonus), resource shortage (fix it with a click) or special order (deliver material for a production bonus).
- **Achievements and golden bars**: 70 achievements with production bonuses. Golden bars appear at random and give a timed buff when you click them or press G.
- **Offline progress**: On load, your absence is calculated at 60 % of the active yield, with a cap (base 8 h). From 60 s of absence a welcome dialog shows what you gained.
- **Daily bonus**: Each new calendar day gives a Smelting Frenzy buff on the first start (or after midnight while the game is running). Its duration grows in a streak up to day 7.
- **Help and glossary**: The `?` key or the "Help ?" button opens an explanation of all game layers and terms. Keys 1 to 9 switch between sections.
- **Sound and notices**: Synthesized sound effects (WebAudio, can be turned off, adjustable volume). While the game runs in the background, the tab title shows when a lab or workbench job is finished.
- **Language, export and import**: German and English, export and import saves as Base64, three number formats, autosave. Older saves are migrated.
- **Multi-tab guard**: A second tab does not save, so it cannot overwrite your progress.

Scope: 125 researches (49 of them corporation research), 43 boosts, 10 click upgrades. The balance bot needs about 600 hours of active play to unlock everything. The numbers and how they were derived are in [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md). 

## Preview

| | |
|---|---|
| ![Generators tab with purchase amount and costs](docs/screenshots-en/02-generatoren.png) | ![Industry tab with milestone bars and eras](docs/screenshots-en/03-industrie.png) |
| Generators: purchase amount x1 to Max, level, Elite cost in titanium. | Industry: milestone bars and eras. |
| ![Research tree as a map](docs/screenshots-en/04-forschung.png) | ![Blast furnace panel with milestones and focus](docs/screenshots-en/05-hochofen.png) |
| Research: tree with prerequisites, lab queue on top. | Blast furnace: recast preview, milestones, focus. |
| ![Corporation tab with patents and corporation shop](docs/screenshots-en/06-konzern.png) | ![Achievements tab with production bonuses](docs/screenshots-en/07-erfolge.png) |
| Corporation: patents, founding and corporation shop. | Achievements: condition and production bonus for each. |
| ![Help dialog explaining the game layers](docs/screenshots-en/08-hilfe.png) | |
| Help dialog (key ?). | |

## Documentation

- [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md): game design covering resource chain, timers, recast, corporation founding, schedule and balance (in German)
- `npm test` runs all tests (Node 22 or newer, no dependencies, about 3 min). On GitHub they run on every push.
