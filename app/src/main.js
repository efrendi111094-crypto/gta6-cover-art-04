// Vice Coast Cover Studio 4 — editor wiring.
// Owns the app state, builds the controls, handles drag-crop and zoom on the
// preview, exports PNGs, and runs the built-in smoke tests (?test=1) and the
// screenshot scenes (?shot=cover / ?shot=editor). All photos stay local.
import {
  COVER_SIZES,
  SAMPLE_PHOTOS,
  GRADES,
  LAYOUTS,
  ENHANCE_PRESETS,
  defaultState,
  layoutPanelRects,
  renderCover,
  renderExportCanvas,
  clearPanelCache,
} from './cover.js';

// ---------------------------------------------------------------- page errors

/** Every uncaught error or rejection lands here; the smoke tests read it. */
window.__pageErrors = [];
window.addEventListener('error', (event) => {
  window.__pageErrors.push(`error: ${event.message}`);
});
window.addEventListener('unhandledrejection', (event) => {
  window.__pageErrors.push(`rejection: ${event.reason}`);
});

// ---------------------------------------------------------------- state

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') || '';
const state = defaultState();
let selectedPanel = 0;
let compareMode = false;
let photosReady = false;

/** The photo library: samples plus the user's uploads, keyed by id. */
const library = [];
const photoMap = () => {
  const map = {};
  for (const entry of library) map[entry.key] = { key: entry.key, img: entry.img };
  return map;
};

/** Loads one image from a URL. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Builds the panel list for a layout, keeping photos where they already are. */
function buildPanelsForLayout(layoutId, previous = []) {
  const count = LAYOUTS[layoutId].rects.length;
  const used = new Set(previous.slice(0, count).map((p) => p.photo));
  const panels = [];
  for (let i = 0; i < count; i++) {
    if (previous[i]) {
      panels.push(previous[i]);
      continue;
    }
    // Next sample photo not already on the cover (people first, in tray order).
    const next = SAMPLE_PHOTOS.find((s) => !used.has(s.id)) || SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length];
    used.add(next.id);
    panels.push({ photo: next.id, fx: 0, fy: 0, zoom: 1, grade: null });
  }
  return panels;
}

/** Assigns a different sample photo to every panel, in tray order. */
function assignSamplePhotos() {
  const count = LAYOUTS[state.layout].rects.length;
  const panels = [];
  for (let i = 0; i < count; i++) {
    const sample = SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length];
    panels.push({ photo: sample.id, fx: 0, fy: 0, zoom: 1, grade: null });
  }
  state.panels = panels;
  state.spanPhoto = null;
}

// ---------------------------------------------------------------- elements

const $ = (id) => document.getElementById(id);
const canvas = $('cover-canvas');
const statusEl = $('status');
const photoTray = $('photo-tray');

function setStatus(text) {
  statusEl.textContent = text;
}

// ---------------------------------------------------------------- preview

/** Sizes the preview canvas for the current export size (or the viewport in shot mode). */
function sizePreviewCanvas() {
  if (shotMode === 'cover') {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    return;
  }
  const size = COVER_SIZES[state.size];
  const scale = Math.min(960 / size.width, 960 / size.height);
  canvas.width = Math.round(size.width * scale);
  canvas.height = Math.round(size.height * scale);
}

let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

/** Renders the cover into the preview canvas, plus the selection outline. */
function renderPreview() {
  sizePreviewCanvas();
  renderCover(canvas, state, photoMap(), { compare: compareMode });
  if (shotMode !== 'cover' && !compareMode) drawSelectionOutline();
  markReady();
}

/** A dashed yellow outline around the selected panel. */
function drawSelectionOutline() {
  const rects = layoutPanelRects(state.layout, canvas.width, canvas.height);
  const rect = rects[selectedPanel];
  if (!rect) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#ffd400';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  ctx.restore();
}

let readyMarked = false;
function markReady() {
  if (readyMarked) return;
  readyMarked = true;
  const marker = $('shot-status');
  marker.dataset.ready = 'yes';
  marker.textContent = 'ready';
  window.__coverReady = true;
}

