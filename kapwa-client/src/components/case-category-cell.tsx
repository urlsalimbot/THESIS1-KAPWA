import { useTranslation } from 'react-i18next';
import { caseCategoryLabel } from '@/i18n/display';

/**
 * Renders a case's MSWDO category as the "Case Category" column. Empty lists
 * show a muted dash rather than a blank cell; long category labels truncate
 * instead of widening the table.
 */
export function CaseCategoryCell({ category }: { category?: string | null }) {
  const { t } = useTranslation();
  if (!category) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="block max-w-[14rem] truncate rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground">
      {caseCategoryLabel(t, category)}
    </span>
  );
}