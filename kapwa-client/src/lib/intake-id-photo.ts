import { uploadWithProgress } from './api';
import { mutate } from 'swr';
import { queryKeys } from './query-keys';

let pendingIdPhoto: File | null = null;

export function setPendingIdPhoto(file: File | null): void {
  pendingIdPhoto = file;
}
export function getPendingIdPhoto(): File | null {
  return pendingIdPhoto;
}
export function clearPendingIdPhoto(): void {
  pendingIdPhoto = null;
}

export async function uploadIntakeIdPhoto(caseId: string): Promise<boolean> {
  const file = pendingIdPhoto;
  if (!file) return true;
  pendingIdPhoto = null;
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('category', 'id_photo');
  formData.append('caseId', caseId);
  try {
    await uploadWithProgress('/filing/upload', formData, () => {});
    mutate(queryKeys.filing.byCase(caseId));
    mutate(queryKeys.filing.caseIdPhoto(caseId));
    return true;
  } catch {
    return false;
  }
}