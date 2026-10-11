// Canvas-Diagramme: Sparklines (Sidebar) und Verlaufsdiagramm (Statistik).
import { RES, RES_IDS } from '../data/resources.js';
import { fmt } from '../core/format.js';

const SPARK_POINTS = 60;   // 1 Wert pro Sekunde
const HIST_POINTS = 180;   // 1 Wert pro 5 Sekunden = 15 Minuten
export const spark = Object.fromEntries(RES_IDS.map(k => [k, Array(SPARK_POINTS).fill(0)]));
export const hist = Object.fromEntries(RES_IDS.map(k => [k, []]));
let histAcc = 0;

/** Wird 1x pro Sekunde mit den aktuellen Raten aufgerufen. */
export function sample(r) {
  for (const k of RES_IDS) {
    spark[k].push(Math.max(0, r[k])); spark[k].shift();
  }
  if (++histAcc >= 5) {
    histAcc = 0;
    for (const k of RES_IDS) { hist[k].push(Math.max(0, r[k])); if (hist[k].length > HIST_POINTS) hist[k].shift(); }
  }
}

export function resetHistory() {
  for (const k of RES_IDS) { spark[k].fill(0); hist[k].length = 0; }
}

function prepare(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), hgt = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, hgt);
  return { ctx, w, h: hgt, dpr };
}

export function drawSparkline(canvas, values, color) {
  const { ctx, w, h, dpr } = prepare(canvas);
  const max = Math.max(...values, 1e-9), step = w / (values.length - 1);
  const y = v => h - 2 * dpr - (v / max) * (h - 4 * dpr);
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(i * step, y(v)) : ctx.moveTo(0, y(v))));
  ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = color + '33'; ctx.fill();
}

/** Verlaufsdiagramm aller Ressourcen; logarithmische Skala, damit Größenordnungen vergleichbar bleiben. */
export function drawHistory(canvas) {
  const { ctx, w, h, dpr } = prepare(canvas);
  const padL = 46 * dpr, padB = 16 * dpr, padT = 8 * dpr, padR = 8 * dpr;
  const pw = w - padL - padR, ph = h - padT - padB;
  const lg = v => Math.log10(1 + v);
  let max = 0;
  for (const k of RES_IDS) for (const v of hist[k]) max = Math.max(max, lg(v));
  max = Math.max(max, 1);
  const cs = getComputedStyle(canvas);
  const grid = cs.getPropertyValue('--chart-grid').trim() || '#334155';
  const text = cs.getPropertyValue('--chart-text').trim() || '#94a3b8';
  ctx.font = `${10 * dpr}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1 * dpr;
  for (let i = 0; i <= 4; i++) {
    const yy = padT + ph - (i / 4) * ph;
    ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
    ctx.fillStyle = text; ctx.textAlign = 'right';
    ctx.fillText(fmt(10 ** ((i / 4) * max) - 1) + '/s', padL - 4 * dpr, yy);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = text;
  ctx.fillText('vor 15 min', padL + 20 * dpr, h - 3 * dpr);
  ctx.fillText('jetzt', w - padR - 12 * dpr, h - 3 * dpr);
  for (const k of RES_IDS) {
    const vals = hist[k];
    if (vals.length < 2) continue;
    const step = pw / (HIST_POINTS - 1), x0 = padL + pw - (vals.length - 1) * step;
    ctx.beginPath();
    vals.forEach((v, i) => { const x = x0 + i * step, y = padT + ph - (lg(v) / max) * ph; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = RES[k].color; ctx.lineWidth = 2 * dpr; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
