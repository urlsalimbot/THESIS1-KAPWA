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

  it('201 path: admin creates a block for another staff', async () => {
    // repo.create+save mocked; expected saved row returned with createdBy admin id
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b1', ...d }));
    const row = await service.createBlock(
      { userId: 'w2', blockDate: '2026-10-01', blockType: 'home_visit' } as any,
      adminReq as any,
    );
    expect(repoMock.save).toHaveBeenCalled();
    expect(row).toEqual(expect.objectContaining({ id: 'b1', userId: 'w2', createdBy: 'a1' }));
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

  it('updateBlock forbids a worker editing another staff block', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w2' });
    await expect(
      service.updateBlock('b1', { note: 'mine now' } as any, workerReq as any) as any,
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

  it('updateBlock allows an admin to reassign a block to another staff', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'b1', userId: 'w1' });
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'b1', ...d }));
    const row = await service.updateBlock('b1', { userId: 'w2' } as any, adminReq as any);
    expect(row.userId).toBe('w2');
    expect(repoMock.save).toHaveBeenCalled();
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
        }),
      }),
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
});