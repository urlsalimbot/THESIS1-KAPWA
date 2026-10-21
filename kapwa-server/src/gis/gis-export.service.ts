import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { OrgService } from '../common/org.service';
import { loadGisData } from './gis-export.loader';
import { buildGisPdf } from './gis-pdf.builder';
import { buildMunicipalGisPdf } from './gis-municipal-pdf.builder';

/** GIS variations: the national DSWD sheet and the MSWDO municipal sheet. */
export type GisForm = 'national' | 'municipal';

/**
 * Statuses at which a printable case document may be produced: the case must be,
 * or must have been, active. Before activation there is no approved service plan
 * to print; after it the sheet and the case study report are history and stay
 * printable (closing and aftercare are exactly when they get reprinted).
 */
export const PRINTABLE_CASE_STATUSES: readonly CaseStatus[] = [
  CaseStatus.ACTIVE,
  CaseStatus.TRANSITIONING,
  CaseStatus.CLOSED,
  CaseStatus.AFTERCARE,
];

@Injectable()
export class GisExportService {
  private readonly logger = new Logger(GisExportService.name);

  constructor(
    @InjectRepository(Case) private readonly caseRepo: Repository<Case>,
    @InjectRepository(BeneficiaryClaimant) private readonly claimantRepo: Repository<BeneficiaryClaimant>,
    @InjectRepository(CaseIntervention) private readonly interventionRepo: Repository<CaseIntervention>,
    private readonly org: OrgService,
  ) {}

  async generateGisPdf(caseId: string, form: GisForm = 'national'): Promise<Buffer> {
    // The General Intake Sheet is the print of an APPROVED case: its header
    // carries the case number and the service plan the office signed off on, yet
    // it was downloadable from intake onward. Gated here rather than only in the
    // UI, so a direct link or a stale tab cannot print a case still under review.
    const c = await this.caseRepo.findOne({ where: { id: caseId }, select: ['id', 'status'] });
    if (!c) throw new NotFoundException('Case not found');
    if (!PRINTABLE_CASE_STATUSES.includes(c.status)) {
      throw new ConflictException(
        `The General Intake Sheet can only be printed once the case has been activated (this case is ${c.status}).`,
      );
    }
    const data = await loadGisData(
      { caseRepo: this.caseRepo, claimantRepo: this.claimantRepo, interventionRepo: this.interventionRepo },
      caseId,
    );
    data.officeName = await this.org.officeName();
    const pdf = form === 'municipal' ? await buildMunicipalGisPdf(data) : await buildGisPdf(data);
    this.logger.warn(
      `GIS export (${form}): case ${caseId} (${data.controlNo}), ${pdf.length} bytes`,
    );
    return pdf;
  }

  // Case number for export filenames (`${CaseType} ${controlNo}-${date}.pdf`).
  async controlNo(caseId: string): Promise<string> {
    const c = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found');
    return c.controlNo || caseId;
  }
}
