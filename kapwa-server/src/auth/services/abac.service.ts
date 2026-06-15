import { Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export type ResourceSensitivity = 'public' | 'internal' | 'sensitive' | 'restricted';
export type ConsentStatus = 'active' | 'revoked' | 'expired';

export interface AbacContext {
  userId: string;
  role: string;
  assignedBarangay: string;
  permittedBarangays: string[];
  resourceSensitivity: ResourceSensitivity;
  beneficiaryId?: string;
  barangay?: string;
  consentStatus?: ConsentStatus;
  legalBasis?: string;
}

@Injectable()
export class AbacService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  evaluate(context: AbacContext): boolean {
    if (['admin', 'mayor', 'auditor'].includes(context.role)) return true;
    if (!this.evaluateBarangayScope(context)) return false;
    if (!this.evaluateConsent(context)) return false;
    if (!this.evaluateSensitivity(context)) return false;
    return true;
  }

  private evaluateBarangayScope(context: AbacContext): boolean {
    if (context.role === 'coordinator' && context.barangay) {
      return context.barangay === context.assignedBarangay;
    }
    if (context.role === 'social_worker' && context.barangay) {
      return context.permittedBarangays?.includes(context.barangay) ?? false;
    }
    if (context.role === 'claimant') return true;
    return true;
  }

  private evaluateConsent(context: AbacContext): boolean {
    const s = context.resourceSensitivity;
    if (s === 'public') return true;
    if (s === 'internal') return context.consentStatus !== 'revoked';
    if (s === 'sensitive') return context.consentStatus === 'active';
    if (s === 'restricted') return context.consentStatus === 'active' && !!context.legalBasis;
    return true;
  }

  private evaluateSensitivity(context: AbacContext): boolean {
    switch (context.role) {
      case 'social_worker':
        if (['public', 'internal', 'sensitive'].includes(context.resourceSensitivity)) return true;
        if (context.resourceSensitivity === 'restricted' && !!context.legalBasis) return true;
        return false;
      case 'coordinator':
        return ['public', 'internal'].includes(context.resourceSensitivity);
      case 'claimant':
        return context.resourceSensitivity === 'public';
      default:
        return true;
    }
  }

  getResourceSensitivity(path: string, method: string): ResourceSensitivity {
    if (path.includes('/interventions') || path.includes('/financial')) return 'sensitive';
    if (path.includes('/irf') || path.includes('/irf-cases')) return 'restricted';
    if (path.includes('/beneficiaries') || path.includes('/family')) return 'sensitive';
    if (path.includes('/cases')) return 'internal';
    if (path.includes('/programs') || path.includes('/tracker') || path.includes('/dashboard')) return 'public';
    if (path.includes('/sync') || path.includes('/audit')) return 'restricted';
    return 'internal';
  }
}
