import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { AnnouncementForm, type AnnouncementFormValues } from './AnnouncementForm';

export function CreateAnnouncementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);

  const save = async (status: 'draft' | 'published', values: AnnouncementFormValues) => {
    setSaving(status);
    try {
      await api.post(['announcements'], { ...values, status });
      toast.success(status === 'published' ? t('announcements.publishSuccess', 'Published!') : t('announcements.savedDraft', 'Saved as draft'));
      navigate('/announcements/manage');
    } catch {
      toast.error(t('announcements.saveFailed', 'Failed to save'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <PageShell
      title={t('announcements.newTitle', 'New Announcement')}
      description={t('announcements.newDesc', 'Draft and publish a public announcement.')}
      backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
    >
      <div className="max-w-3xl space-y-4">
        <AnnouncementForm isNew saving={saving} onSave={save} />
      </div>
    </PageShell>
  );
}