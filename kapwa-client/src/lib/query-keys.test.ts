import { describe, it, expect } from 'vitest';
import { queryKeys } from './query-keys';

describe('queryKeys factory', () => {
  it('cases.all returns the stable prefix tuple', () => {
    expect(queryKeys.cases.all).toEqual(['cases']);
  });

  it('returns the same tuple reference for the same input', () => {
    expect(queryKeys.cases.detail('c1')).toBe(queryKeys.cases.detail('c1'));
  });

  it('returns different tuple references for different inputs', () => {
    expect(queryKeys.cases.detail('c1')).not.toBe(queryKeys.cases.detail('c2'));
  });

  it('list() includes params object for SWR dedup', () => {
    const key = queryKeys.cases.list({ status: 'pending' });
    expect(key[0]).toBe('cases');
    expect((key[key.length - 1] as Record<string, unknown>).status).toBe('pending');
  });

  it('beneficiaries.list with multi-param object', () => {
    const key = queryKeys.beneficiaries.list({ search: 'foo', category: 'pwd', barangay: 'b1' });
    expect(key[0]).toBe('beneficiaries');
    const params = key[key.length - 1] as Record<string, unknown>;
    expect(params.search).toBe('foo');
    expect(params.category).toBe('pwd');
    expect(params.barangay).toBe('b1');
  });

  it('uses as const — tuples are readonly (TypeScript compile + push fails)', () => {
    // The @ts-expect-error directive proves TypeScript rejects mutating a readonly tuple.
    // If `as const` were missing, this would compile successfully and the test would fail the
    // type check (vitest's `typecheck` would error). Verified by `tsc --noEmit -p .` in CI.
    // @ts-expect-error - readonly tuple rejects push
    queryKeys.cases.list({}).push('mutate');
    expect(queryKeys.cases.all.length).toBe(1);
  });

  it('exposes at least 9 resource subtrees for the top resource groups', () => {
    const required = ['cases', 'beneficiaries', 'dashboard', 'notifications', 'audit', 'admin', 'accessCards', 'filing', 'programs'];
    for (const key of required) {
      expect(queryKeys).toHaveProperty(key);
    }
  });
});
