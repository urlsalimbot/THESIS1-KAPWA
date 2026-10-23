import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ORG_LOCATION } from '../common/constants';
import { OrgService } from '../common/org.service';
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
      if (m) return `Deprioritized — duplicate of ${m[1].trim()}`;
      // Same-person deprioritization ("move to the bottom of the priority
      // list") carries no duplicate; the bare word is the honest cell.
      return 'Deprioritized';
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
  // OrgService is global; tests construct this service directly and fall back
  // to the same office name the OrgService uses when the agency row is absent.
  constructor(private readonly org?: OrgService) {}

  /**
   * The workbook itself, in memory. The download endpoint rebuilds from here
   * when the stored file is gone: containers are disposable, and a finalize that
   * ran in another container (a seed, a replaced task) leaves only the rows.
   */
  async build(op: ClientImportOperation, rows: ClientImportRow[]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Priority List');
    const grid = outputGrid(op, rows);
    const columns = grid[0].length;
    const officeName = (this.org ? await this.org.officeName() : '') || 'Municipal Social Welfare and Development Office';
    const stamp = op.finalizedAt ?? op.createdAt ?? new Date();
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
    }).format(new Date(stamp));

    // SCSR-style letterhead: the office identity and the document title sit
    // above the data grid, centered across every column, so the printed sheet
    // reads as an official MSWDO list rather than a bare spreadsheet.
    const letterhead: Array<{ text: string; size?: number; bold?: boolean }> = [
      { text: ORG_LOCATION.country },
      { text: `Province of ${ORG_LOCATION.province}` },
      { text: `Municipality of ${ORG_LOCATION.municipality}` },
      { text: officeName.toUpperCase(), size: 12, bold: true },
      { text: 'CLIENT DEDUPLICATION PRIORITY LIST', size: 14, bold: true },
      { text: `Date: ${dateLabel}` },
      { text: `Source: ${op.source}` },
    ];
    for (const line of letterhead) {
      const row = sheet.addRow([line.text]);
      sheet.mergeCells(row.number, 1, row.number, columns);
      const cell = sheet.getCell(row.number, 1);
      cell.value = line.text;
      cell.font = { name: 'Calibri', size: line.size ?? 10, bold: line.bold ?? false };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = line.size && line.size >= 14 ? 22 : 16;
    }
    sheet.addRow([]); // breathing room before the data grid

    const headerRow = sheet.rowCount + 1;
    for (const line of grid) sheet.addRow(line);
    const header = sheet.getRow(headerRow);
    header.font = { name: 'Calibri', size: 10, bold: true };
    header.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E2DD' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    grid[0].forEach((label, i) => {
      sheet.getColumn(i + 1).width = Math.max(14, Math.min(36, String(label).length + 6));
    });
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + grid.length - 1, column: columns },
    };
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  async write(op: ClientImportOperation, rows: ClientImportRow[]): Promise<string> {
    const buffer = await this.build(op, rows);
    const dir = exportDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, op.outputName ?? `client-dedup-${op.id}.xlsx`);
    await fs.promises.writeFile(file, buffer);
    // Absolute path: the download endpoint re-resolves against cwd, and an
    // absolute input to path.resolve is returned unchanged.
    return file;
  }
}