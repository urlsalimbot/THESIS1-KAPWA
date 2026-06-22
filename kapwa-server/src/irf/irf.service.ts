import { Logger, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrfCase, IrfDisposition } from './irf-case.entity';
import { CreateIrfInput } from './dto/irf.zod';
import { IrfKeyService } from './irf-key.service';
import { IrfAuditService } from './irf-audit.service';

const BLOTTER_PAD_WIDTH = 4;

const DISPOSITION_TRANSITIONS: Record<IrfDisposition, IrfDisposition[]> = {
  [IrfDisposition.UNDER_INVESTIGATION]: [
    IrfDisposition.REFERRED_TO_PNP,
    IrfDisposition.REFERRED_TO_WCPD,
    IrfDisposition.DISMISSED,
  ],
  [IrfDisposition.REFERRED_TO_PNP]: [IrfDisposition.CLOSED],
  [IrfDisposition.REFERRED_TO_WCPD]: [IrfDisposition.CLOSED],
  [IrfDisposition.DISMISSED]: [IrfDisposition.CLOSED],
  [IrfDisposition.CLOSED]: [],
};

@Injectable()
export class IrfService {
  private readonly logger = new Logger(IrfService.name);

  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
    private irfKeyService: IrfKeyService,
    private irfAuditService: IrfAuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Encryption — pgcrypto based
  // ---------------------------------------------------------------------------

