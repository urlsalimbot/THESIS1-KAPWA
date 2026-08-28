import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';

describe('schema normalization — case child entities', () => {
  it('defines case_requirements', () => {
    const r = new CaseRequirement();
    r.caseId = 'c1';
    r.requirementKey = 'birth_certificate';
    r.met = true;
    expect(r.requirementKey).toBe('birth_certificate');
  });

  it('defines case_referrals', () => {
    const r = new CaseReferral();
    r.caseId = 'c1';
    r.agency = 'MSWDO';
    r.status = 'pending';
    expect(r.agency).toBe('MSWDO');
  });

  it('defines case_assistances', () => {
    const a = new CaseAssistance();
    a.caseId = 'c1';
    a.assistanceType = 'financial';
    a.amount = 5000;
    expect(a.assistanceType).toBe('financial');
    expect(a.amount).toBe(5000);
  });
});
