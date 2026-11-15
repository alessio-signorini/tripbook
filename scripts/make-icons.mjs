import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/editor/icons');
const svg = await readFile(join(dir, 'icon.svg'));

const render = (size) => sharp(svg, { density: Math.max(72, (size / 512) * 72 * 2) }).resize(size, size);

await render(192).png().toFile(join(dir, 'icon-192.png'));
await render(512).png().toFile(join(dir, 'icon-512.png'));
await render(180).png().toFile(join(dir, 'apple-touch-icon.png'));

// Maskable: full-bleed dark background with the artwork inside the 80% safe zone.
const inner = await render(410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#1A1D21' } })
  .composite([{ input: inner, left: 51, top: 51 }])
  .png()
  .toFile(join(dir, 'maskable-512.png'));

console.log('Icons written to src/editor/icons');
