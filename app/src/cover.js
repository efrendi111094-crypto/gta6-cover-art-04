// Vice Coast Cover Studio 4 — cover render engine.
// Draws GTA-style multi-panel poster covers onto any canvas: photo panels with
// gradient-map colour grades, a one-click Enhance pipeline (brightness, contrast,
// saturation, warmth, real unsharp-mask sharpening), toggleable poster layers
// (retro sun, skyline, speed lines, halftone, grain) and giant overlapping
// gradient lettering. Every random-looking detail comes from a seeded generator,
// so the same state always renders the same pixels.

// ---------------------------------------------------------------- constants

/** The three export sizes the bounty asks for. */
export const COVER_SIZES = {
  wide: { width: 1920, height: 1080, label: '1920 × 1080 · Landscape' },
  square: { width: 1080, height: 1080, label: '1080 × 1080 · Square' },
  portrait: { width: 1080, height: 1350, label: '1080 × 1350 · Portrait' },
};

/** The eight sample photos shipped under app/samples/ — people first. */
export const SAMPLE_PHOTOS = [
  { id: 'boulevard', file: 'samples/boulevard.jpg', label: 'Boulevard sunset' },
  { id: 'convertible', file: 'samples/convertible.jpg', label: 'Convertible smile' },
  { id: 'pier', file: 'samples/pier.jpg', label: 'Fisherman on the pier' },
  { id: 'hawaiian', file: 'samples/hawaiian.jpg', label: 'Hawaiian shirt' },
  { id: 'friends', file: 'samples/friends.jpg', label: 'Friends at dusk' },
  { id: 'alley', file: 'samples/alley.jpg', label: 'Neon alley' },
  { id: 'speedboat', file: 'samples/speedboat.jpg', label: 'Speedboat' },
  { id: 'highway', file: 'samples/highway.jpg', label: 'Coastal highway' },
];

/**
 * The six colour grades. Each grade is a gradient map (luminance -> colour stops)
 * blended over the photo at `mix`, plus a saturation and contrast lift. Poster Ink
 * also posterizes to five tonal levels for the flat comic-poster look.
 */
export const GRADES = {
  'vice-sunset': {
    name: 'Vice Sunset',
    mix: 0.55, saturation: 1.25, contrast: 1.08,
    map: [[0, '#2b0a4a'], [0.35, '#c2185b'], [0.65, '#ff7a1a'], [1, '#ffe95e']],
  },
  'neon-nights': {
    name: 'Neon Nights',
    mix: 0.52, saturation: 1.3, contrast: 1.1,
    map: [[0, '#05021a'], [0.4, '#3b0f66'], [0.7, '#ff2e88'], [1, '#7df9ff']],
  },
  'golden-hour': {
    name: 'Golden Hour',
    mix: 0.45, saturation: 1.15, contrast: 1.05,
    map: [[0, '#1c0f08'], [0.45, '#7a3b12'], [0.75, '#ffb347'], [1, '#fff3b0']],
  },
  'teal-orange': {
    name: 'Teal & Orange',
    mix: 0.5, saturation: 1.2, contrast: 1.08,
    map: [[0, '#06222b'], [0.45, '#0e6b7a'], [0.75, '#ff9a3d'], [1, '#ffe8c2']],
  },
  'poster-ink': {
    name: 'Poster Ink',
    mix: 0.6, saturation: 1.35, contrast: 1.25, posterize: 5,
    map: [[0, '#0d0221'], [0.3, '#5b1a8f'], [0.6, '#ff4d6d'], [1, '#fff200']],
  },
  'clean-photo': {
    name: 'Clean Photo',
    mix: 0, saturation: 1.05, contrast: 1.03, map: null,
  },
};

