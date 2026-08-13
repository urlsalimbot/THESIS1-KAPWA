const en = {
  "nav": {
    "language": "Language",
    "english": "English",
    "filipino": "Filipino",
  },
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "loading": "Loading...",
  },
  "status": {
    "enrolled": "Enrolled",
    "assessed": "Assessed",
    "in_review": "In Review",
    "active": "Active",
    "transitioning": "Transitioning",
    "closed": "Closed",
  },
  "category": {
    "Children": "Children",
    "Youth": "Youth",
    "Women": "Women",
    "PWD": "PWD",
    "Senior": "Senior",
    "Indigent": "Indigent",
    "4Ps": "4Ps",
    "IP": "IP",
    "Family": "Family",
  },
  "interventionType": {
    "FA": "Financial Assistance",
    "C": "Counseling",
    "CSR": "Case Study Report",
    "R": "Referral",
    "H": "Home Visit",
    "HV": "Home Visit",
    "Other": "Other",
  },
  "referralStatus": {
    "referred": "Referred",
    "received": "Received",
    "actioned": "Actioned",
    "closed": "Closed",
    "declined": "Declined",
  },
  "syncStatus": {
    "pending": "Pending",
    "syncing": "Syncing",
    "failed": "Failed",
    "conflict": "Conflict",
  },
  "time": {
    "justNow": "just now",
    "minutesAgo_one": "{{count}} min ago",
    "minutesAgo_other": "{{count}} min ago",
    "hoursAgo_one": "{{count}} hr {{minutes}} min ago",
    "hoursAgo_other": "{{count}} hr {{minutes}} min ago",
    "daysAgo_one": "{{count}} days ago",
    "daysAgo_other": "{{count}} days ago",
  },
  "topbar": {
    "approvalsQueue": "Approvals Queue",
    "cancel": "Cancel",
    "language": "Language",
    "logout": "Logout",
    "logoutConfirm": "Log out",
    "logoutDescription": "You will be signed out of your account and redirected to the login page.",
    "logoutTitle": "Log out?",
    "newIntake": "New Intake",
    "offline": "Offline",
    "offlineBanner_one": "You are offline — {{count}} change(s) pending sync. Do not clear app data.",
    "offlineBanner_other": "You are offline — {{count}} change(s) pending sync. Do not clear app data.",
    "offlineIndicator": "Offline indicator",
    "openUserMenu": "Open user menu",
    "pendingSync_one": "{{count}} pending",
    "pendingSync_other": "{{count}} pending",
    "pendingSyncCount": "Pending sync count",
    "settings": "Settings",
    "theme": "Theme",
    "themeDark": "Dark",
    "themeLight": "Light",
    "themeSystem": "System",
    "toggleNavigation": "Toggle navigation menu",
  },
} as const;

export default en;

// Value-widened recursive map: keys must match the en tree exactly, values
// are plain strings (so fil can hold different translations).
type DeepString<T> = { [K in keyof T]: T[K] extends Record<string, unknown> ? DeepString<T[K]> : string };
export type EnLocale = DeepString<typeof en>;
