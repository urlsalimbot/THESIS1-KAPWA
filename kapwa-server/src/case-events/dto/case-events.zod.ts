import { z } from 'zod';
import { CASE_EVENT_TYPES, CASE_EVENT_STATUSES } from '../case-event.entity';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM').optional().nullable();

export const CreateCaseEventSchema = z.object({
  eventType: z.enum(CASE_EVENT_TYPES),
  attended: z.boolean().nullable().optional(),
  title: z.string().trim().optional().nullable(),
  venue: z.string().trim().optional().nullable(),
  eventDate: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  notes: z.string().trim().optional().nullable(),
}).strict();
export type CreateCaseEventInput = z.infer<typeof CreateCaseEventSchema>;

export const UpdateCaseEventSchema = CreateCaseEventSchema.partial().extend({
  status: z.enum(CASE_EVENT_STATUSES).optional(),
}).strict();
export type UpdateCaseEventInput = z.infer<typeof UpdateCaseEventSchema>;