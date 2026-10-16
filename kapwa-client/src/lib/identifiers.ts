/**
 * How a login identifier is normalised before it reaches the API.
 *
 * Office-issued claimant IDs look like `CLM-000123`: letters, a dash, digits.
 * They are usernames, not addresses, so they must travel exactly as printed on
 * the slip — appending a domain to one would send the server an address nobody
 * owns. Everything else without an `@` is the local shorthand the staff type
 * (`admin`), which still gets the domain.
 */
export const OFFICE_ISSUED_ID = /^[A-Za-z]{2,4}-\d/;

export function normalizeLoginIdentifier(raw: string): string {
  const value = raw.trim();
  return value.includes('@') || OFFICE_ISSUED_ID.test(value) ? raw : `${raw}@mswdo.test`;
}

/** True when the identifier is an office-issued ID rather than an email. */
export function isOfficeIssuedId(raw: string): boolean {
  return OFFICE_ISSUED_ID.test(raw.trim());
}
