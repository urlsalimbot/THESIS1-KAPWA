import { CreateUserInputSchema, UpdateUserSchema } from './users.zod';

describe('CreateUserInputSchema', () => {
  const uiPayload = {
    firstName: 'Bernardo',
    middleName: 'Cruz',
    lastName: 'Aquino',
    email: 'bernardo.aquino@mswdo.test',
    role: 'coordinator',
    phone: '09171234021',
    assignedBarangay: 'Bigte',
    permittedBarangays: ['Bigte', 'Matictic'],
  };

  it('accepts the payload the admin UI sends (camelCase)', () => {
    const r = CreateUserInputSchema.safeParse(uiPayload);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.assignedBarangay).toBe('Bigte');
      expect(r.data.permittedBarangays).toEqual(['Bigte', 'Matictic']);
    }
  });

  it('requires an agency for agency_staff', () => {
    const r = CreateUserInputSchema.safeParse({ ...uiPayload, role: 'agency_staff' });
    expect(r.success).toBe(false);
  });

  it('accepts an agency_staff user with an agencyId', () => {
    const r = CreateUserInputSchema.safeParse({
      ...uiPayload,
      role: 'agency_staff',
      agencyId: '11111111-1111-4111-8111-111111111111',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown keys (strict)', () => {
    const r = CreateUserInputSchema.safeParse({ ...uiPayload, nope: true });
    expect(r.success).toBe(false);
  });

  it('rejects a misspelled barangay', () => {
    const r = CreateUserInputSchema.safeParse({ ...uiPayload, assignedBarangay: 'bigte' });
    expect(r.success).toBe(false);
  });

  it('rejects a barangay outside Norzagaray', () => {
    const r = CreateUserInputSchema.safeParse({ ...uiPayload, assignedBarangay: 'Quezon City' });
    expect(r.success).toBe(false);
  });

  it('rejects a permitted scope containing an unknown barangay', () => {
    const r = CreateUserInputSchema.safeParse({ ...uiPayload, permittedBarangays: ['Bigte', 'Antipolo'] });
    expect(r.success).toBe(false);
  });

  it('accepts the longest barangay name verbatim', () => {
    const r = CreateUserInputSchema.safeParse({
      ...uiPayload,
      assignedBarangay: 'Friendship Village Resources (FVR)',
    });
    expect(r.success).toBe(true);
  });
});

describe('UpdateUserSchema', () => {
  it('rejects a misspelled barangay on update too', () => {
    const r = UpdateUserSchema.safeParse({ assignedBarangay: 'bigte' });
    expect(r.success).toBe(false);
  });

  it('accepts a real barangay on update', () => {
    const r = UpdateUserSchema.safeParse({ assignedBarangay: 'Bigte' });
    expect(r.success).toBe(true);
  });
});
