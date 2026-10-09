import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeneficiaryRemark, RemarkKind } from './dedup.entity';

/**
 * Append-only remark history per beneficiary (spec §3): the beneficiary view's
 * Remarks History card reads `list`, staff add `manual` entries, and the
 * deduplication operation writes `import` / `decision` / `barangay_update`
 * entries through `append` (Tasks 6–7).
 */
@Injectable()
export class BeneficiaryRemarksService {
  constructor(
    @InjectRepository(BeneficiaryRemark)
    private readonly repo: Repository<BeneficiaryRemark>,
  ) {}

  async list(beneficiaryId: string, page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({
      where: { beneficiaryId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async add(beneficiaryId: string, body: { remark: string }, actorId: string) {
    const remark = (body?.remark ?? '').trim();
    if (remark === '') throw new BadRequestException('A remark is required');
    return this.append({ beneficiaryId, kind: 'manual', remark, authoredBy: actorId });
  }

  async append(input: {
    beneficiaryId: string;
    operationId?: string;
    kind: RemarkKind;
    remark: string;
    source?: string;
    authoredBy?: string;
  }): Promise<BeneficiaryRemark> {
    return this.repo.save(this.repo.create({
      beneficiaryId: input.beneficiaryId,
      operationId: input.operationId,
      kind: input.kind,
      remark: input.remark,
      source: input.source,
      authoredBy: input.authoredBy,
    }));
  }
}