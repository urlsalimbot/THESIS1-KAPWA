import { useCallback, useEffect, useRef } from 'react';

interface FocusTrapProps {
  active: boolean;
  children: React.ReactNode;
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FocusTrap({ active, children, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement as HTMLElement | null;

      const isTabForward = !e.shiftKey;

      if (isTabForward && !focusable.slice(1).some(el => el === current)) {
        const shouldWrap = current !== last;
        if (shouldWrap) {
          e.preventDefault();
          first.focus();
        }
      }

      if (!isTabForward && !focusable.slice(0, -1).some(el => el === current)) {
        const shouldWrap = current !== first;
        if (shouldWrap) {
          e.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape, getFocusableElements]);

  useEffect(() => {
    if (!active) return;
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [active, getFocusableElements]);

  return <div ref={containerRef}>{children}</div>;
}
