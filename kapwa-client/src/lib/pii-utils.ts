export type MaskableField = 'name' | 'phone' | 'address' | 'dob' | 'philsys';

export const MASK_DISPLAY: Record<MaskableField, string> = {
  name: '********',
  phone: '***-***-****',
  address: '*******',
  dob: '**/**/****',
  philsys: '****-***-****',
};

export const WORKER_ROLES = ['admin', 'worker', 'supervisor'];

export function maskValue(field: MaskableField, _value: string): string {
  return MASK_DISPLAY[field] || '********';
}
