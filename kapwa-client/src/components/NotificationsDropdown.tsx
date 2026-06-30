import { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Notification {
  id: string; title: string; message: string; category: string;
  isRead: boolean; createdAt: string;
}

export default function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications() {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/notifications/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch (e) { console.error("NotificationsDropdown:", e); } finally { setLoading(false); }
  }

  async function fetchUnreadCount() {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const data = await res.json(); setUnreadCount(data.count); }
    } catch (e) { console.error("NotificationsDropdown:", e); }
  }

  async function markAsRead(id: string) {
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { console.error("NotificationsDropdown:", e); }
  }

  async function markAllRead() {
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) { console.error("NotificationsDropdown:", e); }
  }

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
            <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs text-accent" onClick={markAllRead}>
              <CheckCheck size={14} className="mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell size={32} className="mb-2 opacity-40" />
              <span className="text-sm">No notifications</span>
            </div>
          )}
          {notifications.slice(0, 10).map(n => (
            <button
              key={n.id}
              onClick={() => !n.isRead && markAsRead(n.id)}
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
