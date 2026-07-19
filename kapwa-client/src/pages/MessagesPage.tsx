import { useState, useEffect, useRef, useMemo } from 'react';
import { mutate as globalMutate } from 'swr';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket, emitTyping } from '../lib/chat-socket';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Send, MessageSquare, Search, X, Check, CheckCheck, ChevronLeft, Plus } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const safeDecodeJWT = (token: string) => {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b));
  } catch {
    return {};
  }
};

interface Conversation {
  userId: string; name: string; role?: string; lastMessage: string; lastTime: Date; unread: number;
}

interface ChatMsg {
  id: string; senderId: string; senderName: string; recipientId: string;
  content: string; isRead: boolean; createdAt: string;
}

interface ChatUser {
  id: string; fullName: string; role: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-500', social_worker: 'bg-emerald-500', coordinator: 'bg-purple-500',
  claimant: 'bg-amber-500', mayor: 'bg-rose-500', auditor: 'bg-slate-500',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', social_worker: 'Social Worker', coordinator: 'Coordinator',
  claimant: 'Claimant', mayor: 'Mayor', auditor: 'Auditor',
};

function roleColor(role?: string): string {
  return ROLE_COLORS[role || ''] || 'bg-gray-400';
}

function roleLabel(role?: string): string {
  return ROLE_LABELS[role || ''] || role?.replace(/_/g, ' ') || '';
}

