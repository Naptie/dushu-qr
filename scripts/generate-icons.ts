#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const staticDir = path.resolve(import.meta.dirname, '../static');
const outDir = path.join(staticDir, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const ACCENT = '#ffd23f';
const FG = '#ffffff';

// Everything is drawn on a 64x64 canvas: three solid finder eyes and one accent dot.
const eye = (x: number, y: number) =>
  `<path fill-rule="evenodd" d="M${x + 5} ${y}h14a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H${x + 5}a5 5 0 0 1-5-5V${y + 5}a5 5 0 0 1 5-5zM${x + 7} ${y + 5}a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V${y + 7}a2 2 0 0 0-2-2z"/>` +
  `<rect x="${x + 8.5}" y="${y + 8.5}" width="7" height="7" rx="2"/>`;

// 3x3 data grid in the fourth quadrant: 1 = white module, 2 = accent module
// Data area (34..58) on a 4x4 grid; each module is [row, col, span, accent?].
// Eyes span 6..58 so the whole mark is centred on the 64x64 canvas.
const pitch = 6;
const mods: [number, number, number, boolean?][] = [
  [0, 0, 1],
  [0, 2, 2],
  [1, 1, 2],
  [1, 3, 1],
  [2, 0, 1],
  [2, 2, 1],
  [2, 3, 1, true],
  [3, 0, 2],
  [3, 3, 1]
];
const modules = mods.map(([r, c, span, accent]) => {
  const w = (span - 1) * pitch + 4.8;
  return `<rect x="${34.6 + c * pitch}" y="${34.6 + r * pitch}" width="${w}" height="4.8" rx="1.6"${accent ? ` fill="${ACCENT}"` : ''}/>`;
});

const content = [eye(6, 6), eye(34, 6), eye(6, 34), ...modules].join('');

const svg = (opts: { rounded: boolean; scale?: number }) => {
  const s = opts.scale ?? 1;
  const t = s === 1 ? '' : ` transform="translate(${32 - 32 * s} ${32 - 32 * s}) scale(${s})"`;
  const rx = opts.rounded ? ' rx="14"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs><rect width="64" height="64"${rx} fill="url(#g)"/><g fill="${FG}"${t}>${content}</g></svg>`;
};
const rounded = svg({ rounded: true });
// Maskable icons need content inside the central safe zone.
const maskable = svg({ rounded: false, scale: 0.82 });

fs.writeFileSync(path.join(staticDir, 'favicon.svg'), rounded + '\n');

for (const [name, size, source] of [
  ['icon-192.png', 192, rounded],
  ['icon-512.png', 512, rounded],
  ['icon-maskable-512.png', 512, maskable],
  ['apple-touch-icon.png', 180, svg({ rounded: false, scale: 0.9 })]
] as const) {
  await sharp(Buffer.from(source), { density: 600 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, name));
  console.log('wrote', path.join(outDir, name));
}

// apple-touch-icon lives at the site root for iOS
fs.copyFileSync(
  path.join(outDir, 'apple-touch-icon.png'),
  path.join(staticDir, 'apple-touch-icon.png')
);
console.log('done');
