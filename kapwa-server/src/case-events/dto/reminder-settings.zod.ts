import { z } from 'zod';

// One lead-time list per event type. Ordering is enforced in the service
// (`validateOffsets`) because the rule compares neighbours and the error
// should name the order, not just fail the array.
export const ReminderSettingDraftSchema = z.object({
  eventType: z.enum(['court_hearing', 'home_visit']),
  offsets: z.array(z.number().int().positive()).max(5),
}).strict();

export const ReminderSettingsBulkSchema = z.array(ReminderSettingDraftSchema).max(10);
export type ReminderSettingDraft = z.infer<typeof ReminderSettingDraftSchema>;