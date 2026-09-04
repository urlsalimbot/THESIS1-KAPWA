import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/PageShell';
import { Plus, Pin, Megaphone, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Announcement {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
  updatedAt: string;
  photoCount: number;
  coverPhotoId: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AnnouncementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSWR(
    queryKeys.announcements.list(),
    (key) => api.get<Announcement[]>(key),
  );

  const announcements = data || [];

  const actions = (
    <Button onClick={() => navigate('/announcements/manage/new')}>
      <Plus size={16} className="mr-1" />
      {t('announcements.new', 'New Announcement')}
    </Button>
  );

  return (
    <PageShell
      title={t('announcements.manage', 'Announcements')}
      description={t('announcements.manageDesc', 'Browse announcements. Manage publishing, pinning, editing, and deletion from each announcement.')}
      actions={actions}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-12 ml-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{t('announcements.loadFailed', 'Failed to load announcements.')}</p>
          </CardContent>
        </Card>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Megaphone size={20} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold font-heading">{t('announcements.empty', 'No announcements yet')}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
              {t('announcements.emptyHint', 'Publish program updates, advisories, and announcements that appear on the public website.')}
            </p>
            <Button onClick={() => navigate('/announcements/manage/new')}>
              <Plus size={16} className="mr-1" /> {t('announcements.createFirst', 'Create your first announcement')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card
              key={a.id}
              className={`${a.status === 'draft' ? 'opacity-75' : ''} hover:shadow-md transition-shadow`}
            >
              <button
                type="button"
                onClick={() => navigate(`/announcements/manage/${a.id}`)}
                className="w-full text-left"
                aria-label={t('announcements.openAria', 'Open {{title}}', { title: a.title })}
              >
                <div className="flex items-start gap-4 p-4">
                  {a.coverPhotoId && (
                    <img
                      src={`/announcements/public/photo/${a.coverPhotoId}`}
                      alt={t('announcements.photoCover', 'Cover photo')}
                      className="h-16 w-24 rounded-md object-cover shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold font-heading truncate">{a.title}</h3>
                      {a.pinned && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent shrink-0">
                          <Pin size={12} />
                          {t('announcements.pinned', 'Pinned')}
                        </span>
                      )}
                      <Badge variant={a.status === 'published' ? 'default' : 'secondary'} className="shrink-0">
                        {a.status === 'published' ? t('announcements.published', 'Published') : t('announcements.draft', 'Draft')}
                      </Badge>
                    </div>
                    {a.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{a.excerpt}</p>
                    )}
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      {a.publishedAt
                        ? `${t('announcements.publishedOn', 'Published')} ${formatDate(a.publishedAt)}`
                        : `${t('announcements.updatedOn', 'Updated')} ${formatDate(a.updatedAt)}`}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0 mt-1">
                    {t('announcements.open', 'Open')}
                    <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}