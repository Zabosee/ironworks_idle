// Hinweis auf ein Zufallsereignis (ein Knopf oben rechts, Klick = reagieren, ignorierbar). Logik: systems/events-random.js.
import { t, tName } from '../core/i18n.js';
import { fmt } from '../core/format.js';
import { on, toast } from '../core/events.js';
import { RES } from '../data/resources.js';
import { RANDOM_EVENT_MAP } from '../data/events-random.js';
import { getCurrent, respond } from '../systems/events-random.js';
import { h, setText } from './dom.js';

export function initReventUI(root) {
  const text = h('span');
  const btn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => respond() }, text);
  root.append(btn);
  const draw = () => {
    const ev = getCurrent();
    root.hidden = !ev;
    if (!ev) return;
    const ty = RANDOM_EVENT_MAP[ev.type];
    setText(text, `${tName('randomEvents', ty)}: ` + t(ty.hint, { res: ev.res ? tName('resources', RES[ev.res]) : '', need: fmt(ev.need ?? 0), sec: Math.ceil(ev.left) }));
  };
  on('revent', ev => { draw(); toast(t('Zufallsereignis: {name}', { name: tName('randomEvents', RANDOM_EVENT_MAP[ev.type]) }), 'info'); });
  on('revent:end', draw);
  setInterval(draw, 1000);
}
