// Interaktive Research Skilltree Map mit Pan, Zoom und Keyboard Navigation
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { RESEARCH_COORDS, MIN_NODE_DISTANCE } from '../data/research-layout.js';
import { levelOf, lockReason, pendingOf, isRevealed as revealed, bulkPlan, duration, eraIndex, industryUnlocked, corpStage } from '../core/formulas.js';
import { fmtClock, fmt } from '../core/format.js';
import { t, tName, tDesc } from '../core/i18n.js';
import { state } from '../core/state.js';
import { RES } from '../data/resources.js';
import { ERAS } from '../data/eras.js';
import { buy } from '../systems/production.js';
import { imgFor, symSvg, svgUse } from './assets.js';
import { h, $, clear, setText, setClass, setAttr } from './dom.js';
import { corpTabVisible, corpPill } from './corp-common.js';

/** Wie formulas.isRevealed, dazu: Konzernforschung (Ast) erst, wenn der Konzern-Reiter sichtbar ist. */
const isRevealed = (kind, id) => revealed(kind, id) && (!RESEARCH_MAP[id]?.corp || corpTabVisible());

let mapState = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  container: null,
  visibleCount: -1,   // Anzahl sichtbarer Knoten beim letzten Einpassen
  nodes: [], // { el, id, def, coord }
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  dragStartTranslate: { x: 0, y: 0 },
  selectedId: null,  // Aktuell ausgewählter Knoten
};

const MIN_SCALE = 0.12;   // Fit darf weit hinauszoomen, damit die ganze Karte sichtbar ist
const LABEL_MIN_SCALE = 0.6;   // darunter wären Beschriftungen < 8 px: ausblenden (Icon + Tooltip/Detailpanel)
const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;
const NODE_R = 48;        // Knotenradius (96 px / 2 + Rand)
const START_SCALE = 0.9;  // Startansicht: Geologie in der Mitte, erste Knoten lesbar
const MOBILE_SCALE = 0.5; // schmale Bildschirme: kleinster automatischer Zoom (Knoten noch antippbar)

/**
 * Initialisiert die Research Map einmalig.
 */
