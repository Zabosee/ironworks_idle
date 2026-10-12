// Speichern, Laden, Versionierung/Migration, Export/Import (Base64), Offline-Fortschritt.
// Nutzt localStorage/btoa, aber kein DOM.
import { state, defaultState, replaceState, addResource, FORMAT_IDS, LANG_IDS, BUY_AMOUNTS, AUTOSAVE_OPTIONS } from './state.js';
import { rates, offlineCapSeconds, safe, defOf } from './formulas.js';
import { timeToNext, tick as timersTick } from '../systems/timers.js';
import { emit } from './events.js';
import { RES_IDS } from '../data/resources.js';
import { GENS, MAX_LEVEL } from '../data/generators.js';
import { CLICKS, BOOSTS } from '../data/upgrades.js';
import { RESEARCH } from '../data/research.js';
import { SHOP, AUTOBUYERS } from '../data/prestige.js';
import { CORP_SHOP, CORP_HISTORY_MAX, AUTOCAST } from '../data/corp.js';
import { HISTORY_MAX } from '../data/prestige.js';
import { EVO_MAX } from '../data/eras.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUFFS } from '../data/golden.js';
import { QUEUES, QUEUE_IDS, MAX_ENTRIES } from '../data/timers.js';

export const SAVE_VERSION = 6;
// Der Schlüssel bleibt bewusst 'v2': die Formatversion steckt im Spielstand selbst (Feld v), so lädt der alte Spielstand ohne Umkopieren.
export const SAVE_KEY = 'eisenwerk-idle-save-v2';
export const BACKUP_KEY = SAVE_KEY + '-backup';
export const LEGACY_KEY = 'eisenwerk-idle-save';
const MAX_IMPORT_CHARS = 200_000;

// ---------- Validierung ----------
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = (x, def = 0, min = 0, max = 1e300) => {
  const n = typeof x === 'number' ? x : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};
const int = (x, max) => Math.floor(num(x, 0, 0, max));
const bool = (x, def) => (typeof x === 'boolean' ? x : def);

