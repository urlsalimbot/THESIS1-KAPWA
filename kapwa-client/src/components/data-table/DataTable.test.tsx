import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';

interface TestData {
  id: number;
  name: string;
  email: string;
}

const columns: ColumnDef<TestData>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

const mockData: TestData[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
];

const defaultPagination = { pageIndex: 0, pageSize: 10 };
const defaultSorting: any[] = [];

function renderTable(props: Partial<Parameters<typeof DataTable>[0]> = {}) {
  return render(
    <DataTable
      columns={columns}
      data={mockData}
      rowCount={mockData.length}
      pagination={defaultPagination}
      sorting={defaultSorting}
      {...props}
    />
  );
}

describe('DataTable', () => {
  it('renders table with column headers', () => {
    renderTable();
    expect(screen.getByText('ID')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders data rows', () => {
    renderTable();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows loading state when loading is true', () => {
    renderTable({ loading: true });
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows no results when data is empty', () => {
    renderTable({ data: [], rowCount: 0 });
    expect(screen.getByText('No results.')).toBeTruthy();
  });

  it('renders children in toolbar area', () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        rowCount={mockData.length}
        pagination={defaultPagination}
        sorting={defaultSorting}
      >
        <div data-testid="toolbar">Toolbar Content</div>
      </DataTable>
    );
    expect(screen.getByTestId('toolbar')).toBeTruthy();
    expect(screen.getByText('Toolbar Content')).toBeTruthy();
  });
});
