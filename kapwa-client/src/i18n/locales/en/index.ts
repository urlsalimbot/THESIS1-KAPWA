const en = {
  nav: {
    language: 'Language',
    english: 'English',
    filipino: 'Filipino',
  },
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    loading: 'Loading...',
  },
  status: {
    enrolled: 'Enrolled',
    assessed: 'Assessed',
    in_review: 'In Review',
    active: 'Active',
    transitioning: 'Transitioning',
    closed: 'Closed',
  },
  category: {
    Children: 'Children',
    Youth: 'Youth',
    Women: 'Women',
    PWD: 'PWD',
    Senior: 'Senior',
    Indigent: 'Indigent',
    '4Ps': '4Ps',
    IP: 'IP',
    Family: 'Family',
  },
  interventionType: {
    FA: 'Financial Assistance',
    C: 'Counseling',
    CSR: 'Case Study Report',
    R: 'Referral',
    H: 'Home Visit',
    HV: 'Home Visit',
    Other: 'Other',
  },
  referralStatus: {
    referred: 'Referred',
    received: 'Received',
    actioned: 'Actioned',
    closed: 'Closed',
    declined: 'Declined',
  },
  syncStatus: {
    pending: 'Pending',
    syncing: 'Syncing',
    failed: 'Failed',
    conflict: 'Conflict',
  },
  time: {
    justNow: 'just now',
    minutesAgo: '{{count}} min ago',
    hoursAgo: '{{count}} hr {{minutes}} min ago',
    daysAgo: '{{count}} days ago',
  },
} as const;

export default en;
export type EnLocale = {
  [NS in keyof typeof en]: { [K in keyof (typeof en)[NS]]: string };
};
