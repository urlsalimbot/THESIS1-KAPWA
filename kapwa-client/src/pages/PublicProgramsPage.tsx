import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ScrollText, HandHeart, ArrowRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';

interface PublicProgram {
  id: string;
  name: string;
  category?: string;
  fundSources?: string[];
  requiredDocuments?: string[];
  legalBasis?: string;
}

// The card lists the most common documents inline and points to the detail
// page for the rest — a full chip wall of 6+ items per card is noise.
const MAX_INLINE_DOCS = 6;

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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-border/60 bg-card p-6"
              >
                <div className="mb-4 h-4 w-24 rounded bg-muted" />
                <div className="mb-3 h-6 w-3/4 rounded bg-muted" />
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {programs.map((p) => {
              const docs = p.requiredDocuments || [];
              const shownDocs = docs.slice(0, MAX_INLINE_DOCS);
              const hiddenCount = docs.length - shownDocs.length;
              return (
                <Card
                  key={p.id}
                  className="flex flex-col border-border/60 p-6 transition-colors hover:border-accent/30"
                >
                  {/* Meta row: category + waiting period, above the name so the
                      heading reads on its own line */}
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {p.category && (
                      <Badge variant="secondary" className="shrink-0">
                        {p.category}
                      </Badge>
                    )}
                  </div>

                  <h2 className="font-heading text-xl font-semibold leading-snug tracking-tight">
                    <Link
                      to={`/programs/${p.id}`}
                      className="text-foreground no-underline transition-colors hover:text-accent"
                    >
                      {p.name}
                    </Link>
                  </h2>

                  <div className="mt-4 space-y-4 pb-5">
                    {p.fundSources && p.fundSources.length > 0 && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {t('programsPublic.fundedBy', 'Funded by')}:{' '}
                        <span className="font-medium text-foreground/80">
                          {p.fundSources.join(' · ')}
                        </span>
                      </p>
                    )}

                    {shownDocs.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <FileText size={12} aria-hidden="true" />
                          {t('programsPublic.requiredDocuments', 'Required Documents')}
                        </p>
                        <ul className="space-y-1.5">
                          {shownDocs.map((doc, i) => (
                            <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground/85">
                              <span
                                className="mt-[.45rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                                aria-hidden="true"
                              />
                              {doc}
                            </li>
                          ))}
                          {hiddenCount > 0 && (
                            <li className="text-xs text-muted-foreground">
                              {t('programsPublic.moreDocuments', '{{count}} more on the program page', {
                                count: hiddenCount,
                              })}
                            </li>
                          )}
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

                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-4">
                    <Link
                      to={`/programs/${p.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      {t('programsPublic.viewDetails', 'View details')}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                    <Link
                      to="/contact"
                      className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                    >
                      {t('programsPublic.inquire', 'Inquire about this program')}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </PageContainer>
    </div>
  );
}