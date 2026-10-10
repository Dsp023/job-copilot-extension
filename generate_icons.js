const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure output dir exists
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Generate SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e0e7ff" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#4338ca" flood-opacity="0.5" />
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Squircle Base with Drop Shadow -->
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bgGrad)" filter="url(#glow)" />
  
  <!-- Subtle Inner Border Highlight -->
  <rect x="8.5" y="8.5" width="111" height="111" rx="27.5" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />

  <!-- Electric Sparkle Emblem -->
  <!-- Main Lightning / Spark -->
  <path d="M 72 24 L 38 68 L 62 68 L 56 104 L 90 60 L 66 60 Z" 
        fill="url(#boltGrad)" 
        stroke="#ffffff" 
        stroke-width="1"
        stroke-linejoin="round" />

  <!-- Tiny Accents / Career Star Sparkles -->
  <circle cx="88" cy="38" r="3.5" fill="#38bdf8" opacity="0.9" />
  <circle cx="40" cy="90" r="2.5" fill="#f472b6" opacity="0.8" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon, 'utf8');
console.log('✓ Created icons/icon.svg');

// 2. Pure PNG Generator
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Point in polygon test for lightning bolt
const boltPoly = [
  [72, 24],
  [38, 68],
  [62, 68],
  [56, 104],
  [90, 60],
  [66, 60]
];

function isInsidePoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function renderPixel(x, y, size) {
  // Normalize to 128x128 coordinate space
  const scale = 128 / size;
  const cx = (x + 0.5) * scale;
  const cy = (y + 0.5) * scale;

  // Squircle rounded rect check (margin 8, size 112, radius 28)
  const left = 8, top = 8, right = 120, bottom = 120, rad = 28;
  
  let inSquircle = false;
  if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
    let dx = 0, dy = 0;
    if (cx < left + rad) dx = (left + rad) - cx;
    else if (cx > right - rad) dx = cx - (right - rad);

    if (cy < top + rad) dy = (top + rad) - cy;
    else if (cy > bottom - rad) dy = cy - (bottom - rad);

    if (dx === 0 || dy === 0 || (dx * dx + dy * dy <= rad * rad)) {
      inSquircle = true;
    }
  }

  if (!inSquircle) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Linear gradient from (99, 102, 241) to (124, 58, 237)
  const t = Math.max(0, Math.min(1, (cx + cy) / 256));
  let r = Math.round(99 + (124 - 99) * t);
  let g = Math.round(102 + (58 - 102) * t);
  let b = Math.round(241 + (237 - 241) * t);
  let a = 255;

  // Check bolt inside (with 2x2 supersampling for smooth edges)
  let boltHits = 0;
  const samples = [
    [-0.25, -0.25], [0.25, -0.25],
    [-0.25,  0.25], [0.25,  0.25]
  ];

  for (const [sx, sy] of samples) {
    const spx = (x + 0.5 + sx) * scale;
    const spy = (y + 0.5 + sy) * scale;
    if (isInsidePoly(spx, spy, boltPoly)) {
      boltHits++;
    }
  }

  if (boltHits > 0) {
    const frac = boltHits / 4;
    // Blend with white/light-cyan
    const boltR = 255, boltG = 255, boltB = 255;
    r = Math.round(r * (1 - frac) + boltR * frac);
    g = Math.round(g * (1 - frac) + boltG * frac);
    b = Math.round(b * (1 - frac) + boltB * frac);
  } else {
    // Check sparkle dot 1 at (88, 38) radius 3.5
    const dist1 = Math.hypot(cx - 88, cy - 38);
    if (dist1 <= 3.5) {
      r = 56; g = 189; b = 248; // cyan
    }
  }

  return [r, g, b, a];
}

function buildPng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const rawScanlines = Buffer.alloc(size * (1 + size * 4));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    rawScanlines[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = renderPixel(x, y, size);
      rawScanlines[offset++] = r;
      rawScanlines[offset++] = g;
      rawScanlines[offset++] = b;
      rawScanlines[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawScanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const sizes = [16, 32, 48, 128];
sizes.forEach(sz => {
  const pngBuf = buildPng(sz);
  const outPath = path.join(iconsDir, `icon-${sz}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`✓ Created icons/icon-${sz}.png (${pngBuf.length} bytes)`);
});
