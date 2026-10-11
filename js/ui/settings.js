// Einstellungen-Tab: Zahlenformat, Autosave, Export/Import, Reset.
import { state, AUTOSAVE_OPTIONS } from '../core/state.js';
import { FORMATS, setFormat } from '../core/format.js';
import { save, exportSave, importSave, resetGame } from '../core/save.js';
import { on } from '../core/events.js';
import { h, $, confirmDialog } from './dom.js';
import { refresh } from './render.js';

export function applySettings() {
  setFormat(state.settings.format);
}

export function initSettings() {
  const root = $('#settings-root');
  const se = state.settings;

  const formatSel = h('select', { id: 'set-format' }, FORMATS.map(f => h('option', { value: f.id, text: f.label })));
  formatSel.value = se.format;
  formatSel.addEventListener('change', () => { se.format = formatSel.value; applySettings(); refresh(); });

  const particles = h('input', { type: 'checkbox', id: 'set-particles', checked: se.particles });
  particles.addEventListener('change', () => { se.particles = particles.checked; });

  const autosave = h('input', { type: 'checkbox', id: 'set-autosave', checked: se.autosave });
  autosave.addEventListener('change', () => { se.autosave = autosave.checked; });

  const interval = h('select', { id: 'set-interval' }, AUTOSAVE_OPTIONS.map(s => h('option', { value: String(s), text: `alle ${s} Sekunden` })));
  interval.value = String(se.autosaveSec);
  interval.addEventListener('change', () => { se.autosaveSec = Number(interval.value); });

  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const say = (msg, bad = false) => { status.textContent = msg; status.classList.toggle('bad', bad); };

  const exportBox = h('textarea', { id: 'set-export', readOnly: true, rows: 4, spellcheck: false, 'aria-label': 'Exportierter Spielstand' });
  const importBox = h('textarea', { id: 'set-import', rows: 4, spellcheck: false, placeholder: 'Exportierten Spielstand hier einfügen ...' });

  const sync = () => {
    formatSel.value = state.settings.format; particles.checked = state.settings.particles;
    autosave.checked = state.settings.autosave; interval.value = String(state.settings.autosaveSec);
  };

  root.append(
    h('div', { class: 'panel-box' },
      h('h2', { text: 'Anzeige' }),
      h('div', { class: 'field' }, h('label', { htmlFor: 'set-format', text: 'Zahlenformat' }), formatSel),
      h('label', { class: 'check' }, particles, ' Partikel und Animationen anzeigen')),
    h('div', { class: 'panel-box' },
      h('h2', { text: 'Speichern' }),
      h('label', { class: 'check' }, autosave, ' Automatisch speichern'),
      h('div', { class: 'field' }, h('label', { htmlFor: 'set-interval', text: 'Intervall' }), interval),
      h('button', { class: 'btn', type: 'button', text: 'Jetzt speichern', onclick: () => { const ok = save(); say(ok ? 'Spielstand gespeichert.' : 'Speichern nicht möglich (Browser-Speicher gesperrt?).', !ok); } })),
    h('div', { class: 'panel-box wide' },
      h('h2', { text: 'Export / Import' }),
      h('p', { class: 'hint', text: 'Der Export ist ein Base64-Text. Bewahre ihn als Sicherung auf oder übertrage ihn auf ein anderes Gerät.' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', text: 'Exportieren', onclick: () => { exportBox.value = exportSave(); exportBox.focus(); exportBox.select(); say('Export erstellt.'); } }),
        h('button', {
          class: 'btn', type: 'button', text: 'In Zwischenablage kopieren',
          onclick: async () => {
            exportBox.value = exportSave();
            try { await navigator.clipboard.writeText(exportBox.value); say('In die Zwischenablage kopiert.'); }
            catch { exportBox.select(); say('Kopieren nicht erlaubt – Text ist markiert, bitte mit Strg+C kopieren.', true); }
          },
        })),
      exportBox,
      h('label', { htmlFor: 'set-import', text: 'Spielstand importieren' }),
      importBox,
      h('button', {
        class: 'btn btn-primary', type: 'button', text: 'Importieren',
        onclick: async () => {
          const ok = await confirmDialog({ title: 'Spielstand importieren?', message: 'Dein aktueller Spielstand wird überschrieben.', confirmLabel: 'Importieren', danger: true });
          if (!ok) return;
          try { importSave(importBox.value); importBox.value = ''; sync(); say('Spielstand importiert.'); }
          catch (err) { say(err instanceof Error ? err.message : 'Import fehlgeschlagen.', true); }
        },
      })),
    h('div', { class: 'panel-box wide danger-zone' },
      h('h2', { text: 'Spielstand löschen' }),
      h('p', { text: 'Löscht den kompletten Fortschritt inklusive Hochofen-Neuguss, Shop und Erfolgen. Das kann nicht rückgängig gemacht werden.' }),
      h('button', {
        class: 'btn btn-danger', type: 'button', text: 'Alles zurücksetzen',
        onclick: async () => {
          const ok = await confirmDialog({ title: 'Wirklich alles löschen?', message: 'Dein gesamter Fortschritt geht unwiderruflich verloren.', confirmLabel: 'Ja, löschen', danger: true });
          if (!ok) return;
          resetGame(); sync(); applySettings(); say('Neues Spiel gestartet.');
        },
      })),
    status);

  // Nach Import/Reset Formularfelder und Format anpassen
  on('loaded', () => { sync(); applySettings(); });
}
