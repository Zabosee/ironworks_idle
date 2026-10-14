// Robuste Zahlenformatierung (Standard-Suffixe, wissenschaftlich, Engineering).
// Dezimaltrennzeichen und Locale folgen der Sprache (de: Komma, en: Punkt). Die Labels sind deutsche i18n-Schlüssel (Anzeige per t()).
import { getLang, locale, t } from './i18n.js';

export const FORMATS = [
  { id: 'standard',    label: 'Standard (1,23M)' },
  { id: 'scientific',  label: 'Wissenschaftlich (1,23e6)' },
  { id: 'engineering', label: 'Engineering (1,23e6, Exponent durch 3 teilbar)' },
];
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];

let mode = 'standard';
export function setFormat(id) { mode = FORMATS.some(f => f.id === id) ? id : 'standard'; }
export function getFormat() { return mode; }

const trim = s => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
const dec = s => (getLang() === 'en' ? s : s.replace('.', ','));
/** Wandelt eine Zahl bzw. einen Zahltext mit Punkt ins sprachabhängige Dezimalformat (de: Komma). */
export const decimal = x => dec(String(x));

function exponentOf(n) {
  let e = Math.floor(Math.log10(n));
  // Fließkomma-Korrektur an Zehnerpotenzen
  if (n / 10 ** e >= 10) e++;
  else if (n / 10 ** e < 1) e--;
  return e;
}

export function formatNumber(value, m = mode, digits = 2) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (n < 0) return '-' + formatNumber(-n, m, digits);
  if (n === 0) return '0';
  if (n < 1000) {
    if (n < 0.01) return '<' + dec('0.01');
    const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(digits);
    if (parseFloat(s) < 1000) return dec(trim(s));
    // Rundung erreicht 1000 (z. B. 999,9) -> Suffix-Zweig
    return formatNumber(1000, m, digits);
  }
  let e = exponentOf(n);
  if (m === 'standard') {
    let tier = Math.floor(e / 3);
    if (tier < SUFFIX.length) {
      let s = (n / 10 ** (tier * 3)).toFixed(digits);
      if (parseFloat(s) >= 1000) {
        if (tier + 1 < SUFFIX.length) { tier++; s = (n / 10 ** (tier * 3)).toFixed(digits); }
        else { tier = -1; }
      }
      if (tier >= 0) return dec(s) + SUFFIX[tier];
    }
    m = 'scientific';
  }
  if (m === 'engineering') {
    let e3 = Math.floor(e / 3) * 3;
    let s = (n / 10 ** e3).toFixed(digits);
    if (parseFloat(s) >= 1000) { e3 += 3; s = (n / 10 ** e3).toFixed(digits); }
    return dec(s) + 'e' + e3;
  }
  let s = (n / 10 ** e).toFixed(digits);
  if (parseFloat(s) >= 10) { e++; s = (n / 10 ** e).toFixed(digits); }
  return dec(s) + 'e' + e;
}

export const fmt = n => formatNumber(n);

/** Ganzzahlen (Stufen, Zähler): bis 999.999 mit Tausenderpunkt, darüber kompakt. */
export function fmtInt(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return fmt(n);
  if (Math.abs(n) < 1e6) return (Math.round(n) + 0).toLocaleString(locale()); // +0 normalisiert -0
  return fmt(n);
}

export const fmtPercent = x => fmt(x * 100) + ' %';

/** Zeitspanne in Sekunden als "1 d 2 h 3 min 4 s" (maximal zwei Einheiten bei großen Werten). */
export function fmtTime(sec) {
  sec = Number(sec);
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), mi = Math.floor(sec % 3600 / 60), s = sec % 60;
  const parts = [];
  if (d) parts.push(d + ' d');
  if (h) parts.push(h + ' h');
  if (mi && parts.length < 2) parts.push(mi + ' min');
  if ((s || !parts.length) && parts.length < 2) parts.push(s + ' s');
  return parts.join(' ');
}

/** Geschätzte Restzeit: ab mehr als einem Jahr nur noch "> 1 Jahr" (ohne Präfix). `key` = optionaler i18n-Schlüssel mit {time}, z. B. 'ca. {time}'. */
export const fmtEta = (sec, key) => (Number(sec) > 365 * 86400 ? t('> 1 Jahr') : key ? t(key, { time: fmtTime(sec) }) : fmtTime(sec));

/** Restzeit als Uhr "m:ss" (ab einer Stunde "h:mm:ss"); Sekunden werden aufgerundet. */
export function fmtClock(sec) {
  sec = Number(sec);
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  sec = Math.ceil(sec - 1e-9);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
