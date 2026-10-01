import { BadRequestException } from '@nestjs/common';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApproveCaseSchema, UpdateStatusSchema } from './cases.zod';

/**
 * An approval records who approved. `ApproveCaseSchema.signature` was
 * `z.string().optional()`, and `CasesService.transition` only writes
 * `approvedBySignature` when the value is truthy — so an approval with no
 * signature (or a blank one) was accepted and the field silently dropped. The
 * case view renders `approvedBySignature`, so the record claimed an approval with
 * no approver attached to it. The client's action bar refuses to submit a blank
 * one, but the API is a surface in its own right.
 *
 * The requirement is deliberately on the *approving* path only:
 * `ApproveCaseSchema` has exactly one consumer, `PATCH /cases/:id/approve`, and
 * every other transition goes through `UpdateStatusSchema`, which carries no
 * signature and legitimately has none — a status change is not an approval.
 */
describe('ApproveCaseSchema', () => {
  const pipe = new ZodPipe(ApproveCaseSchema);

  it('refuses an approval with no signature at all', () => {
    expect(() => pipe.transform({ status: 'active' }, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  it('refuses an explicitly empty signature', () => {
    expect(() => pipe.transform({ status: 'active', signature: '' }, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  // A canvas that records a stroke and a name field left blank both arrive as
  // whitespace, which a bare `.min(1)` would wave through.
  it('refuses a whitespace-only signature', () => {
    expect(() => pipe.transform({ status: 'active', signature: '   ' }, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  it('refuses a null signature', () => {
    expect(() => pipe.transform({ status: 'active', signature: null }, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  it('refuses an approval with no status', () => {
    expect(() => pipe.transform({ signature: 'Lorna Santos' }, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  it('carries a real signature through unchanged', () => {
    expect(pipe.transform({ status: 'active', signature: 'Lorna Santos' }, { type: 'body' } as never))
      .toEqual({ status: 'active', signature: 'Lorna Santos' });
  });

  it('trims a padded signature rather than storing the padding', () => {
    expect(pipe.transform({ status: 'active', signature: '  Lorna Santos  ' }, { type: 'body' } as never))
      .toEqual({ status: 'active', signature: 'Lorna Santos' });
  });

  // The narrowness matters as much as the requirement: a plain status change
  // carries no signature, and tightening the shared shape would have broken it.
  it('leaves a signature-free status change legal', () => {
    expect(() => new ZodPipe(UpdateStatusSchema).transform({ status: 'active' }, { type: 'body' } as never)).not.toThrow();
  });
});