// Rendering aller Panels. Baut das DOM einmal auf (ohne innerHTML) und aktualisiert danach nur Textknoten/Klassen.
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { fmt, fmtInt, fmtTime, fmtClock } from '../core/format.js';
import {
  rates, bulkPlan, duration, levelOf, lockReason, genOutputAt, clickBaseAt, milestone, researchMult, achievementBonus,
  prestigeMult, globalMult, buffMult, prestigeGain, oreForGain, shopLevel, shopCost, autobuyerUnlocked, researchDepth,
  pendingOf, isRevealed, resVisible, queueSlots, queueCapacity,
} from '../core/formulas.js';
import { RES, RES_IDS } from '../data/resources.js';
import { GENS, ELITE_FROM, EXTRA_MILESTONES, MILESTONE_STEP } from '../data/generators.js';
import { CLICKS, BOOSTS } from '../data/upgrades.js';
import { RECIPE_MAP } from '../data/recipes.js';
import { RESEARCH } from '../data/research.js';
import { PRESTIGE, SHOP, MILESTONES, AUTOBUYERS } from '../data/prestige.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUFFS } from '../data/golden.js';
import { buy } from '../systems/production.js';
import { doPrestige, buyShop, canPrestige } from '../systems/prestige.js';
import { setEnabled } from '../systems/autobuyers.js';
import { queueState, cancel } from '../systems/timers.js';
import { QUEUES, QUEUE_IDS, REFUND } from '../data/timers.js';
import { imgFor, UI_SPRITE } from './assets.js';
import { buildFlask, ensureClipDefs } from './lab.js';
import { h, $, clear, setText, setClass, setAttr, confirmDialog } from './dom.js';
import { activeTab } from './tabs.js';
import { restartAnim, updateOrbs } from './effects.js';
import { sample, spark, drawSparkline, drawHistory } from './charts.js';

/** Kleines ui.svg-Symbol (currentColor). */
function svgUse(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('class', ('ico ' + cls).trim()); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  u.setAttribute('href', UI_SPRITE + '#' + name); svg.append(u);
  return svg;
}

const cards = [];          // { kind, id, el, t, b, d, n, c }
const meters = {};         // pro Ressource: { amt, rps, delta, canvas }
const shopCards = {};
const achItems = {};
let lastRates = null;
let els = {};

// ---------- Aufbau ----------
export function initRender() {
  els = {
    meters: $('#meters'), clickVal: $('#clickVal'), conv: $('#conv'), buffs: $('#buffs'), saved: $('#saved'),
    buyAmount: $('#buyamount'), prestigeDot: $('#prestige-dot'),
  };
  buildMeters();
  buildCards();
  buildAutobuyers();
  buildQueues();
  buildPrestige();
  buildAchievements();
  buildStats();
  bindActions();

  on('buy', e => {
    if (e.silent) return;
    const card = cards.find(c => c.kind === e.kind && c.id === e.id);
    if (card) restartAnim(card.el);
    if (lastRates) showDelta(lastRates, rates());
    refresh();
  });
  on('shop', refresh);
  for (const ev of ['timer:queued', 'timer:cancel']) on(ev, refresh);
  on('timer:done', e => {
    // Fertig: kurzes Aufblitzen der Karte (der Toast kommt aus dem Timer-System)
    const card = cards.find(c => c.kind === e.kind && c.id === e.id);
    refresh();
    if (card) restartAnim(card.root, 'done-flash');
  });
  on('prestige', refresh);
  on('loaded', refresh);
  on('tab', refresh);
  on('buffs', () => renderBuffs(true));
  on('saved', t => setText(els.saved, 'Gespeichert ' + new Date(t).toLocaleTimeString('de-DE')));
  on('save-failed', () => setText(els.saved, 'Speichern nicht möglich'));
}

