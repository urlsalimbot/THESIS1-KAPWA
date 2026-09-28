import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AbacGuard } from './abac.guard';
import { AbacService } from '../services/abac.service';
import { ConsentLedger } from '../../beneficiaries/consent-ledger.entity';

describe('AbacGuard (role scoping and denial messages)', () => {
  let guard: AbacGuard;
  let consentRepo: { findOne: jest.Mock };
  let reflectorMock: { getAllAndOverride: jest.Mock };

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
    reflectorMock = { getAllAndOverride: jest.fn().mockReturnValue('internal') };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbacGuard,
        { provide: AbacService, useValue: new AbacService({} as any) },
        { provide: Reflector, useValue: reflectorMock },
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

  it('allows a worker to access any barangay — MSWDO workers are city-wide', async () => {
    const user = {
      role: 'social_worker',
      permittedBarangays: ['Bigte', 'Poblacion', 'Tigbe'],
    };
    const allowed = await guard.canActivate(makeCtx(user, { barangay: 'San Lorenzo' }));
    expect(allowed).toBe(true);
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

  it('refuses a worker on a restricted record with no legal basis, and says why', async () => {
    const user = { role: 'social_worker', permittedBarangays: ['Poblacion'] };
    // Reflector is stubbed to 'internal'; restore sensitivity to 'restricted'.
    reflectorMock.getAllAndOverride.mockReturnValue('restricted');
    await expect(guard.canActivate(makeCtx(user, {}))).rejects.toThrow(
      /legal basis is required/i,
    );
  });

  it('allows a worker on a restricted record when a legal basis is supplied', async () => {
    const user = { role: 'social_worker', permittedBarangays: ['Poblacion'] };
    reflectorMock.getAllAndOverride.mockReturnValue('restricted');
    const allowed = await guard.canActivate(
      makeCtx(user, { legalBasis: 'RA 11611' }),
    );
    expect(allowed).toBe(true);
  });
});
