import React, { useState, useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, sendMessage, emitTyping } from '../lib/chat-socket';
import { Send } from 'lucide-react';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const safeDecodeJWT = (token: string) => { try { const b = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(atob(b)); } catch { return {}; } };

interface Conversation {
  userId: string; name: string; lastMessage: string; lastTime: Date; unread: number;
}

interface ChatMsg {
  id: string; senderId: string; senderName: string; recipientId: string;
  content: string; isRead: boolean; createdAt: string;
}

export function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; fullName: string; role: string }>>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchConversations(ac.signal);
    fetchUsers(ac.signal);
    const token = localStorage.getItem('kapwa_token');
    if (token) {
      const sock = connectSocket(token);
      sock.on('new_message', (msg: ChatMsg) => {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        fetchConversations();
      });
    }
    return () => { disconnectSocket(); ac.abort(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchConversations(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.ok) setConversations(await res.json());
    } catch (e) { console.error("MessagesPage:", e); } finally { setLoading(false); }
  }

  async function fetchUsers(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const userRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const me = userRes.ok ? (await userRes.json()).user : null;
      setUsers([
        { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', fullName: 'Admin User', role: 'admin' },
        { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', fullName: 'Juan Dela Cruz', role: 'social_worker' },
        { id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', fullName: 'Maria Santos', role: 'coordinator' },
      ].filter(u => u.id !== me?.id));
    } catch (e) { console.error("MessagesPage:", e); }
  }

  async function fetchConversation(otherUserId: string, signal?: AbortSignal) {
    setActiveConv(otherUserId);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/chat/conversation/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs);
      }
      await fetch(`${API_URL}/chat/conversation/${otherUserId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchConversations();
    } catch (e) { console.error("MessagesPage:", e); }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;
    const token = localStorage.getItem('kapwa_token');
    const payload = safeDecodeJWT(token!); const name = payload.fullName || payload.sub || 'User';
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
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Conversations List */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white rounded-l-lg flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-primary">Messages</h3>
          <button onClick={() => setShowNewChat(!showNewChat)} className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary-dark" aria-label="+ New">+ New</button>
        </div>

        {showNewChat && (
          <div className="border-b border-gray-100 p-3 space-y-1">
            <p className="text-xs text-gray-500 mb-1">Start a conversation:</p>
            {users.map(u => (
              <button key={u.id} onClick={() => { fetchConversation(u.id); setShowNewChat(false); }}
                className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">
                  {u.fullName.charAt(0)}
                </span>
                <span>{u.fullName}</span>
                <span className="ml-auto text-xs text-gray-400">{u.role}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No conversations yet</div>
          ) : conversations.map(conv => (
            <button key={conv.userId} onClick={() => fetchConversation(conv.userId)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${activeConv === conv.userId ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white font-medium">
                  {(conv.name || '?').charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{conv.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{formatTime(conv.lastTime.toString())}</p>
                  {conv.unread > 0 && (
                    <span className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-r-lg">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-1">💬</p>
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white font-medium">
                  {getOtherName(activeConv).charAt(0)}
                </span>
                <p className="text-sm font-medium text-gray-800">{getOtherName(activeConv)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const token = localStorage.getItem('kapwa_token');
                const decoded = token ? safeDecodeJWT(token) : {}; const myId = decoded.sub || "";
                const isMine = msg.senderId === myId;

                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      isMine ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-0.5 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="border-t border-gray-100 p-3 flex gap-2">
              <input
                type="text"
                value={text}
                onChange={e => {
                  setText(e.target.value);
                  emitTyping(activeConv);
                }}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#2E5C8A] focus:outline-none"
              />
              <button type="submit" disabled={!text.trim()} className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50">
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
