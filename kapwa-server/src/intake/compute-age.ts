export function computeAgeFromDob(dob: Date | string): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(birth.getTime())) return NaN;
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob) && !isRealIsoDate(dob, birth)) {
    return NaN;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function isRealIsoDate(input: string, birth: Date): boolean {
  const [y, m, d] = input.split('-').map(Number);
  return birth.getUTCFullYear() === y && birth.getUTCMonth() + 1 === m && birth.getUTCDate() === d;
}
