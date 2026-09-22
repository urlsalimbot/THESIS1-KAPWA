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

  it('flags staff when the claimant has no email or phone', async () => {
    const { svc, userRepo, notifications } = build();

    const result = await svc.provision({ ...input, email: undefined, phone: undefined });

    expect(result.created).toBe(false);
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(notifications.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ recipientId: 'admin-1', title: 'Account needs attention' }),
    ]);
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
