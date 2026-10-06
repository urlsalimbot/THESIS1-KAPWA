#!/usr/bin/env node
/**
 * Render helper for the KAPWA diagram docs.
 *
 * Renders every ```mermaid and ```dot block in the docs/diagrams/*.md files to
 * its own file, in both formats by default:
 *
 *   .pdf  page-fit — the diagram is scaled onto one page, choosing the smallest
 *         of Letter / A3 / A2 that keeps label text at 5 pt or larger, so each
 *         diagram prints on exactly one sheet.
 *   .png  raster at 400 ppi by default (`--ppi=300` to change it) on a white
 *         background — for pasting into a word processor or slide deck, where a
 *         page-fitting PDF would just be an image of a page. mermaid renders
 *         through mermaid-cli's scale factor (ppi/96); Graphviz takes the dpi
 *         directly.
 *
 * Usage:
 *   node docs/diagrams/print-diagrams.mjs              # all docs, pdf + png
 *   node docs/diagrams/print-diagrams.mjs 06-erd       # one doc (name fragment)
 *   node docs/diagrams/print-diagrams.mjs --list       # list docs + chart counts
 *   node docs/diagrams/print-diagrams.mjs --pdf        # pdf only
 *   node docs/diagrams/print-diagrams.mjs --png        # png only
 *   node docs/diagrams/print-diagrams.mjs --letter     # pdf: force US Letter
 *   node docs/diagrams/print-diagrams.mjs --ppi=300    # png raster resolution
 *
 * Output: docs/diagrams/print/<doc>-<n>.pdf and <doc>-<n>.png
 *
 * Requires: puppeteer (installed in the mermaid-cli npx cache), Graphviz `dot`,
 * and PUPPETEER_EXECUTABLE_PATH pointing at a Chrome/Chromium binary, e.g.:
 *   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { dotToDrawio } from './dot-to-drawio.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = HERE;
const OUT_DIR = join(HERE, 'print');
const OUT_DRAWIO_DIR = join(HERE, 'drawio');
const MARGIN = 24; // points
const CAPTION_PT = 16; // band reserved at the foot of the page for the caption

// Page sizes are carried in inches because page.pdf() silently treats a bare
// number as CSS pixels, which would shrink the paper to 0.75x and clip the
// .page div. Inches are honoured exactly.
const A3_LANDSCAPE = { wIn: 16.54, hIn: 11.69 };
const A3_PORTRAIT = { wIn: 11.69, hIn: 16.54 };
const A2_LANDSCAPE = { wIn: 23.4, hIn: 16.5 }; // 420 x 594 mm, last resort
const A2_PORTRAIT = { wIn: 16.5, hIn: 23.4 };
const LETTER = { wIn: 8.5, hIn: 11 }; // US Letter portrait

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('-'));
const listOnly = args.includes('--list');
const forceLetter = args.includes('--letter');
// Raster resolution for the PNG pass. Graphviz takes it as dpi; mermaid-cli
// takes a scale factor, so the same number is converted to ppi/96 there.
const PPI = Number((args.find((a) => a.startsWith('--ppi=')) || '--ppi=400').split('=')[1]) || 400;
// Both formats are the default. Naming one format narrows the run to it, so
// `--png` keeps its original meaning (png only) and `--pdf` is its new mirror.
// Passing both is the same as passing neither.
const wantPng = args.includes('--png');
const wantPdf = args.includes('--pdf');
const wantDrawio = args.includes('--drawio');
const narrowed = wantPng || wantPdf || wantDrawio;
const doPng = wantPng || !narrowed;
const doPdf = wantPdf || !narrowed;
// Editable .drawio exports ride along by default; only ```dot charts have an
// exporter so far (see dot-to-drawio.mjs), mermaid blocks are skipped.
const doDrawio = wantDrawio || !narrowed;

// Auto-pick the smallest page that keeps the text at ~5pt or larger. Both A3
// orientations are tried because a tall diagram (e.g. `cases`, 63 rows) clears
// 5pt in portrait but not landscape -- and portrait is half the paper of A2.
// The order matters: first page that clears the floor wins.
const CANDIDATES = [LETTER, A3_LANDSCAPE, A3_PORTRAIT, A2_LANDSCAPE, A2_PORTRAIT];

function pageFor(svgW, svgH) {
  const fitsPt = (page) => {
    const uwPt = page.wIn * 72 - 2 * MARGIN;
    const uhPt = page.hIn * 72 - 2 * MARGIN - CAPTION_PT;
    return 14 * Math.min(uwPt / svgW, uhPt / svgH);
  };
  if (forceLetter || svgW <= 0 || svgH <= 0) return LETTER;
  for (const page of CANDIDATES) {
    if (fitsPt(page) >= 5) return page;
  }
  // Nothing clears 5pt: fall back to whichever A2 orientation reads largest.
  return fitsPt(A2_PORTRAIT) > fitsPt(A2_LANDSCAPE) ? A2_PORTRAIT : A2_LANDSCAPE;
}

const files = readdirSync(DOCS_DIR)
  .filter((f) => /^\d{2}-.+\.md$/.test(f))
  .filter((f) => !filter || f.includes(filter))
  .sort();

// Pull the intrinsic size out of a mermaid SVG's viewBox.
function svgDimensions(svg) {
  const m = svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
}

/**
 * Stamp a PNG's pHYs chunk with the raster resolution. Graphviz scales the
 * pixels to the requested dpi but leaves the metadata at the default, so the
 * file would place at 72 dpi in a word processor (a 6000 px diagram would land
 * 83 inches wide). Rewriting pHYs makes "400 ppi" true for layout too.
 */
