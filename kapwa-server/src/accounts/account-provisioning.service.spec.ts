import { AccountProvisioningService } from './account-provisioning.service';

function build(overrides: any = {}) {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => ({ id: 'u-new', ...x })),
    query: jest.fn().mockResolvedValue([{ id: 'admin-1' }]),
  };
  const tokenRepo = {
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => x),
  };
  const personRepo = { findOne: jest.fn().mockResolvedValue({ firstName: 'Pedro', middleName: 'P', surname: 'Reyes' }) };
  const beneficiaryRepo = { findOne: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue(undefined) };
  const claimantRepo = { findOne: jest.fn() };
  const emailService = {
    sendAccountSetupEmail: jest.fn().mockResolvedValue(true),
    sendClaimantEnrollmentEmail: jest.fn().mockResolvedValue(true),
    getAppBaseUrl: jest.fn().mockReturnValue('http://localhost:5173'),
  };
  const smsGateway = { sendSms: jest.fn().mockResolvedValue({ success: true }) };
  const notifications = { createMany: jest.fn().mockResolvedValue([]) };
  const auditLog = { log: jest.fn().mockResolvedValue(undefined) };

  const svc = new AccountProvisioningService(
    userRepo as any, tokenRepo as any, personRepo as any, beneficiaryRepo as any, claimantRepo as any,
    emailService as any, smsGateway as any, notifications as any, auditLog as any,
  );
  Object.assign(userRepo, overrides.userRepo || {});
  return { svc, userRepo, tokenRepo, personRepo, beneficiaryRepo, emailService, smsGateway, notifications, auditLog };
}

const input = {
  claimantPersonId: 'person-1',
  beneficiaryId: 'ben-1',
  beneficiaryName: 'Pedro Reyes',
  controlNo: 'KAPWA-2026-00010',
  email: 'pedro@example.test',
  phone: '09171234567',
  actorId: 'worker-1',
};

