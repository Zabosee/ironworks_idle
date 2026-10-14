// Industrie-Tab: Meilenstein-Leisten, Zeitleiste der Zeitalter (9) und Generator-Ausbau (8 Stufen je Generator).
// Das DOM wird einmal gebaut; renderIndustry() (ca. 10x/s, nur bei aktivem Tab) ändert nur Text/Klassen.
import { state } from '../core/state.js';
import { fmt, fmtInt, fmtEta, decimal } from '../core/format.js';
import { t, tName, tDesc } from '../core/i18n.js';
import { ERAS, EVO_MAX, EVO_MULT } from '../data/eras.js';
import { INDUSTRY_TRACKS } from '../data/industry.js';
import { GENS } from '../data/generators.js';
import { RES } from '../data/resources.js';
import { eraIndex, eraMult, eraProgress, evoLevel, evoMult, evoCost, evoLock, genLevel, isRevealed, lockReason, canAfford, industryProgress } from '../core/formulas.js';
import { buyEvo, buyAllEvo } from '../systems/evolution.js';
import { imgFor, symSvg, svgUse } from './assets.js';
import { restartAnim } from './effects.js';
import { h, clear, setText, setClass, setAttr } from './dom.js';

const eras = [], rows = [], tracks = [];
let allBtn, allNote, moreEras;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const TRACK_SYM = { output: 'chart', variety: 'variety' };

const mult = m => '×' + decimal(m);

export function buildIndustry(root) {
  if (!root) return;
  const line = h('ol', { class: 'era-line' });
  ERAS.forEach((e, i) => {
    const o = { el: h('li', { class: 'era-step' }), bar: h('i'), state: h('span', { class: 'era-state' }) };
    o.el.append(
      h('span', { class: 'era-step-ico', 'aria-hidden': 'true' }, symSvg(e.ico)),
      h('strong', { text: tName('eras', e) }),
      h('span', { class: 'era-step-at', text: i === 0 ? t('Start') : t('ab {ore} Erz gesamt', { ore: fmt(e.at) }) }),
      h('span', { class: 'era-step-mult', text: t('Bonus {mult}', { mult: mult(e.mult) }) }),
      h('span', { class: 'era-step-desc', text: tDesc('eras', e) }),
      h('span', { class: 'era-step-bar', 'aria-hidden': 'true' }, o.bar), o.state);
    eras.push(o); line.append(o.el);
  });

  moreEras = h('p', { class: 'hint', text: t('Weitere Zeitalter folgen') });

  // Meilenstein-Leisten (Fördermenge, Materialvielfalt)
  const trackBoxes = INDUSTRY_TRACKS.map(def => {
    const o = { def, marks: [], reached: -1 };
    o.total = h('strong', { class: 'track-total' });
    o.list = h('ol', { class: 'track-marks' });
    def.steps.forEach((st, i) => {
      const li = h('li', { class: 'track-mark' },
        h('span', { class: 'mark-dot', 'aria-hidden': 'true' }, h('b', { text: String(i + 1) }), svgUse('check', 'mark-check')),
        h('span', { class: 'mark-at', text: def.log ? fmt(st.at) : t('{n} Materialien', { n: st.at }) }),
        h('span', { class: 'mark-mult', text: mult(st.mult) }),
        h('span', { class: 'mark-next', text: t('Nächste') }));
      o.marks.push({ li, st });
      o.list.append(li);
    });
    o.fill = h('div', { class: 'bar-fill' });
    o.bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': t('Fortschritt zur nächsten Stufe: {name}', { name: tName('industry', def) }), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, o.fill);
    o.text = h('p', { class: 'track-text' });
    tracks.push(o);
    return h('section', { class: 'panel-box track', 'aria-labelledby': 'track-h-' + def.id },
      h('div', { class: 'track-head' }, h('h2', { id: 'track-h-' + def.id }, symSvg(TRACK_SYM[def.id] || 'chart', 'h-ico', 'prestige'), ' ' + tName('industry', def)), o.total), o.list, o.bar, o.text);
  });

  allNote = h('span', { class: 'evo-all-note' });
  allBtn = h('button', { class: 'btn btn-primary', type: 'button', text: t('Alles ausbauen') });
  allBtn.addEventListener('click', () => { buyAllEvo(); });

  const tbody = h('tbody');
  for (const g of GENS) {
    const r = { def: g, tr: h('tr', { class: 'evo-row' }), pips: [], key: '' };
    const ico = imgFor(g) ? h('img', { class: 'evo-ico', src: imgFor(g), alt: '', draggable: 'false' }) : h('span', { class: 'evo-ico', 'aria-hidden': 'true' }, symSvg('ingot'));
    r.lvl = h('span', { class: 'evo-lvl' });
    r.pipsEl = h('span', { class: 'evo-pips', role: 'img' }, ...Array.from({ length: EVO_MAX }, (_, i) => { const p = h('i', { title: t('Ausbau {n}', { n: ROMAN[i] }) }); r.pips.push(p); return p; }));
    r.mult = h('span', { class: 'evo-mult' });
    r.next = h('span', { class: 'evo-next' });
    r.cost = h('span', { class: 'evo-cost' });
    r.btn = h('button', { class: 'btn', type: 'button', text: t('Ausbauen') });
    r.btn.addEventListener('click', () => { buyEvo(g.id); });
    r.tr.append(
      h('td', {}, h('span', { class: 'evo-name' }, ico, h('span', {}, h('b', { text: tName('generators', g) }), r.lvl))),
      h('td', {}, r.pipsEl, r.mult), h('td', {}, r.next), h('td', {}, r.cost), h('td', {}, r.btn));
    rows.push(r); tbody.append(r.tr);
  }

  root.append(
    h('div', { class: 'industry-tracks' }, h('h2', { class: 'sr-only', text: t('Meilensteine') }), trackBoxes),
    h('section', { class: 'panel-box wide' }, h('h2', { text: t('Zeitalter der Industrialisierung') }),
      h('p', { class: 'hint', text: t('Zeitalter brauchen insgesamt gefördertes Erz, bleiben dauerhaft erhalten und erhöhen die gesamte Produktion. Mit jedem Zeitalter können alle Generatoren weiter ausgebaut werden.') }), line, moreEras),
    h('section', { class: 'panel-box wide' },
      h('div', { class: 'evo-head' }, h('h2', { text: t('Generator-Ausbau') }), allNote, allBtn),
      h('p', { class: 'hint', text: t('Jede Ausbaustufe vervielfacht die Produktion eines Generators. Stufe k braucht Zeitalter k und eine Mindeststufe des Generators. Ausbauten gehen beim Neuguss verloren, die Zeitalter nicht.') }),
      h('div', { class: 'evo-scroll' }, h('table', { class: 'evo-table' },
        h('thead', {}, h('tr', {}, ...[t('Generator'), t('Ausbau'), t('Nächste Stufe'), t('Kosten'), ''].map(label => h('th', { scope: 'col', text: label })))), tbody))));
}

