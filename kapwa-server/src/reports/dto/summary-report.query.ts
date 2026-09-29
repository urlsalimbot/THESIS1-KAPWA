import { z } from 'zod';

const CURRENT_YEAR = new Date().getFullYear();

export const SummaryReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(CURRENT_YEAR),
  // Semestral reporting only: 1 = Q1+Q2 (Jan–Jun), 2 = Q3+Q4 (Jul–Dec).
  semester: z.coerce.number().int().min(1).max(2).default(currentSemester()),
});

export function currentSemester(date = new Date()): number {
  return Math.floor(date.getMonth() / 6) + 1;
}

export type SummaryReportQuery = z.infer<typeof SummaryReportQuerySchema>;
