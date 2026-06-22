import { Test, TestingModule } from '@nestjs/testing';
import { IrfService } from './irf.service';
import { IrfCase, IrfDisposition } from './irf-case.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IrfKeyService } from './irf-key.service';
import { IrfAuditService } from './irf-audit.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('IrfService', () => {
  let service: IrfService;
  let repoMock: any;
  let keyServiceMock: any;
  let auditServiceMock: any;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
    };

    keyServiceMock = {
      generatePerRecordKey: jest.fn(),
      wrapKey: jest.fn(),
      getRecordKey: jest.fn(),
    };

    auditServiceMock = {
      logAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IrfService,
        { provide: getRepositoryToken(IrfCase), useValue: repoMock },
        { provide: IrfKeyService, useValue: keyServiceMock },
        { provide: IrfAuditService, useValue: auditServiceMock },
      ],
    }).compile();

    service = module.get<IrfService>(IrfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIrf — encryption via pgcrypto', () => {
    it('should encrypt narration via pgcrypto and return IRF with encrypted_narration', async () => {
      repoMock.create.mockReturnValue({ id: 'irf-1' });
      repoMock.save.mockResolvedValue({ id: 'irf-1', blotterEntryNumber: 'BLT-2026-0001' });
      keyServiceMock.generatePerRecordKey.mockResolvedValue('ab'.repeat(16));
      keyServiceMock.wrapKey.mockResolvedValue('d3d3LmV4YW1wbGUuY29t');
      repoMock.query.mockResolvedValueOnce([{ key_hex: 'ab'.repeat(16) }]);
      repoMock.query.mockResolvedValueOnce(undefined);

      const input = { caseCategory: 'Abuse' as any, narration: 'Victim statement' };
      const result = await service.create(input);

      expect(keyServiceMock.generatePerRecordKey).toHaveBeenCalled();
      expect(keyServiceMock.wrapKey).toHaveBeenCalled();
      expect(repoMock.query).toHaveBeenCalledWith(
        expect.stringContaining('encrypt('),
        expect.arrayContaining([expect.any(String)])
      );
      expect(result).toBeDefined();
    });
  });

  describe('findAll — name masking', () => {
    it('should return masked names in findAll', async () => {
      const rawRecords = [
        {
          id: '1',
          itemBPersonReported: { surname: 'Dela Cruz', firstName: 'Juan', middleName: 'Santos' },
          caseDisposition: IrfDisposition.UNDER_INVESTIGATION,
          createdAt: new Date(),
        },
      ];
      repoMock.find.mockResolvedValue(rawRecords);

      const result = await service.findAll();

      expect(result[0].itemBPersonReported.surname).toBe('[REDACTED]');
      expect(result[0].itemBPersonReported.firstName).toBe('[REDACTED]');
      expect(result[0].itemBPersonReported.middleName).toBe('Santos');
    });
  });

  describe('getDecryptedNarr — decryption with legal basis', () => {
    it('should return decrypted narration with legalBasis and accessedAt', async () => {
      repoMock.findOne.mockResolvedValue({
        id: '1',
        encryptedNarration: Buffer.from('some-encrypted-bytes'),
        keyWraps: [{ userId: 'master', encryptedKey: 'wrapped-key' }],
      });
      keyServiceMock.getRecordKey.mockResolvedValue('ab'.repeat(16));
      auditServiceMock.logAccess.mockResolvedValue(undefined);
      repoMock.query.mockResolvedValue([{ narration: 'Decrypted victim statement text' }]);

      const result = await service.getDecryptedNarr('1', 'AO-2020-002');

      expect(result.narration).toBe('Decrypted victim statement text');
      expect(result.legalBasis).toBe('AO-2020-002');
      expect(result.accessedAt).toBeInstanceOf(Date);
      expect(auditServiceMock.logAccess).toHaveBeenCalled();
    });

    it('should throw ForbiddenException without legalBasis', async () => {
      await expect(service.getDecryptedNarr('1', undefined))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('disposition FSM — dedicated endpoints', () => {
    it('should transition from UNDER_INVESTIGATION to REFERRED_TO_PNP via referToPnp', async () => {
      repoMock.findOne.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.UNDER_INVESTIGATION,
      });
      repoMock.save.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.REFERRED_TO_PNP,
      });

      const result = await service.referToPnp('1', 'admin');

      expect(result.caseDisposition).toBe(IrfDisposition.REFERRED_TO_PNP);
    });

    it('should dismiss with reason from UNDER_INVESTIGATION', async () => {
      repoMock.findOne.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.UNDER_INVESTIGATION,
      });
      repoMock.save.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.DISMISSED,
        dismissalReason: 'No sufficient evidence',
      });

      const result = await service.dismiss('1', 'No sufficient evidence', 'admin');

      expect(result.caseDisposition).toBe(IrfDisposition.DISMISSED);
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ dismissalReason: 'No sufficient evidence' })
      );
    });

    it('should close from REFERRED_TO_PNP to CLOSED', async () => {
      repoMock.findOne.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.REFERRED_TO_PNP,
      });
      repoMock.save.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.CLOSED,
      });

      const result = await service.close('1', 'admin');

      expect(result.caseDisposition).toBe(IrfDisposition.CLOSED);
    });

    it('should throw BadRequestException on invalid transition (close from UNDER_INVESTIGATION)', async () => {
      repoMock.findOne.mockResolvedValue({
        id: '1',
        caseDisposition: IrfDisposition.UNDER_INVESTIGATION,
      });

      await expect(service.close('1', 'admin'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