/** The six panel layouts, each a list of relative rects [x, y, w, h]. */
export const LAYOUTS = {
  'hero-left': {
    name: 'Hero Left',
    rects: [
      [0, 0, 0.6, 1],
      [0.6, 0, 0.2, 0.5], [0.8, 0, 0.2, 0.5],
      [0.6, 0.5, 0.2, 0.5], [0.8, 0.5, 0.2, 0.5],
    ],
  },
  'hero-right': {
    name: 'Hero Right',
    rects: [
      [0, 0, 0.2, 0.5], [0.2, 0, 0.2, 0.5],
      [0, 0.5, 0.2, 0.5], [0.2, 0.5, 0.2, 0.5],
      [0.4, 0, 0.6, 1],
    ],
  },
  'hero-top': {
    name: 'Hero Top',
    rects: [
      [0, 0, 1, 0.58],
      [0, 0.58, 0.25, 0.42], [0.25, 0.58, 0.25, 0.42],
      [0.5, 0.58, 0.25, 0.42], [0.75, 0.58, 0.25, 0.42],
    ],
  },
  grid: {
    name: 'Grid 3×3',
    rects: [
      [0, 0, 1 / 3, 1 / 3], [1 / 3, 0, 1 / 3, 1 / 3], [2 / 3, 0, 1 / 3, 1 / 3],
      [0, 1 / 3, 1 / 3, 1 / 3], [1 / 3, 1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 3, 1 / 3, 1 / 3],
      [0, 2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 1 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3, 1 / 3],
    ],
  },
  strips: {
    name: 'Film Strips',
    rects: [
      [0, 0, 0.2, 1], [0.2, 0, 0.2, 1], [0.4, 0, 0.2, 1],
      [0.6, 0, 0.2, 1], [0.8, 0, 0.2, 1],
    ],
  },
  'vice-slash': {
    name: 'Vice Slash',
    // Slanted panels: every vertical edge leans by this fraction of the width.
    slant: 0.05,
    rects: [
      [0, 0.06, 0.26, 0.42], [0, 0.52, 0.26, 0.42],
      [0.26, 0, 0.48, 1],
      [0.74, 0.06, 0.26, 0.42], [0.74, 0.52, 0.26, 0.42],
    ],
  },
};

/** Enhance presets: one-click slider bundles. */
export const ENHANCE_PRESETS = {
  'golden-hour': { name: 'Golden Hour', brightness: 8, contrast: 14, saturation: 26, sharpness: 45, warmth: 30 },
  'neon-pop': { name: 'Neon Pop', brightness: 4, contrast: 22, saturation: 42, sharpness: 55, warmth: -8 },
  'clean-bright': { name: 'Clean & Bright', brightness: 16, contrast: 8, saturation: 10, sharpness: 35, warmth: 4 },
};

/** Default editor state: a finished cover on first load, no upload needed. */
export function defaultState() {
  return {
    size: 'wide',
    layout: 'hero-left',
    grade: 'vice-sunset',
    posterize: false,
    enhance: { on: true, brightness: 6, contrast: 14, saturation: 20, sharpness: 45, warmth: 16 },
    title: 'VICE HEAT',
    script: 'Neon nights, fast cars',
    tagline: 'LEONIDA · SUMMER 2026',
    ribbon: 'SAME TROUBLE',
    heat: 5,
    titleSize: 100,
    scriptSize: 100,
    captionPosition: 'bottom',
    // When set to a photo key, that one photo spans every panel like a window.
    spanPhoto: null,
    decorations: {
      halftone: true, grain: true, vignette: true, sun: true, skyline: true,
      speedlines: true, sunburst: true, sticker: true, ribbon: true, heatpill: true,
    },
    panels: [],
  };
}

// ---------------------------------------------------------------- seeded random

