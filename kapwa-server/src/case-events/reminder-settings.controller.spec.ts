import { Test, TestingModule } from '@nestjs/testing';
import { ReminderSettingsController } from './reminder-settings.controller';
import { ReminderSettingsService } from './reminder-settings.service';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';

describe('ReminderSettingsController', () => {
  let ctrl: ReminderSettingsController;
  const svc = {
    systemDefaults: jest.fn(),
    saveSystemDefaults: jest.fn(),
    workerSettings: jest.fn(),
    saveWorkerSettings: jest.fn(),
  };
  const req = { user: { id: 'u1' } } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReminderSettingsController],
      providers: [{ provide: ReminderSettingsService, useValue: svc }],
    })
      .overrideGuard(AbacGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .compile();
    ctrl = module.get(ReminderSettingsController);
  });

  it('reads the system defaults', async () => {
    await ctrl.systemDefaults();
    expect(svc.systemDefaults).toHaveBeenCalled();
  });

  it('saves system defaults with the actor', async () => {
    const dto = [{ eventType: 'court_hearing', offsets: [1440] }];
    await ctrl.saveSystemDefaults(dto as any, req);
    expect(svc.saveSystemDefaults).toHaveBeenCalledWith(dto, 'u1');
  });

  it('scopes worker reads and writes to the caller', async () => {
    await ctrl.mine(req);
    expect(svc.workerSettings).toHaveBeenCalledWith('u1');
    const dto = [{ eventType: 'home_visit', offsets: [] }];
    await ctrl.saveMine(dto as any, req);
    expect(svc.saveWorkerSettings).toHaveBeenCalledWith('u1', dto, 'u1');
  });
});