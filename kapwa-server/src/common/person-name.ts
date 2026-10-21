/**
 * Person-name display formatting.
 *
 * The schema stores the full middle name (`middle_name TEXT`) and the app shows
 * it in full — "Pedro Poblete Reyes". Initials are never generated for the
 * application's own screens; the only surfaces that still abbreviate are the
 * official documents that were designed to print a middle initial (the
 * Certificate of Eligibility / Petty Cash Voucher, the GIS household lines and
 * the inter-agency endorsement letter), which call `middleInitialOf`
 * explicitly.
 */

/** Middle name as a single initial — `"Poblete"` → `"P."`; empty-safe. */
export function middleInitialOf(middleName?: string | null): string {
  const name = middleName?.trim();
  return name ? `${name.charAt(0).toUpperCase()}.` : '';
}

/** `"Pedro Poblete Reyes Jr."` — first-name-first full name, middle in full. */
export function displayFullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
  nameExtension?: string | null;
}): string {
  return [parts.firstName, parts.middleName, parts.surname, parts.nameExtension]
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}