// ---------------------------------------------------------------- controls

/** Builds the layout picker buttons. */
function buildLayoutButtons() {
  const wrap = $('layout-buttons');
  Object.entries(LAYOUTS).forEach(([id, layout], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = layout.name;
    button.dataset.layout = id;
    button.title = `Layout ${index + 1}: ${layout.name}`;
    if (id === state.layout) button.classList.add('active');
    button.addEventListener('click', () => setLayout(id));
    wrap.appendChild(button);
  });
}

/** Builds the grade picker buttons. */
function buildGradeButtons() {
  const wrap = $('grade-buttons');
  Object.entries(GRADES).forEach(([id, grade]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = grade.name;
    button.dataset.grade = id;
    if (id === state.grade) button.classList.add('active');
    button.addEventListener('click', () => setGrade(id));
    wrap.appendChild(button);
  });
}

/** Builds the five Enhance sliders. */
function buildEnhanceSliders() {
  const defs = [
    ['brightness', 'Brightness', -50, 50],
    ['contrast', 'Contrast', -30, 60],
    ['saturation', 'Saturation', -40, 80],
    ['sharpness', 'Sharpness', 0, 100],
    ['warmth', 'Warmth', -50, 50],
  ];
  const wrap = $('enhance-sliders');
  for (const [key, label, min, max] of defs) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = `enhance-${key}`;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `enhance-${key}`;
    input.min = min;
    input.max = max;
    input.step = 1;
    input.value = state.enhance[key];
    const output = document.createElement('output');
    output.textContent = state.enhance[key];
    input.addEventListener('input', () => {
      state.enhance[key] = Number(input.value);
      output.textContent = input.value;
      requestRender();
    });
    row.append(labelEl, input, output);
    wrap.appendChild(row);
  }
}

/** Syncs the Enhance sliders with the state (after a preset). */
function syncEnhanceSliders() {
  for (const key of ['brightness', 'contrast', 'saturation', 'sharpness', 'warmth']) {
    const input = $(`enhance-${key}`);
    if (!input) continue;
    input.value = state.enhance[key];
    input.parentElement.querySelector('output').textContent = state.enhance[key];
  }
}

/** Builds the poster-layer toggles. */
function buildDecorationToggles() {
  const defs = [
    ['sun', 'Retro sun'], ['sunburst', 'Sunburst rays'],
    ['skyline', 'Skyline & palms'], ['speedlines', 'Speed lines'],
    ['halftone', 'Halftone dots'], ['grain', 'Film grain'],
    ['vignette', 'Vignette'], ['sticker', 'Starburst sticker'],
    ['ribbon', 'Corner ribbon'], ['heatpill', 'Heat pill'],
  ];
  const wrap = $('decoration-toggles');
  for (const [key, label] of defs) {
    const labelEl = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!state.decorations[key];
    input.dataset.decoration = key;
    input.addEventListener('change', () => {
      state.decorations[key] = input.checked;
      requestRender();
    });
    labelEl.append(input, document.createTextNode(label));
    wrap.appendChild(labelEl);
  }
}

/** Builds the photo tray thumbnails. */
function buildPhotoTray() {
  photoTray.innerHTML = '';
  for (const entry of library) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = entry.label;
    button.setAttribute('role', 'option');
    const img = document.createElement('img');
    img.src = entry.url;
    img.alt = entry.label;
    button.appendChild(img);
    button.addEventListener('click', () => assignPhotoToSelectedPanel(entry.key));
    photoTray.appendChild(button);
  }
  syncPhotoTray();
}

/** Marks the selected panel's photo and the photos already on the cover. */
function syncPhotoTray() {
  const inUse = new Set(state.panels.map((p) => p.photo));
  if (state.spanPhoto) inUse.add(state.spanPhoto);
  const current = state.panels[selectedPanel] ? state.panels[selectedPanel].photo : null;
  [...photoTray.children].forEach((button, i) => {
    const entry = library[i];
    button.classList.toggle('selected', entry.key === current && !state.spanPhoto);
    button.classList.toggle('in-use', inUse.has(entry.key));
  });
}

