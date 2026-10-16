import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import i18n, { changeLang } from '../index';
import { statusLabel, categoryLabel, interventionTypeLabel, referralStatusLabel, syncStatusLabel } from '../display';

afterEach(async () => {
  await changeLang('en');
  localStorage.removeItem('kapwa-lang');
  document.documentElement.lang = 'en';
});

// Filipino is a lazily-fetched chunk (audit §3.2), so a test that asserts
// Filipino copy must ask for it the way the app does.
beforeEach(async () => {
  await changeLang('fil');
});

describe('display maps', () => {
  it('maps known case statuses to English and Filipino', async () => {
    await changeLang('en');
    expect(statusLabel(i18n.t, 'enrolled')).toBe('Enrolled');
    expect(statusLabel(i18n.t, 'in_review')).toBe('In Review');
    await changeLang('fil');
    expect(statusLabel(i18n.t, 'enrolled')).toBe('Nakarehistro');
    expect(statusLabel(i18n.t, 'active')).toBe('Aktibo');
  });

  it('passes unknown statuses through untranslated', () => {
    expect(statusLabel(i18n.t, 'mystery_status')).toBe('mystery_status');
  });

  it('maps categories and referral/sync statuses', () => {
    expect(categoryLabel(i18n.t, 'Senior')).toBe('Senior');
    expect(interventionTypeLabel(i18n.t, 'FA')).toBe('Tulong Pinansyal');
    expect(referralStatusLabel(i18n.t, 'referred')).toBe('Ipinadala');
    expect(syncStatusLabel(i18n.t, 'pending')).toBe('Nakapila');
  });
});
