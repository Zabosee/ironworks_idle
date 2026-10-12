// Konzern-Reiter (2. Reset-Ebene): Sperrzustand, Kopf, Gründen mit Vorschau und Bestätigung, Konzern-Shop, Konzernstufen, Zugang zur Konzernforschung, Chronik.
// DOM einmal gebaut, renderCorp() (ca. 10x/s, nur bei aktivem Reiter) ändert nur Text, Klassen und Füllstände.
import { state } from '../core/state.js';
import { fmt, fmtInt, fmtTime } from '../core/format.js';
import { t, tName, tDesc, locale } from '../core/i18n.js';
import { corpGain, corpStage, corpMult, corpLevel, corpCost, corpUnlocked, heirFloor } from '../core/formulas.js';
import { CORP, CORP_SHOP, CORP_MILESTONES, CORP_HISTORY_MAX } from '../data/corp.js';
import { RESEARCH } from '../data/research.js';
import { canCorp, doCorp, buyCorpShop } from '../systems/corp.js';
import { symSvg, svgUse } from './assets.js';
import { h, $, clear, setText, setClass, setAttr } from './dom.js';
import { makeCard, setCost, setNote } from './cards.js';
import { buildAutocast } from './goals.js';
import { focusCorpBranch } from './research-map.js';