describe('AccountProvisioningService', () => {
  it('creates a claimant account and delivers a one-time set-password link', async () => {
    const { svc, userRepo, tokenRepo, emailService, smsGateway } = build();

    const result = await svc.provision(input);

    expect(result.created).toBe(true);
    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.role).toBe('claimant');
    expect(saved.personId).toBe('person-1');
    expect(saved.password).toMatch(/^\$2[aby]\$/);
    expect(saved.mustChangePassword).toBeUndefined();

    const tokenRow = tokenRepo.save.mock.calls[0][0];
    expect(tokenRow.purpose).toBe('password_reset');
    expect(tokenRow.token).toHaveLength(64);
    expect(tokenRow.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(emailService.sendAccountSetupEmail).toHaveBeenCalledWith(
      'pedro@example.test',
      expect.objectContaining({ link: expect.stringContaining('/reset-password?token='), controlNo: input.controlNo }),
    );
    expect(smsGateway.sendSms).toHaveBeenCalledWith('09171234567', expect.stringContaining('/reset-password?token='));
    expect(result.emailDelivered).toBe(true);
    expect(result.smsDelivered).toBe(true);
  });

  it('reuses an existing account and sends the enrollment notification only', async () => {
    const existing = { id: 'u-existing', email: 'pedro@example.test', phone: '09171234567', personId: null };
    const { svc, userRepo, tokenRepo, emailService, smsGateway } = build({ userRepo: { findOne: jest.fn().mockResolvedValue(existing) } });

    const result = await svc.provision(input);

    expect(result.created).toBe(false);
    expect(result.userId).toBe('u-existing');
    expect(userRepo.create).not.toHaveBeenCalled();
    expect(tokenRepo.save).not.toHaveBeenCalled();
    expect(existing.personId).toBe('person-1');
    expect(emailService.sendClaimantEnrollmentEmail).toHaveBeenCalled();
    expect(emailService.sendAccountSetupEmail).not.toHaveBeenCalled();
    expect(smsGateway.sendSms).toHaveBeenCalledWith('09171234567', expect.stringContaining('enrolled'));
  });

  it('issues office credentials when the claimant has no email or phone', async () => {
    // The common case in Norzagaray: no handset, no address. The office hands
    // over a printable claimant ID and a temporary password instead of the
    // intake ending in "account not created".
    const { svc, userRepo, notifications, auditLog } = build();
    userRepo.query = jest
      .fn()
      .mockResolvedValueOnce([])                      // CREATE SEQUENCE
      .mockResolvedValueOnce([{ seq: '123' }]);       // SELECT nextval

    const result = await svc.provision({ ...input, email: undefined, phone: undefined });

    expect(result.created).toBe(true);
    expect(result.officeIssued).toBe(true);
    expect(result.emailDelivered).toBe(false);
    expect(result.smsDelivered).toBe(false);

    // A short ID a person can read off paper, and a password they can type:
    // eight characters in two groups, with no confusable 0/O, 1/I/L or 5/S.
    expect(result.username).toBe('CLM-000123');
    expect(result.temporaryPassword).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.username).toBe('CLM-000123');
    expect(saved.mustChangePassword).toBe(true);
    expect(saved.emailVerified).toBe(true);
    expect(saved.email).toBe('claimant-clm-000123@claimant.kapwa.local');
    expect(saved.phone).toBeUndefined();
    // Only the hash is stored, and it is not the password that was returned.
    expect(saved.password).not.toBe(result.temporaryPassword);
    expect(saved.password).toMatch(/^\$2[aby]\$/);

    // No delivery is attempted — there is nowhere to deliver to.
    expect(notifications.createMany).not.toHaveBeenCalled();

    // The audit trail names the account, never the credential.
    const auditEntry = auditLog.log.mock.calls.find((c) => c[0] === 'claimant.account_created');
    expect(auditEntry).toBeTruthy();
    expect(JSON.stringify(auditEntry)).toContain('CLM-000123');
    expect(JSON.stringify(auditEntry)).not.toContain(result.temporaryPassword);
  });

  it('reuses the account of a claimant who was issued one before', async () => {
    // Second intake for the same person: the generated username matches no
    // email or phone, so without the person lookup they would be handed a
    // second account — and a second password — for the same human being.
    const { svc, userRepo } = build();
    userRepo.findOne = jest.fn().mockResolvedValue({ id: 'u-existing', personId: 'person-1', email: 'claimant-clm-000123@claimant.kapwa.local' });

    const result = await svc.provision({ ...input, email: undefined, phone: undefined });

    expect(result.created).toBe(false);
    expect(result.userId).toBe('u-existing');
    expect(result.officeIssued).toBeUndefined();
    expect(result.temporaryPassword).toBeUndefined();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('flags staff when the setup link could not be delivered', async () => {
    const { svc, notifications } = build();
    svc['emailService'].sendAccountSetupEmail = jest.fn().mockResolvedValue(false);
    svc['smsGateway'].sendSms = jest.fn().mockResolvedValue({ success: false });

    const result = await svc.provision(input);

    expect(result.created).toBe(true);
    expect(result.emailDelivered).toBe(false);
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it('stamps beneficiaries.user_id so claimant /me lookups resolve', async () => {
    const { svc, beneficiaryRepo } = build();

    await svc.provision(input);

    expect(beneficiaryRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'u-new' } });
    expect(beneficiaryRepo.update).toHaveBeenCalledWith({ id: 'ben-1' }, { userId: 'u-new' });
  });

  it('does not overwrite an existing beneficiary stamp', async () => {
    const { svc, beneficiaryRepo } = build({ userRepo: {} });
    beneficiaryRepo.findOne.mockResolvedValue({ id: 'other-ben', userId: 'u-new' });

    await svc.provision(input);

    expect(beneficiaryRepo.update).not.toHaveBeenCalled();
  });

  it('issues a setup link for admin-provisioned accounts', async () => {    const { svc, tokenRepo, emailService, smsGateway } = build();

    await svc.deliverAccountCredentials({ userId: 'u9', email: 'staff@test.com', phone: '09170000000', fullName: 'A B', role: 'social_worker' });

    expect(tokenRepo.save).toHaveBeenCalled();
    expect(emailService.sendAccountSetupEmail).toHaveBeenCalledWith('staff@test.com', expect.objectContaining({ link: expect.stringContaining('/reset-password?token=') }));
    expect(smsGateway.sendSms).toHaveBeenCalledWith('09170000000', expect.stringContaining('/reset-password?token='));
  });
});
