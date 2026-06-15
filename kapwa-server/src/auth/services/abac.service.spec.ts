import { Test, TestingModule } from '@nestjs/testing';
import { AbacService } from './abac.service';
import { REQUEST } from '@nestjs/core';

describe('AbacService', () => {
  let service: AbacService;

  function createService(userRole: string) {
    const mockRequest = { user: { role: userRole } };
    return {
      provide: AbacService,
      useFactory: () => new (AbacService as any)(mockRequest),
    };
  }

  beforeEach(async () => {});

  it('allows admin to access anything', () => {
    const svc = new AbacService({ user: { role: 'admin' } } as any);
    expect(svc.evaluate({
      userId: '1', role: 'admin', assignedBarangay: '', permittedBarangays: [],
      resourceSensitivity: 'restricted',
    })).toBe(true);
  });

  it('allows social worker sensitive access with consent', () => {
    const svc = new AbacService({ user: { role: 'social_worker' } } as any);
    expect(svc.evaluate({
      userId: '2', role: 'social_worker', assignedBarangay: 'Bigte',
      permittedBarangays: ['Bigte', 'Matictic'],
      resourceSensitivity: 'sensitive', consentStatus: 'active',
    })).toBe(true);
  });

  it('denies social worker restricted access without legal basis', () => {
    const svc = new AbacService({ user: { role: 'social_worker' } } as any);
    expect(svc.evaluate({
      userId: '2', role: 'social_worker', assignedBarangay: 'Bigte',
      permittedBarangays: ['Bigte'],
      resourceSensitivity: 'restricted', consentStatus: 'active',
    })).toBe(false);
  });

  it('denies social worker access with revoked consent', () => {
    const svc = new AbacService({ user: { role: 'social_worker' } } as any);
    expect(svc.evaluate({
      userId: '2', role: 'social_worker', assignedBarangay: 'Bigte',
      permittedBarangays: ['Bigte'],
      resourceSensitivity: 'sensitive', consentStatus: 'revoked',
    })).toBe(false);
  });

  it('restricts coordinator to public/internal resources only', () => {
    const svc = new AbacService({ user: { role: 'coordinator' } } as any);
    expect(svc.evaluate({
      userId: '3', role: 'coordinator', assignedBarangay: 'Partida',
      permittedBarangays: ['Partida'],
      resourceSensitivity: 'public',
    })).toBe(true);
    expect(svc.evaluate({
      userId: '3', role: 'coordinator', assignedBarangay: 'Partida',
      permittedBarangays: ['Partida'],
      resourceSensitivity: 'sensitive',
    })).toBe(false);
  });

  it('restricts claimant to public resources only', () => {
    const svc = new AbacService({ user: { role: 'claimant' } } as any);
    expect(svc.evaluate({
      userId: '4', role: 'claimant', assignedBarangay: '',
      permittedBarangays: [],
      resourceSensitivity: 'public',
    })).toBe(true);
    expect(svc.evaluate({
      userId: '4', role: 'claimant', assignedBarangay: '',
      permittedBarangays: [],
      resourceSensitivity: 'internal',
    })).toBe(false);
  });

  it('scopes coordinator to assigned barangay', () => {
    const svc = new AbacService({ user: { role: 'coordinator' } } as any);
    expect(svc.evaluate({
      userId: '3', role: 'coordinator', assignedBarangay: 'Partida',
      permittedBarangays: ['Partida'],
      resourceSensitivity: 'internal', barangay: 'Partida',
    })).toBe(true);
    expect(svc.evaluate({
      userId: '3', role: 'coordinator', assignedBarangay: 'Partida',
      permittedBarangays: ['Partida'],
      resourceSensitivity: 'internal', barangay: 'Bigte',
    })).toBe(false);
  });

  it('maps resource sensitivity from path', () => {
    const svc = new AbacService({} as any);
    expect(svc.getResourceSensitivity('/interventions', 'GET')).toBe('sensitive');
    expect(svc.getResourceSensitivity('/irf', 'POST')).toBe('restricted');
    expect(svc.getResourceSensitivity('/beneficiaries', 'GET')).toBe('sensitive');
    expect(svc.getResourceSensitivity('/cases', 'GET')).toBe('internal');
    expect(svc.getResourceSensitivity('/programs', 'GET')).toBe('public');
    expect(svc.getResourceSensitivity('/dashboard', 'GET')).toBe('public');
  });

  it('allows legal basis override for restricted resources to social worker', () => {
    const svc = new AbacService({ user: { role: 'social_worker' } } as any);
    const context = {
      userId: '2', role: 'social_worker' as const, assignedBarangay: 'Bigte',
      permittedBarangays: ['Bigte'],
      resourceSensitivity: 'restricted' as const,
      consentStatus: 'active' as const, legalBasis: 'DSWD AO 2020-002',
    };
    expect(svc.evaluate(context)).toBe(true);
  });
});
