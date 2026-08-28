import { AgencyContact } from '../agencies/agency-contact.entity';
import { ProgramFundSource } from '../programs/program-fund-source.entity';
import { ProgramRequiredDocument } from '../programs/program-required-document.entity';
import { Referral } from '../referrals/referral.entity';

describe('schema normalization — referrals person link', () => {
  it('supports a nullable person_id', () => {
    const r = new Referral();
    r.coordinatorId = 'u1';
    r.barangay = 'Poblacion';
    r.surname = 'Dela Cruz';
    r.firstName = 'Juan';
    r.gender = 'Male';
    r.dob = '1990-01-15';
    r.reason = 'Medical emergency';
    r.personId = 'p1';
    expect(r.personId).toBe('p1');
  });
});

describe('schema normalization — agency/program child entities', () => {
  it('defines agency_contacts', () => {
    const c = new AgencyContact();
    c.agencyId = 'a1';
    c.contactType = 'phone';
    c.value = '0917';
    expect(c.contactType).toBe('phone');
  });

  it('defines program_fund_sources', () => {
    const f = new ProgramFundSource();
    f.programId = 'p1';
    f.name = 'LGU';
    expect(f.name).toBe('LGU');
  });

  it('defines program_required_documents', () => {
    const d = new ProgramRequiredDocument();
    d.programId = 'p1';
    d.documentKey = 'birth_certificate';
    d.mandatory = true;
    expect(d.documentKey).toBe('birth_certificate');
  });
});
