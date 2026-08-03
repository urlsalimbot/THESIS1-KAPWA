import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Card, CardContent } from '@/components/ui/card';
import { Pin, ArrowRight, Megaphone, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicAnnouncement {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  publishedAt: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
    <section className="py-16 md:py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Megaphone size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent tracking-wide">What's New</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-heading mb-4 tracking-tight text-balance">
            Latest News &amp; Announcements
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto text-pretty">
            Updates, advisories, and information from the MSWDO of Norzagaray — stay informed
            about programs and services that may affect you.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {announcements.slice(0, 4).map((a) => (
            <Link
              to={`/announcements/${a.slug}`}
              key={a.id}
              className="group h-full"
              aria-label={`Read: ${a.title}`}
            >
              <Card
                className={cn(
                  'h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
                  a.pinned && 'border-accent/40',
                )}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {a.pinned ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                        <Pin size={12} />
                        Pinned
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-primary/70">Announcement</span>
                    )}
                    {a.publishedAt && (
                      <time className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays size={12} />
                        {formatDate(a.publishedAt)}
                      </time>
                    )}
                  </div>

                  <h3 className="font-heading font-semibold text-base leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                    {a.title}
                  </h3>

                  {a.excerpt && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.excerpt}</p>
                  )}

                  <span className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Read more
                    <ArrowRight size={12} />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