function costChips(r, cost) {
  const key = cost ? Object.keys(cost).map(k => k + fmt(cost[k]) + (state.res[k] >= cost[k] ? '+' : '-')).join('|') : '';
  if (r.key === key) return;
  r.key = key;
  clear(r.cost);
  if (!cost) return;
  for (const k of Object.keys(cost)) {
    const def = RES[k], ok = state.res[k] >= cost[k];
    r.cost.append(h('span', { class: ok ? 'ok' : 'bad', title: tName('resources', def) }, imgFor(def) ? h('img', { class: 'cost-ico', src: imgFor(def), alt: tName('resources', def) + ': ', draggable: 'false' }) : symSvg('ingot', 'cost-sym'), fmt(cost[k])));
  }
}

/** Fortschritt in % zum nächsten Zeitalter. */
function nextState() {
  return `${Math.round(eraProgress() * 100)} %`;
}

/** Meilenstein-Leisten: nur Zustände, Füllstand und Text. */
function renderTracks(r) {
  const prog = industryProgress();
  tracks.forEach((o, ti) => {
    const p = prog[ti], def = o.def;
    setText(o.total, mult(String(Math.round(p.mult * 100) / 100)));
    if (o.reached !== p.reached) {
      if (o.reached >= 0 && p.reached > o.reached) restartAnim(o.marks[p.reached - 1].li, 'mark-pulse');
      o.reached = p.reached;
      o.marks.forEach(({ li, st }, i) => {
        const state = i < p.reached ? t('erreicht') : i === p.reached ? t('nächste') : t('gesperrt');
        setClass(li, 'done', i < p.reached); setClass(li, 'next', i === p.reached);
        setAttr(li, 'aria-label', t('Stufe {n}, {at}, {mult}, {state}', { n: i + 1, at: def.log ? fmt(st.at) : t('{n} Materialien', { n: st.at }), mult: mult(st.mult), state }));
      });
    }
    const f = p.progress.toFixed(3);
    if (o.fill._f !== f) { o.fill._f = f; o.fill.style.transform = `scaleX(${f})`; }
    let txt;
    if (p.next == null) txt = t('Alle Stufen erreicht');
    else if (def.log) {
      txt = t('{cur} / {at} Erz', { cur: fmt(p.value), at: fmt(p.next) });
      const rate = r?.ore || 0;
      if (rate > 0) txt += ' · ' + fmtEta((p.next - p.value) / rate, 'in ca. {time}');
    } else txt = t('{cur}/{at} Materialien', { cur: fmtInt(p.value), at: fmtInt(p.next) });
    setText(o.text, txt);
    setAttr(o.bar, 'aria-valuenow', Math.round(p.progress * 100));
    setAttr(o.bar, 'aria-valuetext', txt);
  });
}

