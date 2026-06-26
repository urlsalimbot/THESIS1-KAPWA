import { z } from 'zod';
import { NotificationCategory, NotificationType } from '../notification.entity';

export const CreateNotificationSchema = z.object({
  recipientId: z.string().min(1, 'recipientId is required'),
  title: z.string().min(1, 'title is required'),
  message: z.string().min(1, 'message is required'),
  category: z.nativeEnum(NotificationCategory).optional(),
  referenceId: z.string().optional(),
  channel: z.nativeEnum(NotificationType).optional(),
  phone: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

export const UpdatePreferenceSchema = z.object({
  channel: z.enum(['sms', 'in_app']),
  category: z.nativeEnum(NotificationCategory),
  optedIn: z.boolean(),
});

export type UpdatePreferenceInput = z.infer<typeof UpdatePreferenceSchema>;

export const BulkUpdatePreferencesSchema = z.array(UpdatePreferenceSchema);
export type BulkUpdatePreferencesInput = z.infer<typeof BulkUpdatePreferencesSchema>;
