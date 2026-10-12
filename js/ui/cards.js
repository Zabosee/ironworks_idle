// Karten (Generatoren, Klick-Upgrades, Boosts, Forschung): Aufbau, Inhalt und Zustand. Auch von prestige.js (Shop-Karten) genutzt.
import { state } from '../core/state.js';
import { fmt, fmtInt, fmtClock } from '../core/format.js';
import { t, tName, tDefName, tDefDesc } from '../core/i18n.js';
import { bulkPlan, duration, levelOf, lockReason, genOutputAt, clickBaseAt, milestone, pendingOf, isRevealed, queueSlots } from '../core/formulas.js';
import { RES, RES_IDS } from '../data/resources.js';
import { GENS, ELITE_FROM, EXTRA_MILESTONES, MILESTONE_STEP } from '../data/generators.js';
import { CLICKS, BOOSTS } from '../data/upgrades.js';
import { queueState } from '../systems/timers.js';
import { imgFor, UI_SPRITE, symSvg, svgUse } from './assets.js';
import { buildFlask, ensureClipDefs } from './lab.js';
import { h, $, clear, setText, setClass, setAttr } from './dom.js';
import { initResearchMap, updateNodeStates } from './research-map.js';
import { corpTabVisible, corpPill } from './corp-common.js';

export const cards = [];          // { kind, id, el, t, b, d, n, c }

export function makeCard(kind, id, extra = {}) {
  const c = {
    kind, id,
    t: h('span', { class: 't' }), b: h('span', { class: 'b' }),
    d: h('span', { class: 'd' }), n: h('span', { class: 'n', hidden: true }), c: h('span', { class: 'c' }),
  };
  c.nIco = svgUse('lock', 'note-ico'); c.nTxt = h('span');
  c.n.append(c.nIco, c.nTxt);
  const ico = extra.img ? h('img', { class: 'card-ico', src: extra.img, alt: '', draggable: 'false' }) : extra.sym ? h('span', { class: 'card-ico card-sym', 'aria-hidden': 'true' }, symSvg(extra.sym, '', extra.cat)) : extra.emoji ? h('span', { class: 'card-ico card-emoji', 'aria-hidden': 'true', text: extra.emoji }) : null;
  delete extra.img; delete extra.emoji; delete extra.sym; delete extra.cat;
  if (kind === 'gen') { c.msFill = h('i'); c.ms = h('span', { class: 'ms-bar', 'aria-hidden': 'true' }, c.msFill); }
  // Boosts/Klick-Upgrades: Ring um das Icon zeigt den Fortschritt des Auftrags (Variable --p)
  if (kind === 'boost' || kind === 'click') c.ring = h('span', { class: 'timer-ring', 'aria-hidden': 'true' }, ico);
  c.el = h('button', { class: 'card', type: 'button', dataset: { kind, id }, ...extra },
    h('span', { class: 'card-head' }, c.ring || ico, c.t, c.b), c.d, c.n, c.ms, c.c);
  c.root = c.el;
  return c;
}

/** Forschungskarte als Laborgefäß: Kolben links, Text/Knopf rechts, darunter Fortschritt (role=progressbar außerhalb des Buttons). */
function wrapResearch(c) {
  const def = c.def;
  c.flask = buildFlask(def);
  const mk = n => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); svg.setAttribute('class', 'ico flask-mark ' + n); svg.setAttribute('aria-hidden', 'true'); u.setAttribute('href', UI_SPRITE + '#' + n); svg.append(u); return svg; };
  c.markLock = mk('lock'); c.markDone = mk('check');
  c.progText = h('span', { class: 'prog-text' });
  c.progFill = h('i');
  c.prog = h('div', { class: 'card-prog', role: 'progressbar', 'aria-label': t('Forschung {name}', { name: tName('research', def) }), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
    c.progText, h('span', { class: 'prog-bar', 'aria-hidden': 'true' }, c.progFill));
  c.root = h('div', { class: 'flask-card', style: `--liquid:${def.liquid}` },
    h('div', { class: 'flask-wrap', 'aria-hidden': 'true' }, c.flask, c.markLock, c.markDone),
    h('div', { class: 'flask-body' }, c.el, c.prog));
}

export function buildCards() {
  const add = (container, kind, def) => {
    const c = makeCard(kind, def.id, imgFor(def) ? { img: imgFor(def) } : (kind === 'boost' || kind === 'click') ? (def.sym ? { sym: def.sym, cat: kind } : { emoji: def.icon }) : {});
    c.def = def;
    if (def.corp) c.el.querySelector('.card-head').append(corpPill(def.corp));   // Abzeichen "K3" (Konzern-Boosts/-Klick-Upgrades)
    cards.push(c);
    if (kind === 'research') wrapResearch(c);
    container.append(c.root);
  };
  ensureClipDefs($('#lab'));
  const gens = $('#list-gens'), ups = $('#list-upgrades'), boosts = $('#list-boosts'), rs = $('#list-research');
  for (const g of GENS) add(gens, 'gen', g);
  for (const c of CLICKS) add(ups, 'click', c);
  for (const b of BOOSTS) add(boosts, 'boost', b);

  // Research: Neue Map-Struktur
  initResearchMap(rs);
}