export function renderIndustry(r) {
  if (!rows.length) return;
  const idx = eraIndex();
  renderTracks(r);
  // Zeitalter 6 bis 8 erst sichtbar, wenn Zeitalter 5 erreicht ist
  const showAll = idx >= 5;
  setText(moreEras, t('Weitere Zeitalter folgen'));
  if (moreEras.hidden !== showAll) moreEras.hidden = showAll;
  eras.forEach((o, i) => {
    const vis = showAll || i <= 5;
    if (o.el.hidden === vis) o.el.hidden = !vis;
    setClass(o.el, 'done', i < idx); setClass(o.el, 'current', i === idx); setClass(o.el, 'next', i === idx + 1);
    setText(o.state, i < idx ? t('Erreicht') : i === idx ? t('Aktuell · gesamt {mult}', { mult: mult(String(parseFloat(eraMult(i).toFixed(2)))) }) : i === idx + 1 ? nextState() : t('Gesperrt'));
    const f = i <= idx ? 1 : i === idx + 1 ? eraProgress() : 0;
    const s = f.toFixed(3);
    if (o.bar._f !== s) { o.bar._f = s; o.bar.style.transform = `scaleX(${s})`; }
  });
  let buyable = 0;
  for (const r of rows) {
    const g = r.def, lvl = genLevel(g.id), vis = lvl > 0 || (isRevealed('gen', g.id) && !lockReason('gen', g.id));
    if (r.tr.hidden !== !vis) r.tr.hidden = !vis;
    if (!vis) continue;
    const e = evoLevel(g.id), lock = evoLock(g.id), cost = e < EVO_MAX ? evoCost(g.id) : null, can = !lock && cost && canAfford(cost);
    if (can) buyable++;
    setText(r.lvl, t('Stufe {n}', { n: fmtInt(lvl) }));
    r.pips.forEach((p, i) => { setClass(p, 'on', i < e); const v = i < 5 || idx >= i + 1 || i < e; if (p.hidden === v) p.hidden = !v; });   // Ausbau VI bis VIII erst mit Zeitalter 6 bis 8
    setAttr(r.pipsEl, 'aria-label', t('Ausbau {e} von {max}', { e, max: EVO_MAX }));
    setText(r.mult, e > 0 ? mult(String(Math.round(evoMult(g.id) * 100) / 100)) : '');
    setText(r.next, e >= EVO_MAX ? t('Voll ausgebaut') : `${t('Stufe {n}', { n: e + 1 })}: ${mult(EVO_MULT[e])}${lock ? ' · ' + lock : ''}`);
    setClass(r.next, 'locked', !!lock && e < EVO_MAX);
    costChips(r, lock ? null : cost);
    r.btn.disabled = !can;
    setText(r.btn, e >= EVO_MAX ? t('Max') : t('Ausbauen'));
  }
  allBtn.disabled = buyable === 0;
  setText(allNote, buyable ? t('{n} jetzt möglich', { n: buyable }) : '');
}
