import { Person } from '../beneficiaries/person.entity';
import { PersonContact } from '../beneficiaries/person-contact.entity';
import { PersonAddress } from '../beneficiaries/person-address.entity';

describe('Person wave-2 getters', () => {
  it('assembles legacy flattened fields from child rows', () => {
    const p = new Person();
    p.surname = 'Cruz';
    p.firstName = 'Ana';
    p.dob = new Date('2000-01-15');
    const c1 = new PersonContact();
    c1.contactType = 'phone'; c1.value = '0917'; c1.isPrimary = true;
    const c2 = new PersonContact();
    c2.contactType = 'email'; c2.value = 'a@b.c'; c2.isPrimary = false;
    const a1 = new PersonAddress();
    a1.addressType = 'current'; a1.raw = 'Blk 1, Brgy San Isidro'; a1.barangay = 'San Isidro'; a1.isPrimary = true;
    (p as any).contacts = [c1, c2];
    (p as any).addresses = [a1];
    expect(p.phone).toBe('0917');
    expect(p.email).toBe('a@b.c');
    expect(p.address).toContain('Brgy San Isidro');
    expect((p.currentAddress as any)?.barangay).toBe('San Isidro');
    expect(typeof p.age).toBe('number');
  });
});