import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api, publicAnnouncementPhotoUrl } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Megaphone, Pin, CalendarDays, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';
import { cn } from '@/lib/utils';

interface PublicAnnouncement {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  publishedAt: string | null;
  photoCount: number;
  coverPhotoId: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function PublicAnnouncementsPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSWR(
    queryKeys.announcements.public.list(),
    (key) => api.get<PublicAnnouncement[]>(key),
  );

  const announcements = data || [];
  const sorted = [...announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="w-full py-12 sm:py-16 lg:py-20">
      <PageContainer>
        <PageHero
          icon={Megaphone}
          eyebrow={t('public.news', 'News')}
          title={t('announcementsPublic.title', 'News & Announcements')}
          description={t(
            'announcementsPublic.description',
            'Updates, advisories, and information from the MSWDO of Norzagaray.'
          )}
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border/60 bg-card p-5">
                <div className="mb-2 h-5 w-2/3 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">
            {t('announcementsPublic.loadFailed', 'Failed to load announcements.')}
          </p>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Megaphone size={40} className="mb-3 opacity-30" aria-hidden="true" />
            <p className="text-sm">{t('announcementsPublic.empty', 'No announcements yet.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((a) => (
              <Link
                key={a.id}
                to={`/announcements/${a.slug}`}
                className="block no-underline"
                aria-label={t('announcements.readAria', 'Read: {{title}}', { title: a.title })}
              >
                <Card
                  className={cn(
                    'group border-border/60 p-5 hover:-translate-y-0.5 hover:border-accent/30',
                    a.pinned && 'border-accent/40',
                  )}
                >
                  <div className="flex items-start gap-4">
                    {a.coverPhotoId && (
                      <img
                        src={publicAnnouncementPhotoUrl(a.coverPhotoId)}
                        alt={t('announcements.photoCover', 'Cover photo')}
                        className="h-20 w-28 shrink-0 rounded-lg object-cover sm:h-24 sm:w-36"
                        loading="lazy"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {a.pinned && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent">
                            <Pin size={12} aria-hidden="true" />
                            {t('announcements.pinned', 'Pinned')}
                          </span>
                        )}
                        {a.publishedAt && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays size={12} aria-hidden="true" />
                            {formatDate(a.publishedAt)}
                          </span>
                        )}
                      </div>
                      <h2 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-accent line-clamp-2">
                        {a.title}
                      </h2>
                      {a.excerpt && (
                        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                          {a.excerpt}
                        </p>
                      )}
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                        {t('announcements.readMore', 'Read more')}
                        <ArrowRight size={12} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
