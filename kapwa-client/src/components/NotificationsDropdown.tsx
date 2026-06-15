import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchNotifications() {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/notifications/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications(await res.json());
    } catch {} finally { setLoading(false); }
  }

  async function fetchUnreadCount() {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {}
  }

  async function markAsRead(id: string) {
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }

  async function markAllRead() {
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }

  function categoryIcon(cat: string) {
    switch (cat) {
      case 'case_update': return '📋';
      case 'sync_conflict': return '🔄';
      case 'chat': return '💬';
      case 'approval': return '✅';
      case 'disbursement': return '💰';
      default: return '🔔';
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setOpen(!open)} className="icon-btn relative" title="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#2E5C8A] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!loading && notifications.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">No notifications</div>
            )}
            {notifications.slice(0, 10).map(n => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markAsRead(n.id)}
                className={`flex gap-3 border-b border-gray-50 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50/50' : ''}`}
              >
                <span className="mt-0.5 text-lg">{categoryIcon(n.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.isRead ? 'font-semibold' : ''} text-gray-800`}>{n.title}</p>
                  <p className="text-xs text-gray-500 truncate">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-[#2E5C8A] flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
