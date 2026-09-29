import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      columns={columns as ColumnDef<unknown, unknown>[]}
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
        columns={columns as ColumnDef<unknown, unknown>[]}
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

  it('shows every page number for small totals', () => {
    const { container } = renderTable({ rowCount: 20 });
    expect(screen.getByText('Page 1 of 2 (1–10 of 20 total)')).toBeTruthy();
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
    const pageNumbers = Array.from(nav!.querySelectorAll('a, button'))
      .map(el => el.textContent!.trim())
      .filter(s => /^\d+$/.test(s));
    expect(pageNumbers).toEqual(expect.arrayContaining(['1', '2']));
    expect(screen.queryByText('More pages')).toBeNull();
  });

  it('windows the page list instead of rendering hundreds of buttons', () => {
    const { container } = renderTable({ rowCount: 500 });
    expect(screen.getByText('Page 1 of 50 (1–10 of 500 total)')).toBeTruthy();
    const nav = container.querySelector('nav');
    const pageNumbers = Array.from(nav!.querySelectorAll('a, button'))
      .map(el => el.textContent!.trim())
      .filter(s => /^\d+$/.test(s));
    // First and last pages are reachable...
    expect(pageNumbers).toEqual(expect.arrayContaining(['1', '50']));
    // ...a gap is marked with the ellipsis...
    expect(screen.getByText('More pages')).toBeTruthy();
    // ...and the middle of the range is not flood-rendered.
    expect(pageNumbers).not.toContain('25');
    expect(pageNumbers.length).toBeLessThanOrEqual(7);
  });

  it('changes the page size from the per-page select next to the total', () => {
    const paginationAsMutable = { pageIndex: 0, pageSize: 10 };
    const onPaginationChange = (updater: unknown) => {
      const next = typeof updater === 'function'
        ? updater(paginationAsMutable)
        : { ...paginationAsMutable, ...(updater as object) };
      paginationAsMutable.pageIndex = next.pageIndex;
      paginationAsMutable.pageSize = next.pageSize;
    };
    const { container } = render(
      <DataTable
        columns={columns as ColumnDef<unknown, unknown>[]}
        data={mockData}
        rowCount={500}
        pagination={paginationAsMutable}
        sorting={defaultSorting}
        onPaginationChange={onPaginationChange}
      />
    );
    const select = container.querySelector('select[aria-label="Per page"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: '50' } });
    expect(paginationAsMutable.pageSize).toBe(50);
    expect(paginationAsMutable.pageIndex).toBe(0);
  });
});
