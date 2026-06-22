import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrfCase } from './irf-case.entity';

@Injectable()
export class IrfAuditService {
  private readonly logger = new Logger(IrfAuditService.name);

  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
  ) {}

  async logAccess(params: {
    irfId: string;
    userId: string;
    action: 'DECRYPT' | 'UNMASK_NAME' | 'EXPORT_PDF' | 'EXPORT_JSON' | 'DISPOSITION_OVERRIDE';
    legalBasis: string;
    format?: string;
  }) {
    try {
      await this.irfRepo.query(
        `INSERT INTO audit_log (action, reference_id, user_id, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          `IRF_${params.action}`,
          params.irfId,
          params.userId,
          JSON.stringify({ legalBasis: params.legalBasis, format: params.format }),
        ]
      );
      this.logger.log(`IRF AUDIT: action=${params.action} irfId=${params.irfId} userId=${params.userId}`);
    } catch (err) {
      this.logger.warn(`Audit log insert failed (non-blocking): ${err}`);
    }
  }
}
