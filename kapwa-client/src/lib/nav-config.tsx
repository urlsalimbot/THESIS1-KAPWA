import {
  FilePlus, LayoutDashboard, Users, CheckCircle,
  ClipboardList, Shield, UserCircle, Stamp, Settings, MessageSquare,
  FileWarning, IdCard, ScrollText, BarChart3, History, Send, BadgeCheck,
  Megaphone, Building2,
} from 'lucide-react';

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
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'social_worker', 'mayor', 'auditor'] },
      { path: '/coordinator/dashboard', label: 'Barangay Coordinator', icon: <LayoutDashboard size={20} />, roles: ['coordinator'] },
      { path: '/intake', label: 'General Intake', icon: <FilePlus size={20} />, roles: ['admin', 'social_worker',] },
      { path: '/referrals', label: 'Referrals', icon: <Send size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/cases', label: 'Cases', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/beneficiaries', label: 'Beneficiaries', icon: <Users size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/coordinator/access-cards', label: 'Access Cards', icon: <BadgeCheck size={20} />, roles: ['coordinator'] },
    ],
  },
  {
    label: 'Agency Portal',
    items: [
      { path: '/agency/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['agency_staff'] },
      { path: '/agency/referrals', label: 'Inter-Agency Referrals', icon: <Send size={20} />, roles: ['agency_staff'] },
      { path: '/agency/card-activities', label: 'Card Activities', icon: <BadgeCheck size={20} />, roles: ['agency_staff'] },
      { path: '/agency/profile', label: 'Agency Profile', icon: <Building2 size={20} />, roles: ['agency_staff'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/tracker', label: 'Daily Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/irf', label: 'Incident Reports', icon: <FileWarning size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/approvals', label: 'Approvals', icon: <Stamp size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/announcements/manage', label: 'Announcements', icon: <Megaphone size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/admin', label: 'Admin Panel', icon: <Shield size={20} />, roles: ['admin'] },
      { path: '/programs', label: 'Programs', icon: <ScrollText size={20} />, roles: ['admin'] },
    ],
  },

  {
    label: 'Claimant',
    items: [
      { path: '/my-dashboard', label: 'My Dashboard', icon: <UserCircle size={20} />, roles: ['claimant'] },
      { path: '/my-access-card', label: 'My Access Card', icon: <IdCard size={20} />, roles: ['claimant'] },
    ],
  },

  {
    label: 'Mayor',
    items: [
      { path: '/reports', label: 'Reports', icon: <BarChart3 size={20} />, roles: ['mayor'] },
    ],
  },

  {
    label: 'Auditor',
    items: [
      { path: '/audit-logs', label: 'Audit Logs', icon: <History size={20} />, roles: ['auditor'] },
    ],
  },

  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: <Settings size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor', 'claimant'] },
    ],
  },
];
