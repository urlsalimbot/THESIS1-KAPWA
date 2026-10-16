import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';

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

/**
 * The Filipino copy is ~145 KB of source and only a reader who picks it needs
 * it, so it lives in its own chunk: `en` is the fallback for every key and
 * rides the main bundle, `fil` is fetched on demand. (Audit §3.2 — the i18n
 * chunk was 273 KB / 84 KB gzip because both locales were imported eagerly.)
 */
export async function loadLangBundle(lang: Lang): Promise<void> {
  if (lang !== 'fil' || i18n.hasResourceBundle('fil', 'translation')) return;
  const { default: fil } = await import('./locales/fil');
  i18n.addResourceBundle('fil', 'translation', fil, true, true);
}

/**
 * The one entry point for changing language: fetch the bundle, switch, then
 * record the choice. Awaiting it means no screen is ever rendered in a
 * language whose strings have not arrived.
 */
export async function changeLang(lang: Lang): Promise<void> {
  await loadLangBundle(lang);
  await i18n.changeLanguage(lang);
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  document.documentElement.lang = localeLangTag(lang);
}

// English initialises synchronously, so every `t()` — in the app, in the
// format/toast helpers and in the test suite — works from the first tick.
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  missingKeyHandler: (lng, ns, key) => {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${ns}:${key}`);
  },
});

// A stored preference is honoured as soon as its chunk lands — a Filipino
// reader does not have to visit Settings. Skipped in tests, where the suite
// controls the language explicitly.
if (!import.meta.env.TEST && getInitialLang() === 'fil') {
  void changeLang('fil');
}

export default i18n;