function setPngDpi(file, ppi) {
  const buf = readFileSync(file);
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(SIG)) return; // not a PNG — leave it alone

  const chunks = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const end = off + 12 + len;
    if (end > buf.length) break;
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off = end;
    if (type === 'IEND') break;
  }

  const ppm = Math.round(ppi / 0.0254); // pixels per metre
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(ppm, 0);
  phys.writeUInt32BE(ppm, 4);
  phys.writeUInt8(1, 8); // unit: metre

  const out = [SIG];
  let inserted = false;
  for (const c of chunks) {
    if (c.type === 'pHYs') continue; // replaced below
    if (!inserted && c.type === 'IDAT') {
      out.push(chunkBuffer('pHYs', phys));
      inserted = true;
    }
    out.push(chunkBuffer(c.type, c.data));
  }
  writeFileSync(file, Buffer.concat(out));
}

function chunkBuffer(type, data) {
  const typeBuf = Buffer.from(type, 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function extractCharts(md) {
  const charts = [];
  // ```mermaid → mermaid-cli; ```dot → Graphviz. Both render to their own file.
  const re = /```(mermaid|dot)\n([\s\S]*?)```/g;
  let m;
  let i = 0;
  while ((m = re.exec(md))) {
    charts.push({ index: ++i, lang: m[1], code: m[2] });
  }
  return charts;
}

async function svgToLetterPdf(browser, svgRaw, outPath, title) {
  const PAGE = pageFor(...svgDimensions(svgRaw));
  const PAGE_W_PT = PAGE.wIn * 72;
  const PAGE_H_PT = PAGE.hIn * 72;
  const page = await browser.newPage();
  // mermaid emits width="100%" and no height, which collapses to zero inside a
  // flex container. Pin explicit dimensions from the viewBox so the page scales.
  let svg = svgRaw;
  const vb = svg.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/);
  if (vb) {
    const [, , , w, h] = vb;
    svg = svg
      .replace(/<svg([^>]*)>/, (_m, attrs) =>
        `<svg${attrs.replace(/\s*width="[^"]*"/, '').replace(/\s*height="[^"]*"/, '')} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`);
  }
  // Absolute, not flex-centred: the diagram box is pinned to the margins and
  // the caption to the foot, so neither can drift into the printer's
  // unprintable edge and the reserved heights are exact.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:white}
    .page{position:relative;width:${PAGE_W_PT}pt;height:${PAGE_H_PT}pt;overflow:hidden}
    .diagram{position:absolute;left:${MARGIN}pt;top:${MARGIN}pt;width:${PAGE_W_PT - 2 * MARGIN}pt;height:${PAGE_H_PT - 2 * MARGIN - CAPTION_PT}pt;min-width:0;min-height:0}
    .diagram svg{width:100%;height:100%;display:block}
    .caption{position:absolute;bottom:${MARGIN}pt;left:0;right:0;text-align:center;font:9pt sans-serif;color:#333}
  </style></head><body>
    <div class="page"><div class="diagram">${svg}</div><div class="caption">${title}</div></div>
  </body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outPath,
    width: `${PAGE.wIn}in`,
    height: `${PAGE.hIn}in`,
    printBackground: true,
  });
  await page.close();
}

