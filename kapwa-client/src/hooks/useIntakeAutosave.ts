import { useEffect } from 'react';

const STORAGE_KEY = 'kapwa:intake:draft';
const DEBOUNCE_MS = 2000;

export interface IntakeDraft {
  data: unknown;
  savedAt: string;
}

export function useIntakeAutosave<T>(formData: T) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: formData, savedAt: new Date().toISOString() } as IntakeDraft));
      } catch {
        // storage full or unavailable — ignore
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [formData]);
}

export function loadDraft(): IntakeDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntakeDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
