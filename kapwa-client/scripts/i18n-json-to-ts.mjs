import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('scripts/i18n-extract/en.json', 'utf8'));
const tree = raw.translation ?? raw;

function indent(n) { return '  '.repeat(n); }
function emit(obj, depth) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${indent(depth)}${k}: {`);
      lines.push(...emit(v, depth + 1));
      lines.push(`${indent(depth)}},`);
    } else {
      lines.push(`${indent(depth)}${JSON.stringify(k)}: ${JSON.stringify(String(v))},`);
    }
  }
  return lines;
}

const body = emit(tree, 1);
const out = `const en = {\n${body.join('\n')}\n} as const;\n\nexport default en;\nexport type EnLocale = typeof en;\n`;
writeFileSync('src/i18n/locales/en/index.ts', out);
console.log(`wrote ${body.length} key lines to src/i18n/locales/en/index.ts`);