async function importPuppeteer() {
  // puppeteer ships inside the mermaid-cli npx cache; resolve it by scanning
  const npxRoot = join(process.env.HOME || '', '.npm', '_npx');
  const candidates = [];
  try {
    for (const d of readdirSync(npxRoot)) {
      const p = join(npxRoot, d, 'node_modules', 'puppeteer');
      try { readdirSync(p); candidates.push(p); } catch {}
    }
  } catch {}
  if (candidates.length === 0) {
    throw new Error('puppeteer not found in npx cache - run mmdc once first');
  }
  const url = pathToFileURL(join(candidates[0], 'lib', 'puppeteer', 'puppeteer.js')).href;
  const mod = await import(url);
  return mod.default || mod;
}

/** Render every block to a PNG at `PPI`. Returns the count written. */
function renderPngs() {
  let total = 0;
  for (const f of files) {
    const md = readFileSync(join(DOCS_DIR, f), 'utf8');
    const charts = extractCharts(md);
    if (charts.length === 0) continue;
    const base = f.replace('.md', '');
    const outName = (c) => join(OUT_DIR, `${base}-${String(c.index).padStart(2, '0')}.png`);

    // mermaid-cli renders a whole document in one call and numbers its own
    // outputs among the mermaid blocks only, so keep that numbering separate
    // from the document-level chart index used for file names.
    if (charts.some((c) => c.lang === 'mermaid')) {
      const tmpBase = join('/tmp', `png-${base}`);
      execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', '-i', join(DOCS_DIR, f), '-o', tmpBase + '.png', '-e', 'png', '-s', String(PPI / 96), '-b', 'white'], {
        cwd: join(HERE, '..', '..', 'kapwa-server'),
        stdio: 'pipe',
        env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable' },
      });
      let mi = 0;
      for (const c of charts) {
        if (c.lang !== 'mermaid') continue;
        mi++;
        copyFileSync(`${tmpBase}-${mi}.png`, outName(c));
        setPngDpi(outName(c), PPI);
        total++;
      }
    }

    // Graphviz takes the resolution directly, so the PNG is exactly `PPI`.
    for (const c of charts) {
      if (c.lang !== 'dot') continue;
      execFileSync('dot', [`-Gdpi=${PPI}`, '-Tpng', '-o', outName(c)], { input: c.code, stdio: ['pipe', 'pipe', 'pipe'] });
      setPngDpi(outName(c), PPI);
      total++;
    }
  }
  return total;
}

