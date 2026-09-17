import { z } from 'zod';

export const SchedulePayoutSchema = z.object({
  cycleNo: z.string().min(1).max(50).optional(),
  scheduledAt: z.string().date(),
  amount: z.number().nonnegative().optional(),
});

export const PayoutStatusSchema = z.object({
  status: z.enum(['completed', 'missed', 'cancelled']),
  remarks: z.string().max(2000).optional(),
});

export type SchedulePayoutInput = z.infer<typeof SchedulePayoutSchema>;
export type PayoutStatusInput = z.infer<typeof PayoutStatusSchema>;
