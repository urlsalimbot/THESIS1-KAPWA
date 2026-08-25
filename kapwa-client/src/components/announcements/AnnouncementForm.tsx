import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Megaphone, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RichTextEditor } from './RichTextEditor';

export interface AnnouncementFormValues {
  title: string;
  excerpt: string;
  bodyHtml: string;
}

interface AnnouncementFormProps {
  isNew: boolean;
  initial?: AnnouncementFormValues & { pinned: boolean; status: 'draft' | 'published' };
  saving: 'draft' | 'published' | null;
  onSave: (status: 'draft' | 'published', values: AnnouncementFormValues) => void;
}

export function AnnouncementForm({ isNew, initial, saving, onSave }: AnnouncementFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? '');

  const save = (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error(t('announcements.titleRequired', 'Title is required'));
      return;
    }
    onSave(status, { title, excerpt, bodyHtml });
  };

  const excerptHint = `${excerpt.length}/160 ${t('announcements.characters', 'characters')}`;

  return (
    <>
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
              <span className={excerpt.length > 160 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
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
                initial?.pinned
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-muted text-muted-foreground border border-transparent'
              }`}
            >
              <Pin size={11} />
              {initial?.pinned ? t('announcements.pinned', 'Pinned') : t('announcements.notPinned', 'Not pinned')}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                initial?.status === 'published'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {initial?.status === 'published' ? t('announcements.published', 'Published') : t('announcements.draft', 'Draft')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={() => save('draft')} disabled={saving !== null} variant="outline">
            {saving === 'draft' && <Loader2 size={16} className="animate-spin mr-1" />}
            {t('announcements.saveDraft', 'Save as Draft')}
          </Button>
          <Button onClick={() => save('published')} disabled={saving !== null}>
            {saving === 'published' && <Loader2 size={16} className="animate-spin mr-1" />}
            {t('announcements.savePublish', 'Save & Publish')}
          </Button>
        </div>
      </div>
    </>
  );
}