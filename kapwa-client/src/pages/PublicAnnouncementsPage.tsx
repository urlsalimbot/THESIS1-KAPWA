import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Megaphone, Pin, CalendarDays, ArrowRight } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
          <Megaphone size={16} className="text-accent" />
          <span className="text-xs font-medium text-accent tracking-wide">{t('public.news', 'News')}</span>
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-balance mb-4">
          {t('announcementsPublic.title', 'News & Announcements')}
        </h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl text-pretty">
          {t('announcementsPublic.description', 'Updates, advisories, and information from the MSWDO of Norzagaray.')}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 animate-pulse">
              <div className="h-5 w-2/3 bg-muted rounded mb-2" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{t('announcementsPublic.loadFailed', 'Failed to load announcements.')}</p>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Megaphone size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('announcementsPublic.empty', 'No announcements yet.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => (
            <Link
              key={a.id}
              to={`/announcements/${a.slug}`}
              className="block rounded-2xl border border-border/60 bg-card p-5 hover:shadow-md hover:border-accent/30 transition-all no-underline"
            >
              <div className="flex items-start gap-4">
                {a.coverPhotoId && (
                  <img
                    src={`/announcements/public/photo/${a.coverPhotoId}`}
                    alt={t('announcements.photoCover', 'Cover photo')}
                    className="h-20 w-28 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent shrink-0">
                        <Pin size={12} /> {t('announcements.pinned', 'Pinned')}
                      </span>
                    )}
                    <h2 className="font-heading text-lg font-semibold text-foreground tracking-tight truncate">{a.title}</h2>
                  </div>
                  {a.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{a.excerpt}</p>}
                  <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1">
                    <CalendarDays size={12} />
                    {a.publishedAt ? formatDate(a.publishedAt) : ''}
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 mt-1 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}