import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth-context';
import { loadQueue } from '../lib/offline-queue';
import { FilePlus, LayoutDashboard, Users, CheckCircle, FolderOpen, FileText, ClipboardList, HelpCircle, MessageSquare, Search, Shield, UserCircle, Stamp } from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';
import '../index.css';

interface NavItem { path: string; label: string; icon: React.ReactNode; roles: string[]; }

const NAV_ITEMS: NavItem[] = [
  { path: '/intake', label: 'GIS Intake', icon: <FilePlus size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
  { path: '/beneficiaries', label: 'Beneficiaries', icon: <Users size={20} />, roles: ['admin', 'social_worker'] },
  { path: '/cases', label: 'Case Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
  { path: '/coordinator', label: 'Coordinator', icon: <LayoutDashboard size={20} />, roles: ['coordinator'] },
  { path: '/tracker', label: 'Daily Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
  { path: '/interventions', label: 'Interventions', icon: <CheckCircle size={20} />, roles: ['admin', 'social_worker'] },
  { path: '/csr', label: 'CSR Generator', icon: <FileText size={20} />, roles: ['admin', 'social_worker'] },
  { path: '/filing', label: 'Digital Filing', icon: <FolderOpen size={20} />, roles: ['admin', 'social_worker'] },
  { path: '/approvals', label: 'Approvals', icon: <Stamp size={20} />, roles: ['admin', 'social_worker'] },
  { path: '/messages', label: 'Messages', icon: <MessageSquare size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
  { path: '/settings/mfa', label: 'MFA Settings', icon: <Shield size={20} />, roles: ['admin', 'mayor', 'auditor'] },
  { path: '/admin', label: 'Admin Panel', icon: <Shield size={20} />, roles: ['admin'] },
  { path: '/my-dashboard', label: 'My Dashboard', icon: <UserCircle size={20} />, roles: ['claimant'] },
];

function computePendingCount(): number {
  try {
    const queue = loadQueue();
    return queue.filter(c => c.status === 'pending').length;
  } catch {
    return 0;
  }
}

export function Layout({ children }: { children?: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    getCurrentUser().then(u => { setUser(u); setLoading(false); });

    // Read pending count from correct queue (kapwa_sync_queue, removed legacy key)
    setPendingCount(computePendingCount());

    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kapwa_sync_queue') {
        setPendingCount(computePendingCount());
      }
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {offline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
          You are offline{pendingCount > 0 ? ` — ${pendingCount} change(s) pending sync` : ''} — changes will sync when connection is restored
        </div>
      )}
      <div className="min-h-screen bg-surface">
        <header className="header">
          <div className="header-left">
            <div className="municipal-seal">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <span className="header-title">KAPWA | Norzagaray MSWDO</span>
            {user && <span className="ml-3 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">{user.role.replace('_', ' ')}</span>}
          </div>
          <div className="header-right">
            <div className="search-bar">
              <Search className="search-icon" size={20} stroke="#6B7280" />
              <input type="text" aria-label="Search records" placeholder="Search records..." className="search-input" />
            </div>
            <NotificationsDropdown />
            <button className="icon-btn" title="Help" aria-label="Help"><HelpCircle size={20} /></button>
            <button className="icon-btn" title="Messages" aria-label="Messages"><MessageSquare size={20} /></button>
            <div className="profile-area">
              <div className="profile-avatar">{(user?.fullName || 'U').charAt(0)}</div>
            </div>
          </div>
        </header>

        <div className="layout">
          <aside className="sidebar">
            <nav className="sidebar-nav">
              {visibleNav.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className={`nav-link ${isActive ? 'active' : ''}`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="main-content">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </>
  );
}
