// Seitenleiste und Kopfbereich: Ressourcen-Meter, Produktions-Deltas, Buffs, Zeitalter, Kaufmenge.
import { state } from '../core/state.js';
import { fmt, fmtInt, decimal } from '../core/format.js';
import { t, tName, tDesc } from '../core/i18n.js';
import { prestigeMult, resVisible, eraDef, eraIndex, nextEra, eraMult, eraProgress, industryUnlocked } from '../core/formulas.js';
import { RES, RES_IDS } from '../data/resources.js';
import { RECIPE_MAP } from '../data/recipes.js';
import { PRESTIGE } from '../data/prestige.js';
import { BUFFS } from '../data/golden.js';
import { canPrestige } from '../systems/prestige.js';
import { imgFor, symSvg } from './assets.js';
import { buildGoalBar, buildCastPreview } from './goals.js';
import { renderCorpTab } from './corp-common.js';
import { h, $, clear, setText, setAttr } from './dom.js';
import { setTabHidden } from './tabs.js';
import { renderBadges } from './queues.js';

const meters = {};         // pro Ressource: { amt, rps, delta, canvas }
export const els = {};

export function initSidebar() {
  Object.assign(els, {
    meters: $('#meters'), clickVal: $('#clickVal'), buffs: $('#buffs'), saved: $('#saved'),
    buyAmount: $('#buyamount'), prestigeDot: $('#prestige-dot'),
    castCount: $('#cast-count'), castPoints: $('#cast-points'), castBonus: $('#cast-bonus'),
    eraBox: $('#era-summary'), eraName: $('#era-name'), eraBonus: $('#era-bonus'), eraIco: $('#era-ico'), eraFill: $('#era-fill'), eraNext: $('#era-next'),
  });
  buildMeters();
}

const BASE_RES = ['ore', 'steel', 'titan'];
const CORP_RES = RES_IDS.filter(k => RES[k].req?.[0]?.startsWith('c_'));   // Konzern-Materialien (Freischaltung per Konzernforschung)
const groups = [];   // { ids, el, list, toggle, count, countEl, setOpen }
/** Einklappbare Untergruppe der Materialien (Kopf-Knopf mit aria-expanded). */
function makeGroup(id, title, ids, icon) {
  const g = { ids, count: 0 };
  g.countEl = h('span', { class: 'more-count' });
  g.list = h('div', { class: 'meters-more-list', id: 'meters-' + id + '-list' });
  g.toggle = h('button', { class: 'more-toggle more-toggle-' + id, type: 'button', 'aria-expanded': 'true', 'aria-controls': g.list.id },
    icon ? symSvg(icon, 'more-ico', 'prestige') : null, h('span', { text: title + ' ' }), g.countEl, h('span', { class: 'more-chev', 'aria-hidden': 'true' }));
  g.el = h('div', { class: 'meters-more meters-' + id }, g.toggle, g.list);
  g.setOpen = open => { g.toggle.setAttribute('aria-expanded', String(open)); g.list.hidden = !open; };
  g.toggle.addEventListener('click', () => g.setOpen(g.list.hidden));
  groups.push(g);
  return g;
}

