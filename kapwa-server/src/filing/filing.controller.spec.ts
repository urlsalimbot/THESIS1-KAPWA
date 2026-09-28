import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { StreamableFile } from '@nestjs/common';
import * as fs from 'fs';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('FilingController — case ID photo endpoint', () => {
  let controller: FilingController;
  let service: {
    findIdPhotoByCase: jest.Mock;
    findOne: jest.Mock;
    isPhotoAccessAllowed: jest.Mock;
    ensureFileOnDisk: jest.Mock;
    diskPath: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findIdPhotoByCase: jest.fn(),
      findOne: jest.fn(),
      isPhotoAccessAllowed: jest.fn(),
      ensureFileOnDisk: jest.fn(),
      diskPath: jest.fn(),
    };
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

  it('returns null (not 404) when no id_photo exists for a case', async () => {
    service.findIdPhotoByCase.mockResolvedValue(null);
    await expect(controller.getCaseIdPhoto('c1')).resolves.toBeNull();
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
    // Throws a worded ForbiddenException rather than returning bare false.
    expect(() => guard.canActivate(ctx)).toThrow(/coordinator/i);
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

describe('FilingController — download self-healing', () => {
  let controller: FilingController;
  let service: {
    findOne: jest.Mock;
    isPhotoAccessAllowed: jest.Mock;
    ensureFileOnDisk: jest.Mock;
    diskPath: jest.Mock;
  };
  let readStreamSpy: jest.SpyInstance;

  beforeEach(async () => {
    service = {
      findOne: jest.fn(),
      isPhotoAccessAllowed: jest.fn(),
      ensureFileOnDisk: jest.fn(),
      diskPath: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilingController],
      providers: [{ provide: FilingService, useValue: service }],
    }).compile();
    controller = module.get<FilingController>(FilingController);
    readStreamSpy = jest
      .spyOn(fs, 'createReadStream')
      .mockReturnValue({ pipe: jest.fn(), on: jest.fn() } as any);
  });

  afterEach(() => {
    readStreamSpy?.mockRestore();
  });

  const adminReq = { user: { role: 'admin' } };

  it('streams a live document when the file exists on disk', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', fileName: 'coe.pdf', mimeType: 'application/pdf', originalName: 'coe.pdf' });
    service.isPhotoAccessAllowed.mockReturnValue(true);
    service.ensureFileOnDisk.mockResolvedValue(true);
    service.diskPath.mockReturnValue('/uploads/coe.pdf');
    const res = { set: jest.fn() };
    const out = await controller.download('d1', adminReq, res as any);
    expect(service.ensureFileOnDisk).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', fileName: 'coe.pdf' }));
    expect(service.diskPath).toHaveBeenCalledWith('coe.pdf');
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'application/pdf' }));
    expect(out).toBeInstanceOf(StreamableFile);
  });

  it('throws a distinguishable NotFound after the stale record is cleaned up', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', fileName: 'coe.pdf', category: 'approval_document', caseId: 'c1' });
    service.isPhotoAccessAllowed.mockReturnValue(true);
    service.ensureFileOnDisk.mockResolvedValue(false);
    await expect(controller.download('d1', adminReq, { set: jest.fn() } as any))
      .rejects.toThrow('File not found on disk');
    expect(fs.createReadStream).not.toHaveBeenCalled();
  });

  it('blocks forbidden roles before touching the disk', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', category: 'irf_photo' });
    service.isPhotoAccessAllowed.mockReturnValue(false);
    await expect(
      controller.download('d1', { user: { role: 'coordinator' } }, { set: jest.fn() } as any),
    ).rejects.toThrow('do not have access');
    expect(service.ensureFileOnDisk).not.toHaveBeenCalled();
  });
});