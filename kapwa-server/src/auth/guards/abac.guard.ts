import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbacService, ResourceSensitivity } from '../services/abac.service';
import { RESOURCE_SENSITIVITY_KEY } from '../decorators/resource-sensitivity.decorator';
import { ConsentLedger } from '../../beneficiaries/consent-ledger.entity';

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(
    private readonly abacService: AbacService,
    private readonly reflector: Reflector,
    @InjectRepository(ConsentLedger)
    private readonly consentRepo: Repository<ConsentLedger>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, query, params, body } = request;
    if (!user) return false;

    // Admin bypass
    if (user.role === 'admin') return true;

    // Consent-gated ABAC: auto-evaluate consent_ledger for beneficiary routes
    // On case routes (:id is a case UUID, not beneficiary UUID) — skip auto-resolve
    const routePath = request.route?.path || request.url || '';
    const isCaseRoute = /\/cases(\/|$)/.test(routePath);
    const beneficiaryId = params?.beneficiaryId || (!isCaseRoute && params?.id) || query?.beneficiaryId;
    if (beneficiaryId) {
      const consent = await this.consentRepo.findOne({
        where: { beneficiaryId, status: 'active' },
      });
      if (!consent) {
        throw new ForbiddenException('Beneficiary consent has been revoked or not granted');
      }
    }

    const resourceSensitivity = this.reflector.getAllAndOverride<ResourceSensitivity>(
      RESOURCE_SENSITIVITY_KEY,
      [context.getHandler(), context.getClass()],
    ) || this.abacService.getResourceSensitivity(
      routePath,
      request.method,
    );

    // Coordinator scoping
    if (user.role === 'coordinator') {
      if (resourceSensitivity !== 'public' && resourceSensitivity !== 'internal') return false;
      const barangay = query?.barangay || params?.barangay || body?.barangay;
      if (barangay && barangay !== user.assignedBarangay) return false;
      return true;
    }

    // Social worker scoping
    if (user.role === 'social_worker') {
      const legalBasis = query?.legalBasis || body?.legalBasis;
      if (resourceSensitivity === 'restricted' && !legalBasis) return false;
      const barangay = query?.barangay || params?.barangay || body?.barangay;
      if (barangay && !user.permittedBarangays?.includes(barangay)) return false;
      return true;
    }

    // Client/claimant scoping
    if (user.role === 'claimant') {
      if (resourceSensitivity !== 'public') return false;
      return true;
    }

    // Mayor/auditor: treat as social_worker scope + restricted access requires legal basis
    if (user.role === 'mayor' || user.role === 'auditor') {
      const legalBasis = query?.legalBasis || body?.legalBasis;
      if (resourceSensitivity === 'restricted' && !legalBasis) return false;
      return true;
    }

    return true;
  }
}
