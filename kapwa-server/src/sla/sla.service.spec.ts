import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SlaService } from './sla.service';
import { Case, CaseStatus } from '../cases/case.entity';
import { Notification } from '../notifications/notification.entity';

describe('SlaService', () => {
  let service: SlaService;
  let caseRepo: any;
  let notifRepo: any;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T00:00:00Z'));
    caseRepo = {
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };
    notifRepo = {
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((entity: any) => entity),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
      ],
    }).compile();
    service = module.get<SlaService>(SlaService);
    jest.clearAllMocks();
    caseRepo.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const activeCase = (id: string, createdAt: Date) => ({
    id, status: CaseStatus.ACTIVE, assignedWorkerId: 'w1', createdAt,
  });
  // Sep 4 2026 is a Friday. Working days from these starts to Sep 4:
  // Aug 28 (Fri) = 6, Aug 31 (Mon) = 5, Sep 1 (Tue) = 4, Sep 2 (Wed) = 3, Sep 3 (Thu) = 2.
  const date = (d: string) => new Date(`${d}T00:00:00Z`);

  it('escalates an active case at the program waiting period and warns one day earlier', async () => {
    caseRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        activeCase('c-esc', date('2026-08-31')), // 5 working days
        activeCase('c-warn', date('2026-09-01')), // 4 working days
        activeCase('c-ok', date('2026-09-02')),   // 3 working days
      ]);
    caseRepo.query
      .mockResolvedValueOnce([
        { case_id: 'c-esc', waiting_period_days: '5' },
        { case_id: 'c-warn', waiting_period_days: '5' },
        { case_id: 'c-ok', waiting_period_days: '5' },
      ])
      .mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1);
    expect(result.warnings).toBe(1);
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    const rows = (notifRepo.save as jest.Mock).mock.calls[0][0] as Array<{
      title: string; message: string; referenceId: string;
    }>;
    expect(rows).toHaveLength(2); // one escalation + one warning, one admin
    expect(rows.some(r => r.title.includes('SLA Escalation'))).toBe(true);
    expect(rows.some(r => r.message.includes('> 5 days'))).toBe(true);
  });

  it('falls back to global thresholds when the program has no waiting period', async () => {
    caseRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        activeCase('c-esc', date('2026-09-01')), // 4 working days — above global escalation of 3
      ]);
    caseRepo.query
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1);
    const rows = (notifRepo.save as jest.Mock).mock.calls[0][0] as Array<{ referenceId: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ referenceId: 'c-esc' }));
  });

  it('escalates at the global threshold when the case has no program at all', async () => {
    caseRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        activeCase('c-warn', date('2026-09-02')), // 3 working days → global warning is 2, escalation 3
      ]);
    caseRepo.query
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1);
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
  });

  it('leaves enrolled and in_review on the global constants', async () => {
    caseRepo.find
      .mockResolvedValueOnce([{ id: 'c-enrolled', status: CaseStatus.ENROLLED, assignedWorkerId: 'w1', createdAt: date('2026-09-01') }])
      .mockResolvedValueOnce([{ id: 'c-review', status: CaseStatus.IN_REVIEW, createdAt: date('2026-09-01') }])
      .mockResolvedValueOnce([]);
    caseRepo.query.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.checkAndEscalate();

    // 4 working days: enrolled escalates at 3; in_review escalates at 3.
    expect(result.escalated).toBe(2);
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
    const rows = (notifRepo.save as jest.Mock).mock.calls[0][0] as unknown[];
    expect(rows).toHaveLength(2); // two escalated cases × 1 admin
  });

  it('queries admins only once across a full escalation run', async () => {
    caseRepo.find
      .mockResolvedValueOnce([{ id: 'c-2', status: CaseStatus.ENROLLED, assignedWorkerId: 'w1', createdAt: date('2026-09-01') }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c-3', status: CaseStatus.IN_REVIEW, createdAt: date('2026-09-01') }]);
    caseRepo.query.mockResolvedValue([{ id: 'admin-1' }]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(2);
    const adminQueries = (caseRepo.query as jest.Mock).mock.calls.filter(
      (c: string[]) => c[0].includes('role = \'admin\''),
    );
    expect(adminQueries).toHaveLength(1);
  });
});