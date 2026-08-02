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
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

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
  const [saving, setSaving] = useState(false);
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
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.post(['announcements'], { title, excerpt, bodyHtml, status });
        toast.success(status === 'published' ? 'Published!' : 'Saved as draft');
      } else {
        await api.patch(['announcements', id!], { title, excerpt, bodyHtml, status });
        toast.success('Updated');
      }
      navigate('/announcements/manage');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/announcements/manage')}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? 'New Announcement' : 'Edit Announcement'}
        </h1>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (optional)</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary shown on cards"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => save('draft')}
          disabled={saving}
          variant="outline"
        >
          {saving && <Loader2 size={16} className="animate-spin mr-1" />}
          Save as Draft
        </Button>
        <Button
          onClick={() => save('published')}
          disabled={saving}
        >
          {saving && <Loader2 size={16} className="animate-spin mr-1" />}
          Save & Publish
        </Button>
      </div>
    </div>
  );
}
