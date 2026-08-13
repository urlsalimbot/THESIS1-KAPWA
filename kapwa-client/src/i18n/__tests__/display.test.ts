import { describe, it, expect, afterEach } from 'vitest';
import i18n from '../index';
import { statusLabel, categoryLabel, interventionTypeLabel, referralStatusLabel, syncStatusLabel } from '../display';

afterEach(() => {
  i18n.changeLanguage('en');
  localStorage.removeItem('kapwa-lang');
  document.documentElement.lang = 'en';
});

describe('display maps', () => {
  it('maps known case statuses to English and Filipino', () => {
    i18n.changeLanguage('en');
    expect(statusLabel(i18n.t, 'enrolled')).toBe('Enrolled');
    expect(statusLabel(i18n.t, 'in_review')).toBe('In Review');
    i18n.changeLanguage('fil');
    expect(statusLabel(i18n.t, 'enrolled')).toBe('Nakarehistro');
    expect(statusLabel(i18n.t, 'active')).toBe('Aktibo');
  });

  it('passes unknown statuses through untranslated', () => {
    i18n.changeLanguage('fil');
    expect(statusLabel(i18n.t, 'mystery_status')).toBe('mystery_status');
  });

  it('maps categories and referral/sync statuses', () => {
    i18n.changeLanguage('fil');
    expect(categoryLabel(i18n.t, 'Senior')).toBe('Senior');
    expect(interventionTypeLabel(i18n.t, 'FA')).toBe('Tulong Pinansyal');
    expect(referralStatusLabel(i18n.t, 'referred')).toBe('Ipinadala');
    expect(syncStatusLabel(i18n.t, 'pending')).toBe('Nakapila');
  });
});
