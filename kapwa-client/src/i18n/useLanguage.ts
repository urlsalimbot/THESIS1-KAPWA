import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLang, type Lang } from './index';

export function useLanguage() {
  const { i18n } = useTranslation();

  const lang: Lang = i18n.language === 'fil' ? 'fil' : 'en';

  // `changeLang` fetches the Filipino chunk before switching, so the screen
  // never renders in a language whose strings have not arrived (audit §3.2).
  const setLang = useCallback((l: Lang) => {
    void changeLang(l);
  }, []);

  return { lang, setLang };
}
