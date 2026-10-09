/**
 * Parses an uploaded xlsx/csv client list against a declarable column map
 * (spec §2). Baseline columns plus any number of declared extra fields; the
 * map is free-form because it is authored before the file exists, so the
 * header is validated here — a declared column missing from the file fails
 * the whole upload with the missing names, never a half-loaded import.
 *
 * CSV is parsed in-repo (quote-aware) rather than through exceljs: exceljs's
 * CSV reader converts numeric-looking cells to numbers, which strips the
 * leading zero from identifier columns ("09171000005" -> 9171000005). Reading
 * cells as text preserves them. XLSX uses exceljs and reads `cell.text`.
 */

export interface ColumnMapBaseline {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  barangay: string;
  remarks: string;
}

export interface ColumnMapExtra {
  name: string;
  kind: 'text' | 'date' | 'number';
  identifier?: 'phone' | 'email' | 'philsys';
  sourceColumn: string;
}

export interface ColumnMap {
  baseline: ColumnMapBaseline;
  extras: ColumnMapExtra[];
}

export interface ParsedRow {
  rowIndex: number;
  lastName: string;
  firstName: string;
  middleName?: string;
  dob?: string;
  barangay?: string;
  originalRemarks?: string;
  extraData: Record<string, string | number>;
}

export class ColumnMapError extends Error {}

/** Quote-aware CSV splitter — preserves raw cell text (no numeric coercion). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const toDateString = (value: string): string | undefined => {
  if (value === null || value === undefined || value.trim() === '') return undefined;
  const s = value.trim();
  // Date-only string (CSV): pass through — routing it through `Date` parses as
  // UTC and `.toISOString()` shifts a day in negative timezones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  // ExcelJS date cells arrive as Date objects — use LOCAL parts for the same reason.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const optionalText = (v: string): string | undefined => {
  const t = v.trim();
  return t === '' ? undefined : t;
};

export async function parseImportFile(
  buffer: Buffer,
  filename: string,
  columnMap: ColumnMap,
): Promise<{ rows: ParsedRow[] }> {
  let grid: string[][];
  if (/\.csv$/i.test(filename)) {
    grid = parseCsvText(buffer.toString('utf8'));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ColumnMapError('The file contains no worksheet.');
    grid = [];
    sheet.eachRow((row: any) => {
      const cells: string[] = [];
      for (let i = 1; i <= row.cellCount; i++) cells.push(optionalText(row.getCell(i).text) ?? '');
      grid.push(cells);
    });
  }
  if (grid.length === 0) throw new ColumnMapError('The file contains no rows.');

  const header = grid[0].map((h) => h.trim());
  const headerAt = (name: string): number => header.findIndex((h) => h.localeCompare(name.trim(), undefined, { sensitivity: 'accent' }) === 0);
  const locate = (declared: string, label: string): number => {
    const idx = headerAt(declared);
    if (idx < 0) throw new ColumnMapError(`Declared column "${declared}" (${label}) is missing from the file header.`);
    return idx;
  };

  const cols = {
    lastName: locate(columnMap.baseline.lastName, 'Last Name'),
    firstName: locate(columnMap.baseline.firstName, 'First Name'),
    middleName: locate(columnMap.baseline.middleName, 'Middle Name'),
    birthDate: locate(columnMap.baseline.birthDate, 'Birthday'),
    barangay: locate(columnMap.baseline.barangay, 'Barangay'),
    remarks: locate(columnMap.baseline.remarks, 'Remarks'),
  };
  const extraCols = columnMap.extras.map((e) => ({ declared: e, column: locate(e.sourceColumn, `extra field "${e.name}"`) }));

  const rows: ParsedRow[] = [];
  grid.slice(1).forEach((cells, offset) => {
    const at = (i: number): string => (i >= 0 && i < cells.length ? cells[i].trim() : '');
    const extraData: Record<string, string | number> = {};
    for (const { declared, column } of extraCols) {
      const raw = at(column);
      if (raw === '') continue;
      if (declared.kind === 'number') {
        const n = Number(raw);
        if (!Number.isNaN(n)) extraData[declared.name] = n;
      } else if (declared.kind === 'date') {
        const d = toDateString(raw);
        if (d) extraData[declared.name] = d;
      } else {
        extraData[declared.name] = raw;
      }
    }
    rows.push({
      rowIndex: offset + 2,
      lastName: at(cols.lastName),
      firstName: at(cols.firstName),
      middleName: optionalText(at(cols.middleName)),
      dob: toDateString(at(cols.birthDate)),
      barangay: optionalText(at(cols.barangay)),
      originalRemarks: optionalText(at(cols.remarks)),
      extraData,
    });
  });

  // Required baseline: a client without a name or a birthday cannot become a
  // person row (persons.dob is NOT NULL), so the upload fails closed here with
  // row-level detail rather than half-loading or failing later at finalize.
  const problems: string[] = [];
  for (const r of rows) {
    if (!r.lastName) problems.push(`Row ${r.rowIndex}: missing Last Name`);
    if (!r.firstName) problems.push(`Row ${r.rowIndex}: missing First Name`);
    if (!r.dob) problems.push(`Row ${r.rowIndex}: missing Birthday`);
  }
  if (problems.length > 0) {
    throw new ColumnMapError(`The file has ${problems.length} row problem(s): ${problems.join('; ')}`);
  }

  return { rows };
}