const cv = { shop: {} };
const CORP_RESEARCH = RESEARCH.filter(r => r.corp);
const fmtDate = ts => (ts > 0 ? new Date(ts).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–');
const bar = (label, max = 100) => {
  const fill = h('div', { class: 'bar-fill' });
  return { fill, el: h('div', { class: 'bar', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': '0' }, fill) };
};
const setBar = (b, frac, text) => {
  b.fill.style.transform = `scaleX(${frac.toFixed(3)})`;
  setAttr(b.el, 'aria-valuenow', Math.round(frac * 100));
  setAttr(b.el, 'aria-valuetext', text);
};

/** Gussformen im Konzernlauf, ab denen es mindestens `gain` Patente gibt (kleinstes g mit corpGain(g) >= gain). */
export function corpThreshold(gain) {
  if (gain <= 0) return 0;
  const m = 1 + 0.1 * corpLevel('c_gain');
  let g = Math.max(0, Math.ceil((gain - 1e-9) * CORP.divisor / m));
  while (corpGain(g) < gain) g++;
  while (g > 0 && corpGain(g - 1) >= gain) g--;
  return g;
}

/** Daten für Vorschau und Dialog (rein, ohne DOM). */
export function foundPreview() {
  const gain = corpGain(), total = state.corp.total + gain, stage = corpStage(total);
  return { gain, total, stage, newStage: stage > corpStage() ? stage : 0, heir: heirFloor() };
}

// ---------- Bestätigungsdialog ----------
let dialogOpen = false;
function askFound(pv) {
  if (dialogOpen || typeof HTMLDialogElement === 'undefined') return Promise.resolve(false);
  dialogOpen = true;
  const col = (cls, icon, title, items) => h('section', { class: 'dlg-col ' + cls }, h('h3', {}, svgUse(icon), ' ' + title), h('ul', {}, items.map(x => h('li', { text: x }))));
  const lost = [t('Gussformen und Hochofen-Shop'), t('Neuguss-Chronik'), t('Alle Ressourcen und Generatoren'), t('Ausbau und Klick-Upgrades'), t('Boosts'), t('Normale Forschung (auch mit Wissensarchiv)'), t('Laufende Aufträge')];
  const kept = [t('Zeitalter'), t('Erfolge und Statistik'), t('Neuguss-Zähler'), t('Patente und Konzern-Shop'), t('Konzernforschung'), t('Auto-Buyer-Schalter'), t('Industrie-Meilensteine')];
  return new Promise(resolve => {
    const dlg = h('dialog', { class: 'dialog dialog-corp', 'aria-labelledby': 'dlg-corp-title' },
      h('form', { method: 'dialog' },
        h('h2', { id: 'dlg-corp-title', text: t('Konzern gründen?') }),
        h('p', { class: 'dlg-gain', text: t('+{gain} {currency} (gesamt {total}, Konzernstufe K{stage})', { gain: fmtInt(pv.gain), currency: t(CORP.currency), total: fmtInt(pv.total), stage: pv.stage }) }),
        h('div', { class: 'dlg-cols' }, col('lost', 'cancel', t('Geht verloren'), lost), col('kept', 'check', t('Bleibt'), kept)),
        pv.heir > 0 ? h('p', { class: 'hint', text: t('Hochofen-Erbe stellt wieder her: Gussformen-Stand {n} für Multiplikator und Meilensteine.', { n: fmtInt(pv.heir) }) }) : null,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'submit', value: 'cancel', text: t('Abbrechen') }),
          h('button', { class: 'btn btn-primary', type: 'submit', value: 'ok', text: t('Konzern gründen') }))));
    dlg.addEventListener('close', () => { const ok = dlg.returnValue === 'ok'; dlg.remove(); dialogOpen = false; resolve(ok); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector('button[value="cancel"]').focus();
  });
}

/** Gründen-Ablauf: erst nach Bestätigung wird doCorp() aufgerufen. `ask` ist für Tests austauschbar. */
export async function foundCorp(ask = askFound) {
  if (!canCorp()) return false;
  if (!(await ask(foundPreview()))) return false;
  return doCorp();
}

// ---------- Aufbau ----------
export function buildCorp() {
  const root = $('#corp-root');
  if (!root) return;

  // Sperrzustand (Neuguss 25 bis 99)
  cv.lockBar = bar(t('Fortschritt zur Konzerngründung'));
  cv.lockText = h('p', { class: 'lock-count' });
  cv.lockBox = h('div', { class: 'panel-box wide corp-lock' },
    h('h2', {}, symSvg('corp', 'h-ico', 'prestige'), ' ' + t(CORP.name)),
    h('p', { text: t('Wird nach {n} Neugüssen freigeschaltet.', { n: CORP.unlockCount }) }),
    cv.lockBar.el, cv.lockText,
    h('h3', { text: t('Das erwartet dich') }),
    h('ul', { class: 'expect' },
      [['patent', t('Patente als zweite Währung')], ['microscope', t('Konzernforschung: 36 dauerhafte Forschungen')], ['variety', t('7 neue Materialien')], ['autocast', t('Auto-Neuguss')]]
        .map(([s, text]) => h('li', {}, symSvg(s), ' ' + text))));

  // Kopf
  for (const k of ['points', 'total', 'stage', 'stageText', 'bonus']) cv[k] = h('span');
  cv.stageBar = bar(t('Fortschritt zur nächsten Konzernstufe'));
  const head = h('div', { class: 'panel-box' },
    h('h2', {}, symSvg('corp', 'h-ico', 'prestige'), ' ' + t('Konzern')),
    h('p', { class: 'corp-points' }, symSvg('patent', 'big-ico', 'prestige'), cv.points, h('span', { class: 'corp-points-k', text: ' ' + t(CORP.currency) })),
    h('p', { class: 'hint' }, t('Insgesamt verdient:') + ' ', cv.total),
    h('p', { class: 'corp-stage' }, symSvg('flag', 'goal-ico'), cv.stage),
    cv.stageBar.el, cv.stageText,
    h('p', { class: 'corp-bonus' }, cv.bonus));

  // Gründen
  cv.gain = h('strong', { class: 'corp-gain' });
  cv.hint = h('p', { class: 'hint' });
  cv.jump = h('p', { class: 'corp-jump' });
  cv.foundBar = bar(t('Fortschritt zur nächsten Patente'));
  cv.btnT = h('span');
  cv.btn = h('button', { class: 'btn btn-primary btn-big', type: 'button', id: 'corp-found' }, symSvg('corp'), ' ', cv.btnT);
  cv.btn.addEventListener('click', () => { if (cv.btn.getAttribute('aria-disabled') !== 'true') foundCorp(); });
  const found = h('div', { class: 'panel-box' },
    h('h2', { text: t('Gründen') }),
    h('p', { text: t('Setze den Konzernlauf zurück und erhalte Patente. Patente erhöhen die Produktion dauerhaft und werden im Konzern-Shop ausgegeben.') }),
    h('p', { class: 'corp-gain-row' }, cv.gain), cv.hint, cv.foundBar.el, cv.jump, cv.btn);

  // Konzernstufen K1 bis K7
  cv.ms = CORP_MILESTONES.map((m, i) => {
    const st = h('span', { class: 'ms-state' });
    return { li: h('li', {}, h('strong', { text: 'K' + (i + 1) }), ' – ' + t('{at} Patente gesamt', { at: fmtInt(m.at) }) + ': ' + t(m.desc), st), st, m };
  });
  const stages = h('div', { class: 'panel-box' }, h('h2', { text: t('Konzernstufen') }), h('ul', { class: 'milestones' }, cv.ms.map(x => x.li)));

  // Konzernforschung (Zugang)
  cv.resCount = h('span', { class: 'b' });
  cv.resNote = h('span', { class: 'n' });
  cv.resBtn = h('button', { class: 'card corp-research', type: 'button' },
    h('span', { class: 'card-head' }, h('span', { class: 'card-ico card-sym', 'aria-hidden': 'true' }, symSvg('microscope', '', 'boost')), h('span', { class: 't', text: t('Konzernforschung') }), cv.resCount),
    h('span', { class: 'd', text: t('Dauerhaft, bleibt bei Neuguss und Gründung') }), cv.resNote);
  cv.resBtn.addEventListener('click', () => {
    if (cv.resBtn.getAttribute('aria-disabled') === 'true') return;
    document.getElementById('tabbtn-research')?.click();
    focusCorpBranch();
  });
  const research = h('div', { class: 'panel-box' }, h('h2', { text: t('Konzernforschung') }), cv.resBtn);

  // Shop
  const grid = h('div', { class: 'grid shop-grid' });
  for (const it of CORP_SHOP) {
    const c = makeCard('corpshop', it.id, { sym: it.sym, cat: 'shop' });
    c.it = it;
    c.el.removeAttribute('data-kind');
    c.el.dataset.corpshop = it.id;
    cv.shop[it.id] = c;
    const cell = h('div', { class: 'shop-cell' }, c.el);
    if (it.id === 'c_autocast') { c.widget = buildAutocast(); cell.append(c.widget.el); }
    grid.append(cell);
  }
  grid.addEventListener('click', e => {
    const el = e.target.closest('[data-corpshop]');
    if (el && el.getAttribute('aria-disabled') !== 'true') buyCorpShop(el.dataset.corpshop);
  });
  const shop = h('div', { class: 'panel-box wide' }, h('h2', { text: t('Konzern-Shop') }), grid);

  // Chronik
  cv.empty = h('p', { class: 'hint', text: t('Noch keine Gründung') });
  cv.body = h('tbody');
  cv.table = h('table', { class: 'chronicle' },
    h('caption', { class: 'sr-only', text: t('Die letzten {n} Gründungen, neueste zuerst', { n: CORP_HISTORY_MAX }) }),
    h('thead', {}, h('tr', {}, [t('Nr.'), t(CORP.currency), t('Gussformen'), t('Laufzeit'), t('Zeitpunkt')].map(label => h('th', { scope: 'col', text: label })))),
    cv.body);
  cv.key = '';
  const chron = h('div', { class: 'panel-box wide' }, h('h2', {}, symSvg('urn', 'h-ico', 'prestige'), ' ' + t('Chronik')), cv.empty, cv.table);

  cv.main = h('div', { class: 'panel-grid corp-main' }, head, found, shop, stages, research, chron);
  root.append(cv.lockBox, cv.main);
}

// ---------- Anzeige ----------
function renderChronicle() {
  const c = state.corp, hist = c.history || [];
  const key = c.count + ':' + hist.length + ':' + (hist.at(-1)?.at || 0);
  if (key !== cv.key) {
    cv.key = key;
    clear(cv.body);
    hist.forEach((e, i) => cv.body.prepend(h('tr', {},
      h('th', { scope: 'row', text: '#' + fmtInt(c.count - (hist.length - 1 - i)) }),
      h('td', { text: '+' + fmtInt(e.gain) }), h('td', { text: fmtInt(e.gussformen) }), h('td', { text: fmtTime(e.time) }), h('td', { text: fmtDate(e.at) }))));
  }
  cv.empty.hidden = hist.length > 0;
  cv.table.hidden = hist.length === 0;
}

export function renderCorp() {
  if (!cv.main) return;
  const unlocked = corpUnlocked(), c = state.corp;
  if (cv.lockBox.hidden !== unlocked) cv.lockBox.hidden = unlocked;
  if (cv.main.hidden === unlocked) cv.main.hidden = !unlocked;
  if (!unlocked) {
    const n = state.prestige.count, frac = Math.min(1, n / CORP.unlockCount);
    setBar(cv.lockBar, frac, t('Neuguss {cur} von {at}', { cur: fmtInt(n), at: CORP.unlockCount }));
    setText(cv.lockText, t('Neuguss {cur}/{at}', { cur: fmtInt(n), at: CORP.unlockCount }));
    return;
  }
  // Kopf
  const stage = corpStage(), next = CORP_MILESTONES[stage], prev = stage ? CORP_MILESTONES[stage - 1].at : 0;
  setText(cv.points, fmtInt(c.points));
  setText(cv.total, fmtInt(c.total));
  setText(cv.stage, t('Konzernstufe K{n} von {max}', { n: stage, max: CORP_MILESTONES.length }));
  const stageFrac = next ? Math.min(1, Math.max(0, (c.total - prev) / (next.at - prev))) : 1;
  const stageTxt = next ? t('{cur}/{at} Patente gesamt', { cur: fmtInt(c.total), at: fmtInt(next.at) }) : t('Alle Konzernstufen erreicht');
  setBar(cv.stageBar, stageFrac, stageTxt);
  setText(cv.stageText, stageTxt);
  const pat = 1 + c.total * CORP.perPoint * (1 + 0.2 * corpLevel('c_eff'));
  setText(cv.bonus, t('Patente-Bonus ×{a} · Konzernstufen ×{b}', { a: fmt(pat), b: fmt(corpMult() / pat) }));
  // Gründen
  const gain = corpGain(), run = state.prestige.total, at = corpThreshold(gain + 1), from = corpThreshold(gain);
  setText(cv.gain, gain >= 1 ? t('Du erhältst +{gain} {currency}', { gain: fmtInt(gain), currency: t(CORP.currency) }) : t('Noch keine Patente'));
  setText(cv.hint, gain >= 1
    ? t('Nächste Patente bei {at} Gussformen im Lauf (aktuell {cur}).', { at: fmtInt(at), cur: fmtInt(run) })
    : t('Noch {n} Gussformen bis zur ersten Patente.', { n: fmtInt(Math.max(0, at - run)) }));
  setBar(cv.foundBar, Math.min(1, Math.max(0, (run - from) / Math.max(at - from, 1))), t('Gussformen {cur} von {at}', { cur: fmtInt(run), at: fmtInt(at) }));
  const pv = foundPreview();
  setText(cv.jump, gain >= 1 && pv.newStage ? t('Erreicht Konzernstufe K{n}: {desc}', { n: pv.newStage, desc: t(CORP_MILESTONES[pv.newStage - 1].desc) }) : '');
  setText(cv.btnT, gain >= 1 ? t('Konzern gründen') : t('Noch nicht möglich'));
  setAttr(cv.btn, 'aria-disabled', gain < 1);
  // Konzernstufen
  for (const { li, st, m } of cv.ms) {
    const done = c.total >= m.at;
    setClass(li, 'done', done);
    setText(st, done ? ' ' + t('(erreicht)') : ' ' + t('(gesperrt)'));
  }
  // Shop
  for (const it of CORP_SHOP) {
    const k = cv.shop[it.id], lvl = corpLevel(it.id), maxed = lvl >= it.max, cost = maxed ? 0 : corpCost(it.id);
    const can = !maxed && c.points >= cost;
    setText(k.t, tName('corpShop', it));
    setText(k.b, it.max > 1 ? t('Stufe {lvl}/{max}', { lvl, max: it.max }) : (maxed ? t('Gekauft') : ''));
    setText(k.d, tDesc('corpShop', it));
    setNote(k, maxed ? t('Max') : can ? '' : t('Es fehlen {n} Patente', { n: fmtInt(cost - c.points) }), maxed ? 'check' : 'lock');
    setCost(k.c, maxed ? [] : [{ text: `${fmtInt(cost)} ${t(CORP.currency)}`, sym: 'patent', name: t(CORP.currency), ok: can }]);
    setAttr(k.el, 'aria-disabled', !can);
    setClass(k.el, 'can', can);
    setClass(k.el, 'done', maxed);
    k.widget?.update();
  }
  // Konzernforschung
  const done = CORP_RESEARCH.filter(r => state.research[r.id]).length;
  setText(cv.resCount, t('{done}/{total} erforscht', { done, total: CORP_RESEARCH.length }));
  setText(cv.resNote, stage < 1 ? t('Ab Konzernstufe K1') : '');
  cv.resNote.hidden = stage >= 1;
  setAttr(cv.resBtn, 'aria-disabled', stage < 1);
  setClass(cv.resBtn, 'locked', stage < 1);
  renderChronicle();
}
