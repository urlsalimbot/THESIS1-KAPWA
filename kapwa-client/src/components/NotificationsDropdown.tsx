import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { mutate } from 'swr';
import { toast } from 'sonner';
import {
  AlarmClock, Bell, BellRing, CheckCheck, CheckSquare, ExternalLink, FileText, Gavel, Home,
  MessageSquare, RefreshCw, Wallet, type LucideIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { relativeNotificationTime } from '../lib/relative-time';
import { queryKeys } from '../lib/query-keys';
import { connectNotificationSocket, disconnectNotificationSocket } from '../lib/notification-socket';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth-context';

interface Notification {
  id: string; title: string; message: string; category: string;
  isRead: boolean; createdAt: string; referenceId?: string;
}

export // Claimants cannot open /cases/:id (staff-only), so case-update and
// case-reminder notifications route them to their dashboard instead.
const navTarget = (n: Notification, role?: string): string => {
  const staffCase = n.referenceId ? `/cases/${n.referenceId}` : '/cases';
  const caseTarget = role === 'claimant' ? '/my-dashboard' : staffCase;
  const map: Record<string, string> = {
    case_update: caseTarget,
    approval: '/approvals',
    disbursement: n.referenceId ? `/cases/${n.referenceId}` : '/cases',
    chat: n.referenceId ? `/messages/${n.referenceId}` : '/messages',
    sync_conflict: '/tracker',
    sla_escalation: n.referenceId ? `/cases/${n.referenceId}` : '/cases',
    court_hearing: caseTarget,
    home_visit: caseTarget,
  };
  return map[n.category] || '/notifications';
};

/** One glyph per category, so a row is scannable before the title is read. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  case_update: FileText,
  approval: CheckSquare,
  disbursement: Wallet,
  chat: MessageSquare,
  sync_conflict: RefreshCw,
  sla_escalation: AlarmClock,
  court_hearing: Gavel,
  home_visit: Home,
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [open, setOpen] = useState(false);
  const authed = hasToken();

  const { data: notifications, isLoading: loading } = useSWR<Notification[]>(
    authed ? queryKeys.notifications.list() : null,
  );
  const { data: unreadData } = useSWR<{ count: number }>(
    authed ? queryKeys.notifications.unreadCount() : null,
  );
  const unreadCount = unreadData?.count ?? 0;
  const total = notifications?.length ?? 0;
  const shown = (notifications || []).slice(0, 10);

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
      toast(notif.title, {
        description: notif.message,
        action: {
          label: t('notifications.view', 'View'),
          onClick: () => navigate(navTarget(notif, authUser?.role)),
        },
        duration: 5000,
      });
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
  }, [t, authUser?.role]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative w-9 h-9 rounded-full text-muted-foreground transition-colors"
          aria-label={
            unreadCount > 0
              ? t('notifications.ariaUnread', 'Notifications, {{count}} unread', { count: unreadCount })
              : t('notifications.aria', 'Notifications')
          }
        >
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[calc(100vw-1.5rem)] p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t('notifications.title', 'Notifications')}</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
                {t('notifications.unreadCount', '{{count}} unread', { count: unreadCount })}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-0.5 text-xs"
            onClick={(e) => { e.stopPropagation(); markAllRead(); }}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={14} className="mr-1" />
            {t('notifications.markAllRead', 'Mark all read')}
          </Button>
        </div>
        <Separator />
        <div className="max-h-[22rem] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t('notifications.loading', 'Loading...')}
            </div>
          )}
          {!loading && total === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell size={32} className="mb-2 opacity-40" />
              <span className="text-sm">{t('notifications.empty', 'No notifications')}</span>
            </div>
          )}
          {shown.map(n => {
            const Icon = CATEGORY_ICONS[n.category] ?? Bell;
            return (
              <div
                key={n.id}
                className={cn(
                  'group relative flex items-start gap-1 border-b border-border last:border-b-0',
                  !n.isRead && 'bg-accent/[0.06]',
                )}
              >
                {!n.isRead && (
                  <span aria-hidden="true" className="absolute left-1.5 top-[1.15rem] h-1.5 w-1.5 rounded-full bg-accent" />
                )}
                <button
                  type="button"
                  onClick={() => { markOneRead(n.id, navTarget(n, authUser?.role), navigate); setOpen(false); }}
                  className={cn(
                    'flex w-full min-w-0 items-start gap-3 py-3 pr-2 text-left transition-colors hover:bg-muted/60',
                    n.isRead ? 'pl-4' : 'pl-5',
                  )}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon size={14} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm leading-snug', !n.isRead && 'font-semibold')}>
                        {n.title}
                      </span>
                      <time
                        dateTime={n.createdAt}
                        title={formatDateTime(n.createdAt)}
                        className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                      >
                        {relativeNotificationTime(n.createdAt, t)}
                      </time>
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {n.message}
                    </span>
                  </span>
                </button>
                {!n.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); markOneRead(n.id); }}
                    className="mt-2 mr-1.5 h-6 w-6 shrink-0 rounded text-muted-foreground opacity-70 hover:opacity-100"
                    aria-label={t('notifications.markAsRead', 'Mark as read')}
                  >
                    <CheckCheck size={14} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {total > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => { setOpen(false); navigate('/notifications'); }}
              >
                <span>
                  {t('notifications.viewAll', 'View all notifications')}
                  {total > shown.length && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({shown.length}/{total})
                    </span>
                  )}
                </span>
                <ExternalLink size={14} />
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
