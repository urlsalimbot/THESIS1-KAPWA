import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AnnouncementForm, type AnnouncementFormValues } from './AnnouncementForm';
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
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);

  const { data, isLoading } = useSWR(
    id ? ['announcements', id] : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const save = async (status: 'draft' | 'published', values: AnnouncementFormValues) => {
    if (!id) return;
    setSaving(status);
    try {
      await api.patch(['announcements', id], { ...values, status });
      toast.success(t('announcements.updated', 'Updated'));
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

  return (
    <PageShell
      title={t('announcements.editTitle', 'Edit Announcement')}
      description={t('announcements.editDesc', 'Update this announcement.')}
      backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
    >
      <div className="max-w-3xl space-y-4">
        {data && (
          <AnnouncementForm
            key={data.id}
            isNew={false}
            initial={data}
            saving={saving}
            onSave={save}
          />
        )}
      </div>
    </PageShell>
  );
}