/** Builds the per-panel grade dropdown. */
function buildPanelGradeSelect() {
  const select = $('panel-grade-select');
  const global = document.createElement('option');
  global.value = '';
  global.textContent = 'Use global grade';
  select.appendChild(global);
  for (const [id, grade] of Object.entries(GRADES)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = grade.name;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.grade = select.value || null;
    requestRender();
  });
}

/** Syncs the selected-panel controls with the state. */
function syncPanelControls() {
  const panel = state.panels[selectedPanel];
  const count = state.panels.length;
  const label = panel
    ? `Panel ${selectedPanel + 1} of ${count} · ${photoLabel(panel.photo)}`
    : 'No panel selected';
  $('selected-panel-label').textContent = state.spanPhoto
    ? `One photo across all panels · ${photoLabel(state.spanPhoto)}`
    : label;
  $('panel-grade-select').value = panel && panel.grade ? panel.grade : '';
  const zoom = panel ? Math.round((panel.zoom || 1) * 100) : 100;
  $('panel-zoom-slider').value = zoom;
  $('panel-zoom-label').textContent = `${zoom}%`;
  $('span-btn').classList.toggle('active', !!state.spanPhoto);
  syncPhotoTray();
}

function photoLabel(key) {
  const entry = library.find((e) => e.key === key);
  return entry ? entry.label : key;
}

// ---------------------------------------------------------------- actions

function setLayout(id) {
  if (!LAYOUTS[id]) return;
  state.layout = id;
  state.panels = buildPanelsForLayout(id, state.panels);
  selectedPanel = Math.min(selectedPanel, state.panels.length - 1);
  document.querySelectorAll('#layout-buttons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === id);
  });
  syncPanelControls();
  requestRender();
}

function setGrade(id) {
  if (!GRADES[id]) return;
  state.grade = id;
  document.querySelectorAll('#grade-buttons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === id);
  });
  requestRender();
}

function setSize(id) {
  if (!COVER_SIZES[id]) return;
  state.size = id;
  document.querySelectorAll('.size-tab').forEach((b) => {
    const active = b.dataset.size === id;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  requestRender();
}

function assignPhotoToSelectedPanel(key) {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  state.spanPhoto = null;
  panel.photo = key;
  panel.fx = 0;
  panel.fy = 0;
  panel.zoom = 1;
  syncPanelControls();
  requestRender();
}

/** Fills every panel with the selected panel's photo (each cover-fit). */
function fillAllPanels() {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  state.spanPhoto = null;
  for (const p of state.panels) {
    p.photo = panel.photo;
    p.fx = 0;
    p.fy = 0;
    p.zoom = 1;
  }
  setStatus(`Every panel now shows ${photoLabel(panel.photo)}.`);
  syncPanelControls();
  requestRender();
}

/** Toggles one-photo-across-all-panels mode with the selected photo. */
function toggleSpanPhoto() {
  if (state.spanPhoto) {
    state.spanPhoto = null;
    setStatus('Back to one photo per panel.');
  } else {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    state.spanPhoto = panel.photo;
    setStatus(`One photo across all panels: ${photoLabel(panel.photo)}.`);
  }
  syncPanelControls();
  requestRender();
}

/** Shuffles the photos across the panels (Fisher–Yates). */
function shufflePanels() {
  const photos = state.panels.map((p) => p.photo);
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  state.panels.forEach((p, i) => { p.photo = photos[i]; });
  state.spanPhoto = null;
  syncPanelControls();
  requestRender();
}

/** Downloads a blob as a file. */
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function canvasToPngBlob(canvasEl) {
  return new Promise((resolve) => canvasEl.toBlob(resolve, 'image/png'));
}

/** Exports the cover as a PNG in one size; resolves to the blob. */
async function exportPng(sizeId, download = true) {
  const size = COVER_SIZES[sizeId];
  setStatus(`Exporting ${size.label}…`);
  const exportCanvas = renderExportCanvas(state, photoMap(), sizeId);
  const blob = await canvasToPngBlob(exportCanvas);
  if (blob && download) downloadBlob(blob, `vice-coast-cover-${sizeId}-${size.width}x${size.height}.png`);
  setStatus(`Exported ${size.label} PNG (${Math.round(blob.size / 1024)} KB).`);
  return blob;
}

/** Exports all three sizes, one after another. */
async function exportAllSizes() {
  for (const sizeId of Object.keys(COVER_SIZES)) {
    await exportPng(sizeId, true);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  setStatus('Exported all 3 sizes — 1920 × 1080, 1080 × 1080, 1080 × 1350.');
}

// ---------------------------------------------------------------- canvas input

/** Finds the panel under a point in canvas pixels. */
function panelAtPoint(px, py) {
  const rects = layoutPanelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);
  const index = panelAtPoint(px, py);
  if (index < 0) return;
  selectedPanel = index;
  syncPanelControls();
  renderPreview();
  drag = { panel: state.panels[index], startX: event.clientX, startY: event.clientY, fx: state.panels[index].fx, fy: state.panels[index].fy };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const panelRects = layoutPanelRects(state.layout, canvas.width, canvas.height);
  const panelRect = panelRects[selectedPanel];
  if (!panelRect) return;
  const dx = (event.clientX - drag.startX) * (canvas.width / rect.width);
  const dy = (event.clientY - drag.startY) * (canvas.height / rect.height);
  drag.panel.fx = Math.max(-1, Math.min(1, drag.fx + (dx / panelRect.w) * 2));
  drag.panel.fy = Math.max(-1, Math.min(1, drag.fy + (dy / panelRect.h) * 2));
  requestRender();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(2.5, (panel.zoom || 1) * Math.exp(-event.deltaY * 0.0012)));
  syncPanelControls();
  requestRender();
}, { passive: false });

