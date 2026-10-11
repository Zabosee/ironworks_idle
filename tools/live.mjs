#!/usr/bin/env node
// Live-Steuerung des sichtbaren Chrome-Fensters über das DevTools-Protokoll (keine Abhängigkeiten).
// Voraussetzung: Chrome läuft mit --remote-debugging-port=9222 und hat einen Tab auf http://localhost:8080.
//
// Befehle:
//   node tools/live.mjs eval "<js>"            JS im Spiel ausführen, Ergebnis ausgeben
//   node tools/live.mjs click "<selector>" [n] Element n-mal sichtbar anklicken (mit Hervorhebung)
//   node tools/live.mjs tab <name>             Tab wechseln (gens, upgrades, research, ...)
//   node tools/live.mjs say "<text>"           Statuszeile im Browser anzeigen
//   node tools/live.mjs reload                 Seite neu laden (Cache umgehen)
//   node tools/live.mjs shot <datei.png>       Screenshot speichern
//   node tools/live.mjs errors [ms]            Konsolenfehler/Exceptions für ms sammeln (Standard 3000)
//   node tools/live.mjs check                  Reload + Fehler sammeln + Basis-DOM-Prüfung

import { connect, evaluate, say, sleep, click, collectErrors } from './cdp.mjs';

const [cmd, ...args] = process.argv.slice(2);
const c = await connect();
try {
  switch (cmd) {
    case 'eval': { const v = await evaluate(c, args.join(' ')); console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2)); break; }
    case 'click': await say(c, 'Klicke ' + args[0]); await click(c, args[0], Number(args[1]) || 1); console.log('ok'); break;
    case 'tab': await say(c, 'Öffne Tab ' + args[0]); await click(c, `[data-tab="${args[0]}"]`); console.log('ok'); break;
    case 'say': await say(c, args.join(' ')); console.log('ok'); break;
    case 'reload': await c.send('Page.reload', { ignoreCache: true }); await sleep(1200); console.log('ok'); break;
    case 'shot': {
      const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
      const fs = await import('node:fs'); fs.writeFileSync(args[0] || 'shot.png', Buffer.from(data, 'base64')); console.log('gespeichert: ' + (args[0] || 'shot.png')); break;
    }
    case 'errors': { const e = await collectErrors(c, Number(args[0]) || 3000); console.log(e.length ? e.join('\n') : 'keine Fehler'); break; }
    case 'check': {
      await c.send('Runtime.enable'); await c.send('Log.enable');
      const p = collectErrors(c, 3500);
      await c.send('Page.reload', { ignoreCache: true });
      const e = await p;
      const dom = await evaluate(c, `({ title: document.title, bootError: !document.getElementById('boot-error')?.hidden, tabs: document.querySelectorAll('[data-tab]').length, gens: document.querySelectorAll('#tab-gens > *, #gens > *').length })`);
      console.log(JSON.stringify(dom)); console.log(e.length ? e.join('\n') : 'keine Fehler');
      break;
    }
    default: console.log('Befehle: eval | click | tab | say | reload | shot | errors | check');
  }
} finally { c.close(); }