const TZ = 'Asia/Manila';
const timeFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, month: 'short', day: 'numeric' });
const dayLabelFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDate.getTime() === today.getTime()) return timeFmt.format(d);
  if (diffDays < 7) return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${timeFmt.format(d)}`;
  return shortDateFmt.format(d);
}

function formatConversationTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDate.getTime() === today.getTime()) return timeFmt.format(d);
  if (msgDate.getTime() === today.getTime() - 86400000) return 'Yesterday';
  return shortDateFmt.format(d);
}

function getDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return dayLabelFmt.format(d);
  return dateFmt.format(d);
}

export function MessagesPage() {
  const { userId: urlUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [pendingNew, setPendingNew] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showMobileConv, setShowMobileConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data: conversations = [] } = useSWR<Conversation[]>(queryKeys.messages.list());
  const { data: _rawUsers } = useSWR<ChatUser[]>(queryKeys.messages.chatUsers(), { fallbackData: [] });
  const rawUsers = _rawUsers ?? [];
  const { data: _convMessages } = useSWR<ChatMsg[]>(
    activeConv ? queryKeys.messages.conversation(activeConv) : null,
  );
  const convMessages = _convMessages ?? [];

  const loading = !conversations;

  const readConversation = useSWRMutation(
    queryKeys.messages.conversation(activeConv || ''),
    async (_key, { arg }: { arg: { otherUserId: string } }) => {
      await api.post(`/chat/conversation/${arg.otherUserId}/read`);
    },
  );

  const displayMessages: ChatMsg[] = useMemo(() => {
    if (!activeConv) return [];
    const map = new Map<string, ChatMsg>();
    convMessages.forEach(m => map.set(m.id, m));
    pendingNew
      .filter(m => m.senderId === activeConv || m.recipientId === activeConv)
      .forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [convMessages, pendingNew, activeConv]);

  const activeConvRef = useRef(activeConv);
  activeConvRef.current = activeConv;

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (!token) return;
    const sock = connectSocket(token);

    const handler = (msg: ChatMsg) => {
      setPendingNew(prev => {
        const filtered = prev.filter(m => !(
          m.id.startsWith('pending-') && m.senderId === msg.senderId &&
          m.recipientId === msg.recipientId && m.content === msg.content
        ));
        return filtered.some(m => m.id === msg.id) ? filtered : [...filtered, msg];
      });
      globalMutate(queryKeys.messages.list());
      const conv = activeConvRef.current;
      if (conv && (msg.senderId === conv || msg.recipientId === conv)) {
        globalMutate(queryKeys.messages.conversation(conv));
      }
    };

    const typingHandler = (data: { userId: string }) => {
      setTypingUsers(prev => new Set(prev).add(data.userId));
      clearTimeout((window as any).__typingTimers?.[data.userId]);
      const timers = (window as any).__typingTimers || {};
      timers[data.userId] = setTimeout(() => {
        setTypingUsers(prev => { const next = new Set(prev); next.delete(data.userId); return next; });
      }, 3000);
      (window as any).__typingTimers = timers;
    };

    sock.on('new_message', handler);
    sock.on('user_typing', typingHandler);

    return () => {
      sock.off('new_message', handler);
      sock.off('user_typing', typingHandler);
      Object.values((window as any).__typingTimers || {}).forEach(id => clearTimeout(id as number));
    };
  }, []);

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  // Auto-select conversation from URL param
  useEffect(() => {
    if (urlUserId && urlUserId !== activeConv) {
      setActiveConv(urlUserId);
      setPendingNew([]);
      setShowMobileConv(true);
      readConversation.trigger({ otherUserId: urlUserId });
      globalMutate(queryKeys.messages.list());
    }
  }, [urlUserId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, autoScroll]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }

  function selectConversation(otherUserId: string) {
    setActiveConv(otherUserId);
    setPendingNew([]);
    setShowNewChat(false);
    setContactSearch('');
    setAutoScroll(true);
    setShowMobileConv(true);
    readConversation.trigger({ otherUserId });
    globalMutate(queryKeys.messages.list());
    navigate(`/messages/${otherUserId}`, { replace: true });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;
    const token = localStorage.getItem('kapwa_token');
    const decoded = token ? safeDecodeJWT(token) : {};
    const senderName = decoded.email || decoded.sub || 'Unknown';
    const content = text.trim();
    const senderId = decoded.sub || '';
    setText('');

    const sentAt = new Date().toISOString();
    const optimistic: ChatMsg = {
      id: `pending-${Date.now()}`,
      senderId, senderName, recipientId: activeConv,
      content, isRead: false, createdAt: sentAt,
    };
    setPendingNew(prev => [...prev, optimistic]);

    try {
      const saved = await api.post<ChatMsg>('/chat/send', { recipientId: activeConv, content, senderName });
      saved.createdAt = sentAt;
      setPendingNew(prev => prev.filter(m => m.id !== optimistic.id).concat(saved));
      globalMutate(queryKeys.messages.conversation(activeConv));
      globalMutate(queryKeys.messages.list());
    } catch {
      // optimistic stays in list
    }
  }

  function getOtherName(userId: string) {
    const conv = conversations.find(c => c.userId === userId);
    if (conv?.name) return conv.name;
    const u = rawUsers.find(u => u.id === userId);
    return u?.fullName || userId.slice(0, 8);
  }

  function getOtherRole(userId: string) {
    const conv = conversations.find(c => c.userId === userId);
    if (conv?.role) return conv.role;
    const u = rawUsers.find(u => u.id === userId);
    return u?.role;
  }

  const filteredUsers = rawUsers.filter(
    u => u.fullName?.toLowerCase().includes(contactSearch.toLowerCase()),
  );
  const existingConvIds = new Set(conversations.map(c => c.userId));
  const unreadCount = (userId: string) => conversations.find(c => c.userId === userId)?.unread ?? 0;
  const isTyping = activeConv ? typingUsers.has(activeConv) : false;

  return (
    <PageShell title="Messages" description="Chat with your team">
      <div className="flex h-[calc(100vh-12rem)] gap-0 rounded-xl border bg-card overflow-hidden shadow-sm">
        {/* Sidebar */}
        <div className={cn(
          'w-80 flex-shrink-0 border-r bg-card flex flex-col',
          showMobileConv && 'hidden lg:flex',
        )}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Messages</h2>
              <p className="text-[11px] text-muted-foreground">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
            </div>
            <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="h-8 gap-1.5">
                  <Plus size={14} /> New
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text" placeholder="Search contacts..." value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      className="h-9 pl-9 pr-8 text-sm" autoFocus
                    />
                    {contactSearch && (
                      <button onClick={() => setContactSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1 -mx-2">
                    {filteredUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-8 text-center">No contacts found</p>
                    ) : (
                      filteredUsers.map(u => (
                        <button key={u.id} onClick={() => selectConversation(u.id)}
                          className="w-full text-left rounded-lg px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-3 transition-colors group"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={cn('text-xs text-white font-medium', roleColor(u.role))}>
                              {(u.fullName || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{u.fullName}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">{roleLabel(u.role)}</p>
                          </div>
                          {existingConvIds.has(u.id) && (
                            <span className="text-[11px] text-muted-foreground/60 italic shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">Existing</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-1 p-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse px-2 py-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-2.5 w-40 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-6">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <MessageSquare size={24} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1 text-center">Click <strong>New</strong> to start messaging a team member.</p>
              </div>
            ) : (
              <div className="py-1">
                {conversations.map(conv => (
                  <button key={conv.userId} onClick={() => selectConversation(conv.userId)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-accent/60 transition-colors border-b border-border/40 last:border-b-0',
                      activeConv === conv.userId && 'bg-accent',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className={cn('text-sm text-white font-medium', roleColor(conv.role))}>
                          {(conv.name || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{conv.name}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatConversationTime(conv.lastTime.toString())}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                          {conv.unread > 0 && (
                            <Badge className="shrink-0 h-5 min-w-5 px-1.5 text-[11px] font-medium flex items-center justify-center" variant="default">
                              {conv.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={cn(
          'flex-1 flex flex-col bg-background',
          !showMobileConv && 'hidden lg:flex',
        )}>
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center px-6">
                <div className="rounded-full bg-muted p-4 mx-auto mb-4 w-fit">
                  <MessageSquare size={32} className="opacity-30" />
                </div>
                <p className="text-sm font-medium text-foreground">Your Messages</p>
                <p className="text-xs mt-1 max-w-xs">
                  Select a conversation from the sidebar or start a new one.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b px-4 py-3.5 bg-card">
                <button onClick={() => setShowMobileConv(false)}
                  className="lg:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={20} />
                </button>
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className={cn('text-sm text-white font-medium', roleColor(getOtherRole(activeConv)))}>
                    {getOtherName(activeConv).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{getOtherName(activeConv)}</p>
                  <p className={cn(
                    'text-[11px]',
                    isTyping ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {isTyping ? 'Typing...' : roleLabel(getOtherRole(activeConv))}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollContainerRef} onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth"
              >
                {displayMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-xs">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <>
                    {displayMessages.map((msg, idx) => {
                      const token = localStorage.getItem('kapwa_token');
                      const decoded = token ? safeDecodeJWT(token) : {};
                      const myId = decoded.sub || '';
                      const isMine = msg.senderId === myId;
                      const showDateSep = idx === 0 || getDateSeparator(msg.createdAt) !== getDateSeparator(displayMessages[idx - 1].createdAt);

                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex justify-center my-4">
                              <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                                {getDateSeparator(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <div className={cn('flex mb-1.5', isMine ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                              'max-w-[75%] lg:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md',
                              msg.id.startsWith('pending-') && 'opacity-60',
                            )}>
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              <div className={cn(
                                'flex items-center gap-1.5 mt-1',
                                isMine ? 'justify-end' : 'justify-start',
                              )}>
                                <span className={cn(
                                  'text-[10px] leading-none',
                                  isMine ? 'text-primary-foreground/60' : 'text-muted-foreground',
                                )}>
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                                {isMine && (
                                  msg.id.startsWith('pending-')
                                    ? <span className="text-[10px] text-primary-foreground/50">Sending</span>
                                    : msg.isRead
                                      ? <CheckCheck size={12} className="text-primary-foreground/60 shrink-0" />
                                      : <Check size={12} className="text-primary-foreground/60 shrink-0" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="flex justify-start mb-1.5">
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="border-t bg-card p-4">
                <div className="flex items-end gap-2 max-w-4xl mx-auto">
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      value={text}
                      onChange={e => {
                        setText(e.target.value);
                        emitTyping(activeConv);
                      }}
                      placeholder="Type a message..."
                      className="h-11 pr-12 rounded-xl bg-background border-border/60 focus-visible:ring-primary/30 text-sm"
                    />
                    {text.length > 0 && (
                      <span className="absolute right-3 bottom-1/2 translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">
                        {text.length}
                      </span>
                    )}
                  </div>
                  <Button type="submit" disabled={!text.trim()}
                    className="h-11 w-11 rounded-xl shrink-0"
                    size="icon" aria-label="Send"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
