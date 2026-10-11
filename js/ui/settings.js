// Einstellungen-Tab: Sprache, Zahlenformat, Autosave, Export/Import, Reset.
import { state, setSetting, AUTOSAVE_OPTIONS } from '../core/state.js';
import { FORMATS, setFormat } from '../core/format.js';
import { save, exportSave, importSave, validateImport, resetGame, isSaveLocked } from '../core/save.js';
import { on } from '../core/events.js';
import { t, LANGS, getLang, setLang } from '../core/i18n.js';
import { h, $, confirmDialog } from './dom.js';
import { refresh } from './render.js';

export function applySettings() {
  setFormat(state.settings.format);
}

export function initSettings() {
  const root = $('#settings-root');

  // Sprachwechsel: speichern und neu laden, damit alle einmalig gebauten UI-Teile in der neuen Sprache entstehen.
  // Auch bei gesperrtem Speichern bleibt die Wahl über den localStorage-Schlüssel erhalten (setLang schreibt ihn).
  const langSel = h('select', { id: 'set-lang' }, LANGS.map(l => h('option', { value: l.id, text: l.label })));
  langSel.value = getLang();
  langSel.addEventListener('change', () => { setLang(langSel.value); save(); location.reload(); });

  const formatSel = h('select', { id: 'set-format' }, FORMATS.map(f => h('option', { value: f.id, text: t(f.label) })));
  formatSel.value = state.settings.format;
  formatSel.addEventListener('change', () => { setSetting('format', formatSel.value); applySettings(); refresh(); });

  const particles = h('input', { type: 'checkbox', id: 'set-particles', checked: state.settings.particles });
  particles.addEventListener('change', () => { setSetting('particles', particles.checked); });

  const autosave = h('input', { type: 'checkbox', id: 'set-autosave', checked: state.settings.autosave });
  autosave.addEventListener('change', () => { setSetting('autosave', autosave.checked); });

  const interval = h('select', { id: 'set-interval' }, AUTOSAVE_OPTIONS.map(s => h('option', { value: String(s), text: t('alle {n} Sekunden', { n: s }) })));
  interval.value = String(state.settings.autosaveSec);
  interval.addEventListener('change', () => { setSetting('autosaveSec', Number(interval.value)); });

  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const say = (msg, bad = false) => { status.textContent = msg; status.classList.toggle('bad', bad); };

  const exportBox = h('textarea', { id: 'set-export', readOnly: true, rows: 4, spellcheck: false, 'aria-label': t('Exportierter Spielstand') });
  const importBox = h('textarea', { id: 'set-import', rows: 4, spellcheck: false, placeholder: t('Exportierten Spielstand hier einfügen ...') });

  const sync = () => {
    langSel.value = getLang(); formatSel.value = state.settings.format; particles.checked = state.settings.particles;
    autosave.checked = state.settings.autosave; interval.value = String(state.settings.autosaveSec);
  };

  root.append(
    h('div', { class: 'panel-box' },
      h('h2', { text: t('Anzeige') }),
      h('div', { class: 'field' }, h('label', { htmlFor: 'set-lang', text: t('Sprache / Language') }), langSel),
      h('div', { class: 'field' }, h('label', { htmlFor: 'set-format', text: t('Zahlenformat') }), formatSel),
      h('label', { class: 'check' }, particles, ' ' + t('Partikel und Animationen anzeigen'))),
    h('div', { class: 'panel-box' },
      h('h2', { text: t('Speichern') }),
      h('label', { class: 'check' }, autosave, ' ' + t('Automatisch speichern')),
      h('div', { class: 'field' }, h('label', { htmlFor: 'set-interval', text: t('Intervall') }), interval),
      h('button', { class: 'btn', type: 'button', text: t('Jetzt speichern'), onclick: () => { const ok = save(); say(ok ? t('Spielstand gespeichert.') : isSaveLocked() ? t('Speichern gesperrt: Der gespeicherte Spielstand war unlesbar (Kopie liegt im Browser-Speicher). Importiere einen Spielstand oder setze zurück.') : t('Speichern nicht möglich (Browser-Speicher gesperrt?).'), !ok); } })),
    h('div', { class: 'panel-box wide' },
      h('h2', { text: t('Export / Import') }),
      h('p', { class: 'hint', text: t('Der Export ist ein Base64-Text. Bewahre ihn als Sicherung auf oder übertrage ihn auf ein anderes Gerät.') }),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', text: t('Exportieren'), onclick: () => { exportBox.value = exportSave(); exportBox.focus(); exportBox.select(); say(t('Export erstellt.')); } }),
        h('button', {
          class: 'btn', type: 'button', text: t('In Zwischenablage kopieren'),
          onclick: async () => {
            exportBox.value = exportSave();
            try { await navigator.clipboard.writeText(exportBox.value); say(t('In die Zwischenablage kopiert.')); }
            catch { exportBox.select(); say(t('Kopieren nicht erlaubt – Text ist markiert, bitte mit Strg+C kopieren.'), true); }
          },
        })),
      exportBox,
      h('label', { htmlFor: 'set-import', text: t('Spielstand importieren') }),
      importBox,
      h('button', {
        class: 'btn btn-primary', type: 'button', text: t('Importieren'),
        onclick: async () => {
          try { validateImport(importBox.value); }
          catch (err) { say(err instanceof Error ? t(err.message) : t('Import fehlgeschlagen.'), true); return; }
          const ok = await confirmDialog({ title: t('Spielstand importieren?'), message: t('Dein aktueller Spielstand wird überschrieben.'), confirmLabel: t('Importieren'), danger: true });
          if (!ok) return;
          try { importSave(importBox.value); importBox.value = ''; sync(); say(t('Spielstand importiert.')); }
          catch (err) { say(err instanceof Error ? t(err.message) : t('Import fehlgeschlagen.'), true); }
        },
      })),
    h('div', { class: 'panel-box wide danger-zone' },
      h('h2', { text: t('Spielstand löschen') }),
      h('p', { text: t('Löscht den kompletten Fortschritt inklusive Hochofen-Neuguss, Shop und Erfolgen. Das kann nicht rückgängig gemacht werden.') }),
      h('button', {
        class: 'btn btn-danger', type: 'button', text: t('Alles zurücksetzen'),
        onclick: async () => {
          const ok = await confirmDialog({ title: t('Wirklich alles löschen?'), message: t('Dein gesamter Fortschritt geht unwiderruflich verloren.'), confirmLabel: t('Ja, löschen'), danger: true });
          if (!ok) return;
          resetGame(); sync(); applySettings(); say(t('Neues Spiel gestartet.'));
        },
      })),
    status);

  // Nach Import/Reset Formularfelder und Format anpassen
  // Die Sprache ist eine Geräte-Einstellung: Import/Reset ersetzen den Zustand, behalten aber die aktuelle Sprache.
  on('loaded', () => { setSetting('lang', getLang()); sync(); applySettings(); });
}
