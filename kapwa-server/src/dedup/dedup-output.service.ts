import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ClientImportOperation, ClientImportRow } from './dedup.entity';
import { DedupOutputWriter } from './dedup.service';

const EXPORT_DIR = path.resolve(process.cwd(), 'exports/client-dedup');

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
  const primaries = rows.filter((r) => r.status !== 'deprioritized').sort((a, b) => a.rowIndex - b.rowIndex);
  const deprioritized = rows.filter((r) => r.status === 'deprioritized').sort((a, b) => a.rowIndex - b.rowIndex);
  const body = [...primaries, ...deprioritized].map((r) => [
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
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    const file = path.join(EXPORT_DIR, `client-dedup-${op.id}.xlsx`);
    await workbook.xlsx.writeFile(file);
    return path.relative(process.cwd(), file);
  }
}