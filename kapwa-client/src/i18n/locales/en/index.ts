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
} as const;

export default en;
export type EnLocale = {
  [NS in keyof typeof en]: { [K in keyof (typeof en)[NS]]: string };
};
