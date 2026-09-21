import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { Person } from '../beneficiaries/person.entity';
import { PersonContact } from '../beneficiaries/person-contact.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';
import { instanceToPlain } from 'class-transformer';

describe('InterAgencyReferral identity getters', () => {
  function linkedPerson(): Person {
    const person = new Person();
    person.surname = 'Reyes';
    person.firstName = 'Maria';
    person.middleName = 'Santos';
    person.extension = 'Jr.';
    person.gender = 'Female';
    person.dob = new Date('1995-08-20');

    const phone = new PersonContact();
    phone.contactType = 'phone'; phone.value = '09171234567'; phone.isPrimary = true;
    const current = new PersonAddress();
    current.addressType = 'current';
    current.raw = 'Blk 2, Brgy San Roque';
    current.barangay = 'San Roque';
    current.city = 'Norzagaray';
    current.isPrimary = true;
    (person as any).contacts = [phone];
    (person as any).addresses = [current];
    return person;
  }

  it('assembles the persons name schema and address from the joined Person', () => {
    const person = linkedPerson();
    const ref = new InterAgencyReferral();
    ref.reason = 'Medical assistance';
    ref.legalBasisCode = 'public_authority_sec13';
    ref.person = person;
    ref.personId = person.id;

    expect(ref.surname).toBe('Reyes');
    expect(ref.firstName).toBe('Maria');
    expect(ref.middleName).toBe('Santos');
    expect(ref.extension).toBe('Jr.');
    expect(ref.gender).toBe('Female');
    expect(ref.dob).toBe('1995-08-20');
    expect(ref.phone).toBe('09171234567');
    // Structured shape mirrors Referral.address ...
    expect(ref.address?.barangay).toBe('San Roque');
    expect(ref.currentAddress?.barangay).toBe('San Roque');
    // ... and addressLine is the raw display string holding the street.
    expect(ref.addressLine).toBe('Blk 2, Brgy San Roque');
  });

  it('returns empty values when no person is linked', () => {
    const ref = new InterAgencyReferral();
    ref.reason = 'Referral';
    ref.legalBasisCode = 'consent_verified';
    expect(ref.surname).toBe('');
    expect(ref.firstName).toBe('');
    expect(ref.gender).toBe('');
    expect(ref.dob).toBe('');
    expect(ref.middleName).toBeUndefined();
    expect(ref.address).toBeUndefined();
    expect(ref.addressLine).toBeUndefined();
    expect(ref.phone).toBeUndefined();
  });

  it('serializes the flat name schema under exposeAll without leaking person', () => {
    const person = linkedPerson();
    const ref = new InterAgencyReferral();
    ref.reason = 'Medical assistance';
    ref.legalBasisCode = 'public_authority_sec13';
    ref.person = person;
    ref.personId = person.id;

    let plain: Record<string, unknown> = {};
    expect(() => {
      // Mirror inter-agency-referrals.controller.ts
      // @SerializeOptions({ strategy: 'exposeAll' })
      plain = instanceToPlain(ref, { strategy: 'exposeAll' }) as Record<string, unknown>;
    }).not.toThrow();

    expect(plain.surname).toBe('Reyes');
    expect(plain.firstName).toBe('Maria');
    expect(plain.middleName).toBe('Santos');
    expect(plain.gender).toBe('Female');
    expect(plain.dob).toBe('1995-08-20');
    expect(plain.addressLine).toBe('Blk 2, Brgy San Roque');
    expect(plain.person).toBeUndefined();
  });
});
