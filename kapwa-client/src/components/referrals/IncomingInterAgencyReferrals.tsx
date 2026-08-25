import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, ExternalLink } from 'lucide-react';
import { InterAgencyReferral } from './referral-utils';
import { referralStatusLabel } from '@/i18n/display';

export function IncomingInterAgencyReferrals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myAgencyId = user?.agencyId;

  const { data, isLoading } = useSWR(
    queryKeys.interAgencyReferrals.inbox(),
    (key) => api.get<InterAgencyReferral[]>(key),
  );

  if (isLoading) return null;

  const incoming = (data || []).filter(r => r.toAgencyId === myAgencyId);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Send size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('agency.incomingReferrals', 'Incoming Inter-Agency Referrals')}</h2>
      </div>
      {incoming.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {t('agency.noIncomingReferrals', 'No incoming inter-agency referrals')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {incoming.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/agency/referrals/${r.id}`)}
              className="w-full text-left rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
              aria-label={t('referrals.viewDetailsAria', 'View details for {{name}}', { name: r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id })}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t('referrals.fromAgency', 'From Agency')}: {r.fromAgency?.name || r.fromAgencyId}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={r.status === 'declined' ? 'destructive' : 'default'}>{referralStatusLabel(t, r.status)}</Badge>
                  <ExternalLink size={14} className="text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}