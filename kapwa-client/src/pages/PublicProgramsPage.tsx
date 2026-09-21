import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ScrollText, HandHeart, ArrowRight, Clock, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';

interface PublicProgram {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  fundSources?: string[];
  requiredDocuments?: string[];
  legalBasis?: string;
}

export function PublicProgramsPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSWR(
    queryKeys.programs.publicList(),
    (key) => api.get<PublicProgram[]>(key),
  );

  const programs = data || [];

  return (
    <div className="w-full py-12 sm:py-16 lg:py-20">
      <PageContainer>
        <PageHero
          icon={ScrollText}
          eyebrow={t('public.programs', 'Programs')}
          title={t('programsPublic.title', 'Social Assistance Programs')}
          description={t(
            'programsPublic.description',
            'Available assistance programs and services offered by the MSWDO of Norzagaray.'
          )}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-border/60 bg-card p-6"
              >
                <div className="mb-3 h-5 w-2/3 rounded bg-muted" />
                <div className="mb-2 h-4 w-full rounded bg-muted" />
                <div className="h-4 w-5/6 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            {t('programsPublic.loadFailed', 'Failed to load programs.')}
          </p>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <HandHeart size={40} className="mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm">{t('programsPublic.empty', 'No programs are currently listed.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {programs.map((p) => (
              <Card
                key={p.id}
                className="flex flex-col border-border/60 p-6 hover:border-accent/30"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="font-heading text-lg font-semibold tracking-tight">{p.name}</h2>
                  {p.category && (
                    <Badge variant="secondary" className="shrink-0">
                      {p.category}
                    </Badge>
                  )}
                </div>

                {p.waitingPeriodDays != null && (
                  <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={14} aria-hidden="true" />
                    {t('programsPublic.waitingPeriod', 'Waiting period: {{days}} days', {
                      days: p.waitingPeriodDays,
                    })}
                  </p>
                )}

                <div className="space-y-3">
                  {p.fundSources && p.fundSources.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {t('programsPublic.fundSources', 'Fund Sources')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.fundSources.map((f) => (
                          <span
                            key={f}
                            className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.requiredDocuments && p.requiredDocuments.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <FileText size={12} aria-hidden="true" />
                        {t('programsPublic.requiredDocuments', 'Required Documents')}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {p.requiredDocuments.map((doc, i) => (
                          <li key={i}>
                            <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                              {doc}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {p.legalBasis && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium">
                        {t('programsPublic.legalBasis', 'Legal Basis')}:
                      </span>{' '}
                      {p.legalBasis}
                    </p>
                  )}
                </div>

                <Link
                  to="/contact"
                  className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-accent hover:underline"
                >
                  {t('programsPublic.inquire', 'Inquire about this program')}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