function buildMeters() {
  for (const k of RES_IDS) {
    const r = RES[k];
    const m = {
      amt: h('span', { class: 'amt' }), rps: h('span', { class: 'rps' }),
      delta: h('span', { class: 'delta' }), canvas: h('canvas', { class: 'spark', 'aria-hidden': 'true' }),
    };
    meters[k] = m;
    m.el = h('div', { class: 'meter', style: `--c:${r.color}` },
      h('div', { class: 'orb', id: 'orb-' + k, 'aria-hidden': 'true' },
        h('span', { class: 'ring' }), h('span', { class: 'orb-core' }, imgFor(r) ? h('img', { src: imgFor(r), alt: '', draggable: 'false' }) : r.icon)),
      h('div', { class: 'meter-body' },
        h('div', { class: 'meter-row' }, h('span', { class: 'meter-name', text: r.name }), m.amt),
        h('div', { class: 'meter-row small' }, h('span', {}, m.rps, '/s'), m.delta),
        m.canvas));
    els.meters.append(m.el);
  }
}

function makeCard(kind, id, extra = {}) {
  const c = {
    kind, id,
    t: h('span', { class: 't' }), b: h('span', { class: 'b' }),
    d: h('span', { class: 'd' }), n: h('span', { class: 'n' }), c: h('span', { class: 'c' }),
  };
  const ico = extra.img ? h('img', { class: 'card-ico', src: extra.img, alt: '', draggable: 'false' }) : extra.emoji ? h('span', { class: 'card-ico card-emoji', 'aria-hidden': 'true', text: extra.emoji }) : null;
  delete extra.img; delete extra.emoji;
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
  c.prog = h('div', { class: 'card-prog', role: 'progressbar', 'aria-label': 'Forschung ' + def.name, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
    c.progText, h('span', { class: 'prog-bar', 'aria-hidden': 'true' }, c.progFill));
  c.root = h('div', { class: 'flask-card', style: `--liquid:${def.liquid}` },
    h('div', { class: 'flask-wrap', 'aria-hidden': 'true' }, c.flask, c.markLock, c.markDone),
    h('div', { class: 'flask-body' }, c.el, c.prog));
}

function buildCards() {
  const add = (container, kind, def) => {
    const c = makeCard(kind, def.id, imgFor(def) ? { img: imgFor(def) } : (kind === 'boost' || kind === 'click') ? { emoji: def.icon } : {});
    c.def = def;
    cards.push(c);
    if (kind === 'research') wrapResearch(c);
    container.append(c.root);
  };
  ensureClipDefs($('#lab'));
  const gens = $('#list-gens'), ups = $('#list-upgrades'), boosts = $('#list-boosts'), rs = $('#list-research');
  for (const g of GENS) add(gens, 'gen', g);
  for (const c of CLICKS) add(ups, 'click', c);
  for (const b of BOOSTS) add(boosts, 'boost', b);

  const depths = new Map();
  for (const r of RESEARCH) {
    const d = researchDepth(r.id);
    if (!depths.has(d)) depths.set(d, []);
    depths.get(d).push(r);
  }
  for (const d of [...depths.keys()].sort((a, b) => a - b)) {
    const grid = h('div', { class: 'grid' });
    rs.append(h('section', { class: 'tier lab-shelf' }, h('h3', { text: `Ebene ${d + 1}` }), grid));
    for (const r of depths.get(d)) add(grid, 'research', r);
  }
}

function bindActions() {
  const onCard = e => {
    const el = e.target.closest('.card[data-kind]');
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    // Kaufmenge gilt nur für Generatoren; alle anderen Karten kaufen genau 1 Stufe. Das 'buy'-Event löst den Refresh aus.
    const kind = el.dataset.kind;
    buy(kind, el.dataset.id, kind === 'gen' ? state.settings.buyAmount : 1);
  };
  for (const id of ['#list-gens', '#list-upgrades', '#list-boosts', '#list-research']) $(id).addEventListener('click', onCard);

  // Radiogroup: Klick und Pfeiltasten wählen die Kaufmenge (roving tabindex)
  const radios = [...els.buyAmount.querySelectorAll('button[data-amount]')];
  const pick = (b, focus) => { state.settings.buyAmount = b.dataset.amount; if (focus) b.focus(); refresh(); };
  els.buyAmount.addEventListener('click', e => {
    const b = e.target.closest('button[data-amount]');
    if (b) pick(b);
  });
  els.buyAmount.addEventListener('keydown', e => {
    const i = radios.findIndex(b => b === document.activeElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % radios.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + radios.length) % radios.length;
    if (n >= 0) { e.preventDefault(); pick(radios[n], true); }
  });
}

// ---------- Warteschlangen (.queue-bar mit .slot-chip) ----------
const qv = {};   // queue -> { root, title, list, key, chips: [{ chip, time, entry }] }
function buildQueues() {
  for (const q of QUEUE_IDS) {
    const root = document.getElementById('queue-' + q);
    if (!root) continue;
    root.hidden = false;
    qv[q] = { root, title: h('h3', { class: 'queue-title' }), list: h('ul', { class: 'queue-list' }), key: '', chips: [] };
    root.append(qv[q].title, qv[q].list);
    qv[q].list.addEventListener('click', e => {
      const b = e.target.closest('button[data-index]');
      if (!b) return;
      cancel(q, Number(b.dataset.index));
      refresh();
    });
  }
}

/** Text der Erstattung, z. B. "50 % zurück: 150 🪨 · 20 🔩". */
function refundText(q, index, running) {
  const e = state.timers[q][index];
  const f = running ? REFUND.running : REFUND.waiting;
  const parts = e ? RES_IDS.filter(k => e.cost[k] > 0).map(k => `${fmt(e.cost[k] * f)} ${RES[k].icon}`) : [];
  return `${Math.round(f * 100)} % zurück${parts.length ? ': ' + parts.join(' · ') : ''}`;
}

function renderQueues(only) {
  for (const q of QUEUE_IDS) {
    const v = qv[q];
    if (!v || (only && !only.includes(q))) continue;
    const st = queueState(q), slots = queueSlots(q), cap = queueCapacity(q);
    const running = st.filter(e => e.running).length;
    setText(v.title, `${QUEUES[q].name}: ${running}/${slots} aktiv · ${st.length - running}/${cap - slots} wartend`);
    const key = slots + '|' + st.map(e => e.kind + ':' + e.id + (e.running ? '*' : '')).join('|');
    if (key !== v.key) {
      v.key = key;
      clear(v.list);
      v.chips = [];
      st.forEach(e => {
        const time = h('span', { class: 'chip-time', role: 'timer' }), fill = h('i');
        const short = e.running ? '50 %' : '100 %';
        const btn = h('button', { class: 'btn chip-cancel', type: 'button', dataset: { index: e.index }, title: refundText(q, e.index, e.running),
          'aria-label': `${e.name} abbrechen (${refundText(q, e.index, e.running)})` }, svgUse('cancel'), h('span', { text: `Abbrechen (${short} zurück)` }));
        const chip = h('li', { class: 'slot-chip ' + (e.running ? 'running' : 'waiting') },
          h('span', { class: 'chip-name', text: e.name }), time, h('span', { class: 'chip-bar', 'aria-hidden': 'true' }, fill), btn);
        v.list.append(chip);
        v.chips.push({ chip, time });
      });
      for (let i = running; i < slots; i++) v.list.append(h('li', { class: 'slot-chip free' }, h('span', { class: 'chip-name', text: 'Slot frei' })));
    }
    st.forEach((e, i) => {
      const c = v.chips[i];
      if (!c) return;
      setText(c.time, e.running ? fmtClock(e.left) : `wartet · ${fmtClock(e.total)}`);
      const pv = e.running ? e.progress.toFixed(2) : '0';
      if (c.chip._p !== pv) { c.chip._p = pv; c.chip.style.setProperty('--p', pv); }
    });
  }
}

/** Tab-Abzeichen: laufende Aufträge als Restzeit des nächsten Abschlusses, zusätzlich Wartende. */
const badgeEls = {};
function renderBadges() {
  for (const [q, tab] of [['lab', 'research'], ['workshop', 'upgrades']]) {
    const el = badgeEls[tab] ??= document.getElementById('badge-' + tab);
    if (!el) continue;
    const st = queueState(q), run = st.filter(e => e.running);
    el.hidden = st.length === 0;
    if (!st.length) continue;
    const left = run.length ? Math.min(...run.map(e => e.left)) : 0;
    const wait = st.length - run.length;
    setText(el, `${run.length}/${queueSlots(q)} · ${fmtClock(left)}${wait ? ' +' + wait : ''}`);
    setAttr(el, 'title', `${QUEUES[q].name}: ${run.length} läuft, ${wait} wartet`);
  }
}

// ---------- Auto-Buyer ----------
const abToggles = {};
function buildAutobuyers() {
  const root = $('#list-auto');
  for (const a of AUTOBUYERS) {
    const status = h('span', { class: 'b' });
    const btn = h('button', {
      class: 'toggle', type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        if (!autobuyerUnlocked(a.id)) return;
        setEnabled(a.id, !state.autobuyers[a.id]);
        refresh();
      },
    }, h('span', { class: 't', text: '🤖 ' + a.name }), status);
    abToggles[a.id] = { btn, status };
    root.append(btn);
  }
}

