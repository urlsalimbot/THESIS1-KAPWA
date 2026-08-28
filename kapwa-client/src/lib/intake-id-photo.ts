import { uploadWithProgress } from './api';

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
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('category', 'id_photo');
  formData.append('caseId', caseId);
  try {
    await uploadWithProgress('/filing/upload', formData, () => {});
    pendingIdPhoto = null;
    return true;
  } catch {
    return false;
  }
}