import { parseImportFile, ColumnMap, ColumnMapError } from './dedup-parse.service';

const baseMap: ColumnMap = {
  baseline: {
    lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name',
    birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks',
  },
  extras: [],
};

describe('parseImportFile', () => {
  it('parses a CSV with the baseline columns and one extra', async () => {
    const csv = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks,Phone Number\nReyes,Pedro,Poblete,1988-03-21,Bigte,AICS,09171000005\n';
    const map: ColumnMap = {
      baseline: baseMap.baseline,
      extras: [{ name: 'Phone Number', kind: 'text', sourceColumn: 'Phone Number' }],
    };
    const out = await parseImportFile(Buffer.from(csv), 'list.csv', map);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({
      rowIndex: 2,
      lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete',
      dob: '1988-03-21', barangay: 'Bigte', originalRemarks: 'AICS',
      extraData: { 'Phone Number': '09171000005' },
    });
  });

  it('rejects a file missing a declared column, naming it', async () => {
    const csv = 'Last Name,First Name\nReyes,Pedro\n';
    await expect(parseImportFile(Buffer.from(csv), 'list.csv', baseMap)).rejects.toThrow(ColumnMapError);
    await expect(parseImportFile(Buffer.from(csv), 'list.csv', baseMap)).rejects.toThrow(/Middle Name/);
  });

  it('parses an xlsx workbook', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const buffer = (() => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('List');
      ws.addRow(['Last Name', 'First Name', 'Middle Name', 'Birthday', 'Barangay', 'Remarks']);
      ws.addRow(['Ramos', 'Marites', 'Dela Cruz', '1990-07-07', 'Poblacion', 'Food pack']);
      return wb.xlsx.writeBuffer();
    })();
    return buffer.then(async (buf: Buffer) => {
      const out = await parseImportFile(buf, 'list.xlsx', baseMap);
      expect(out.rows).toHaveLength(1);
      expect(out.rows[0]).toMatchObject({ lastName: 'Ramos', barangay: 'Poblacion', originalRemarks: 'Food pack' });
    });
  });

  it('coerces extra field values by declared kind', async () => {
    const csv = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks,Visits,Visited On\nReyes,Pedro,Poblete,1988-03-21,Bigte,AICS,2,2026-09-01\n';
    const map: ColumnMap = {
      baseline: baseMap.baseline,
      extras: [
        { name: 'Visits', kind: 'number', sourceColumn: 'Visits' },
        { name: 'Visited On', kind: 'date', sourceColumn: 'Visited On' },
      ],
    };
    const out = await parseImportFile(Buffer.from(csv), 'list.csv', map);
    expect(out.rows[0].extraData).toMatchObject({ Visits: 2, 'Visited On': '2026-09-01' });
  });
});