import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralStatus } from './referral.entity';
import type { CreateReferralInput, DeclineReferralInput } from './dto/referrals.zod';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private repo: Repository<Referral>,
  ) {}

  async create(dto: CreateReferralInput, coordinatorId: string, barangay: string): Promise<Referral> {
    const referral = this.repo.create({
      ...dto,
      dob: new Date(dto.dob).toISOString().split('T')[0],
      coordinatorId,
      barangay,
      status: ReferralStatus.PENDING,
    });
    return this.repo.save(referral);
  }

  async findAll(options?: { barangay?: string; status?: string }): Promise<Referral[]> {
    const qb = this.repo.createQueryBuilder('r')
      .leftJoinAndSelect('r.coordinator', 'u')
      .leftJoinAndSelect('r.case', 'c')
      .orderBy('r.created_at', 'DESC');

    if (options?.barangay) {
      qb.andWhere('r.barangay = :barangay', { barangay: options.barangay });
    }
    if (options?.status) {
      qb.andWhere('r.status = :status', { status: options.status });
    }

    return qb.getMany();
  }

  async findMine(userId: string): Promise<Referral[]> {
    return this.repo.find({
      where: { coordinatorId: userId },
      relations: ['case'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Referral> {
    const referral = await this.repo.findOne({
      where: { id },
      relations: ['coordinator', 'case'],
    });
    if (!referral) throw new NotFoundException('Referral not found');
    return referral;
  }

  async accept(id: string): Promise<Referral> {
    const referral = await this.findById(id);
    if (referral.status !== ReferralStatus.PENDING) {
      throw new ForbiddenException('Referral is not in pending status');
    }

    referral.status = ReferralStatus.ACCEPTED;
    return this.repo.save(referral);
  }

  async decline(id: string, dto: DeclineReferralInput): Promise<Referral> {
    const referral = await this.findById(id);
    if (referral.status !== ReferralStatus.PENDING) {
      throw new ForbiddenException('Referral is not in pending status');
    }

    referral.status = ReferralStatus.DECLINED;
    referral.declineReason = dto.reason;
    return this.repo.save(referral);
  }

  async countPending(barangay?: string): Promise<number> {
    const where: any = { status: ReferralStatus.PENDING };
    if (barangay) where.barangay = barangay;
    return this.repo.count({ where });
  }

  async countMine(userId: string): Promise<{ total: number; pending: number }> {
    const [total, pending] = await Promise.all([
      this.repo.count({ where: { coordinatorId: userId } }),
      this.repo.count({ where: { coordinatorId: userId, status: ReferralStatus.PENDING } }),
    ]);
    return { total, pending };
  }
}
