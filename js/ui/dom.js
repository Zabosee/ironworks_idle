// Kleine DOM-Helfer. Es wird nie innerHTML verwendet; alle Texte laufen über textContent / Text-Knoten.
const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'type', 'id', 'title', 'htmlFor', 'readOnly', 'rows', 'spellcheck']);

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.firstChild.remove(); }

/** Setzt textContent nur bei Änderung (vermeidet unnötige Layout-Arbeit). */
export function setText(el, text) {
  text = String(text);
  if (el._t !== text) { el._t = text; el.textContent = text; }
}
export function setClass(el, name, on) { if (el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on); }
export function setAttr(el, name, value) { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)); }

/** Modaler Bestätigungsdialog (natives <dialog>). Gibt Promise<boolean> zurück. */
export function confirmDialog({ title, message, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen', danger = false }) {
  return new Promise(resolve => {
    if (typeof HTMLDialogElement === 'undefined') { resolve(window.confirm(`${title}\n\n${message}`)); return; }
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' },
      h('form', { method: 'dialog' },
        h('h2', { id: 'dlg-title', text: title }),
        h('p', { text: message }),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', type: 'submit', value: 'cancel', text: cancelLabel }),
          h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'submit', value: 'ok', text: confirmLabel }))));
    dlg.addEventListener('close', () => { const ok = dlg.returnValue === 'ok'; dlg.remove(); resolve(ok); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector('button[value="cancel"]').focus();
  });
}
