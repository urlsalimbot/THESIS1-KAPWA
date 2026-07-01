interface AriaLiveRegionProps {
  message: string;
  role?: 'alert' | 'status' | 'log';
  'aria-live'?: 'polite' | 'assertive' | 'off';
  children?: React.ReactNode;
}

export function AriaLiveRegion({
  message,
  role = 'status',
  'aria-live': ariaLive = 'polite',
  children,
}: AriaLiveRegionProps) {
  const label = message || children?.toString() || '';
  return (
    <div
      aria-live={ariaLive}
      aria-atomic="true"
      role={role}
      className="sr-only"
    >
      {label}
    </div>
  );
}
