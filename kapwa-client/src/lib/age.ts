/**
 * Age in completed years as of today — birthday-aware.
 *
 * A raw year difference (`getFullYear() - getFullYear()`) over-counts by one
 * until the birthday passes: someone born 1978-11-02 stays 47 until November.
 * Single source of truth for the case page sidebar, the beneficiaries list,
 * the beneficiary profile and the intake form.
 *
 * `YYYY-MM-DD` inputs are parsed as LOCAL calendar dates: `new Date('1978-11-02')`
 * means UTC midnight, which lands on the previous day in negative-offset
 * timezones and would shift birthdays by one. Splitting the components keeps
 * the birthday anchored to the calendar date the user saw, in any timezone.
 */
export function computeAge(dob: string | null | undefined): number {
  if (!dob) return 0;
  const parts = dob.split('-').map(Number);
  const isIsoDate = parts.length === 3 && parts.every((p) => Number.isFinite(p));
  const birth = isIsoDate ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}