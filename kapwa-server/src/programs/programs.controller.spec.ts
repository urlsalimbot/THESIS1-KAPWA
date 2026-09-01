import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('ProgramsController — read access for staff', () => {
  let controller: ProgramsController;
  let service: { findAll: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn(), findById: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramsController],
      providers: [{ provide: ProgramsService, useValue: service }],
    }).compile();
    controller = module.get<ProgramsController>(ProgramsController);
  });

  it('lists programs when called', async () => {
    service.findAll.mockResolvedValue([{ id: 'p1' }]);
    await expect(controller.findAll(undefined)).resolves.toEqual([{ id: 'p1' }]);
    expect(service.findAll).toHaveBeenCalledWith(true);
  });

  it('GET list is route-scoped to admin and social_worker', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.findAll);
    expect(roles).toEqual(['admin', 'social_worker']);
  });

  it('GET by id is route-scoped to admin and social_worker', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.findOne);
    expect(roles).toEqual(['admin', 'social_worker']);
  });

  it('write endpoints stay admin-only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.create)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.update)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.delete)).toEqual(['admin']);
  });

  it('RolesGuard allows a social_worker to list programs', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => ProgramsController.prototype.findAll,
      getClass: () => ProgramsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'social_worker' } }) }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('RolesGuard rejects a coordinator from listing programs (not MSWDO staff)', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => ProgramsController.prototype.findAll,
      getClass: () => ProgramsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'coordinator' } }) }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('RolesGuard rejects a claimant from listing programs', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => ProgramsController.prototype.findAll,
      getClass: () => ProgramsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'claimant' } }) }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('RolesGuard rejects a social_worker from creating programs', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => ProgramsController.prototype.create,
      getClass: () => ProgramsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'social_worker' } }) }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(false);
  });
});
