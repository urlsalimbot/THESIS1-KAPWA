import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import i18n, { changeLang, getInitialLang, LANG_STORAGE_KEY } from '../index';

describe('i18n init', () => {
  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    await changeLang('en');
    localStorage.removeItem(LANG_STORAGE_KEY);
    document.documentElement.lang = 'en';
  });

  it('defaults to English when nothing is stored', () => {
    expect(getInitialLang()).toBe('en');
    expect(i18n.language.startsWith('en')).toBe(true);
  });

  it('reads stored lang from localStorage', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'fil');
    expect(getInitialLang()).toBe('fil');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'xx');
    expect(getInitialLang()).toBe('en');
  });

  it('resolves scaffold keys for both locales', async () => {
    expect(i18n.t('nav.language')).toBe('Language');
    await changeLang('fil');
    expect(i18n.t('nav.language')).toBe('Wika');
  });
});
