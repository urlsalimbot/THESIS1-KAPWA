import { describe, it, expect } from 'vitest';
import { ApiError } from './api-error';
import { apiErrorMessage, humanizeError, insufficientDataOf } from './errors';

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

  // ZodPipe reports a rejected body as a message *object*. bodyMessage() used to
  // ignore it, so every field error was discarded and the worker was shown the
  // generic "check the highlighted fields" copy with no field ever named.
  it('flattens a Zod body so a 400 names the fields that failed', () => {
    const body = {
      message: {
        _errors: [],
        problemsPresented: { _errors: ['Problem/s presented is required'] },
        socialWorkerAssessment: { _errors: ['Social worker assessment is required'] },
      },
    };
    expect(apiErrorMessage(400, body)).toBe(
      'Problem/s presented is required Social worker assessment is required',
    );
  });

  it('keeps the generic copy for a non-Zod object message', () => {
    expect(apiErrorMessage(400, { message: { error: 'Bad Request' } }))
      .toBe('The request was rejected. Please check the highlighted fields.');
  });

  it('truncates a Zod body to whole messages instead of over-running and losing everything', () => {
    const body = { message: { field: { _errors: ['x'.repeat(200)] } } };
    const out = apiErrorMessage(400, body);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out).not.toBe('The request was rejected. Please check the highlighted fields.');
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

describe('insufficientDataOf', () => {
  // The API's real 422 envelope: the payload sits under `message`, which is why
  // reading `body.code` alone never matched and the analytics tabs sat on
  // "Loading…" forever.
  const serverShape = new ApiError(422, {
    statusCode: 422,
    message: { code: 'insufficient_data', required: 3, actual: 1 },
    timestamp: '2026-10-18T20:15:51.422+08:00',
    path: '/api/v1/analytics/concentration',
  });

  it('reads the counts out of the envelope the API actually sends', () => {
    expect(insufficientDataOf(serverShape)).toEqual({ required: 3, actual: 1 });
  });

  it('still accepts the flat shape the older call sites assumed', () => {
    const flat = Object.assign(new Error('nope'), {
      body: { code: 'insufficient_data', required: 30, actual: 3 },
    });
    expect(insufficientDataOf(flat)).toEqual({ required: 30, actual: 3 });
  });

  it('returns null for any other failure', () => {
    expect(insufficientDataOf(new ApiError(500, { message: 'boom' }))).toBeNull();
    expect(insufficientDataOf(new Error('plain'))).toBeNull();
    expect(insufficientDataOf(undefined)).toBeNull();
  });
});
