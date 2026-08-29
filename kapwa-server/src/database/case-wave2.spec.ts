import { Case } from '../cases/case.entity';
import { CaseRequirement } from '../cases/case-requirement.entity';
import { CaseReferral } from '../cases/case-referral.entity';
import { CaseAssistance } from '../cases/case-assistance.entity';

describe('Case wave-2 getters', () => {
  it('reassembles requirementsChecklist from child requirement rows', () => {
    const c = new Case();
    const r1 = new CaseRequirement();
    r1.requirementKey = 'statement_of_assets'; r1.met = true;
    const r2 = new CaseRequirement();
    r2.requirementKey = 'brgy_clearance'; r2.met = false;
    (c as any).requirements = [r1, r2];

    expect(c.requirementsChecklist).toEqual({
      statement_of_assets: true,
      brgy_clearance: false,
    });
  });

  it('returns undefined requirementsChecklist when no child rows', () => {
    const c = new Case();
    expect(c.requirementsChecklist).toBeUndefined();
  });

  it('reassembles financial getters from the financial assistance row', () => {
    const c = new Case();
    const fin = new CaseAssistance();
    fin.assistanceType = 'financial';
    fin.amount = '4500' as any;
    fin.mode = 'Cash';
    fin.sourceOfFund = 'AICS';
    fin.legislatorSpecify = 'Cong. Entity';
    fin.details = { disbursement: 'bank_transfer' } as any;
    const other = new CaseAssistance();
    other.assistanceType = 'transportation';
    other.details = { amount: 500 } as any;
    (c as any).assistances = [fin, other];

    expect(c.amountAssistance).toBe(4500);
    expect(c.modeFinancialAssistance).toBe('Cash');
    expect(c.sourceOfFund).toBe('AICS');
    expect(c.legislatorSpecify).toBe('Cong. Entity');
    expect(c.financialSubsidies).toEqual({ disbursement: 'bank_transfer' });
  });

  it('reassembles otherAssistance keyed by assistanceType from non-financial rows', () => {
    const c = new Case();
    const a = new CaseAssistance();
    a.assistanceType = 'transportation';
    a.details = { amount: 500 } as any;
    const b = new CaseAssistance();
    b.assistanceType = 'medical';
    b.details = { hospital: 'Norzagaray RHU' } as any;
    (c as any).assistances = [a, b];

    expect(c.otherAssistance).toEqual({
      transportation: { amount: 500 },
      medical: { hospital: 'Norzagaray RHU' },
    });
  });

  it('returns undefined financial getters when no financial row', () => {
    const c = new Case();
    expect(c.amountAssistance).toBeUndefined();
    expect(c.modeFinancialAssistance).toBeUndefined();
    expect(c.sourceOfFund).toBeUndefined();
    expect(c.legislatorSpecify).toBeUndefined();
    expect(c.financialSubsidies).toBeUndefined();
    expect(c.otherAssistance).toBeUndefined();
  });

  it('reassembles referrals (legacy shape) from referral rows', () => {
    const c = new Case();
    const ref = new CaseReferral();
    ref.agency = 'DSWD Field Office III'; ref.status = 'pending'; ref.notes = 'Assistance for medicines';
    (c as any).referralRows = [ref];

    expect(c.referrals).toEqual([
      { agencyName: 'DSWD Field Office III', status: 'pending', notes: 'Assistance for medicines' },
    ]);
  });

  it('returns undefined referrals when no referral rows', () => {
    const c = new Case();
    expect(c.referrals).toBeUndefined();
  });

  it('returns undefined followUpVisits (column dropped)', () => {
    const c = new Case();
    expect(c.followUpVisits).toBeUndefined();
  });
});