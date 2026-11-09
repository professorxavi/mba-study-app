// Renders PDF pages to PNG so raster figures can be inspected.
// Usage: node scripts/render-figures.mjs "<pdf path>" [pages, e.g. "3-6,9"] [scale]
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [pdfPath, pageSpec, scaleArg] = process.argv.slice(2);
if (!pdfPath) {
  console.error('Usage: node scripts/render-figures.mjs <pdf> [pages] [scale]');
  process.exit(1);
}
const scale = Number(scaleArg ?? 1.5);
const doc = await getDocument({ data: new Uint8Array(await readFile(pdfPath)) }).promise;

const pages = pageSpec
  ? pageSpec.split(',').flatMap((part) => {
      const [a, b = a] = part.split('-').map(Number);
      return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    })
  : Array.from({ length: doc.numPages }, (_, i) => i + 1);

const outDir = path.join('.figures', path.basename(pdfPath, '.pdf').replace(/[^\w.-]+/g, '_'));
await mkdir(outDir, { recursive: true });

for (const n of pages) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
  const file = path.join(outDir, `p${String(n).padStart(2, '0')}.png`);
  await writeFile(file, canvas.toBuffer('image/png'));
  console.log(file);
}
