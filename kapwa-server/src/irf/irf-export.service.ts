import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrfCase } from './irf-case.entity';
import { IrfService } from './irf.service';
import { IrfAuditService } from './irf-audit.service';
import { AgenciesService } from '../agencies/agencies.service';
import { buildIrfPdf } from './irf-pdf.builder';

@Injectable()
export class IrfExportService {
  private readonly logger = new Logger(IrfExportService.name);

  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
    private irfService: IrfService,
    private irfAuditService: IrfAuditService,
    private agenciesService: AgenciesService,
  ) {}

  private async agencyLabel(): Promise<string> {
    const mswdo = await this.agenciesService.findByCode('MSWDO');
    return mswdo?.name || 'Municipal Social Welfare and Development Office';
  }

  async exportPdf(id: string, legalBasis: string, password: string, userId: string): Promise<Buffer> {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');

    // Audit before export (audit-first pattern)
    await this.irfAuditService.logAccess({
      irfId: id,
      userId,
      action: 'EXPORT_PDF',
      legalBasis,
      format: 'pdf',
    });

    return this.buildIrfPdfBuffer(id, { password, legalBasis, userId });
  }

  // Renders the IRF PDF. Encrypted only when `password` is supplied — the CSR
  // bundle embeds the unencrypted form and is itself a gated admin export.
  async buildIrfPdfBuffer(
    id: string,
    opts: { password?: string; userId?: string; legalBasis?: string } = {},
  ): Promise<Buffer> {
    const legalBasis = opts.legalBasis || 'RA 9262';
    const agencyName = await this.agencyLabel();

    const irfData = await this.irfService.exportWcpd(id, legalBasis);
    if (!irfData) throw new NotFoundException('IRF case not found');

    // Exact reproduction of the MSWDO Norzagaray Incident Report Form (Blotter).
    const buffer = await buildIrfPdf(
      {
        blotterEntryNumber: irfData.case?.blotterEntryNumber || '',
        caseCategory: irfData.case?.caseCategory || '',
        datetimeReported: irfData.case?.datetimeReported,
        datetimeIncident: irfData.case?.datetimeIncident,
        reportingPerson: irfData.parties?.reportingPerson,
        personReported: irfData.parties?.personReported,
        narration: irfData.narration,
        reportingSignatureUrl: irfData.signatures?.reportingSignatureUrl,
        msdwSignatureUrl: irfData.signatures?.msdwSignatureUrl,
        caseDisposition: irfData.case?.caseDisposition,
        dismissalReason: irfData.case?.dismissalReason,
        officeName: agencyName,
        legalBasis,
        generatedAt: new Date(),
      },
      { password: opts.password, ownerPassword: process.env.PDF_OWNER_PW },
    );

    this.logger.log(`PDF export complete: IRF ${id}, ${buffer.length} bytes`);
    return buffer;
  }

  async exportJson(id: string, legalBasis: string, userId: string): Promise<object> {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');

    const irfData = await this.irfService.exportWcpd(id, legalBasis);
    if (!irfData) throw new NotFoundException('IRF case not found');

    // Audit before returning data
    await this.irfAuditService.logAccess({
      irfId: id,
      userId,
      action: 'EXPORT_JSON',
      legalBasis,
      format: 'json',
    });

    const agencyName = await this.agencyLabel();

    return {
      exportMetadata: {
        format: 'WCPD-EXPORT-v1',
        generatedAt: new Date().toISOString(),
        legalBasis,
        agency: agencyName,
        encrypted: false,
      },
      case: irfData.case,
      parties: irfData.parties,
      narration: irfData.narration,
      signatures: irfData.signatures,
    };
  }

  // IRF case number for export filenames (`IRF ${blotterEntryNumber}-${date}.pdf`).
  async controlNo(irfId: string): Promise<string> {
    const irf = await this.irfRepo.findOne({ where: { id: irfId } });
    if (!irf) throw new NotFoundException('IRF not found');
    return irf.blotterEntryNumber || irfId;
  }
}
