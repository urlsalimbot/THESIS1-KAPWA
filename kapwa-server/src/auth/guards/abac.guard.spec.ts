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

  describe('coordinator access-card scoping', () => {
    const coord = { role: 'coordinator', assignedBarangay: 'Bigte' };

    // Models Express 5, where `req.query` is a prototype getter that re-parses
    // `req.url` on every read and has no setter. A plain `query.x = y` is
    // silently dropped, so a mock backed by a plain object would pass while
    // production stayed unscoped.
    const makeGetterCtx = (user: any, raw: string, path: string, params: any = {}) => {
      const request: any = {
        user,
        params,
        body: {},
        url: raw,
        route: { path },
        method: 'GET',
      };
      Object.defineProperty(request, 'query', {
        get() {
          // Re-derive every read, exactly like Express's query getter.
          return Object.fromEntries(new URLSearchParams(raw.split('?')[1] ?? ''));
        },
        configurable: true,
        enumerable: true,
      });
      return {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;
    };

    it('pins a bare access-card list request to the coordinator barangay', async () => {
      // The services only filter when a value is supplied, so omitting it used
      // to return every barangay's rows.
      const ctx = makeGetterCtx(coord, '/api/v1/access-cards?page=1&limit=50', '/api/v1/access-cards');
      const allowed = await guard.canActivate(ctx);
      expect(allowed).toBe(true);
      expect(ctx.switchToHttp().getRequest().query.sourceBarangay).toBe('Bigte');
    });

    it('preserves the existing query params alongside the pinned scope', async () => {
      const ctx = makeGetterCtx(
        coord,
        '/api/v1/access-cards?page=2&limit=50&category=seminar',
        '/api/v1/access-cards',
      );
      await guard.canActivate(ctx);
      expect(ctx.switchToHttp().getRequest().query).toEqual({
        page: '2',
        limit: '50',
        category: 'seminar',
        sourceBarangay: 'Bigte',
      });
    });

    it('refuses an explicit foreign sourceBarangay and names the assignment', async () => {
      await expect(
        guard.canActivate(
          makeCtx(coord, { sourceBarangay: 'Poblacion' }, {}, '/api/v1/access-cards'),
        ),
      ).rejects.toThrow('You are not assigned to Poblacion. Your assignment is Bigte.');
    });

    it('leaves an explicit own-sourceBarangay alone', async () => {
      const query: any = { sourceBarangay: 'Bigte' };
      const allowed = await guard.canActivate(makeCtx(coord, query, {}, '/api/v1/access-cards'));
      expect(allowed).toBe(true);
      expect(query.sourceBarangay).toBe('Bigte');
    });

    it('does not inject a filter into a single-card lookup', async () => {
      // Cross-barangay point-of-service verification is legitimate, so the
      // per-card read stays unscoped.
      const ctx = makeGetterCtx(coord, '/api/v1/access-cards/NORZ-AC-0002', '/api/v1/access-cards/:cardCode', {
        cardCode: 'NORZ-AC-0002',
      });
      const allowed = await guard.canActivate(ctx);
      expect(allowed).toBe(true);
      expect(ctx.switchToHttp().getRequest().query.sourceBarangay).toBeUndefined();
    });

    it('pins the canonical barangay param on beneficiary routes', async () => {
      // This injection predates the access-card work and was silently dead on
      // Express 5, leaving coordinators able to list the whole caseload.
      const ctx = makeGetterCtx(coord, '/api/v1/beneficiaries?page=1', '/api/v1/beneficiaries');
      await guard.canActivate(ctx);
      expect(ctx.switchToHttp().getRequest().query.barangay).toBe('Bigte');
    });
  });
});
