import { Agency } from '../agencies/agency.entity';
import { AgencyContact } from '../agencies/agency-contact.entity';
import { Program } from '../programs/program.entity';
import { ProgramFundSource } from '../programs/program-fund-source.entity';
import { ProgramRequiredDocument } from '../programs/program-required-document.entity';
import { AccessCardService } from '../access-cards/access-card-service.entity';
import { instanceToPlain } from 'class-transformer';

describe('Agency/Program wave-2 getters', () => {
  it('reassembles contactInfo record from child contact rows', () => {
    const a = new Agency();
    a.code = 'MSWDO'; a.name = 'MSWDO';
    const phone = new AgencyContact();
    phone.contactType = 'phone'; phone.value = '0917-123-4567'; phone.isPrimary = true;
    const email = new AgencyContact();
    email.contactType = 'email'; email.value = 'mswdo@norzagaray.gov.ph';
    (a as any).contacts = [phone, email];

    expect(a.contactInfo).toEqual({
      phone: '0917-123-4567',
      email: 'mswdo@norzagaray.gov.ph',
    });
  });

  it('returns undefined contactInfo when no child rows', () => {
    const a = new Agency();
    expect(a.contactInfo).toBeUndefined();
  });

  it('reassembles fundSources string[] from fund source rows', () => {
    const p = new Program();
    p.name = 'AICS';
    const f1 = new ProgramFundSource(); f1.name = 'LGU - Municipal';
    const f2 = new ProgramFundSource(); f2.name = 'DSWD - AICS';
    (p as any).fundSourceRows = [f1, f2];

    expect(p.fundSources).toEqual(['LGU - Municipal', 'DSWD - AICS']);
  });

  it('returns undefined fundSources when no child rows', () => {
    const p = new Program();
    expect(p.fundSources).toBeUndefined();
  });

  it('reassembles requiredDocuments string[] from document rows', () => {
    const p = new Program();
    p.name = 'AICS';
    const d1 = new ProgramRequiredDocument(); d1.documentKey = 'Valid ID';
    const d2 = new ProgramRequiredDocument(); d2.documentKey = 'Barangay Certificate of Indigency';
    (p as any).requiredDocumentRows = [d1, d2];

    expect(p.requiredDocuments).toEqual(['Valid ID', 'Barangay Certificate of Indigency']);
  });

  it('returns undefined requiredDocuments when no child rows', () => {
    const p = new Program();
    expect(p.requiredDocuments).toBeUndefined();
  });

  it('serializes a fully-loaded agency without stack overflow and preserves flattened shape', () => {
    const a = new Agency();
    a.code = 'MSWDO'; a.name = 'MSWDO'; a.isActive = true;
    const phone = new AgencyContact();
    phone.contactType = 'phone'; phone.value = '0917-123-4567'; phone.agency = a;
    (a as any).contacts = [phone];

    let plain: Record<string, unknown>;
    expect(() => {
      // Mirror agencies.controller.ts @SerializeOptions({ strategy: 'exposeAll' })
      plain = instanceToPlain(a, { strategy: 'exposeAll' }) as Record<string, unknown>;
    }).not.toThrow();

    expect(plain!.code).toBe('MSWDO');
    expect(plain!.contactInfo).toEqual({ phone: '0917-123-4567' });
    expect(plain!.contacts).toBeUndefined();
  });

  it('serializes a fully-loaded program without stack overflow and preserves flattened shape', () => {
    const p = new Program();
    p.name = 'AICS'; p.isActive = true; p.formVersion = 2;
    const f1 = new ProgramFundSource(); f1.name = 'DSWD'; f1.program = p;
    const d1 = new ProgramRequiredDocument(); d1.documentKey = 'Valid ID'; d1.program = p;
    (p as any).fundSourceRows = [f1];
    (p as any).requiredDocumentRows = [d1];

    let plain: Record<string, unknown>;
    expect(() => {
      // Mirror programs.controller.ts @SerializeOptions({ strategy: 'exposeAll' })
      plain = instanceToPlain(p, { strategy: 'exposeAll' }) as Record<string, unknown>;
    }).not.toThrow();

    expect(plain!.name).toBe('AICS');
    expect(plain!.fundSources).toEqual(['DSWD']);
    expect(plain!.requiredDocuments).toEqual(['Valid ID']);
    expect(plain!.fundSourceRows).toBeUndefined();
    expect(plain!.requiredDocumentRows).toBeUndefined();
  });

  it('access-card service no longer carries a legacy agency column', () => {
    const s = new AccessCardService();
    s.accessCardCode = 'NORZ-AC-2026-0042';
    s.serviceRendered = 'Medical Aid';
    s.serviceDate = new Date('2026-06-22');
    s.agencyId = 'ag-1';

    const plain = instanceToPlain(s, { strategy: 'exposeAll' }) as Record<string, unknown>;
    expect(plain!.agencyId).toBe('ag-1');
    expect(plain!.agency).toBeUndefined();
  });
});