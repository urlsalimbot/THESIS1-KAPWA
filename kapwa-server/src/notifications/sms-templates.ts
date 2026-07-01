export const SMS_TEMPLATES = {
  otp: { body: 'Your Kapwa verification code is: {{code}}. Valid for {{minutes}} minutes.' },
  case_update: { body: 'Case {{controlNo}} has been updated to: {{status}}. Log in to Kapwa for details.' },
  appointment: { body: 'Reminder: You have a scheduled appointment on {{date}} at {{time}}.' },
  disbursement: { body: 'Your disbursement for case {{controlNo}} has been approved. Amount: {{amount}}.' },
  notification: { body: '{{message}}' },
} as const;

export type SmsTemplateKey = keyof typeof SMS_TEMPLATES;

export function renderTemplate(key: SmsTemplateKey, vars: Record<string, string>): string {
  let body: string = SMS_TEMPLATES[key].body;
  for (const [k, v] of Object.entries(vars)) {
    body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return body;
}
