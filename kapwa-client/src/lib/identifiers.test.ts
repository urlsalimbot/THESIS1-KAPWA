import { describe, it, expect } from 'vitest';
import { normalizeLoginIdentifier, isOfficeIssuedId } from './identifiers';

describe('login identifiers', () => {
  it('leaves an office-issued claimant ID exactly as printed', () => {
    expect(normalizeLoginIdentifier('CLM-000123')).toBe('CLM-000123');
    expect(normalizeLoginIdentifier('clm-000123')).toBe('clm-000123');
    // The server normalises case; the client must not invent an address.
    expect(normalizeLoginIdentifier('CLM-000123')).not.toContain('@');
  });

  it('keeps an email address untouched', () => {
    expect(normalizeLoginIdentifier('pedro@example.test')).toBe('pedro@example.test');
    expect(normalizeLoginIdentifier('Admin@MSWDO.test')).toBe('Admin@MSWDO.test');
  });

  it('still completes the staff shorthand', () => {
    expect(normalizeLoginIdentifier('admin')).toBe('admin@mswdo.test');
    expect(normalizeLoginIdentifier(' worker1 ')).toBe(' worker1 @mswdo.test');
  });

  it('recognises which kind of identifier it was given', () => {
    expect(isOfficeIssuedId('CLM-000123')).toBe(true);
    expect(isOfficeIssuedId('clm-1')).toBe(true);
    expect(isOfficeIssuedId('admin@mswdo.test')).toBe(false);
    expect(isOfficeIssuedId('admin')).toBe(false);
  });
});
