import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { state, reset, installStorage } from './helpers.mjs';
import * as I from '../js/core/i18n.js';
import { EN_UI } from '../js/i18n/en-ui.js';
import * as S from '../js/core/save.js';
import { fmt, fmtInt, formatNumber } from '../js/core/format.js';

let ls;
beforeEach(() => { ls = installStorage(); reset(); I.setLang('de'); });

describe('t()', () => {
  test('Deutsch: Text unverändert, Platzhalter werden ersetzt', () => {
    assert.equal(I.t('Zahlenformat'), 'Zahlenformat');
    assert.equal(I.t('Stufe {n}', { n: 5 }), 'Stufe 5');
    assert.equal(I.t('{a} und {b}', { a: 'x' }), 'x und {b}');   // unbekannter Platzhalter bleibt stehen
  });
  test('Englisch: Übersetzung aus EN_UI mit Platzhaltern', () => {
    I.setLang('en');
    assert.equal(I.t('Zahlenformat'), 'Number format');
    assert.equal(I.t('Stufe {n}', { n: fmt(1234) }), 'Level 1.23K');
  });
  test('Fehlender Schlüssel fällt auf Deutsch zurück (auch mit Platzhaltern)', () => {
    I.setLang('en');
    assert.equal(I.t('Nicht übersetzt'), 'Nicht übersetzt');
    assert.equal(I.t('Nicht {x}', { x: 1 }), 'Nicht 1');
    assert.equal(I.t('toString'), 'toString');   // keine Prototyp-Treffer
  });
});

describe('Sprache setzen', () => {
  test('setLang schreibt state.settings.lang und localStorage; unbekannt -> de', () => {
    assert.equal(I.setLang('en'), 'en');
    assert.equal(I.getLang(), 'en');
    assert.equal(state.settings.lang, 'en');
    assert.equal(ls.getItem(I.LANG_KEY), 'en');
    assert.equal(I.setLang('fr'), 'de');
    assert.equal(state.settings.lang, 'de');
  });
  test('initLang: localStorage-Fallback hat Vorrang, sonst der Spielstand', () => {
    ls.setItem(I.LANG_KEY, 'en');
    assert.equal(I.initLang(), 'en');
    ls.removeItem(I.LANG_KEY);
    state.settings.lang = 'en';
    assert.equal(I.initLang(), 'en');
    ls.removeItem(I.LANG_KEY);
    state.settings.lang = 'xx';
    assert.equal(I.initLang(), 'de');
  });
  test('LANGS', () => {
    assert.deepEqual(I.LANGS.map(l => l.id), ['de', 'en']);
  });
  test('Zahlenformat folgt der Sprache', () => {
    assert.equal(fmt(1234), '1,23K');
    assert.equal(fmt(0.001), '<0,01');
    I.setLang('en');
    assert.equal(fmt(1234), '1.23K');
    assert.equal(fmt(0.001), '<0.01');
    assert.equal(formatNumber(5.5), '5.5');
    assert.equal(fmtInt(12345), '12,345');
    I.setLang('de');
    assert.equal(fmtInt(12345), '12.345');
  });
});

describe('Spielstand: lang', () => {
  const wrap = st => Buffer.from(JSON.stringify({ v: 5, t: 1_700_000_000_000, state: st }), 'utf8').toString('base64');
  test('Default de, gültige ID bleibt, ungültige -> de', () => {
    assert.equal(S.sanitize({}).settings.lang, 'de');
    assert.equal(S.sanitize({ settings: { lang: 'en' } }).settings.lang, 'en');
    assert.equal(S.sanitize({ settings: { lang: 'fr' } }).settings.lang, 'de');
    assert.equal(S.sanitize({ settings: { lang: 5 } }).settings.lang, 'de');
  });
  test('Import: älterer Spielstand ohne lang -> de; mit lang en bleibt en', () => {
    S.importSave(wrap({ settings: { format: 'standard' } }));
    assert.equal(state.settings.lang, 'de');
    S.importSave(wrap({ settings: { lang: 'en' } }));
    assert.equal(state.settings.lang, 'en');
  });
  test('Roundtrip über Export', () => {
    state.settings.lang = 'en';
    S.importSave(S.exportSave());
    assert.equal(state.settings.lang, 'en');
  });
  test('Neuer Spielstand startet deutsch', () => {
    assert.equal(state.settings.lang, 'de');
  });
});

