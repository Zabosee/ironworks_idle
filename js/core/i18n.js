// Mehrsprachigkeit: Deutsch (Standard, die Texte im Code sind der Schlüssel) und Englisch.
// t('Deutscher Text {x}', { x }) schlägt bei 'en' in i18n/en-ui.js nach und fällt sonst auf den deutschen Text zurück.
// Spieldaten (Name/Beschreibung) kommen über tName/tDesc aus i18n/en-data.js.
import { state, setSetting, LANG_IDS } from './state.js';
import { EN_UI } from '../i18n/en-ui.js';

export const LANGS = [{ id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }];
export const LANG_KEY = 'eisenwerk.lang';   // Fallback-Speicher, falls der Spielstand nicht lesbar/speicherbar ist

// Englische Spieldaten werden defensiv geladen (Datei gehört einem anderen Modul; fehlt sie, bleibt es deutsch).
let EN = {};
try { ({ EN } = await import('../i18n/en-data.js')); } catch { EN = {}; }

const isLang = id => LANG_IDS.includes(id);
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

// Schon beim Modulstart aus dem Fallback-Schlüssel lesen, damit auch frühe Meldungen (vor load()) passen.
let lang = (() => { try { const v = store()?.getItem(LANG_KEY); return isLang(v) ? v : 'de'; } catch { return 'de'; } })();

export function getLang() { return lang; }

/** Locale für toLocaleString & Co. */
export function locale() { return lang === 'en' ? 'en-US' : 'de-DE'; }

/** Setzt die Sprache (unbekannte IDs -> 'de'), schreibt state.settings.lang und den localStorage-Fallback. */
export function setLang(id) {
  lang = isLang(id) ? id : 'de';
  setSetting('lang', lang);
  try { store()?.setItem(LANG_KEY, lang); } catch { /* Speicher gesperrt */ }
  applyDocumentLang();
  return lang;
}

/**
 * Beim Boot nach load(): Der localStorage-Schlüssel hat Vorrang (überlebt auch gesperrtes Speichern),
 * sonst gilt die Sprache aus dem Spielstand. Gibt die aktive Sprache zurück.
 */
export function initLang() {
  let stored = null;
  try { stored = store()?.getItem(LANG_KEY) ?? null; } catch { stored = null; }
  return setLang(isLang(stored) ? stored : state.settings?.lang);
}

export function applyDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

const fill = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : text);

/** Übersetzt einen deutschen Text; {name}-Platzhalter werden aus params ersetzt. */
export function t(de, params) {
  const text = lang === 'en' ? (Object.hasOwn(EN_UI, de) ? EN_UI[de] : de) : de;
  return fill(text, params);
}

function pick(kind, item, field) {
  const own = item?.[field];
  if (lang !== 'en') return own;
  const en = EN?.[kind]?.[item?.id]?.[field];
  if (typeof en === 'string' && en) return en;
  // Notfall: Texte von Datenobjekten ohne EN-Eintrag kann auch EN_UI abdecken
  return typeof own === 'string' ? t(own) : own;
}

/** Name eines Datenobjekts (kind = Schlüssel in EN, z. B. 'research'). */
export const tName = (kind, item) => pick(kind, item, 'name');
/** Beschreibung eines Datenobjekts. */
export const tDesc = (kind, item) => pick(kind, item, 'desc');

// Spiellogik-Arten (gen, click, ...) -> Schlüssel in EN (en-data.js)
const KIND_KEY = { gen: 'generators', click: 'clicks', boost: 'boosts', research: 'research', shop: 'prestige', achievement: 'achievements', era: 'eras', buff: 'golden', queue: 'timers', recipe: 'recipes', resource: 'resources' };
/** Wie tName, aber mit der Kaufart der Spiellogik ('gen', 'click', 'boost', 'research', 'shop', ...). */
export const tDefName = (kind, item) => tName(KIND_KEY[kind] ?? kind, item);
export const tDefDesc = (kind, item) => tDesc(KIND_KEY[kind] ?? kind, item);
