#!/usr/bin/env node
/**
 * Print helper for the KAPWA diagram docs.
 *
 * Renders every ```mermaid block in the docs/diagrams/*.md files to its own
 * US-Letter-size PDF (612 x 792 pt), scaling the diagram to fit the page with
 * a margin, so each diagram prints on exactly one letter page.
 *
 * Usage:
 *   node docs/diagrams/print-diagrams.mjs              # all docs
 *   node docs/diagrams/print-diagrams.mjs 06-erd       # one doc (name fragment)
 *   node docs/diagrams/print-diagrams.mjs --list       # list docs + chart counts
 *
 * Output: docs/diagrams/print/<doc>-<n>.pdf  (one file per mermaid block)
 *
 * Requires: puppeteer (installed in the mermaid-cli npx cache) and
 * PUPPETEER_EXECUTABLE_PATH pointing at a Chrome/Chromium binary, e.g.:
 *   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = HERE;
const OUT_DIR = join(HERE, 'print');
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
const pngMode = args.includes('--png');
const forceLetter = args.includes('--letter');

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

function extractCharts(md) {
  const charts = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let m;
  let i = 0;
  while ((m = re.exec(md))) {
    charts.push({ index: ++i, code: m[1] });
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

async function main() {
  if (listOnly) {
    for (const f of files) {
      const md = readFileSync(join(DOCS_DIR, f), 'utf8');
      console.log(`${f}: ${extractCharts(md).length} diagram(s)`);
    }
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  if (pngMode) {
    // PNG mode: mmdc renders PNG directly at scale 2 (no puppeteer needed)
    let total = 0;
    for (const f of files) {
      const md = readFileSync(join(DOCS_DIR, f), 'utf8');
      const charts = extractCharts(md);
      if (charts.length === 0) continue;
      const base = join('/tmp', `png-${f.replace('.md', '')}`);
      execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', '-i', join(DOCS_DIR, f), '-o', base + '.png', '-e', 'png', '-s', '2', '-b', 'white'], {
        cwd: join(HERE, '..', '..', 'kapwa-server'),
        stdio: 'pipe',
        env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable' },
      });
      for (const c of charts) {
        const src = `${base}-${c.index}.png`;
        const out = join(OUT_DIR, `${f.replace('.md', '')}-${String(c.index).padStart(2, '0')}.png`);
        copyFileSync(src, out);
        total++;
        console.log(`  wrote ${out}`);
      }
    }
    console.log(`\nDone: ${total} PNG(s) in ${OUT_DIR}`);
    return;
  }

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
    // Render all charts of this doc to SVGs in one mmdc call
    const svgBase = join('/tmp', `print-${f.replace('.md', '')}`);
    execFileSync('npx', ['-y', '@mermaid-js/mermaid-cli', '-i', join(DOCS_DIR, f), '-o', svgBase + '.svg', '-b', 'white'], {
      cwd: join(HERE, '..', '..', 'kapwa-server'),
      stdio: 'pipe',
      env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable' },
    });
    for (const c of charts) {
      const svgPath = `${svgBase}-${c.index}.svg`;
      const svg = readFileSync(svgPath, 'utf8');
      const out = join(OUT_DIR, `${f.replace('.md', '')}-${String(c.index).padStart(2, '0')}.pdf`);
      await svgToLetterPdf(browser, svg, out, `${f} — Diagram ${c.index}`);
      total++;
      console.log(`  wrote ${out}`);
    }
  }
  await browser.close();
  console.log(`\nDone: ${total} PDF(s) in ${OUT_DIR} (page size chosen per diagram; --letter forces US Letter)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});