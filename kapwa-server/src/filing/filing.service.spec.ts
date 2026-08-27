import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilingService } from './filing.service';
import { DocumentVault } from './filing.entity';
import { Case } from '../cases/case.entity';

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
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    caseRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: '1', controlNo: 'KAPWA-001' }),
      find: jest.fn().mockResolvedValue([]),
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
  });

  describe('findAll', () => {
    it('should return documents with filters', async () => {
      docRepoMock.find.mockResolvedValue([{ id: '1' }]);
      const result = await service.findAll('case-1');
      expect(result).toHaveLength(1);
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
});
