import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilingService } from './filing.service';
import { DocumentVault } from './filing.entity';

describe('FilingService', () => {
  let service: FilingService;
  let docRepoMock: any;

  beforeEach(async () => {
    docRepoMock = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilingService,
        { provide: getRepositoryToken(DocumentVault), useValue: docRepoMock },
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
});
