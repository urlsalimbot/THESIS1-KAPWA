export const ROLE_REDIRECT_MAP: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
  mayor: '/reports',
  auditor: '/audit-logs',
  agency_staff: '/agency/dashboard',
};

// Must mirror the @Roles decorators on kapwa-server notifications.controller
export const NOTIFICATION_ROLES = [
  'admin', 'social_worker', 'coordinator', 'claimant', 'auditor',
];

// Must mirror the @Roles decorators on kapwa-server chat.controller
export const CHAT_ROLES = ['admin', 'social_worker', 'coordinator', 'claimant'];
