import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { api, publicAnnouncementPhotoUrl } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Card, CardContent } from '@/components/ui/card';
import { Pin, ArrowRight, Megaphone, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/public/PageContainer';

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
    month: 'short',
    day: 'numeric',
  });
}

export function LatestAnnouncements() {
  const { t } = useTranslation();
  const { data, isLoading } = useSWR(
    queryKeys.announcements.public.list(),
    (key) => api.get<PublicAnnouncement[]>(key),
  );

  const announcements = data || [];

  if (isLoading) return null;
  if (announcements.length === 0) return null;

  const visible = announcements.slice(0, 4);

  // Size the grid to the number of cards so a single announcement does not
  // leave three empty columns behind it.
  const layout =
    visible.length === 1
      ? { wrap: 'max-w-2xl', grid: 'grid-cols-1' }
      : visible.length === 2
        ? { wrap: 'max-w-4xl', grid: 'grid-cols-1 sm:grid-cols-2' }
        : visible.length === 3
          ? { wrap: '', grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }
          : { wrap: '', grid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' };

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <PageContainer>
        <div className={cn('mx-auto', layout.wrap)}>
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
              <Megaphone size={14} className="text-accent" aria-hidden="true" />
              <span className="text-xs font-medium tracking-wide text-accent">
                {t('announcements.whatsNew', "What's New")}
              </span>
            </div>
            <h2 className="mb-4 text-balance font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              {t('announcements.latestTitle', 'Latest News & Announcements')}
            </h2>
            <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
              {t(
                'announcements.latestDesc',
                'Updates, advisories, and information from the MSWDO of Norzagaray — stay informed about programs and services that may affect you.'
              )}
            </p>
          </div>

          <div className={cn('grid gap-5', layout.grid)}>
            {visible.map((a) => (
              <Link
                to={`/announcements/${a.slug}`}
                key={a.id}
                className="group h-full"
                aria-label={t('announcements.readAria', 'Read: {{title}}', { title: a.title })}
              >
                <Card
                  className={cn(
                    'h-full overflow-hidden border-border/60 group-hover:-translate-y-1 group-hover:border-accent/30',
                    a.pinned && 'border-accent/40',
                  )}
                >
                  <CardContent className="flex h-full flex-col p-5">
                    {a.coverPhotoId && (
                      <img
                        src={publicAnnouncementPhotoUrl(a.coverPhotoId)}
                        alt={t('announcements.photoCover', 'Cover photo')}
                        className="mb-4 aspect-video w-full rounded-md object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="mb-3 flex items-center justify-between gap-2">
                      {a.pinned ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                          <Pin size={12} aria-hidden="true" />
                          {t('announcements.pinned', 'Pinned')}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-primary/70">
                          {t('announcements.item', 'Announcement')}
                        </span>
                      )}
                      {a.publishedAt && (
                        <time className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarDays size={12} aria-hidden="true" />
                          {formatDate(a.publishedAt)}
                        </time>
                      )}
                    </div>

                    <h3 className="font-heading font-semibold text-base leading-snug line-clamp-2 transition-colors group-hover:text-accent">
                      {a.title}
                    </h3>

                    {a.excerpt && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{a.excerpt}</p>
                    )}

                    {/* Always visible: this was hover-only, so it never
                        appeared on touch devices. */}
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-accent">
                      {t('announcements.readMore', 'Read more')}
                      <ArrowRight size={12} aria-hidden="true" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
