// Zielleiste (nextGoals), Neuguss-Vorschau (castPreview) und Auto-Neuguss-Schalter. DOM einmal gebaut, danach nur Werte.
import { state } from '../core/state.js';
import { fmt, fmtInt, fmtTime } from '../core/format.js';
import { t, tName } from '../core/i18n.js';
import { nextGoals, castPreview, prestigeGain, corpLevel } from '../core/formulas.js';
import { ERAS } from '../data/eras.js';
import { INDUSTRY_TRACKS } from '../data/industry.js';
import { AUTOCAST } from '../data/corp.js';
import { setAutoCast, autoCastDefaultGain } from '../systems/corp.js';
import { symSvg, svgUse } from './assets.js';
import { h, setText, setAttr, setClass } from './dom.js';
import { restartAnim } from './effects.js';

// ---------- Zielleiste ----------
const GOAL_TAB = { firstcast: 'prestige', milestone: 'prestige', era: 'industry', industry: 'industry', corpunlock: 'corp', corp: 'corp' };

/** Beschreibt ein Ziel aus nextGoals(): Name, Wertetext für Screenreader und verbleibendes Erz (für die Restzeit, sonst null). */
export function describeGoal(g, rates = {}) {
  const ore = state.stats.total.ore;
  switch (g.kind) {
    case 'firstcast': {
      const cur = state.stats.run.ore;
      return { name: t('Erster Neuguss'), text: t('Erz {cur} von {at}', { cur: fmt(cur), at: fmt(g.at) }), left: g.at - cur };
    }
    case 'milestone':
      return { name: t('Hochofen-Meilenstein: {at} Gussformen', { at: fmtInt(g.at) }), text: t('Gussformen {cur} von {at}', { cur: fmtInt(Math.floor(g.progress * g.at)), at: fmtInt(g.at) }), left: null };
    case 'era': {
      const era = ERAS.find(e => e.id === g.id);
      return { name: tName('eras', era), text: t('Erz {cur} von {at}', { cur: fmt(ore), at: fmt(g.at) }), left: g.at - ore };
    }
    case 'industry': {
      const tr = INDUSTRY_TRACKS.find(x => x.id === g.id), val = tr.value(state);
      return {
        name: t('{name}: nächste Stufe', { name: tName('industry', tr) }),
        text: tr.log ? t('Erz {cur} von {at}', { cur: fmt(val), at: fmt(g.at) }) : t('{cur} von {at} Materialien', { cur: fmtInt(val), at: fmtInt(g.at) }),
        left: tr.log ? g.at - val : null,
      };
    }
    case 'corpunlock':
      return { name: t('Konzerngründung freischalten'), text: t('Neuguss {cur} von {at}', { cur: fmtInt(state.prestige.count), at: fmtInt(g.at) }), left: null };
    default:
      return { name: t('Konzernstufe {id}', { id: g.id }), text: t('Patente {cur} von {at}', { cur: fmtInt(state.corp.total), at: fmtInt(g.at) }), left: null };
  }
}

