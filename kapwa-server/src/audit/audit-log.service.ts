import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private dataSource: DataSource) {}

  async log(
    action: string,
    referenceId: string,
    userId?: string | null,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_log (action, reference_id, user_id, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [action, referenceId, userId ?? null, details ? JSON.stringify(details) : null],
      );
    } catch (err) {
      this.logger.warn(`Audit log insert failed (non-blocking): ${err}`);
    }
  }
}