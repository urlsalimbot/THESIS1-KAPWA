import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LANG_STORAGE_KEY, localeLangTag, type Lang } from './index';

export function useLanguage() {
  const { i18n } = useTranslation();

  const lang: Lang = i18n.language === 'fil' ? 'fil' : 'en';

  const setLang = useCallback(
    (l: Lang) => {
      void i18n.changeLanguage(l);
      localStorage.setItem(LANG_STORAGE_KEY, l);
      document.documentElement.lang = localeLangTag(l);
    },
    [i18n],
  );

  return { lang, setLang };
}
