import { z } from 'zod';

export const SendMessageSchema = z.object({
  recipientId: z.string().min(1, 'recipientId is required'),
  content: z.string().min(1, 'message content is required'),
  senderName: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
