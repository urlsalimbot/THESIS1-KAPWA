import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from, isObservable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentLedger } from './consent-ledger.entity';

const PII_FIELDS = ['surname', 'firstName', 'middleName', 'address', 'phone', 'dob', 'philsysNumber'];

@Injectable()
export class PiiMaskingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      switchMap((data) => {
        if (!data) return from([data]);
        if (Array.isArray(data)) {
          return from(this.maskArray(data));
        }
        return from(this.maskSingle(data));
      }),
    );
  }

  private async maskArray(items: any[]): Promise<any[]> {
    if (items.length === 0) return items;
    const ids = items.filter((i: any) => i?.id).map((i: any) => i.id);
    if (ids.length === 0) return items;
    const revoked = await this.consentRepo.find({
      where: { beneficiaryId: ids.length === 1 ? (ids[0] as any) : (ids as any), status: 'revoked' },
    });
    const revokedIds = new Set(revoked.map(r => r.beneficiaryId));
    return items.map(item => {
      if (item?.id && revokedIds.has(item.id)) {
        return this.applyMask(item);
      }
      return item;
    });
  }

  private async maskSingle(data: any): Promise<any> {
    if (!data?.id) return data;
    const consent = await this.consentRepo.findOne({
      where: { beneficiaryId: data.id, status: 'revoked' },
    });
    if (consent) {
      return this.applyMask({ ...data });
    }
    return data;
  }

  private applyMask(data: any): any {
    const masked = { ...data };
    for (const field of PII_FIELDS) {
      if (field in masked) masked[field] = null;
    }
    return masked;
  }
}