// ---------------------------------------------------------------- uploads

let uploadCounter = 0;
$('upload-input').addEventListener('change', async (event) => {
  const files = [...event.target.files].filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) return;
  for (const file of files) {
    const key = `upload-${++uploadCounter}`;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      library.push({ key, label: file.name.replace(/\.[^.]+$/, ''), img, url, sample: false });
    } catch {
      setStatus(`Could not read ${file.name} — try another image.`);
    }
  }
  buildPhotoTray();
  // The first upload goes straight into the selected panel.
  const first = library[library.length - files.length];
  if (first) assignPhotoToSelectedPanel(first.key);
  setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added — 100% offline, nothing uploaded.`);
  event.target.value = '';
  requestRender();
});

// ---------------------------------------------------------------- wire the controls

document.querySelectorAll('.size-tab').forEach((button) => {
  button.addEventListener('click', () => setSize(button.dataset.size));
});

$('posterize-toggle').addEventListener('change', (event) => {
  state.posterize = event.target.checked;
  requestRender();
});

$('enhance-toggle').addEventListener('change', (event) => {
  state.enhance.on = event.target.checked;
  requestRender();
});

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const preset = ENHANCE_PRESETS[button.dataset.preset];
    if (!preset) return;
    Object.assign(state.enhance, preset, { on: true });
    $('enhance-toggle').checked = true;
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b === button));
    syncEnhanceSliders();
    requestRender();
  });
});

function bindTextInput(id, key) {
  $(id).addEventListener('input', (event) => {
    state[key] = event.target.value;
    requestRender();
  });
}
bindTextInput('title-input', 'title');
bindTextInput('script-input', 'script');
bindTextInput('tagline-input', 'tagline');
bindTextInput('ribbon-input', 'ribbon');

$('heat-slider').addEventListener('input', (event) => {
  state.heat = Number(event.target.value);
  const stars = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  $('heat-label').textContent = `${stars} HEAT ${55 + state.heat * 8}`;
  requestRender();
});

$('title-size-slider').addEventListener('input', (event) => {
  state.titleSize = Number(event.target.value);
  $('title-size-label').textContent = `${event.target.value}%`;
  requestRender();
});

$('script-size-slider').addEventListener('input', (event) => {
  state.scriptSize = Number(event.target.value);
  $('script-size-label').textContent = `${event.target.value}%`;
  requestRender();
});

document.querySelectorAll('[data-caption-pos]').forEach((button) => {
  button.addEventListener('click', () => {
    state.captionPosition = button.dataset.captionPos;
    document.querySelectorAll('[data-caption-pos]').forEach((b) => {
      const active = b === button;
      b.classList.toggle('active', active);
      b.setAttribute('aria-checked', String(active));
    });
    requestRender();
  });
});

$('panel-zoom-slider').addEventListener('input', (event) => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Number(event.target.value) / 100;
  $('panel-zoom-label').textContent = `${event.target.value}%`;
  requestRender();
});

$('fill-all-btn').addEventListener('click', fillAllPanels);
$('span-btn').addEventListener('click', toggleSpanPhoto);
$('reset-panel-btn').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.fx = 0;
  panel.fy = 0;
  panel.zoom = 1;
  panel.grade = null;
  syncPanelControls();
  requestRender();
});

$('load-samples-btn').addEventListener('click', () => {
  assignSamplePhotos();
  selectedPanel = 0;
  setStatus('Sample photos loaded — a finished cover, ready to export.');
  syncPanelControls();
  requestRender();
});

$('autofill-btn').addEventListener('click', () => {
  // Every panel gets a different sample photo, shuffled.
  const order = [...SAMPLE_PHOTOS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  state.panels.forEach((panel, i) => {
    panel.photo = order[i % order.length].id;
    panel.fx = 0;
    panel.fy = 0;
    panel.zoom = 1;
  });
  state.spanPhoto = null;
  setStatus('Panels auto-filled with different sample photos.');
  syncPanelControls();
  requestRender();
});

$('shuffle-btn').addEventListener('click', () => {
  shufflePanels();
  setStatus('Photos shuffled across the panels.');
});

$('export-btn').addEventListener('click', () => exportPng(state.size));
$('export-all-btn').addEventListener('click', exportAllSizes);

const compareBtn = $('compare-btn');
function setCompare(on) {
  if (compareMode === on) return;
  compareMode = on;
  compareBtn.classList.toggle('active', on);
  renderPreview();
}
compareBtn.addEventListener('pointerdown', () => setCompare(true));
compareBtn.addEventListener('pointerup', () => setCompare(false));
compareBtn.addEventListener('pointerleave', () => setCompare(false));

// ---------------------------------------------------------------- keyboard

document.addEventListener('keydown', (event) => {
  const tag = (event.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  const layoutIds = Object.keys(LAYOUTS);
  if (event.key >= '1' && event.key <= String(layoutIds.length)) {
    setLayout(layoutIds[Number(event.key) - 1]);
    return;
  }
  const gradeIds = Object.keys(GRADES);
  switch (event.key.toLowerCase()) {
    case 'g':
      setGrade(gradeIds[(gradeIds.indexOf(state.grade) + 1) % gradeIds.length]);
      break;
    case 'e': {
      state.enhance.on = !state.enhance.on;
      $('enhance-toggle').checked = state.enhance.on;
      requestRender();
      break;
    }
    case 'd': {
      const anyOn = Object.values(state.decorations).some(Boolean);
      for (const key of Object.keys(state.decorations)) state.decorations[key] = !anyOn;
      document.querySelectorAll('[data-decoration]').forEach((input) => {
        input.checked = state.decorations[input.dataset.decoration];
      });
      requestRender();
      break;
    }
    case 'x':
      exportPng(state.size);
      break;
    case 'c':
      if (!event.repeat) setCompare(true);
      break;
    case 'arrowleft':
    case 'arrowright':
    case 'arrowup':
    case 'arrowdown': {
      const panel = state.panels[selectedPanel];
      if (!panel) break;
      event.preventDefault();
      const step = 0.08;
      if (event.key === 'ArrowLeft') panel.fx = Math.max(-1, panel.fx - step);
      if (event.key === 'ArrowRight') panel.fx = Math.min(1, panel.fx + step);
      if (event.key === 'ArrowUp') panel.fy = Math.max(-1, panel.fy - step);
      if (event.key === 'ArrowDown') panel.fy = Math.min(1, panel.fy + step);
      requestRender();
      break;
    }
    default:
      break;
  }
});
document.addEventListener('keyup', (event) => {
  if (event.key.toLowerCase() === 'c') setCompare(false);
});

window.addEventListener('resize', () => {
  if (shotMode === 'cover') requestRender();
});

// ---------------------------------------------------------------- shot scenes

/** Applies ?shot= query params so screenshots show a fixed scene. */
function applyShotParams() {
  const setIf = (name, fn) => {
    const value = params.get(name);
    if (value !== null && value !== '') fn(value);
  };
  setIf('size', (v) => { if (COVER_SIZES[v]) state.size = v; });
  setIf('layout', (v) => { if (LAYOUTS[v]) state.layout = v; });
  setIf('grade', (v) => { if (GRADES[v]) state.grade = v; });
  setIf('title', (v) => { state.title = v; });
  setIf('script', (v) => { state.script = v; });
  setIf('tagline', (v) => { state.tagline = v; });
  setIf('ribbon', (v) => { state.ribbon = v; });
  setIf('heat', (v) => { const n = Number(v); if (n >= 1 && n <= 5) state.heat = n; });
  setIf('caption', (v) => { if (v === 'top' || v === 'bottom') state.captionPosition = v; });
  setIf('titlesize', (v) => { const n = Number(v); if (n >= 50 && n <= 130) state.titleSize = n; });
  setIf('scriptsize', (v) => { const n = Number(v); if (n >= 50 && n <= 150) state.scriptSize = n; });
  setIf('posterize', (v) => { state.posterize = v === '1'; });
  setIf('decorations', (v) => {
    const on = v !== '0';
    for (const key of Object.keys(state.decorations)) state.decorations[key] = on;
  });
  // photo=<id> puts one sample photo in every panel; span=<id> spans it.
  setIf('photo', (v) => {
    if (!SAMPLE_PHOTOS.some((s) => s.id === v)) return;
    state.panels.forEach((p) => { p.photo = v; });
  });
  // hero=<id> puts one sample photo in the first panel (the hero in most layouts).
  setIf('hero', (v) => {
    if (!SAMPLE_PHOTOS.some((s) => s.id === v)) return;
    if (state.panels[0]) state.panels[0].photo = v;
  });
  setIf('span', (v) => {
    if (SAMPLE_PHOTOS.some((s) => s.id === v)) state.spanPhoto = v;
  });
  if (shotMode === 'cover') document.body.classList.add('shot-cover');
}

/** Syncs every control with the state (after shot params changed it). */
function syncAllControls() {
  document.querySelectorAll('.size-tab').forEach((b) => {
    const active = b.dataset.size === state.size;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('#layout-buttons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-buttons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  $('posterize-toggle').checked = state.posterize;
  $('enhance-toggle').checked = state.enhance.on;
  $('title-input').value = state.title;
  $('script-input').value = state.script;
  $('tagline-input').value = state.tagline;
  $('ribbon-input').value = state.ribbon;
  $('heat-slider').value = state.heat;
  $('heat-label').textContent = `${'★'.repeat(state.heat)}${'☆'.repeat(5 - state.heat)} HEAT ${55 + state.heat * 8}`;
  $('title-size-slider').value = state.titleSize;
  $('title-size-label').textContent = `${state.titleSize}%`;
  $('script-size-slider').value = state.scriptSize;
  $('script-size-label').textContent = `${state.scriptSize}%`;
  document.querySelectorAll('[data-caption-pos]').forEach((b) => {
    const active = b.dataset.captionPos === state.captionPosition;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', String(active));
  });
  document.querySelectorAll('[data-decoration]').forEach((input) => {
    input.checked = !!state.decorations[input.dataset.decoration];
  });
  syncEnhanceSliders();
  syncPanelControls();
}

// ---------------------------------------------------------------- smoke tests

/** Renders a small cover from a state patch and returns its pixels + data URL. */
function renderProbe(patch, width = 320, height = 180, compare = false) {
  const probeState = structuredClone(state);
  Object.assign(probeState, patch);
  if (patch.panels) probeState.panels = structuredClone(patch.panels);
  if (patch.enhance) probeState.enhance = { ...state.enhance, ...patch.enhance };
  if (patch.decorations) probeState.decorations = { ...state.decorations, ...patch.decorations };
  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;
  renderCover(probe, probeState, photoMap(), { compare });
  return probe;
}

/** A cheap fingerprint of a canvas: sampled pixels joined as a string. */
function canvasFingerprint(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
  const samples = [];
  for (let i = 0; i < data.length; i += 997 * 4) {
    samples.push(data[i], data[i + 1], data[i + 2]);
  }
  return samples.join(',');
}

/** Whether a canvas is non-blank (its sampled pixels are not all one colour). */
function canvasIsNonBlank(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  const data = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
  const seen = new Set();
  for (let i = 0; i < data.length; i += 401 * 4) {
    seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    if (seen.size > 12) return true;
  }
  return false;
}

/** Runs the in-page smoke tests and writes the JSON report into #test-report. */
async function runSmokeTests() {
  const results = [];
  const check = (name, passed, detail = '') => {
    results.push({ name, passed: !!passed, detail });
  };
  const savedState = structuredClone(state);

  try {
    check('no page errors', window.__pageErrors.length === 0, window.__pageErrors.join('; '));
    check('all 8 sample photos loaded', SAMPLE_PHOTOS.every((s) => {
      const entry = library.find((e) => e.key === s.id);
      return entry && entry.img && entry.img.naturalWidth > 0;
    }));

    const base = renderProbe({});
    check('default cover renders non-blank', canvasIsNonBlank(base));

    for (const layoutId of Object.keys(LAYOUTS)) {
      const probeState = structuredClone(state);
      probeState.layout = layoutId;
      probeState.panels = buildPanelsForLayout(layoutId, state.panels);
      const probe = document.createElement('canvas');
      probe.width = 320;
      probe.height = 180;
      renderCover(probe, probeState, photoMap());
      check(`layout ${layoutId} renders`, canvasIsNonBlank(probe));
    }

    const gradeIds = Object.keys(GRADES);
    const gradePrints = gradeIds.map((g) => canvasFingerprint(renderProbe({ grade: g })));
    check('all 6 grades apply (each differs)', new Set(gradePrints).size === gradeIds.length);

    const dark = canvasFingerprint(renderProbe({ enhance: { brightness: -50 } }));
    const bright = canvasFingerprint(renderProbe({ enhance: { brightness: 50 } }));
    check('enhance brightness changes the preview', dark !== bright);

    const sharpOff = canvasFingerprint(renderProbe({ enhance: { sharpness: 0 } }));
    const sharpOn = canvasFingerprint(renderProbe({ enhance: { sharpness: 100 } }));
    check('enhance sharpness changes the preview', sharpOff !== sharpOn);

    const flat = canvasFingerprint(renderProbe({ posterize: false }));
    const poster = canvasFingerprint(renderProbe({ posterize: true }));
    check('posterize changes the preview', flat !== poster);

    const sunOn = canvasFingerprint(renderProbe({ decorations: { sun: true } }));
    const sunOff = canvasFingerprint(renderProbe({ decorations: { sun: false } }));
    check('decorations toggle changes the preview', sunOn !== sunOff);

    const titleA = canvasFingerprint(renderProbe({ title: 'VICE HEAT' }));
    const titleB = canvasFingerprint(renderProbe({ title: 'NEON TIDE' }));
    check('title edit changes the preview', titleA !== titleB);

    const bigTitle = canvasFingerprint(renderProbe({ titleSize: 130 }));
    const smallTitle = canvasFingerprint(renderProbe({ titleSize: 60 }));
    check('title-size slider changes the preview', bigTitle !== smallTitle);

    const capTop = canvasFingerprint(renderProbe({ captionPosition: 'top' }));
    const capBottom = canvasFingerprint(renderProbe({ captionPosition: 'bottom' }));
    check('caption position toggle changes the preview', capTop !== capBottom);

    const panelsA = structuredClone(state.panels);
    const panelsB = structuredClone(state.panels);
    panelsB[0].grade = 'neon-nights';
    const panelGradeA = canvasFingerprint(renderProbe({ panels: panelsA }));
    const panelGradeB = canvasFingerprint(renderProbe({ panels: panelsB }));
    check('per-panel grade changes the preview', panelGradeA !== panelGradeB);

    const panelsC = structuredClone(state.panels);
    panelsC[0].zoom = 2.2;
    const zoomed = canvasFingerprint(renderProbe({ panels: panelsC }));
    check('per-panel zoom changes the preview', panelGradeA !== zoomed);

    const panelsD = structuredClone(state.panels);
    panelsD[0].fx = 1;
    panelsD[0].fy = -1;
    const reframed = canvasFingerprint(renderProbe({ panels: panelsD }));
    check('drag-crop reframe changes the preview', panelGradeA !== reframed);

    const spanned = canvasFingerprint(renderProbe({ spanPhoto: 'boulevard' }));
    check('one-photo-across-all-panels renders', spanned !== panelGradeA);

    const compared = renderProbe({}, 320, 180, true);
    check('compare mode differs from the graded cover', canvasFingerprint(compared) !== canvasFingerprint(base));

    const again1 = renderProbe({});
    const again2 = renderProbe({});
    check('deterministic: same state renders identical pixels', canvasFingerprint(again1) === canvasFingerprint(again2));

    for (const sizeId of Object.keys(COVER_SIZES)) {
      const size = COVER_SIZES[sizeId];
      const exportCanvas = renderExportCanvas(state, photoMap(), sizeId);
      const blob = await canvasToPngBlob(exportCanvas);
      check(
        `export PNG ${size.label}`,
        exportCanvas.width === size.width && exportCanvas.height === size.height && blob && blob.size > 10000,
        blob ? `${Math.round(blob.size / 1024)} KB` : 'no blob',
      );
    }
  } catch (err) {
    check('smoke tests ran without throwing', false, String(err));
  } finally {
    Object.assign(state, savedState);
    state.panels = savedState.panels;
    state.enhance = savedState.enhance;
    state.decorations = savedState.decorations;
  }

  const passed = results.filter((r) => r.passed).length;
  const report = { passed, total: results.length, results };
  const reportEl = $('test-report');
  reportEl.textContent = JSON.stringify(report, null, 2);
  reportEl.hidden = false;
  document.title = passed === results.length ? 'TESTS PASS' : `TESTS FAIL (${results.length - passed})`;
  window.__testReport = report;
  window.__testDone = true;
  renderPreview();
  return report;
}

// ---------------------------------------------------------------- boot

/** Loads the sample photos, builds the controls, renders the first cover. */
async function boot() {
  buildLayoutButtons();
  buildGradeButtons();
  buildEnhanceSliders();
  buildDecorationToggles();
  buildPanelGradeSelect();
  state.panels = buildPanelsForLayout(state.layout, []);

  // Auto-load the sample photos so the first view is a finished cover.
  const loads = SAMPLE_PHOTOS.map(async (sample) => {
    try {
      const img = await loadImage(sample.file);
      library.push({ key: sample.id, label: sample.label, img, url: sample.file, sample: true });
    } catch {
      window.__pageErrors.push(`sample photo failed: ${sample.file}`);
    }
  });
  await Promise.all(loads);
  library.sort((a, b) => SAMPLE_PHOTOS.findIndex((s) => s.id === a.key) - SAMPLE_PHOTOS.findIndex((s) => s.id === b.key));
  photosReady = true;
  buildPhotoTray();

  applyShotParams();
  // Shot params may have changed the layout: rebuild panels for it.
  state.panels = buildPanelsForLayout(state.layout, state.panels);
  syncAllControls();
  try {
    await document.fonts.ready;
  } catch { /* fonts are system fonts; continue regardless */ }
  clearPanelCache();
  renderPreview();
  setStatus('Sample photos loaded — a finished cover. Pick a photo, tweak the lettering, export.');

  if (params.has('test')) {
    await runSmokeTests();
  }
}

window.__viceCoast = { state, runSmokeTests, exportPng, exportAllSizes, renderExportCanvas };
boot();
