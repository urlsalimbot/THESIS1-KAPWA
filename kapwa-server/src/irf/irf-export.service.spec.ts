import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { IrfExportService } from './irf-export.service';
import { IrfService } from './irf.service';
import { IrfAuditService } from './irf-audit.service';
import { IrfCase } from './irf-case.entity';

describe('IrfExportService', () => {
  let service: IrfExportService;
  let irfServiceMock: any;
  let auditMock: any;
  let irfRepoMock: any;

  const sampleCaseData = {
    case: {
      blotterEntryNumber: 'BLT-2026-0001',
      caseCategory: 'Abuse',
      datetimeReported: new Date('2026-06-01'),
      datetimeIncident: new Date('2026-05-30'),
      caseDisposition: 'Under Investigation',
    },
    parties: {
      reportingPerson: { name: 'Jane Witness', surname: 'Witness' },
      personReported: { name: 'John Accused', surname: 'Accused' },
    },
    narration: 'This is the decrypted victim narration text for testing purposes.',
    signatures: {
      msdwSignatureUrl: 'https://example.com/msdw-sig.png',
      reportingSignatureUrl: 'https://example.com/report-sig.png',
    },
  };

  beforeEach(async () => {
    irfServiceMock = { exportWcpd: jest.fn() };
    auditMock = { logAccess: jest.fn() };
    irfRepoMock = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IrfExportService,
        { provide: getRepositoryToken(IrfCase), useValue: irfRepoMock },
        { provide: IrfService, useValue: irfServiceMock },
        { provide: IrfAuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get<IrfExportService>(IrfExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportPdf', () => {
    it('should return a Buffer when valid legalBasis is provided', async () => {
      irfServiceMock.exportWcpd.mockResolvedValue(sampleCaseData);

      const result = await service.exportPdf('irf-1', 'AO-2020-002', 'test123', 'user-1');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should call exportWcpd and logAccess during PDF export', async () => {
      irfServiceMock.exportWcpd.mockResolvedValue(sampleCaseData);

      await service.exportPdf('irf-1', 'AO-2020-002', 'test123', 'user-1');

      expect(irfServiceMock.exportWcpd).toHaveBeenCalledWith('irf-1', 'AO-2020-002');
      expect(auditMock.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          irfId: 'irf-1',
          action: 'EXPORT_PDF',
          legalBasis: 'AO-2020-002',
          format: 'pdf',
        })
      );
    });

    it('should throw ForbiddenException without legalBasis', async () => {
      await expect(
        service.exportPdf('irf-1', '', 'test123', 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when IRF not found', async () => {
      irfServiceMock.exportWcpd.mockResolvedValue(null);

      await expect(
        service.exportPdf('irf-999', 'AO-2020-002', 'test123', 'user-1')
      ).rejects.toThrow('IRF case not found');
    });
  });

  describe('exportJson', () => {
    it('should return structured JSON with format WCPD-EXPORT-v1', async () => {
      irfServiceMock.exportWcpd.mockResolvedValue(sampleCaseData);

      const result = await service.exportJson('irf-1', 'AO-2020-002', 'user-1') as any;

      expect(result).toBeDefined();
      expect(result.exportMetadata).toBeDefined();
      expect(result.exportMetadata.format).toBe('WCPD-EXPORT-v1');
      expect(result.case.blotterEntryNumber).toBe('BLT-2026-0001');
    });

    it('should log audit entry with EXPORT_JSON action', async () => {
      irfServiceMock.exportWcpd.mockResolvedValue(sampleCaseData);

      await service.exportJson('irf-1', 'AO-2020-002', 'user-1');

      expect(auditMock.logAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          irfId: 'irf-1',
          action: 'EXPORT_JSON',
          legalBasis: 'AO-2020-002',
          format: 'json',
        })
      );
    });

    it('should throw ForbiddenException without legalBasis', async () => {
      await expect(
        service.exportJson('irf-1', '', 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when IRF not found', async () => {
      irfServiceMock.exportWcpd.mockResolvedValue(null);

      await expect(
        service.exportJson('irf-999', 'AO-2020-002', 'user-1')
      ).rejects.toThrow('IRF case not found');
    });
  });
});
