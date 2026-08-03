import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Pin, PinOff, Eye, Megaphone, ArrowRight } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
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
    try {
      await api.del(['announcements', id]);
      toast.success('Deleted');
      mutate();
    } catch {
      toast.error('Failed to delete announcement');
    }
  };

  const handlePublishToggle = async (a: Announcement) => {
    try {
      if (a.status === 'published') {
        await api.patch(['announcements', a.id], { status: 'draft' });
        toast.success('Unpublished');
      } else {
        await api.patch(['announcements', a.id], { status: 'published' });
        toast.success('Published');
      }
      mutate();
    } catch {
      toast.error(
        a.status === 'published'
          ? 'Failed to unpublish announcement'
          : 'Failed to publish announcement',
      );
    }
  };

  const handlePinToggle = async (a: Announcement) => {
    try {
      await api.patch(['announcements', a.id, 'pin']);
      toast.success(a.pinned ? 'Unpinned' : 'Pinned');
      mutate();
    } catch {
      toast.error(a.pinned ? 'Failed to unpin announcement' : 'Failed to pin announcement');
    }
  };

  const actions = (
    <Button onClick={() => navigate('/announcements/manage/new')}>
      <Plus size={16} className="mr-1" />
      New Announcement
    </Button>
  );

  return (
    <PageShell
      title="Announcements"
      description="Create, edit, and manage public announcements."
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
                <div className="flex gap-1 ml-4">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load announcements.</p>
          </CardContent>
        </Card>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Megaphone size={20} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold font-heading">No announcements yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
              Publish program updates, advisories, and announcements that appear on the public
              website.
            </p>
            <Button onClick={() => navigate('/announcements/manage/new')}>
              <Plus size={16} className="mr-1" /> Create your first announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card
              key={a.id}
              className={a.status === 'draft' ? 'opacity-75' : ''}
            >
              <div className="flex items-start justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold font-heading truncate">{a.title}</h3>
                    {a.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent shrink-0">
                        <Pin size={12} />
                        Pinned
                      </span>
                    )}
                    <Badge variant={a.status === 'published' ? 'default' : 'secondary'} className="shrink-0">
                      {a.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  {a.excerpt && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">{a.excerpt}</p>
                  )}
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    {a.publishedAt
                      ? `Published ${new Date(a.publishedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}`
                      : `Updated ${new Date(a.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${a.title}`}
                          onClick={() => navigate(`/announcements/manage/${a.id}`)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={a.status === 'published' ? `Unpublish ${a.title}` : `Publish ${a.title}`}
                          onClick={() => handlePublishToggle(a)}
                        >
                          <Eye size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {a.status === 'published' ? 'Unpublish' : 'Publish'}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={a.pinned ? `Unpin ${a.title}` : `Pin ${a.title}`}
                          onClick={() => handlePinToggle(a)}
                        >
                          {a.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{a.pinned ? 'Unpin' : 'Pin'}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${a.title}`}
                          onClick={() => handleDelete(a.id, a.title)}
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </Card>
          ))}

          <div className="pt-2 text-center">
            <Button variant="link" size="sm" onClick={() => navigate('/announcements/manage/new')}>
              New Announcement
              <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
