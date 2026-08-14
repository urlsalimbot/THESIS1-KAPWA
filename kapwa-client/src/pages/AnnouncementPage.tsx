import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Pin, ArrowLeft, Megaphone, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnnouncementDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  pinned: boolean;
  publishedAt: string | null;
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

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-10 w-3/4 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold font-heading">{t('announcements.notFound', 'Article not found')}</h1>
        <p className="text-muted-foreground mt-2">{t('announcements.notFoundBody', 'This announcement may have been removed or is no longer published.')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">{t('announcements.backToHome', 'Back to home')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 md:py-16 px-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        {t('announcements.backToHome', 'Back to home')}
      </Link>

      <article>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-5">
          <Megaphone size={14} className="text-accent" />
          <span className="text-xs font-medium text-accent tracking-wide">{t('announcements.announcement', 'Announcement')}</span>
        </div>

        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-tight mb-5">
          {data.title}
        </h1>

        <div className="flex items-center gap-3 mb-8">
          {data.pinned && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
              <Pin size={13} />
              {t('announcements.pinned', 'Pinned')}
            </span>
          )}
          {data.publishedAt && (
            <time className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays size={14} />
              {formatDate(data.publishedAt)}
            </time>
          )}
        </div>

        {data.excerpt && (
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed text-pretty mb-8 border-l-2 border-accent/40 pl-4">
            {data.excerpt}
          </p>
        )}

        <div
          className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-lg prose-img:my-6 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
        />

        <div className="mt-12 pt-8 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('announcements.footer', 'MSWDO Norzagaray — Municipal Social Welfare & Development Office')}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">{t('announcements.backToHome', 'Back to home')}</Link>
          </Button>
        </div>
      </article>
    </div>
  );
}
