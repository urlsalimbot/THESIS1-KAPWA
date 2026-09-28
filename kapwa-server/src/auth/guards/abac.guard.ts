import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbacService, ResourceSensitivity } from '../services/abac.service';
import { RESOURCE_SENSITIVITY_KEY } from '../decorators/resource-sensitivity.decorator';
import { ConsentLedger } from '../../beneficiaries/consent-ledger.entity';

/**
 * Force a query-param scope onto the request.
 *
 * Express 5 (5.2.x here) exposes `req.query` as an accessor on the request
 * prototype that re-parses `req.url` on every access, and it has **no setter**.
 * A plain `req.query.barangay = x` is therefore silently discarded before
 * Nest's `@Query()` decorator reads the value — the guard appears to scope the
 * query and the handler still receives the unfiltered params. Shadow the
 * prototype getter with an own data property so the value survives.
 *
 * Do not "simplify" this back into a property assignment.
 */
function pinQueryScope(request: any, key: string, value: string): void {
  Object.defineProperty(request, 'query', {
    value: { ...(request.query ?? {}), [key]: value },
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

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
    // only — case/IRF route :id params are not beneficiary UUIDs.
    const routePath = request.route?.path || request.url || '';
    const isBeneficiaryRoute = /\/beneficiaries(\/|$)/.test(routePath);
    // The access-card *list* only — `/access-cards/:cardCode` is a single-card
    // lookup, and cross-barangay point-of-service verification is legitimate.
    // End-anchored so `request.route.path` matches whether or not the global
    // prefix is part of it.
    const ACCESS_CARD_LIST_ROUTE = /\/access-cards\/?$/;
    const beneficiaryId = params?.beneficiaryId || params?.id;
    if (isBeneficiaryRoute && beneficiaryId) {
      const consent = await this.consentRepo.findOne({
        where: { beneficiaryId },
      });
      // Only block when consent was explicitly revoked — missing record means not yet processed
      if (consent && consent.status !== 'active') {
        throw new ForbiddenException('Beneficiary consent has been revoked');
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
      if (resourceSensitivity !== 'public' && resourceSensitivity !== 'internal') {
        throw new ForbiddenException(
          `Barangay coordinators cannot access ${resourceSensitivity} records.`,
        );
      }
      // `barangay` is the canonical scope param. Modules that store the scope in
      // their own column alias it — access-cards filters on `sourceBarangay` —
      // so a coordinator cannot escape their barangay through the alias.
      const barangay =
        query?.barangay || query?.sourceBarangay || params?.barangay || body?.barangay;
      if (barangay && barangay !== user.assignedBarangay) {
        throw new ForbiddenException(
          `You are not assigned to ${barangay}. Your assignment is ${user.assignedBarangay}.`,
        );
      }
      // Pin a bare list request to the coordinator's own barangay rather than
      // letting it fan out city-wide. Without this an omitted filter returned
      // every barangay's rows, since the services only filter when a value is
      // supplied.
      if (!barangay && user.assignedBarangay) {
        if (isBeneficiaryRoute) {
          pinQueryScope(request, 'barangay', user.assignedBarangay);
        } else if (ACCESS_CARD_LIST_ROUTE.test(routePath)) {
          pinQueryScope(request, 'sourceBarangay', user.assignedBarangay);
        }
      }
      return true;
    }

    // Social worker scoping: MSWDO staff are city-wide, so a worker is in scope
    // for every barangay. Access to *restricted* records is still gated on a
    // legal basis, which is a data-access rule rather than a geographic one.
    if (user.role === 'social_worker') {
      const legalBasis = query?.legalBasis || body?.legalBasis;
      if (resourceSensitivity === 'restricted' && !legalBasis) {
        throw new ForbiddenException(
          'This record is restricted. A legal basis is required to access it.',
        );
      }
      return true;
    }

    // Client/claimant scoping
    if (user.role === 'claimant') {
      if (resourceSensitivity !== 'public') {
        throw new ForbiddenException(
          `This record is ${resourceSensitivity} and is not available to claimants.`,
        );
      }
      // Consent-ledger ABAC for the self-scoped /me/* surface (the param-based
      // branch above only covers /beneficiaries/:id routes).
      if (/\/me(\/|$)/.test(routePath) || /\/dashboard$/.test(routePath)) {
        const rows = await this.consentRepo.query(
          `SELECT cl.status
             FROM consent_ledger cl
             JOIN beneficiaries b ON b.id = cl.beneficiary_id
            WHERE b.user_id = $1::uuid
            ORDER BY cl.granted_at DESC
            LIMIT 1`,
          [user.id],
        );
        if (rows?.[0] && rows[0].status !== 'active') {
          throw new ForbiddenException('Beneficiary consent has been revoked');
        }
      }
      return true;
    }

    // Mayor/auditor: unrestricted geographic scope; restricted access still
    // requires a legal basis.
    if (user.role === 'mayor' || user.role === 'auditor') {
      const legalBasis = query?.legalBasis || body?.legalBasis;
      if (resourceSensitivity === 'restricted' && !legalBasis) {
        throw new ForbiddenException(
          'This record is restricted. A legal basis is required to access it.',
        );
      }
      return true;
    }

    return true;
  }
}
