import { type Table } from '@tanstack/react-table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
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

/** A page number, or the gap before it ('before' = after the first page) / after it. */
export type PaginationItemModel = number | 'before' | 'after';

/**
 * Windowed page list: with few pages every number is shown; with many pages the
 * list is `1 … (current±1) … N` so the bar never explodes with hundreds of buttons.
 */
export function getPaginationItems(pageIndex: number, pageCount: number): PaginationItemModel[] {
  const count = Math.max(1, pageCount);
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);

  const safe = Math.min(Math.max(0, pageIndex), count - 1);
  let start = Math.max(0, safe - 1);
  let end = Math.min(count - 1, safe + 1);
  // Keep a 3-page window visible near the edges too.
  if (safe <= 1) end = Math.min(2, count - 1);
  if (safe >= count - 2) start = Math.max(count - 3, 0);

  const items: PaginationItemModel[] = [0];
  if (start > 1) items.push('before');
  for (let p = start; p <= end; p++) if (p !== 0) items.push(p);
  if (end < count - 2) items.push('after');
  if (items[items.length - 1] !== count - 1) items.push(count - 1);
  return items;
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

  const pageSizeOptions = [10, 20, 50, 100];
  if (!pageSizeOptions.includes(pageSize)) pageSizeOptions.unshift(pageSize);

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {t('dataTable.pageInfo', 'Page {{current}} of {{total}} ({{from}}–{{to}} of {{count}} total)', {
            current: pageIndex + 1,
            total: pageCount,
            from,
            to,
            count,
          })}
        </p>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {t('dataTable.perPage', 'Per page')}
          <select
            aria-label={t('dataTable.perPage', 'Per page')}
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {pageSizeOptions.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => table.previousPage()}
                className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {getPaginationItems(pageIndex, pageCount).map((item) =>
              typeof item === 'number' ? (
                <PaginationItem key={`page-${item}`}>
                  <PaginationLink
                    onClick={() => table.setPageIndex(item)}
                    isActive={item === pageIndex}
                    className="cursor-pointer"
                  >
                    {item + 1}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
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