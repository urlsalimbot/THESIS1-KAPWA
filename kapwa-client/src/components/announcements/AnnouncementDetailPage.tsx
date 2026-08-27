import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/PageShell';
import { FileUploadList, type FilingDoc } from '@/components/case-view/FileUploadList';
import { toast } from 'sonner';
import { Loader2, Pin, PinOff, Pencil, Trash2, Eye, ExternalLink, ImageIcon } from 'lucide-react';

interface AnnouncementDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export function AnnouncementDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data, mutate, isLoading, error } = useSWR(
    id ? queryKeys.announcements.detail(id) : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const { data: photos, mutate: mutatePhotos } = useSWR(
    id ? ['filing', 'announcements', id, 'photos'] : null,
    (key) => api.get<FilingDoc[]>(key),
  );

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(t('announcements.deleteConfirm', 'Delete "{{title}}"?', { title: data.title }))) return;
    try {
      await api.del(['announcements', data.id]);
      toast.success(t('announcements.deleted', 'Deleted'));
      navigate('/announcements/manage');
    } catch {
      toast.error(t('announcements.deleteFailed', 'Failed to delete announcement'));
    }
  };

  const handlePublishToggle = async () => {
    if (!data) return;
    try {
      await api.patch(['announcements', data.id], { status: data.status === 'published' ? 'draft' : 'published' });
      toast.success(data.status === 'published' ? t('announcements.unpublished', 'Unpublished') : t('announcements.publishSuccess', 'Published!'));
      mutate();
    } catch {
      toast.error(t('announcements.publishFailed', 'Failed to publish announcement'));
    }
  };

  const handlePinToggle = async () => {
    if (!data) return;
    try {
      await api.patch(['announcements', data.id, 'pin']);
      toast.success(data.pinned ? t('announcements.unpinned', 'Unpinned') : t('announcements.pinnedToast', 'Pinned'));
      mutate();
    } catch {
      toast.error(data.pinned ? t('announcements.unpinFailed', 'Failed to unpin announcement') : t('announcements.pinFailed', 'Failed to pin announcement'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <PageShell
        title={t('announcements.notFoundManage', 'Announcement not found')}
        description=""
        backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
      >
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">{t('announcements.notFoundManageBody', 'This announcement may have been deleted.')}</p>
        </div>
      </PageShell>
    );
  }

  const published = data.status === 'published';

  return (
    <PageShell
      title={t('announcements.detailTitle', 'Announcement Details')}
      description={t('announcements.detailDesc', 'View announcement details and manage publishing.')}
      backTo={{ label: t('announcements.backToManage', 'Back to Announcements'), onClick: () => navigate('/announcements/manage') }}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/announcements/manage/${data.id}/edit`)}>
            <Pencil size={14} className="mr-1" /> {t('announcements.edit', 'Edit')}
          </Button>
          {published && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/announcements/${data.slug}`} target="_blank" rel="noreferrer" aria-label={t('announcements.viewPublicAria', 'View public page for {{title}}', { title: data.title })}>
                <ExternalLink size={14} className="mr-1" /> {t('announcements.viewPublic', 'View Public Page')}
              </a>
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold font-heading">{data.title}</h2>
                {data.pinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                    <Pin size={12} /> {t('announcements.pinned', 'Pinned')}
                  </span>
                )}
                <Badge variant={published ? 'default' : 'secondary'}>
                  {published ? t('announcements.published', 'Published') : t('announcements.draft', 'Draft')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {published
                  ? `${t('announcements.publishedOn', 'Published')} ${new Date(data.publishedAt!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                  : `${t('announcements.updatedOn', 'Updated')} ${new Date(data.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`}
              </p>
            </div>

            {data.excerpt && (
              <p className="text-sm text-muted-foreground border-l-2 border-accent/40 pl-4">{data.excerpt}</p>
            )}

            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('announcements.slugLabel', 'Slug')}</span>
              <p className="text-sm font-mono">{data.slug}</p>
            </div>

            {data.bodyHtml && (
              <div
                className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon size={16} className="text-primary" />
              <h2 className="text-lg font-semibold font-heading">{t('announcements.photos', 'Photos')}</h2>
            </div>
            <FileUploadList
              docs={photos || []}
              onChanged={() => mutatePhotos()}
              formExtras={{ category: 'announcement_photo', announcementId: data.id }}
            />
            {(!photos || photos.length === 0) && (
              <p className="text-sm text-muted-foreground">{t('announcements.photosEmpty', 'No photos attached.')}</p>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePublishToggle}>
              <Eye size={14} className="mr-1" />
              {published ? t('announcements.unpublish', 'Unpublish') : t('announcements.publish', 'Publish')}
            </Button>
            <Button size="sm" variant="outline" onClick={handlePinToggle}>
              {data.pinned ? <PinOff size={14} className="mr-1" /> : <Pin size={14} className="mr-1" />}
              {data.pinned ? t('announcements.unpin', 'Unpin') : t('announcements.pin', 'Pin')}
            </Button>
          </div>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            <Trash2 size={14} className="mr-1" /> {t('announcements.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
