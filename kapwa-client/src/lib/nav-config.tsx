import {
  FilePlus, LayoutDashboard, Users, CheckCircle,
  ClipboardList, Shield, UserCircle, Stamp, Settings, MessageSquare,
  FileWarning, IdCard, ScrollText, BarChart3, Send, BadgeCheck,
  Megaphone, CalendarDays, Share2, ScanSearch,
} from 'lucide-react';
import { FEATURE_ANALYTICS_ENABLED } from './feature-flags';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/coordinator/dashboard', label: 'Barangay Coordinator', icon: <LayoutDashboard size={20} />, roles: ['coordinator'] },
      { path: '/intake', label: 'General Intake', icon: <FilePlus size={20} />, roles: ['admin', 'social_worker',] },
      // MSWDO <-> barangay referrals. One entry for all three roles; the page
      // shows the coordinator their sent referrals and MSWDO the pending queue.
      { path: '/referrals', label: 'Referrals', icon: <Share2 size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/cases', label: 'Cases', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/team', label: 'Team Workspace', icon: <CalendarDays size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/beneficiaries', label: 'Beneficiaries', icon: <Users size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/coordinator/access-cards', label: 'Access Cards', icon: <BadgeCheck size={20} />, roles: ['coordinator'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/tracker', label: 'Daily Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/approvals', label: 'Approvals', icon: <Stamp size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/announcements/manage', label: 'Announcements', icon: <Megaphone size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/client-dedup', label: 'Client Deduplication', icon: <ScanSearch size={20} />, roles: ['admin', 'social_worker'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/admin', label: 'Admin Panel', icon: <Shield size={20} />, roles: ['admin'] },
      { path: '/admin/programs', label: 'Programs', icon: <ScrollText size={20} />, roles: ['admin'] },
    ],
  },

  {
    label: 'Claimant',
    items: [
      { path: '/my-dashboard', label: 'My Dashboard', icon: <UserCircle size={20} />, roles: ['claimant'] },
      { path: '/my-access-card', label: 'My Access Card', icon: <IdCard size={20} />, roles: ['claimant'] },
    ],
  },

  ...(FEATURE_ANALYTICS_ENABLED
      ? [{
          label: 'Insights',
          items: [
            { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} />, roles: ['admin', 'social_worker'] },
          ],
        }]
      : []),

  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: <Settings size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'claimant'] },
    ],
  },
];
