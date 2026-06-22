import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention, InterventionType, FundSource, SignatureStatus } from './intervention.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { MinioService } from '../minio/minio.service';
import { TrackerService } from '../tracker/tracker.service';

const DUPLICATE_WINDOW_DAYS = 30;
@Injectable()
export class InterventionsService {
  constructor(
    @InjectRepository(Intervention)
    private interventionRepo: Repository<Intervention>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    private minioService: MinioService,
    private trackerService: TrackerService,
  ) {}

  async create(data: Partial<Intervention>, userId: string) {
    const caseId = data.caseId;
    if (!caseId) throw new NotFoundException('Case required');

    const caseEntity = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    if (caseEntity.status !== CaseStatus.DISBURSED) {
      throw new BadRequestException('Case must be disbursed first');
    }

    const beneficiary = await this.caseRepo.query(
      'SELECT access_card_code FROM beneficiaries WHERE id = $1',
      [caseEntity.beneficiaryId],
    );
    if (!beneficiary?.[0]?.access_card_code) {
      throw new BadRequestException('Beneficiary has no Access Card — No Card, No Voucher');
    }

    const duplicateCheck = await this.interventionRepo.query(
      `SELECT COUNT(*)::int AS cnt FROM interventions i
       JOIN cases c ON c.id = i.case_id
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       JOIN households h ON h.primary_beneficiary_id = b.id
       WHERE h.primary_beneficiary_id = (SELECT beneficiary_id FROM cases WHERE id = $1)
         AND i.intervention_type = $2
         AND i.service_date >= CURRENT_DATE - INTERVAL '${DUPLICATE_WINDOW_DAYS} days'`,
      [caseId, data.interventionType],
    );
    if ((duplicateCheck?.[0]?.cnt || 0) > 0) {
      throw new ConflictException('Duplicate intervention detected — same type within 30 days for this household');
    }

    // D-15: Deferrable signature check — if workerSignatureUrl missing, set signatures_pending
    let signatureStatus = data.signatureStatus as SignatureStatus | undefined;
    if (!data.workerSignatureUrl && !signatureStatus) {
      signatureStatus = SignatureStatus.PENDING;
    } else if (data.workerSignatureUrl && !signatureStatus) {
      signatureStatus = SignatureStatus.COLLECTED;
    }

    // Populate denormalized household_id for exclusion constraint
    let householdId = data.householdId as string | undefined;
    if (!householdId) {
      const result = await this.interventionRepo.query(
        `SELECT h.id FROM households h
         JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
         JOIN cases c ON c.beneficiary_id = b.id
         WHERE c.id = $1`,
        [caseId],
      );
      householdId = result?.[0]?.id || undefined;
    }

    const prevInt = await this.interventionRepo.findOne({
      where: { caseId },
      order: { loggedAt: 'DESC' },
    });
    const prevHash = prevInt?.hash || 'GENESIS';
    const int = this.interventionRepo.create({
      interventionType: data.interventionType || InterventionType.FA,
      amount: data.amount || 0,
      fundSource: data.fundSource || FundSource.REGULAR,
      serviceDate: data.serviceDate || new Date(),
      workerSignatureUrl: data.workerSignatureUrl || '',
      clientSignatureUrl: data.clientSignatureUrl as string | undefined,
      clientReceiptUrl: data.clientReceiptUrl as string | undefined,
      signatureStatus: signatureStatus || SignatureStatus.PENDING,
      householdId,
      loggedById: userId,
      caseId,
      prevHash,
    });
    int.hash = crypto.createHash('sha256').update(`${int.id || ''}:${int.interventionType}:${int.amount}:${int.prevHash}`).digest('hex');
    const saved = await this.interventionRepo.save(int);
    if (!saved || !saved.id) {
      throw new InternalServerErrorException('Failed to save intervention — no ID returned');
    }

    // Auto-create Case Tracker Log entry
    try {
      const beneficiaryInfo = await this.interventionRepo.query(
        `SELECT b.surname, b.first_name, b.middle_name, b.gender,
                b.barangay, b.category AS client_category,
                CASE
                  WHEN EXTRACT(YEAR FROM AGE(b.dob)) < 18 THEN '0-17'
                  WHEN EXTRACT(YEAR FROM AGE(b.dob)) > 59 THEN '60+'
                  ELSE '18-59'
                END AS age_range
         FROM beneficiaries b
         JOIN cases c ON c.beneficiary_id = b.id
         WHERE c.id = $1`, [caseId]
      );
      const info = beneficiaryInfo?.[0];
      if (info) {
        await this.trackerService.createEntry({
          transactionDate: new Date(),
          surname: info.surname,
          firstName: info.first_name,
          middleName: info.middle_name,
          gender: info.gender,
          ageRange: info.age_range,
          clientCategory: info.client_category,
          barangay: info.barangay,
          interventionRemarks: `${data.interventionType || ''} - ${data.amount || 0}`,
        } as any);
      }
    } catch (err) {
      // Non-blocking: tracker log creation failure should not fail the intervention
      console.error('Failed to auto-create tracker entry:', err);
    }

    return saved;
  }

  async uploadSignature(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    return this.minioService.uploadFile('worker-signatures', fileName, fileBuffer, mimeType);
  }

  async uploadReceipt(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    return this.minioService.uploadFile('client-receipts', fileName, fileBuffer, mimeType);
  }

  async getChain(caseId: string) {
    return this.interventionRepo.find({
      where: { caseId },
      order: { loggedAt: 'ASC' },
      select: ['id', 'hash', 'prevHash', 'loggedAt', 'interventionType', 'amount'],
    });
  }

  async findByCase(caseId: string) {
    return this.interventionRepo.find({ where: { caseId }, take: DEFAULT_LIST_LIMIT });
  }

  async findAll() {
    return this.interventionRepo.find({ take: DEFAULT_LIST_LIMIT });
  }

  async findById(id: string) {
    const int = await this.interventionRepo.findOne({ where: { id } });
    if (!int) throw new NotFoundException('Intervention not found');
    return int;
  }
}
