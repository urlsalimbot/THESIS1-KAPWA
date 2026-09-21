import { describe, it, expect } from 'vitest';
import { isSelfSufficient, SELF_RELIANCE_SUFFICIENT_MIN_LEVEL } from './self-reliance';

describe('self-reliance guide', () => {
  it('treats level >= 3 as self-sufficient', () => {
    expect(SELF_RELIANCE_SUFFICIENT_MIN_LEVEL).toBe(3);
    expect(isSelfSufficient(3)).toBe(true);
    expect(isSelfSufficient(5)).toBe(true);
  });

  it('treats lower or missing levels as not self-sufficient', () => {
    expect(isSelfSufficient(2)).toBe(false);
    expect(isSelfSufficient(1)).toBe(false);
    expect(isSelfSufficient(undefined)).toBe(false);
  });
});
