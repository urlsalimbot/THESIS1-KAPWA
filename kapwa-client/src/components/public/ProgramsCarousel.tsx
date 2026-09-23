import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Briefcase, Bus, ChevronLeft, ChevronRight, Clock, Cross, FileText,
  GraduationCap, HandHeart, Home, Stethoscope, Utensils, Users,
} from 'lucide-react';

export interface PublicProgram {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  fundSources?: string[];
  requiredDocuments?: string[];
  legalBasis?: string;
}

// The catalogue comes from the database (`/programs/public`), so the public
// site always reflects the programs the office actually runs. Icons are picked
// from the program category for a bit of visual signal; unknown categories fall
// back to the office mark.
function programIcon(category?: string) {
  const c = (category || '').toLowerCase();
  if (c.includes('medical') || c.includes('health')) return Stethoscope;
  if (c.includes('burial')) return Cross;
  if (c.includes('education') || c.includes('student')) return GraduationCap;
  if (c.includes('food')) return Utensils;
  if (c.includes('transport')) return Bus;
  if (c.includes('senior') || c.includes('pension')) return Users;
  if (c.includes('livelihood') || c.includes('financial') || c.includes('employment')) return Briefcase;
  if (c.includes('family') || c.includes('4ps') || c.includes('pantawid')) return Home;
  return HandHeart;
}

export function ProgramCard({ program, className }: { program: PublicProgram; className?: string }) {
  const { t } = useTranslation();
  const Icon = programIcon(program.category);
  const funds = program.fundSources || [];
  const docs = program.requiredDocuments || [];

  return (
    <Card
      className={cn(
        'group flex h-full flex-col border-border/60 hover:-translate-y-1 hover:border-accent/30',
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 transition-colors duration-200 group-hover:bg-accent/20">
            <Icon size={24} className="text-accent" aria-hidden="true" />
          </div>
          {program.category && (
            <Badge variant="secondary" className="shrink-0">
              {program.category}
            </Badge>
          )}
        </div>
        <CardTitle className="font-heading text-lg font-semibold tracking-tight">
          {program.name}
        </CardTitle>
        {program.waitingPeriodDays != null && (
          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Clock size={13} aria-hidden="true" />
            {t('services.waitingPeriod', 'Processing: ~{{days}} days', {
              days: program.waitingPeriodDays,
            })}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {docs.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText size={13} aria-hidden="true" />
            {t('services.docsRequired', '{{count}} document(s) required', { count: docs.length })}
          </p>
        )}

        {funds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {funds.slice(0, 3).map((f) => (
              <span
                key={f}
                className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {program.legalBasis && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {program.legalBasis}
          </p>
        )}

        <Link
          to="/programs"
          className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-accent hover:underline"
        >
          {t('services.viewProgram', 'View program')}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Horizontally scrolling catalogue of the office's active programs. Native
 * scroll-snap drives it, so it works with touch, trackpad and keyboard; the
 * arrow buttons are an additional pointer affordance.
 */
export function ProgramsCarousel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSWR(
    queryKeys.programs.publicList(),
    (key) => api.get<PublicProgram[]>(key),
  );
  const programs = data || [];

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, programs.length, isLoading]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className={cn(className)}>
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
          <span className="text-xs font-medium tracking-wide text-accent">
            {t('services.whatWeOffer', 'What We Offer')}
          </span>
        </div>
        <h2 className="mb-4 text-balance font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {t('services.title', 'Our Services')}
        </h2>
        <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
          {t(
            'services.subtitle',
            'Comprehensive social welfare programs designed to support every member of the Norzagaray community.',
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="flex gap-5 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="w-[280px] shrink-0 animate-pulse rounded-2xl border border-border/60 bg-card p-6 sm:w-[320px]"
            >
              <div className="mb-3 h-12 w-12 rounded-xl bg-muted" />
              <div className="mb-3 h-5 w-2/3 rounded bg-muted" />
              <div className="mb-2 h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-sm text-destructive">
          {t('services.loadFailed', 'Failed to load programs.')}
        </p>
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <HandHeart size={40} className="mb-3 opacity-30" aria-hidden="true" />
          <p className="text-sm">{t('services.empty', 'No programs are currently listed.')}</p>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scrollerRef}
            tabIndex={0}
            role="group"
            aria-label={t('services.carouselLabel', 'Programs carousel')}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {programs.map((p) => (
              <div key={p.id} className="w-[280px] shrink-0 snap-start sm:w-[320px]">
                <ProgramCard program={p} />
              </div>
            ))}
          </div>

          {programs.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('services.prev', 'Previous programs')}
                onClick={() => scrollByCard(-1)}
                disabled={!canPrev}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('services.next', 'Next programs')}
                onClick={() => scrollByCard(1)}
                disabled={!canNext}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
