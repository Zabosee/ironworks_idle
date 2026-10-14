// Einstieg der UI: verdrahtet Panels, Ereignisse und den Frame-Takt. Die Teile liegen in sidebar/cards/queues/panels.
import { state } from '../core/state.js';
import { on, toast } from '../core/events.js';
import { t, tName, locale } from '../core/i18n.js';
import { rates } from '../core/formulas.js';
import { fmtInt, decimal } from '../core/format.js';
import { INDUSTRY_TRACKS } from '../data/industry.js';
import { buy } from '../systems/production.js';
import { $, setText } from './dom.js';
import { activeTab } from './tabs.js';
import { restartAnim, clearOneShots, updateOrbs } from './effects.js';
import { sample, drawHistory } from './charts.js';
import { buildIndustry, renderIndustry } from './industry.js';
import { buildCorp, renderCorp } from './corp.js';
import { updateResearchPanel } from './research-map.js';
import { els, initSidebar, renderTop, renderBuffs, showDelta } from './sidebar.js';
import { cards, buildCards, renderCards } from './cards.js';
import { buildQueues, renderQueues, buildAutobuyers, renderAutobuyers } from './queues.js';
import { sv, buildPrestige, renderPrestige, buildAchievements, renderAchievements, buildStats, renderStats } from './panels.js';

let lastRates = null;

// ---------- Aufbau ----------
export function initRender() {
  initSidebar();
  buildCards();
  buildAutobuyers(refresh);
  buildQueues(refresh);
  buildPrestige();
  buildAchievements();
  buildStats();
  buildIndustry($('#industry-root'));
  buildCorp();
  bindActions();
  on('buy', e => {
    if (e.silent) return;
    const card = cards.find(c => c.kind === e.kind && c.id === e.id);
    if (card) restartAnim(card.el);
    if (lastRates) showDelta(lastRates, rates());
    refresh();
  });
  on('shop', refresh);
  on('evo', refresh);
  on('era', refresh);
  for (const ev of ['timer:queued', 'timer:cancel']) on(ev, refresh);
  on('timer:done', e => {
    // Fertig: kurzes Aufblitzen der Karte (der Toast kommt aus dem Timer-System)
    const card = cards.find(c => c.kind === e.kind && c.id === e.id);
    refresh();
    if (card) restartAnim(card.root, 'done-flash');
  });
  on('prestige', refresh);
  on('focus', refresh);
  on('challenge', refresh);
  for (const ev of ['corp', 'corpshop', 'autocastset']) on(ev, refresh);
  on('industry', e => {   // Leisten-Stufe erreicht (systems/industry.js)
    const tr = INDUSTRY_TRACKS.find(x => x.id === e.track);
    if (tr) toast(t('{name}: Stufe {step}! Produktion ×{mult}', { name: tName('industry', tr), step: e.step, mult: decimal(e.mult) }), 'gold');
    refresh();
  });
  on('corpunlock', () => { const b = document.getElementById('tabbtn-corp'); if (b) restartAnim(b, 'tab-pulse'); refresh(); });
  let lastAuto = 0;
  on('autocast', e => {   // höchstens ein Toast je 10 s
    const now = Date.now();
    if (now - lastAuto < 10000) return;
    lastAuto = now;
    toast(t('Auto-Neuguss: +{gain} Gussformen', { gain: fmtInt(e.gain) }), 'info');
  });
  on('loaded', refresh);
  on('tab', () => { clearOneShots(); refresh(); });
  on('buffs', () => renderBuffs(true));
  on('saved', ts => setText(els.saved, t('Gespeichert {time}', { time: new Date(ts).toLocaleTimeString(locale()) })));
  on('save-failed', () => setText(els.saved, t('Speichern nicht möglich')));
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

function renderActive(r) {
  switch (activeTab()) {
    case 'gens': renderCards(['gen']); break;
    case 'industry': renderIndustry(r); break;
    case 'upgrades': renderCards(['click', 'boost']); renderQueues(['workshop']); renderAutobuyers(); break;
    case 'research': renderCards(['research']); renderQueues(['lab']); break;
    case 'prestige': renderPrestige(); break;
    case 'corp': renderCorp(); break;
    case 'achievements': renderAchievements(); break;
    case 'stats': renderStats(); drawHistory(sv.canvas); break;
    default: break;
  }
}

/** Sofortiges Neuzeichnen nach Benutzeraktionen. */
export function refresh() {
  lastRates = rates();
  renderTop(lastRates);
  renderActive(lastRates);
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
  renderActive(r);
  updateOrbs(r, step);
  updateResearchPanel();
  if (sparkAcc >= 1) {
    sparkAcc = 0;
    sample(r);
    if (activeTab() === 'stats') drawHistory(sv.canvas);
  }
}