// ---------- Karten-Inhalt ----------
function prevMilestone(lvl) {
  let prev = Math.floor(lvl / MILESTONE_STEP) * MILESTONE_STEP;
  if (state.research.precision) for (const t of EXTRA_MILESTONES) if (t <= lvl && t > prev) prev = t;
  return prev;
}

function nextMilestone(lvl) {
  let next = (Math.floor(lvl / MILESTONE_STEP) + 1) * MILESTONE_STEP;
  if (state.research.precision) {
    const extra = EXTRA_MILESTONES.find(t => t > lvl);
    if (extra && extra < next) next = extra;
  }
  return next;
}

function costEntries(plan) {
  const out = [];
  if (plan.count > 1) out.push({ text: '×' + plan.count, ok: true });
  for (const k of RES_IDS) {
    const v = plan.cost[k];
    if (v > 0) out.push({ text: fmt(v), img: imgFor(RES[k]), name: tName('resources', RES[k]), ok: state.res[k] >= v });
  }
  return out;
}

export function setCost(el, entries) {
  const key = entries.map(e => e.img + e.sym + e.text + (e.ok ? '+' : '-')).join('|');
  if (el._k === key) return;
  el._k = key;
  clear(el);
  for (const e of entries) el.append(h('span', { class: e.ok ? 'ok' : 'bad', title: e.name }, e.img ? h('img', { class: 'cost-ico', src: e.img, alt: e.name ? e.name + ': ' : '', draggable: 'false' }) : e.sym ? symSvg(e.sym, 'cost-sym', 'prestige') : null, e.text));
}

/** Notizzeile: Text und optionales ui.svg-Symbol (lock, star, hourglass, clock). */
export function setNote(c, text, icon = '') {
  setText(c.nTxt, text);
  const hide = !text;
  if (c.n.hidden !== hide) c.n.hidden = hide;
  const showIcon = !!icon && !hide;
  if (c.nIco.style.display !== (showIcon ? '' : 'none')) c.nIco.style.display = showIcon ? '' : 'none';
  if (showIcon && c.nIco._i !== icon) { c.nIco._i = icon; c.nIco.firstChild.setAttribute('href', UI_SPRITE + '#' + icon); }
}

