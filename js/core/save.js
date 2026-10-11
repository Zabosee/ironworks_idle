// Speichern, Laden, Versionierung/Migration, Export/Import (Base64), Offline-Fortschritt.
// Nutzt localStorage/btoa, aber kein DOM.
import { state, defaultState, replaceState, addResource, FORMAT_IDS, BUY_AMOUNTS, AUTOSAVE_OPTIONS } from './state.js';
import { rates, offlineCapSeconds, safe } from './formulas.js';
import { emit } from './events.js';
import { RES_IDS } from '../data/resources.js';
import { GENS, MAX_LEVEL } from '../data/generators.js';
import { BOOSTS } from '../data/upgrades.js';
import { RESEARCH } from '../data/research.js';
import { SHOP, AUTOBUYERS } from '../data/prestige.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUFFS } from '../data/golden.js';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'eisenwerk-idle-save-v2';
export const LEGACY_KEY = 'eisenwerk-idle-save';
const MAX_IMPORT_CHARS = 2_000_000;

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
  s.click = int(d.click, MAX_LEVEL);
  const rs = isObj(d.research) ? d.research : {}, bs = isObj(d.boosts) ? d.boosts : {};
  for (const r of RESEARCH) if (rs[r.id]) s.research[r.id] = 1;
  for (const b of BOOSTS) if (bs[b.id]) s.boosts[b.id] = 1;

  const p = isObj(d.prestige) ? d.prestige : {};
  s.prestige.points = num(p.points); s.prestige.total = num(p.total); s.prestige.count = int(p.count, 1e9);
  const shop = isObj(p.shop) ? p.shop : {};
  for (const it of SHOP) { const l = int(shop[it.id], it.max); if (l > 0) s.prestige.shop[it.id] = Math.min(l, it.max); }

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
  for (const k of Object.keys(s.stats)) s.stats[k] = num(st[k], s.stats[k]);

  const se = isObj(d.settings) ? d.settings : {};
  s.settings.format = FORMAT_IDS.includes(se.format) ? se.format : 'standard';
  s.settings.autosave = bool(se.autosave, true);
  s.settings.autosaveSec = AUTOSAVE_OPTIONS.includes(se.autosaveSec) ? se.autosaveSec : 10;
  s.settings.particles = bool(se.particles, true);
  s.settings.buyAmount = BUY_AMOUNTS.includes(se.buyAmount) ? se.buyAmount : '1';

  s.savedAt = num(d.savedAt, 0, 0, 8.64e15);
  return s;
}

// ---------- Migration ----------
/** Bringt beliebige bekannte Formate auf die aktuelle Version: { v, t, state }. */
export function migrate(data) {
  if (!isObj(data)) throw new Error('Spielstand hat kein gültiges Format.');
  // v1 (Altversion): { S: {ore, steel, titan, click, research, boosts, gens}, t }
  if (isObj(data.S)) {
    const o = data.S;
    return {
      v: SAVE_VERSION, t: num(data.t, Date.now(), 0, 8.64e15),
      state: { res: { ore: o.ore, steel: o.steel, titan: o.titan }, gens: o.gens, click: o.click, research: o.research, boosts: o.boosts },
    };
  }
  const v = Number(data.v);
  if (!Number.isInteger(v) || v < 1) throw new Error('Unbekannte Spielstand-Version.');
  if (v > SAVE_VERSION) throw new Error('Der Spielstand stammt aus einer neueren Spielversion.');
  // Platz für künftige Migrationen: if (v < 3) { ... }
  if (!isObj(data.state)) throw new Error('Spielstand enthält keine Daten.');
  return { v: SAVE_VERSION, t: num(data.t, Date.now(), 0, 8.64e15), state: data.state };
}

function parseSave(json) {
  const m = migrate(JSON.parse(json));
  const s = sanitize({ ...m.state, savedAt: m.t });
  return s;
}

// ---------- Speichern / Laden ----------
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export const serialize = () => JSON.stringify({ v: SAVE_VERSION, t: Date.now(), state });

export function save() {
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

/** Lädt Spielstand (neuer Key, sonst Legacy). Gibt { loaded, migrated } zurück. */
export function load() {
  const ls = store();
  if (!ls) return { loaded: false };
  try {
    let raw = ls.getItem(SAVE_KEY), migrated = false;
    if (!raw) { raw = ls.getItem(LEGACY_KEY); migrated = !!raw; }
    if (!raw) return { loaded: false };
    replaceState(parseSave(raw));
    return { loaded: true, migrated };
  } catch (err) {
    console.error('Laden fehlgeschlagen', err);
    return { loaded: false, error: true };
  }
}

export function resetGame() {
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

/** Validiert und übernimmt einen Export-String. Wirft Error mit deutscher Meldung. */
export function importSave(text) {
  const clean = String(text ?? '').replace(/\s+/g, '');
  if (!clean) throw new Error('Kein Spielstand eingegeben.');
  if (clean.length > MAX_IMPORT_CHARS) throw new Error('Spielstand ist zu groß.');
  let next;
  try {
    next = parseSave(fromBase64(clean));
  } catch (err) {
    if (err instanceof Error && /Version|Format|Daten|Spielversion/.test(err.message)) throw err;
    throw new Error('Spielstand ist beschädigt oder kein gültiger Export.');
  }
  replaceState(next);
  save();
  emit('loaded');
}

// ---------- Offline-Fortschritt ----------
/** Schreibt Offline-Erträge gut. Gibt { seconds, capped, gains } zurück oder null. */
export function applyOffline(seconds) {
  if (!Number.isFinite(seconds) || seconds < 10) return null;
  const cap = offlineCapSeconds();
  const sec = Math.min(seconds, cap);
  state.buffs = [];                    // Buffs gelten nicht offline
  const r = rates();
  const gains = {};
  for (const k of RES_IDS) { gains[k] = safe(r[k] * sec); addResource(k, gains[k]); }
  state.stats.playTime += sec;
  state.stats.runTime += sec;
  return { seconds: sec, capped: seconds > cap, gains };
}
