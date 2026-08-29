import { User } from '../auth/user.entity';
import { UserToken } from '../auth/user-token.entity';
import { UserBarangayAssignment } from '../auth/user-barangay-assignment.entity';

describe('User wave-2 getters', () => {
  it('assembles legacy flattened token fields from child rows', () => {
    const u = new User();
    const vt = new UserToken();
    vt.purpose = 'email_verification'; vt.token = 'vt-1'; vt.expiresAt = new Date('2026-01-01');
    const rt = new UserToken();
    rt.purpose = 'password_reset'; rt.token = 'rt-1'; rt.expiresAt = new Date('2026-01-02');
    const ce = new UserToken();
    ce.purpose = 'change_email'; ce.token = 'ce-1'; ce.expiresAt = new Date('2026-01-03');
    ce.meta = { newEmail: 'new@test.com' } as any;
    (u as any).tokens = [vt, rt, ce];

    expect(u.verificationToken).toBe('vt-1');
    expect(u.verificationTokenExpiresAt).toEqual(new Date('2026-01-01'));
    expect(u.resetToken).toBe('rt-1');
    expect(u.resetTokenExpiresAt).toEqual(new Date('2026-01-02'));
    expect(u.newEmailToken).toBe('ce-1');
    expect(u.newEmailTokenExpiresAt).toEqual(new Date('2026-01-03'));
    expect(u.newEmail).toBe('new@test.com');
  });

  it('assembles assigned/permitted barangays from child rows', () => {
    const u = new User();
    const primary = new UserBarangayAssignment();
    primary.barangay = 'Bigte'; primary.isPrimary = true;
    const other = new UserBarangayAssignment();
    other.barangay = 'Matictic'; other.isPrimary = false;
    (u as any).barangayAssignments = [primary, other];

    expect(u.assignedBarangay).toBe('Bigte');
    expect(u.permittedBarangays).toEqual(['Matictic']);
  });

  it('falls back to the first barangay row when no primary exists', () => {
    const u = new User();
    const a = new UserBarangayAssignment();
    a.barangay = 'Partida'; a.isPrimary = false;
    (u as any).barangayAssignments = [a];
    expect(u.assignedBarangay).toBe('Partida');
  });
});