function buildMeters() {
  const more = makeGroup('more', t('Weitere Materialien'), RES_IDS.filter(k => !BASE_RES.includes(k) && !CORP_RES.includes(k)));
  const corp = makeGroup('corp', t('Konzern-Materialien'), CORP_RES, 'corp');
  $('#cast-ico').append(symSvg(PRESTIGE.sym || 'flame', '', 'prestige'));
  $('#cast-summary').addEventListener('click', () => document.getElementById('tabbtn-prestige')?.click());
  // Zielleiste: im Werk-Tab (auch mobil sichtbar) und als Einzeiler unter dem Zeitalter (nur Desktop)
  els.goalWorks = buildGoalBar('goal-works');
  $('#tab-works').prepend(els.goalWorks.el);
  els.goalSide = buildGoalBar('goal-side');
  els.eraBox.parentNode.insertBefore(els.goalSide.el, els.eraBox.nextSibling);
  els.castPreview = buildCastPreview();   // nur für Messpunkte und den Tooltip der Neuguss-Übersicht
  for (const k of RES_IDS) {
    const r = RES[k];
    const m = {
      amt: h('span', { class: 'amt' }), rps: h('span', { class: 'rps' }),
      delta: h('span', { class: 'delta' }),
      flows: h('div', { class: 'meter-flows' }), lines: {},
    };
    meters[k] = m;
    m.el = h('div', { class: 'meter', style: `--c:${r.color}` },
      h('div', { class: 'orb', id: 'orb-' + k, 'aria-hidden': 'true' },
        h('span', { class: 'ring' }), h('span', { class: 'orb-core' }, imgFor(r) ? h('img', { src: imgFor(r), alt: '', draggable: 'false' }) : symSvg('ingot'))),
      h('div', { class: 'meter-body' },
        h('div', { class: 'meter-row' }, h('span', { class: 'meter-name', text: tName('resources', r) }), m.amt),
        h('div', { class: 'meter-row small' }, h('span', {}, m.rps, '/s'), m.delta),
        m.flows));
    (BASE_RES.includes(k) ? els.meters : (CORP_RES.includes(k) ? corp : more).list).append(m.el);
  }
  els.meters.append(more.el, corp.el);
  // Mobil (<1024px): "Weitere Materialien" immer offen (Teil der kompakten Leiste), Konzern-Materialien zunächst eingeklappt
  const mq = window.matchMedia('(max-width: 1023px)');
  const sync = () => { if (mq.matches) more.setOpen(true); };
  mq.addEventListener('change', sync);
  if (mq.matches) corp.setOpen(false);
  sync();
}

// ---------- Oben / global ----------
export function showDelta(before, after) {
  for (const k of RES_IDS) {
    if (!(after[k] > before[k] * 1.001)) continue;
    const el = meters[k].delta;
    el.textContent = before[k] > 0 ? `▲ +${fmt((after[k] / before[k] - 1) * 100)} %` : t('▲ NEU');
    el.classList.add('show');
    clearTimeout(el._h);
    el._h = setTimeout(() => el.classList.remove('show'), 2000);
  }
}

let buffKey = '';
const buffTimes = {};
export function renderBuffs(force = false) {
  const key = state.buffs.map(b => b.id + (b.res || '')).join(',');
  if (force || key !== buffKey) {
    buffKey = key;
    clear(els.buffs);
    for (const b of state.buffs) {
      const def = BUFFS[b.id];
      if (!def) continue;
      const time = h('span', { class: 'buff-time' });
      buffTimes[b.id] = time;
      els.buffs.append(h('li', { class: 'buff' }, h('span', { class: 'buff-ico', 'aria-hidden': 'true' }, def.sym ? symSvg(def.sym, '', 'buff') : def.icon), h('span', { class: 'buff-name', text: `${tName('golden', def)} (${b.res ? t('{res} −{pct} %', { res: tName('resources', RES[b.res]), pct: Math.round((1 - def.mult) * 100) }) : tDesc('golden', def)})` }), time));
    }
  }
  for (const b of state.buffs) if (buffTimes[b.id]) setText(buffTimes[b.id], Math.ceil(b.left) + ' s');
}