export function initResearchMap(container) {
  // Container Structure
  const viewport = h('div', { class: 'research-map-viewport' });
  const mapContainer = h('div', { class: 'research-map-container' });

  // SVG für Linien (größer wegen skalierter Koordinaten)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'research-lines');
  svg.setAttribute('width', '3000');
  svg.setAttribute('height', '3000');
  svg.setAttribute('viewBox', '-1500 -1500 3000 3000');

  // SVG Marker Definitionen
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const markers = [
    { id: 'arrow-available', fill: '#10b981' },
    { id: 'arrow-pending', fill: '#f59e0b' },
    { id: 'arrow-locked', fill: '#64748b' },
    { id: 'arrow-done', fill: '#8b5cf6' },
  ];
  for (const m of markers) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', m.id);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', m.fill);
    marker.append(path);
    defs.append(marker);
  }
  svg.append(defs);

  const linesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  linesGroup.setAttribute('class', 'lines-group');
  svg.append(linesGroup);

  // Knoten Container
  const nodesContainer = h('div', { class: 'research-nodes' });

  // Baue Knoten
  for (const r of RESEARCH) {
    const coord = RESEARCH_COORDS[r.id];
    if (!coord) continue;

    const node = h('button',
      {
        class: 'research-node',
        type: 'button',
        dataset: { id: r.id, x: coord.x, y: coord.y, cat: r.cat },
        style: `--x: ${coord.x}; --y: ${coord.y}; --liquid: ${r.liquid};`,
        'aria-label': tName('research', r),
        title: tName('research', r),
      },
      h('span', { class: 'node-ico', 'aria-hidden': 'true', text: r.sym ? null : r.icon }, r.sym ? symSvg(r.sym) : null),
      h('span', { class: 'node-label', text: tName('research', r) }),
      h('span', { class: 'node-badge', 'aria-hidden': 'true' }),
      r.corp ? h('span', { class: 'node-corp', 'aria-hidden': 'true' }, corpPill(r.corp)) : null,
      r.era ? h('span', { class: 'node-era', 'aria-hidden': 'true', title: t('Zeitalter: {name}', { name: tName('eras', ERAS[r.era]) }) }, symSvg(ERAS[r.era].ico)) : null
    );

    node.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = node.dataset.id;
      selectNode(id);
    });

    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = node.dataset.id;
        selectNode(id);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        navigateByArrow(e.key, node);
      }
    });

    nodesContainer.append(node);
    mapState.nodes.push({ el: node, id: r.id, def: r, coord });
  }

  // Überschrift des Konzernforschungs-Asts (erscheint mit dem Konzern-Reiter)
  mapState.branch = h('div', { class: 'corp-branch', style: '--x: -1900; --y: 120;', hidden: true },
    h('h2', {}, symSvg('corp', 'h-ico', 'prestige'), ' ' + t('Konzernforschung')), h('p', { text: t('Dauerhaft: bleibt bei Neuguss und Gründung') }));
  nodesContainer.append(mapState.branch);

  // Zusammenbau Container
  mapContainer.append(svg, nodesContainer);
  viewport.append(mapContainer);

  // Detailpanel
  const panel = h('div', { class: 'research-panel', hidden: true },
    h('div', { class: 'research-panel-header' },
      h('button', { class: 'research-panel-close', type: 'button', 'aria-label': t('Schließen') }, symSvg('close'))
    ),
    h('div', { class: 'research-panel-content' })
  );
  mapState.panel = { root: panel, header: panel.querySelector('.research-panel-header'), content: panel.querySelector('.research-panel-content'), close: panel.querySelector('.research-panel-close') };
  mapState.panel.close.addEventListener('click', () => closePanel());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mapState.selectedId) closePanel(); }, true);
  panel.addEventListener('mousedown', (e) => e.stopPropagation());  // Verhindern, dass Panel-Klicks die Karte pannen
  viewport.append(panel);

  // Controls
  const controls = h('div', { class: 'research-map-controls' },
    h('button', { class: 'zoom-btn zoom-in', type: 'button', 'aria-label': t('Vergrößern'), text: '+' }),
    h('button', { class: 'zoom-btn zoom-out', type: 'button', 'aria-label': t('Verkleinern'), text: '−' }),
    h('button', { class: 'zoom-btn zoom-fit', type: 'button', 'aria-label': t('An Größe anpassen'), text: t('Fit') })
  );

  // Event Listener für Pan und Zoom
  mapState.container = mapContainer;
  setupPanZoom(viewport, mapContainer);
  setupControls(controls, viewport, mapContainer);

  viewport.append(controls);
  container.append(viewport);

  // Startansicht: Geologie (0,0) liegt exakt in der Mitte des Viewports
  mapState.scale = START_SCALE; mapState.translateX = 0; mapState.translateY = 0;
  applyTransform(mapContainer);
  renderLines(svg);
  updateNodeStates();
}

