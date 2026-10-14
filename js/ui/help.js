// Hilfe-Dialog (Taste ? oder Knopf): Spielebenen und Materialglossar. Natives <dialog>: Esc, Fokusfalle, Fokusrückgabe.
import { state } from '../core/state.js';
import { t, tName } from '../core/i18n.js';
import { fmt } from '../core/format.js';
import { resVisible } from '../core/formulas.js';
import { RES } from '../data/resources.js';
import { LAYERS, layerParams, glossary } from '../data/help.js';
import { h } from './dom.js';

export const resKnown = id => resVisible(id) || state.stats.total?.[id] > 0;

/** Materialname oder ??? (kein Spoiler für spätere Zeitalter). */
const nameOf = id => (resKnown(id) ? tName('resources', RES[id]) : '???');
const amounts = o => Object.entries(o).map(([id, n]) => `${fmt(n)} ${nameOf(id)}`).join(' + ');

function entry(e) {
  if (!resKnown(e.id)) return h('li', { class: 'help-res unknown' }, h('strong', { text: '???' }), ' ', h('span', { class: 'hint', text: t('Noch nicht entdeckt') }));
  const lines = [];
  if (e.gens.length) lines.push(t('Erzeugt von: {names}', { names: e.gens.map(g => tName('generators', g)).join(', ') }));
  for (const r of e.made) lines.push(t('Rezept {name}: {inputs} → {outputs}', { name: tName('recipes', r), inputs: amounts(r.inputs), outputs: amounts(r.outputs) }));
  if (e.fed.length) lines.push(t('Wird verbraucht für: {names}', { names: [...new Set(e.fed.flatMap(r => Object.keys(r.outputs)))].map(nameOf).join(', ') }));
  if (e.costGens || e.costResearch) lines.push(t('Als Kosten in: Generatoren {g} · Forschungen {r}',{ g: e.costGens, r: e.costResearch }));
  return h('li', { class: 'help-res' }, h('strong', { text: `${RES[e.id].icon} ${tName('resources', RES[e.id])}` }), h('ul', {}, lines.map(l => h('li', { text: l }))));
}

let dlg = null;
export function openHelp() {
  if (dlg || typeof HTMLDialogElement === 'undefined') return;
  dlg = h('dialog', { class: 'dialog dialog-help', 'aria-labelledby': 'dlg-help' },
    h('h2', { id: 'dlg-help', text: t('Hilfe') }),
    h('h3', { text: t('Spielebenen') }),
    h('dl', {}, LAYERS.flatMap(l => [h('dt', { text: t(l.name) }), h('dd', { text: t(l.text, layerParams(l.id)) })])),
    h('h3', { text: t('Materialien') }),
    h('ul', { class: 'help-list' }, glossary().map(entry)),
    h('form', { method: 'dialog', class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', type: 'submit', text: t('Schließen') })));
  dlg.addEventListener('close', () => { dlg.remove(); dlg = null; });
  document.body.append(dlg);
  dlg.showModal();
}

export function initHelp() {
  document.getElementById('help-btn')?.addEventListener('click', openHelp);
  document.addEventListener('keydown', e => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    e.preventDefault(); openHelp();
  });
}
