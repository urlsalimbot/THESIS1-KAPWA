import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import * as fs from 'fs';
import { FilingService } from './filing.service';
import { DocumentVault } from './filing.entity';
import { Case } from '../cases/case.entity';
import { DEFAULT_DOC_LIMIT } from '../common/constants';

describe('FilingService', () => {
  let service: FilingService;
  let docRepoMock: any;
  let caseRepoMock: any;

  beforeEach(async () => {
    docRepoMock = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([]),
    };
    caseRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: '1', controlNo: 'KAPWA-001' }),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilingService,
        { provide: getRepositoryToken(DocumentVault), useValue: docRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
      ],
    }).compile();

    service = module.get<FilingService>(FilingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should reject invalid file type', async () => {
      const file = { originalname: 'test.exe', mimetype: 'application/x-msdownload', size: 1000, buffer: Buffer.from('') };
      await expect(service.upload(file, {})).rejects.toThrow('Invalid file type');
    });

    it('should reject oversized file', async () => {
      const file = { originalname: 'test.pdf', mimetype: 'application/pdf', size: 20 * 1024 * 1024, buffer: Buffer.alloc(20 * 1024 * 1024) };
      await expect(service.upload(file, {})).rejects.toThrow('File too large');
    });

    it('should accept valid file', async () => {
      const file = { originalname: 'test.pdf', mimetype: 'application/pdf', size: 5000, buffer: Buffer.from('test') };
      docRepoMock.save.mockResolvedValue({ id: 'doc-1', originalName: 'test.pdf' });
      const result = await service.upload(file, { caseId: 'case-1' });
      expect(result).toHaveProperty('id', 'doc-1');
    });

    /**
     * The claimant ownership rule, pinned because the two routes once disagreed
     * about it: the list bound on `beneficiaries.user_id` while upload compared
     * `beneficiaries.person_id` to the caller's. A claimant whose account and
     * beneficiary profile are separate person records could therefore LIST their
     * case's documents and was refused with 403 uploading to the same case —
     * which is why a claimant-uploaded document could never exist.
     */
    it('lets a claimant upload to a case whose beneficiary their account owns', async () => {
      const file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 5000, buffer: Buffer.from('x') };
      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: 'ben-1' });
      docRepoMock.query.mockResolvedValue([{ id: 'ben-1' }]);
      docRepoMock.save.mockResolvedValue({ id: 'doc-1' });

      await expect(service.upload(file, { caseId: 'c1', category: 'claimant_upload', userRole: 'claimant', userId: 'u1' }))
        .resolves.toHaveProperty('id', 'doc-1');
      // Ownership comes from the shared helper's `beneficiaries.user_id` /
      // `beneficiary_claimants` query — never a person-id comparison.
      expect(docRepoMock.query).toHaveBeenCalledWith(expect.stringContaining('beneficiaries'), ['u1']);
    });

    it('refuses a claimant uploading to a case they do not own', async () => {
      const file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 5000, buffer: Buffer.from('x') };
      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: 'ben-someone-else' });
      docRepoMock.query.mockResolvedValue([{ id: 'ben-1' }]);

      await expect(service.upload(file, { caseId: 'c1', category: 'claimant_upload', userRole: 'claimant', userId: 'u1' }))
        .rejects.toThrow(/own case/);
    });

    it('refuses a claimant upload when the account owns no beneficiary', async () => {
      const file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 5000, buffer: Buffer.from('x') };
      caseRepoMock.findOne.mockResolvedValue({ id: 'c1', beneficiaryId: 'ben-1' });
      docRepoMock.query.mockResolvedValue([]);

      await expect(service.upload(file, { caseId: 'c1', category: 'claimant_upload', userRole: 'claimant', userId: 'u1' }))
        .rejects.toThrow(/own case/);
    });

    it('rejects a claimant tagging an announcement photo', async () => {
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 5000, buffer: Buffer.from('x') };
      await expect(service.upload(file, { category: 'announcement_photo', announcementId: 'ann-1', userRole: 'claimant' }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an announcement manager to tag an announcement photo', async () => {
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 5000, buffer: Buffer.from('x') };
      docRepoMock.save.mockResolvedValue({ id: 'doc-1' });
      await expect(service.upload(file, { category: 'announcement_photo', announcementId: 'ann-1', userRole: 'coordinator' }))
        .resolves.toBeDefined();
    });

    it('rejects a claimant tagging an IRF photo', async () => {
      const file = { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 5000, buffer: Buffer.from('x') };
      await expect(service.upload(file, { category: 'irf_photo', irfId: 'irf-1', userRole: 'claimant' }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return documents with filters', async () => {
      docRepoMock.find.mockResolvedValue([{ id: '1' }]);
      const result = await service.findAll('case-1');
      expect(result).toHaveLength(1);
    });

    it('excludes photo categories from unfiltered listing for non-admins', async () => {
      docRepoMock.find.mockResolvedValue([]);
      await service.findAll(undefined, undefined, 'social_worker');
      expect(docRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          category: Not(In(['irf_photo', 'announcement_photo'])),
        }),
        take: DEFAULT_DOC_LIMIT,
      }));
    });

    it('does not exclude photo categories for admins in unfiltered listing', async () => {
      docRepoMock.find.mockResolvedValue([]);
      await service.findAll(undefined, undefined, 'admin');
      const arg = docRepoMock.find.mock.calls[0][0];
      expect(arg.where.category).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return document by id', async () => {
      docRepoMock.findOne.mockResolvedValue({ id: '1' });
      const result = await service.findOne('1');
      expect(result).toEqual({ id: '1' });
    });

    it('should throw if not found', async () => {
      docRepoMock.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow('Document not found');
    });
  });

  describe('delete', () => {
    it('should delete document', async () => {
      docRepoMock.findOne.mockResolvedValue({ id: '1', fileName: 'test.pdf' });
      docRepoMock.delete.mockResolvedValue({ affected: 1 });
      const result = await service.delete('1');
      expect(result).toEqual({ affected: 1 });
    });
  });

  describe('setVerified', () => {
    it('persists verifiedAt/verifiedBy when verifying', async () => {
      docRepoMock.findOne.mockResolvedValue({ id: 'd1', caseId: 'c1' });
      const out = await service.setVerified('d1', true, 'u1');
      expect(docRepoMock.update).toHaveBeenCalledWith('d1', { verifiedAt: expect.any(Date), verifiedBy: 'u1' });
      expect(out.verifiedAt).toBeInstanceOf(Date);
    });

    it('clears verifiedAt/verifiedBy with nulls when verification is removed and recomputes the met flag', async () => {
      docRepoMock.findOne.mockResolvedValue({ id: 'd1', caseId: 'c1', requirementKey: 'birth_cert' });
      docRepoMock.query.mockResolvedValue([{ verified: false }]);
      const out = await service.setVerified('d1', false, 'u1');
      // TypeORM ignores `undefined` on save — a silent no-op that left the
      // columns set. Clearing must persist NULLs instead.
      expect(docRepoMock.update).toHaveBeenCalledWith('d1', { verifiedAt: null, verifiedBy: null });
      expect(out.verifiedAt).toBeUndefined();
      expect(out.verifiedBy).toBeUndefined();
      // case_requirements met flag re-derived to false for the requirement.
      expect(docRepoMock.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (case_id, requirement_key)'),
        ['c1', 'birth_cert', false],
      );
    });
  });

  describe('stale disk-file self-healing', () => {
    let existsSpy: jest.SpyInstance;

    afterEach(() => {
      existsSpy?.mockRestore();
    });

    it('ensureFileOnDisk returns true for a live file and keeps the row', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const doc = { id: 'd1', fileName: 'coe.pdf', category: 'approval_document', caseId: 'c1' };
      await expect(service.ensureFileOnDisk(doc as DocumentVault)).resolves.toBe(true);
      expect(docRepoMock.delete).not.toHaveBeenCalled();
      expect(caseRepoMock.query).not.toHaveBeenCalled();
    });

    it('deletes the stale approval_document row and clears the case URL that pointed at it', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const doc = { id: 'd1', fileName: 'coe.pdf', category: 'approval_document', caseId: 'c1' };
      await expect(service.ensureFileOnDisk(doc as DocumentVault)).resolves.toBe(false);
      expect(docRepoMock.delete).toHaveBeenCalledWith('d1');
      expect(caseRepoMock.query).toHaveBeenCalledWith(
        expect.stringContaining('certificate_url'),
        ['c1', '/filing/d1/download'],
      );
    });

    it('deletes stale non-approval rows without touching case URLs', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const doc = { id: 'd2', fileName: 'req.pdf', category: 'requirement', caseId: 'c1' };
      await expect(service.ensureFileOnDisk(doc as DocumentVault)).resolves.toBe(false);
      expect(docRepoMock.delete).toHaveBeenCalledWith('d2');
      expect(caseRepoMock.query).not.toHaveBeenCalled();
    });

    it('skips the heal entirely when asked, so a sealed step-1 read moves nothing', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const doc = { id: 'd3', fileName: 'birth_cert.pdf', category: 'requirement', caseId: 'c1', requirementKey: 'birth_cert' };
      await expect(service.ensureFileOnDisk(doc as DocumentVault, { heal: false })).resolves.toBe(false);
      // The whole point: the row survives, so `case_requirements` is never
      // re-derived and no case URL is cleared through the read.
      expect(docRepoMock.delete).not.toHaveBeenCalled();
      expect(docRepoMock.query).not.toHaveBeenCalled();
      expect(caseRepoMock.query).not.toHaveBeenCalled();
    });

    it('still serves a live file when the heal is blocked', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const doc = { id: 'd4', fileName: 'birth_cert.pdf', category: 'requirement', caseId: 'c1', requirementKey: 'birth_cert' };
      await expect(service.ensureFileOnDisk(doc as DocumentVault, { heal: false })).resolves.toBe(true);
      expect(docRepoMock.delete).not.toHaveBeenCalled();
    });

    it('urlFileLive only trusts a stored /filing/:id/download URL whose file is on disk', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      docRepoMock.findOne.mockResolvedValue({ id: 'doc-x', fileName: 'a.pdf', category: 'approval_document', caseId: 'c1' });
      await expect(service.urlFileLive('/filing/doc-x/download')).resolves.toBe(true);
      expect(docRepoMock.delete).not.toHaveBeenCalled();
    });

    it('urlFileLive reports a dead URL when the row is gone, the file is missing, or the URL is foreign', async () => {
      existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      docRepoMock.findOne.mockResolvedValue({ id: 'doc-x', fileName: 'a.pdf', caseId: 'c1' });
      await expect(service.urlFileLive('/filing/doc-x/download')).resolves.toBe(false);
      expect(docRepoMock.delete).toHaveBeenCalledWith('doc-x');
      docRepoMock.findOne.mockResolvedValue(null);
      await expect(service.urlFileLive('/filing/ghost/download')).resolves.toBe(false);
      await expect(service.urlFileLive('https://cdn.example/coe.pdf')).resolves.toBe(false);
    });
  });

  describe('photo access gating', () => {
    it('allows admins for irf_photo', () => {
      expect(service.isPhotoAccessAllowed('admin', 'irf_photo')).toBe(true);
    });
    it('denies non-admins for irf_photo', () => {
      expect(service.isPhotoAccessAllowed('social_worker', 'irf_photo')).toBe(false);
    });
    it('allows manage roles for announcement_photo', () => {
      expect(service.isPhotoAccessAllowed('social_worker', 'announcement_photo')).toBe(true);
    });
    it('allows only admins for other document categories', () => {
      expect(service.isPhotoAccessAllowed('coordinator', 'case_document', 'delete')).toBe(false);
      expect(service.isPhotoAccessAllowed('admin', 'case_document', 'delete')).toBe(true);
    });
  });

  describe('photo queries', () => {
    it('finds IRF photos by irfId ordered by created_at', async () => {
      (docRepoMock.find as jest.Mock).mockResolvedValue([{ id: 'p1' }]);
      const rows = await service.findPhotosByIrf('irf-1');
      expect(docRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { category: 'irf_photo', irfId: 'irf-1' },
        order: { createdAt: 'ASC' },
      }));
      expect(rows).toHaveLength(1);
    });

    it('finds announcement photos by announcementId ordered by created_at', async () => {
      (docRepoMock.find as jest.Mock).mockResolvedValue([]);
      await service.findPhotosByAnnouncement('ann-1');
      expect(docRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { category: 'announcement_photo', announcementId: 'ann-1' },
        order: { createdAt: 'ASC' },
      }));
    });

    it('findOneByCategory returns the doc only when the category matches', async () => {
      (docRepoMock.findOne as jest.Mock).mockResolvedValue({ id: 'p1', category: 'announcement_photo' });
      const doc = await service.findOneByCategory('p1', 'announcement_photo');
      expect(doc.id).toBe('p1');
    });

    it('findOneByCategory throws NotFound when category mismatches', async () => {
      (docRepoMock.findOne as jest.Mock).mockResolvedValue({ id: 'p1', category: 'irf_photo' });
      await expect(service.findOneByCategory('p1', 'announcement_photo')).rejects.toThrow('File not found');
    });
  });

  describe('id_photo + coordinator case-access gate', () => {
    it('findIdPhotoByCase returns the latest id_photo for a case', async () => {
      const rows = [{ id: 'f2', category: 'id_photo', caseId: 'c1', createdAt: new Date() }];
      (docRepoMock.find as jest.Mock).mockResolvedValue(rows);
      const out = await service.findIdPhotoByCase('c1');
      expect(docRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { category: 'id_photo', caseId: 'c1' },
        order: { createdAt: 'DESC' },
        take: 1,
      }));
      expect(out?.id).toBe('f2');
    });

    it('findIdPhotoByCase returns null when none', async () => {
      (docRepoMock.find as jest.Mock).mockResolvedValue([]);
      const out = await service.findIdPhotoByCase('c1');
      expect(out).toBeNull();
    });

    it('isPhotoAccessAllowed denies coordinator for generic case docs and id_photo', () => {
      expect(service.isPhotoAccessAllowed('coordinator', 'id_photo')).toBe(false);
      expect(service.isPhotoAccessAllowed('coordinator', null)).toBe(false);
      expect(service.isPhotoAccessAllowed('coordinator', null, 'delete')).toBe(false);
    });

    it('isPhotoAccessAllowed keeps coordinator for announcement_photo', () => {
      expect(service.isPhotoAccessAllowed('coordinator', 'announcement_photo')).toBe(true);
      expect(service.isPhotoAccessAllowed('coordinator', 'announcement_photo', 'delete')).toBe(true);
    });

    it('isPhotoAccessAllowed still allows admin and social_worker for case docs', () => {
      expect(service.isPhotoAccessAllowed('admin', null)).toBe(true);
      expect(service.isPhotoAccessAllowed('social_worker', 'id_photo')).toBe(true);
    });

    it('findAll scopes coordinators to announcement_photo rows', async () => {
      docRepoMock.find.mockResolvedValue([]);
      await service.findAll(undefined, undefined, 'coordinator');
      expect(docRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ category: 'announcement_photo' }),
        take: DEFAULT_DOC_LIMIT,
      }));
    });
  });

  describe('findByCaseAndRequirement', () => {
    it('scopes coordinators to announcement_photo rows', async () => {
      docRepoMock.find.mockResolvedValue([]);
      await service.findByCaseAndRequirement('case-1', 'req-1', 'coordinator');
      expect(docRepoMock.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ caseId: 'case-1', category: 'announcement_photo' }),
      }));
    });
  });

  describe('id_photo claimant privacy', () => {
    it('denies claimants id_photo access', () => {
      expect(service.isPhotoAccessAllowed('claimant', 'id_photo')).toBe(false);
    });

    it('allows admins and social workers id_photo access', () => {
      expect(service.isPhotoAccessAllowed('admin', 'id_photo')).toBe(true);
      expect(service.isPhotoAccessAllowed('social_worker', 'id_photo')).toBe(true);
    });
  });
});
