import { Check, User, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onApprove: () => void;
  onReassign: () => void;
  onExport: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  onApprove,
  onReassign,
  onExport,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onApprove}>
            <Check className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={onReassign}>
            <User className="mr-1.5 h-4 w-4" />
            Reassign
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            <X className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