/** Baut aus beliebigen Daten einen gültigen Zustand; übernimmt nur bekannte Schlüssel und Typen. */
export function sanitize(d) {
  if (!isObj(d)) throw new Error('Spielstand hat kein gültiges Format.');
  const s = defaultState();
  const res = isObj(d.res) ? d.res : {};
  for (const k of RES_IDS) s.res[k] = num(res[k]);
  const gens = isObj(d.gens) ? d.gens : {};
  for (const g of GENS) s.gens[g.id] = int(gens[g.id], MAX_LEVEL);
  const cl = isObj(d.clicks) ? d.clicks : {};
  for (const c of CLICKS) s.clicks[c.id] = int(cl[c.id], MAX_LEVEL);
  const rs = isObj(d.research) ? d.research : {}, bs = isObj(d.boosts) ? d.boosts : {};
  for (const r of RESEARCH) if (rs[r.id]) s.research[r.id] = 1;
  for (const b of BOOSTS) if (bs[b.id]) s.boosts[b.id] = 1;

  // Generator-Ausbau (Zeitalter-System): nur bekannte Generatoren, Stufe 0..EVO_MAX
  const ev = isObj(d.evo) ? d.evo : {};
  for (const g of GENS) s.evo[g.id] = int(ev[g.id], EVO_MAX);

  // Warteschlangen: nur bekannte Aufträge der passenden Art, keine Duplikate, nichts bereits Abgeschlossenes
  const tm = isObj(d.timers) ? d.timers : {};
  const owned = { research: s.research, boost: s.boosts };
  const seen = new Set();
  for (const q of QUEUE_IDS) {
    const src = Array.isArray(tm[q]) ? tm[q].slice(0, MAX_ENTRIES) : [];
    for (const e of src) {
      if (!isObj(e) || typeof e.kind !== 'string' || typeof e.id !== 'string') continue;
      if (!QUEUES[q].kinds.includes(e.kind) || !defOf(e.kind, e.id) || owned[e.kind]?.[e.id]) continue;
      const key = e.kind + ':' + e.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const total = num(e.total, 1, 0.001, 86400);
      const cost = {};
      if (isObj(e.cost)) for (const k of RES_IDS) { const v = num(e.cost[k]); if (v > 0) cost[k] = v; }
      s.timers[q].push({ kind: e.kind, id: e.id, total, left: num(e.left, total, 0, total), cost, silent: bool(e.silent, false) });
    }
  }

  const p = isObj(d.prestige) ? d.prestige : {};
  s.prestige.points = num(p.points); s.prestige.total = num(p.total); s.prestige.count = int(p.count, 1e9);
  const shop = isObj(p.shop) ? p.shop : {};
  for (const it of SHOP) { const l = int(shop[it.id], it.max); if (l > 0) s.prestige.shop[it.id] = Math.min(l, it.max); }

  // Neuguss-Chronik: nur die letzten HISTORY_MAX gültigen Einträge, nur bekannte Felder
  if (Array.isArray(p.history)) {
    for (const e of p.history.slice(-HISTORY_MAX)) {
      if (!isObj(e)) continue;
      const gain = int(e.gain, 1e12);
      if (gain < 1) continue;
      s.prestige.history.push({ gain, ore: num(e.ore), time: num(e.time, 0, 0, 1e10), at: num(e.at, 0, 0, 8.64e15) });
    }
  }

  // Konzern (2. Reset-Ebene): nur bekannte Shop-IDs mit Stufe <= max, höchstens CORP_HISTORY_MAX gültige Chronik-Einträge
  const c = isObj(d.corp) ? d.corp : {};
  s.corp.points = num(c.points); s.corp.total = num(c.total); s.corp.count = int(c.count, 1e9);
  const cshop = isObj(c.shop) ? c.shop : {};
  for (const it of CORP_SHOP) { const l = int(cshop[it.id], it.max); if (l > 0) s.corp.shop[it.id] = l; }
  if (Array.isArray(c.history)) {
    for (const e of c.history.slice(-CORP_HISTORY_MAX)) {
      if (!isObj(e)) continue;
      const gain = int(e.gain, 1e12);
      if (gain < 1) continue;
      s.corp.history.push({ gain, gussformen: num(e.gussformen), time: num(e.time, 0, 0, 1e10), at: num(e.at, 0, 0, 8.64e15) });
    }
  }
  const ac = isObj(d.autoCast) ? d.autoCast : {};
  s.autoCast.on = bool(ac.on, false);
  s.autoCast.mode = AUTOCAST.modes.includes(ac.mode) ? ac.mode : 'gain';
  s.autoCast.value = num(ac.value, 0, 0, 1e12);

  const ab = isObj(d.autobuyers) ? d.autobuyers : {};
  for (const a of AUTOBUYERS) s.autobuyers[a.id] = bool(ab[a.id], false);

  const ach = isObj(d.achievements) ? d.achievements : {};
  for (const a of ACHIEVEMENTS) if (ach[a.id]) s.achievements[a.id] = num(ach[a.id], 1);

  if (Array.isArray(d.buffs)) {
    for (const b of d.buffs.slice(0, 10)) {
      const def = isObj(b) ? BUFFS[b.id] : null;
      const left = def ? num(b.left, 0, 0, def.duration * 3) : 0;
      if (def && left > 0) s.buffs.push({ id: def.id, left });
    }
  }

  const st = isObj(d.stats) ? d.stats : {};
  for (const k of Object.keys(s.stats)) if (typeof s.stats[k] === 'number') s.stats[k] = num(st[k], s.stats[k]);
  for (const grp of ['total', 'run']) {
    const src = isObj(st[grp]) ? st[grp] : {};
    for (const k of RES_IDS) s.stats[grp][k] = num(src[k]);
  }

  const se = isObj(d.settings) ? d.settings : {};
  s.settings.format = FORMAT_IDS.includes(se.format) ? se.format : 'standard';
  s.settings.autosave = bool(se.autosave, true);
  s.settings.autosaveSec = AUTOSAVE_OPTIONS.includes(se.autosaveSec) ? se.autosaveSec : 10;
  s.settings.particles = bool(se.particles, true);
  s.settings.lang = LANG_IDS.includes(se.lang) ? se.lang : 'de';
  s.settings.buyAmount = BUY_AMOUNTS.includes(se.buyAmount) ? se.buyAmount : '1';

  s.savedAt = num(d.savedAt, 0, 0, 8.64e15);
  return s;
}

