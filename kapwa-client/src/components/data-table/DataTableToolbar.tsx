import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface DataTableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  placeholder,
}: DataTableToolbarProps) {
  return (
    <div className="flex items-center py-4">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          placeholder={placeholder ?? 'Search records...'}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-56 pl-9 text-sm"
        />
      </div>
    </div>
  );
}
