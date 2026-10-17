// Übersetzt das statische index.html einmal beim Boot. Der deutsche Text steht im Markup und ist zugleich der Schlüssel:
//   data-i18n="Text"        -> textContent
//   data-i18n-title="Text"  -> title-Attribut
//   data-i18n-aria="Text"   -> aria-label-Attribut
//   data-i18n-content="Text" -> content-Attribut (meta description)
import { t, getLang, applyDocumentLang } from '../core/i18n.js';

/** @param {ParentNode} [root] */
export function applyStaticTexts(root = document) {
  applyDocumentLang();
  if (getLang() === 'de') return;   // Markup ist bereits deutsch
  const all = sel => /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel));
  for (const el of all('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of all('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle));
  for (const el of all('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of all('[data-i18n-content]')) el.setAttribute('content', t(el.dataset.i18nContent));
}