// ---------- Migration ----------
/**
 * v2 -> v3: click (Zahl) -> clicks { click }, stats.totalOre/Steel/Titan + runOre -> stats.total / stats.run (je Ressource).
 * Gibt eine Kopie zurück; die Eingabe bleibt unverändert.
 */
export function migrateV2toV3(old) {
  const out = { ...old };
  out.clicks = { click: old.click };
  delete out.click;
  if (isObj(old.stats)) {
    const { totalOre, totalSteel, totalTitan, runOre, ...rest } = old.stats;
    out.stats = { ...rest, total: { ore: totalOre, steel: totalSteel, titan: totalTitan }, run: { ore: runOre } };
  }
  return out;
}

/** v3 -> v4: Warteschlangen (leer) und Zähler stats.timersDone kommen neu hinzu; alle bisherigen Daten bleiben unverändert. */
export function migrateV3toV4(old) {
  const out = { ...old, timers: { lab: [], workshop: [] } };
  if (isObj(old.stats)) out.stats = { ...old.stats, timersDone: 0 };
  return out;
}

/** v4 -> v5: Generator-Ausbau (`evo`) kommt neu hinzu; das Zeitalter wird aus stats.total.ore abgeleitet und nicht gespeichert. */
export function migrateV4toV5(old) {
  return { ...old, evo: {} };
}

/** v5 -> v6: zweite Reset-Ebene (corp, autoCast) kommt neu hinzu, leere Vorgaben; neue Ressourcen/Generatoren ergänzt sanitize mit 0. */
export function migrateV5toV6(old) {
  return { ...old, corp: { points: 0, total: 0, count: 0, shop: {}, history: [] }, autoCast: { on: false, mode: 'gain', value: 0 } };
}

/** Bringt beliebige bekannte Formate auf die aktuelle Version: { v, t, state }. */
export function migrate(data) {
  if (!isObj(data)) throw new Error('Spielstand hat kein gültiges Format.');
  // v1 (Altversion): { S: {ore, steel, titan, click, research, boosts, gens}, t }
  if (isObj(data.S)) {
    const o = data.S;
    return {
      v: SAVE_VERSION, t: num(data.t, Date.now(), 0, 8.64e15),
      state: { res: { ore: o.ore, steel: o.steel, titan: o.titan }, gens: o.gens, clicks: { click: o.click }, research: o.research, boosts: o.boosts },
    };
  }
  const v = Number(data.v);
  if (!Number.isInteger(v) || v < 1) throw new Error('Unbekannte Spielstand-Version.');
  if (v > SAVE_VERSION) throw new Error('Der Spielstand stammt aus einer neueren Spielversion.');
  if (!isObj(data.state)) throw new Error('Spielstand enthält keine Daten.');
  let st = data.state;
  if (v < 3) st = migrateV2toV3(st);
  if (v < 4) st = migrateV3toV4(st);
  if (v < 5) st = migrateV4toV5(st);
  if (v < 6) st = migrateV5toV6(st);
  return { v: SAVE_VERSION, t: num(data.t, Date.now(), 0, 8.64e15), state: st };
}

function parseSave(json) {
  const m = migrate(JSON.parse(json));
  const s = sanitize({ ...m.state, savedAt: m.t });
  return s;
}

// ---------- Speichern / Laden ----------
let saveLocked = false;
/** true, wenn ein unlesbarer Spielstand gefunden wurde: Speichern ist gesperrt, bis Import oder Reset den Zustand ersetzt. */
export const isSaveLocked = () => saveLocked;

let savePaused = false;
/** Mehr-Tab-Schutz: pausiert jedes Speichern (unabhängig von Import/Reset), solange eine andere Instanz läuft. */
export const pauseSaving = on => { savePaused = !!on; };
export const isSavePaused = () => savePaused;

const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export const serialize = () => JSON.stringify({ v: SAVE_VERSION, t: Date.now(), state });

export function save() {
  if (saveLocked || savePaused) { emit('save-failed'); return false; }
  try {
    state.savedAt = Date.now();
    store().setItem(SAVE_KEY, serialize());
    emit('saved', state.savedAt);
    return true;
  } catch {
    emit('save-failed');
    return false;
  }
}

/**
 * Lädt Spielstand (neuer Key, sonst Legacy). Gibt { loaded, migrated } zurück.
 * Bei unlesbarem/zu neuem Spielstand: { loaded:false, error:true, backedUp }, der Rohtext wird nach BACKUP_KEY
 * kopiert und das Speichern gesperrt, damit der Spielstand nicht überschrieben wird.
 */
