import { DataSource } from 'typeorm';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TeamAchievementsService } from './team-achievements.service';
import { TeamAchievementsController } from './team-achievements.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('TeamAchievementsService', () => {
  let service: TeamAchievementsService;
  let dsMock: { query: jest.Mock };

  const FROM = new Date('2026-09-28T00:00:00.000Z'); // Monday
  const TO = new Date('2026-10-04T00:00:00.000Z'); // Sunday
  const UPPER = new Date(TO.getTime() + 86_400_000); // exclusive bound

  const staff = [
    { id: 'u1', first_name: 'Ana', last_name: 'Santos' },
    { id: 'u2', first_name: 'Ben', last_name: 'Dela Cruz' },
  ];

  beforeEach(() => {
    dsMock = { query: jest.fn() };
    service = new TeamAchievementsService(dsMock as unknown as DataSource);
  });

  it('zero-fills every staff member with no activity in the range', async () => {
    dsMock.query
      .mockResolvedValueOnce(staff) // staff list
      .mockResolvedValueOnce([]) // cases
      .mockResolvedValueOnce([]) // interventions
      .mockResolvedValueOnce([]) // referrals
      .mockResolvedValueOnce([]) // docs
      .mockResolvedValueOnce([]); // tracker days

    const rollup = await service.rollup(FROM, TO);

    expect(rollup.perStaff).toEqual([
      { userId: 'u1', name: 'Ana Santos', cases: 0, interventions: 0, referrals: 0, docs: 0, trackerDays: 0 },
      { userId: 'u2', name: 'Ben Dela Cruz', cases: 0, interventions: 0, referrals: 0, docs: 0, trackerDays: 0 },
    ]);
    // Range echoes the requested inclusive bounds as ISO instants.
    expect(rollup.range).toEqual({ from: FROM.toISOString(), to: TO.toISOString() });
  });

  it('counts each metric per staff from their own rows, zero for others', async () => {
    dsMock.query
      .mockResolvedValueOnce(staff)
      .mockResolvedValueOnce([{ user_id: 'u1', cases: 2 }])
      .mockResolvedValueOnce([{ user_id: 'u1', interventions: 3 }])
      .mockResolvedValueOnce([{ user_id: 'u2', referrals: 1 }])
      .mockResolvedValueOnce([{ user_id: 'u1', docs: 4 }])
      .mockResolvedValueOnce([{ user_id: 'u1', tracker_days: 2 }]);

    const rollup = await service.rollup(FROM, TO);

    expect(rollup.perStaff[0]).toMatchObject({
      userId: 'u1',
      cases: 2,
      interventions: 3,
      referrals: 0,
      docs: 4,
      trackerDays: 2,
    });
    expect(rollup.perStaff[1]).toMatchObject({
      userId: 'u2',
      cases: 0,
      interventions: 0,
      referrals: 1,
      docs: 0,
      trackerDays: 0,
    });
  });

  it('queries an inclusive [from, to] range: $1 = from, $2 = to + 1 day (exclusive)', async () => {
    dsMock.query
      .mockResolvedValueOnce(staff)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.rollup(FROM, TO);

    // Five metric queries (calls 2-6) must all pass [from, to + 1 day] so the
    // whole of `to` (UTC midnight) is included and nothing spills past it.
    for (let call = 2; call <= 6; call++) {
      expect(dsMock.query).toHaveBeenNthCalledWith(call, expect.any(String), [FROM, UPPER]);
    }
  });

  it('parses tracker days as distinct dates over the same actor rule as cases', async () => {
    dsMock.query
      .mockResolvedValueOnce(staff)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.rollup(FROM, TO);

    // Sixth query: COUNT(DISTINCT created_at::date) grouped by changed_by_id
    // with the actor-based exclusion of NULL actors.
    const trackerSql = dsMock.query.mock.calls[5][0] as string;
    expect(trackerSql).toContain('COUNT(DISTINCT created_at::date)');
    expect(trackerSql).toContain('changed_by_id IS NOT NULL');
    expect(trackerSql).toContain('GROUP BY changed_by_id');
  });

  it('counts documents only for approval_document/requirement categories', async () => {
    dsMock.query
      .mockResolvedValueOnce(staff)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.rollup(FROM, TO);

    const docSql = dsMock.query.mock.calls[4][0] as string;
    expect(docSql).toContain('uploaded_by');
    expect(docSql).toContain("category IN ('approval_document', 'requirement')");
  });

  it('falls back to a placeholder name when a staff row has no name parts', async () => {
    dsMock.query
      .mockResolvedValueOnce([{ id: 'u9', first_name: null, last_name: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const rollup = await service.rollup(FROM, TO);
    expect(rollup.perStaff[0].name).toBe('Unnamed staff');
  });
});

describe('TeamAchievementsController', () => {
  const svcMock = { rollup: jest.fn() };
  const ctrl = new TeamAchievementsController(svcMock as any);

  beforeEach(() => svcMock.rollup.mockReset());

  it('is protected by the Jwt/Roles/Abac guard trio', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TeamAchievementsController) as Array<{ name: string }>;
    expect(guards.map((g) => g.name)).toEqual(['JwtAuthGuard', 'RolesGuard', 'AbacGuard']);
  });

  it('GET /team/achievements is staff + coordinator (coordinator read-only)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TeamAchievementsController.prototype.rollup)).toEqual([
      'admin',
      'social_worker',
      'coordinator',
    ]);
  });

  it('rejects a missing range with 400 and never calls the service', async () => {
    await expect(ctrl.rollup(undefined, undefined)).rejects.toThrow(
      'Both "from" and "to" dates are required (YYYY-MM-DD).',
    );
    await expect(ctrl.rollup('2026-09-28', undefined)).rejects.toThrow(
      'Both "from" and "to" dates are required (YYYY-MM-DD).',
    );
    expect(svcMock.rollup).not.toHaveBeenCalled();
  });

  it('rejects an invalid date format with 400', async () => {
    await expect(ctrl.rollup('not-a-date', '2026-10-04')).rejects.toThrow(
      'Both "from" and "to" dates are required (YYYY-MM-DD).',
    );
    await expect(ctrl.rollup('2026-09-28', '2026-10-4')).rejects.toThrow(
      'Both "from" and "to" dates are required (YYYY-MM-DD).',
    );
  });

  it('rejects an inverted range with 400', async () => {
    await expect(ctrl.rollup('2026-10-04', '2026-09-28')).rejects.toThrow(
      '"to" must not be earlier than "from".',
    );
    expect(svcMock.rollup).not.toHaveBeenCalled();
  });

  it('passes UTC-midnight Dates to the service and returns its rollup', async () => {
    const rollup = { perStaff: [], range: { from: '2026-09-28T00:00:00.000Z', to: '2026-10-04T00:00:00.000Z' } };
    svcMock.rollup.mockResolvedValue(rollup);

    const result = await ctrl.rollup('2026-09-28', '2026-10-04');

    expect(svcMock.rollup).toHaveBeenCalledWith(
      new Date('2026-09-28T00:00:00.000Z'),
      new Date('2026-10-04T00:00:00.000Z'),
    );
    expect(result).toBe(rollup);
  });
});