import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Pin, PinOff, Eye } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export function AnnouncementsPage() {
  const navigate = useNavigate();
  const { data, mutate, isLoading, error } = useSWR(
    queryKeys.announcements.list(),
    (key) => api.get<Announcement[]>(key),
  );

  const announcements = data || [];

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await api.del(['announcements', id]);
    toast.success('Deleted');
    mutate();
  };

  const handlePublishToggle = async (a: Announcement) => {
    if (a.status === 'published') {
      await api.patch(['announcements', a.id], { status: 'draft' });
      toast.success('Unpublished');
    } else {
      await api.patch(['announcements', a.id], { status: 'published' });
      toast.success('Published');
    }
    mutate();
  };

  const handlePinToggle = async (a: Announcement) => {
    await api.patch(['announcements', a.id, 'pin']);
    toast.success(a.pinned ? 'Unpinned' : 'Pinned');
    mutate();
  };

  if (error) return <p className="p-4 text-destructive">Failed to load announcements.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <Button onClick={() => navigate('/announcements/manage/new')}>
          <Plus size={16} className="mr-1" />
          New Announcement
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No announcements yet.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/announcements/manage/new')}>
              <Plus size={16} className="mr-1" /> Create your first announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card key={a.id} className={a.status === 'draft' ? 'opacity-70' : ''}>
              <div className="flex items-start justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.title}</h3>
                    {a.pinned && <Pin size={14} className="text-primary shrink-0" />}
                    <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>
                      {a.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.publishedAt
                      ? `Published ${new Date(a.publishedAt).toLocaleDateString()}`
                      : `Updated ${new Date(a.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/announcements/manage/${a.id}`)}>
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePublishToggle(a)}
                    title={a.status === 'published' ? 'Unpublish' : 'Publish'}
                  >
                    <Eye size={16} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handlePinToggle(a)}>
                    {a.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id, a.title)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
