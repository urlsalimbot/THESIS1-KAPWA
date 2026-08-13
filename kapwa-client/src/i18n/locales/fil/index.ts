import type { EnLocale } from '../en';

// TEMP: some values are English placeholders until Task 7 translation.
const fil: EnLocale = {
  "time": {
    "daysAgo_one": "{{count}} araw ang nakalipas",
    "daysAgo_other": "{{count}} araw ang nakalipas",
    "hoursAgo_one": "{{count}} oras {{minutes}} minuto ang nakalipas",
    "hoursAgo_other": "{{count}} oras {{minutes}} minuto ang nakalipas",
    "justNow": "kakailangan pa lang",
    "minutesAgo_one": "{{count}} minuto ang nakalipas",
    "minutesAgo_other": "{{count}} minuto ang nakalipas"
  },
  "topbar": {
    "approvalsQueue": "Pila ng Pag-apruba",
    "cancel": "Kanselahin",
    "language": "Wika",
    "logout": "Mag-log out",
    "logoutConfirm": "Mag-log out",
    "logoutDescription": "Ma-sign out ka sa iyong account at ililipat ka sa login page.",
    "logoutTitle": "Mag-log out?",
    "newIntake": "Bagong Intake",
    "offline": "Offline",
    "offlineBanner_one": "Ikaw ay offline — {{count}} pagbabago ang naka-pending na i-sync. Huwag i-clear ang app data.",
    "offlineBanner_other": "Ikaw ay offline — {{count}} pagbabago ang naka-pending na i-sync. Huwag i-clear ang app data.",
    "offlineIndicator": "Indikator ng offline",
    "openUserMenu": "Buksan ang menu ng user",
    "pendingSync_one": "{{count}} ang naka-pending",
    "pendingSync_other": "{{count}} ang naka-pending",
    "pendingSyncCount": "Bilang ng naka-pending na sync",
    "settings": "Mga Setting",
    "theme": "Tema",
    "themeDark": "Madilim",
    "themeLight": "Maliwanag",
    "themeSystem": "System",
    "toggleNavigation": "I-toggle ang navigation menu"
  },
  "nav": {
    "language": "Wika",
    "english": "English",
    "filipino": "Filipino"
  },
  "common": {
    "cancel": "Kanselahin",
    "save": "I-save",
    "delete": "Tanggalin",
    "loading": "Naglo-load..."
  },
  "status": {
    "enrolled": "Nakarehistro",
    "assessed": "Na-assess",
    "in_review": "Sinusuri",
    "active": "Aktibo",
    "transitioning": "Naglilipat",
    "closed": "Sarado"
  },
  "category": {
    "Children": "Mga Bata",
    "Youth": "Kabataan",
    "Women": "Kababaihan",
    "PWD": "PWD",
    "Senior": "Senior",
    "Indigent": "Maralita",
    "4Ps": "4Ps",
    "IP": "IP",
    "Family": "Pamilya"
  },
  "interventionType": {
    "FA": "Tulong Pinansyal",
    "C": "Pagpapayo",
    "CSR": "Case Study Report",
    "R": "Referral",
    "H": "Home Visit",
    "HV": "Home Visit",
    "Other": "Iba Pa"
  },
  "referralStatus": {
    "referred": "Ipinadala",
    "received": "Natanggap",
    "actioned": "Inaksyunan",
    "closed": "Sarado",
    "declined": "Tinanggihan"
  },
  "syncStatus": {
    "pending": "Nakapila",
    "syncing": "Nagsi-sync",
    "failed": "Nabigo",
    "conflict": "Salungatan"
  },
  "a11y": {
    "mainNavigation": "Main navigation",
    "mobileNavigation": "Mobile navigation",
    "skipToContent": "Skip to content"
  },
  "shell": {
    "cachedData": "Cached data — last sync {{age}} ago",
    "offlineMessage": "You are offline. Some features may be unavailable.",
    "quickAction": "Quick Action",
    "quickIntake": "New Intake (Quick Action)",
    "quickReferral": "New Referral (Quick Action)",
    "showingCachedData": "Showing cached data — last sync {{age}} ago",
    "verifyingAccess": "Verifying access...",
    "help": "Help",
    "helpFaqs": "FAQs",
    "helpTips": "Tips",
    "noHelpContent": "No help content available for this page."
  },
  "error": {
    "boundaryBody": "An unexpected error occurred. Our team has been notified.",
    "boundaryDetails": "Error Details",
    "boundaryOfflineBody": "Your device lost connection. Some features may be unavailable until you reconnect.",
    "boundaryOfflineTitle": "You're Offline",
    "boundaryTitle": "Something went wrong",
    "dashboard": "Dashboard",
    "emptyAddFirst": "Add first record",
    "emptyClearFilters": "Clear filters",
    "emptyNoAccess": "You don't have access to this section",
    "emptyNoData": "No data found",
    "emptyNoResults": "No results match your search",
    "emptyOffline": "You appear to be offline",
    "emptyOfflineHint": "Please check your connection and try again",
    "goToDashboard": "Go to Dashboard",
    "retry": "Retry",
    "tryAgain": "Try again",
    "boundaryTryAgain": "Try Again"
  },
  "search": {
    "ariaLabel": "Search beneficiaries",
    "noResults": "No results found.",
    "placeholder": "Search records...",
    "searching": "Searching...",
    "viewAll": "View all results"
  },
  "sync": {
    "emptyAllCaughtUp": "All caught up",
    "emptyNoPending": "No pending sync operations.",
    "groupConflicts_one": "Conflicts ({{count}})",
    "groupConflicts_other": "Conflicts ({{count}})",
    "groupFailed_one": "Failed ({{count}})",
    "groupFailed_other": "Failed ({{count}})",
    "groupPending_one": "Pending ({{count}})",
    "groupPending_other": "Pending ({{count}})",
    "groupSyncing_one": "Syncing ({{count}})",
    "groupSyncing_other": "Syncing ({{count}})",
    "itemBeneficiary": "Beneficiary {{id}}",
    "itemCase": "Case {{id}}",
    "itemIntervention": "Intervention",
    "itemIrfCase": "IRF Case",
    "noPendingOperations": "No pending sync operations",
    "offlinePendingChanges_one": "You are offline — {{count}} change(s) pending sync",
    "offlinePendingChanges_other": "You are offline — {{count}} change(s) pending sync",
    "openQueue": "Open sync queue",
    "pendingChanges_one": "{{count}} change(s) pending sync",
    "pendingChanges_other": "{{count}} change(s) pending sync",
    "pendingCount_one": "{{count}} pending change(s)",
    "pendingCount_other": "{{count}} pending change(s)",
    "removeConfirm": "Remove sync item: This will discard this operation. You may lose data. Continue?",
    "removeItem": "Remove Item",
    "retrySync": "Retry Sync",
    "syncChanges_one": "Sync {{count}} change(s)",
    "syncChanges_other": "Sync {{count}} change(s)",
    "syncing": "Syncing...",
    "syncNow": "Sync Now",
    "title": "Sync Queue",
    "viewDiff": "View Diff"
  }
};

export default fil;
