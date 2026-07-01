import { z } from 'zod';

export const RequestOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  code: z.string().length(6),
});

export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
