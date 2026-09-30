import 'reflect-metadata';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { getRepositoryToken } from '@nestjs/typeorm';

/**
 * The require graph between `CasesService` and `CaseStepLocksService`, checked
 * by loading the real modules rather than by reading the source.
 *
 * This file deliberately imports neither service at the top. `jest.isolateModules`
 * only re-executes modules that are not already in the registry, so a probe
 * living in a spec that imports both statically reads the metadata those
 * imports froze at spec-load time and asserts nothing about the order under
 * test. Here every `require` is a real load, and `jest.resetModules()` keeps
 * the two load orders independent of each other.
 *
 * What it guards: `CaseStepLocksService` injects `CasesService`, so having
 * `cases.service.ts` read `CASE_STEP_LABELS` back out of the locks service makes
 * the two modules require each other. Under `emitDecoratorMetadata` the cycle
 * hands the locks service a `CasesService` of `undefined` in
 * `design:paramtypes`, Nest then cannot resolve the constructor, and the app
 * dies at boot — while every other test in the suite passes, because they build
 * both services by hand and never read the decorator's metadata. The labels
 * therefore live in `case-step-labels.ts` and are re-exported; both load orders
 * below are the evidence that they stay reachable from both sides.
 *
 * Two layers of metadata are read, and the distinction matters:
 *  - `design:paramtypes` is what TypeScript emitted. It names the *type* of each
 *    parameter, and it is emitted whether or not an `@Inject…` decorator is
 *    present — every repository parameter reports `Repository` either way.
 *  - `SELF_DECLARED_DEPS_METADATA` is what Nest read the decorators for, and it
 *    is the layer that distinguishes "this repository is injected" from "this
 *    parameter happens to have a repository type".
 *
 * The second layer is the one that matters for a constructor whose repositories
 * have to resolve. A missing `@InjectRepository` is completely invisible in
 * `design:paramtypes`, and the boot failure it causes
 * ("Nest can't resolve dependencies of CaseStepLocksService (?, …)") is invisible
 * to the rest of the suite, because nothing in the suite compiles `CasesModule`.
 * Asserting only the emitted types left one repository checked for injection and
 * two unchecked after the constructor grew; both layers are asserted below so
 * neither can be dropped alone.
 */
describe('cases step-locks require graph', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  /**
   * What Nest will actually try to resolve, as `{ index, param }` pairs.
   *
   * `param` is the token `InjectRepository` supplies — `getRepositoryToken(Entity)`
   * — and *not* the entity class, which is why the expectations below are built
   * from that same function rather than from a hard-coded string: an assertion
   * written against the entity class would pass for the wrong reason or never
   * match at all.
   *
   * Takes the freshly `require`d class per call so each load order reads its own
   * metadata; hoisting the read out of the test would pin one order and quietly
   * stop covering the other.
   */
  const selfDeclaredDeps = (target: object): Array<{ index: number; param: unknown }> =>
    (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) ?? []) as Array<{
      index: number;
      param: unknown;
    }>;

  /** The three `{ index, token }` pairs the locks service's repositories must carry. */
  const expectedRepoDeps = () => {
    const { CaseStepLock } = require('./case-step-lock.entity');
    const { CaseIntervention } = require('../case-interventions/case-intervention.entity');
    const { Program } = require('../programs/program.entity');
    return [
      { index: 0, param: getRepositoryToken(CaseStepLock) },
      { index: 2, param: getRepositoryToken(CaseIntervention) },
      { index: 3, param: getRepositoryToken(Program) },
    ];
  };

  /**
   * The order `AppModule` gives: the cases module pulls in `cases.service`
   * first, and the locks service is required afterwards. This is the load order
   * that breaks *silently* — the cycle resolves, and the damage is an
   * `undefined` constructor parameter that Nest only notices at bootstrap.
   */
  it('resolves the CasesService parameter when cases.service loads first', () => {
    require('./cases.service');
    const locks = require('./case-step-locks.service');

    const paramtypes = Reflect.getMetadata('design:paramtypes', locks.CaseStepLocksService) as unknown[];

    expect(paramtypes).toHaveLength(5);
    // Ask the question directly rather than with `toEqual([])`: `toEqual`
    // ignores `undefined` members, so a `[Repository, undefined, X]` array
    // compares equal to `[]` and the whole probe would pass on a broken graph.
    expect(paramtypes.some((t) => t === undefined)).toBe(false);
    // Optional chaining for the same reason — a bare `.name` here throws a
    // TypeError instead of reporting the missing parameter.
    expect((paramtypes[1] as { name?: string } | undefined)?.name).toBe('CasesService');
    // The three repositories are TypeScript-only types, so `design:paramtypes`
    // reports the same `Repository` for all three — with or without their
    // decorators. Kept because it says the constructor still has its shape, but
    // it proves nothing about injection on its own, which is why the decorator
    // layer is asserted separately below. Order is
    // (lockRepo, cases, interventions, programs, auditLog).
    for (const index of [0, 2, 3]) {
      expect((paramtypes[index] as { name?: string } | undefined)?.name).toBe('Repository');
    }
    expect((paramtypes[4] as { name?: string } | undefined)?.name).toBe('AuditLogService');

    // The layer with teeth. Asserted pair by pair rather than as one
    // `expect(deps).toEqual([...])` so a failure says *which* repository lost its
    // token instead of printing a single opaque array diff.
    const deps = selfDeclaredDeps(locks.CaseStepLocksService);
    for (const expected of expectedRepoDeps()) {
      expect(deps).toEqual(expect.arrayContaining([expected]));
    }
    // And nothing beyond those three: a stray `@Inject` at another index would be
    // a parameter Nest resolves that the constructor does not describe.
    expect(deps.map((d) => d?.index).sort((a, b) => a - b)).toEqual([0, 2, 3]);
    // `some`, never filter-and-compare: an entry whose token came back undefined
    // would be filtered away by a truthiness test and the set would still read
    // clean. `toEqual` also ignores undefined members, so it cannot close this.
    expect(deps.some((d) => d === undefined || d.param === undefined)).toBe(false);
  });

  /**
   * The reverse order, which requires `cases.service` transitively from inside
   * the locks module. A cycle breaks this one louder — `cases.service` reads
   * `CASE_STEP_LABELS` while the locks module is only half-loaded — but only if
   * the labels are still coming from the locks service, so it is the load order
   * that catches a move backwards.
   */
  it('resolves the CasesService parameter when the locks service loads first', () => {
    const locks = require('./case-step-locks.service');

    const paramtypes = Reflect.getMetadata('design:paramtypes', locks.CaseStepLocksService) as unknown[];

    expect(paramtypes).toHaveLength(5);
    expect(paramtypes.some((t) => t === undefined)).toBe(false);
    expect((paramtypes[1] as { name?: string } | undefined)?.name).toBe('CasesService');
    for (const index of [0, 2, 3]) {
      expect((paramtypes[index] as { name?: string } | undefined)?.name).toBe('Repository');
    }

    // The decorators have to survive this load order too, and half-loaded is
    // exactly when a decorator's module reference could come back undefined and
    // leave Nest with no token to resolve — which the type assertions above
    // could not tell apart from a healthy one.
    const deps = selfDeclaredDeps(locks.CaseStepLocksService);
    for (const expected of expectedRepoDeps()) {
      expect(deps).toEqual(expect.arrayContaining([expected]));
    }
    expect(deps.some((d) => d === undefined || d.param === undefined)).toBe(false);
  });
});
