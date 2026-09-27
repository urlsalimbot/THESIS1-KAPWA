#!/usr/bin/env node
// Live GIS builder preview — watch + serve.
//
// Watches the GIS builder sources, recompiles `src/gis/gis-pdf.builder.ts` with
// a fast one-shot `tsc` emit into `.preview-build/` (inside kapwa-server so
// `node_modules` resolves `pdfkit`), renders the GIS with the exact fixture the
// sample renderer uses, and serves pdf/preview over http://localhost:8678.
//
// Usage:
//   node scripts/gis-preview.mjs          # watch + serve (default)
//   node scripts/gis-preview.mjs --once   # render once and exit
//   node scripts/gis-preview.mjs --port 9000
//
// Open http://localhost:8678 in a browser — the page polls /status and
// refreshes the rendered PNG whenever a render completes.

import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const OUT_DIR = path.join(root, '.preview-build');
const OUT_PDF = path.join(repoRoot, 'pdf', 'preview', '04-general-intake-sheet.pdf');
const OUT_PNG = path.join(repoRoot, 'pdf', 'preview', '04-general-intake-sheet.png');
const SERVE_ROOT = path.join(repoRoot, 'pdf', 'preview');

// ---------------------------------------------------------------------------
// GIS fixture — mirrors scripts/render-pdf-samples.mjs and gis-pdf.builder.spec.ts
// ---------------------------------------------------------------------------
const gisData = {
  controlNo: 'KAPWA-2026-0001',
  caseId: 'c1',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  hasRenewal: false,
  clientCategory: 'Indigent People',
  referrals: [{ reason: 'Medical' }],
  assignedWorkerName: 'Maria Santos',
  approvedByRole: 'social_worker',
  assessment: 'Eligible for financial assistance; relatives are in a similar situation and cannot provide support.',
  beneficiary: {
    surname: 'Dela Cruz',
    firstName: 'Juan',
    middleName: 'M',
    extension: 'Jr.',
    sex: 'Male',
    dob: new Date('1990-05-15'),
    placeOfBirth: 'Norzagaray',
    civilStatus: 'Married',
    occupation: 'Fisherman',
    income: 5000,
    phone: '09171234567',
    address: {
      street: 'Purok 1',
      barangay: 'Bigte',
      city: 'Norzagaray',
      province: 'Bulacan',
      region: '',
    },
  },
  claimant: {
    surname: 'Dela Cruz',
    firstName: 'Pedro',
    middleName: 'P',
    sex: 'Male',
    dob: new Date('2000-01-01'),
    civilStatus: 'Single',
    occupation: 'Student',
    income: 0,
    phone: '09201234567',
    address: { street: '', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '' },
    relationshipToBeneficiary: 'Son',
  },
  familyMembers: [
    { fullName: 'Dela Cruz, Juan M', relationship: 'Self', age: 36, occupation: 'Fisherman', income: 5000 },
    { fullName: 'Dela Cruz, Maria L', relationship: 'Wife', age: 33, occupation: 'Tindera', income: 2500 },
  ],
  interventions: [{ provided: 'FOOD ASSISTANCE', amount: 3000, fundSource: '4Ps' }],
};

// ---------------------------------------------------------------------------
// Render state (exposed via /status)
// ---------------------------------------------------------------------------
const state = {
  count: 0,                 // increments on every completed render attempt
  lastOk: false,
  lastRender: null,         // ISO timestamp of the last successful render
  lastPngBytes: 0,
  error: null,              // compile/render error text (null when OK)
  lastEvent: null,          // ISO timestamp of the last watched-file change
  lastEventName: null,      // filename of the last watched-file change
  watcher: true,
};

// ---------------------------------------------------------------------------
// Build + render
// ---------------------------------------------------------------------------
function stamp() {
  return new Date().toLocaleTimeString('en-PH', { hour12: false });
}

