import { describe, it, expect } from 'vitest';
import { ApiError } from './api-error';

describe('ApiError', () => {
  it('extends Error so instanceof Error is true', () => {
    const e = new ApiError(401, null);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ApiError);
  });

  it('exposes status, body, cause, and the supplied message', () => {
    const cause = new Error('original');
    const e = new ApiError(500, { reason: 'oops' }, 'Server error', cause);
    expect(e.status).toBe(500);
    expect(e.body).toEqual({ reason: 'oops' });
    expect(e.cause).toBe(cause);
    expect(e.message).toBe('Server error');
  });

  it('defaults message to "API error: <status>" when no message is given', () => {
    const e = new ApiError(404, null);
    expect(e.message).toBe('API error: 404');
  });

  it('has name "ApiError" so log filters can branch on it', () => {
    const e = new ApiError(401, null);
    expect(e.name).toBe('ApiError');
  });
});
