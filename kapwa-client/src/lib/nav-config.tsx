import {
  FilePlus, LayoutDashboard, Users, CheckCircle, FolderOpen, FileText,
  ClipboardList, Shield, UserCircle, Stamp, Settings, MessageSquare,
  FileWarning, IdCard, ScrollText, BarChart3, History,
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
      { path: '/intake', label: 'GIS Intake', icon: <FilePlus size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
      { path: '/cases', label: 'Cases', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/beneficiaries', label: 'Beneficiaries', icon: <Users size={20} />, roles: ['admin', 'social_worker'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/coordinator', label: 'Barangay Coordinator', icon: <LayoutDashboard size={20} />, roles: ['coordinator'] },
      { path: '/tracker', label: 'Daily Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
      { path: '/interventions', label: 'Interventions', icon: <CheckCircle size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/irf', label: 'Incident Reports', icon: <FileWarning size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/csr', label: 'CSR Generator', icon: <FileText size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/filing', label: 'Digital Filing', icon: <FolderOpen size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/approvals', label: 'Approvals', icon: <Stamp size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/access-cards', label: 'Access Cards', icon: <IdCard size={20} />, roles: ['admin', 'social_worker'] },
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
