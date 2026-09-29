import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeamScheduleService } from './team-schedule.service';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { AuditLogService } from '../audit/audit-log.service';

describe('TeamScheduleService', () => {
  let service: TeamScheduleService;
  let repoMock: any;
  let auditMock: any;

  const workerReq = { id: 'w1', role: 'social_worker' };
  const adminReq = { id: 'a1', role: 'admin' };

  beforeEach(async () => {
    repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      manager: { query: jest.fn() },
    };
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamScheduleService,
        { provide: getRepositoryToken(TeamScheduleBlock), useValue: repoMock },
        { provide: AuditLogService, useValue: auditMock },
      ],
    }).compile();
    service = module.get<TeamScheduleService>(TeamScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('403 when a worker creates a block for another staff', async () => {
    // requester { role:'social_worker', id:'w1' }, dto.userId 'w2'
    await expect(
      service.createBlock(
        { userId: 'w2', blockDate: '2026-10-01', blockType: 'in_office' } as any,
        workerReq as any,
      ) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.create).not.toHaveBeenCalled();
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('403 when an admin creates a block for another staff (owner-strict amendment)', async () => {
    // Amendment: no admin create-for-others path — admin follows the same
    // owner-only rule as workers.
    await expect(
      service.createBlock(
        { userId: 'w2', blockDate: '2026-10-01', blockType: 'home_visit' } as any,
        adminReq as any,
      ) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.create).not.toHaveBeenCalled();
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('a worker can create a block for themselves', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b2', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', blockType: 'field_day' } as any,
      workerReq as any,
    );
    expect(row.createdBy).toBe('w1');
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('createBlock defaults visibleTo to team when absent', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b3', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', blockType: 'remote' } as any,
      workerReq as any,
    );
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ visibleTo: 'team' }));
    expect(row.visibleTo).toBe('team');
  });

  it('createBlock persists an explicit visibleTo toggle for self', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b4', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', blockType: 'field_day', visibleTo: 'team_coordinators' } as any,
      workerReq as any,
    );
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ visibleTo: 'team_coordinators' }));
    expect(row.visibleTo).toBe('team_coordinators');
  });

  it('rejects an invalid visibleTo with 400', async () => {
    await expect(
      service.createBlock(
        { userId: 'w1', blockDate: '2026-10-01', blockType: 'in_office', visibleTo: 'secret' } as any,
        workerReq as any,
      ) as any,
    ).rejects.toThrow(/Unknown block visibility|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown block type with 400', async () => {
    await expect(
      service.createBlock(
        { userId: 'w1', blockDate: '2026-10-01', blockType: 'sleeping_on_the_job' } as any,
        adminReq as any,
      ) as any,
    ).rejects.toThrow(/Unknown block type|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('deleteBlock logs an audit entry', async () => {
    // owner deletes own block; assert audit.log called with ['team.block.delete', blockId, req.id]
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1' });
    repoMock.delete.mockResolvedValue({ affected: 1 });
    await service.deleteBlock('b1', workerReq as any, 'w1');
    expect(repoMock.delete).toHaveBeenCalledWith('b1');
    expect(auditMock.log).toHaveBeenCalledWith('team.block.delete', 'b1', 'w1');
  });

  it('deleteBlock forbids a worker deleting another staff block and skips audit', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w2' });
    await expect(service.deleteBlock('b1', workerReq as any, 'w1') as any).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.delete).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('deleteBlock forbids an ADMIN deleting another staff block (owner-strict amendment)', async () => {
    // Amendment: admin enjoys no other-staff write — owner rule for all roles.
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w2' });
    await expect(service.deleteBlock('b1', adminReq as any, 'a1') as any).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.delete).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('updateBlock forbids a worker editing another staff block', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w2' });
    await expect(
      service.updateBlock('b1', { note: 'mine now' } as any, workerReq as any) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateBlock forbids an ADMIN editing another staff block (owner-strict amendment)', async () => {
    // Amendment: admin enjoys no other-staff write — the owner rule applies
    // to every role, admin included.
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w2' });
    await expect(
      service.updateBlock('b1', { note: 'reassigning work' } as any, adminReq as any) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateBlock forbids a worker reassigning their own block to another staff', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1' });
    await expect(
      service.updateBlock('b1', { userId: 'w2' } as any, workerReq as any) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateBlock allows a worker to keep their own userId (or omit it)', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1' });
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b1', ...d }));
    const row = await service.updateBlock(
      'b1',
      { userId: 'w1', note: 'shift' } as any,
      workerReq as any,
    );
    expect(row.userId).toBe('w1');
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('updateBlock allows the owner to toggle their own visibleTo', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1', visibleTo: 'team' });
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b1', ...d }));
    const row = await service.updateBlock('b1', { visibleTo: 'team_coordinators' } as any, workerReq as any);
    expect(row.visibleTo).toBe('team_coordinators');
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('updateBlock rejects an invalid visibleTo with 400 before saving', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1', visibleTo: 'team' });
    await expect(
      service.updateBlock('b1', { visibleTo: 'secret' } as any, workerReq as any) as any,
    ).rejects.toThrow(/Unknown block visibility|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateBlock forbids an ADMIN reassigning a block to another staff (no admin carve-out)', async () => {
    // Amendment: the admin-reassign carve-out is gone — userId can never be
    // changed on PATCH, for any role.
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1' });
    await expect(
      service.updateBlock('b1', { userId: 'w2' } as any, adminReq as any) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('coordinator list with no assigned barangay returns an empty list (never all)', async () => {
    const result = await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'coordinator',
      undefined,
    );
    expect(result).toEqual([]);
    expect(repoMock.find).not.toHaveBeenCalled();
  });

  it('coordinator list is scoped to their barangay staff ids', async () => {
    repoMock.manager.query.mockResolvedValue([{ user_id: 'w1' }, { user_id: 'w3' }]);
    repoMock.find.mockResolvedValue([{ id: 'b1', userId: 'w1' }]);
    const result = await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'coordinator',
      'Bigte',
    );
    expect(repoMock.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('user_barangay_assignments'),
      ['Bigte'],
    );
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          // In(['w1','w3']) → FindOperator carrying the resolved staff ids
          userId: expect.objectContaining({ _type: 'in', _value: ['w1', 'w3'] }),
          // Amendment: coordinators only see blocks toggled to them
          visibleTo: 'team_coordinators',
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('coordinator list excludes team-visible-only blocks via the visibleTo filter', async () => {
    repoMock.manager.query.mockResolvedValue([{ user_id: 'w1' }]);
    repoMock.find.mockResolvedValue([{ id: 'b1', userId: 'w1', visibleTo: 'team_coordinators' }]);
    const result = await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'coordinator',
      'Bigte',
    );
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ visibleTo: 'team_coordinators' }) }),
    );
    expect(result).toHaveLength(1);
  });

  it('non-coordinator list filters by staffId when provided', async () => {
    repoMock.find.mockResolvedValue([]);
    await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      'w1',
      'admin',
      undefined,
    );
    const findWhere = repoMock.find.mock.calls[0][0].where;
    expect(findWhere.userId).toBe('w1');
    expect(findWhere.blockDate).toBeDefined();
  });

  // ————— Multi-day blocks (amendment) —————

  it('createBlock with an endDate after the start passes and round-trips it', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b5', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', endDate: '2026-10-05', blockType: 'field_day' } as any,
      workerReq as any,
    );
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ endDate: '2026-10-05' }));
    expect(row.endDate).toBe('2026-10-05');
  });

  it('createBlock allows endDate equal to blockDate (inclusive range)', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b6', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', endDate: '2026-10-02', blockType: 'remote' } as any,
      workerReq as any,
    );
    expect(row.endDate).toBe('2026-10-02');
  });

  it('createBlock rejects an endDate before blockDate with 400 before saving', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    await expect(
      service.createBlock(
        { userId: 'w1', blockDate: '2026-10-02', endDate: '2026-10-01', blockType: 'in_office' } as any,
        workerReq as any,
      ) as any,
    ).rejects.toThrow('End date must be on or after the start date');
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('createBlock rejects a malformed endDate with 400', async () => {
    await expect(
      service.createBlock(
        { userId: 'w1', blockDate: '2026-10-02', endDate: '02-10-2026', blockType: 'in_office' } as any,
        workerReq as any,
      ) as any,
    ).rejects.toThrow(/Invalid end date|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('createBlock stores null endDate when absent (single-day COALESCE semantics)', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b7', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', blockType: 'home_visit' } as any,
      workerReq as any,
    );
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ endDate: null }));
    expect(row.endDate).toBeNull();
  });

  it('createBlock stores null endDate when explicitly null', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b8', ...d }));
    const row = await service.createBlock(
      { userId: 'w1', blockDate: '2026-10-02', endDate: null, blockType: 'on_leave' } as any,
      workerReq as any,
    );
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ endDate: null }));
    expect(row.endDate).toBeNull();
  });

  it('updateBlock rejects an endDate before the block start with 400', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1', blockDate: '2026-10-02' });
    await expect(
      service.updateBlock('b1', { endDate: '2026-10-01' } as any, workerReq as any) as any,
    ).rejects.toThrow('End date must be on or after the start date');
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateBlock validates endDate against the PATCHed blockDate when both change', async () => {
    // block starts 10-02 and moves to 10-03 in the same PATCH: endDate 10-04
    // is fine against the NEW start, valid against the old one too.
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1', blockDate: '2026-10-02' });
    await expect(
      service.updateBlock('b1', { blockDate: '2026-10-03', endDate: '2026-10-02' } as any, workerReq as any) as any,
    ).rejects.toThrow('End date must be on or after the start date');
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateBlock extends a single-day block into a multi-day one', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1', blockDate: '2026-10-02', endDate: null });
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b1', ...d }));
    const row = await service.updateBlock('b1', { endDate: '2026-10-04' } as any, workerReq as any);
    expect(row.endDate).toBe('2026-10-04');
    expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ endDate: '2026-10-04' }));
  });

  it('updateBlock keeps the loaded endDate when endDate is absent (undefined not assigned)', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1', blockDate: '2026-10-02', endDate: '2026-10-04' });
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b1', ...d }));
    await service.updateBlock('b1', { endDate: undefined, note: 'shift' } as any, workerReq as any);
    const saved = repoMock.save.mock.calls[0][0];
    expect(saved.endDate).toBe('2026-10-04');
  });

  it('listBlocks uses inclusive overlap: block_date <= to and COALESCE(end_date, block_date) >= from', async () => {
    repoMock.find.mockResolvedValue([]);
    await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'admin',
      undefined,
    );
    const findWhere = repoMock.find.mock.calls[0][0].where;
    // Window's `to` bound on block_date (starts before the window are fine)
    expect(findWhere.blockDate).toEqual(expect.objectContaining({ _type: 'lessThanOrEqual', _value: '2026-10-04' }));
    // `from` bound via COALESCE so single-day rows (NULL end_date) fall back
    // to block_date and multi-day rows ending inside the window qualify.
    expect(findWhere.endDate).toEqual(expect.objectContaining({ _type: 'raw' }));
    const sql = (findWhere.endDate as any)._getSql('TeamScheduleBlock.end_date');
    expect(sql).toContain('COALESCE(TeamScheduleBlock.end_date, block_date) >= :from');
    expect((findWhere.endDate as any)._objectLiteralParameters).toEqual({ from: '2026-09-28' });
  });

  it('listBlocks multi-day overlap: a block starting before the window with end_date inside passes the predicate', async () => {
    repoMock.find.mockResolvedValue([{ id: 'b1', userId: 'w1', blockDate: '2026-09-25', endDate: '2026-10-01' }]);
    const result = await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'admin',
      undefined,
    );
    // The service forwards the overlap predicate to the DB; rows starting
    // before `from` but ending inside the window satisfy it (SQL-enforced —
    // verified against Postgres in the migration check).
    const sql = (repoMock.find.mock.calls[0][0].where.endDate as any)._getSql('TeamScheduleBlock.end_date');
    expect(sql).toContain('COALESCE');
    expect(result).toHaveLength(1);
  });

  it('listBlocks multi-day overlap: a block ending before the window fails the COALESCE predicate', async () => {
    repoMock.find.mockResolvedValue([]);
    await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'admin',
      undefined,
    );
    // end_date 2026-09-27 (or single-day 09-27) → COALESCE < '2026-09-28' →
    // excluded by the raw predicate. Asserting the predicate shape, since
    // exclusion happens in SQL (verified against Postgres in the migration
    // check).
    const sql = (repoMock.find.mock.calls[0][0].where.endDate as any)._getSql('TeamScheduleBlock.end_date');
    expect(sql).toContain('>= :from');
  });

  it('coordinator list keeps the visibleTo filter on multi-day rows (overlap + scope combined)', async () => {
    repoMock.manager.query.mockResolvedValue([{ user_id: 'w1' }]);
    repoMock.find.mockResolvedValue([{ id: 'b1', userId: 'w1', visibleTo: 'team_coordinators', endDate: '2026-10-03' }]);
    const result = await service.listBlocks(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      undefined,
      'coordinator',
      'Bigte',
    );
    const findWhere = repoMock.find.mock.calls[0][0].where;
    expect(findWhere.visibleTo).toBe('team_coordinators');
    expect(findWhere.userId).toEqual(expect.objectContaining({ _type: 'in', _value: ['w1'] }));
    expect(findWhere.endDate).toEqual(expect.objectContaining({ _type: 'raw' }));
    expect(result).toHaveLength(1);
  });
});