// Interaktive Research Skilltree Map mit Pan, Zoom und Keyboard Navigation
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { RESEARCH_COORDS, MIN_NODE_DISTANCE } from '../data/research-layout.js';
import { levelOf, lockReason, pendingOf, isRevealed, bulkPlan, duration, eraIndex } from '../core/formulas.js';
import { fmtClock, fmt } from '../core/format.js';
import { state } from '../core/state.js';
import { RES } from '../data/resources.js';
import { ERAS } from '../data/eras.js';
import { buy } from '../systems/production.js';
import { h, $, clear, setText, setClass, setAttr } from './dom.js';

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

const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.15;
const NODE_R = 48;        // Knotenradius (96 px / 2 + Rand)
const START_SCALE = 0.9;  // Startansicht: Geologie in der Mitte, erste Knoten lesbar

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
        'aria-label': r.name,
      },
      h('span', { class: 'node-ico', 'aria-hidden': 'true', text: r.icon }),
      h('span', { class: 'node-label', text: r.name }),
      h('span', { class: 'node-badge', 'aria-hidden': 'true' }),
      r.era ? h('span', { class: 'node-era', 'aria-hidden': 'true', title: 'Zeitalter: ' + ERAS[r.era].name, text: ERAS[r.era].sym }) : null
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

  // Zusammenbau Container
  mapContainer.append(svg, nodesContainer);
  viewport.append(mapContainer);

  // Detailpanel
  const panel = h('div', { class: 'research-panel', hidden: true },
    h('div', { class: 'research-panel-header' },
      h('button', { class: 'research-panel-close', type: 'button', 'aria-label': 'Schließen', text: '✕' })
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
    h('button', { class: 'zoom-btn zoom-in', type: 'button', 'aria-label': 'Vergrößern', text: '+' }),
    h('button', { class: 'zoom-btn zoom-out', type: 'button', 'aria-label': 'Verkleinern', text: '−' }),
    h('button', { class: 'zoom-btn zoom-fit', type: 'button', 'aria-label': 'An Größe anpassen', text: 'Fit' })
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
    if (e.target.closest('.research-node, .zoom-btn')) return;
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    startTranslate = { x: mapState.translateX, y: mapState.translateY };
    viewport.classList.add('panning');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    mapState.translateX = startTranslate.x + dx;
    mapState.translateY = startTranslate.y + dy;
    applyTransform(container);
  });

  document.addEventListener('mouseup', () => {
    isPanning = false;
    viewport.classList.remove('panning');
  });

  // Zoom mit Mausrad
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const oldScale = mapState.scale;
    const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    mapState.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * factor));

    // Zoom um Mausposition
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // Berechne neue Translation, um um die Mausposition zu zoomen
    const scaleDiff = mapState.scale - oldScale;
    mapState.translateX -= mouseX * scaleDiff / oldScale;
    mapState.translateY -= mouseY * scaleDiff / oldScale;

    applyTransform(container);
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

  // Touch Pan und Pinch Zoom
  let touchStart = { x: 0, y: 0 };
  let touchStartTranslate = { x: 0, y: 0 };
  let touchStartDistance = 0;
  let touchStartScale = 0;

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStartTranslate = { x: mapState.translateX, y: mapState.translateY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistance = Math.sqrt(dx * dx + dy * dy);
      touchStartScale = mapState.scale;
    }
  });

  viewport.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStart.x;
      const dy = e.touches[0].clientY - touchStart.y;
      mapState.translateX = touchStartTranslate.x + dx;
      mapState.translateY = touchStartTranslate.y + dy;
      applyTransform(container);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const factor = distance / touchStartDistance;
      mapState.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchStartScale * factor));
      applyTransform(container);
    }
  }, { passive: false });
}

