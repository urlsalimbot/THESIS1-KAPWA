import { type Column } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 data-[state=open]:bg-accent -ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {title}
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        )}
      </Button>
    </div>
  );
}