export function load() {
  saveLocked = false;
  const ls = store();
  if (!ls) return { loaded: false };
  let raw = null;
  try {
    let migrated = false;
    raw = ls.getItem(SAVE_KEY);
    if (!raw) { raw = ls.getItem(LEGACY_KEY); migrated = !!raw; }
    if (!raw) return { loaded: false };
    replaceState(parseSave(raw));
    return { loaded: true, migrated };
  } catch (err) {
    console.error('Laden fehlgeschlagen', err);
    saveLocked = true;
    let backedUp = false;
    try { if (raw) { ls.setItem(BACKUP_KEY, raw); backedUp = true; } } catch { /* Speicher voll/gesperrt */ }
    return { loaded: false, error: true, backedUp };
  }
}

/** Speichert nur bei aktiviertem Autosave (Seitenwechsel, Prestige, Shop). */
export function autoSave() {
  return state.settings.autosave ? save() : false;
}

export function resetGame() {
  saveLocked = false;
  replaceState(defaultState());
  save();
  emit('loaded');
}

// ---------- Export / Import ----------
function toBase64(text) {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function exportSave() {
  state.savedAt = Date.now();
  return toBase64(serialize());
}

/** Reine Prüfung eines Export-Strings (ohne Zustandsänderung). Gibt den geparsten Zustand zurück, wirft Error mit deutscher Meldung. */
export function validateImport(text) {
  const clean = String(text ?? '').replace(/\s+/g, '');
  if (!clean) throw new Error('Kein Spielstand eingegeben.');
  if (clean.length > MAX_IMPORT_CHARS) throw new Error('Spielstand ist zu groß.');
  try {
    return parseSave(fromBase64(clean));
  } catch (err) {
    if (err instanceof Error && /Version|Format|Daten|Spielversion/.test(err.message)) throw err;
    throw new Error('Spielstand ist beschädigt oder kein gültiger Export.');
  }
}

/** Validiert und übernimmt einen Export-String. Wirft Error mit deutscher Meldung. */
export function importSave(text) {
  const next = validateImport(text);
  saveLocked = false;
  replaceState(next);
  save();
  emit('loaded');
}

// ---------- Offline-Fortschritt ----------
/**
 * Schreibt Offline-Erträge gut. Gibt { seconds, capped, gains } zurück oder null.
 * Beim Laden (Standard) verfallen Buffs; im Laufzeitpfad (Tab war im Hintergrund, runtime:true) wird ihre
 * Restzeit um die vergangene Zeit gekürzt. Die Erträge werden in beiden Fällen ohne Buffs berechnet.
 */
export function applyOffline(seconds, { runtime = false } = {}) {
  if (!Number.isFinite(seconds) || seconds < 10) return null;
  const cap = offlineCapSeconds();
  const sec = Math.min(seconds, cap);
  const buffs = state.buffs;
  state.buffs = [];
  const gains = Object.fromEntries(RES_IDS.map(k => [k, 0]));
  // Abschnittsweise: Abgeschlossene Timer ändern die Raten (neue Boosts/Forschung/Generatoren), also je Abschluss neu rechnen.
  let rem = sec;
  for (let guard = 0; rem > 1e-9 && guard < 100; guard++) {
    const r = rates();
    const step = Math.min(rem, timeToNext());
    for (const k of RES_IDS) { const g = safe(r[k] * step); addResource(k, g); gains[k] += g; }
    timersTick(step);
    rem -= step;
  }
  if (rem > 1e-9) {   // Sicherheitsnetz: Rest mit den letzten Raten
    const r = rates();
    for (const k of RES_IDS) { const g = safe(r[k] * rem); addResource(k, g); gains[k] += g; }
  }
  if (seconds > sec) timersTick(seconds - sec);   // Timer laufen auch über das Offline-Maximum hinaus weiter
  if (runtime) {
    state.buffs = buffs.map(b => ({ ...b, left: b.left - seconds })).filter(b => b.left > 0);
    if (state.buffs.length !== buffs.length) emit('buffs');
  }
  state.stats.playTime += sec;
  state.stats.runTime += sec;
  state.stats.corpRunTime += sec;
  return { seconds: sec, capped: seconds > cap, gains };
}
