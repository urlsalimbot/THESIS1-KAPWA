import { BadRequestException } from '@nestjs/common';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApproveCaseSchema, UpdateStatusSchema, AssessmentV2Schema, AdoptionSchema } from './cases.zod';

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

/**
 * The CDCLAA checkbox is tri-state in the form: it initialises to `null` for
 * "not answered yet" and is submitted verbatim, and the column it lands on
 * (`adoption_cdclaa_received`) is nullable. `.optional()` on its own accepts the
 * key being *absent* but rejects an explicit `null`, so the step could not be
 * saved until the box was ticked — and that step gates Program Enrollments, which
 * left the Adoption case unable to advance.
 */
describe('AdoptionSchema — tri-state CDCLAA checkbox', () => {
  const pipe = new ZodPipe(AdoptionSchema);
  const body = { type: 'body' } as never;

  it('accepts an unanswered checkbox sent as null', () => {
    expect(pipe.transform({
      adoptionDvcDate: '2026-10-15',
      adoptionCaseStudyDate: null,
      adoptionCdclaaReceived: null,
      adoptionNotes: null,
    }, body)).toMatchObject({ adoptionCdclaaReceived: null });
  });

  it('still accepts an answered checkbox', () => {
    expect(pipe.transform({ adoptionDvcDate: '2026-10-15', adoptionCdclaaReceived: true }, body))
      .toMatchObject({ adoptionCdclaaReceived: true });
    expect(pipe.transform({ adoptionDvcDate: '2026-10-15', adoptionCdclaaReceived: false }, body))
      .toMatchObject({ adoptionCdclaaReceived: false });
  });

  it('still refuses a payload carrying nothing to save', () => {
    expect(() => pipe.transform({}, body)).toThrow(BadRequestException);
  });

  it('still refuses a non-boolean answer', () => {
    expect(() => pipe.transform({ adoptionDvcDate: '2026-10-15', adoptionCdclaaReceived: 'yes' }, body))
      .toThrow(BadRequestException);
  });
});
