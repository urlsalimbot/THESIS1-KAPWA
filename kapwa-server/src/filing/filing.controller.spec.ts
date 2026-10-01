import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConflictException, StreamableFile } from '@nestjs/common';
import * as fs from 'fs';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';
import { CaseStepLocksService } from '../cases/case-step-locks.service';
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
      providers: [
        { provide: FilingService, useValue: service },
        { provide: CaseStepLocksService, useValue: { assertUnsealed: jest.fn().mockResolvedValue(undefined) } },
      ],
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
  let stepLocks: { assertUnsealed: jest.Mock; isSealed: jest.Mock };
  let readStreamSpy: jest.SpyInstance;

  beforeEach(async () => {
    service = {
      findOne: jest.fn(),
      isPhotoAccessAllowed: jest.fn(),
      ensureFileOnDisk: jest.fn(),
      diskPath: jest.fn(),
    };
    stepLocks = { assertUnsealed: jest.fn().mockResolvedValue(undefined), isSealed: jest.fn().mockResolvedValue(false) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilingController],
      providers: [
        { provide: FilingService, useValue: service },
        { provide: CaseStepLocksService, useValue: stepLocks },
      ],
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
    expect(service.ensureFileOnDisk).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', fileName: 'coe.pdf' }),
      { heal: true },
    );
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

  it('still serves a live requirement file when step 1 is sealed', async () => {
    service.findOne.mockResolvedValue({
      id: 'd1', fileName: 'birth_cert.pdf', category: 'requirement', caseId: 'c1', requirementKey: 'birth_cert',
      mimeType: 'application/pdf', originalName: 'birth_cert.pdf',
    });
    service.isPhotoAccessAllowed.mockReturnValue(true);
    stepLocks.isSealed.mockResolvedValue(true);
    service.ensureFileOnDisk.mockResolvedValue(true);
    service.diskPath.mockReturnValue('/uploads/birth_cert.pdf');
    const out = await controller.download('d1', adminReq, { set: jest.fn() } as any);
    // The read is served; only the write is withheld.
    expect(out).toBeInstanceOf(StreamableFile);
    expect(stepLocks.isSealed).toHaveBeenCalledWith('c1', 1);
    expect(service.ensureFileOnDisk).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', requirementKey: 'birth_cert' }),
      { heal: false },
    );
  });

  it('does not self-heal a sealed requirement document through a GET', async () => {
    service.findOne.mockResolvedValue({
      id: 'd1', fileName: 'birth_cert.pdf', category: 'requirement', caseId: 'c1', requirementKey: 'birth_cert',
    });
    service.isPhotoAccessAllowed.mockReturnValue(true);
    stepLocks.isSealed.mockResolvedValue(true);
    service.ensureFileOnDisk.mockResolvedValue(false);
    await expect(controller.download('d1', adminReq, { set: jest.fn() } as any))
      .rejects.toThrow('File not found on disk');
    expect(service.ensureFileOnDisk).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', requirementKey: 'birth_cert' }),
      { heal: false },
    );
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

/**
 * Step 1's seal reads `case_requirements`. Three filing routes write that table
 * — a staff requirement upload, a verification, and a delete that re-derives the
 * requirement from the remaining verified documents — and none of them asked
 * whether the step was sealed, so a seal could stand on data that changed under
 * it. The guard is the same `CaseStepLocksService.assertUnsealed` the cases
 * routes use, with the same step-1 mapping; a filing write that is not a
 * requirement (an IRF photo, an announcement photo) changes no sealed data and
 * is left alone.
 */
describe('FilingController — step-1 seal on requirement writes', () => {
  let controller: FilingController;
  let service: any;
  let stepLocks: { assertUnsealed: jest.Mock };

  const file = { originalname: 'id.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') };
  const sw = { user: { id: 'u1', role: 'social_worker' } };

  beforeEach(async () => {
    service = {
      upload: jest.fn().mockResolvedValue({ id: 'd1' }),
      setVerified: jest.fn().mockResolvedValue({ id: 'd1' }),
      delete: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      isPhotoAccessAllowed: jest.fn().mockReturnValue(true),
    };
    stepLocks = { assertUnsealed: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilingController],
      providers: [
        { provide: FilingService, useValue: service },
        { provide: CaseStepLocksService, useValue: stepLocks },
      ],
    }).compile();
    controller = module.get<FilingController>(FilingController);
  });

  it('checks step 1 before a requirement upload writes case_requirements', async () => {
    await controller.upload(file, { caseId: 'c1', requirementKey: 'Valid ID' }, sw);

    expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 1);
  });

  it('does not guard an upload that carries no requirement key', async () => {
    await controller.upload(file, { caseId: 'c1', category: 'irf_photo' }, sw);

    expect(stepLocks.assertUnsealed).not.toHaveBeenCalled();
  });

  it('checks step 1 before verifying a requirement document', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', caseId: 'c1', requirementKey: 'Valid ID' });

    await controller.verify('d1', { verified: true }, sw);

    expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 1);
  });

  it('does not guard verifying a document tied to no requirement', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', caseId: 'c1' });

    await controller.verify('d1', { verified: true }, sw);

    expect(stepLocks.assertUnsealed).not.toHaveBeenCalled();
  });

  it('checks step 1 before deleting a requirement document', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', caseId: 'c1', requirementKey: 'Valid ID' });

    await controller.delete('d1', sw);

    expect(stepLocks.assertUnsealed).toHaveBeenCalledWith('c1', 1);
  });

  it('does not write when the seal is up', async () => {
    service.findOne.mockResolvedValue({ id: 'd1', caseId: 'c1', requirementKey: 'Valid ID' });
    stepLocks.assertUnsealed.mockRejectedValue(new ConflictException('sealed'));

    await expect(controller.verify('d1', { verified: true }, sw)).rejects.toBeInstanceOf(ConflictException);

    expect(service.setVerified).not.toHaveBeenCalled();
  });
});