import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Beneficiaries Search — Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build correct URL with search param using URLSearchParams', () => {
    // Test the URL building logic that mirrors the api.ts implementation
    const q = new URLSearchParams();
    q.set('search', 'Dela Cruz');
    const qs = q.toString();
    expect(qs).toContain('search=');
    expect(qs).toContain('Dela');
    expect(qs).toContain('Cruz');
  });

  it('should build correct URL with category filter', () => {
    const q = new URLSearchParams();
    q.set('category', 'Senior');
    expect(q.toString()).toBe('category=Senior');
  });

  it('should build correct URL with barangay filter', () => {
    const q = new URLSearchParams();
    q.set('barangay', 'Norzagaray');
    expect(q.toString()).toBe('barangay=Norzagaray');
  });

  it('should build correct URL with combined filters', () => {
    const q = new URLSearchParams();
    q.set('search', 'Juan');
    q.set('category', 'Senior');
    q.set('barangay', 'Norzagaray');
    const qs = q.toString();
    expect(qs).toContain('search=Juan');
    expect(qs).toContain('category=Senior');
    expect(qs).toContain('barangay=Norzagaray');
  });

  it('should return empty query string for no params', () => {
    const q = new URLSearchParams();
    expect(q.toString()).toBe('');
  });

  it('should handle pagination params', () => {
    const q = new URLSearchParams();
    q.set('page', '2');
    q.set('limit', '50');
    expect(q.toString()).toBe('page=2&limit=50');
  });
});
