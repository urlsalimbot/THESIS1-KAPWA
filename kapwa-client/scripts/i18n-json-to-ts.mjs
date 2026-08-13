import { readFileSync, writeFileSync } from 'node:fs';

// Two inputs, one canonical en tree:
// 1. curated.json — committed seed for keys the parser can never extract
//    (dynamic-key maps like status.* used via display helpers, and keys
//    whose t() calls carry no explicit default, e.g. time.* from format.ts)
// 2. parser output en.json — keys extracted from t() calls in code
// Parser wins on overlap only when its value is non-empty (extracted with
// an explicit default); curated values survive otherwise.
const curated = JSON.parse(readFileSync('scripts/i18n-extract/curated.json', 'utf8'));
const raw = JSON.parse(readFileSync('scripts/i18n-extract/en.json', 'utf8'));
const parsed = raw.translation ?? raw;

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function merge(base, overlay) {
  for (const [k, v] of Object.entries(overlay)) {
    if (isObj(v) && isObj(base[k])) {
      merge(base[k], v);
    } else if (typeof v === 'string' && v.trim() !== '') {
      base[k] = v;
    } else if (!(k in base)) {
      base[k] = v ?? '';
    }
  }
  return base;
}

const tree = merge(curated, parsed);

function indent(n) { return '  '.repeat(n); }
function emit(obj, depth) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (isObj(v)) {
      lines.push(`${indent(depth)}${JSON.stringify(k)}: {`);
      lines.push(...emit(v, depth + 1));
      lines.push(`${indent(depth)}},`);
    } else {
      lines.push(`${indent(depth)}${JSON.stringify(k)}: ${JSON.stringify(String(v))},`);
    }
  }
  return lines;
}

const body = emit(tree, 1);
const out = `const en = {\n${body.join('\n')}\n} as const;\n\nexport default en;\n\n// Value-widened recursive map: keys must match the en tree exactly, values\n// are plain strings (so fil can hold different translations).\ntype DeepString<T> = { [K in keyof T]: T[K] extends Record<string, unknown> ? DeepString<T[K]> : string };\nexport type EnLocale = DeepString<typeof en>;\n`;
writeFileSync('src/i18n/locales/en/index.ts', out);

// Enforce fil parity: add missing keys to fil (English placeholder value,
// marked for Task 7 translation). The fil file is hand-maintained, so keep
// its existing values when the key already exists.
let fil = {};
try {
  const filSrc = readFileSync('src/i18n/locales/fil/index.ts', 'utf8');
  const start = filSrc.indexOf('const fil: EnLocale = ');
  const end = filSrc.indexOf('\n};', start);
  if (start !== -1 && end !== -1) {
    // end points at the `\n` of `\n};` — slice through the closing `}`
    fil = new Function(`return (${filSrc.slice(start + 'const fil: EnLocale = '.length, end + 2)});`)();
  }
} catch { fil = {}; }

let added = 0;
function syncFil(enPart, filPart, path) {
  for (const [k, v] of Object.entries(enPart)) {
    if (isObj(v)) {
      if (!isObj(filPart[k])) filPart[k] = {};
      syncFil(v, filPart[k], `${path}${k}.`);
    } else if (!(k in filPart)) {
      filPart[k] = v; // TEMP: English placeholder, translate in Task 7
      added++;
    }
  }
}
syncFil(tree, fil, '');
const filOut = `import type { EnLocale } from '../en';\n\n// TEMP: some values are English placeholders until Task 7 translation.\nconst fil: EnLocale = ${JSON.stringify(fil, null, 2)};\n\nexport default fil;\n`;
writeFileSync('src/i18n/locales/fil/index.ts', filOut);

console.log(`wrote ${body.length} key lines to en/index.ts; added ${added} placeholder keys to fil/index.ts`);
