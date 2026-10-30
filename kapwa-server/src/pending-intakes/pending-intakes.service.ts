import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PendingIntake } from './pending-intake.entity';

@Injectable()
export class PendingIntakesService {
  constructor(
    @InjectRepository(PendingIntake)
    private readonly repo: Repository<PendingIntake>,
  ) {}

  /** Called by public registration after the account is created. */
  async create(submittedByUserId: string, data: Record<string, any>): Promise<PendingIntake> {
    return this.repo.save(this.repo.create({ submittedByUserId, data, status: 'pending' }));
  }

  listPending(): Promise<PendingIntake[]> {
    return this.repo.find({ where: { status: 'pending' }, order: { createdAt: 'DESC' } });
  }

  async markProcessed(id: string, reviewedBy?: string): Promise<PendingIntake> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Pending intake not found');
    row.status = 'processed';
    row.reviewedBy = reviewedBy ?? null;
    row.reviewedAt = new Date();
    return this.repo.save(row);
  }

  async dismiss(id: string, reviewedBy?: string): Promise<PendingIntake> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Pending intake not found');
    row.status = 'dismissed';
    row.reviewedBy = reviewedBy ?? null;
    row.reviewedAt = new Date();
    return this.repo.save(row);
  }
}
