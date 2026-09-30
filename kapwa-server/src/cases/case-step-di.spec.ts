import 'reflect-metadata';

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
 */
describe('cases step-locks require graph', () => {
  beforeEach(() => {
    jest.resetModules();
  });

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

    expect(paramtypes).toHaveLength(3);
    // Ask the question directly rather than with `toEqual([])`: `toEqual`
    // ignores `undefined` members, so a `[Repository, undefined, X]` array
    // compares equal to `[]` and the whole probe would pass on a broken graph.
    expect(paramtypes.some((t) => t === undefined)).toBe(false);
    // Optional chaining for the same reason — a bare `.name` here throws a
    // TypeError instead of reporting the missing parameter.
    expect((paramtypes[1] as { name?: string } | undefined)?.name).toBe('CasesService');
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

    expect(paramtypes).toHaveLength(3);
    expect(paramtypes.some((t) => t === undefined)).toBe(false);
    expect((paramtypes[1] as { name?: string } | undefined)?.name).toBe('CasesService');
  });
});
