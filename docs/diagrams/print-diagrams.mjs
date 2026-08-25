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
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = HERE;
const OUT_DIR = join(HERE, 'print');
const LETTER = { width: 612, height: 792 }; // US Letter in points
const MARGIN = 24; // points

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('-'));
const listOnly = args.includes('--list');
const pngMode = args.includes('--png');

const files = readdirSync(DOCS_DIR)
  .filter((f) => /^\d{2}-.+\.md$/.test(f))
  .filter((f) => !filter || f.includes(filter))
  .sort();

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

async function svgToLetterPdf(browser, svg, outPath, title) {
  const page = await browser.newPage();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:white}
    .page{width:${LETTER.width}pt;height:${LETTER.height}pt;display:flex;align-items:center;justify-content:center}
    .diagram{max-width:${LETTER.width - 2 * MARGIN}pt;max-height:${LETTER.height - 2 * MARGIN}pt}
    .diagram svg{width:auto;height:auto;max-width:100%;max-height:100%}
    .caption{position:absolute;bottom:6pt;left:0;right:0;text-align:center;font:9pt sans-serif;color:#333}
  </style></head><body>
    <div class="page"><div class="diagram">${svg}</div><div class="caption">${title}</div></div>
  </body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outPath, width: LETTER.width, height: LETTER.height, printBackground: true });
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
  const browser = await puppeteer.launch({ headless: 'new' });

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
  console.log(`\nDone: ${total} letter-size PDF(s) in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});