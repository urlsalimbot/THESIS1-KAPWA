import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbacService, ResourceSensitivity } from '../services/abac.service';
import { RESOURCE_SENSITIVITY_KEY } from '../decorators/resource-sensitivity.decorator';

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(
    private readonly abacService: AbacService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { user, query, params } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Admin bypass
    if (user.role === 'admin') return true;

    const resourceSensitivity = this.reflector.getAllAndOverride<ResourceSensitivity>(
      RESOURCE_SENSITIVITY_KEY,
      [context.getHandler(), context.getClass()],
    ) || this.abacService.getResourceSensitivity(
      context.switchToHttp().getRequest().route?.path || '',
      context.switchToHttp().getRequest().method,
    );

    // Coordinator scoping
    if (user.role === 'coordinator') {
      if (resourceSensitivity !== 'public' && resourceSensitivity !== 'internal') return false;
      const barangay = query?.barangay || params?.barangay;
      if (barangay && barangay !== user.assignedBarangay) return false;
      return true;
    }

    // Social worker scoping
    if (user.role === 'social_worker') {
      if (resourceSensitivity === 'restricted' && !query?.legalBasis) return false;
      const barangay = query?.barangay || params?.barangay;
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
      if (resourceSensitivity === 'restricted' && !query?.legalBasis) return false;
      return true;
    }

    return true;
  }
}
