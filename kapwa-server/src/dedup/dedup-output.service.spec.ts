import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { outputGrid, exportDir, DedupOutputService } from './dedup-output.service';
import { ClientImportOperation, ClientImportRow } from './dedup.entity';

const op = {
  id: 'op1',
  source: 'Batch 1.xlsx',
  columnMap: { baseline: {}, extras: [{ name: 'Phone Number' }, { name: 'Visits' }] },
} as unknown as ClientImportOperation;

const row = (over: Partial<ClientImportRow>): ClientImportRow => ({
  id: 'x', operationId: 'op1', rowIndex: 2, lastName: 'Reyes', firstName: 'Pedro',
  middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte', extraData: {},
  status: 'no_match', ...over,
} as ClientImportRow);

describe('outputGrid', () => {
  it('orders columns as baseline, declared extras, Remarks, Status', () => {
    const grid = outputGrid(op, [row({ extraData: { 'Phone Number': '09171000005', Visits: 2 }, beneficiaryId: 'b1' })]);
    expect(grid[0]).toEqual([
      'Last Name', 'First Name', 'Middle Name', 'Birthday', 'Barangay',
      'Phone Number', 'Visits', 'Remarks', 'Status',
    ]);
    expect(grid[1]).toEqual([
      'Reyes', 'Pedro', 'Poblete', '1988-03-21', 'Bigte',
      '09171000005', 2, '', 'New record saved',
    ]);
  });

  it('keeps primaries first in row order and puts deprioritized rows below', () => {
    const grid = outputGrid(op, [
      row({ id: 'd', rowIndex: 9, status: 'deprioritized', remarks: 'Deprioritized — duplicate of row 3: same person' }),
      row({ id: 'a', rowIndex: 2, status: 'no_match', beneficiaryId: 'b1' }),
      row({ id: 'c', rowIndex: 5, status: 'retained', matchedPersonId: 'p9' }),
    ]);
    const statuses = grid.slice(1).map((r) => r[r.length - 1]);
    expect(statuses).toEqual(['New record saved', 'Updated', 'Deprioritized — duplicate of row 3']);
  });

  it('marks a retained row whose barangay changed and names the duplicate target', () => {
    const grid = outputGrid(op, [
      row({ id: 'c', status: 'retained', remarks: 'Original note | Barangay updated to Partida' }),
      row({ id: 'd', status: 'no_match', remarks: '' }),
    ]);
    expect(grid[1][grid[1].length - 1]).toBe('Updated; barangay updated');
    expect(grid[2][grid[2].length - 1]).toBe('No match');
  });
});


describe('DedupOutputService writer', () => {
  const op = { id: 'op-x', source: 's', interventionType: 'food_pack', columnMap: { baseline: { lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name', birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks' }, extras: [] } } as unknown as ClientImportOperation;
  const rows = [{ id: 'r1', rowIndex: 2, lastName: 'Reyes', firstName: 'Pedro', status: 'no_match' }] as ClientImportRow[];

  it('honours DEDUP_EXPORT_DIR and stores an absolute path', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dedup-export-'));
    process.env.DEDUP_EXPORT_DIR = dir;
    const written = await new DedupOutputService().write(op, rows);
    expect(path.dirname(written)).toBe(dir);
    expect(path.isAbsolute(written)).toBe(true);
    expect(fs.existsSync(written)).toBe(true);
    expect(path.basename(written)).toBe(`client-dedup-${op.id}.xlsx`);
    delete process.env.DEDUP_EXPORT_DIR;
  });

  it('skips kernel-filesystem paths (recursive mkdir under /proc can hang)', () => {
    process.env.DEDUP_EXPORT_DIR = '/proc/definitely-not-writable/kapwa';
    try {
      const dir = exportDir();
      expect(dir.startsWith('/proc/')).toBe(false);
      expect(dir.startsWith('/sys/')).toBe(false);
      expect(fs.existsSync(dir)).toBe(true);
    } finally {
      delete process.env.DEDUP_EXPORT_DIR;
    }
  });
});
