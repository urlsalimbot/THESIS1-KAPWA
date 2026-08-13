import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '@/i18n/display';

interface NeedsAttentionCase {
  id: string;
  name: string;
  status: string;
}

interface NeedsAttentionProps {
  cases: NeedsAttentionCase[];
}

export function NeedsAttention({ cases }: NeedsAttentionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const needsAttention = cases.filter(c => c.status === 'enrolled' || c.status === 'in_review').slice(0, 5);

  if (needsAttention.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('dashboard.needsAttention', 'Needs Attention')}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-4 text-center">{t('dashboard.noPendingActions', 'No pending actions')}</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          {t('dashboard.needsAttention', 'Needs Attention')} ({needsAttention.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 overflow-y-auto max-h-[260px]">
        {needsAttention.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={10} /> {statusLabel(t, c.status)}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>
                <Eye size={12} className="mr-1" /> {t('dashboard.view', 'View')}
              </Button>
            </div>
          </div>
        ))}
        {needsAttention.length >= 5 && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/cases')}>
            {t('dashboard.viewAll', 'View All')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
