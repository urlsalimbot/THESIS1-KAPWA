import { useMemo } from 'react';
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type RowSelectionState,
  type Updater,
  flexRender,
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTablePagination } from './DataTablePagination';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowCount: number;
  loading?: boolean;
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  pagination: PaginationState;
  sorting: SortingState;
  children?: React.ReactNode;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: ((updater: Updater<RowSelectionState>) => void) | undefined;
  getRowId?: (row: TData) => string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowCount,
  loading = false,
  onPaginationChange,
  onSortingChange,
  pagination,
  sorting,
  children,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const tableColumns = useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? 'indeterminate'
                : false
          }
          onCheckedChange={() => table.toggleAllPageRowsSelected()}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={row.getToggleSelectedHandler()}
          aria-label={`Select row ${row.id}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [selectColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    pageCount: Math.ceil(rowCount / pagination.pageSize),
    state: {
      sorting,
      pagination,
      ...(enableRowSelection && rowSelection !== undefined ? { rowSelection } : {}),
    },
    onPaginationChange,
    onSortingChange,
    ...(enableRowSelection && onRowSelectionChange
      ? { onRowSelectionChange }
      : {}),
    ...(enableRowSelection && getRowId ? { getRowId } : {}),
    ...(enableRowSelection ? { enableRowSelection: true } : {}),
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const columnCount = table.getVisibleFlatColumns().length;

  return (
    <div>
      {children && <div className="flex items-center py-4">{children}</div>}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
