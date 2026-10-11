// Industrie-Tab: Zeitleiste der Zeitalter und Generator-Ausbau (5 Stufen je Generator).
// Das DOM wird einmal gebaut; renderIndustry() (ca. 10x/s, nur bei aktivem Tab) ändert nur Text/Klassen.
import { state } from '../core/state.js';
import { fmt, fmtInt, fmtTime } from '../core/format.js';
import { ERAS, EVO_MAX, EVO_MULT } from '../data/eras.js';
import { GENS } from '../data/generators.js';
import { RES } from '../data/resources.js';
import { eraIndex, eraMult, eraProgress, eraNeeds, evoLevel, evoMult, evoCost, evoLock, genLevel, isRevealed, lockReason, canAfford } from '../core/formulas.js';
import { buyEvo, buyAllEvo } from '../systems/evolution.js';
import { imgFor } from './assets.js';
import { h, clear, setText, setClass, setAttr } from './dom.js';

const eras = [], rows = [];
let allBtn, allNote;

const mult = m => '×' + String(m).replace('.', ',');

export function buildIndustry(root) {
  if (!root) return;
  const line = h('ol', { class: 'era-line' });
  ERAS.forEach((e, i) => {
    const o = { el: h('li', { class: 'era-step' }), bar: h('i'), state: h('span', { class: 'era-state' }) };
    o.el.append(
      h('span', { class: 'era-step-ico', 'aria-hidden': 'true', text: e.sym }),
      h('strong', { text: e.name }),
      h('span', { class: 'era-step-at', text: i === 0 ? 'Start' : `ab ${fmt(e.at)} Erz gesamt · ${fmtTime(e.minTime)} Spielzeit` }),
      h('span', { class: 'era-step-mult', text: `Bonus ${mult(e.mult)}` }),
      h('span', { class: 'era-step-desc', text: e.desc }),
      h('span', { class: 'era-step-bar', 'aria-hidden': 'true' }, o.bar), o.state);
    eras.push(o); line.append(o.el);
  });

  allNote = h('span', { class: 'evo-all-note' });
  allBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Alles ausbauen' });
  allBtn.addEventListener('click', () => { buyAllEvo(); });

  const tbody = h('tbody');
  for (const g of GENS) {
    const r = { def: g, tr: h('tr', { class: 'evo-row' }), pips: [], key: '' };
    const ico = imgFor(g) ? h('img', { class: 'evo-ico', src: imgFor(g), alt: '', draggable: 'false' }) : h('span', { class: 'evo-ico', 'aria-hidden': 'true', text: g.icon });
    r.lvl = h('span', { class: 'evo-lvl' });
    r.pipsEl = h('span', { class: 'evo-pips', role: 'img' }, ...Array.from({ length: EVO_MAX }, () => { const p = h('i'); r.pips.push(p); return p; }));
    r.mult = h('span', { class: 'evo-mult' });
    r.next = h('span', { class: 'evo-next' });
    r.cost = h('span', { class: 'evo-cost' });
    r.btn = h('button', { class: 'btn', type: 'button', text: 'Ausbauen' });
    r.btn.addEventListener('click', () => { buyEvo(g.id); });
    r.tr.append(
      h('td', {}, h('span', { class: 'evo-name' }, ico, h('span', {}, h('b', { text: g.name }), r.lvl))),
      h('td', {}, r.pipsEl, r.mult), h('td', {}, r.next), h('td', {}, r.cost), h('td', {}, r.btn));
    rows.push(r); tbody.append(r.tr);
  }

  root.append(
    h('section', { class: 'panel-box wide' }, h('h2', { text: 'Zeitalter der Industrialisierung' }),
      h('p', { class: 'hint', text: 'Zeitalter brauchen insgesamt gefördertes Erz und Spielzeit (Offline-Zeit zählt mit), bleiben dauerhaft erhalten und erhöhen die gesamte Produktion. Mit jedem Zeitalter können alle Generatoren weiter ausgebaut werden.' }), line),
    h('section', { class: 'panel-box wide' },
      h('div', { class: 'evo-head' }, h('h2', { text: 'Generator-Ausbau' }), allNote, allBtn),
      h('p', { class: 'hint', text: 'Jede Ausbaustufe vervielfacht die Produktion eines Generators. Stufe k braucht Zeitalter k und eine Mindeststufe des Generators. Ausbauten gehen beim Neuguss verloren, die Zeitalter nicht.' }),
      h('table', { class: 'evo-table' },
        h('thead', {}, h('tr', {}, ...['Generator', 'Ausbau', 'Nächste Stufe', 'Kosten', ''].map(t => h('th', { scope: 'col', text: t })))), tbody)));
}

function costChips(r, cost) {
  const key = cost ? Object.keys(cost).map(k => k + fmt(cost[k]) + (state.res[k] >= cost[k] ? '+' : '-')).join('|') : '';
  if (r.key === key) return;
  r.key = key;
  clear(r.cost);
  if (!cost) return;
  for (const k of Object.keys(cost)) {
    const def = RES[k], ok = state.res[k] >= cost[k];
    r.cost.append(h('span', { class: ok ? 'ok' : 'bad', title: def.name }, imgFor(def) ? h('img', { class: 'cost-ico', src: imgFor(def), alt: def.name + ': ', draggable: 'false' }) : def.icon, fmt(cost[k])));
  }
}

/** Fortschritt in % plus Hinweis auf die noch fehlende Bedingung des nächsten Zeitalters. */
function nextState() {
  const n = eraNeeds(), pct = `${Math.round(eraProgress() * 100)} %`;
  if (!n) return pct;
  if (!n.ore && !n.time) return `${pct} · Erz und Zeit fehlen`;
  if (!n.ore) return `${pct} · Erz fehlt`;
  return `${pct} · noch ${fmtTime(n.missingTime)} Spielzeit`;
}

export function renderIndustry() {
  if (!rows.length) return;
  const idx = eraIndex();
  eras.forEach((o, i) => {
    setClass(o.el, 'done', i < idx); setClass(o.el, 'current', i === idx); setClass(o.el, 'next', i === idx + 1);
    setText(o.state, i < idx ? 'Erreicht' : i === idx ? `Aktuell · gesamt ${mult(eraMult(i).toFixed(2).replace(/\.?0+$/, ''))}` : i === idx + 1 ? nextState() : 'Gesperrt');
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
    setText(r.lvl, `Stufe ${fmtInt(lvl)}`);
    r.pips.forEach((p, i) => setClass(p, 'on', i < e));
    setAttr(r.pipsEl, 'aria-label', `Ausbau ${e} von ${EVO_MAX}`);
    setText(r.mult, e > 0 ? mult(String(Math.round(evoMult(g.id) * 100) / 100)) : '');
    setText(r.next, e >= EVO_MAX ? 'Voll ausgebaut' : `Stufe ${e + 1}: ${mult(EVO_MULT[e])}${lock ? ' · ' + lock : ''}`);
    setClass(r.next, 'locked', !!lock && e < EVO_MAX);
    costChips(r, lock ? null : cost);
    r.btn.disabled = !can;
    setText(r.btn, e >= EVO_MAX ? 'Max' : 'Ausbauen');
  }
  allBtn.disabled = buyable === 0;
  setText(allNote, buyable ? `${buyable} jetzt möglich` : '');
}