function setupPanZoom(viewport, container) {
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let startTranslate = { x: 0, y: 0 };

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('.research-node, .zoom-btn')) return;
    e.preventDefault();   // kein natives Ziehen/Markieren, sonst geht mouseup verloren und die Karte "klebt"
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    startTranslate = { x: mapState.translateX, y: mapState.translateY };
    viewport.classList.add('panning');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    if (!(e.buttons & 1)) { stopPan(); return; }   // Taste wurde außerhalb losgelassen
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    mapState.translateX = startTranslate.x + dx;
    mapState.translateY = startTranslate.y + dy;
    applyTransform(container);
  });

  const stopPan = () => { isPanning = false; viewport.classList.remove('panning'); };
  document.addEventListener('mouseup', stopPan);
  window.addEventListener('blur', stopPan);
  viewport.addEventListener('dragstart', e => e.preventDefault());

  // Zoom mit Mausrad
  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;   // normales Scrollen bewegt die Seite; Strg + Rad zoomt die Karte
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2, my = e.clientY - rect.top - rect.height / 2;
    zoomAt(container, mapState.scale * factor, mx, my, mx, my, mapState.translateX, mapState.translateY, mapState.scale);
  }, { passive: false });

  // Arrow Keys für Pan
  document.addEventListener('keydown', (e) => {
    if (!viewport.contains(document.activeElement)) return;
    const step = 50 / mapState.scale;
    if (e.key === 'ArrowLeft') { mapState.translateX += step; applyTransform(container); }
    else if (e.key === 'ArrowRight') { mapState.translateX -= step; applyTransform(container); }
    else if (e.key === 'ArrowUp') { mapState.translateY += step; applyTransform(container); }
    else if (e.key === 'ArrowDown') { mapState.translateY -= step; applyTransform(container); }
  });

  // Touch: ein Finger verschiebt, zwei Finger zoomen um ihre Mitte. Bei jedem Fingerwechsel neu verankern (sonst springt die Karte).
  // Im Detailpanel und auf den Zoomknöpfen bleibt Touch nativ (Panel scrollt).
  let anchor = null;   // { x, y, dist, tx, ty, scale } relativ zur Viewport-Mitte
  const own = e => !e.target.closest('.research-panel, .research-map-controls');
  const touchInfo = (e) => {
    const r = viewport.getBoundingClientRect(), [a, b = a] = e.touches;
    return { x: (a.clientX + b.clientX) / 2 - r.left - r.width / 2, y: (a.clientY + b.clientY) / 2 - r.top - r.height / 2, dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
  };
  const reanchor = (e) => {
    anchor = e.touches.length && own(e) ? { ...touchInfo(e), tx: mapState.translateX, ty: mapState.translateY, scale: mapState.scale } : null;
    viewport.classList.toggle('panning', !!anchor);
  };
  viewport.addEventListener('touchstart', reanchor, { passive: true });
  viewport.addEventListener('touchend', reanchor);
  viewport.addEventListener('touchcancel', reanchor);
  viewport.addEventListener('touchmove', (e) => {
    if (!anchor) return;
    e.preventDefault();
    const cur = touchInfo(e);
    const scale = e.touches.length > 1 && anchor.dist > 0 ? anchor.scale * cur.dist / anchor.dist : anchor.scale;
    zoomAt(container, scale, anchor.x, anchor.y, cur.x, cur.y, anchor.tx, anchor.ty, anchor.scale);
  }, { passive: false });
}

/** Skaliert so, dass der Kartenpunkt, der bei (fromX, fromY) lag, danach bei (toX, toY) liegt (Viewport-Mitte = 0,0). */
function zoomAt(container, scale, fromX, fromY, toX, toY, tx, ty, oldScale) {
  const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  mapState.translateX = toX - (fromX - tx) * s / oldScale;
  mapState.translateY = toY - (fromY - ty) * s / oldScale;
  mapState.scale = s;
  applyTransform(container);
}

function setupControls(controls, viewport, container) {
  const zoomIn = controls.querySelector('.zoom-in');
  const zoomOut = controls.querySelector('.zoom-out');
  const zoomFit = controls.querySelector('.zoom-fit');

  // Knöpfe zoomen um die Mitte des Ausschnitts
  const zoomBy = f => zoomAt(container, mapState.scale * f, 0, 0, 0, 0, mapState.translateX, mapState.translateY, mapState.scale);
  zoomIn.addEventListener('click', () => zoomBy(ZOOM_STEP));
  zoomOut.addEventListener('click', () => zoomBy(1 / ZOOM_STEP));

  zoomFit.addEventListener('click', () => {
    centerOn(container, true);
  });
}

function navigateByArrow(key, currentNode) {
  const currentCoord = { x: Number(currentNode.dataset.x), y: Number(currentNode.dataset.y) };
  const candidates = [];

  for (const card of mapState.nodes) {
    if (!isRevealed('research', card.id)) continue;  // Nur sichtbare Knoten
    const coord = { x: card.coord.x, y: card.coord.y };
    let isInDirection = false;

    if (key === 'ArrowRight') isInDirection = coord.x > currentCoord.x;
    else if (key === 'ArrowLeft') isInDirection = coord.x < currentCoord.x;
    else if (key === 'ArrowDown') isInDirection = coord.y > currentCoord.y;
    else if (key === 'ArrowUp') isInDirection = coord.y < currentCoord.y;

    if (isInDirection) {
      const dist = Math.hypot(coord.x - currentCoord.x, coord.y - currentCoord.y);
      candidates.push({ node: card.el, dist, coord });
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => a.dist - b.dist);
    candidates[0].node.focus();
  }
}

