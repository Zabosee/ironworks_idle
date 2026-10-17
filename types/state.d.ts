// Typ des Spielstands (js/core/state.js, defaultState). Nur für die Typprüfung (tsc --noEmit), wird nicht ausgeliefert.
// Als Interface geschlossen: Zugriffe auf unbekannte oder entfernte Felder sind Fehler (JS-Objektliterale wären "offen").

/** id -> Stufe */
type Levels = Record<string, number>;

interface TimerEntry { kind: string; id: string; total: number; left: number; cost: Record<string, number>; silent?: boolean }
interface HistoryEntry { gain: number; ore?: number; gussformen?: number; time: number; at: number }

interface GameState {
  res: Record<string, number>;
  gens: Levels;
  /** Stufen der wiederholbaren Klick-Upgrades */
  clicks: Levels;
  research: Levels;
  boosts: Levels;
  /** Warteschlangen je Queue; die ersten `slots` Einträge laufen */
  timers: Record<string, TimerEntry[]>;
  /** history: letzte Neugüsse, älteste zuerst */
  prestige: { points: number; total: number; count: number; shop: Levels; history: HistoryEntry[] };
  /** 2. Reset-Ebene (Patente); history: letzte Gründungen */
  corp: { points: number; total: number; count: number; shop: Levels; history: HistoryEntry[] };
  /** Schwerpunkt: aktiv im laufenden Durchlauf / gewählt für den nächsten Neuguss */
  focus: string;
  focusNext: string;
  /** Auto-Neuguss: ab Gewinn value, frühestens nach minRun s; 0 = Vorgabe */
  autoCast: { on: boolean; value: number; minRun: number };
  autobuyers: Record<string, boolean>;
  /** id -> Zeitpunkt der Freischaltung */
  achievements: Record<string, number>;
  buffs: { id: string; left: number; res?: string }[];
  /** Generator-Ausbauten (0..EVO_MAX) */
  evo: Levels;
  stats: {
    clicks: number; runClicks: number;
    total: Record<string, number>; run: Record<string, number>;
    runTime: number; playTime: number; corpRunTime: number;
    golden: number; buys: number; bestOreRate: number; timersDone: number;
    bestPrestige: number; fastestPrestige: number; startedAt: number;
  };
  settings: { format: string; autosave: boolean; autosaveSec: number; particles: boolean; buyAmount: string; lang: string; sound: boolean; volume: number };
  /** done: id -> Stufe */
  challenges: { done: Levels; active: null | { id: string; level: number; left: number; goal: number; base: number; gen: string } };
  /** Tagesbonus: letzter Bonus-Tag (lokal, YYYY-MM-DD) und Serie */
  daily: { last: string; streak: number };
  savedAt: number;
}
