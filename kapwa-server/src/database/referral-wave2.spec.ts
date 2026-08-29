import { Referral } from '../referrals/referral.entity';
import { Person } from '../beneficiaries/person.entity';
import { PersonContact } from '../beneficiaries/person-contact.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';

describe('Referral wave-2 getters', () => {
  it('assembles flattened embedded fields from the joined Person', () => {
    const person = new Person();
    person.surname = 'Reyes';
    person.firstName = 'Maria';
    person.middleName = 'Santos';
    person.extension = 'Jr';
    person.gender = 'Female';
    person.dob = new Date('1995-08-20');

    const phone = new PersonContact();
    phone.contactType = 'phone'; phone.value = '09171234567'; phone.isPrimary = true;
    const current = new PersonAddress();
    current.addressType = 'current'; current.raw = 'Blk 2, Brgy San Roque'; current.barangay = 'San Roque'; current.city = 'Manila'; current.isPrimary = true;
    (person as any).contacts = [phone];
    (person as any).addresses = [current];

    const r = new Referral();
    r.reason = 'Medical emergency';
    r.barangay = 'Poblacion';
    r.coordinatorId = 'u1';
    r.person = person;
    r.personId = person.id;

    expect(r.surname).toBe('Reyes');
    expect(r.firstName).toBe('Maria');
    expect(r.middleName).toBe('Santos');
    expect(r.extension).toBe('Jr');
    expect(r.gender).toBe('Female');
    expect(r.dob).toBe('1995-08-20');
    expect(r.phone).toBe('09171234567');
    expect((r.address as any)?.barangay).toBe('San Roque');
  });

  it('returns empty strings when no person is linked', () => {
    const r = new Referral();
    r.reason = 'Poverty';
    r.barangay = 'Poblacion';
    r.coordinatorId = 'u1';
    expect(r.surname).toBe('');
    expect(r.firstName).toBe('');
    expect(r.gender).toBe('');
    expect(r.dob).toBe('');
    expect(r.address).toBeUndefined();
    expect(r.phone).toBeUndefined();
  });
});
