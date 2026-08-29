import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Person } from '../beneficiaries/person.entity';
import { BeneficiaryRole } from '../beneficiaries/beneficiary-role.entity';
import { Household } from '../beneficiaries/household.entity';

describe('Beneficiary wave-2 getters (person-keyed beneficiary_roles)', () => {
  it('exposes category and consentStatus from the person.roles relation', () => {
    const p = new Person();
    p.surname = 'Cruz';
    p.firstName = 'Ana';
    p.dob = new Date('2000-01-15');
    const role = new BeneficiaryRole();
    role.consentStatus = 'active';
    role.category = 'Senior Citizen';
    (p as any).roles = [role];

    const b = new Beneficiary();
    b.personId = p.id;
    (b as any).person = p;

    expect(b.category).toBe('Senior Citizen');
    expect(b.consentStatus).toBe('active');
  });

  it('defaults consentStatus to active when no role is present', () => {
    const b = new Beneficiary();
    expect(b.consentStatus).toBe('active');
    expect(b.category).toBeUndefined();
  });

  it('resolves accessCardCode via the household relation', () => {
    const h = new Household();
    (h as any).accessCardCode = 'CARD-0001';

    const b = new Beneficiary();
    (b as any).household = h;

    expect((b.household as any)?.accessCardCode).toBe('CARD-0001');
  });
});