export function renderTop(r) {
  for (const g of groups) g.count = 0;
  for (const k of RES_IDS) {
    const vis = resVisible(k);
    const g = groups.find(x => x.ids.includes(k));
    if (g && vis) g.count++;
    if (meters[k].el.hidden === vis) meters[k].el.hidden = !vis;
    setText(meters[k].amt, fmt(state.res[k]));
    setText(meters[k].rps, fmt(r[k]));
  }
  for (const g of groups) {
    if (g.el.hidden !== (g.count === 0)) g.el.hidden = g.count === 0;
    setText(g.countEl, `(${g.count})`);
  }
  setText(els.clickVal, t('+{n} Erz pro Klick', { n: fmt(r.click) }));
  const flowTxt = {};
  for (const f of r.flows || []) {
    const rc = RECIPE_MAP[f.id], part = o => Object.entries(o).map(([k, v]) => `${fmt(v)} ${tName('resources', RES[k])}/s`).join(' + ');
    const txt = `${tName('recipes', rc)}: ${part(f.inputs)} → ${part(f.outputs)}`;
    let tg = Object.keys(f.outputs).filter(resVisible);
    if (!tg.length) tg = Object.keys(f.inputs).slice(0, 1);
    for (const k of tg) flowTxt[k + '|' + f.id] = txt;
  }
  for (const k of RES_IDS) {
    const m = meters[k];
    for (const key in flowTxt) if (key.startsWith(k + '|') && !m.lines[key]) m.flows.append(m.lines[key] = h('div', { class: 'meter-flow' }));
    for (const key in m.lines) {
      const on = key in flowTxt;
      if (m.lines[key].hidden === on) m.lines[key].hidden = !on;
      if (on) setText(m.lines[key], flowTxt[key]);
    }
  }
  for (const b of els.buyAmount.querySelectorAll('button[data-amount]')) {
    const on = b.dataset.amount === state.settings.buyAmount;
    setAttr(b, 'aria-checked', on);
    setAttr(b, 'tabindex', on ? 0 : -1);
  }
  els.prestigeDot.hidden = !canPrestige();
  setText(els.castCount, fmtInt(state.prestige.count));
  setText(els.castPoints, fmtInt(state.prestige.total));
  const bonus = (prestigeMult() - 1) * 100;
  setText(els.castBonus, t('(+{bonus} % Produktion)', { bonus: bonus >= 100 ? fmtInt(bonus) : decimal(bonus.toFixed(1)) }));
  renderEra();
  renderCorpTab();
  renderGoals(r);
  renderBadges();
  renderBuffs();
}

/** Zeitalter-Anzeige in der Seitenleiste: Name, Gesamtbonus, Fortschritt zum nächsten Zeitalter (log. Skala). */
function renderEra() {
  const unlocked = industryUnlocked();
  setTabHidden('industry', !unlocked);
  if (els.eraBox.hidden !== !unlocked) els.eraBox.hidden = !unlocked;
  if (!unlocked) return;
  const e = eraDef(eraIndex()), nx = nextEra();
  els.eraIco.replaceChildren(symSvg(e.ico));
  setText(els.eraName, tName('eras', e));
  setText(els.eraBonus, t('(Bonus ×{mult})', { mult: decimal(eraMult().toFixed(2)) }));
  const f = eraProgress().toFixed(3);
  if (els.eraFill._f !== f) { els.eraFill._f = f; els.eraFill.style.transform = `scaleX(${f})`; }
  let txt = t('Höchstes Zeitalter erreicht');
  if (nx) txt = t('Nächstes: {name} – ab {ore} Erz', { name: tName('eras', nx), ore: fmt(nx.at) });
  setText(els.eraNext, txt);
}

/** Zielleisten (1x/s selbst gedrosselt) und Tooltip der Neuguss-Übersicht mit der Vorschau. */
let castTipAt = 0;
function renderGoals(r) {
  els.goalWorks.update(r);
  if (!els.goalSide.el.hidden) els.goalSide.update(r);
  const now = Date.now();
  if (now - castTipAt < 1000) return;
  castTipAt = now;
  const p = els.castPreview.update(), v = els.castPreview.summary;
  const tip = t('Neuguss-Chronik im Hochofen öffnen') + (p.gain >= 1 ? ' · ' + t('Neuguss jetzt: +{gain} Gussformen', { gain: fmtInt(p.gain) }) + (v ? ' · ' + v : '') : '') + (state.autoCast?.on ? ' · ' + t('Auto aktiv') : '');
  setAttr($('#cast-summary'), 'title', tip);
}
