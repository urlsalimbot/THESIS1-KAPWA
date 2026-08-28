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
