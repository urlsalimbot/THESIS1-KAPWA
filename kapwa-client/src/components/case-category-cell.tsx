import { Badge } from '@/components/ui/badge';

/**
 * Renders a case's requested service(s) as the "Case Category" column. A case
 * can request more than one service, so they are joined; an empty list shows a
 * muted dash rather than a blank cell.
 */
export function CaseCategoryCell({ services }: { services?: string[] | null }) {
  const list = (services ?? []).filter(Boolean);
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  return <Badge variant="outline">{list.join(', ')}</Badge>;
}
