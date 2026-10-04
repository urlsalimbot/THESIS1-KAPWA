import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ArrowLeft, ArrowRight, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';
import { programIcon, type PublicProgram } from '@/components/public/ProgramsCarousel';

/**
 * A single program, public. `GET /programs/public/:id` already returns the same
 * shape as the catalogue and 404s for an inactive program, so this page adds no
 * server surface — it gives each catalogue card a destination of its own
 * instead of dumping the visitor back onto the list.
 */
export function PublicProgramDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useSWR(
    id ? queryKeys.programs.publicDetail(id) : null,
    (key) => api.get<PublicProgram>(key),
  );

  if (isLoading) {
    return (
      <PageContainer className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="mt-8 h-40 w-full rounded-2xl bg-muted/60" />
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer className="py-16 text-center">
        <h1 className="font-heading text-2xl font-bold">
          {t('programsPublic.notFound', 'Program not found')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            'programsPublic.notFoundBody',
            'This program may have been withdrawn or is no longer offered.',
          )}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/programs">{t('programsPublic.backToPrograms', 'Back to programs')}</Link>
        </Button>
      </PageContainer>
    );
  }

  const Icon = programIcon(data.category);
  const funds = data.fundSources || [];
  const docs = data.requiredDocuments || [];

  return (
    <div className="w-full py-12 sm:py-16 lg:py-20">
      <PageContainer>
        <Link
          to="/programs"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('programsPublic.backToPrograms', 'Back to programs')}
        </Link>

        <PageHero
          icon={Icon}
          eyebrow={data.category || t('public.programs', 'Programs')}
          title={data.name}
        />

        <div className="mx-auto max-w-3xl">
          <Card className="border-border/60">
            <CardContent className="space-y-6 p-6 sm:p-8">
              {/* Quick facts: waiting period + funding, side by side on sm+ */}
              {(data.waitingPeriodDays != null && data.waitingPeriodDays > 0) || funds.length > 0 ? (
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {data.waitingPeriodDays != null && data.waitingPeriodDays > 0 && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Clock size={13} aria-hidden="true" />
                        {t('programsPublic.waitingPeriodShort', 'Waiting period')}
                      </dt>
                      <dd className="mt-1.5 text-sm font-medium text-foreground">
                        {t('programsPublic.waitingPeriodValue', '{{days}} day(s) after last assistance', {
                          days: data.waitingPeriodDays,
                        })}
                      </dd>
                    </div>
                  )}
                  {funds.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('programsPublic.fundSources', 'Fund Sources')}
                      </dt>
                      <dd className="mt-2 flex flex-wrap gap-1.5">
                        {funds.map((f) => (
                          <span
                            key={f}
                            className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground/85"
                          >
                            {f}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : null}

              {docs.length > 0 && (
                <>
                  <Separator />
                  <section>
                    <h2 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
                      <FileText size={16} className="text-accent" aria-hidden="true" />
                      {t('programsPublic.requiredDocuments', 'Required Documents')}
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {docs.map((doc, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                        >
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70"
                            aria-hidden="true"
                          />
                          <span className="text-sm leading-relaxed text-foreground/90">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              {data.legalBasis && (
                <>
                  <Separator />
                  <section>
                    <h2 className="font-heading text-base font-semibold tracking-tight">
                      {t('programsPublic.legalBasis', 'Legal Basis')}
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {data.legalBasis}
                    </p>
                  </section>
                </>
              )}
            </CardContent>
          </Card>

          {/* Footer: next step + way back, instead of a lone floating button */}
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/60 bg-card px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              {t('programsPublic.ctaHint', 'Need help choosing? Ask the MSWDO office.')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link to="/programs">
                  <ArrowLeft size={14} className="mr-1.5" aria-hidden="true" />
                  {t('programsPublic.backToPrograms', 'Back to programs')}
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link to="/contact">
                  {t('programsPublic.inquire', 'Inquire about this program')}
                  <ArrowRight size={16} className="ml-2" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}