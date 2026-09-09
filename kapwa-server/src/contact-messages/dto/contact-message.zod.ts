import { z } from 'zod';

export const CreateContactMessageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10).max(5000),
});

export type CreateContactMessageInput = z.infer<typeof CreateContactMessageSchema>;