  async encryptWithPgcrypto(narration: string, irfId: string): Promise<void> {
    const recordKeyHex = await this.irfKeyService.generatePerRecordKey();
    const wrappedKey = await this.irfKeyService.wrapKey(recordKeyHex);

    await this.irfRepo.query(
      `UPDATE irf_cases SET
         encrypted_narration = encrypt(
           convert_to($1, 'UTF8'),
           decode($2, 'hex'),
           'aes-256-cbc/pad:pkcs'
         ),
         key_wraps = $3::jsonb,
         key_version = COALESCE(key_version, 0) + 1
       WHERE id = $4`,
      [narration, recordKeyHex, JSON.stringify([{ userId: 'master', encryptedKey: wrappedKey }]), irfId]
    );
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(data: CreateIrfInput) {
    const blotterNo = await this.generateBlotterNumber();
    const { narration, ...irfData } = data;

    const createData: Record<string, unknown> = {
      blotterEntryNumber: blotterNo,
      caseCategory: irfData.caseCategory,
      datetimeReported: irfData.datetimeReported || new Date(),
      datetimeIncident: irfData.datetimeIncident,
      itemAReportingPerson: irfData.itemAReportingPerson,
      itemBPersonReported: irfData.itemBPersonReported,
      caseDisposition: IrfDisposition.UNDER_INVESTIGATION,
      msdwSignatureUrl: irfData.msdwSignatureUrl,
      reportingSignatureUrl: irfData.reportingSignatureUrl,
    };

    const irf = this.irfRepo.create(createData as any);
    const [saved] = await this.irfRepo.save(irf as any);

    if (narration) {
      await this.encryptWithPgcrypto(narration, saved.id);
    }

    return this.findById(saved.id);
  }

  async findAll() {
    const items = await this.irfRepo.find({ order: { createdAt: 'DESC' }, take: 100 });
    return items.map(i => ({
      ...i,
      encryptedNarration: undefined,
      itemBPersonReported: i.itemBPersonReported
        ? { ...i.itemBPersonReported, surname: '[REDACTED]', firstName: '[REDACTED]' }
        : null,
      itemAReportingPerson: i.itemAReportingPerson
        ? { ...i.itemAReportingPerson, surname: '[REDACTED]', firstName: '[REDACTED]' }
        : null,
    }));
  }

  async findById(id: string) {
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');
    const { encryptedNarration, ...safe } = irf;
    return {
      ...safe,
      encryptedNarration: irf.encryptedNarration ? true : false,
      itemBPersonReported: irf.itemBPersonReported
        ? { ...irf.itemBPersonReported, surname: '[REDACTED]', firstName: '[REDACTED]' }
        : null,
      itemAReportingPerson: irf.itemAReportingPerson
        ? { ...irf.itemAReportingPerson, surname: '[REDACTED]', firstName: '[REDACTED]' }
        : null,
    };
  }

  async updateNarration(id: string, narration: string) {
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');
    await this.encryptWithPgcrypto(narration, id);
    this.logger.log(`IRF NARRATION UPDATE: id=${id}, updatedAt=${new Date().toISOString()}`);
    return { id, narrationUpdated: true };
  }

  // ---------------------------------------------------------------------------
  // Decryption with legal basis audit
  // ---------------------------------------------------------------------------

  async getDecryptedNarr(id: string, legalBasis?: string): Promise<{ narration: string | null; legalBasis?: string; accessedAt?: Date }> {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');

    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');
    if (!irf.encryptedNarration) return { narration: null };

    // Audit BEFORE decrypt (audit-first pattern)
    await this.irfAuditService.logAccess({
      irfId: id,
      userId: 'system',
      action: 'DECRYPT',
      legalBasis,
    });

    const recordKeyHex = await this.irfKeyService.getRecordKey(id);

    const result = await this.irfRepo.query(
      `SELECT convert_from(
         decrypt(encrypted_narration, decode($1, 'hex'), 'aes-256-cbc/pad:pkcs'),
         'UTF8'
       ) AS narration
       FROM irf_cases WHERE id = $2`,
      [recordKeyHex, id]
    );

    return {
      narration: result[0]?.narration || null,
      legalBasis,
      accessedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Name masking — application-layer
  // ---------------------------------------------------------------------------

  async unmaskNames(id: string, legalBasis: string, userId: string) {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');

    await this.irfAuditService.logAccess({
      irfId: id,
      userId,
      action: 'UNMASK_NAME',
      legalBasis,
    });

    const irf = await this.findById(id);
    // Return full unmasked data by querying the raw record directly
    const raw = await this.irfRepo.findOne({ where: { id } });
    return {
      itemAPersonReported: raw?.itemAReportingPerson || null,
      itemBPersonReported: raw?.itemBPersonReported || null,
    };
  }

  // ---------------------------------------------------------------------------
  // WCPD Export (unchanged — enhanced in Plan 05-04)
  // ---------------------------------------------------------------------------

  async exportWcpd(id: string, legalBasis: string) {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');

    let narration: string | null = null;
    if (irf.encryptedNarration) {
      try {
        const recordKeyHex = await this.irfKeyService.getRecordKey(id);
        const result = await this.irfRepo.query(
          `SELECT convert_from(
             decrypt(encrypted_narration, decode($1, 'hex'), 'aes-256-cbc/pad:pkcs'),
             'UTF8'
           ) AS narration
           FROM irf_cases WHERE id = $2`,
          [recordKeyHex, id]
        );
        narration = result[0]?.narration || null;
      } catch (e) {
        this.logger.error('IRF WCPD export decryption failed:', e);
        throw new ForbiddenException('Decryption failed — key may have rotated');
      }
    }

    this.logger.log(`IRF WCPD EXPORT: id=${id}, blotter=${irf.blotterEntryNumber}, legalBasis=${legalBasis}, exportedAt=${new Date().toISOString()}`);

    return {
      exportMetadata: {
        generatedAt: new Date(),
        legalBasis,
        format: 'WCPD-EXPORT-v1',
        agency: 'MSWDO Norzagaray',
      },
      case: {
        blotterEntryNumber: irf.blotterEntryNumber,
        caseCategory: irf.caseCategory,
        datetimeReported: irf.datetimeReported,
        datetimeIncident: irf.datetimeIncident,
        caseDisposition: irf.caseDisposition,
      },
      parties: {
        reportingPerson: irf.itemAReportingPerson,
        personReported: irf.itemBPersonReported,
      },
      narration,
      signatures: {
        msdwSignatureUrl: irf.msdwSignatureUrl,
        reportingSignatureUrl: irf.reportingSignatureUrl,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Disposition FSM — dedicated endpoints
  // ---------------------------------------------------------------------------

  async referToPnp(id: string, userRole?: string) {
    return this.transitionDisposition(id, IrfDisposition.REFERRED_TO_PNP);
  }

  async referToWcpd(id: string, userRole?: string) {
    return this.transitionDisposition(id, IrfDisposition.REFERRED_TO_WCPD);
  }

  async dismiss(id: string, reason: string, userRole?: string) {
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');
    const current = irf.caseDisposition as IrfDisposition;
    const allowed = DISPOSITION_TRANSITIONS[current] || [];
    if (!allowed.includes(IrfDisposition.DISMISSED)) {
      throw new BadRequestException(`Cannot dismiss from "${current}"`);
    }
    irf.caseDisposition = IrfDisposition.DISMISSED;
    irf.dismissalReason = reason;
    return this.irfRepo.save(irf);
  }

  async close(id: string, userRole?: string) {
    return this.transitionDisposition(id, IrfDisposition.CLOSED);
  }

  private async transitionDisposition(id: string, target: IrfDisposition) {
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');
    const current = irf.caseDisposition as IrfDisposition;
    const allowed = DISPOSITION_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Invalid transition from "${current}" to "${target}"`);
    }
    irf.caseDisposition = target;
    return this.irfRepo.save(irf);
  }

  async overrideDisposition(id: string, target: IrfDisposition, reason: string, userRole?: string) {
    if (userRole !== 'admin') throw new ForbiddenException('Only admin can override disposition');
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Override reason is required');
    }
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');

    await this.irfAuditService.logAccess({
      irfId: id,
      userId: 'system',
      action: 'DISPOSITION_OVERRIDE',
      legalBasis: reason,
    });

    irf.caseDisposition = target;
    irf.dismissalReason = reason;
    return this.irfRepo.save(irf);
  }

  // ---------------------------------------------------------------------------
  // Legacy — kept for backward compat, delegates to new methods
  // ---------------------------------------------------------------------------

  async updateStatus(id: string, disposition: string) {
    // Map string to enum for legacy callers
    const target = Object.values(IrfDisposition).find(v => v === disposition);
    if (!target) {
      throw new BadRequestException(`Invalid disposition "${disposition}". Valid: ${Object.values(IrfDisposition).join(', ')}`);
    }
    return this.transitionDisposition(id, target);
  }

  // ---------------------------------------------------------------------------
  // Blotter number generation (unchanged)
  // ---------------------------------------------------------------------------

  private async generateBlotterNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.irfRepo.query(
      `INSERT INTO irf_blotter_seq (year, created_at) VALUES ($1, NOW()) RETURNING id`,
      [year]
    );
    const seqId = result[0]?.id || 0;
    return `BLT-${year}-${String(seqId).padStart(BLOTTER_PAD_WIDTH, '0')}`;
  }
}
