// Neuguss (Prestige, Shop, Chronik), Erfolge und Statistik.
import { state } from '../core/state.js';
import { fmt, fmtInt, fmtTime, decimal } from '../core/format.js';
import { t, tName, tDesc, locale } from '../core/i18n.js';
import { corpLevel, researchMult, achievementBonus, prestigeMult, globalMult, buffMult, prestigeGain, oreForGain, shopLevel, shopCost } from '../core/formulas.js';
import { RES, RES_IDS } from '../data/resources.js';
import { PRESTIGE, SHOP, MILESTONES, HISTORY_MAX } from '../data/prestige.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { doPrestige, buyShop, canPrestige } from '../systems/prestige.js';
import { symSvg } from './assets.js';
import { h, $, clear, setText, setClass, setAttr, confirmDialog } from './dom.js';
import { makeCard, setCost, setNote } from './cards.js';
import { buildCastPreview, buildAutocast } from './goals.js';

const shopCards = {};
const achItems = {};

// ---------- Prestige ----------
const pv = {};
export function buildPrestige() {
  const root = $('#prestige-root');
  pv.points = h('strong'); pv.total = h('strong'); pv.mult = h('strong'); pv.gain = h('strong'); pv.hint = h('p', { class: 'hint' });
  pv.fill = h('div', { class: 'bar-fill' });
  pv.bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': t('Fortschritt zum nächsten Punkt'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, pv.fill);
  pv.btnT = h('span');
  pv.btn = h('button', {
    class: 'btn btn-primary btn-big', type: 'button',
    onclick: async () => {
      if (!canPrestige()) return;
      const gain = prestigeGain();
      const ok = await confirmDialog({
        title: t('{name}?', { name: t(PRESTIGE.name) }),
        message: t('Du setzt Ressourcen, Generatoren, Klick-Upgrades und Boosts{research} zurück (laufende Aufträge der Werkbank{lab} verfallen ohne Erstattung) und erhältst {gain} {currency}. Shop-Käufe, Erfolge und Auto-Buyer bleiben erhalten.', { research: shopLevel('keep') ? '' : t(' sowie Forschung'), lab: shopLevel('keep') ? '' : t(' und des Labors'), gain, currency: t(PRESTIGE.currency) }),
        confirmLabel: t('Neuguss durchführen'),
      });
      if (ok) doPrestige();
    },
  }, symSvg(PRESTIGE.sym || 'flame', '', 'prestige'), ' ', pv.btnT);
  pv.preview = buildCastPreview();
  pv.auto = buildAutocast();
  pv.autoBox = h('div', { class: 'panel-box', hidden: true }, pv.auto.el);   // erst nach Kauf von Auto-Neuguss sichtbar
  pv.msList = h('ul', { class: 'milestones' });
  pv.ms = MILESTONES.map(m => {
    const li = h('li', {}, h('strong', { text: `${fmtInt(m.at)} ${t(PRESTIGE.currency)}` }), ' – ' + t(m.desc), h('span', { class: 'ms-state' }));
    pv.msList.append(li);
    return { li, state: li.lastChild, m };
  });
  const shopGrid = h('div', { class: 'grid' });
  for (const it of SHOP) {
    const c = makeCard('shop', it.id, it.sym ? { sym: it.sym, cat: 'shop' } : {});
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

  buildChronicle();
  root.append(
    h('div', { class: 'panel-box' },
      h('h2', {}, PRESTIGE.sym ? symSvg(PRESTIGE.sym, 'h-ico', 'prestige') : PRESTIGE.icon, ' ' + t(PRESTIGE.name)),
      h('p', { text: t('Schmelze alles ein und gieße neu: Du erhältst {currency}, die deine Produktion dauerhaft um +{pct} % je Stück erhöhen. Je mehr Erz du in einem Durchlauf produzierst, desto mehr bekommst du. Jede weitere Gussform benötigt ×{growth} so viel Erz (exponentielle Skalierung).', { currency: t(PRESTIGE.currency), pct: PRESTIGE.perPoint * 100, growth: decimal(PRESTIGE.growth) }) }),
      h('dl', { class: 'kv' },
        h('dt', { text: t('{currency} (verfügbar)', { currency: t(PRESTIGE.currency) }) }), h('dd', {}, pv.points),
        h('dt', { text: t('Insgesamt verdient') }), h('dd', {}, pv.total),
        h('dt', { text: t('Produktionsbonus') }), h('dd', {}, pv.mult),
        h('dt', { text: t('Ertrag bei Neuguss jetzt') }), h('dd', {}, pv.gain)),
      pv.bar, pv.hint, pv.preview.el, pv.btn),
    pv.autoBox,
    h('div', { class: 'panel-box' }, h('h2', { text: t('Meilensteine') }), h('p', { class: 'hint', text: t('Basierend auf den insgesamt verdienten Gussformen.') }), pv.msList),
    cv.box,
    h('div', { class: 'panel-box wide' }, h('h2', { text: t('Gießerei-Shop') }), shopGrid));
}

// ---------- Neuguss-Chronik ----------
const cv = {};
const fmtDate = t => (t > 0 ? new Date(t).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–');
function buildChronicle() {
  const row = (label, node) => [h('dt', { text: label }), h('dd', {}, node)];
  for (const k of ['count', 'points', 'best', 'fastest', 'cur', 'next']) cv[k] = h('span');
  cv.fill = h('div', { class: 'bar-fill' });
  cv.bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': t('Fortschritt zum nächsten Meilenstein'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, cv.fill);
  cv.empty = h('p', { class: 'hint', text: t('Noch keine Einträge. Dein nächster Neuguss erscheint hier.') });
  cv.body = h('tbody');
  cv.table = h('table', { class: 'chronicle' },
    h('caption', { class: 'sr-only', text: t('Die letzten {n} Neugüsse, neueste zuerst', { n: HISTORY_MAX }) }),
    h('thead', {}, h('tr', {}, [t('Nr.'), t('Dauer'), t(PRESTIGE.currency), t('Erz im Durchlauf')].map(label => h('th', { scope: 'col', text: label })))),
    cv.body);
  cv.box = h('div', { class: 'panel-box wide' },
    h('h2', {}, symSvg('urn', 'h-ico', 'prestige'), ' ' + t('Neuguss-Chronik')),
    h('dl', { class: 'kv' },
      ...row(t('Neugüsse durchgeführt'), cv.count),
      ...row(t('{currency} (gesamt verdient / Bestand)', { currency: t(PRESTIGE.currency) }), cv.points),
      ...row(t('Bester Durchlauf'), cv.best),
      ...row(t('Schnellster Durchlauf'), cv.fastest),
      ...row(t('Aktueller Durchlauf'), cv.cur),
      ...row(t('Nächster Meilenstein'), cv.next)),
    cv.bar,
    h('h3', { class: 'chron-h', text: t('Letzte {n} Neugüsse', { n: HISTORY_MAX }) }),
    cv.empty, cv.table);
  cv.key = '';
}

function renderChronicle(gain) {
  const p = state.prestige, st = state.stats, hist = Array.isArray(p.history) ? p.history : [];
  setText(cv.count, fmtInt(p.count));
  setText(cv.points, `${fmtInt(p.total)} / ${fmtInt(p.points)}`);
  setText(cv.best, st.bestPrestige > 0 ? `${fmtInt(st.bestPrestige)} ${t(PRESTIGE.currency)}` : '–');
  setText(cv.fastest, st.fastestPrestige > 0 ? fmtTime(st.fastestPrestige) : '–');
  setText(cv.cur, t('{time} · +{gain} {currency} bei Neuguss jetzt', { time: fmtTime(st.runTime), gain: fmtInt(gain), currency: t(PRESTIGE.currency) }));
  const idx = MILESTONES.findIndex(m => p.total < m.at);
  let frac = 1;
  if (idx < 0) setText(cv.next, t('Alle Meilensteine erreicht'));
  else {
    const m = MILESTONES[idx], from = idx > 0 ? MILESTONES[idx - 1].at : 0;
    frac = Math.min(1, Math.max(0, (p.total - from) / Math.max(m.at - from, 1)));
    setText(cv.next, t('{at} {currency} ({desc}) · noch {left}', { at: fmtInt(m.at), currency: t(PRESTIGE.currency), desc: t(m.desc), left: fmtInt(m.at - p.total) }));
  }
  cv.fill.style.transform = `scaleX(${frac.toFixed(3)})`;
  setAttr(cv.bar, 'aria-valuenow', Math.round(frac * 100));
  setAttr(cv.bar, 'aria-valuetext', idx < 0 ? t('Alle Meilensteine erreicht') : t('{pct} % bis {at} {currency}', { pct: Math.round(frac * 100), at: fmtInt(MILESTONES[idx].at), currency: t(PRESTIGE.currency) }));
  // Tabelle nur bei Änderung neu aufbauen
  const key = p.count + ':' + hist.length + ':' + (hist.at(-1)?.at || 0);
  if (key === cv.key) return;
  cv.key = key;
  clear(cv.body);
  const max = Math.max(1, ...hist.map(e => e.gain));
  hist.forEach((e, i) => {
    const bar = h('i'); bar.style.transform = `scaleX(${(e.gain / max).toFixed(3)})`;
    cv.body.append(h('tr', {},
      h('th', { scope: 'row', text: '#' + fmtInt(p.count - (hist.length - 1 - i)), title: fmtDate(e.at) }),
      h('td', { text: fmtTime(e.time) }),
      h('td', {}, h('span', { class: 'chron-gain' }, h('b', { text: '+' + fmtInt(e.gain) }), h('span', { class: 'chron-bar', 'aria-hidden': 'true' }, bar))),
      h('td', { text: fmt(e.ore) })));
  });
  // neueste zuerst
  [...cv.body.children].reverse().forEach(tr => cv.body.append(tr));
  cv.empty.hidden = hist.length > 0;
  cv.table.hidden = hist.length === 0;
}

export function renderPrestige() {
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
    ? t('Nächste Gussform ab {target} Erz in diesem Durchlauf (aktuell {run}).', { target: fmt(target), run: fmt(run) })
    : t('Erste Gussform ab {target} Erz in diesem Durchlauf (aktuell {run}).', { target: fmt(target), run: fmt(run) }));
  setText(pv.btnT, (gain >= 1 ? t('Neuguss: +{gain} {currency}', { gain: fmtInt(gain), currency: t(PRESTIGE.currency) }) : t('Noch nicht möglich')) + (state.autoCast?.on && corpLevel('c_autocast') > 0 ? ' · ' + t('Auto aktiv') : ''));
  pv.preview.update();
  pv.auto.update();
  pv.autoBox.hidden = pv.auto.el.hidden;
  setAttr(pv.btn, 'aria-disabled', gain < 1);
  for (const { li, state: st, m } of pv.ms) {
    const done = p.total >= m.at;
    setClass(li, 'done', done);
    setText(st, done ? ' ' + t('(erreicht)') : ' ' + t('(gesperrt)'));
  }
  renderChronicle(gain);
  for (const it of SHOP) {
    const c = shopCards[it.id], lvl = shopLevel(it.id), maxed = lvl >= it.max, cost = shopCost(it.id);
    const can = !maxed && p.points >= cost;
    setText(c.t, it.sym ? tName('prestige', it) : `${it.icon} ${tName('prestige', it)}`);
    setText(c.b, it.max > 1 ? t('Stufe {lvl}/{max}', { lvl, max: it.max }) : (maxed ? t('Gekauft') : ''));
    setText(c.d, tDesc('prestige', it));
    setNote(c, '');
    setCost(c.c, maxed ? [] : [{ text: (PRESTIGE.sym ? '' : PRESTIGE.icon + ' ') + fmtInt(cost), sym: PRESTIGE.sym, name: t(PRESTIGE.currency), ok: p.points >= cost }]);
    setAttr(c.el, 'aria-disabled', !can);
    setClass(c.el, 'can', can);
    setClass(c.el, 'done', maxed);
  }
}

// ---------- Achievements ----------
const av = {};
export function buildAchievements() {
  const root = $('#ach-root');
  av.summary = h('p', { class: 'summary' });
  const list = h('ul', { class: 'ach-list' });
  for (const a of ACHIEVEMENTS) {
    const st = h('span', { class: 'ach-state' });
    const li = h('li', { class: 'ach' },
      h('span', { class: 'ach-icon', 'aria-hidden': 'true' }, a.sym ? symSvg(a.sym, '', 'ach') : a.icon),
      h('span', { class: 'ach-text' }, h('strong', { text: tName('achievements', a) }), h('span', { text: tDesc('achievements', a) })),
      h('span', { class: 'ach-bonus', text: `+${decimal((a.bonus * 100).toFixed(1).replace('.0', ''))} %` }), st);
    achItems[a.id] = { li, st };
    list.append(li);
  }
  root.append(av.summary, list);
}

export function renderAchievements() {
  const n = ACHIEVEMENTS.filter(a => state.achievements[a.id]).length;
  setText(av.summary, t('{n} von {total} freigeschaltet · Produktionsbonus +{bonus} %', { n, total: ACHIEVEMENTS.length, bonus: decimal((achievementBonus() * 100).toFixed(1).replace('.0', '')) }));
  for (const a of ACHIEVEMENTS) {
    const done = !!state.achievements[a.id], it = achItems[a.id];
    setClass(it.li, 'done', done);
    setText(it.st, done ? t('Erreicht') : t('Gesperrt'));
  }
}

// ---------- Statistik ----------
export const sv = { rows: [] };
export function buildStats() {
  const root = $('#stats-root');
  const defs = [
    [t('Spielzeit gesamt'), () => fmtTime(state.stats.playTime)],
    [t('Dauer dieses Durchlaufs'), () => fmtTime(state.stats.runTime)],
    [t('Spielstart'), () => new Date(state.stats.startedAt).toLocaleDateString(locale())],
    [t('Klicks gesamt'), () => fmtInt(state.stats.clicks)],
    [t('Klicks in diesem Durchlauf'), () => fmtInt(state.stats.runClicks)],
    ...RES_IDS.map(k => [t('{name} produziert (gesamt)', { name: tName('resources', RES[k]) }), () => fmt(state.stats.total[k])]),
    [t('Erz produziert (Durchlauf)'), () => fmt(state.stats.run.ore)],
    [t('Höchste Erzproduktion'), () => fmt(state.stats.bestOreRate) + '/s'],
    [t('Gekaufte Stufen/Upgrades'), () => fmtInt(state.stats.buys)],
    [t('Goldene Barren gefangen'), () => fmtInt(state.stats.golden)],
    [t('Neuguss durchgeführt'), () => fmtInt(state.prestige.count)],
    [t('Bester Neuguss'), () => fmtInt(state.stats.bestPrestige) + ' ' + t(PRESTIGE.currency)],
    [t('Erfolge'), () => `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length}`],
  ];
  const dl = h('dl', { class: 'kv' });
  for (const [label, fn] of defs) {
    const dd = h('dd');
    dl.append(h('dt', { text: label }), dd);
    sv.rows.push({ dd, fn });
  }

  const stack = [
    ...RES_IDS.map(k => [t('Forschung & Boosts ({name})', { name: tName('resources', RES[k]) }), () => researchMult(k)]),
    [t('{currency} & Meilensteine', { currency: t(PRESTIGE.currency) }), () => prestigeMult()],
    [t('Erfolge'), () => 1 + achievementBonus()],
    [t('Aktive Effekte'), () => buffMult('prod')],
    [t('Global (ohne Forschung)'), () => globalMult()],
  ];
  const stackDl = h('dl', { class: 'kv' });
  for (const [label, fn] of stack) {
    const dd = h('dd');
    stackDl.append(h('dt', { text: label }), dd);
    sv.rows.push({ dd, fn: () => '×' + fmt(fn()) });
  }

  sv.canvas = h('canvas', { class: 'chart', role: 'img', 'aria-label': t('Verlauf der Produktion pro Sekunde in den letzten 15 Minuten, logarithmisch') });
  const legend = h('ul', { class: 'legend' }, RES_IDS.map(k => h('li', { style: `--c:${RES[k].color}`, text: tName('resources', RES[k]) })));
  root.append(
    h('div', { class: 'panel-box' }, h('h2', { text: t('Statistik') }), dl),
    h('div', { class: 'panel-box' }, h('h2', { text: t('Multiplikator-Stapel') }), stackDl),
    h('div', { class: 'panel-box wide' }, h('h2', { text: t('Produktionsverlauf (log. Skala)') }), sv.canvas, legend));
}

export function renderStats() {
  for (const { dd, fn } of sv.rows) setText(dd, fn());
}
