import { describe, it, expect } from 'vitest';
import en from '../locales/en';
import fil from '../locales/fil';

function flat(o: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return { ...acc, ...flat(v as Record<string, unknown>, `${prefix}${k}.`) };
    }
    return { ...acc, [`${prefix}${k}`]: String(v) };
  }, {});
}

// Keys where the fil value legitimately equals the en value: placeholder-only
// strings, proper nouns (MSWDO Norzagaray), official titles/acronyms (PWD,
// IRF, CSR, SLA, team titles, role titles), loanwords (Barangay, Email,
// Password, Dashboard, Referral, Seminar, JSON, PDF, OTP/MFA terms, Profile),
// language names (English/Filipino), and the category.*/interventionType.*
// display maps. Add a new key here ONLY with justification.
const ALLOWED_IDENTICAL = new Set([
  'accessCard.barangay',
  'accessCard.byWorker',
  'accessCard.catReferral',
  'accessCard.catSeminar',
  'admin.device',
  'admin.entryCount_one',
  'admin.entryCount_other',
  'admin.lcrImport',
  'agency.catReferral',
  'agency.catSeminar',
  'announcements.bold',
  'announcements.footer',
  'announcements.heading2',
  'announcements.heading3',
  'announcements.italic',
  'announcements.link',
  'announcements.urlPrompt',
  'auth.barangay',
  'auth.digitLabel',
  'auth.emailLabel',
  'auth.manualEntryKey',
  'auth.mfaTitle',
  'auth.mswdoTagline',
  'auth.oneTimePassword',
  'auth.passwordLabel',
  'auth.passwordReset',
  'auth.period',
  'auth.twoFactor',
  'beneficiaries.accessCard',
  'beneficiaries.barangay',
  'beneficiaries.cardCode',
  'beneficiaries.fundLegislative',
  'beneficiaries.fundRegular',
  'beneficiaries.intReferral',
  'bulkActions.format',
  'bulkActions.piiMasking',
  'bulkActions.progress',
  'cards.accessCardTitle',
  'cards.barangay',
  'caseView.assessment.frvaPlaceholder',
  'caseView.assessment.swdiPlaceholder',
  'caseView.closure.pettyCashVoucher',
  'caseView.implement.fundSource.dswd',
  'caseView.implement.fundSource.lgu',
  'caseView.implement.fundSource.pdaf',
  'caseView.implement.interventionUnit_one',
  'caseView.implement.interventionUnit_other',
  'caseView.implement.modeOfDelivery.cash',
  'caseView.implement.modeOfDelivery.inKind',
  'caseView.implement.req',
  'caseView.signatures.pettyCashVoucher',
  'caseView.stepper.phaseIn',
  'caseView.stepper.phaseOut',
  'cases.accessCard',
  'cases.barangay',
  'cases.caseStudyReport',
  'cases.claimant',
  'cases.overdue',
  'cases.overdueBadge',
  'cases.override',
  'cases.pettyCashVoucher',
  'chain.hash',
  'claims.accessCard',
  'conflict.server',
  'contact.email',
  'contact.mswdoAddress',
  'coordinator.barangay',
  'coordinator.extension',
  'coordinator.na',
  'dashboard.accessCard',
  'dashboard.barangay',
  'dashboard.channel',
  'dashboard.offline',
  'dashboard.title',
  'error.dashboard',
  'intake.barangay',
  'intake.email',
  'intake.ext',
  'intake.extension',
  'intake.isThisQ',
  'intake.philhealth',
  'irf.barangay',
  'irf.blotterDescription',
  'irf.blotterNo',
  'irf.irfTitle',
  'irf.json',
  'irf.pdf',
  'nav.english',
  'nav.filipino',
  'notifications.toggleAria',
  'pii.fieldAria',
  'programs.docsCount_one',
  'programs.docsCount_other',
  'programs.itemCount_one',
  'programs.itemCount_other',
  'programs.metadata',
  'public.mswdoAddress',
  'referral.barangay',
  'settings.email',
  'settings.english',
  'settings.filipino',
  'settings.mfa',
  'settings.mfaQrAlt',
  'settings.profile',
  'settings.role',
  'settings.toggleAria',
  'shell.helpFaqs',
  'sync.itemIrfCase',
  'sync.title',
  'team.administrativeOfficer',
  'team.communityAffairsOfficer',
  'team.mswdo',
  'team.projectDevelopmentOfficer',
  'team.seniorSocialWorker',
  'team.socialWelfareOfficer',
  'topbar.offline',
  'topbar.themeSystem',
  'tracker.barangay',
  'tracker.controlNo',
  'usersPanel.barangay',
  'usersPanel.email',
  'usersPanel.password',
  'usersPanel.role.admin',
  'usersPanel.role.auditor',
  'usersPanel.role.claimant',
  'usersPanel.role.coordinator',
  ...Object.keys(flat(en)).filter(k => k.startsWith('category.') || k.startsWith('interventionType.')),
]);

describe('locale parity', () => {
  it('fil mirrors en key-for-key', () => {
    const enKeys = Object.keys(flat(en)).sort();
    const filKeys = Object.keys(flat(fil)).sort();
    expect(filKeys).toEqual(enKeys);
  });

  it('no fil value equals its English value outside the allowlist', () => {
    const enFlat = flat(en);
    const filFlat = flat(fil);
    const leftovers = Object.keys(enFlat).filter(
      k => !ALLOWED_IDENTICAL.has(k) && filFlat[k] === enFlat[k],
    );
    expect(leftovers).toEqual([]);
  });
});
