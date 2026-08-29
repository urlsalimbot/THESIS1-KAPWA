import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral, ReferralStatus } from './referral.entity';
import { Person } from '../beneficiaries/person.entity';
import type { CreateReferralInput, DeclineReferralInput } from './dto/referrals.zod';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private repo: Repository<Referral>,
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
  ) {}

  private async resolveOrCreatePerson(dto: CreateReferralInput): Promise<Person | undefined> {
    if (dto.personId) {
      const byId = await this.personRepo.findOne({ where: { id: dto.personId } });
      if (byId) return byId;
    }

    const hasIdentity = dto.surname && dto.firstName;
    if (hasIdentity) {
      const qb = this.personRepo.createQueryBuilder('p')
        .where('p.surname = :surname', { surname: dto.surname })
        .andWhere('p.first_name = :firstName', { firstName: dto.firstName });
      if (dto.dob) {
        const start = new Date(dto.dob);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        qb.andWhere('p.dob >= :s AND p.dob < :e', { s: start, e: end });
      }
      const matches = await qb.getMany();
      if (matches.length) return matches[0];
    }

    if (!hasIdentity || !dto.gender || !dto.dob) return undefined;

    const person = this.personRepo.create({
      surname: dto.surname,
      firstName: dto.firstName,
      middleName: dto.middleName,
      extension: dto.extension,
      gender: dto.gender as 'Male' | 'Female',
      dob: new Date(dto.dob),
    });
    if (dto.phone) {
      (person as any).contacts = [{
        personId: undefined, contactType: 'phone', value: dto.phone, isPrimary: true,
      }];
    }
    if (dto.address) {
      const raw = typeof dto.address === 'string'
        ? dto.address
        : Object.values(dto.address).filter(Boolean).join(', ');
      (person as any).addresses = [{
        personId: undefined, addressType: 'current', raw, isPrimary: true,
      }];
    }
    return this.personRepo.save(person);
  }

  async create(dto: CreateReferralInput, coordinatorId: string, barangay: string): Promise<Referral> {
    const person = await this.resolveOrCreatePerson(dto);
    const referral = this.repo.create({
      reason: dto.reason,
      coordinatorId,
      barangay,
      personId: person?.id,
      status: ReferralStatus.PENDING,
    });
    return this.repo.save(referral);
  }

  async findAll(options?: { barangay?: string; status?: string }): Promise<Referral[]> {
    const qb = this.repo.createQueryBuilder('r')
      .leftJoinAndSelect('r.coordinator', 'u')
      .leftJoinAndSelect('r.case', 'c')
      .leftJoinAndSelect('r.person', 'p')
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
      relations: ['case', 'person'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Referral> {
    const referral = await this.repo.findOne({
      where: { id },
      relations: ['coordinator', 'case', 'person'],
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
