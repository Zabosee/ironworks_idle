import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, fmt, fmtInt, fmtTime, fmtPercent, setFormat, getFormat } from '../js/core/format.js';

const S = (n) => formatNumber(n, 'standard');
const SC = (n) => formatNumber(n, 'scientific');
const EN = (n) => formatNumber(n, 'engineering');

describe('format: Standard', () => {
  test('0 und kleine Werte', () => {
    assert.equal(S(0), '0');
    assert.equal(S(1), '1');
    assert.equal(S(1.5), '1,5');
    assert.equal(S(12.34), '12,3');
    assert.equal(S(123.4), '123');
    assert.equal(S(0.5), '0,5');
    assert.equal(S(0.001), '<0,01');
  });
  test('Suffixe K/M/B/T', () => {
    assert.equal(S(1000), '1,00K');
    assert.equal(S(1234), '1,23K');
    assert.equal(S(1.5e6), '1,50M');
    assert.equal(S(2e9), '2,00B');
    assert.equal(S(3e12), '3,00T');
    assert.equal(S(1e15), '1,00Qa');
  });
  test('Rundung an Suffix-Grenze springt in naechste Stufe', () => {
    assert.equal(S(999999), '1,00M');
    assert.equal(S(999999.5), '1,00M');
    assert.equal(S(999500), '999,50K');
  });
  test('letzter Suffix und danach wissenschaftlich', () => {
    assert.equal(S(1e42), '1,00Td');
    assert.equal(S(1e45), '1,00e45');
    assert.equal(S(1e300), '1,00e300');
  });
  test('Zehnerpotenzen 1e3..1e60 liefern nie 10,00 / 1000,00 oder NaN', () => {
    for (let k = 3; k <= 60; k++) {
      const n = Number('1e' + k);
      for (const m of ['standard', 'scientific', 'engineering']) {
        const out = formatNumber(n, m);
        assert.match(out, /^(1|10|100),00(K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc|Ud|Dd|Td|e\d+)$/, `${m} 1e${k} -> ${out}`);
      }
      const sci = SC(n);
      assert.equal(sci, '1,00e' + k, `sci 1e${k}`);
    }
  });
  test('Werte knapp unter einer Zehnerpotenz (Float)', () => {
    for (let k = 6; k <= 40; k++) {
      const n = Number('1e' + k) * (1 - 1e-15);
      const out = S(n);
      assert.doesNotMatch(out, /NaN|undefined|1000|10,00e/, `${k}: ${out}`);
    }
  });
  test('Negative Zahlen', () => {
    assert.equal(S(-1500), '-1,50K');
    assert.equal(S(-5), '-5');
    assert.equal(S(-0), '0');
  });
  test('NaN / Infinity / ungueltige Eingaben', () => {
    assert.equal(S(NaN), '0');
    assert.equal(S(Infinity), '∞');
    assert.equal(S(-Infinity), '-∞');
    assert.equal(S('abc'), '0');
    assert.equal(S(undefined), '0');
    assert.equal(S(null), '0');
    assert.equal(S('1e3'), '1,00K');
  });
  test('groesste endliche Zahl', () => {
    assert.equal(S(Number.MAX_VALUE), '1,80e308');
  });
  test('Ergebnis nahe 1000 unter 1000 wird nicht als "1000" ausgegeben', () => {
    assert.notEqual(S(999.9), '1000');
    assert.notEqual(S(999.5), '1000');
  });
});

describe('format: wissenschaftlich', () => {
  test('Beispiele', () => {
    assert.equal(SC(1234567), '1,23e6');
    assert.equal(SC(1e5), '1,00e5');
    assert.equal(SC(9.999e5), '1,00e6');
    assert.equal(SC(-2.5e10), '-2,50e10');
    assert.equal(SC(NaN), '0');
    assert.equal(SC(Infinity), '∞');
  });
});

describe('format: Engineering', () => {
  test('Exponent immer durch 3 teilbar, Mantisse 1..999', () => {
    assert.equal(EN(1234567), '1,23e6');
    assert.equal(EN(12345678), '12,35e6');
    assert.equal(EN(1e5), '100,00e3');
    assert.equal(EN(999999), '1,00e6');
    assert.equal(EN(1e45), '1,00e45');
    for (const n of [1e3, 5e4, 7.7e7, 3.3e11, 9.99e20, 1.23e100]) {
      const m = EN(n).match(/^(\d+),(\d\d)e(\d+)$/);
      assert.ok(m, EN(n));
      assert.equal(Number(m[3]) % 3, 0, EN(n));
      assert.ok(Number(m[1]) >= 1 && Number(m[1]) < 1000, EN(n));
    }
  });
});

describe('format: Modus und Helfer', () => {
  test('setFormat / getFormat, ungueltige IDs fallen auf standard', () => {
    setFormat('scientific'); assert.equal(getFormat(), 'scientific');
    assert.equal(fmt(1e6), '1,00e6');
    setFormat('engineering'); assert.equal(getFormat(), 'engineering');
    setFormat('quatsch'); assert.equal(getFormat(), 'standard');
    assert.equal(fmt(1e6), '1,00M');
  });
  test('fmtInt', () => {
    assert.equal(fmtInt(0), '0');
    assert.equal(fmtInt(1234), '1.234');
    assert.equal(fmtInt(2e6), '2,00M');
    assert.equal(fmtInt(NaN), '0');
    assert.equal(fmtInt(Infinity), '∞');
  });
  test('fmtInt rundet kleine negative Werte nicht zu "-0"', () => {
    assert.equal(fmtInt(-0.4), '0');
  });
  test('fmtPercent', () => { assert.equal(fmtPercent(0.25), '25 %'); });
  test('fmtTime', () => {
    assert.equal(fmtTime(0), '0 s');
    assert.equal(fmtTime(59), '59 s');
    assert.equal(fmtTime(61), '1 min 1 s');
    assert.equal(fmtTime(3661), '1 h 1 min');
    assert.equal(fmtTime(90061), '1 d 1 h');
    assert.equal(fmtTime(-5), '0 s');
    assert.equal(fmtTime(NaN), '0 s');
    assert.equal(fmtTime(Infinity), '0 s');
  });
});
