import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentLedger } from '../../beneficiaries/consent-ledger.entity';

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    @InjectRepository(ConsentLedger)
    private readonly consentRepo: Repository<ConsentLedger>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, params, body } = request;

    if (!user) return false;
    if (user.role === 'admin' || user.role === 'auditor') return true;

    const beneficiaryId = params?.beneficiaryId || params?.id || body?.beneficiaryId;
    if (!beneficiaryId) return true; // No beneficiary context = no consent check needed

    const consent = await this.consentRepo.findOne({
      where: { beneficiaryId, status: 'active' },
    });

    if (!consent) {
      throw new ForbiddenException('Beneficiary consent has been revoked or not granted');
    }

    return true;
  }
}
