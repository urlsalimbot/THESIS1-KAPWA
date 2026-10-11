import { CaseEnrollmentsService } from './case-enrollments.service';

function mockRepo(over: any = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((e: any) => e),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('CaseEnrollmentsService program applicability', () => {
  let service: CaseEnrollmentsService;
  const repo = mockRepo();
  const programs = mockRepo();
  const casesRepo = mockRepo();

  beforeEach(() => {
    jest.clearAllMocks();
    repo.save.mockImplementation(async (e: any) => e);
    repo.findOne.mockResolvedValue(null);
    programs.findOne.mockResolvedValue({ id: 'p1', programType: 'diversion', name: 'Juvenile Diversion' });
    casesRepo.findOne.mockReset();
    service = new CaseEnrollmentsService(repo as any, programs as any, casesRepo as any);
  });

  it('rejects a program that does not apply to the case category', async () => {
    // A CICL case cannot enroll in Social Pension (catalog Appendix B).
    programs.findOne.mockResolvedValue({ id: 'p9', programType: 'social_pension', name: 'Social Pension' });
    casesRepo.findOne.mockResolvedValue({ id: 'c1', caseCategory: 'Children in Conflict with the Law (CICL)' });

    await expect(service.create('c1', { programId: 'p9', enrolledAt: '2026-10-01', status: 'active' }, 'u1')).rejects.toThrow(/not applicable/i);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows an applicable program, an untyped custom program, and an unmapped category', async () => {
    casesRepo.findOne.mockResolvedValue({ id: 'c1', caseCategory: 'Children in Conflict with the Law (CICL)' });
    await service.create('c1', { programId: 'p1', enrolledAt: '2026-10-01', status: 'active' }, 'u1');
    expect(repo.save).toHaveBeenCalledTimes(1);

    // Custom/local PPA without a program_type cannot be classified — stays offerable.
    programs.findOne.mockResolvedValue({ id: 'p2', programType: null, name: 'Local PPA' });
    repo.save.mockClear();
    await service.create('c1', { programId: 'p2', enrolledAt: '2026-10-01', status: 'active' }, 'u1');
    expect(repo.save).toHaveBeenCalledTimes(1);

    // Categories outside the restrictive map allow everything.
    programs.findOne.mockResolvedValue({ id: 'p3', programType: 'social_pension', name: 'Social Pension' });
    casesRepo.findOne.mockResolvedValue({ id: 'c2', caseCategory: 'Individual in Crisis Situation (AICS)' });
    repo.save.mockClear();
    await service.create('c2', { programId: 'p3', enrolledAt: '2026-10-01', status: 'active' }, 'u1');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('still rejects an unknown program and notifies nothing', async () => {
    programs.findOne.mockResolvedValue(null);
    await expect(service.create('c1', { programId: 'nope', enrolledAt: '2026-10-01', status: 'active' }, 'u1')).rejects.toThrow(/unknown program/i);
  });
});