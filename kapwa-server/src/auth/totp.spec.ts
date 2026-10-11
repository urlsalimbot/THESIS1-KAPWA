import { totpForCounter, generateTOTPSecret } from './totp';

// RFC 6238 Appendix B test vectors, SHA-1 variant, 6 digits, 30 s period —
// the table's T values are seconds; the counter is floor(T / 30) with T0 = 0.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const VECTORS: Array<[number, string]> = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
];

describe('totpForCounter — RFC 6238 vectors', () => {
  it.each(VECTORS)('T=%d → %s', (t, expected) => {
    expect(totpForCounter(SECRET, Math.floor(t / 30))).toBe(expected);
  });

  it('generates 32-byte base32 secrets with the standard alphabet', () => {
    const secret = generateTOTPSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });
});