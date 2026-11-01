/** Front-desk visit purposes. Non-service inquiries are first-class here. */
export const WALK_IN_PURPOSES = [
  { code: 'aics_medical', label: 'AICS — medical' },
  { code: 'aics_burial', label: 'AICS — burial' },
  { code: 'aics_transport', label: 'AICS — transportation' },
  { code: 'aics_food', label: 'AICS — food' },
  { code: 'aics_education', label: 'AICS — educational' },
  { code: 'aics_financial', label: 'AICS — other financial' },
  { code: 'scsr', label: 'Social Case Study Report' },
  { code: 'referral', label: 'Referral / endorsement' },
  { code: 'indigency', label: 'Certificate of Indigency' },
  { code: 'pwd_id', label: 'PWD ID assistance' },
  { code: 'senior_id', label: 'Senior Citizen ID assistance' },
  { code: 'solo_parent_id', label: 'Solo Parent ID assistance' },
  { code: 'vawc', label: 'VAWC / women protection' },
  { code: 'child_protection', label: 'Child protection' },
  { code: 'inquiry', label: 'Inquiry only' },
  { code: 'follow_up', label: 'Follow-up' },
  { code: 'document_claim', label: 'Claim document' },
  { code: 'other', label: 'Other' },
] as const;

export const WALK_IN_STATUSES = [
  { code: 'waiting', label: 'Waiting', className: 'bg-alert-error-bg text-warning-foreground' },
  { code: 'in_service', label: 'In service', className: 'bg-badge-review-bg text-badge-review-fg' },
  { code: 'completed', label: 'Completed', className: 'bg-alert-success-bg text-success-foreground' },
  { code: 'referred', label: 'Referred', className: 'bg-muted text-muted-foreground' },
  { code: 'incomplete', label: 'Incomplete requirements', className: 'bg-alert-error-bg text-warning-foreground' },
  { code: 'no_service', label: 'No service', className: 'bg-muted text-muted-foreground' },
] as const;

type WalkInStatus = (typeof WALK_IN_STATUSES)[number]['code'];
type WalkInPurpose = (typeof WALK_IN_PURPOSES)[number]['code'];

export function walkInPurposeLabel(code: string): string {
  return WALK_IN_PURPOSES.find((p) => p.code === code)?.label ?? code;
}
export function walkInStatusLabel(code: string): string {
  return WALK_IN_STATUSES.find((s) => s.code === code)?.label ?? code;
}
export function walkInStatusClass(code: string): string {
  return WALK_IN_STATUSES.find((s) => s.code === code)?.className ?? 'bg-muted text-muted-foreground';
}
