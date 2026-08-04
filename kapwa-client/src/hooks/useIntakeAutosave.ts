import { useEffect } from 'react';

const DRAFT_PREFIX = 'kapwa:intake:draft';
const LEGACY_STORAGE_KEY = 'kapwa:intake:draft';
const DEBOUNCE_MS = 2000;

// One-time migration: drafts written before user-scoping may hold leaked PII under
// the legacy unscoped key — purge it on load.
try {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
} catch {
  // storage unavailable — ignore
}

export interface IntakeDraft {
  data: unknown;
  savedAt: string;
}

export function getDraftKey(userId: string): string {
  return `${DRAFT_PREFIX}:${userId}`;
}

export function useIntakeAutosave<T>(formData: T, userId: string) {
  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(getDraftKey(userId), JSON.stringify({ data: formData, savedAt: new Date().toISOString() } as IntakeDraft));
      } catch {
        // storage full or unavailable — ignore
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [formData, userId]);
}

export function loadDraft(userId: string): IntakeDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as IntakeDraft;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(getDraftKey(userId));
  } catch {
    // ignore
  }
}
