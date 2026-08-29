import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';

describe('schema normalization — person child entities', () => {
  it('defines person_contacts with the expected columns', () => {
    const contact = new PersonContact();
    contact.personId = 'p1';
    contact.contactType = 'phone';
    contact.value = '09170000000';
    expect(contact.personId).toBe('p1');
    expect(contact.contactType).toBe('phone');
    expect(contact.value).toBe('09170000000');
  });

  it('defines person_addresses with the expected columns', () => {
    const addr = new PersonAddress();
    addr.personId = 'p1';
    addr.addressType = 'current';
    addr.barangay = 'Poblacion';
    addr.city = 'Norzagaray';
    addr.province = 'Bulacan';
    expect(addr.addressType).toBe('current');
    expect(addr.barangay).toBe('Poblacion');
  });
});

import { Beneficiary } from './beneficiary.entity';
import { Person } from './person.entity';
import { BeneficiaryRole } from './beneficiary-role.entity';

describe('schema normalization — beneficiary dedup groundwork', () => {
  it('beneficiary still exposes legacy category for Wave-1 compatibility', () => {
    const p = new Person();
    const role = new BeneficiaryRole();
    role.category = 'Senior Citizen';
    role.consentStatus = 'active';
    (p as any).roles = [role];

    const b = new Beneficiary();
    (b as any).person = p;
    expect(b.category).toBe('Senior Citizen');
    expect(b.consentStatus).toBe('active');
  });

  it('beneficiary consentStatus defaults to active when no role row exists', () => {
    const b = new Beneficiary();
    expect(b.consentStatus).toBe('active');
  });
});
