import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClientImportOperation, ClientImportRow } from './dedup.entity';
import { DedupOutputWriter } from './dedup.service';

/**
 * Resolves (once) the first WRITABLE export directory: an explicit
 * DEDUP_EXPORT_DIR wins, then cwd/exports/client-dedup, then the OS temp dir.
 * Production runs as a non-root user (/app is not writable) — the fallback
 * keeps finalize functional instead of dying with EACCES on mkdir. Kernel
 * virtual filesystems are skipped outright: recursive mkdir under /proc can
 * block indefinitely.
 */
const KERNEL_FS_PREFIXES = ['/proc/', '/sys/', '/dev/'];
let cachedExportDir: string | undefined;
export function exportDir(): string {
  if (cachedExportDir) return cachedExportDir;
  const candidates = [
    process.env.DEDUP_EXPORT_DIR,
    path.resolve(process.cwd(), 'exports/client-dedup'),
    path.join(os.tmpdir(), 'kapwa-exports/client-dedup'),
  ].filter((c): c is string => Boolean(c));
  for (const dir of candidates) {
    if (KERNEL_FS_PREFIXES.some((p) => dir.startsWith(p))) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      cachedExportDir = dir;
      return dir;
    } catch {
      // Permission or read-only filesystem — try the next candidate.
    }
  }
  cachedExportDir = path.join(os.tmpdir(), 'kapwa-exports/client-dedup');
  return cachedExportDir;
}

/** Status cell text, mirroring the review grid's chips. */
function statusText(row: ClientImportRow): string {
  switch (row.status) {
    case 'primary':
      return 'New record saved';
    case 'no_match':
      return row.beneficiaryId ? 'New record saved' : 'No match';
    case 'retained': {
      const barangayNote = (row.remarks ?? '').includes('Barangay updated') ? '; barangay updated' : '';
      return `Updated${barangayNote}`;
    }
    case 'deprioritized': {
      if (row.eligibility === 'disqualified') return 'Deprioritized — disqualified';
      const m = /duplicate of ([^:]+)/.exec(row.remarks ?? '');
      return `Deprioritized — duplicate of ${m ? m[1].trim() : 'an existing record'}`;
    }
    default:
      return 'Pending';
  }
}

/**
 * The priority-list grid (spec §7): baseline, declared extras in order,
 * Remarks, then Status. Primaries stay in import order; deprioritized rows sit
 * below the list. Exported for tests — the file writer is a thin shell over it.
 */
export function outputGrid(op: ClientImportOperation, rows: ClientImportRow[]): Array<Array<string | number>> {
  const extras = (((op.columnMap as any)?.extras ?? []) as Array<{ name: string }>).map((e) => e.name);
  const header = [
    'Last Name', 'First Name', 'Middle Name', 'Birthday', 'Barangay',
    ...extras,
    'Remarks', 'Status',
  ];
  const blocked = new Set(['deprioritized', 'disqualified']);
  const primaries = rows.filter((r) => !blocked.has(r.status)).sort((a, b) => a.rowIndex - b.rowIndex);
  const bottom = rows.filter((r) => blocked.has(r.status)).sort((a, b) => a.rowIndex - b.rowIndex);
  const body = [...primaries, ...bottom].map((r) => [
    r.lastName ?? '',
    r.firstName ?? '',
    r.middleName ?? '',
    r.dob ?? '',
    r.barangay ?? '',
    ...extras.map((name) => (r.extraData?.[name] ?? '') as string | number),
    r.remarks ?? '',
    statusText(r),
  ]);
  return [header, ...body];
}

@Injectable()
export class DedupOutputService implements DedupOutputWriter {
  async write(op: ClientImportOperation, rows: ClientImportRow[]): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Priority List');
    for (const line of outputGrid(op, rows)) sheet.addRow(line);
    const dir = exportDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `client-dedup-${op.id}.xlsx`);
    await workbook.xlsx.writeFile(file);
    // Absolute path: the download endpoint re-resolves against cwd, and an
    // absolute input to path.resolve is returned unchanged.
    return file;
  }
}