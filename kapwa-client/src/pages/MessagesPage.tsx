import React, { useState, useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { connectSocket, disconnectSocket, sendMessage, emitTyping } from '../lib/chat-socket';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { Send } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const safeDecodeJWT = (token: string) => { try { const b = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(atob(b)); } catch { return {}; } };

interface Conversation {
  userId: string; name: string; lastMessage: string; lastTime: Date; unread: number;
}

interface ChatMsg {
  id: string; senderId: string; senderName: string; recipientId: string;
  content: string; isRead: boolean; createdAt: string;
}

export function MessagesPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [pendingNew, setPendingNew] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useSWR<Conversation[]>(queryKeys.messages.list());
  const { data: meData } = useSWR<{ user?: { id: string } }>(queryKeys.auth.me());
  const { data: convMessages = [] } = useSWR<ChatMsg[]>(
    activeConv ? queryKeys.messages.conversation(activeConv) : null,
  );

  const loading = !conversations;

  const users = [
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', fullName: 'Admin User', role: 'admin' },
    { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', fullName: 'Juan Dela Cruz', role: 'social_worker' },
    { id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', fullName: 'Maria Santos', role: 'coordinator' },
  ].filter(u => u.id !== meData?.user?.id);

  const readConversation = useSWRMutation(
    queryKeys.messages.conversation(activeConv || ''),
    async (_key, { arg }: { arg: { otherUserId: string } }) => {
      await api.post(`/chat/conversation/${arg.otherUserId}/read`);
    },
  );

  // Combine cached conversation messages with any pending live-arrival messages.
  // The conversation fetcher returns the new state; we render that directly.
  const displayMessages: ChatMsg[] = activeConv ? convMessages : [];

  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (token) {
      const sock = connectSocket(token);
      sock.on('new_message', (msg: ChatMsg) => {
        setPendingNew(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        globalMutate(queryKeys.messages.list());
      });
    }
    return () => { disconnectSocket(); };
  }, [globalMutate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, pendingNew]);

  function selectConversation(otherUserId: string) {
    setActiveConv(otherUserId);
    setPendingNew([]);
    readConversation.trigger({ otherUserId });
    globalMutate(queryKeys.messages.list());
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;
    sendMessage(activeConv, text.trim());
    setText('');
  }

  function getOtherName(userId: string) {
    const u = users.find(u => u.id === userId);
    return u ? u.fullName : userId.slice(0, 8);
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <PageShell title="Messages" description="Chat with other MSWDO team members">
      <div className="flex h-[calc(100vh-12rem)] gap-0 rounded-lg border overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r bg-card flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-primary">Messages</h3>
            <Button size="sm" variant="default" onClick={() => setShowNewChat(!showNewChat)} aria-label="+ New">
              + New
            </Button>
          </div>

          {showNewChat && (
            <div className="border-b p-3 space-y-1">
              <p className="text-xs text-muted-foreground mb-1">Start a conversation:</p>
              {users.map(u => (
                <button key={u.id} onClick={() => { selectConversation(u.id); setShowNewChat(false); }}
                  className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {u.fullName.charAt(0)}
                  </span>
                  <span>{u.fullName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{u.role}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No conversations yet</div>
            ) : conversations.map(conv => (
              <button key={conv.userId} onClick={() => selectConversation(conv.userId)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors ${activeConv === conv.userId ? 'bg-accent' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground font-medium">
                    {(conv.name || '?').charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{conv.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{formatTime(conv.lastTime.toString())}</p>
                    {conv.unread > 0 && (
                      <Badge className="mt-1">{conv.unread}</Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-card">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-1">💬</p>
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground font-medium">
                    {getOtherName(activeConv).charAt(0)}
                  </span>
                  <p className="text-sm font-medium text-foreground">{getOtherName(activeConv)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {displayMessages.map(msg => {
                  const token = localStorage.getItem('kapwa_token');
                  const decoded = token ? safeDecodeJWT(token) : {}; const myId = decoded.sub || "";
                  const isMine = msg.senderId === myId;

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-0.5 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatTime(msg.createdAt)}
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
