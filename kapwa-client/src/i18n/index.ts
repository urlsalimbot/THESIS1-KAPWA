import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import fil from './locales/fil';

export const SUPPORTED_LANGS = ['en', 'fil'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const LANG_STORAGE_KEY = 'kapwa-lang';

export function getInitialLang(): Lang {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return stored === 'fil' ? 'fil' : 'en';
}

export function localeLangTag(l: Lang): 'en' | 'fil-PH' {
  return l === 'fil' ? 'fil-PH' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fil: { translation: fil },
  },
  lng: getInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  missingKeyHandler: (lng, ns, key) => {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${ns}:${key}`);
  },
});

export default i18n;
