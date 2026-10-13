import { CaseInterventionsService } from './case-interventions.service';

function mockService() {
  const interventionRepo = {
    manager: { query: jest.fn() },
    create: jest.fn((e: any) => e),
    save: jest.fn(async (e: any) => e),
    findOne: jest.fn().mockResolvedValue(null),
  };
  // Default: every typed service belongs to some matrix row that obliges no
  // form — the membership and obligation tests override this.
  const matrixRepo = { findOne: jest.fn().mockResolvedValue({ interventionType: 'x', requiredForm: null }) };
  const accessCardsService = { autoLogFromIntervention: jest.fn().mockResolvedValue(undefined) };
  const svc = new CaseInterventionsService(interventionRepo as any, matrixRepo as any, accessCardsService as any);
  return { interventionRepo, matrixRepo, accessCardsService, svc };
}

describe('CaseInterventionsService enrollment + financial gating', () => {
  it('refuses an intervention without an enrollment on the case', async () => {
    const { interventionRepo, svc } = mockService();
    (interventionRepo.manager.query as jest.Mock)
      .mockResolvedValueOnce([]) // consent: none revoked
      .mockResolvedValueOnce([]); // enrollment: none found on this case

    await expect(
      svc.create('c1', { programId: 'p1', programEnrollmentId: 'missing', serviceName: 'AICS' }, 'u1'),
    ).rejects.toThrow(/enrollment not found/i);
    expect(interventionRepo.save).not.toHaveBeenCalled();
  });

  it('clears legacy financial values when a row is updated to a non-financial service', async () => {
    const { interventionRepo, svc } = mockService();
    const legacy = { id: 'iv-9', caseId: 'c1', amount: 5000, modeOfDelivery: 'Cash', fundSource: 'DSWD' };
    interventionRepo.findOne.mockResolvedValue(legacy);

    await svc.update('c1', 'iv-9', { interventionType: 'crisis_counseling' } as any);

    const saved = interventionRepo.save.mock.calls[0][0];
    expect(saved.amount).toBeNull();
    expect(saved.fundSource).toBeNull();
  });

  it('strips amount, mode and fund source from a non-financial service', async () => {
    const { interventionRepo, svc } = mockService();
    (interventionRepo.manager.query as jest.Mock)
      .mockResolvedValueOnce([]) // consent: none revoked
      .mockResolvedValueOnce([{ program_id: 'p1' }]); // enrollment belongs to the case

    await svc.create('c1', {
      programId: 'p1',
      programEnrollmentId: 'enr-1',
      serviceName: 'Crisis Intervention',
      interventionType: 'crisis_counseling',
      amount: 5000,
      modeOfDelivery: 'Cash',
      fundSource: 'DSWD',
    }, 'u1');

    const saved = interventionRepo.save.mock.calls[0][0];
    expect(saved.interventionType).toBe('crisis_counseling');
    // The create path blanks nulls to undefined (fresh row: the column is NULL
    // in the DB either way); the update path keeps the nulls to clear legacy data.
    expect(saved.amount).toBeUndefined();
    expect(saved.modeOfDelivery).toBeUndefined();
    expect(saved.fundSource).toBeUndefined();
  });

  it('rounds a money amount to centavos at the boundary', async () => {
    const { interventionRepo, svc } = mockService();
    (interventionRepo.manager.query as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ program_id: 'p1' }]);

    await svc.create('c1', {
      programId: 'p1',
      programEnrollmentId: 'enr-1',
      serviceName: 'Financial Assistance',
      interventionType: 'financial_grant',
      amount: 1234.567,
    }, 'u1');

    // numeric(12,2) would have rounded this silently; the books and the receipt
    // now agree, and three such amounts no longer show float dust in the total.
    expect(interventionRepo.save.mock.calls[0][0].amount).toBe(1234.57);
  });

  it('keeps the financial fields of a financial service', async () => {    const { interventionRepo, svc } = mockService();
    (interventionRepo.manager.query as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ program_id: 'p1' }]);

    await svc.create('c1', {
      programId: 'p1',
      programEnrollmentId: 'enr-1',
      serviceName: 'Financial Assistance',
      interventionType: 'financial_grant',
      amount: 1500,
      modeOfDelivery: 'Cash',
      fundSource: 'LGU',
    }, 'u1');

    const saved = interventionRepo.save.mock.calls[0][0];
    expect(saved.amount).toBe(1500);
    expect(saved.modeOfDelivery).toBe('Cash');
    expect(saved.fundSource).toBe('LGU');
  });
});

describe('CaseInterventionsService — program matrix membership + form obligation', () => {
  it('refuses a typed service the enrolled program does not render', async () => {
    const { interventionRepo, matrixRepo, svc } = mockService();
    (interventionRepo.manager.query as jest.Mock)
      .mockResolvedValueOnce([]) // consent: none revoked
      .mockResolvedValueOnce([{ program_id: 'p1' }]); // enrollment found
    matrixRepo.findOne.mockResolvedValue(null);

    await expect(
      svc.create('c1', { programId: 'p1', programEnrollmentId: 'enr-1', serviceName: 'X', interventionType: 'foreign_code' }, 'u1'),
    ).rejects.toThrow(/not a service the enrolled program renders/);
    expect(interventionRepo.save).not.toHaveBeenCalled();
  });

  it('persists the matrix row\u2019s required-form obligation on create', async () => {
    const { interventionRepo, matrixRepo, svc } = mockService();
    (interventionRepo.manager.query as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ program_id: 'p1' }]);
    matrixRepo.findOne.mockResolvedValue({ interventionType: 'scsr_generated', requiredForm: 'social_case_study_report' });

    await svc.create('c1', { programId: 'p1', programEnrollmentId: 'enr-1', serviceName: 'CSR', interventionType: 'scsr_generated' }, 'u1');

    expect(matrixRepo.findOne).toHaveBeenCalledWith({ where: { programId: 'p1', interventionType: 'scsr_generated' } });
    const saved = interventionRepo.save.mock.calls[0][0];
    expect(saved.requiredForm).toBe('social_case_study_report');
  });

  it('re-validates the anchor on update and re-derives the obligation', async () => {
    const { interventionRepo, matrixRepo, svc } = mockService();
    interventionRepo.findOne.mockResolvedValue({ id: 'iv-9', caseId: 'c1', programEnrollmentId: 'enr-1', programId: 'p1', interventionType: 'financial_grant', requiredForm: null });
    (interventionRepo.manager.query as jest.Mock).mockResolvedValue([{ program_id: 'p1' }]);
    matrixRepo.findOne.mockResolvedValue({ interventionType: 'scsr_generated', requiredForm: 'social_case_study_report' });

    await svc.update('c1', 'iv-9', { interventionType: 'scsr_generated' });

    const saved = interventionRepo.save.mock.calls[0][0];
    expect(saved.requiredForm).toBe('social_case_study_report');
  });

  it('refuses to retarget the enrollment to another case on update', async () => {
    const { interventionRepo, svc } = mockService();
    interventionRepo.findOne.mockResolvedValue({ id: 'iv-9', caseId: 'c1', programEnrollmentId: 'enr-1', programId: 'p1' });
    (interventionRepo.manager.query as jest.Mock).mockResolvedValue([]); // no enrollment on THIS case

    await expect(
      svc.update('c1', 'iv-9', { programEnrollmentId: 'enr-OTHER' } as any),
    ).rejects.toThrow(/enrollment not found/i);
    expect(interventionRepo.save).not.toHaveBeenCalled();
  });
});