function renderAutobuyers() {
  for (const a of AUTOBUYERS) {
    const { btn, status } = abToggles[a.id];
    const unlocked = autobuyerUnlocked(a.id), on = unlocked && state.autobuyers[a.id];
    setAttr(btn, 'aria-pressed', on);
    setAttr(btn, 'aria-disabled', !unlocked);
    setClass(btn, 'locked', !unlocked);
    setClass(btn, 'on', on);
    setText(status, unlocked ? (on ? 'An' : 'Aus') : 'Gesperrt (Hochofen-Shop)');
  }
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
    if (v > 0) out.push({ text: `${RES[k].icon} ${fmt(v)}`, ok: state.res[k] >= v });
  }
  return out;
}

function setCost(el, entries) {
  const key = entries.map(e => e.text + (e.ok ? '+' : '-')).join('|');
  if (el._k === key) return;
  el._k = key;
  clear(el);
  for (const e of entries) el.append(h('span', { class: e.ok ? 'ok' : 'bad', text: e.text }));
}

function describe(c) {
  const { kind, def } = c;
  const lvl = levelOf(kind, def.id);
  const lock = lockReason(kind, def.id);
  const plan = bulkPlan(kind, def.id, kind === 'gen' ? state.settings.buyAmount : 1);
  const k = Math.max(plan.count, 1);
  const o = { title: imgFor(def) || kind !== 'gen' ? def.name : `${def.icon} ${def.name}`, badge: '', desc: '', note: '', plan, status: 'ok' };

  if (kind === 'gen') {
    const out = genOutputAt(def, lvl);
    o.badge = `Stufe ${fmtInt(lvl)}${lvl >= ELITE_FROM ? ' ⭐' : ''}`;
    o.desc = `${fmt(out)} ${RES[def.res].icon}/s · +${fmt(genOutputAt(def, lvl + k) - out)}/s`;
    o.note = lock ? '🔒 ' + lock : `×2 bei Stufe ${nextMilestone(lvl)} (jetzt ×${fmt(milestone(lvl))})${lvl >= ELITE_FROM - 1 ? ' · ⭐ Elite: kostet Titan' : ''}`;
  } else if (kind === 'click') {
    o.badge = `Stufe ${fmtInt(lvl)}`;
    o.desc = `Basis-Klick: ${fmt(clickBaseAt(lvl, undefined, def))} → ${fmt(clickBaseAt(lvl + k, undefined, def))} Erz`;
    o.note = def.costs ? '' : lvl >= def.eliteFrom - 1 ? '⭐ Elite: kostet Titan' : lvl >= def.steelFrom - 1 ? `Ab Stufe ${def.steelFrom} kostet es Stahl` : '';
  } else {
    const done = lvl > 0;
    o.badge = done ? (kind === 'research' ? '✓ Erforscht' : '✓ Aktiv') : '';
    o.desc = def.desc;
    o.note = !done && lock ? '🔒 ' + lock : '';
    if (done) o.status = 'done';
  }
  const p = kind === 'gen' ? null : pendingOf(kind, def.id);
  o.prog = { value: o.status === 'done' ? 1 : 0, running: false, text: o.status === 'done' ? (kind === 'research' ? 'Erforscht' : 'Aktiv') : `Dauer ${fmtClock(kind === 'gen' ? 0 : duration(kind, def.id))}` };
  if (p) {
    const q = queueState(p.queue)[p.index];
    o.prog = q.running
      ? { value: q.progress, running: true, text: `Restzeit ${fmtClock(q.left)} · ${Math.round(q.progress * 100)} %` }
      : { value: 0, running: false, text: `Wartet · Dauer ${fmtClock(q.total)}` };
  }
  if (p) {
    // Auftrag läuft oder wartet: Restzeit als Text auf der Karte, kein Doppelkauf
    const e = queueState(p.queue)[p.index];
    o.status = 'pending';
    o.note = kind === 'research' ? '' : e.running ? `⏳ Läuft: noch ${fmtClock(e.left)} (${Math.round(e.progress * 100)} %)` : `⏳ Wartet (Platz ${p.index - queueSlots(p.queue) + 1}) · ${fmtClock(e.total)}`;
  } else if (kind !== 'gen' && kind !== 'research' && o.status === 'ok' && !lock) {
    o.note = (o.note ? o.note + ' · ' : '') + `⏱ Dauer ${fmtClock(duration(kind, def.id))}`;
  }
  if (lock && o.status === 'ok') o.status = 'locked';
  o.hidden = !isRevealed(kind, def.id);
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

function renderCards(kinds) {
  for (const c of cards) {
    if (!kinds.includes(c.kind)) continue;
    const o = describe(c);
    const can = o.status === 'ok' && o.plan.count > 0 && o.plan.affordable;
    if (c.root.hidden !== o.hidden) c.root.hidden = o.hidden;
    setText(c.t, o.title); setText(c.b, o.badge); setText(c.d, o.desc); setText(c.n, o.note);
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

// ---------- Prestige ----------
const pv = {};
function buildPrestige() {
  const root = $('#prestige-root');
  pv.points = h('strong'); pv.total = h('strong'); pv.mult = h('strong'); pv.gain = h('strong'); pv.hint = h('p', { class: 'hint' });
  pv.fill = h('div', { class: 'bar-fill' });
  pv.bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Fortschritt zum nächsten Punkt', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, pv.fill);
  pv.btn = h('button', {
    class: 'btn btn-primary btn-big', type: 'button',
    onclick: async () => {
      if (!canPrestige()) return;
      const gain = prestigeGain();
      const ok = await confirmDialog({
        title: `${PRESTIGE.name}?`,
        message: `Du setzt Ressourcen, Generatoren, Klick-Upgrades und Boosts${shopLevel('keep') ? '' : ' sowie Forschung'} zurück (laufende Aufträge der Werkbank${shopLevel('keep') ? '' : ' und des Labors'} verfallen ohne Erstattung) und erhältst ${gain} ${PRESTIGE.currency}. Shop-Käufe, Erfolge und Auto-Buyer bleiben erhalten.`,
        confirmLabel: 'Neuguss durchführen',
      });
      if (ok) doPrestige();
    },
  });
  pv.msList = h('ul', { class: 'milestones' });
  pv.ms = MILESTONES.map(m => {
    const li = h('li', {}, h('strong', { text: `${fmtInt(m.at)} ${PRESTIGE.currency}` }), ' – ' + m.desc, h('span', { class: 'ms-state' }));
    pv.msList.append(li);
    return { li, state: li.lastChild, m };
  });
  const shopGrid = h('div', { class: 'grid' });
  for (const it of SHOP) {
    const c = makeCard('shop', it.id);
    c.it = it;
    c.el.removeAttribute('data-kind');
    c.el.dataset.shop = it.id;
    shopCards[it.id] = c;
    shopGrid.append(c.el);
  }
  shopGrid.addEventListener('click', e => {
    const el = e.target.closest('[data-shop]');
    if (el && el.getAttribute('aria-disabled') !== 'true') buyShop(el.dataset.shop);
  });

  root.append(
    h('div', { class: 'panel-box' },
      h('h2', { text: `${PRESTIGE.icon} ${PRESTIGE.name}` }),
      h('p', { text: `Schmelze alles ein und gieße neu: Du erhältst ${PRESTIGE.currency}, die deine Produktion dauerhaft um +${PRESTIGE.perPoint * 100} % je Stück erhöhen. Je mehr Erz du in einem Durchlauf produzierst, desto mehr bekommst du (Wurzel-Skalierung).` }),
      h('dl', { class: 'kv' },
        h('dt', { text: `${PRESTIGE.currency} (verfügbar)` }), h('dd', {}, pv.points),
        h('dt', { text: 'Insgesamt verdient' }), h('dd', {}, pv.total),
        h('dt', { text: 'Produktionsbonus' }), h('dd', {}, pv.mult),
        h('dt', { text: 'Ertrag bei Neuguss jetzt' }), h('dd', {}, pv.gain)),
      pv.bar, pv.hint, pv.btn),
    h('div', { class: 'panel-box' }, h('h2', { text: 'Meilensteine' }), h('p', { class: 'hint', text: 'Basierend auf den insgesamt verdienten Gussformen.' }), pv.msList),
    h('div', { class: 'panel-box wide' }, h('h2', { text: 'Gießerei-Shop' }), shopGrid));
}

function renderPrestige() {
  const p = state.prestige, gain = prestigeGain();
  setText(pv.points, fmtInt(p.points));
  setText(pv.total, fmtInt(p.total));
  setText(pv.mult, '×' + fmt(prestigeMult()));
  setText(pv.gain, '+' + fmtInt(gain));
  const run = state.stats.run.ore, target = oreForGain(gain), prev = gain >= 1 ? oreForGain(gain - 1) : 0;
  const frac = Math.min(1, Math.max(0, (run - prev) / Math.max(target - prev, 1)));
  pv.fill.style.transform = `scaleX(${frac.toFixed(3)})`;
  setAttr(pv.bar, 'aria-valuenow', Math.round(frac * 100));
  setText(pv.hint, gain >= 1
    ? `Nächste Gussform ab ${fmt(target)} Erz in diesem Durchlauf (aktuell ${fmt(run)}).`
    : `Erste Gussform ab ${fmt(target)} Erz in diesem Durchlauf (aktuell ${fmt(run)}).`);
  setText(pv.btn, gain >= 1 ? `${PRESTIGE.icon} Neuguss: +${fmtInt(gain)} ${PRESTIGE.currency}` : `${PRESTIGE.icon} Noch nicht möglich`);
  setAttr(pv.btn, 'aria-disabled', gain < 1);
  for (const { li, state: st, m } of pv.ms) {
    const done = p.total >= m.at;
    setClass(li, 'done', done);
    setText(st, done ? ' ✓' : ' (gesperrt)');
  }
  for (const it of SHOP) {
    const c = shopCards[it.id], lvl = shopLevel(it.id), maxed = lvl >= it.max, cost = shopCost(it.id);
    const can = !maxed && p.points >= cost;
    setText(c.t, `${it.icon} ${it.name}`);
    setText(c.b, it.max > 1 ? `Stufe ${lvl}/${it.max}` : (maxed ? '✓ Gekauft' : ''));
    setText(c.d, it.desc);
    setText(c.n, '');
    setCost(c.c, maxed ? [] : [{ text: `${PRESTIGE.icon} ${fmtInt(cost)}`, ok: p.points >= cost }]);
    setAttr(c.el, 'aria-disabled', !can);
    setClass(c.el, 'can', can);
    setClass(c.el, 'done', maxed);
  }
}

// ---------- Achievements ----------
const av = {};
function buildAchievements() {
  const root = $('#ach-root');
  av.summary = h('p', { class: 'summary' });
  const list = h('ul', { class: 'ach-list' });
  for (const a of ACHIEVEMENTS) {
    const st = h('span', { class: 'ach-state' });
    const li = h('li', { class: 'ach' },
      h('span', { class: 'ach-icon', 'aria-hidden': 'true', text: a.icon }),
      h('span', { class: 'ach-text' }, h('strong', { text: a.name }), h('span', { text: a.desc })),
      h('span', { class: 'ach-bonus', text: `+${(a.bonus * 100).toFixed(1).replace('.0', '')} %` }), st);
    achItems[a.id] = { li, st };
    list.append(li);
  }
  root.append(av.summary, list);
}

function renderAchievements() {
  const n = ACHIEVEMENTS.filter(a => state.achievements[a.id]).length;
  setText(av.summary, `${n} von ${ACHIEVEMENTS.length} freigeschaltet · Produktionsbonus +${(achievementBonus() * 100).toFixed(1).replace('.0', '')} %`);
  for (const a of ACHIEVEMENTS) {
    const done = !!state.achievements[a.id], it = achItems[a.id];
    setClass(it.li, 'done', done);
    setText(it.st, done ? 'Erreicht' : 'Gesperrt');
  }
}

// ---------- Statistik ----------
const sv = { rows: [] };
function buildStats() {
  const root = $('#stats-root');
  const defs = [
    ['Spielzeit gesamt', () => fmtTime(state.stats.playTime)],
    ['Dauer dieses Durchlaufs', () => fmtTime(state.stats.runTime)],
    ['Spielstart', () => new Date(state.stats.startedAt).toLocaleDateString('de-DE')],
    ['Klicks gesamt', () => fmtInt(state.stats.clicks)],
    ['Klicks in diesem Durchlauf', () => fmtInt(state.stats.runClicks)],
    ...RES_IDS.map(k => [`${RES[k].name} produziert (gesamt)`, () => fmt(state.stats.total[k])]),
    ['Erz produziert (Durchlauf)', () => fmt(state.stats.run.ore)],
    ['Höchste Erzproduktion', () => fmt(state.stats.bestOreRate) + '/s'],
    ['Gekaufte Stufen/Upgrades', () => fmtInt(state.stats.buys)],
    ['Goldene Barren gefangen', () => fmtInt(state.stats.golden)],
    ['Neuguss durchgeführt', () => fmtInt(state.prestige.count)],
    ['Bester Neuguss', () => fmtInt(state.stats.bestPrestige) + ' ' + PRESTIGE.currency],
    ['Erfolge', () => `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length}`],
  ];
  const dl = h('dl', { class: 'kv' });
  for (const [label, fn] of defs) {
    const dd = h('dd');
    dl.append(h('dt', { text: label }), dd);
    sv.rows.push({ dd, fn });
  }

  const stack = [
    ...RES_IDS.map(k => [`Forschung & Boosts (${RES[k].name})`, () => researchMult(k)]),
    [`${PRESTIGE.currency} & Meilensteine`, () => prestigeMult()],
    ['Erfolge', () => 1 + achievementBonus()],
    ['Aktive Effekte', () => buffMult('prod')],
    ['Global (ohne Forschung)', () => globalMult()],
  ];
  const stackDl = h('dl', { class: 'kv' });
  for (const [label, fn] of stack) {
    const dd = h('dd');
    stackDl.append(h('dt', { text: label }), dd);
    sv.rows.push({ dd, fn: () => '×' + fmt(fn()) });
  }

  sv.canvas = h('canvas', { class: 'chart', role: 'img', 'aria-label': 'Verlauf der Produktion pro Sekunde in den letzten 15 Minuten, logarithmisch' });
  const legend = h('ul', { class: 'legend' }, RES_IDS.map(k => h('li', { style: `--c:${RES[k].color}`, text: RES[k].name })));
  root.append(
    h('div', { class: 'panel-box' }, h('h2', { text: 'Statistik' }), dl),
    h('div', { class: 'panel-box' }, h('h2', { text: 'Multiplikator-Stapel' }), stackDl),
    h('div', { class: 'panel-box wide' }, h('h2', { text: 'Produktionsverlauf (log. Skala)' }), sv.canvas, legend));
}

function renderStats() {
  for (const { dd, fn } of sv.rows) setText(dd, fn());
}

// ---------- Oben / global ----------
function showDelta(before, after) {
  for (const k of RES_IDS) {
    if (!(after[k] > before[k] * 1.001)) continue;
    const el = meters[k].delta;
    el.textContent = before[k] > 0 ? `▲ +${fmt((after[k] / before[k] - 1) * 100)} %` : '▲ NEU';
    el.classList.add('show');
    clearTimeout(el._h);
    el._h = setTimeout(() => el.classList.remove('show'), 2000);
  }
}

let buffKey = '';
const buffTimes = {};
function renderBuffs(force = false) {
  const key = state.buffs.map(b => b.id).join(',');
  if (force || key !== buffKey) {
    buffKey = key;
    clear(els.buffs);
    for (const b of state.buffs) {
      const def = BUFFS[b.id];
      if (!def) continue;
      const time = h('span', { class: 'buff-time' });
      buffTimes[b.id] = time;
      els.buffs.append(h('li', { class: 'buff' }, h('span', { 'aria-hidden': 'true', text: def.icon }), h('span', { class: 'buff-name', text: `${def.name} (${def.desc})` }), time));
    }
  }
  for (const b of state.buffs) if (buffTimes[b.id]) setText(buffTimes[b.id], Math.ceil(b.left) + ' s');
}

function renderTop(r) {
  for (const k of RES_IDS) {
    const vis = resVisible(k);
    if (meters[k].el.hidden === vis) meters[k].el.hidden = !vis;
    setText(meters[k].amt, fmt(state.res[k]));
    setText(meters[k].rps, fmt(r[k]));
  }
  setText(els.clickVal, `+${fmt(r.click)} Erz pro Klick`);
  setText(els.conv, (r.flows || []).map(f => {
    const rc = RECIPE_MAP[f.id], part = o => Object.entries(o).map(([k, v]) => `${fmt(v)} ${RES[k].icon}/s`).join(' + ');
    return `${rc.icon} ${rc.name}: ${part(f.inputs)} → ${part(f.outputs)}`;
  }).join('\n'));
  for (const b of els.buyAmount.querySelectorAll('button[data-amount]')) {
    const on = b.dataset.amount === state.settings.buyAmount;
    setAttr(b, 'aria-checked', on);
    setAttr(b, 'tabindex', on ? 0 : -1);
  }
  els.prestigeDot.hidden = !canPrestige();
  renderBadges();
  renderBuffs();
}

function renderActive() {
  switch (activeTab()) {
    case 'gens': renderCards(['gen']); break;
    case 'upgrades': renderCards(['click', 'boost']); renderQueues(['workshop']); renderAutobuyers(); break;
    case 'research': renderCards(['research']); renderQueues(['lab']); break;
    case 'prestige': renderPrestige(); break;
    case 'achievements': renderAchievements(); break;
    case 'stats': renderStats(); drawHistory(sv.canvas); break;
    default: break;
  }
}

/** Sofortiges Neuzeichnen nach Benutzeraktionen. */
export function refresh() {
  lastRates = rates();
  renderTop(lastRates);
  renderActive();
}

let acc = 0, sparkAcc = 0;
/** Wird jeden Frame aufgerufen; zeichnet mit ca. 10 Hz. */
export function frame(r, dt) {
  acc += dt; sparkAcc += dt;
  if (acc < 0.1) return;
  const step = acc;
  acc = 0;
  lastRates = r;
  renderTop(r);
  renderActive();
  updateOrbs(r, step);
  if (sparkAcc >= 1) {
    sparkAcc = 0;
    sample(r);
    for (const k of RES_IDS) drawSparkline(meters[k].canvas, spark[k], RES[k].color);
    if (activeTab() === 'stats') drawHistory(sv.canvas);
  }
}
