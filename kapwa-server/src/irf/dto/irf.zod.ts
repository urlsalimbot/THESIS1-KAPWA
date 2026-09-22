import { z } from 'zod';
import { IrfCategory, IrfDisposition } from '../irf-case.entity';

// Canonical key contract for the Item "A" (reporting person) and Item "B"
// (person reported) JSONB columns on `irf_cases`. These keys mirror the printed
// Incident Report Form field-for-field so the generated PDF is a direct render
// of stored data. `.passthrough()` keeps legacy records — which were written as
// `{ name, contact, address, phone, relation, alias }` — valid; the PDF builder
// maps those aliases onto the same printed fields.
const optionalText = (max = 300) => z.string().trim().max(max).optional();

export const IrfPersonRecordSchema = z
  .object({
    familyName: optionalText(),
    firstName: optionalText(),
    middleName: optionalText(),
    nickname: optionalText(),
    gender: optionalText(40),
    civilStatus: optionalText(40),
    dateOfBirth: optionalText(40),
    age: z.union([z.number(), z.string()]).optional(),
    placeOfBirth: optionalText(),
    contactDetails: optionalText(),
    currentAddress: optionalText(500),
    otherAddress: optionalText(500),
    educationalAttainment: optionalText(),
    occupation: optionalText(),
    idCardPresented: optionalText(),
    relationshipToClient: optionalText(),
    emailAddress: z.union([z.string().email(), z.literal('')]).optional(),
  })
  .passthrough();

export type IrfPersonRecord = z.infer<typeof IrfPersonRecordSchema>;

export const CreateIrfSchema = z.object({
  caseCategory: z.nativeEnum(IrfCategory),
  datetimeReported: z.string().optional(),
  datetimeIncident: z.string().optional(),
  caseId: z.string().min(1, 'IRF must be created within a case'),
  itemAReportingPerson: IrfPersonRecordSchema.optional(),
  itemBPersonReported: IrfPersonRecordSchema.optional(),
  narration: z.string().optional(),
  msdwSignatureUrl: z.string().optional(),
  reportingSignatureUrl: z.string().optional(),
});

export const UpdateIrfDispositionSchema = z.object({
  disposition: z.nativeEnum(IrfDisposition),
});

export const DismissIrfSchema = z.object({
  reason: z.string().min(1, 'Dismissal reason is required'),
});

export const DecryptNarrationSchema = z.object({
  legalBasis: z.string().min(1, 'Legal basis code is required'),
});

// Password travels in the body, never the query string (kept out of logs,
// history and referrers).
export const ExportIrfPdfSchema = z.object({
  legalBasis: z.string().min(1, 'Legal basis code is required'),
  password: z.string().optional(),
});

export const OverrideDispositionSchema = z.object({
  targetDisposition: z.nativeEnum(IrfDisposition),
  reason: z.string().min(1, 'Override reason is required'),
});

export type CreateIrfInput = z.infer<typeof CreateIrfSchema>;
export type UpdateIrfDispositionInput = z.infer<typeof UpdateIrfDispositionSchema>;
export type DismissIrfInput = z.infer<typeof DismissIrfSchema>;
export type DecryptNarrationInput = z.infer<typeof DecryptNarrationSchema>;
export type OverrideDispositionInput = z.infer<typeof OverrideDispositionSchema>;