function selectNode(id) {
  mapState.selectedId = id;
  // Alle Knoten deselektieren
  for (const card of mapState.nodes) {
    setClass(card.el, 'selected', card.id === id);
  }
  buildResearchPanel();
  mapState.panel.root.hidden = false;
}

function closePanel() {
  mapState.selectedId = null;
  for (const card of mapState.nodes) {
    setClass(card.el, 'selected', false);
  }
  mapState.panel.root.hidden = true;
}

function buildResearchPanel() {
  if (!mapState.selectedId || !mapState.panel) return;
  const id = mapState.selectedId;
  const def = RESEARCH_MAP[id];
  const done = levelOf('research', id) > 0;
  const lock = lockReason('research', id);
  const pending = pendingOf('research', id);
  const plan = bulkPlan('research', id, 1);

  const content = mapState.panel.content;
  clear(content);
  const refs = mapState.refs = { costs: [], btn: null, progText: null, progFill: null, reason: null };
  mapState.panelKey = panelKey(id);

  // Icon + Name
  const name = h('div', { class: 'panel-name-row' },
    h('span', { class: 'panel-icon', 'aria-hidden': 'true', text: def.sym ? null : def.icon }, def.sym ? symSvg(def.sym) : null),
    h('h2', { class: 'panel-title', text: tName('research', def) })
  );
  content.append(name);

  // Status
  const statusText = done ? t('Erledigt') : pending ? (pending.running ? t('Läuft') : t('In Warteschlange')) : lock ? t('Gesperrt') : t('Verfügbar');
  const statusEl = h('p', { class: 'panel-status' + (done ? ' done' : pending ? ' pending' : lock ? ' locked' : ' available'), text: t('Status: {status}', { status: statusText }) });
  content.append(statusEl);

  if (def.era) {
    const ok = eraIndex() >= def.era;
    content.append(h('p', { class: 'panel-era' + (ok ? ' ok' : ' bad') }, symSvg(ERAS[def.era].ico, 'era-sym'), `${t('Zeitalter: {name}', { name: tName('eras', ERAS[def.era]) })} ${ok ? t('(erreicht)') : !industryUnlocked() ? t('(nach dem ersten Neuguss)') : t('(ab {ore} Erz gesamt)', { ore: fmt(ERAS[def.era].at) })}`));
  }

  if (def.corp) {
    content.append(h('p', { class: 'panel-corp' }, corpPill(def.corp), ' ' + (done ? t('Dauerhaft: bleibt bei Neuguss und Gründung') : t('Konzernforschung · dauerhaft')))); 
  }

  // Beschreibung
  if (def.desc) {
    content.append(h('p', { class: 'panel-desc', text: tDesc('research', def) }));
  }

  // Kosten (wenn nicht erledigt)
  if (!done) {
    const costDiv = h('div', { class: 'panel-costs' });
    const cost = plan.cost || {};
    refs.costs = [];
    costDiv.append(h('span', { class: 'cost-title', text: t('Kosten:') }));
    for (const [res, amt] of Object.entries(cost)) {
      const row = h('span', { class: 'panel-cost-row' },
        h('span', { class: 'cost-label' }, imgFor(RES[res]) ? h('img', { class: 'cost-ico', src: imgFor(RES[res]), alt: '', draggable: 'false' }) : (RES[res]?.icon || '') + ' ', RES[res] ? tName('resources', RES[res]) : res),
        h('span', { class: 'cost-amount', text: fmt(amt) }));
      refs.costs.push({ res, amt, row });
      costDiv.append(row);
    }
    if (refs.costs.length) content.append(costDiv);
  }

  // Dauer (wenn nicht erledigt)
  if (!done) {
    const dur = duration('research', id);
    const durationEl = h('p', { class: 'panel-duration', text: t('Dauer: {time}', { time: fmtClock(dur) }) });
    content.append(durationEl);
  }

  // Fehlende Voraussetzungen
  if (lock && !done) {
    content.append(h('p', { class: 'panel-lock', text: lock }));
    for (const x of extraLocks(def, lock)) content.append(h('p', { class: 'panel-lock', text: x }));
  }

  // Fortschritt bei laufender Forschung
  if (pending) {
    refs.progText = h('p', { class: 'panel-progress' });
    refs.progFill = h('div', { class: 'panel-progress-fill' });
    content.append(refs.progText, h('div', { class: 'panel-progress-bar' }, refs.progFill));
  }

  // Button "Erforschen"
  if (!done && !pending) {
    const button = h('button', { class: 'panel-btn', type: 'button', text: t('Erforschen') });
    button.addEventListener('click', () => { buy('research', id, 1); updateResearchPanel(); });
    refs.btn = button;
    refs.reason = h('p', { class: 'panel-reason' });
    content.append(button, refs.reason);
  }

  // Bei laufender/wartender Forschung Button zum Abbrechen (später)
}

