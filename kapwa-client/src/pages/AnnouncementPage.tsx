import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Pin, ArrowLeft } from 'lucide-react';
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

export function AnnouncementPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useSWR(
    slug ? queryKeys.announcements.public.detail(slug) : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="text-muted-foreground mt-2">This announcement may have been removed or is no longer published.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} />
        Back to home
      </Link>

      <article>
        <div className="flex items-center gap-2 mb-2">
          {data.pinned && <Pin size={16} className="text-primary" />}
          {data.publishedAt && (
            <time className="text-sm text-muted-foreground">
              {new Date(data.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-6">{data.title}</h1>

        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
        />
      </article>
    </div>
  );
}