/** mulberry32: a tiny deterministic PRNG, so grain and skylines never change. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- grade math

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Builds a 256-entry gradient-map lookup table from colour stops. */
function buildGradientMap(stops) {
  const table = new Array(256);
  const points = stops.map(([at, hex]) => [at, hexToRgb(hex)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = points[0];
    let b = points[points.length - 1];
    for (let s = 0; s < points.length - 1; s++) {
      if (t >= points[s][0] && t <= points[s + 1][0]) { a = points[s]; b = points[s + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    table[i] = [
      Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
      Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
      Math.round(a[1][2] + (b[1][2] - a[1][2]) * f),
    ];
  }
  return table;
}

const gradientMapCache = new Map();
function gradientMapFor(gradeId) {
  if (!gradientMapCache.has(gradeId)) {
    const grade = GRADES[gradeId];
    gradientMapCache.set(gradeId, grade.map ? buildGradientMap(grade.map) : null);
  }
  return gradientMapCache.get(gradeId);
}

const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Grades one panel's pixels in place: Enhance (brightness, contrast, saturation,
 * warmth), then the gradient-map grade, then posterize when asked. The per-channel
 * Enhance curves are precomputed into lookup tables so the inner loop stays fast.
 */
export function applyGradeToPixels(imageData, gradeId, enhance, posterizeOn) {
  const grade = GRADES[gradeId] || GRADES['clean-photo'];
  const data = imageData.data;
  const on = enhance && enhance.on;
  const bright = on ? enhance.brightness : 0;
  const contrast = (on ? 1 + enhance.contrast / 100 : 1) * grade.contrast;
  const warmth = on ? enhance.warmth / 100 : 0;
  const saturation = (on ? 1 + enhance.saturation / 100 : 1) * grade.saturation;
  const map = gradientMapFor(gradeId);
  const mix = map ? grade.mix : 0;
  const levels = posterizeOn ? 6 : (grade.posterize || 0);

  // Per-channel Enhance lookup tables (brightness + contrast + warmth).
  const lutR = new Uint8Array(256);
  const lutG = new Uint8Array(256);
  const lutB = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    const c = (v - 128) * contrast + 128 + bright;
    lutR[v] = clampByte(Math.round(c * (1 + warmth * 0.35)));
    lutG[v] = clampByte(Math.round(c));
    lutB[v] = clampByte(Math.round(c * (1 - warmth * 0.35)));
  }

  for (let i = 0; i < data.length; i += 4) {
    let r = lutR[data[i]];
    let g = lutG[data[i + 1]];
    let b = lutB[data[i + 2]];
    // Saturation around the pixel's luminance.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = clampByte(Math.round(lum + (r - lum) * saturation));
    g = clampByte(Math.round(lum + (g - lum) * saturation));
    b = clampByte(Math.round(lum + (b - lum) * saturation));
    // Gradient map: blend the photo toward its luminance-mapped poster colour.
    if (mix > 0) {
      const mapped = map[Math.round(0.299 * r + 0.587 * g + 0.114 * b)];
      r = Math.round(r + (mapped[0] - r) * mix);
      g = Math.round(g + (mapped[1] - g) * mix);
      b = Math.round(b + (mapped[2] - b) * mix);
    }
    // Posterize: quantize each channel to a few flat levels.
    if (levels > 0) {
      const step = 255 / (levels - 1);
      r = Math.round(Math.round(r / step) * step);
      g = Math.round(Math.round(g / step) * step);
      b = Math.round(Math.round(b / step) * step);
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * Real unsharp-mask sharpening: subtracts a blurred copy (3×3 box blur) from the
 * original, scaled by `amount` (0–100). Runs in place on the panel's pixels.
 */
export function applyUnsharpMask(imageData, width, height, amount) {
  if (amount <= 0) return;
  const data = imageData.data;
  const src = new Uint8ClampedArray(data);
  const strength = amount / 100;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            sum += src[(yy * width + xx) * 4 + ch];
            count++;
          }
        }
        const blur = sum / count;
        const value = src[idx + ch];
        data[idx + ch] = clampByte(Math.round(value + (value - blur) * strength * 1.6));
      }
    }
  }
}

// ---------------------------------------------------------------- panel cache

/** Graded panel canvases, keyed by photo + grade + enhance + size (LRU, 32 max). */
const panelCache = new Map();

function panelCacheKey(photoKey, panel, gradeId, enhance, posterizeOn, w, h, sourceOverride) {
  const e = enhance && enhance.on
    ? [enhance.brightness, enhance.contrast, enhance.saturation, enhance.sharpness, enhance.warmth].join(',')
    : 'off';
  const crop = `${panel.fx || 0},${panel.fy || 0},${panel.zoom || 1}`;
  const src = sourceOverride
    ? `|${Math.round(sourceOverride.sx)},${Math.round(sourceOverride.sy)},${Math.round(sourceOverride.sw)}x${Math.round(sourceOverride.sh)}`
    : '';
  return `${photoKey}|${crop}|${gradeId}|${e}|${posterizeOn ? 1 : 0}|${w}x${h}${src}`;
}

/**
 * Renders one photo into a graded panel canvas at the panel's pixel size
 * (cover-fit with the panel's focal offsets and zoom). `sourceOverride` pins an
 * exact source rect in image pixels (one-photo-across-all-panels mode).
 * Results are cached.
 */