/** Weitere Sperrgründe neben dem ersten (max. 3 zusammen): Zeitalter und Konzernstufe. */
function extraLocks(def, first) {
  const out = [];
  if (def.era > eraIndex() && industryUnlocked()) out.push(t('Benötigt Zeitalter: {name}', { name: tName('eras', ERAS[def.era]) }));
  if (def.corp > corpStage()) out.push(t('Benötigt Konzernstufe: K{n}', { n: def.corp }));
  return out.filter(x => x !== first).slice(0, 2);
}

/** Zeigt den Konzernforschungs-Ast: Mitte der erforschbaren Konzernknoten (sonst aller sichtbaren), lesbare Skalierung. Nach dem Wechsel in den Forschungs-Reiter aufrufen. */
export function focusCorpBranch() {
  const shown = mapState.nodes.filter(n => n.def.corp && isRevealed('research', n.id));
  const open = shown.filter(n => !levelOf('research', n.id) && !lockReason('research', n.id));
  const pts = (open.length ? open : shown).map(n => n.coord);
  if (!pts.length || !mapState.container) return;
  const cx = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2, cy = (Math.min(...pts.map(p => p.y)) + Math.max(...pts.map(p => p.y))) / 2;
  mapState.scale = Math.max(mapState.scale, 0.6);
  mapState.translateX = -cx * mapState.scale; mapState.translateY = -cy * mapState.scale;
  applyTransform(mapState.container);
}

function applyTransform(container) {
  container.style.transform = `translate(${mapState.translateX}px, ${mapState.translateY}px) scale(${mapState.scale})`;
  container.classList.toggle('compact', mapState.scale < LABEL_MIN_SCALE);
}

/**
 * Passt den Ausschnitt an die sichtbaren Knoten an. Passt alles bei START_SCALE um Geologie (0,0) herum in den
 * Viewport, bleibt Geologie in der Mitte; sonst wird die Bounding Box der sichtbaren Knoten eingepasst.
 * Gibt false zurück, wenn der Viewport gerade keine Größe hat (Tab verborgen).
 * Auf schmalen Bildschirmen wäre das Einpassen unlesbar klein: dann (außer bei "Fit") die erforschbaren Knoten in lesbarer Größe zeigen.
 */
