import { CreateIrfSchema, IrfPersonRecordSchema } from './irf.zod';

describe('IrfPersonRecordSchema', () => {
  it('accepts the canonical Incident Report Form fields', () => {
    const parsed = IrfPersonRecordSchema.parse({
      familyName: 'Santos',
      firstName: 'Maria',
      middleName: 'Lopez',
      nickname: 'Mari',
      gender: 'Female',
      civilStatus: 'Married',
      dateOfBirth: '1985-07-22',
      age: 41,
      placeOfBirth: 'Norzagaray, Bulacan',
      contactDetails: '09171234002',
      currentAddress: 'Bigte, Norzagaray',
      otherAddress: '',
      educationalAttainment: 'College Graduate',
      occupation: 'Street Vendor',
      idCardPresented: 'PhilSys ID',
      relationshipToClient: 'Neighbor',
      emailAddress: 'maria.santos@example.com',
    });
    expect(parsed.familyName).toBe('Santos');
    expect(parsed.age).toBe(41);
  });

  it('keeps legacy keys (name/contact/address/relation/alias) via passthrough', () => {
    const parsed = IrfPersonRecordSchema.parse({
      name: 'Maria L. Santos',
      contact: '09171234002',
      address: 'Bigte',
      relation: 'Self',
      alias: 'Mari',
    }) as Record<string, unknown>;
    expect(parsed.name).toBe('Maria L. Santos');
    expect(parsed.alias).toBe('Mari');
  });

  it('rejects a malformed email address', () => {
    expect(IrfPersonRecordSchema.safeParse({ emailAddress: 'not-an-email' }).success).toBe(false);
  });
});

describe('CreateIrfSchema', () => {
  it('accepts an IRF with typed party records', () => {
    const parsed = CreateIrfSchema.parse({
      caseCategory: 'Abuse',
      caseId: 'case-1',
      itemAReportingPerson: { firstName: 'Maria', relationshipToClient: 'Self' },
      itemBPersonReported: { firstName: 'Pedro' },
      narration: 'Narrative',
    });
    expect(parsed.caseCategory).toBe('Abuse');
  });
});
