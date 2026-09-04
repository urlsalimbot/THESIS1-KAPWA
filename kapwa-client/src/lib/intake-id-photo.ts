import { uploadWithProgress } from './api';
import { mutate } from 'swr';
import { queryKeys } from './query-keys';

let pendingBeneficiaryIdPhoto: File | null = null;
let pendingClaimantIdPhoto: File | null = null;

export function setPendingBeneficiaryIdPhoto(file: File | null): void {
  pendingBeneficiaryIdPhoto = file;
}
export function getPendingBeneficiaryIdPhoto(): File | null {
  return pendingBeneficiaryIdPhoto;
}
export function setPendingClaimantIdPhoto(file: File | null): void {
  pendingClaimantIdPhoto = file;
}
export function getPendingClaimantIdPhoto(): File | null {
  return pendingClaimantIdPhoto;
}
export function clearPendingIdPhoto(): void {
  pendingBeneficiaryIdPhoto = null;
  pendingClaimantIdPhoto = null;
}

async function uploadOne(caseId: string, file: File | null, notes: 'beneficiary' | 'claimant'): Promise<boolean> {
  if (!file) return true;
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('category', 'id_photo');
  formData.append('caseId', caseId);
  formData.append('notes', notes);
  try {
    await uploadWithProgress('/filing/upload', formData, () => {});
    return true;
  } catch {
    return false;
  }
}

export async function uploadIntakeIdPhotos(caseId: string): Promise<boolean> {
  const beneficiary = pendingBeneficiaryIdPhoto;
  pendingBeneficiaryIdPhoto = null;
  const claimant = pendingClaimantIdPhoto;
  pendingClaimantIdPhoto = null;

  const uploadedAny = !!(beneficiary || claimant);
  const okBen = await uploadOne(caseId, beneficiary, 'beneficiary');
  const okClaim = await uploadOne(caseId, claimant, 'claimant');

  // Only touch the filing cache when at least one photo was actually uploaded.
  if (uploadedAny && okBen && okClaim) {
    mutate(queryKeys.filing.byCase(caseId));
    mutate(queryKeys.filing.caseIdPhoto(caseId));
  }
  return okBen && okClaim;
}