import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OfficeEventsService } from './office-events.service';
import { OfficeEvent } from './office-event.entity';
import { AuditLogService } from '../audit/audit-log.service';

describe('OfficeEventsService', () => {
  let service: OfficeEventsService;
  let repoMock: any;
  let auditMock: any;

  const workerReq = { id: 'w1', role: 'social_worker' };
  const adminReq = { id: 'a1', role: 'admin' };

  const baseDto = {
    title: 'All-hands',
    startsAt: '2026-10-01T09:00:00Z',
    endsAt: '2026-10-01T10:00:00Z',
    visibleTo: 'staff',
  };

  beforeEach(async () => {
    repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfficeEventsService,
        { provide: getRepositoryToken(OfficeEvent), useValue: repoMock },
        { provide: AuditLogService, useValue: auditMock },
      ],
    }).compile();
    service = module.get<OfficeEventsService>(OfficeEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('coordinator list excludes staff-only events (visible_to = staff_coordinators only)', async () => {
    // Only coordinator-scoped events may appear in a coordinator payload;
    // a staff-default event would be filtered out by the where clause.
    repoMock.find.mockResolvedValue([{ id: 'e1', visibleTo: 'staff_coordinators' }]);
    const result = await service.listEvents(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      'coordinator',
      'Bigte',
    );
    const findWhere = repoMock.find.mock.calls[0][0].where;
    expect(findWhere.visibleTo).toBe('staff_coordinators');
    expect(findWhere.startsAt).toBeDefined();
    expect(result).toHaveLength(1);
  });

  it('non-coordinator list applies no visibility filter', async () => {
    repoMock.find.mockResolvedValue([]);
    await service.listEvents(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-04T00:00:00Z'),
      'admin',
    );
    const findWhere = repoMock.find.mock.calls[0][0].where;
    expect(findWhere.visibleTo).toBeUndefined();
    expect(findWhere.startsAt).toBeDefined();
  });

  it('createEvent persists repeatRule jsonb and sets owner to requester', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'e1', ...d }));
    const repeatRule = { freq: 'WEEKLY', interval: 2, byDay: ['TH'], until: '2026-12-31T00:00:00Z' };
    const row = await service.createEvent({ ...baseDto, repeatRule } as any, workerReq as any);
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ repeatRule, ownerId: 'w1', visibleTo: 'staff' }),
    );
    expect(repoMock.save).toHaveBeenCalled();
    expect(row.repeatRule).toEqual(repeatRule);
    expect(row.ownerId).toBe('w1');
  });

  it('stores timestamps as Date instances from ISO strings', async () => {
    repoMock.create.mockImplementation((d: any) => d);
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'e1', ...d }));
    const row = await service.createEvent(baseDto as any, adminReq as any);
    expect(row.startsAt).toEqual(new Date('2026-10-01T09:00:00Z'));
    expect(row.endsAt).toEqual(new Date('2026-10-01T10:00:00Z'));
  });

  it('rejects an invalid visible_to with 400', async () => {
    await expect(
      service.createEvent({ ...baseDto, visibleTo: 'everyone' } as any, adminReq as any) as any,
    ).rejects.toThrow(/Unknown event visibility|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('rejects an event that ends before it starts with 400', async () => {
    await expect(
      service.createEvent(
        { ...baseDto, startsAt: '2026-10-01T10:00:00Z', endsAt: '2026-10-01T09:00:00Z' } as any,
        adminReq as any,
      ) as any,
    ).rejects.toThrow(/Event end must be after start|400/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateEvent forbids a worker editing another owner event (403)', async () => {
    repoMock.findOne.mockResolvedValue({
      id: 'e1',
      ownerId: 'w2',
      startsAt: new Date('2026-10-01T09:00:00Z'),
      endsAt: new Date('2026-10-01T10:00:00Z'),
    });
    await expect(
      service.updateEvent('e1', { title: 'hijacked' } as any, workerReq as any) as any,
    ).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('admin can update another owner event', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'e1', ownerId: 'w2' });
    repoMock.save.mockImplementation(async (d: any) => ({ id: 'e1', ...d }));
    const row = await service.updateEvent('e1', { title: 'renamed' } as any, adminReq as any);
    expect(repoMock.save).toHaveBeenCalled();
    expect(row.title).toBe('renamed');
  });

  it('updateEvent re-validates the time range when shifting start past end', async () => {
    repoMock.findOne.mockResolvedValue({
      id: 'e1',
      ownerId: 'w1',
      startsAt: new Date('2026-10-01T09:00:00Z'),
      endsAt: new Date('2026-10-01T10:00:00Z'),
    });
    await expect(
      service.updateEvent('e1', { startsAt: '2026-10-01T11:00:00Z' } as any, workerReq as any) as any,
    ).rejects.toThrow(/Event end must be after start|400/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateEvent rejects invalid visible_to with 400', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'e1', ownerId: 'w1' });
    await expect(
      service.updateEvent('e1', { visibleTo: 'nobody' } as any, adminReq as any) as any,
    ).rejects.toThrow(/Unknown event visibility|Bad Request/);
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('updateEvent 404s for a missing event', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(
      service.updateEvent('missing', { title: 'x' } as any, adminReq as any) as any,
    ).rejects.toThrow(/not found|404/i);
  });

  it('deleteEvent logs an audit entry', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'e1', ownerId: 'w1' });
    repoMock.delete.mockResolvedValue({ affected: 1 });
    await service.deleteEvent('e1', workerReq as any, 'w1');
    expect(repoMock.delete).toHaveBeenCalledWith('e1');
    expect(auditMock.log).toHaveBeenCalledWith('team.event.delete', 'e1', 'w1');
  });

  it('deleteEvent forbids a worker deleting another owner event and skips audit', async () => {
    repoMock.findOne.mockResolvedValue({ id: 'e1', ownerId: 'w2' });
    await expect(service.deleteEvent('e1', workerReq as any, 'w1') as any).rejects.toThrow(/Forbidden|403/);
    expect(repoMock.delete).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });
});