function describe(c) {
  const { kind, def } = c;
  const lvl = levelOf(kind, def.id);
  const lock = lockReason(kind, def.id);
  const plan = bulkPlan(kind, def.id, kind === 'gen' ? state.settings.buyAmount : 1);
  const k = Math.max(plan.count, 1);
  const o = { title: tDefName(kind, def), badge: '', desc: '', note: '', plan, status: 'ok' };

  if (kind === 'gen') {
    const out = genOutputAt(def, lvl);
    o.badge = t('Stufe {n}', { n: fmtInt(lvl) }) + (lvl >= ELITE_FROM ? ' · ' + t('Elite') : '');
    o.desc = `${fmt(out)} ${tName('resources', RES[def.res])}/s · +${fmt(genOutputAt(def, lvl + k) - out)}/s`;
    o.note = lock || t('×2 bei Stufe {next} (jetzt ×{now})', { next: nextMilestone(lvl), now: fmt(milestone(lvl)) }) + (lvl >= ELITE_FROM - 1 ? ' · ' + t('Elite: kostet Titan') : '');
    o.icon = lock ? 'lock' : lvl >= ELITE_FROM - 1 ? 'star' : '';
  } else if (kind === 'click') {
    o.badge = t('Stufe {n}', { n: fmtInt(lvl) });
    o.desc = t('Klickbeitrag: {from} → {to} Erz nach Kauf', { from: fmt(clickBaseAt(lvl, undefined, def)), to: fmt(clickBaseAt(lvl + k, undefined, def)) });
    o.tip = t('Klickbeitrag = (Basis + Stufe × Zuwachs) × Meilensteinfaktor (jetzt ×{ms}) × Boni (Forschung, Shop, Gesamtbonus). Der Wert enthält bereits alle Boni.', { ms: fmt(milestone(lvl)) });
    o.note = def.costs ? '' : lvl >= def.eliteFrom - 1 ? t('Elite: kostet Titan') : lvl >= def.steelFrom - 1 ? t('Ab Stufe {n} kostet es Stahl', { n: def.steelFrom }) : '';
  } else {
    const done = lvl > 0;
    o.badge = done ? (kind === 'research' ? t('Erforscht') : t('Aktiv')) : '';
    o.desc = tDefDesc(kind, def);
    o.note = !done && lock ? lock : '';
    o.icon = o.note ? 'lock' : '';
    if (done) o.status = 'done';
  }
  const p = kind === 'gen' ? null : pendingOf(kind, def.id);
  o.prog = { value: o.status === 'done' ? 1 : 0, running: false, text: o.status === 'done' ? (kind === 'research' ? t('Erforscht') : t('Aktiv')) : t('Dauer {time}', { time: fmtClock(kind === 'gen' ? 0 : duration(kind, def.id)) }) };
  if (p) {
    const q = queueState(p.queue)[p.index];
    o.prog = q.running
      ? { value: q.progress, running: true, text: t('Restzeit {time} · {pct} %', { time: fmtClock(q.left), pct: Math.round(q.progress * 100) }) }
      : { value: 0, running: false, text: t('Wartet · Dauer {time}', { time: fmtClock(q.total) }) };
  }
  if (p) {
    // Auftrag läuft oder wartet: Restzeit als Text auf der Karte, kein Doppelkauf
    const e = queueState(p.queue)[p.index];
    o.status = 'pending';
    o.icon = 'hourglass';
    o.note = kind === 'research' ? '' : e.running ? t('Läuft: noch {time} ({pct} %)', { time: fmtClock(e.left), pct: Math.round(e.progress * 100) }) : t('Wartet (Platz {n}) · {time}', { n: p.index - queueSlots(p.queue) + 1, time: fmtClock(e.total) });
  } else if (kind !== 'gen' && kind !== 'research' && o.status === 'ok' && !lock) {
    o.icon = o.note ? o.icon : 'clock';
    o.note = (o.note ? o.note + ' · ' : '') + t('Dauer {time}', { time: fmtClock(duration(kind, def.id)) });
  }
  if (lock && o.status === 'ok') o.status = 'locked';
  o.hidden = !isRevealed(kind, def.id) || (!!def.corp && !corpTabVisible());
  return o;
}

/** Fortschritt von Kolben (Forschung) bzw. Ring (Boost/Klick): nur --p und Text, keine DOM-Umbauten. */
function renderProgress(c, o) {
  const v = o.prog.value, pv = v.toFixed(2);
  const target = c.flask ? c.root : c.ring;
  if (target._p !== pv) { target._p = pv; target.style.setProperty('--p', pv); }
  setClass(c.root, 'running', o.prog.running);
  setClass(c.root, 'waiting', o.status === 'pending' && !o.prog.running);
  setClass(c.root, 'empty', v === 0);
  setClass(c.root, 'is-done', o.status === 'done');
  setClass(c.root, 'is-locked', o.status === 'locked');
  if (c.ring) { setClass(c.ring, 'on', o.status === 'pending'); return; }
  setText(c.progText, o.prog.text);
  const pct = Math.round(v * 100);
  setAttr(c.prog, 'aria-valuenow', pct);
  setAttr(c.prog, 'aria-valuetext', o.prog.text);
  if (c.progFill._f !== pv) { c.progFill._f = pv; c.progFill.style.transform = `scaleX(${pv})`; }
}

export function renderCards(kinds) {
  // Research nutzt neue Map-Struktur
  if (kinds.includes('research')) {
    updateNodeStates();
    return;
  }

  for (const c of cards) {
    if (!kinds.includes(c.kind)) continue;
    const o = describe(c);
    const can = o.status === 'ok' && o.plan.count > 0 && o.plan.affordable;
    if (c.root.hidden !== o.hidden) c.root.hidden = o.hidden;
    setText(c.t, o.title); setText(c.b, o.badge); setText(c.d, o.desc); setAttr(c.d, 'title', o.tip || ''); setNote(c, o.note, o.icon);
    setCost(c.c, o.status === 'done' || o.status === 'pending' ? [] : costEntries(o.plan));
    if (c.msFill) {
      const lv = levelOf(c.kind, c.def.id), a = prevMilestone(lv), b = nextMilestone(lv);
      const f = ((lv - a) / Math.max(b - a, 1)).toFixed(3);
      if (c.msFill._f !== f) { c.msFill._f = f; c.msFill.style.transform = `scaleX(${f})`; }
    }
    setAttr(c.el, 'aria-disabled', !can);
    setClass(c.el, 'can', can);
    setClass(c.el, 'done', o.status === 'done');
    setClass(c.el, 'pending', o.status === 'pending');
    setClass(c.el, 'locked', o.status === 'locked');
    if (c.flask || c.ring) renderProgress(c, o);
    if (c.flask) setClass(c.root, 'can', can);
  }
}
