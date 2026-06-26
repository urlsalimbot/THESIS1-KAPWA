import { useState, useCallback } from 'react';

interface ReportsExportButtonProps {
  endpoint: string;
  format: 'pdf' | 'csv' | 'xlsx';
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function ReportsExportButton({
  endpoint,
  format,
  label = 'Export',
  disabled = false,
  className = '',
}: ReportsExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const url = `${baseUrl}${endpoint}?format=${format}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${endpoint.replace(/^\//, '').replace(/\//g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setError(err.message || 'Export failed');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [endpoint, format, loading, disabled]);

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className={`rounded bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-dark disabled:opacity-50 ${className}`}
      >
        {loading ? 'Generating...' : label}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
