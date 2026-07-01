import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/DataTable';
import { BulkActionBar } from '@/components/bulk-actions/BulkActionBar';

interface TestData {
  id: number;
  name: string;
}

const columns: ColumnDef<TestData>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

const mockData: TestData[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

const defaultPagination = { pageIndex: 0, pageSize: 10 };
const defaultSorting: any[] = [];

function renderTable(overrides: Record<string, unknown> = {}) {
  return render(
    <DataTable
      columns={columns}
      data={mockData}
      rowCount={mockData.length}
      pagination={defaultPagination}
      sorting={defaultSorting}
      {...overrides}
    />
  );
}

describe('DataTable row selection', () => {
  test('renders checkbox column when enableRowSelection is true', () => {
    renderTable({
      enableRowSelection: true,
      rowSelection: {},
      onRowSelectionChange: vi.fn(),
      getRowId: (row: TestData) => String(row.id),
    });
    expect(screen.getByLabelText('Select all')).toBeTruthy();
  });

  test('does not render checkbox column when enableRowSelection is false', () => {
    renderTable();
    expect(screen.queryByLabelText('Select all')).toBeNull();
  });

  test('select-all checkbox renders with row selection enabled', () => {
    renderTable({
      enableRowSelection: true,
      rowSelection: { 0: true },
      onRowSelectionChange: vi.fn(),
    });
    const checkbox = screen.getByLabelText('Select all');
    expect(checkbox).toBeTruthy();
  });
});

describe('BulkActionBar', () => {
  test('appears when selectedCount > 0', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        selectedIds={['1', '2', '3']}
        onApprove={() => {}}
        onReassign={() => {}}
        onExport={() => {}}
        onClearSelection={() => {}}
      />
    );
    expect(screen.getByText('3 selected')).toBeTruthy();
    expect(screen.getByText('Approve')).toBeTruthy();
    expect(screen.getByText('Reassign')).toBeTruthy();
    expect(screen.getByText('Export')).toBeTruthy();
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  test('hidden when selectedCount is 0', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        selectedIds={[]}
        onApprove={() => {}}
        onReassign={() => {}}
        onExport={() => {}}
        onClearSelection={() => {}}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
