import { type Table } from '@tanstack/react-table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
import { useTranslation } from 'react-i18next';

export interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  total?: number;
}

export function DataTablePagination<TData>({
  table,
  total,
}: DataTablePaginationProps<TData>) {
  const { t } = useTranslation();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const pageSize = table.getState().pagination.pageSize;
  const count = total ?? table.getFilteredRowModel().rows.length;
  const from = count === 0 ? 0 : pageIndex * pageSize + 1;
  const to = count === 0 ? 0 : Math.min((pageIndex + 1) * pageSize, count);

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <p className="text-sm text-muted-foreground">
        {t('dataTable.pageInfo', 'Page {{current}} of {{total}} ({{from}}–{{to}} of {{count}} total)', {
          current: pageIndex + 1,
          total: pageCount,
          from,
          to,
          count,
        })}
      </p>
      <div className="flex items-center gap-1">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => table.previousPage()}
                className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: pageCount }, (_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  onClick={() => table.setPageIndex(i)}
                  isActive={i === pageIndex}
                  className="cursor-pointer"
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => table.nextPage()}
                className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
