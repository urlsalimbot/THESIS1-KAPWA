import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { loadGisData } from './gis-export.loader';
import { buildGisPdf } from './gis-pdf.builder';

@Injectable()
export class GisExportService {
  private readonly logger = new Logger(GisExportService.name);

  constructor(
    @InjectRepository(Case) private readonly caseRepo: Repository<Case>,
    @InjectRepository(BeneficiaryClaimant) private readonly claimantRepo: Repository<BeneficiaryClaimant>,
    @InjectRepository(CaseIntervention) private readonly interventionRepo: Repository<CaseIntervention>,
  ) {}

  async generateGisPdf(caseId: string): Promise<Buffer> {
    const data = await loadGisData(
      { caseRepo: this.caseRepo, claimantRepo: this.claimantRepo, interventionRepo: this.interventionRepo },
      caseId,
    );
    const pdf = await buildGisPdf(data);
    this.logger.warn(`GIS export: case ${caseId} (${data.controlNo}), ${pdf.length} bytes`);
    return pdf;
  }

  // Case number for export filenames (`${CaseType} ${controlNo}-${date}.pdf`).
  async controlNo(caseId: string): Promise<string> {
    const c = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found');
    return c.controlNo || caseId;
  }
}
