import { Check, User, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        <span className="text-sm font-medium text-foreground">
          {t('bulkActions.selected', '{{count}} selected', { count: selectedCount })}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onApprove}>
            <Check size={16} className="mr-1.5" />
            {t('bulkActions.approve', 'Approve')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onReassign}>
            <User size={16} className="mr-1.5" />
            {t('bulkActions.reassign', 'Reassign')}
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download size={16} className="mr-1.5" />
            {t('bulkActions.export', 'Export')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            <X size={16} className="mr-1.5" />
            {t('bulkActions.clear', 'Clear')}
          </Button>
        </div>
      </div>
    </div>
  );
}