function setupControls(controls, viewport, container) {
  const zoomIn = controls.querySelector('.zoom-in');
  const zoomOut = controls.querySelector('.zoom-out');
  const zoomFit = controls.querySelector('.zoom-fit');

  zoomIn.addEventListener('click', () => {
    mapState.scale = Math.min(MAX_SCALE, mapState.scale * ZOOM_STEP);
    applyTransform(container);
  });

  zoomOut.addEventListener('click', () => {
    mapState.scale = Math.max(MIN_SCALE, mapState.scale / ZOOM_STEP);
    applyTransform(container);
  });

  zoomFit.addEventListener('click', () => {
    centerOn(container);
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
  const refs = mapState.refs = { costs: [], btn: null, progText: null, progFill: null };
  mapState.panelKey = panelKey(id);

  // Icon + Name
  const name = h('div', { class: 'panel-name-row' },
    h('span', { class: 'panel-icon', text: def.icon }),
    h('h2', { class: 'panel-title', text: def.name })
  );
  content.append(name);

  // Status
  const statusText = done ? 'Erledigt' : pending ? (pending.running ? 'Läuft' : 'In Warteschlange') : lock ? 'Gesperrt' : 'Verfügbar';
  const statusEl = h('p', { class: 'panel-status' + (done ? ' done' : pending ? ' pending' : lock ? ' locked' : ' available'), text: 'Status: ' + statusText });
  content.append(statusEl);

  if (def.era) {
    const ok = eraIndex() >= def.era;
    content.append(h('p', { class: 'panel-era' + (ok ? ' ok' : ' bad'), text: `${ERAS[def.era].sym} Zeitalter: ${ERAS[def.era].name}${ok ? ' (erreicht)' : ` (ab ${fmt(ERAS[def.era].at)} Erz gesamt)`}` }));
  }

  // Beschreibung
  if (def.desc) {
    content.append(h('p', { class: 'panel-desc', text: def.desc }));
  }

  // Kosten (wenn nicht erledigt)
  if (!done) {
    const costDiv = h('div', { class: 'panel-costs' });
    const cost = plan.cost || {};
    refs.costs = [];
    costDiv.append(h('span', { class: 'cost-title', text: 'Kosten:' }));
    for (const [res, amt] of Object.entries(cost)) {
      const row = h('span', { class: 'panel-cost-row' },
        h('span', { class: 'cost-label', text: (RES[res]?.icon || '') + ' ' + (RES[res]?.name || res) }),
        h('span', { class: 'cost-amount', text: fmt(amt) }));
      refs.costs.push({ res, amt, row });
      costDiv.append(row);
    }
    if (refs.costs.length) content.append(costDiv);
  }

  // Dauer (wenn nicht erledigt)
  if (!done) {
    const dur = duration('research', id);
    const durationEl = h('p', { class: 'panel-duration', text: 'Dauer: ' + fmtClock(dur) });
    content.append(durationEl);
  }

  // Fehlende Voraussetzungen
  if (lock && !done) {
    const lockEl = h('p', { class: 'panel-lock', text: lock });
    content.append(lockEl);
  }

  // Fortschritt bei laufender Forschung
  if (pending) {
    refs.progText = h('p', { class: 'panel-progress' });
    refs.progFill = h('div', { class: 'panel-progress-fill' });
    content.append(refs.progText, h('div', { class: 'panel-progress-bar' }, refs.progFill));
  }

  // Button "Erforschen"
  if (!done && !pending) {
    const button = h('button', { class: 'panel-btn', type: 'button', text: 'Erforschen' });
    button.addEventListener('click', () => { buy('research', id, 1); updateResearchPanel(); });
    refs.btn = button;
    refs.reason = h('p', { class: 'panel-reason' });
    content.append(button, refs.reason);
  }

  // Bei laufender/wartender Forschung Button zum Abbrechen (später)
}

function applyTransform(container) {
  container.style.transform = `translate(${mapState.translateX}px, ${mapState.translateY}px) scale(${mapState.scale})`;
}

/**
 * Passt den Ausschnitt an die sichtbaren Knoten an. Passt alles bei START_SCALE um Geologie (0,0) herum in den
 * Viewport, bleibt Geologie in der Mitte; sonst wird die Bounding Box der sichtbaren Knoten eingepasst.
 * Gibt false zurück, wenn der Viewport gerade keine Größe hat (Tab verborgen).
 */
function centerOn(container) {
  let minX = 0, maxX = 0, minY = 0, maxY = 0;   // (0,0) = Geologie liegt immer im Ausschnitt
  for (const card of mapState.nodes) {
    if (!isRevealed('research', card.id)) continue;
    minX = Math.min(minX, card.coord.x); maxX = Math.max(maxX, card.coord.x);
    minY = Math.min(minY, card.coord.y); maxY = Math.max(maxY, card.coord.y);
  }
  const viewport = container.parentElement;
  const vw = viewport.offsetWidth, vh = viewport.offsetHeight;
  if (vw <= 0 || vh <= 0) return false;
  const padX = NODE_R + 90, padTop = NODE_R + 40, padBottom = NODE_R + 70;   // Platz für Beschriftung und Steuerknöpfe
  const needW = Math.max(maxX - minX, 1) + padX * 2, needH = Math.max(maxY - minY, 1) + padTop + padBottom;
  const symW = Math.max(maxX, -minX) * 2 + padX * 2, symH = Math.max(maxY, -minY) * 2 + padTop + padBottom;
  if (Math.min(vw / symW, vh / symH) >= START_SCALE) {
    mapState.scale = START_SCALE; mapState.translateX = 0; mapState.translateY = 0;   // Geologie mittig
  } else {
    mapState.scale = Math.max(MIN_SCALE, Math.min(START_SCALE, vw / needW, vh / needH));
    mapState.translateX = -((minX + maxX) / 2) * mapState.scale;
    mapState.translateY = -((minY + maxY) / 2 + (padTop - padBottom) / 2) * mapState.scale;
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
      line.setAttribute('x1', fromCoord.x + ux * NODE_R);
      line.setAttribute('y1', fromCoord.y + uy * NODE_R);
      line.setAttribute('x2', toCoord.x - ux * (NODE_R + 6));
      line.setAttribute('y2', toCoord.y - uy * (NODE_R + 6));
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
        let badgeText = '';
        if (done) badgeText = '✓';
        else if (pending) badgeText = '⏳';
        else if (lock) badgeText = '🔒';
        else badgeText = '🎯';
        setText(badge, badgeText);
      }

      // ARIA Label
      let state = done ? 'erledigt' : pending ? 'läuft' : lock ? 'gesperrt' : 'verfügbar';
      let ariaLabel = `${def.name}. Status: ${state}`;
      if (lock && !done && !pending) ariaLabel += `. ${lock}`;
      if (pending) ariaLabel += `. ${pending.running ? 'Läuft' : 'Wartet'}`;
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
    setText(r.reason, lock ? lock : ok ? '' : 'Zu wenige Ressourcen');
  }
  const p = pendingOf('research', id);
  if (p && r.progText) {
    const e = p.entry, prog = p.running && e.total > 0 ? Math.max(0, Math.min(1, 1 - e.left / e.total)) : 0;
    setText(r.progText, p.running ? `Fortschritt: ${Math.round(prog * 100)} % · noch ${fmtClock(Math.max(e.left, 0))}` : 'Wartet in der Warteschlange');
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
