import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AbacGuard } from './abac.guard';
import { AbacService } from '../services/abac.service';
import { ConsentLedger } from '../../beneficiaries/consent-ledger.entity';
import { RESOURCE_SENSITIVITY_KEY } from '../decorators/resource-sensitivity.decorator';

describe('AbacGuard (social worker barangay scoping)', () => {
  let guard: AbacGuard;
  let consentRepo: { findOne: jest.Mock };

  const makeCtx = (user: any, query: any = {}, params: any = {}, path = '/api/v1/cases') => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        query,
        params,
        body: {},
        url: path,
        route: { path },
        method: 'GET',
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any);

  beforeEach(async () => {
    consentRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbacGuard,
        { provide: AbacService, useValue: new AbacService({} as any) },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn().mockReturnValue('internal') } },
        { provide: getRepositoryToken(ConsentLedger), useValue: consentRepo },
      ],
    }).compile();
    guard = module.get(AbacGuard);
  });

  it('allows a worker to access their primary assigned barangay', async () => {
    const user = {
      role: 'social_worker',
      assignedBarangay: 'Poblacion',
      permittedBarangays: [],
    };
    const allowed = await guard.canActivate(makeCtx(user, { barangay: 'Poblacion' }));
    expect(allowed).toBe(true);
  });

  it('allows a worker to access a non-primary permitted barangay', async () => {
    const user = {
      role: 'social_worker',
      assignedBarangay: 'Bangkal',
      permittedBarangays: ['Tigbe'],
    };
    const allowed = await guard.canActivate(makeCtx(user, { barangay: 'Tigbe' }));
    expect(allowed).toBe(true);
  });

  it('blocks a worker from accessing an unassigned barangay', async () => {
    const user = {
      role: 'social_worker',
      assignedBarangay: 'Poblacion',
      permittedBarangays: [],
    };
    const allowed = await guard.canActivate(makeCtx(user, { barangay: 'Bigte' }));
    expect(allowed).toBe(false);
  });

  it('allows a worker with no barangay filter to proceed on internal routes', async () => {
    const user = {
      role: 'social_worker',
      assignedBarangay: 'Poblacion',
      permittedBarangays: [],
    };
    const allowed = await guard.canActivate(makeCtx(user, {}));
    expect(allowed).toBe(true);
  });
});