function centerOn(container, overview = false) {
  let minX = 0, maxX = 0, minY = 0, maxY = 0;   // (0,0) = Geologie liegt immer im Ausschnitt
  for (const card of mapState.nodes) {
    if (!isRevealed('research', card.id)) continue;
    minX = Math.min(minX, card.coord.x); maxX = Math.max(maxX, card.coord.x);
    minY = Math.min(minY, card.coord.y); maxY = Math.max(maxY, card.coord.y);
  }
  const viewport = container.parentElement;
  const vw = viewport.offsetWidth, vh = viewport.offsetHeight;
  if (vw <= 0 || vh <= 0) return false;
  // Rand: Beschriftung (unter dem Knoten) und Steuerknöpfe (oben rechts); ohne Beschriftung (kompakt) deutlich weniger
  const fitFor = (padX, padTop, padBottom) => {
    const needW = Math.max(maxX - minX, 1) + padX * 2, needH = Math.max(maxY - minY, 1) + padTop + padBottom;
    return { padTop, padBottom, scale: Math.min(vw / needW, vh / needH) };
  };
  const symW = Math.max(maxX, -minX) * 2 + (NODE_R + 90) * 2, symH = Math.max(maxY, -minY) * 2 + (NODE_R + 40) + (NODE_R + 70);
  if (Math.min(vw / symW, vh / symH) >= START_SCALE) {
    mapState.scale = START_SCALE; mapState.translateX = 0; mapState.translateY = 0;   // Geologie mittig
  } else {
    let f = fitFor(NODE_R + 90, NODE_R + 40, NODE_R + 70);
    if (f.scale < LABEL_MIN_SCALE) f = fitFor(NODE_R + 30, NODE_R + 60, NODE_R + 30);   // kompakt: keine Labels, Platz für Steuerknöpfe oben
    if (!overview && f.scale < MOBILE_SCALE && vw < 641) {
      const shown = mapState.nodes.filter(n => isRevealed('research', n.id));
      const open = shown.filter(n => !levelOf('research', n.id) && !lockReason('research', n.id));
      const pts = (open.length ? open : shown).map(n => n.coord);
      mapState.scale = MOBILE_SCALE;
      mapState.translateX = -(pts.reduce((s, p) => s + p.x, 0) / pts.length) * MOBILE_SCALE;
      mapState.translateY = -(pts.reduce((s, p) => s + p.y, 0) / pts.length) * MOBILE_SCALE;
      applyTransform(container);
      return true;
    }
    mapState.scale = Math.max(MIN_SCALE, Math.min(START_SCALE, f.scale));
    mapState.translateX = -((minX + maxX) / 2) * mapState.scale;
    mapState.translateY = -((minY + maxY) / 2 + (f.padBottom - f.padTop) / 2) * mapState.scale;
  }
  applyTransform(container);
  return true;
}

function renderLines(svg) {
  const linesGroup = svg.querySelector('.lines-group');
  clear(linesGroup);

  for (const r of RESEARCH) {
    if (!r.req || !r.req.length) continue;

    const toCoord = RESEARCH_COORDS[r.id];
    if (!toCoord) continue;

    for (const reqId of r.req) {
      const fromCoord = RESEARCH_COORDS[reqId];
      if (!fromCoord) continue;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      // Linie endet am Knotenrand, damit die Pfeilspitze sichtbar bleibt
      const dx = toCoord.x - fromCoord.x, dy = toCoord.y - fromCoord.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      line.setAttribute('x1', String(fromCoord.x + ux * NODE_R));
      line.setAttribute('y1', String(fromCoord.y + uy * NODE_R));
      line.setAttribute('x2', String(toCoord.x - ux * (NODE_R + 6)));
      line.setAttribute('y2', String(toCoord.y - uy * (NODE_R + 6)));
      line.setAttribute('data-from', reqId);
      line.setAttribute('data-to', r.id);
      line.setAttribute('class', 'req-line locked');
      line.style.display = 'none';   // erst updateLinesState blendet passende Linien ein

      linesGroup.append(line);
    }
  }
}

/**
 * Aktualisiert die Knoten-Zustände (locked/available/pending/done, sichtbar/verborgen).
 * Wird aufgerufen nach buy, timer:done, loaded, tab events.
 */
