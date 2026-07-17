import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { connectSocket, disconnectSocket, sendMessage, emitTyping } from '../lib/chat-socket';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Send, MessageSquare, Search, X } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const safeDecodeJWT = (token: string) => { try { const b = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(atob(b)); } catch { return {}; } };

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

export function MessagesPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [pendingNew, setPendingNew] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useSWR<Conversation[]>(queryKeys.messages.list());
  const { data: meData } = useSWR<{ user?: { id: string } }>(queryKeys.auth.me());
  const { data: allUsers = [] } = useSWR<ChatUser[]>(queryKeys.messages.chatUsers());
  const { data: convMessages = [] } = useSWR<ChatMsg[]>(
    activeConv ? queryKeys.messages.conversation(activeConv) : null,
  );

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

  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (!token) return;
    const sock = connectSocket(token);
    const handler = (msg: ChatMsg) => {
      setPendingNew(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      globalMutate(queryKeys.messages.list());
      const conv = activeConvRef.current;
      if (conv && (msg.senderId === conv || msg.recipientId === conv)) {
        globalMutate(queryKeys.messages.conversation(conv));
      }
    };
    sock.on('new_message', handler);
    return () => { sock.off('new_message', handler); };
  }, [globalMutate]);

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, pendingNew]);

  function selectConversation(otherUserId: string) {
    setActiveConv(otherUserId);
    setPendingNew([]);
    setShowNewChat(false);
    setContactSearch('');
    readConversation.trigger({ otherUserId });
    globalMutate(queryKeys.messages.list());
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;
    const token = localStorage.getItem('kapwa_token');
    const decoded = token ? safeDecodeJWT(token) : {};
    const senderName = decoded.email || decoded.sub || 'Unknown';
    sendMessage(activeConv, text.trim(), senderName);
    setText('');
  }

  function getOtherName(userId: string) {
    const conv = conversations.find(c => c.userId === userId);
    return conv?.name || userId.slice(0, 8);
  }

  function getOtherRole(userId: string) {
    const conv = conversations.find(c => c.userId === userId);
    return conv?.role;
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const filteredUsers = allUsers.filter(
    u => u.fullName?.toLowerCase().includes(contactSearch.toLowerCase()),
  );

  const existingConvIds = new Set(conversations.map(c => c.userId));

  const unreadCount = (userId: string) => conversations.find(c => c.userId === userId)?.unread ?? 0;

  return (
    <PageShell title="Messages" description="Chat with other MSWDO team members">
      <div className="flex h-[calc(100vh-12rem)] gap-0 rounded-lg border overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r bg-card flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">Messages</h2>
            <Button size="sm" variant="default" onClick={() => { setShowNewChat(!showNewChat); setContactSearch(''); }} aria-label="+ New">
              + New
            </Button>
          </div>

          {showNewChat && (
            <div className="border-b p-3 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="h-8 pl-8 pr-7 text-sm"
                  autoFocus
                />
                {contactSearch && (
                  <button onClick={() => setContactSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No contacts found</p>
                ) : (
                  filteredUsers.map(u => (
                    <button key={u.id} onClick={() => selectConversation(u.id)}
                      className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium shrink-0">
                        {(u.fullName || '?').charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{u.fullName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{u.role.replace(/_/g, ' ')}</p>
                      </div>
                      {existingConvIds.has(u.id) && (
                        <span className="text-[10px] text-muted-foreground">existing</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Click + New to start one</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button key={conv.userId} onClick={() => selectConversation(conv.userId)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors',
                    activeConv === conv.userId && 'bg-accent',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground font-medium shrink-0">
                      {(conv.name || '?').charAt(0)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{conv.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.lastTime.toString())}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    </div>
                    {conv.unread > 0 && (
                      <Badge className="ml-auto shrink-0" variant="default">{conv.unread}</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-card">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground font-medium shrink-0">
                    {getOtherName(activeConv).charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{getOtherName(activeConv)}</p>
                    {getOtherRole(activeConv) && (
                      <p className="text-xs text-muted-foreground capitalize">{getOtherRole(activeConv)!.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {displayMessages.map(msg => {
                  const token = localStorage.getItem('kapwa_token');
                  const decoded = token ? safeDecodeJWT(token) : {};
                  const myId = decoded.sub || '';
                  const isMine = msg.senderId === myId;

                  return (
                    <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                      )}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={cn(
                          'text-xs mt-1',
                          isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                        )}>
                          {formatTime(msg.createdAt)}
                          {isMine && !msg.isRead && (
                            <span className="ml-2 italic opacity-60">sending</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="border-t p-3 flex gap-2">
                <Input
                  type="text"
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    emitTyping(activeConv);
                  }}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={!text.trim()} aria-label="Send">
                  <Send size={16} />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
