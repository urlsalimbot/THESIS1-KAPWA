import { describe, it, expect } from 'vitest';
import { ApiError } from './api-error';
import { apiErrorMessage, humanizeError } from './errors';

describe('apiErrorMessage', () => {
  it('prefers the API message when it is short enough to show', () => {
    expect(apiErrorMessage(400, { message: 'Invalid file type. Allowed: PDF, JPEG, PNG' }))
      .toBe('Invalid file type. Allowed: PDF, JPEG, PNG');
  });

  it('joins validation message arrays', () => {
    expect(apiErrorMessage(422, { message: ['email must be an email', 'phone is required'] }))
      .toBe('email must be an email phone is required');
  });

  it('never falls back to raw HTTP status text', () => {
    expect(apiErrorMessage(404, null)).toBe('That record could not be found.');
    expect(apiErrorMessage(500, null)).toBe('Something went wrong on our side. Please try again.');
    expect(apiErrorMessage(500, null)).not.toContain('Internal Server Error');
  });

  it('ignores an over-long server message and uses the status copy', () => {
    const long = 'x'.repeat(400);
    expect(apiErrorMessage(500, { message: long })).toBe('Something went wrong on our side. Please try again.');
  });

  it('describes an unknown status without leaking a bare code as the whole message', () => {
    expect(apiErrorMessage(418, null)).toMatch(/request failed/i);
  });
});

describe('humanizeError', () => {
  it('uses the ApiError body message', () => {
    const err = new ApiError(409, { message: 'Access card code already exists' });
    expect(humanizeError(err)).toBe('Access card code already exists');
  });

  it('maps an ApiError without a body message to friendly status copy', () => {
    expect(humanizeError(new ApiError(403, null))).toBe('You do not have permission to do that.');
  });

  it('hides technical "API error: 500" strings', () => {
    expect(humanizeError(new Error('API error: 500'))).toBe('Please try again.');
  });

  it('passes through a plain error message', () => {
    expect(humanizeError(new Error('Network error'))).toBe('Network error');
  });

  it('uses the supplied fallback for a string throw', () => {
    expect(humanizeError('boom', 'Could not save')).toBe('Could not save');
  });
});
