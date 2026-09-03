import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { HandHeart, ArrowRight, ScrollText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
          <ScrollText size={16} className="text-accent" />
          <span className="text-xs font-medium text-accent tracking-wide">{t('public.programs', 'Programs')}</span>
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-balance mb-4">
          {t('programsPublic.title', 'Social Assistance Programs')}
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl text-pretty">
          {t('programsPublic.description', 'Available assistance programs and services offered by the MSWDO of Norzagaray.')}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-6 animate-pulse">
              <div className="h-5 w-2/3 bg-muted rounded mb-3" />
              <div className="h-4 w-full bg-muted rounded mb-2" />
              <div className="h-4 w-5/6 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{t('programsPublic.loadFailed', 'Failed to load programs.')}</p>
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <HandHeart size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('programsPublic.empty', 'No programs are currently listed.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-heading text-lg font-semibold tracking-tight">{p.name}</h2>
                {p.category && <Badge variant="secondary" className="shrink-0 text-[10px]">{p.category}</Badge>}
              </div>
              {p.waitingPeriodDays != null && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                  <Clock size={12} /> {t('programsPublic.waitingPeriod', 'Waiting period: {{days}} days', { days: p.waitingPeriodDays })}
                </p>
              )}
              {p.fundSources && p.fundSources.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('programsPublic.fundSources', 'Fund Sources')}</p>
                  <div className="flex flex-wrap gap-1">
                    {p.fundSources.map((f) => (
                      <span key={f} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.legalBasis && (
                <p className="text-xs text-muted-foreground mt-1">{t('programsPublic.legalBasis', 'Legal Basis')}: {p.legalBasis}</p>
              )}
              <Link
                to="/contact"
                className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                {t('programsPublic.inquire', 'Inquire about this program')} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}