/** Zielleiste als Karte: Name + Restzeit (Button, springt in den passenden Reiter), darunter Balken. */
export function buildGoalBar(extraClass = '') {
  const name = h('span', { class: 'goal-name' }), eta = h('span', { class: 'goal-eta' });
  const fill = h('i');
  const bar = h('div', { class: 'bar goal-barline', role: 'progressbar', 'aria-label': t('Fortschritt zum nächsten Ziel'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
  const go = h('button', { class: 'goal-go', type: 'button' }, symSvg('flag', 'goal-ico'), h('span', { class: 'goal-k', text: t('Nächstes Ziel:') + ' ' }), name, eta);
  const el = h('div', { class: ('goal-bar ' + extraClass).trim(), role: 'group', 'aria-label': t('Nächstes Ziel') }, go, bar);
  const o = { el, key: '', last: -1e9, goal: null };
  go.addEventListener('click', () => { if (o.goal) document.getElementById('tabbtn-' + GOAL_TAB[o.goal.kind])?.click(); });
  /** Ca. 1x pro Sekunde: nur Text und Füllstand. `force` ignoriert die Drosselung (Tab-Wechsel). */
  o.update = (rates, force = false) => {
    const now = Date.now();
    if (!force && now - o.last < 1000) return;
    o.last = now;
    const g = nextGoals()[0] || null;
    o.goal = g;
    if (!g) {
      setText(name, t('Alle Ziele erreicht')); setText(eta, '');
      fill.style.transform = 'scaleX(1)'; setAttr(bar, 'aria-valuenow', 100); setAttr(bar, 'aria-valuetext', t('Alle Ziele erreicht'));
      go.disabled = true;
      return;
    }
    go.disabled = false;
    const d = describeGoal(g, rates), key = g.kind + ':' + g.id;
    if (key !== o.key) { o.key = key; restartAnim(el, 'goal-in'); }
    setText(name, d.name);
    const rate = rates?.ore || 0;
    setText(eta, d.left != null && d.left > 0 && rate > 0 ? t('ca. {time}', { time: fmtTime(d.left / rate) }) : t('Rate unbekannt'));
    const pct = Math.round(g.progress * 100);
    fill.style.transform = `scaleX(${g.progress.toFixed(3)})`;
    setAttr(bar, 'aria-valuenow', pct);
    setAttr(bar, 'aria-valuetext', d.text);
  };
  return o;
}

// ---------- Neuguss-Vorschau ----------
// Gewinn-Verlauf des laufenden Durchlaufs (alle 5 s ein Messpunkt), um den Zuwachs der letzten ca. 2 Minuten zu zeigen.
const samples = [];
function prevSample(rt, gain) {
  if (samples.length && rt < samples.at(-1).rt) samples.length = 0;   // Neuguss, Gründung oder Import
  if (!samples.length || rt - samples.at(-1).rt >= 5) samples.push({ rt, gain });
  while (samples.length > 1 && samples[1].rt <= rt - 120) samples.shift();
  return samples[0].rt <= rt - 100 ? samples[0] : null;
}

/** Vorschau als <dl> mit Bewertung "Lohnt sich jetzt" / "Noch warten" (Text mit Symbol). Gibt auch eine Kurzzeile für die Seitenleiste zurück. */
export function buildCastPreview() {
  const dd = () => h('dd', { class: 'tnum' });
  const v = { gain: dd(), marg: dd(), hour: dd(), ms: dd() };
  const yes = h('span', { class: 'pill pill-yes', hidden: true }, svgUse('check'), t('Lohnt sich jetzt'));
  const no = h('span', { class: 'pill pill-no', hidden: true }, symSvg('hourglass'), t('Noch warten'));
  const el = h('div', { class: 'cast-preview' },
    h('h3', { text: t('Neuguss-Vorschau') }),
    h('dl', { class: 'kv' },
      h('dt', { text: t('Gussformen jetzt') }), v.gain,
      h('dt', { text: t('Marginalwert') }), v.marg,
      h('dt', { text: t('Gewinn pro Stunde') }), v.hour,
      h('dt', { text: t('Nächster Meilenstein') }), v.ms),
    h('p', { class: 'pill-row' }, yes, no));
  const o = { el, summary: '' };
  o.update = () => {
    const rt = state.stats.runTime || 0, gain = prestigeGain(), prev = prevSample(rt, gain);
    const p = castPreview(prev ? prev.gain : null, prev ? rt - prev.rt : 120);
    setText(v.gain, '+' + fmtInt(p.gain));
    setText(v.marg, prev ? t('+{n} in den letzten 2 Min.', { n: fmtInt(Math.max(0, gain - prev.gain)) }) : '–');
    setText(v.hour, fmt(p.perHour));
    setText(v.ms, !p.milestone ? t('Alle erreicht') : p.milestone.reached ? t('Mit diesem Neuguss erreicht') : t('noch {n}', { n: fmtInt(Math.max(0, p.milestone.missing - p.gain)) }));
    yes.hidden = p.worthIt !== true; no.hidden = p.worthIt !== false;
    o.summary = p.worthIt === null ? '' : p.worthIt ? t('Lohnt sich jetzt') : t('Noch warten');
    return p;
  };
  return o;
}

// ---------- Auto-Neuguss ----------
let uid = 0;
/** Schalter (role=switch), Modus (radiogroup Gewinn/Zeit), Zahlenfeld. Unsichtbar, solange c_autocast nicht gekauft ist. */
export function buildAutocast() {
  const n = ++uid;
  const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': 'ac-title-' + n }, h('span', { class: 'switch-knob', 'aria-hidden': 'true' }));
  sw.addEventListener('click', () => setAutoCast({ on: !state.autoCast.on }));
  const modes = { gain: t('Gewinn'), time: t('Zeit') };
  const radios = Object.entries(modes).map(([m, label]) => h('button', { class: 'btn seg', type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { mode: m }, text: label }));
  const group = h('div', { class: 'seg-group', role: 'radiogroup', 'aria-label': t('Modus') }, radios);
  const pick = (b, focus) => { setAutoCast({ mode: b.dataset.mode, value: 0 }); if (focus) b.focus(); };
  group.addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (b) pick(b); });
  group.addEventListener('keydown', e => {
    const i = radios.indexOf(document.activeElement);
    if (i < 0 || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    pick(radios[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : radios.length - 1)) % radios.length], true);
  });
  const label = h('label', { htmlFor: 'ac-val-' + n });
  const input = h('input', { id: 'ac-val-' + n, type: 'number', inputmode: 'numeric', min: '1', step: '1' });
  input.addEventListener('change', () => {
    const val = Math.floor(Number(input.value));
    if (val >= 1) setAutoCast({ value: val }); else input._v = null;   // ungültig: beim nächsten Update zurücksetzen
  });
  const el = h('div', { class: 'autocast' },
    h('div', { class: 'autocast-head' }, symSvg('autocast', 'h-ico', 'prestige'), h('strong', { id: 'ac-title-' + n, text: t('Auto-Neuguss') }), sw),
    h('div', { class: 'autocast-row' }, group, h('span', { class: 'autocast-field' }, label, input)),
    h('p', { class: 'hint', text: t('Mindestlaufzeit {n} s', { n: AUTOCAST.minRun }) }));
  const o = { el };
  o.update = () => {
    const unlocked = corpLevel('c_autocast') >= 1;
    if (el.hidden === unlocked) el.hidden = !unlocked;
    if (!unlocked) return;
    const a = state.autoCast;
    setAttr(sw, 'aria-checked', a.on);
    setClass(sw, 'on', a.on);
    for (const r of radios) setAttr(r, 'aria-checked', r.dataset.mode === a.mode), setAttr(r, 'tabindex', r.dataset.mode === a.mode ? 0 : -1);
    setText(label, a.mode === 'time' ? t('nach Minuten') : t('ab Gewinn'));
    const val = a.value > 0 ? a.value : a.mode === 'time' ? AUTOCAST.defaultMinutes : autoCastDefaultGain();
    if (document.activeElement !== input && input._v !== val) { input._v = val; input.value = String(val); }
  };
  return o;
}
