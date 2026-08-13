import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { Loader2, Megaphone, Pin } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { useTranslation } from 'react-i18next';

interface AnnouncementDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
}

export function AnnouncementEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const { data, isLoading } = useSWR(
    !isNew ? ['announcements', id] : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (data && !initialized.current) {
      setTitle(data.title);
      setExcerpt(data.excerpt || '');
      setBodyHtml(data.bodyHtml || '');
      initialized.current = true;
    }
  }, [data]);

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error(t('announcements.titleRequired', 'Title is required'));
      return;
    }
    setSaving(status);
    try {
      if (isNew) {
        await api.post(['announcements'], { title, excerpt, bodyHtml, status });
        toast.success(status === 'published' ? t('announcements.publishSuccess', 'Published!') : t('announcements.savedDraft', 'Saved as draft'));
      } else {
        await api.patch(['announcements', id!], { title, excerpt, bodyHtml, status });
        toast.success(t('announcements.updated', 'Updated'));
      }
      navigate('/announcements/manage');
    } catch {
      toast.error(t('announcements.saveFailed', 'Failed to save'));
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const excerptHint = `${excerpt.length}/160 ${t('announcements.characters', 'characters')}`;

  return (
    <PageShell
      title={isNew ? t('announcements.newTitle', 'New Announcement') : t('announcements.editTitle', 'Edit Announcement')}
      description={isNew ? t('announcements.newDesc', 'Draft and publish a public announcement.') : t('announcements.editDesc', 'Update this announcement.')}
      backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
    >
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title">{t('announcements.title', 'Title')}</Label>
                {title && (
                  <span className="text-xs text-muted-foreground">{title.length} {t('announcements.chars', 'chars')}</span>
                )}
              </div>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('announcements.titlePlaceholder', 'e.g. Barangay Cleanup Drive Schedule')}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="excerpt">{t('announcements.excerpt', 'Excerpt')}</Label>
                <span
                  className={
                    excerpt.length > 160 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
                  }
                >
                  {excerptHint}
                </span>
              </div>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder={t('announcements.excerptPlaceholder', 'Short summary shown on the public website')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('announcements.body', 'Body')}</Label>
              <Tabs defaultValue="write">
                <TabsList>
                  <TabsTrigger value="write">{t('announcements.write', 'Write')}</TabsTrigger>
                  <TabsTrigger value="preview">{t('announcements.preview', 'Preview')}</TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="mt-2">
                  <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <div className="border rounded-md p-6 bg-background min-h-[240px]">
                    {bodyHtml ? (
                      <div
                        className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: bodyHtml }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('announcements.nothingToPreview', 'Nothing to preview yet.')}</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          {isNew ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Megaphone size={13} />
              {t('announcements.publicHint', 'Announcements appear on the public home page once published.')}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                  data?.pinned
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'bg-muted text-muted-foreground border border-transparent'
                }`}
              >
                <Pin size={11} />
                {data?.pinned ? t('announcements.pinned', 'Pinned') : t('announcements.notPinned', 'Not pinned')}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  data?.status === 'published'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {data?.status === 'published' ? t('announcements.published', 'Published') : t('announcements.draft', 'Draft')}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={() => save('draft')}
              disabled={saving !== null}
              variant="outline"
            >
              {saving === 'draft' && <Loader2 size={16} className="animate-spin mr-1" />}
              {t('announcements.saveDraft', 'Save as Draft')}
            </Button>
            <Button
              onClick={() => save('published')}
              disabled={saving !== null}
            >
              {saving === 'published' && <Loader2 size={16} className="animate-spin mr-1" />}
              {t('announcements.savePublish', 'Save & Publish')}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
