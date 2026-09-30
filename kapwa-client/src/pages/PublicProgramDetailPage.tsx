import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { ArrowLeft, ArrowRight, Clock, FileText, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <div className="max-w-3xl animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
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

        <div className="max-w-3xl space-y-8">
          {data.waitingPeriodDays != null && data.waitingPeriodDays > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
                <Clock size={18} className="text-accent" aria-hidden="true" />
                {t('programsPublic.waitingPeriod', 'Waiting period')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('programsPublic.waitingPeriodValue', '{{days}} day(s) after last assistance', {
                  days: data.waitingPeriodDays,
                })}
              </p>
            </section>
          )}

          {funds.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t('programsPublic.fundSources', 'Fund Sources')}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {funds.map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}

          {docs.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText size={14} aria-hidden="true" />
                {t('programsPublic.requiredDocuments', 'Required Documents')}
              </h2>
              <ul className="space-y-1.5">
                {docs.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ScrollText
                      size={14}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.legalBasis && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t('programsPublic.legalBasis', 'Legal Basis')}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{data.legalBasis}</p>
            </section>
          )}

          <Button asChild>
            <Link to="/contact">
              {t('programsPublic.inquire', 'Inquire about this program')}
              <ArrowRight size={16} className="ml-2" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