export function updateNodeStates() {
  const svg = document.querySelector('.research-lines');
  if (mapState.branch) mapState.branch.hidden = !corpTabVisible();

  for (const card of mapState.nodes) {
    const { el, id, def } = card;
    const revealed = isRevealed('research', id);
    const done = levelOf('research', id) > 0;
    const lock = lockReason('research', id);
    const pending = pendingOf('research', id);

    // Gestaffelte Sichtbarkeit
    el.hidden = !revealed;

    if (revealed) {
      setClass(el, 'locked', !!lock && !done);
      setClass(el, 'available', !lock && !done && !pending);
      setClass(el, 'pending', !!pending);
      setClass(el, 'done', done);
      setClass(el, 'disabled', !!lock && !done);

      // Badge Icon
      const badge = el.querySelector('.node-badge');
      if (badge) {
        const kind = done ? 'done' : pending ? 'pending' : lock ? 'locked' : 'available';
        if (badge._k !== kind) {
          badge._k = kind;
          badge.replaceChildren(kind === 'done' ? svgUse('check') : kind === 'pending' ? symSvg('hourglass') : kind === 'locked' ? svgUse('lock') : symSvg('target'));
        }
      }

      // ARIA Label
      let state = done ? t('erledigt') : pending ? t('läuft') : lock ? t('gesperrt') : t('verfügbar');
      let ariaLabel = t('{name}. Status: {status}', { name: tName('research', def), status: state });
      if (lock && !done && !pending) ariaLabel += `. ${lock}`;
      if (pending) ariaLabel += `. ${pending.running ? t('Läuft') : t('Wartet')}`;
      setAttr(el, 'aria-label', ariaLabel);
      setAttr(el, 'aria-disabled', lock && !done ? 'true' : 'false');
    }
  }

  // Ausschnitt wächst mit: nur wenn neue Knoten sichtbar wurden (manuelles Verschieben bleibt sonst erhalten)
  const visibleCount = mapState.nodes.filter(n => isRevealed('research', n.id)).length;
  if (visibleCount !== mapState.visibleCount && mapState.container && centerOn(mapState.container)) mapState.visibleCount = visibleCount;

  // Update Linien-Zustände
  if (svg) {
    updateLinesState(svg);
  }

  // Update Panel wenn offen
  if (mapState.selectedId && mapState.panel && !mapState.panel.root.hidden) {
    updateResearchPanel();
  }
}

const panelKey = id => `${levelOf('research', id) > 0}|${!!pendingOf('research', id)}|${lockReason('research', id)}`;

/** Aktualisiert das Detailpanel live (Kosten, Button, Fortschritt); baut es nur bei Statuswechsel neu. Läuft ~10x/s. */
export function updateResearchPanel() {
  if (!mapState.selectedId || !mapState.panel || mapState.panel.root.hidden) return;
  const id = mapState.selectedId;
  if (mapState.panelKey !== panelKey(id)) { buildResearchPanel(); return; }
  const r = mapState.refs;
  for (const c of r.costs) setClass(c.row, 'short', (state.res[c.res] || 0) < c.amt);
  if (r.btn) {
    const lock = lockReason('research', id), ok = !lock && bulkPlan('research', id, 1).affordable;
    r.btn.disabled = !ok;
    setText(r.reason, lock ? lock : ok ? '' : t('Zu wenige Ressourcen'));
  }
  const p = pendingOf('research', id);
  if (p && r.progText) {
    const e = p.entry, prog = p.running && e.total > 0 ? Math.max(0, Math.min(1, 1 - e.left / e.total)) : 0;
    setText(r.progText, p.running ? t('Fortschritt: {pct} % · noch {time}', { pct: Math.round(prog * 100), time: fmtClock(Math.max(e.left, 0)) }) : t('Wartet in der Warteschlange'));
    r.progFill.style.setProperty('--p', prog.toFixed(3));
  }
}

function updateLinesState(svg) {
  const lines = svg.querySelectorAll('.req-line');

  for (const line of lines) {
    const fromId = line.dataset.from;
    const toId = line.dataset.to;

    // Linien nur anzeigen, wenn beide Endpunkte sichtbar sind
    const fromRevealed = isRevealed('research', fromId);
    const toRevealed = isRevealed('research', toId);
    const show = fromRevealed && toRevealed;
    line.style.display = show ? '' : 'none';   // SVG kennt kein hidden-Attribut

    if (show) {
      const toDone = levelOf('research', toId) > 0;
      const toLock = lockReason('research', toId);
      const toPending = pendingOf('research', toId);

      const fromDone = levelOf('research', fromId) > 0;
      const fromPending = pendingOf('research', fromId);

      let lineClass = 'req-line';
      if (toDone) lineClass += ' done';
      else if (fromPending || toPending) lineClass += ' pending';
      else if (toLock) lineClass += ' locked';
      else lineClass += ' available';

      line.setAttribute('class', lineClass);
    }
  }
}
