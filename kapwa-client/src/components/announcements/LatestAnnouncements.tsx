import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Card, CardContent } from '@/components/ui/card';
import { Pin } from 'lucide-react';

interface PublicAnnouncement {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  publishedAt: string | null;
}

export function LatestAnnouncements() {
  const { data, isLoading } = useSWR(
    queryKeys.announcements.public.list(),
    (key) => api.get<PublicAnnouncement[]>(key),
  );

  const announcements = data || [];

  if (isLoading) return null;
  if (announcements.length === 0) return null;

  return (
    <section className="py-16 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8">Latest News & Announcements</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {announcements.slice(0, 4).map((a) => (
          <Link to={`/announcements/${a.slug}`} key={a.id}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  {a.pinned && <Pin size={14} className="text-primary shrink-0 mt-1" />}
                  <div>
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                    {a.publishedAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {new Date(a.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
