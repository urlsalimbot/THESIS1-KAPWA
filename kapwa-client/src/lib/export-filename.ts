// Client mirror of the server's exportFileName helper
// (kapwa-server/src/common/constants.ts). All case-document exports follow
// `<CaseType> <caseNumber>-<YYYY>-<MM>-<DD>.pdf` (docs/FUNCTIONALITY.md §12).
// The server-provided Content-Disposition filename is always preferred; this
// is the last-resort fallback so the shape stays correct if that header is
// missing or stripped.
export function exportFileName(caseType: string, caseNumber: string, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${caseType} ${caseNumber}-${y}-${m}-${d}.pdf`;
}
