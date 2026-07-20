export function phTime(): string {
  const now = new Date();
  const phOffset = 8 * 60;
  const phLocal = new Date(now.getTime() + phOffset * 60 * 1000);
  return phLocal.toISOString().replace('Z', '+08:00');
}