export function gradedPanelCanvas(photo, panel, gradeId, enhance, posterizeOn, w, h, sourceOverride = null) {
  const key = panelCacheKey(photo.key, panel, gradeId, enhance, posterizeOn, w, h, sourceOverride);
  const hit = panelCache.get(key);
  if (hit) {
    panelCache.delete(key);
    panelCache.set(key, hit);
    return hit;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  const img = photo.img;
  const zoom = panel.zoom || 1;
  let sx;
  let sy;
  let sw;
  let sh;
  if (sourceOverride) {
    // One photo spanning all panels: the caller pins the exact source window.
    ({ sx, sy, sw, sh } = sourceOverride);
  } else {
    // Cover-fit source rect, shifted by the focal offsets (-1..1) and the zoom.
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const panelAspect = canvas.width / canvas.height;
    if (imgAspect > panelAspect) {
      sh = img.naturalHeight;
      sw = sh * panelAspect;
    } else {
      sw = img.naturalWidth;
      sh = sw / panelAspect;
    }
    sw /= zoom;
    sh /= zoom;
    const maxX = img.naturalWidth - sw;
    const maxY = img.naturalHeight - sh;
    sx = Math.max(0, Math.min(maxX, (maxX / 2) + (panel.fx || 0) * (maxX / 2)));
    sy = Math.max(0, Math.min(maxY, (maxY / 2) + (panel.fy || 0) * (maxY / 2)));
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyGradeToPixels(imageData, gradeId, enhance, posterizeOn);
  if (enhance && enhance.on && enhance.sharpness > 0) {
    applyUnsharpMask(imageData, canvas.width, canvas.height, enhance.sharpness);
  }
  ctx.putImageData(imageData, 0, 0);
  panelCache.set(key, canvas);
  if (panelCache.size > 32) panelCache.delete(panelCache.keys().next().value);
  return canvas;
}

/** Clears the graded-panel cache (used when a photo is replaced). */
export function clearPanelCache() {
  panelCache.clear();
}

// ---------------------------------------------------------------- layout

/** Pixel rects for a layout id at a cover size, with a thin gap between panels. */
export function layoutPanelRects(layoutId, width, height) {
  const layout = LAYOUTS[layoutId] || LAYOUTS['hero-left'];
  const gap = Math.max(2, Math.round(Math.min(width, height) * 0.006));
  return layout.rects.map(([rx, ry, rw, rh]) => ({
    x: Math.round(rx * width + gap / 2),
    y: Math.round(ry * height + gap / 2),
    w: Math.max(1, Math.round(rw * width - gap)),
    h: Math.max(1, Math.round(rh * height - gap)),
  }));
}

// ---------------------------------------------------------------- poster layers

/** A seeded film-grain tile, reused as a repeating pattern. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const ctx = tile.getContext('2d');
  const imageData = ctx.createImageData(160, 160);
  const rng = mulberry32(20260606);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.floor(rng() * 255);
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  grainTile = tile;
  return tile;
}

/** A halftone dot tile, reused as a repeating pattern. */
let halftoneTile = null;
function getHalftoneTile() {
  if (halftoneTile) return halftoneTile;
  const tile = document.createElement('canvas');
  tile.width = 14;
  tile.height = 14;
  const ctx = tile.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(3.5, 3.5, 2.1, 0, Math.PI * 2);
  ctx.arc(10.5, 10.5, 2.1, 0, Math.PI * 2);
  ctx.fill();
  halftoneTile = tile;
  return tile;
}

/** Sunburst rays fanning from a point, warm and translucent. */
function drawSunburstRays(ctx, cx, cy, radius, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / rays / 2.4;
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.4);
    grad.addColorStop(0, 'rgba(255, 190, 60, 0.20)');
    grad.addColorStop(1, 'rgba(255, 90, 160, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius * 2.4, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The retro striped sun: a gradient disc with widening horizontal cuts. */
function drawRetroSun(ctx, cx, cy, radius) {
  const off = document.createElement('canvas');
  const pad = 4;
  off.width = Math.ceil(radius * 2 + pad * 2);
  off.height = Math.ceil(radius * 2 + pad * 2);
  const octx = off.getContext('2d');
  const grad = octx.createLinearGradient(0, pad, 0, pad + radius * 2);
  grad.addColorStop(0, '#fff200');
  grad.addColorStop(0.45, '#ffb300');
  grad.addColorStop(0.75, '#ff5e3a');
  grad.addColorStop(1, '#ff2e88');
  octx.fillStyle = grad;
  octx.beginPath();
  octx.arc(pad + radius, pad + radius, radius, 0, Math.PI * 2);
  octx.fill();
  // Cut the stripes: gaps widen toward the bottom of the disc.
  octx.globalCompositeOperation = 'destination-out';
  let y = pad + radius * 0.55;
  let gap = radius * 0.045;
  while (y < pad + radius * 2) {
    octx.fillRect(0, y, off.width, gap);
    y += gap + radius * 0.16;
    gap *= 1.5;
  }
  ctx.save();
  ctx.shadowColor = 'rgba(255, 80, 140, 0.55)';
  ctx.shadowBlur = radius * 0.35;
  ctx.drawImage(off, cx - radius - pad, cy - radius - pad);
  ctx.restore();
}

/** One palm silhouette: a curved trunk and drooping fronds. */
function drawPalmSilhouette(ctx, x, baseY, size, lean) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(lean, 1);
  ctx.fillStyle = '#0d0518';
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, 0);
  ctx.quadraticCurveTo(size * 0.03, -size * 0.55, size * 0.1, -size * 0.9);
  ctx.lineTo(size * 0.16, -size * 0.88);
  ctx.quadraticCurveTo(size * 0.09, -size * 0.5, size * 0.06, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds fan out from the crown.
  const crownX = size * 0.12;
  const crownY = -size * 0.9;
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (0.08 + (i / 6) * 0.84);
    const len = size * (0.42 + (i % 3) * 0.06);
    const tipX = crownX + Math.cos(angle) * len;
    const tipY = crownY - Math.sin(angle) * len * 0.55 + len * 0.28;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX + Math.cos(angle) * len * 0.55,
      crownY - Math.sin(angle) * len * 0.6,
      tipX, tipY,
    );
    ctx.quadraticCurveTo(
      crownX + Math.cos(angle) * len * 0.5,
      crownY - Math.sin(angle) * len * 0.35 + len * 0.12,
      crownX, crownY,
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** City skyline + palm silhouettes along the bottom edge (seeded, deterministic). */
function drawSkylineSilhouette(ctx, width, height) {
  const rng = mulberry32(424242);
  const baseY = height;
  const bandH = height * 0.075;
  ctx.fillStyle = '#160a2a';
  let x = -width * 0.01;
  while (x < width * 1.01) {
    const bw = width * (0.03 + rng() * 0.055);
    const bh = bandH * (0.45 + rng() * 0.95);
    ctx.fillRect(x, baseY - bh, bw, bh);
    // Lit windows: a few warm and cyan dots in the tower.
    const cols = Math.max(1, Math.floor(bw / (width * 0.012)));
    const rows = Math.max(1, Math.floor(bh / (bandH * 0.28)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() < 0.45) continue;
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255, 210, 90, 0.85)' : 'rgba(125, 249, 255, 0.8)';
        ctx.fillRect(
          x + bw * 0.14 + c * (bw * 0.72 / cols),
          baseY - bh * 0.88 + r * (bh * 0.72 / rows),
          Math.max(1.5, width * 0.003),
          Math.max(1.5, bandH * 0.09),
        );
      }
    }
    ctx.fillStyle = '#160a2a';
    // Antenna or rooftop detail on some towers.
    if (rng() > 0.55) {
      ctx.fillRect(x + bw * 0.45, baseY - bh - bandH * 0.28, width * 0.0022, bandH * 0.28);
      ctx.beginPath();
      ctx.arc(x + bw * 0.46, baseY - bh - bandH * 0.3, width * 0.002, 0, Math.PI * 2);
      ctx.fill();
    }
    x += bw + width * 0.004;
  }
  // Palms rise above the rooftops at seeded spots.
  const palmXs = [0.06, 0.24, 0.47, 0.68, 0.88];
  palmXs.forEach((fx, i) => {
    drawPalmSilhouette(ctx, fx * width, baseY - bandH * 0.15, height * (0.1 + (i % 2) * 0.025), i % 2 === 0 ? 1 : -1);
  });
}

/** Diagonal speed lines streaking in from the left and right edges. */
function drawSpeedLines(ctx, width, height) {
  const rng = mulberry32(777);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const fromLeft = i % 2 === 0;
    const y = height * (0.04 + rng() * 0.5);
    const len = width * (0.05 + rng() * 0.11);
    const x = fromLeft ? -width * 0.01 : width * 1.01 - len;
    const slope = height * 0.012 * (rng() - 0.5);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + rng() * 0.16})`;
    ctx.lineWidth = Math.max(1.5, height * (0.002 + rng() * 0.003));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + slope);
    ctx.stroke();
  }
  ctx.restore();
}

/** Yellow starburst sticker with two lines of text, rotated for energy. */
function drawStarburstSticker(ctx, cx, cy, radius, line1, line2) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.beginPath();
  const points = 14;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.78;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd400';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = radius * 0.18;
  ctx.shadowOffsetY = radius * 0.06;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, radius * 0.05);
  ctx.strokeStyle = '#111';
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${radius * 0.34}px "Arial Black", "Liberation Sans", sans-serif`;
  ctx.fillText(line1, 0, -radius * 0.16);
  ctx.font = `900 ${radius * 0.3}px "Arial Black", "Liberation Sans", sans-serif`;
  ctx.fillText(line2, 0, radius * 0.2);
  ctx.restore();
}

