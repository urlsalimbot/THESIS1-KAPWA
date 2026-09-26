import { z } from 'zod';

const CURRENT_YEAR = new Date().getFullYear();

export const SummaryReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(CURRENT_YEAR),
  quarter: z.coerce.number().int().min(1).max(4).default(Math.floor(new Date().getMonth() / 3) + 1),
});

export type SummaryReportQuery = z.infer<typeof SummaryReportQuerySchema>;