describe('tName / tDesc', () => {
  const item = { id: 'definitiv-unbekannt', name: 'Deutscher Name', desc: 'Deutsche Beschreibung' };
  test('Deutsch liefert die Datenfelder', () => {
    assert.equal(I.tName('research', item), 'Deutscher Name');
    assert.equal(I.tDesc('research', item), 'Deutsche Beschreibung');
  });
  test('Englisch ohne Eintrag (oder unbekannte Art) fällt auf Deutsch zurück', () => {
    I.setLang('en');
    assert.equal(I.tName('research', item), 'Deutscher Name');
    assert.equal(I.tDesc('research', item), 'Deutsche Beschreibung');
    assert.equal(I.tName('gibt-es-nicht', item), 'Deutscher Name');
    assert.equal(I.tDesc('research', { id: 'x' }), undefined);
  });
  test('Englisch: Eintrag aus EN-Daten, falls vorhanden; sonst EN_UI-Fallback', async () => {
    I.setLang('en');
    assert.equal(I.tName('boosts', { id: 'zz', name: 'Labor' }), 'Lab');   // EN_UI-Fallback für Datennamen
    const mod = await import('../js/i18n/en-data.js');
    assert.ok(mod?.EN?.resources, 'en-data.js muss importierbar sein und EN.resources liefern');
    for (const [id, v] of Object.entries(mod.EN.resources)) assert.equal(I.tName('resources', { id, name: 'Quelle' }), v.name);
  });

  test('EN-Daten sind vollständig: jede ID in RESEARCH/BOOSTS/CLICKS/GENS/ERAS/ACHIEVEMENTS hat einen Namen (Forschung/Boosts auch desc)', async () => {
    const { EN } = await import('../js/i18n/en-data.js');
    const { RESEARCH } = await import('../js/data/research.js');
    const { BOOSTS, CLICKS } = await import('../js/data/upgrades.js');
    const { GENS } = await import('../js/data/generators.js');
    const { ERAS } = await import('../js/data/eras.js');
    const { ACHIEVEMENTS } = await import('../js/data/achievements.js');
    const check = (kind, list, desc) => {
      assert.ok(EN[kind], 'EN.' + kind + ' fehlt');
      for (const x of list) {
        assert.ok(EN[kind][x.id]?.name, `EN.${kind}.${x.id}.name fehlt`);
        if (desc) assert.ok(EN[kind][x.id]?.desc, `EN.${kind}.${x.id}.desc fehlt`);
      }
    };
    check('research', RESEARCH, true);
    check('boosts', BOOSTS, true);
    check('clicks', CLICKS, false);
    check('generators', GENS, false);
    check('eras', ERAS, false);
    check('achievements', ACHIEVEMENTS, false);
  });
});

// ---- Vollständigkeit: jeder deutsche t()-Schlüssel muss in EN_UI stehen ----
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'data' && f !== 'i18n') walk(p, out); } else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const unesc = s => s.replace(/\\'/g, "'").replace(/\\n/g, '\n');
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

describe('Vollständigkeit der Übersetzung', () => {
  const keys = new Set();
  for (const f of walk('js').filter(f => !f.endsWith('core/i18n.js'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?<![\w.])t\('((?:[^'\\]|\\.)*)'/g)) keys.add(unesc(m[1]));
  }
  for (const m of readFileSync('js/core/save.js', 'utf8').matchAll(/new Error\('((?:[^'\\]|\\.)*)'\)/g)) keys.add(unesc(m[1]));
  for (const m of readFileSync('index.html', 'utf8').matchAll(/data-i18n(?:-\w+)?="([^"]*)"/g)) keys.add(m[1].replace(/&amp;/g, '&'));

  test('es gibt Schlüssel', () => assert.ok(keys.size > 100));
  test('jeder t()-Schlüssel hat eine englische Übersetzung', () => {
    const missing = [...keys].filter(k => !Object.hasOwn(EN_UI, k));
    assert.deepEqual(missing, []);
  });
  test('Platzhalter stimmen überein', () => {
    const bad = Object.entries(EN_UI).filter(([de, en]) => placeholders(de) !== placeholders(en)).map(([de]) => de);
    assert.deepEqual(bad, []);
  });
  test('keine leeren Übersetzungen', () => {
    assert.deepEqual(Object.entries(EN_UI).filter(([, en]) => typeof en !== 'string' || !en).map(([de]) => de), []);
  });
  test('FORMATS-Labels und Daten-Fallbacks sind übersetzt', async () => {
    const { FORMATS } = await import('../js/core/format.js');
    const { MILESTONES, PRESTIGE, AUTOBUYERS } = await import('../js/data/prestige.js');
    const { QUEUES } = await import('../js/data/timers.js');
    const { TIER_NAMES } = await import('../js/data/generators.js');
    const all = [...FORMATS.map(f => f.label), ...MILESTONES.map(m => m.desc), PRESTIGE.name, PRESTIGE.currency, ...Object.values(QUEUES).map(q => q.name), ...AUTOBUYERS.map(a => a.name), ...TIER_NAMES];
    assert.deepEqual(all.filter(k => !Object.hasOwn(EN_UI, k)), []);
  });
});