/** Diagonal corner ribbon carrying the ribbon text. */
function drawCornerRibbon(ctx, width, height, text) {
  const bandH = Math.min(width, height) * 0.052;
  const bandW = Math.max(width, height) * 0.26;
  ctx.save();
  // Anchor the band's centre near the top-left corner, then tilt it -45°.
  ctx.translate(width * 0.085, height * 0.11);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#ff2e88';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = bandH * 0.3;
  ctx.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${bandH * 0.44}px "Arial Black", "Liberation Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0, bandW * 0.92);
  ctx.restore();
}

/** Heat pill: star rating + HEAT number in a dark rounded pill. */
function drawHeatPill(ctx, x, y, pillW, pillH, heat) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, pillW, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(8, 2, 16, 0.78)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, pillH * 0.04);
  ctx.strokeStyle = 'rgba(255, 212, 0, 0.85)';
  ctx.stroke();
  const starSize = pillH * 0.42;
  ctx.font = `${starSize}px "DejaVu Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let tx = x + pillH * 0.35;
  const cy = y + pillH / 2 + starSize * 0.06;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < heat ? '#ffd400' : 'rgba(255, 255, 255, 0.28)';
    ctx.fillText('★', tx, cy);
    tx += starSize * 1.12;
  }
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${pillH * 0.34}px "Arial Black", "Liberation Sans", sans-serif`;
  ctx.fillText(`HEAT ${55 + heat * 8}`, tx + pillH * 0.12, y + pillH / 2);
  ctx.restore();
}