function compile() {
  // Use the locally installed tsc binary — never `npx`, which can block
  // forever on a registry prompt and wedge the watcher's event loop.
  const TSC = path.join(root, 'node_modules', '.bin', 'tsc');
  if (!fs.existsSync(TSC)) {
    throw new Error('tsc not found at kapwa-server/node_modules/.bin/tsc — run `npm install` in kapwa-server');
  }
  const r = spawnSync(
    TSC, [
      'src/gis/gis-pdf.builder.ts',
      '--outDir', '.preview-build',
      '--module', 'commonjs',
      '--moduleResolution', 'node',
      '--target', 'es2022',
      '--esModuleInterop',
      '--skipLibCheck',
      '--declaration', 'false',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 },
  );
  if (r.error) {
    throw new Error(`tsc could not run: ${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(`tsc failed:\n${(r.stdout || '') + (r.stderr || '')}`);
  }
  // The GIS letterhead embeds the DSWD seal from src/gis/assets; mirror the
  // assets next to the emitted builder so the preview is byte-faithful.
  const srcAssets = path.join(root, 'src', 'gis', 'assets');
  const dstAssets = path.join(OUT_DIR, 'gis', 'assets');
  if (fs.existsSync(srcAssets)) {
    fs.mkdirSync(dstAssets, { recursive: true });
    for (const f of fs.readdirSync(srcAssets)) {
      fs.copyFileSync(path.join(srcAssets, f), path.join(dstAssets, f));
    }
  }
}

function render() {
  const req = createRequire(path.join(OUT_DIR, 'index.cjs'));
  // Node caches required modules in memory — without this, every render after
  // the first would reuse the ORIGINAL compiled builder (and compiled
  // constants/types) and the preview would never reflect edits. Drop every
  // cached module emitted into .preview-build on each render.
  for (const id of Object.keys(req.cache)) {
    if (id.startsWith(OUT_DIR)) delete req.cache[id];
  }
  const builderPath = path.join(OUT_DIR, 'gis', 'gis-pdf.builder.js');
  const { buildGisPdf } = req(builderPath);
  return buildGisPdf(gisData).then((buffer) => {
    fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
    fs.writeFileSync(OUT_PDF, buffer);
    execFileSync('pdftoppm', [
      '-r', '110', '-png', '-singlefile', OUT_PDF,
      OUT_PNG.replace(/\.png$/, ''),
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    return buffer.length;
  });
}

async function runOnce() {
  const t0 = Date.now();
  state.count += 1;
  try {
    compile();
    const bytes = await render();
    state.lastOk = true;
    state.lastRender = new Date().toISOString();
    state.lastPngBytes = bytes;
    state.error = null;
    const elapsed = Date.now() - t0;
    console.log(`[${stamp()}] rendered 04-general-intake-sheet.pdf (${bytes.toLocaleString()} B) in ${elapsed} ms`);
  } catch (err) {
    state.lastOk = false;
    state.error = err.message.split('\n').slice(0, 6).join('\n');
    console.error(`[${stamp()}] FAILED: ${state.error}`);
  }
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------
const WATCH_PATHS = [
  path.join(root, 'src', 'gis'),
  path.join(root, 'src', 'common', 'constants.ts'),
];

const watchers = new Set();
let timer = null;
let busy = false;

function arm() {
  for (const w of watchers) {
    try { w.close(); } catch { /* ignore */ }
  }
  watchers.clear();
  for (const p of WATCH_PATHS) {
    try {
      const w = fs.watch(p, { persistent: true }, (eventType, filename) => {
        state.lastEvent = new Date().toISOString();
        state.lastEventName = filename ? String(filename) : String(p);
        console.log(`[${stamp()}] file event: ${eventType} ${filename ? String(filename) : path.basename(p)}`);
        schedule();
      });
      watchers.add(w);
    } catch {
      console.error(`[${stamp()}] cannot watch ${p}`);
    }
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (busy) return schedule(); // re-arm after the current pass
    busy = true;
    await runOnce();
    busy = false;
    arm(); // re-arm so editor atomic-save renames do not kill the watcher
  }, 250);
}

// ---------------------------------------------------------------------------
// Tiny static server for pdf/preview + /status
// ---------------------------------------------------------------------------
function startServer(port) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.md': 'text/plain; charset=utf-8',
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(state));
      return;
    }
    if (u.pathname !== '/' && !u.pathname.startsWith('/04-general-intake-sheet')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    const file = path.normalize(path.join(SERVE_ROOT, u.pathname === '/' ? 'index.html' : u.pathname));
    if (!file.startsWith(SERVE_ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
  server.listen(port, () => {
    console.log(`Preview server: http://localhost:${port}   (Ctrl+C to stop)`);
  });
  server.on('error', (err) => {
    // Do NOT exit on a busy port: another preview instance may already be
    // serving. Keep watching and rendering; the other server/pages still see
    // the fresh outputs.
    if (err.code === 'EADDRINUSE') {
      console.log(`Port :${port} is already in use — another preview instance is serving http://localhost:${port}; this instance keeps watching and rendering.`);
      return;
    }
    console.error(`Preview server error: ${err.message}`);
  });
  return server;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const once = process.argv.includes('--once');
const portArg = process.argv.find((a) => a.startsWith('--port='));
const port = portArg ? Number(portArg.split('=')[1]) : 8678;

if (once) {
  runOnce().then(() => process.exit(0));
} else {
  runOnce().then(arm);
  startServer(port);
  console.log('Watching for GIS source changes…');
  process.on('SIGINT', () => {
    for (const w of watchers) { try { w.close(); } catch { /* ignore */ } }
    process.exit(0);
  });
}