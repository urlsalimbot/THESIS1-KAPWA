import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api, publicAnnouncementPhotoUrl } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Pin, ArrowLeft, Megaphone, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/public/PageContainer';

interface AnnouncementDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  pinned: boolean;
  publishedAt: string | null;
}

interface PublicPhoto {
  id: string;
  originalName: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function AnnouncementPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useSWR(
    slug ? queryKeys.announcements.public.detail(slug) : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const { data: photos } = useSWR(
    slug ? ['announcements', 'public', slug, 'photos'] : null,
    (key) => api.get<PublicPhoto[]>(key),
  );

  if (isLoading) {
    return (
      <PageContainer className="py-12 sm:py-16">
        <div className="max-w-3xl animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer className="py-16 text-center">
        <h1 className="font-heading text-2xl font-bold">{t('announcements.notFound', 'Article not found')}</h1>
        <p className="mt-2 text-muted-foreground">{t('announcements.notFoundBody', 'This announcement may have been removed or is no longer published.')}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">{t('announcements.backToHome', 'Back to home')}</Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-10 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('announcements.backToHome', 'Back to home')}
        </Link>

      <article>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
          <Megaphone size={14} className="text-accent" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide text-accent">
            {t('announcements.announcement', 'Announcement')}
          </span>
        </div>

        <h1 className="mb-5 text-balance font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {data.title}
        </h1>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          {data.pinned && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
              <Pin size={13} aria-hidden="true" />
              {t('announcements.pinned', 'Pinned')}
            </span>
          )}
          {data.publishedAt && (
            <time className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays size={14} aria-hidden="true" />
              {formatDate(data.publishedAt)}
            </time>
          )}
        </div>

        {data.excerpt && (
          <p className="mb-8 border-l-2 border-accent/40 pl-4 text-lg leading-relaxed text-pretty text-muted-foreground">
            {data.excerpt}
          </p>
        )}

        <div
          className="prose prose-stone max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary prose-img:my-6 prose-img:rounded-lg dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
        />

        {photos && photos.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">{t('announcements.photos', 'Photos')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((p) => (
                <a key={p.id} href={publicAnnouncementPhotoUrl(p.id)} target="_blank" rel="noreferrer">
                  <img
                    src={publicAnnouncementPhotoUrl(p.id)}
                    alt={p.originalName}
                    className="aspect-video w-full rounded-lg border object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
          <p className="text-sm text-muted-foreground">
            {t('announcements.footer', 'MSWDO Norzagaray — Municipal Social Welfare & Development Office')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/announcements">
                {t('announcements.allAnnouncements', 'All announcements')}
              </Link>
            </Button>
            <Button asChild variant="brand" size="sm">
              <Link to="/">{t('announcements.backToHome', 'Back to home')}</Link>
            </Button>
          </div>
        </div>
      </article>
      </div>
    </PageContainer>
  );
}
