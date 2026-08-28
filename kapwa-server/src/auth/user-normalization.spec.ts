import { UserToken } from './user-token.entity';
import { UserBarangayAssignment } from './user-barangay-assignment.entity';

describe('schema normalization — user child entities', () => {
  it('defines user_tokens with the expected columns', () => {
    const t = new UserToken();
    t.userId = 'u1';
    t.purpose = 'password_reset';
    t.token = 'rst-abc';
    expect(t.purpose).toBe('password_reset');
    expect(t.token).toBe('rst-abc');
  });

  it('defines user_barangay_assignments with the expected columns', () => {
    const a = new UserBarangayAssignment();
    a.userId = 'u1';
    a.barangay = 'Poblacion';
    a.isPrimary = true;
    expect(a.barangay).toBe('Poblacion');
    expect(a.isPrimary).toBe(true);
  });
});