// ---------------------------------------------------------------- lettering

/** Heavy condensed display stack for the giant title (system fonts only). */
const DISPLAY_FONT = '"Arial Black", "Archivo Black", Impact, "Liberation Sans", "DejaVu Sans", sans-serif';
/** Contrasting script stack for the subtitle; falls back to italic serif. */
const SCRIPT_FONT = '"Segoe Script", "Brush Script MT", "URW Chancery L", "Liberation Serif", Georgia, serif';

/**
 * The giant overlapping title: condensed heavy type, a yellow→orange→pink
 * gradient fill, a thick black outline and a hard offset shadow, spanning the
 * full cover width across the photos — plus the script subtitle above it and
 * the small all-caps tagline below it.
 */
export function drawGiantTitle(ctx, width, height, state) {
  const title = (state.title || '').trim();
  if (!title) return;
  const cx = width / 2;
  const onTop = state.captionPosition === 'top';
  const titleScale = (state.titleSize || 100) / 100;
  const scriptScale = (state.scriptSize || 100) / 100;
  // Soft darkening behind the title zone so the lettering always reads.
  const bandH = height * 0.38;
  const bandTop = onTop ? 0 : height * 0.6;
  const bandGrad = onTop
    ? ctx.createLinearGradient(0, 0, 0, bandH)
    : ctx.createLinearGradient(0, bandTop, 0, height * 0.98);
  if (onTop) {
    bandGrad.addColorStop(0, 'rgba(10, 0, 24, 0.3)');
    bandGrad.addColorStop(0.7, 'rgba(10, 0, 24, 0.22)');
    bandGrad.addColorStop(1, 'rgba(10, 0, 24, 0)');
  } else {
    bandGrad.addColorStop(0, 'rgba(10, 0, 24, 0)');
    bandGrad.addColorStop(0.55, 'rgba(10, 0, 24, 0.26)');
    bandGrad.addColorStop(1, 'rgba(10, 0, 24, 0.05)');
  }
  ctx.save();
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, bandTop, width, bandH);
  ctx.restore();

  // Fit the title to 94% of the cover width (accounting for the condense scale).
  const condenseX = 0.84;
  const stretchY = 1.08;
  let fontSize = Math.min(width * 0.17, height * 0.24) * titleScale;
  ctx.font = `900 ${fontSize}px ${DISPLAY_FONT}`;
  const maxW = width * 0.94 / condenseX;
  while (fontSize > 12 && ctx.measureText(title).width > maxW) {
    fontSize *= 0.94;
    ctx.font = `900 ${fontSize}px ${DISPLAY_FONT}`;
  }
  const titleBaseline = onTop ? fontSize * 1.55 : height * 0.84;

  // Script subtitle above the title, slightly tilted, white with a pink glow.
  const script = (state.script || '').trim();
  if (script) {
    ctx.save();
    ctx.translate(cx, titleBaseline - fontSize * 1.02);
    ctx.rotate(-0.035);
    ctx.font = `italic 700 ${fontSize * 0.3 * scriptScale}px ${SCRIPT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(255, 46, 136, 0.9)';
    ctx.shadowBlur = fontSize * 0.08;
    ctx.lineWidth = Math.max(2, fontSize * 0.02);
    ctx.strokeStyle = 'rgba(20, 0, 30, 0.85)';
    ctx.strokeText(script, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(script, 0, 0);
    ctx.restore();
  }

  // The giant title itself: hard black shadow, thick outline, gradient fill.
  ctx.save();
  ctx.translate(cx, titleBaseline);
  ctx.scale(condenseX, stretchY);
  ctx.font = `900 ${fontSize}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const shadow = fontSize * 0.05;
  ctx.fillStyle = '#0a0014';
  ctx.fillText(title, shadow, shadow);
  ctx.lineJoin = 'round';
  ctx.lineWidth = fontSize * 0.085;
  ctx.strokeStyle = '#0a0014';
  ctx.strokeText(title, 0, 0);
  const grad = ctx.createLinearGradient(0, -fontSize * 0.85, 0, fontSize * 0.15);
  grad.addColorStop(0, '#fff200');
  grad.addColorStop(0.45, '#ffb300');
  grad.addColorStop(0.75, '#ff5e3a');
  grad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = grad;
  ctx.fillText(title, 0, 0);
  // A thin white top edge catches the light.
  ctx.lineWidth = fontSize * 0.012;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.strokeText(title, 0, -fontSize * 0.012);
  ctx.restore();

  // Small all-caps tagline under the title, letterspaced, flanked by rules.
  const tagline = (state.tagline || '').trim();
  if (tagline) {
    const tagSize = Math.max(10, fontSize * 0.13);
    ctx.save();
    ctx.font = `700 ${tagSize}px "Liberation Sans", "DejaVu Sans", sans-serif`;
    try { ctx.letterSpacing = `${tagSize * 0.42}px`; } catch { /* older canvas: no letterSpacing */ }
    const tagW = ctx.measureText(tagline).width + tagSize * 0.42 * tagline.length;
    const tagY = titleBaseline + fontSize * 0.24;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = tagSize * 0.4;
    ctx.fillText(tagline, cx, tagY);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(1, tagSize * 0.08);
    const ruleLen = Math.min(width * 0.08, tagW * 0.25);
    const gap = tagSize * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - tagW / 2 - gap - ruleLen, tagY);
    ctx.lineTo(cx - tagW / 2 - gap, tagY);
    ctx.moveTo(cx + tagW / 2 + gap, tagY);
    ctx.lineTo(cx + tagW / 2 + gap + ruleLen, tagY);
    ctx.stroke();
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- main render

/**
 * Renders the whole cover onto `canvas` at its own pixel size.
 * `photos` maps photo keys to { key, img } entries. `options.compare` renders
 * the plain original (no grades, no Enhance, no poster layers) for Compare mode.
 */
export function renderCover(canvas, state, photos, options = {}) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const compare = !!options.compare;
  const dec = compare
    ? { halftone: false, grain: false, vignette: false, sun: false, skyline: false, speedlines: false, sunburst: false, sticker: false, ribbon: false, heatpill: false }
    : state.decorations;

  ctx.fillStyle = '#0b0618';
  ctx.fillRect(0, 0, width, height);

  // Photo panels. A slanted layout shears every panel into a parallelogram;
  // span mode turns the panels into windows onto one big photo.
  const layout = LAYOUTS[state.layout] || LAYOUTS['hero-left'];
  const slant = layout.slant || 0;
  const spanImg = state.spanPhoto && photos[state.spanPhoto]
    ? photos[state.spanPhoto].img
    : null;
  let spanFrame = null;
  if (spanImg && spanImg.complete && spanImg.naturalWidth > 0) {
    const coverAspect = width / height;
    const imgAspect = spanImg.naturalWidth / spanImg.naturalHeight;
    let sw;
    let sh;
    if (imgAspect > coverAspect) {
      sh = spanImg.naturalHeight;
      sw = sh * coverAspect;
    } else {
      sw = spanImg.naturalWidth;
      sh = sw / coverAspect;
    }
    spanFrame = { x0: (spanImg.naturalWidth - sw) / 2, y0: (spanImg.naturalHeight - sh) / 2, w: sw, h: sh };
  }
  const rects = layoutPanelRects(state.layout, width, height);
  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    if (!panel) return;
    const photo = spanFrame ? photos[state.spanPhoto] : photos[panel.photo];
    if (!photo || !photo.img || !photo.img.complete || photo.img.naturalWidth === 0) {
      ctx.fillStyle = '#1c1030';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      return;
    }
    const gradeId = compare ? 'clean-photo' : (panel.grade || state.grade);
    const enhance = compare ? { on: false } : state.enhance;
    const posterizeOn = compare ? false : state.posterize;
    let sourceOverride = null;
    if (spanFrame) {
      sourceOverride = {
        sx: spanFrame.x0 + (rect.x / width) * spanFrame.w,
        sy: spanFrame.y0 + (rect.y / height) * spanFrame.h,
        sw: (rect.w / width) * spanFrame.w,
        sh: (rect.h / height) * spanFrame.h,
      };
    }
    const graded = gradedPanelCanvas(photo, panel, gradeId, enhance, posterizeOn, rect.w, rect.h, sourceOverride);
    if (slant) {
      // Parallelogram clip: each corner's x shifts with its height on the cover.
      const shiftAt = (y) => slant * width * (1 - y / height);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rect.x + shiftAt(rect.y), rect.y);
      ctx.lineTo(rect.x + rect.w + shiftAt(rect.y), rect.y);
      ctx.lineTo(rect.x + rect.w + shiftAt(rect.y + rect.h), rect.y + rect.h);
      ctx.lineTo(rect.x + shiftAt(rect.y + rect.h), rect.y + rect.h);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(graded, rect.x, rect.y);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rect.x + shiftAt(rect.y), rect.y);
      ctx.lineTo(rect.x + rect.w + shiftAt(rect.y), rect.y);
      ctx.lineTo(rect.x + rect.w + shiftAt(rect.y + rect.h), rect.y + rect.h);
      ctx.lineTo(rect.x + shiftAt(rect.y + rect.h), rect.y + rect.h);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(5, 0, 12, 0.6)';
      ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.002);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.drawImage(graded, rect.x, rect.y);
      ctx.strokeStyle = 'rgba(5, 0, 12, 0.6)';
      ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.002);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  });

  // Poster layers, in order: sunburst, retro sun, skyline, speed lines.
  // The sun sits in the top-left sky, where the first panel's sky usually is,
  // so it never covers a face.
  const sunX = width * 0.17;
  const sunY = height * 0.15;
  const sunR = Math.min(width, height) * 0.085;
  if (dec.sunburst) drawSunburstRays(ctx, sunX, sunY, sunR, width, height);
  if (dec.sun) drawRetroSun(ctx, sunX, sunY, sunR);
  if (dec.skyline) drawSkylineSilhouette(ctx, width, height);
  if (dec.speedlines) drawSpeedLines(ctx, width, height);

  // Texture: halftone dots, film grain, vignette.
  if (dec.halftone) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = ctx.createPattern(getHalftoneTile(), 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  if (dec.grain) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  if (dec.vignette) {
    const vig = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.42,
      width / 2, height / 2, Math.max(width, height) * 0.75,
    );
    vig.addColorStop(0, 'rgba(8, 0, 20, 0)');
    vig.addColorStop(1, 'rgba(8, 0, 20, 0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // Lettering: the giant title overlaps the photos.
  if (!compare) drawGiantTitle(ctx, width, height, state);

  // Stickers on top of everything.
  if (dec.sticker) {
    drawStarburstSticker(ctx, width * 0.93, height * 0.1, Math.min(width, height) * 0.062, 'EST.', '2026');
  }
  if (dec.ribbon && (state.ribbon || '').trim()) {
    drawCornerRibbon(ctx, width, height, state.ribbon.trim());
  }
  if (dec.heatpill) {
    const pillH = Math.min(width, height) * 0.052;
    const pillW = pillH * 7.4;
    drawHeatPill(ctx, width - pillW - width * 0.02, height - pillH - height * 0.025, pillW, pillH, state.heat || 5);
  }
}

/** Renders a cover at full export size and returns the canvas. */
export function renderExportCanvas(state, photos, sizeId) {
  const size = COVER_SIZES[sizeId] || COVER_SIZES.wide;
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  renderCover(canvas, state, photos);
  return canvas;
}
