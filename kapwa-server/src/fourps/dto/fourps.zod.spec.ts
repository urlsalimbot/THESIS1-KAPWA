import { SchedulePayoutSchema, PayoutStatusSchema } from './fourps.zod';

describe('fourps zod schemas', () => {
  it('accepts a minimal payout schedule', () => {
    const parsed = SchedulePayoutSchema.safeParse({ scheduledAt: '2026-10-01' });
    expect(parsed.success).toBe(true);
  });

  it('accepts cycle + amount', () => {
    const parsed = SchedulePayoutSchema.safeParse({ scheduledAt: '2026-10-01', cycleNo: 'CY2026-02', amount: 1200 });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-date scheduledAt', () => {
    expect(SchedulePayoutSchema.safeParse({ scheduledAt: 'tomorrow' }).success).toBe(false);
  });

  it('accepts only terminal payout statuses', () => {
    expect(PayoutStatusSchema.safeParse({ status: 'completed' }).success).toBe(true);
    expect(PayoutStatusSchema.safeParse({ status: 'missed', remarks: 'No show' }).success).toBe(true);
    expect(PayoutStatusSchema.safeParse({ status: 'scheduled' }).success).toBe(false);
    expect(PayoutStatusSchema.safeParse({ status: 'bogus' }).success).toBe(false);
  });
});
