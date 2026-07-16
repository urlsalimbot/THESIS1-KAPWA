import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { mutate } from 'swr';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { connectNotificationSocket, disconnectNotificationSocket } from '../lib/notification-socket';

interface Notification {
  id: string; title: string; message: string; category: string;
  isRead: boolean; createdAt: string;
}

const categoryLabels: Record<string, string> = {
  case_update: 'Case Update',
  approval: 'Approval',
  disbursement: 'Disbursement',
  chat: 'Chat',
  sync_conflict: 'Sync Conflict',
  system: 'System',
  sla_escalation: 'SLA Escalation',
};

const categoryColors: Record<string, string> = {
  case_update: 'bg-blue-100 text-blue-700',
  approval: 'bg-green-100 text-green-700',
  disbursement: 'bg-purple-100 text-purple-700',
  chat: 'bg-amber-100 text-amber-700',
  sync_conflict: 'bg-red-100 text-red-700',
  system: 'bg-slate-100 text-slate-700',
  sla_escalation: 'bg-orange-100 text-orange-700',
};

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const markReadIdRef = useRef<string | null>(null);

  const { data: notifications = [], isLoading } = useSWR<Notification[]>(
    queryKeys.notifications.list(),
  );
  const { data: unreadData } = useSWR<{ count: number }>(
    queryKeys.notifications.unreadCount(),
  );
  const unreadCount = unreadData?.count ?? 0;

  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (!token) return;
    const sock = connectNotificationSocket(token);
    const onNew = (notif: Notification) => {
      mutate(queryKeys.notifications.list(), (current: Notification[] | undefined) =>
        [notif, ...(current || [])],
        false,
      );
      mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
    };
    const onUpdated = (data: { id: string; isRead: boolean }) => {
      mutate(queryKeys.notifications.list(), (current: Notification[] | undefined) =>
        (current || []).map(n => n.id === data.id ? { ...n, isRead: data.isRead } : n),
        false,
      );
      mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
    };
    const onReadAll = () => {
      mutate(queryKeys.notifications.list(), (current: Notification[] | undefined) =>
        (current || []).map(n => ({ ...n, isRead: true })),
        false,
      );
      mutate(queryKeys.notifications.unreadCount(), { count: 0 }, false);
    };
    const onUnreadCount = (data: { count: number }) => {
      mutate(queryKeys.notifications.unreadCount(), data, false);
    };
    sock.on('notification:new', onNew);
    sock.on('notification:updated', onUpdated);
    sock.on('notifications:read-all', onReadAll);
    sock.on('unread:count', onUnreadCount);
    return () => {
      sock.off('notification:new', onNew);
      sock.off('notification:updated', onUpdated);
      sock.off('notifications:read-all', onReadAll);
      sock.off('unread:count', onUnreadCount);
    };
  }, []);

  const markRead = useSWRMutation(
    queryKeys.notifications.list(),
    async (_key: unknown, { arg }: { arg: { id: string } }) => {
      markReadIdRef.current = arg.id;
      await api.post(`/notifications/${arg.id}/read`);
    },
    {
      optimisticData: (current: Notification[] | undefined) => {
        const id = markReadIdRef.current;
        return (current || []).map(n =>
          n.id === id ? { ...n, isRead: true } : n,
        );
      },
      revalidate: false,
      populateCache: true,
      rollbackOnError: true,
      onSuccess: () => {
        mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
      },
    },
  );

  const markAllRead = useSWRMutation(
    queryKeys.notifications.list(),
    async () => {
      await api.post('/notifications/read-all');
    },
    {
      optimisticData: (current: Notification[] | undefined) =>
        (current || []).map(n => ({ ...n, isRead: true })),
      revalidate: false,
      populateCache: true,
      rollbackOnError: true,
      onSuccess: () => {
        mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
      },
    },
  );

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <PageShell title="Notifications" description="View and manage your notifications">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border text-xs">
              <button
                onClick={() => setFilter('all')}
                className={cn('px-3 py-1 rounded-l-md transition-colors', filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={cn('px-3 py-1 rounded-r-md transition-colors', filter === 'unread' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                Unread
              </button>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs text-accent"
                onClick={() => markAllRead.trigger()}
                disabled={markAllRead.isMutating}
              >
                <CheckCheck size={14} className="mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell size={40} className="mb-3 opacity-30" />
            <p className="text-sm">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {displayed.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => !n.isRead && markRead.trigger({ id: n.id })}
                  disabled={markRead.isMutating}
                  className={cn(
                    'w-full text-left px-4 py-4 flex gap-3 hover:bg-muted/50 transition-colors cursor-pointer',
                    !n.isRead && 'bg-muted/20',
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.isRead ? (
                      <BellRing size={18} className="text-muted-foreground/40" />
                    ) : (
                      <BellRing size={18} className="text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm truncate', !n.isRead && 'font-semibold')}>{n.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', categoryColors[n.category] || 'bg-slate-100 text-slate-700')}>
                        {categoryLabels[n.category] || n.category}
                      </span>
                      {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