/** Render every block to a page-fitting PDF. Returns the count written. */
async function renderPdfs() {
  const puppeteer = await importPuppeteer();
  // Prefer the system Chrome; puppeteer's bundled download is often absent.
  const systemChrome = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].find(p => existsSync(p));
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(systemChrome ? { executablePath: systemChrome } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let total = 0;
  for (const f of files) {
    const md = readFileSync(join(DOCS_DIR, f), 'utf8');
    const charts = extractCharts(md);
    if (charts.length === 0) continue;
    const base = f.replace('.md', '');
    // mermaid blocks: one mmdc call renders them all to SVGs
    const svgBase = join('/tmp', `print-${base}`);
    let mermaidSvgs = [];
    if (charts.some((c) => c.lang === 'mermaid')) {
      execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', '-i', join(DOCS_DIR, f), '-o', svgBase + '.svg', '-b', 'white'], {
        cwd: join(HERE, '..', '..', 'kapwa-server'),
        stdio: 'pipe',
        env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable' },
      });
      mermaidSvgs = charts.filter((c) => c.lang === 'mermaid').map((_c, i) =>
        readFileSync(`${svgBase}-${i + 1}.svg`, 'utf8'));
    }
    let mi = 0;
    for (const c of charts) {
      // Graphviz SVGs carry the same width/height + viewBox shape, so they
      // flow through the same page-fitting renderer as the mermaid ones.
      const svg = c.lang === 'dot'
        ? execFileSync('dot', ['-Tsvg'], { input: c.code }).toString()
        : mermaidSvgs[mi++];
      await svgToLetterPdf(browser, svg,
        join(OUT_DIR, `${base}-${String(c.index).padStart(2, '0')}.pdf`),
        `${f} — Diagram ${c.index}`);
      total++;
    }
  }
  await browser.close();
  return total;
}

/** Nearest preceding markdown heading for the Nth chart — used as page name. */
function headingFor(md, chartIndex) {
  const re = /```(mermaid|dot)\n[\s\S]*?```/g;
  let m;
  let i = 0;
  while ((m = re.exec(md))) {
    i++;
    if (i !== chartIndex) continue;
    const before = md.slice(0, m.index);
    const headings = [...before.matchAll(/^#{1,6}\s+(.+)$/gm)];
    const last = headings.at(-1)?.[1]?.trim();
    return last ? last.replace(/^\d+(\.\d+)*[.\s—-]*/, '').trim() : null;
  }
  return null;
}

/** Export every ```dot chart to an editable .drawio file. Returns the count. */
function renderDrawio() {
  let total = 0;
  mkdirSync(OUT_DRAWIO_DIR, { recursive: true });
  for (const f of files) {
    const md = readFileSync(join(DOCS_DIR, f), 'utf8');
    const charts = extractCharts(md);
    if (charts.length === 0) continue;
    const base = f.replace('.md', '');
    for (const c of charts) {
      if (c.lang !== 'dot') continue; // mermaid → drawio has no exporter yet
      const pageName = headingFor(md, c.index) ?? `${base} — Diagram ${c.index}`;
      const xml = dotToDrawio(c.code, pageName);
      writeFileSync(join(OUT_DRAWIO_DIR, `${base}-${String(c.index).padStart(2, '0')}.drawio`), xml);
      total++;
    }
  }
  return total;
}

async function main() {
  if (listOnly) {
    for (const f of files) {
      const md = readFileSync(join(DOCS_DIR, f), 'utf8');
      console.log(`${f}: ${extractCharts(md).length} diagram(s)`);
    }
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // PNG first: it is the fast pass, so a failure in the slower PDF pass still
  // leaves the images on disk.
  const pngs = doPng ? renderPngs() : 0;
  const pdfs = doPdf ? await renderPdfs() : 0;
  const drawios = doDrawio ? renderDrawio() : 0;

  const parts = [];
  if (pdfs) parts.push(`${pdfs} PDF(s) (page-sized)`);
  if (pngs) parts.push(`${pngs} PNG(s) (${PPI} ppi)`);
  if (drawios) parts.push(`${drawios} .drawio (editable)`);
  console.log(`\nDone: ${parts.join(' + ') || 'nothing to render'} in ${OUT_DIR}`);

  // The two formats should always cover the same set; a gap means one pass
  // silently skipped a document.
  if (pdfs && pngs && pdfs !== pngs) {
    console.warn(`WARNING: ${pdfs} PDF(s) but ${pngs} PNG(s) — the sets differ.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});