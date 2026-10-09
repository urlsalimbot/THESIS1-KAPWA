import { outputGrid } from './dedup-output.service';
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