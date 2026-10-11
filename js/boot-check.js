// Hinweis, falls die Seite per file:// geöffnet wurde oder das Modul nicht lädt.
// Eigene Datei statt Inline-Script, damit die CSP kein 'unsafe-inline' braucht.
setTimeout(function () {
  if (window.__eisenwerk) return;
  var box = document.getElementById('boot-error');
  if (!box || box.textContent) return;
  box.hidden = false;
  var en = false; try { en = localStorage.getItem('eisenwerk.lang') === 'en'; } catch (e) { /* ohne Speicher: deutsch */ }
  if (en) {
    box.textContent = location.protocol === 'file:'
      ? 'ES modules do not work over file://. Please start a local web server (see README.md), e.g. "npx serve" or "python -m http.server".'
      : 'The game could not be loaded. Check the browser console.';
    return;
  }
  box.textContent = location.protocol === 'file:'
    ? 'ES-Module funktionieren nicht über file://. Bitte einen lokalen Webserver starten (siehe README.md), z. B. "npx serve" oder "python -m http.server".'
    : 'Das Spiel konnte nicht geladen werden. Prüfe die Browser-Konsole.';
}, 2000);
