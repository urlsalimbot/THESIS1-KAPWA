import type { EnLocale } from '../en';

const fil: EnLocale = {
  nav: {
    language: 'Wika',
    english: 'English',
    filipino: 'Filipino',
  },
  common: {
    cancel: 'Kanselahin',
    save: 'I-save',
    delete: 'Tanggalin',
    loading: 'Naglo-load...',
  },
  status: {
    enrolled: 'Nakarehistro',
    assessed: 'Na-assess',
    in_review: 'Sinusuri',
    active: 'Aktibo',
    transitioning: 'Naglilipat',
    closed: 'Sarado',
  },
  category: {
    Children: 'Mga Bata',
    Youth: 'Kabataan',
    Women: 'Kababaihan',
    PWD: 'PWD',
    Senior: 'Senior',
    Indigent: 'Maralita',
    '4Ps': '4Ps',
    IP: 'IP',
    Family: 'Pamilya',
  },
  interventionType: {
    FA: 'Tulong Pinansyal',
    C: 'Pagpapayo',
    CSR: 'Case Study Report',
    R: 'Referral',
    H: 'Home Visit',
    HV: 'Home Visit',
    Other: 'Iba Pa',
  },
  referralStatus: {
    referred: 'Ipinadala',
    received: 'Natanggap',
    actioned: 'Inaksyunan',
    closed: 'Sarado',
    declined: 'Tinanggihan',
  },
  syncStatus: {
    pending: 'Nakapila',
    syncing: 'Nagsi-sync',
    failed: 'Nabigo',
    conflict: 'Salungatan',
  },
  time: {
    justNow: 'kakailangan pa lang',
    minutesAgo: '{{count}} minuto ang nakalipas',
    hoursAgo: '{{count}} oras {{minutes}} minuto ang nakalipas',
    daysAgo: '{{count}} araw ang nakalipas',
  },
};

export default fil;
