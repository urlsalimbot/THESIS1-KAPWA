import { BadRequestException } from '@nestjs/common';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApproveCaseSchema, UpdateStatusSchema, AssessmentV2Schema } from './cases.zod';

/**
 * The approving path carries no signature. The approver is the authenticated
 * caller — `transition()` records them as the actor, and the case view renders
 * that name — while the signed paperwork is a document the office exports and
 * signs on paper. The schema used to require a typed `signature`, which meant a
 * second and weaker record of the same fact, and one that needed its own guard
 * because a blank value was accepted and then silently dropped.
 *
 * The shape is deliberately still separate from `UpdateStatusSchema`: the two
 * paths stay distinct even though they now differ only in endpoint and role, so
 * a future approval-only field has one obvious home.
 */
describe('ApproveCaseSchema', () => {
  const pipe = new ZodPipe(ApproveCaseSchema);

  it('accepts an approval carrying only a status', () => {
    expect(pipe.transform({ status: 'active' }, { type: 'body' } as never)).toEqual({ status: 'active' });
  });

  it('refuses an approval with no status', () => {
    expect(() => pipe.transform({}, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  it('refuses an unknown status', () => {
    expect(() => pipe.transform({ status: 'not-a-status' }, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  // A signature sent by an older client is dropped rather than stored: nothing
  // reads `approvedBySignature` any more, and keeping it would imply the field
  // still means something.
  it('drops a signature an older client still sends', () => {
    expect(pipe.transform({ status: 'active', signature: 'Lorna Santos' }, { type: 'body' } as never))
      .toEqual({ status: 'active' });
  });

  it('leaves a signature-free status change legal', () => {
    expect(() => new ZodPipe(UpdateStatusSchema).transform({ status: 'active' }, { type: 'body' } as never)).not.toThrow();
  });
});

describe('AssessmentV2Schema — case category', () => {
  const pipe = new ZodPipe(AssessmentV2Schema);
  const base = {
    problemsPresented: 'need',
    socialWorkerAssessment: 'assess',
    clientCategory: 'Indigent',
  };

  it('requires a case category', () => {
    expect(() => pipe.transform(base, { type: 'body' } as never)).toThrow(BadRequestException);
  });

  it('accepts one of the MSWDO case categories', () => {
    expect(pipe.transform({ ...base, caseCategory: 'Children in Conflict with the Law (CICL)' }, { type: 'body' } as never))
      .toMatchObject({ caseCategory: 'Children in Conflict with the Law (CICL)' });
  });

  it('refuses an unknown case category', () => {
    expect(() => pipe.transform({ ...base, caseCategory: 'Not a category' }, { type: 'body' } as never)).toThrow(BadRequestException);
  });
});
