import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, MailOpen, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import { queryKeys } from '../lib/query-keys';
import { connectSocket } from '../lib/chat-socket';

interface Conversation {
  userId: string; name: string; lastMessage: string; lastTime: string; unread: number;
}

export default function MessagesPopover() {
  const navigate = useNavigate();
  const { mutate: globalMutate } = useSWRConfig();
  const [open, setOpen] = useState(false);

  const { data: conversations = [] } = useSWR<Conversation[]>(queryKeys.messages.list());
  const { data: unreadData } = useSWR<{ count: number }>(queryKeys.messages.unread());
  const unreadCount = unreadData?.count ?? 0;

  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (!token) return;
    const sock = connectSocket(token);
    const handler = () => {
      globalMutate(queryKeys.messages.list());
      globalMutate(queryKeys.messages.unread());
    };
    sock.on('new_message', handler);
    return () => { sock.off('new_message', handler); };
  }, [globalMutate]);

  function formatTime(dateStr: string) {
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

  const recent = conversations.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Messages">
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[16px] font-bold text-accent-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Messages</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <Separator />
        <div className="max-h-[300px] overflow-y-auto">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MailOpen size={32} className="mb-2 opacity-40" />
              <span className="text-sm">No conversations yet</span>
            </div>
          ) : (
            recent.map((conv) => (
              <button
                key={conv.userId}
                className={cn(
                  'w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 cursor-pointer',
                  conv.unread > 0 && 'bg-muted/30'
                )}
                onClick={() => { setOpen(false); navigate('/messages'); }}
              >
                <div className="mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground font-medium">
                  {(conv.name || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{conv.name || 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.lastTime)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{conv.lastMessage}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <Separator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => { setOpen(false); navigate('/messages'); }}>
            View all messages
            <ExternalLink size={14} />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
