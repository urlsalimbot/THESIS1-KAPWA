import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { mutate } from 'swr';
import { Bell, BellRing, CheckCheck, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { connectNotificationSocket, disconnectNotificationSocket } from '../lib/notification-socket';

interface Notification {
  id: string; title: string; message: string; category: string;
  isRead: boolean; createdAt: string; referenceId?: string;
}

const navTarget = (n: Notification): string => {
  const map: Record<string, string> = {
    case_update: n.referenceId ? `/cases/${n.referenceId}` : '/cases',
    approval: '/approvals',
    disbursement: n.referenceId ? `/cases/${n.referenceId}` : '/cases',
    chat: '/messages',
    sync_conflict: '/tracker',
    sla_escalation: '/tracker',
  };
  return map[n.category] || '/notifications';
};

function hasToken(): boolean {
  return !!localStorage.getItem('kapwa_token');
}

function markOneRead(id: string, navigateTo?: string, doNavigate?: (path: string) => void) {
  api.post(`/notifications/${id}/read`).then(() => {
    mutate(
      queryKeys.notifications.list(),
      (current: Notification[] | undefined) =>
        (current || []).map(n => n.id === id ? { ...n, isRead: true } : n),
      false,
    );
    mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
    if (navigateTo && doNavigate) doNavigate(navigateTo);
  });
}

function markAllRead() {
  api.post('/notifications/read-all').then(() => {
    mutate(
      queryKeys.notifications.list(),
      (current: Notification[] | undefined) =>
        (current || []).map(n => ({ ...n, isRead: true })),
      false,
    );
    mutate(queryKeys.notifications.unreadCount(), undefined, { revalidate: true });
  });
}

export default function NotificationsDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const authed = hasToken();

  const { data: notifications, isLoading: loading } = useSWR<Notification[]>(
    authed ? queryKeys.notifications.list() : null,
  );
  const { data: unreadData } = useSWR<{ count: number }>(
    authed ? queryKeys.notifications.unreadCount() : null,
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Notifications">
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 min-h-[48px]">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-0.5 text-xs text-accent"
            onClick={(e) => { e.stopPropagation(); markAllRead(); }}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={14} className="mr-1" />
            Mark all read
          </Button>
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {!loading && (notifications?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell size={32} className="mb-2 opacity-40" />
              <span className="text-sm">No notifications</span>
            </div>
          )}
          {(notifications || []).slice(0, 10).map(n => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-1 px-4 py-3 border-b border-border last:border-b-0 transition-colors',
                !n.isRead && 'bg-muted/30'
              )}
            >
              <button
                onClick={() => { markOneRead(n.id, navTarget(n), navigate); setOpen(false); }}
                className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-sm truncate', !n.isRead && 'font-semibold')}>{n.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
              {!n.isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                  className="mt-1.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Mark as read"
                >
                  <CheckCheck size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {(notifications?.length ?? 0) > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => { setOpen(false); navigate('/notifications'); }}>
                View all notifications
                <ExternalLink size={14} />
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
