import { describe, it, expect } from 'vitest';
import { isKnownLegalBasis, IRF_LEGAL_BASIS_OPTIONS } from './legal-basis';

/**
 * The chosen legal basis is a free string in `useIrfOperations` and reaches the
 * API as `?legalBasis=...` or in a request body, on the three actions taken in a
 * legal basis's name: unmasking names, decrypting the narration, exporting the
 * PDF. A value outside this set must never be put on the wire.
 */
describe('isKnownLegalBasis', () => {
  it('accepts every basis the UI offers', () => {
    for (const o of IRF_LEGAL_BASIS_OPTIONS) {
      expect(isKnownLegalBasis(o.value)).toBe(true);
    }
  });

  it('rejects anything not in the list', () => {
    expect(isKnownLegalBasis('made-up-basis')).toBe(false);
    // The label is not the value — a caller that sent the label would look
    // legitimate to a naive check but is not a recognised code.
    expect(isKnownLegalBasis('Court Order')).toBe(false);
    expect(isKnownLegalBasis('court-order ')).toBe(false);
    expect(isKnownLegalBasis('COURT-ORDER')).toBe(false);
  });

  it('rejects empty, null and undefined', () => {
    expect(isKnownLegalBasis('')).toBe(false);
    expect(isKnownLegalBasis(null)).toBe(false);
    expect(isKnownLegalBasis(undefined)).toBe(false);
  });

  it('offers eight distinct bases', () => {
    const values = IRF_LEGAL_BASIS_OPTIONS.map((o) => o.value);
    expect(values).toHaveLength(8);
    expect(new Set(values).size).toBe(8);
  });
});
