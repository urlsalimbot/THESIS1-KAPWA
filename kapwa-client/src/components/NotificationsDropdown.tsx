import { useState } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { mutate } from 'swr';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';

interface Notification {
  id: string; title: string; message: string; category: string;
  isRead: boolean; createdAt: string;
}

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);

  const { data: notifications, isLoading: loading } = useSWR<Notification[]>(
    queryKeys.notifications.list(),
  );
  const { data: unreadData } = useSWR<{ count: number }>(
    queryKeys.notifications.unreadCount(),
    { refreshInterval: 30000 },
  );
  const unreadCount = unreadData?.count ?? 0;

  const markRead = useSWRMutation(
    queryKeys.notifications.list(),
    async (_key, { arg }: { arg: { id: string } }) => {
      await api.post(`/notifications/${arg.id}/read`);
    },
    {
      optimisticData: (current: Notification[] | undefined, { arg }: { arg: { id: string } }) =>
        (current || []).map(n => n.id === arg.id ? { ...n, isRead: true } : n),
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Notifications">
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-0.5 text-xs text-accent"
              onClick={() => markAllRead.trigger()}
              disabled={markAllRead.isMutating}
            >
              <CheckCheck size={14} className="mr-1" />
              Mark all read
            </Button>
          )}
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
            <button
              key={n.id}
              onClick={() => !n.isRead && markRead.trigger({ id: n.id })}
              className={cn(
                'w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 cursor-pointer',
                !n.isRead && 'bg-muted/30'
              )}
            >
              <div className="flex-1 min-w-0">
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
              </div>
              {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-accent shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
