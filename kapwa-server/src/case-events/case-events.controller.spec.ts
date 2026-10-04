import { Test, TestingModule } from '@nestjs/testing';
import { CaseEventsController } from './case-events.controller';
import { CaseEventsService } from './case-events.service';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';

describe('CaseEventsController', () => {
  let ctrl: CaseEventsController;
  const svc = {
    listForCase: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const req = { user: { id: 'u1' } } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseEventsController],
      providers: [{ provide: CaseEventsService, useValue: svc }],
    })
      .overrideGuard(AbacGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(CaseEventsController);
  });

  it('lists events for a case', async () => {
    await ctrl.list('c1');
    expect(svc.listForCase).toHaveBeenCalledWith('c1');
  });

  it('creates an event with the actor', async () => {
    const dto = { eventType: 'court_hearing', eventDate: '2026-10-20' };
    await ctrl.create('c1', dto as any, req);
    expect(svc.create).toHaveBeenCalledWith('c1', dto, req.user);
  });

  it('updates an event scoped to its case', async () => {
    const dto = { status: 'done' };
    await ctrl.update('c1', 'e1', dto as any, req);
    expect(svc.update).toHaveBeenCalledWith('c1', 'e1', dto, req.user);
  });

  it('removes an event scoped to its case', async () => {
    await ctrl.remove('c1', 'e1', req);
    expect(svc.remove).toHaveBeenCalledWith('c1', 'e1', req.user);
  });
});