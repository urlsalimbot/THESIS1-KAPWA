// Glyph-safe formatting helpers for generated PDFs. pdfkit's built-in
// Helvetica family uses WinAnsi encoding, which lacks the peso sign (₱) and
// arrows (→), so printing them renders "±" / "!'". Every export routes money,
// dates, and status flows through these helpers instead.

const EXPORT_TZ = 'Asia/Manila';

export function php(amount: unknown): string {
  const n = Number(amount);
  if (amount == null || Number.isNaN(n)) return '';
  return `Php ${n.toLocaleString('en-PH')}`;
}

export function fmtDateLong(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    timeZone: EXPORT_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function fmtDateTime(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-PH', {
    timeZone: EXPORT_TZ,
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${fmtDateLong(d)}, ${time}`;
}

// Status transitions print as "Enrolled -> Assessed" (ASCII) because the arrow
// glyph is not in the PDF base font set.
export function flowArrow(from: string, to: string): string {
  return `${from} -> ${to}`;
}
