#!/usr/bin/env node
/**
 * Production dependency audit gate.
 *
 * Fails on high/critical advisories except the MinIO 8.0.7 storage client's
 * transitive CommonJS query-string/decode-uri chain. Those packages have no
 * patched CommonJS release; replacing MinIO with another S3 client is a
 * separate change. Keep this list narrow and remove entries as soon as the
 * storage client can be upgraded.
 */
import { spawnSync } from 'node:child_process';

const ALLOWED = new Set(['minio', 'query-string', 'decode-uri-component']);

const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
if (!run.stdout) {
  console.error(run.stderr || 'npm audit produced no JSON');
  process.exit(1);
}

let audit;
try {
  audit = JSON.parse(run.stdout);
} catch {
  console.error('Could not parse npm audit output');
  process.exit(1);
}

// `vulnerabilities` keys are package names; `v.name` is not always present.
const blocked = Object.entries(audit.vulnerabilities ?? {}).filter(([name, v]) =>
  (v.severity === 'high' || v.severity === 'critical') && !ALLOWED.has(name),
);

if (blocked.length > 0) {
  console.error('Unallowlisted high/critical production advisories:');
  for (const [name, v] of blocked) {
    console.error(`- ${name} (${v.severity})`);
  }
  process.exit(1);
}

console.log('Audit gate passed (known MinIO transitive chain allowlisted).');
