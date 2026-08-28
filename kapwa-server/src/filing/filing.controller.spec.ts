import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('FilingController — case ID photo endpoint', () => {
  let controller: FilingController;
  let service: { findIdPhotoByCase: jest.Mock };

  beforeEach(async () => {
    service = { findIdPhotoByCase: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilingController],
      providers: [{ provide: FilingService, useValue: service }],
    }).compile();
    controller = module.get<FilingController>(FilingController);
  });

  it('returns the id_photo row for a case', async () => {
    const photo = { id: 'p1', category: 'id_photo', caseId: 'c1', originalName: 'id.png' };
    service.findIdPhotoByCase.mockResolvedValue(photo);
    await expect(controller.getCaseIdPhoto('c1')).resolves.toEqual(photo);
    expect(service.findIdPhotoByCase).toHaveBeenCalledWith('c1');
  });

  it('throws NotFoundException when no id_photo exists for a case', async () => {
    service.findIdPhotoByCase.mockResolvedValue(null);
    await expect(controller.getCaseIdPhoto('c1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is route-scoped to admin and social_worker', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, FilingController.prototype.getCaseIdPhoto);
    expect(roles).toEqual(['admin', 'social_worker']);
  });

  it('RolesGuard rejects a coordinator at the route level', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => FilingController.prototype.getCaseIdPhoto,
      getClass: () => FilingController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'coordinator' } }) }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('RolesGuard allows an admin at the route level', () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => FilingController.prototype.getCaseIdPhoto,
      getClass: () => FilingController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'admin' } }) }),
    } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});