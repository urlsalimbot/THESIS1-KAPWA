import { UserCreateSchema } from './auth.zod';

describe('UserCreateSchema — barangay scope', () => {
  const base = {
    email: 'staff@mswdo.test',
    password: 'password123',
    role: 'coordinator',
    assignedBarangay: 'Poblacion',
    permittedBarangays: ['Poblacion', 'San Mateo'],
  };

  it('accepts real Norzagaray barangays', () => {
    expect(UserCreateSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a misspelled barangay', () => {
    // A typo here reaches access_card_services.source_barangay, which the
    // coordinator's history query filters on — the row would be invisible.
    expect(UserCreateSchema.safeParse({ ...base, assignedBarangay: 'Poblacion ' }).success).toBe(false);
  });

  it('rejects a permitted scope containing an unknown barangay', () => {
    expect(UserCreateSchema.safeParse({ ...base, permittedBarangays: ['Poblacion', 'Marikina'] }).success).toBe(false);
  });
});
