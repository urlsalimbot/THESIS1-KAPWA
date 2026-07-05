import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, MailOpen, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  unread: boolean;
  timestamp: string;
}

const MOCK_MESSAGES: Message[] = [
  { id: '1', sender: 'System', subject: 'Case #2024-001 Approved', preview: 'The social welfare case has been approved for disbursement.', unread: true, timestamp: '2m ago' },
  { id: '2', sender: 'Maria Santos', subject: 'Beneficiary Update', preview: 'Updated contact information for beneficiary Juan Dela Cruz.', unread: true, timestamp: '15m ago' },
  { id: '3', sender: 'Coordinator', subject: 'Schedule Reminder', preview: 'Reminder: Weekly team meeting at 2 PM tomorrow.', unread: false, timestamp: '1h ago' },
  { id: '4', sender: 'System', subject: 'Sync Complete', preview: 'Offline changes synchronized successfully.', unread: false, timestamp: '3h ago' },
];

export default function MessagesPopover() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages] = useState<Message[]>(MOCK_MESSAGES);
  const unreadCount = messages.filter(m => m.unread).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Messages">
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-[16px] font-bold text-accent-foreground">
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
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MailOpen size={32} className="mb-2 opacity-40" />
              <span className="text-sm">No messages yet</span>
            </div>
          ) : (
            messages.map((msg) => (
              <button
                key={msg.id}
                className={cn(
                  'w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 cursor-pointer',
                  msg.unread && 'bg-muted/30'
                )}
                onClick={() => { setOpen(false); navigate('/messages'); }}
              >
                <div className="mt-0.5 shrink-0">
                  {msg.unread ? (
                    <Mail size={16} className="text-accent" />
                  ) : (
                    <MailOpen size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{msg.sender}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{msg.timestamp}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{msg.preview}</p>
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
