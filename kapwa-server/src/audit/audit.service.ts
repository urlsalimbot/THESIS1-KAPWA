import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention } from '../interventions/intervention.entity';

@Injectable()
export class AuditService {
  constructor() {}

  async verifyHashChain(startId?: string): Promise<{ valid: boolean; brokenAt?: string }> {
    return { valid: true };
  }

  async getAuditLog(table: string, recordId: string, limit = 100) {
    return [];
  }

  async exportForCoa(startDate: Date, endDate: Date) {
    return {
      generatedAt: new Date(),
      period: { startDate, endDate },
      interventions: [],
      summary: { totalAmount: 0, count: 0 }
    };
  }
}