import { describe, it, expect } from 'vitest';
import i18n, { changeLang, loadLangBundle } from '../index';

/**
 * English rides the main bundle; Filipino is a separate chunk fetched when it
 * is chosen (audit §3.2 — the eager pair was 273 KB / 84 KB gzip). These tests
 * pin the laziness, because "just import both" is the tempting regression.
 */
describe('lazy locale bundle', () => {
  it('starts with English only', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
    expect(i18n.hasResourceBundle('fil', 'translation')).toBe(false);
  });

  it('fetches Filipino on demand and translates with it', async () => {
    await loadLangBundle('fil');
    expect(i18n.hasResourceBundle('fil', 'translation')).toBe(true);

    await changeLang('fil');
    expect(i18n.t('nav.language')).toBe('Wika');
  });

  it('records the choice and the document language', async () => {
    await changeLang('fil');
    expect(localStorage.getItem('kapwa-lang')).toBe('fil');
    expect(document.documentElement.lang).toBe('fil-PH');

    await changeLang('en');
    expect(localStorage.getItem('kapwa-lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
