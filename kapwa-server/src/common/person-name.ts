/**
 * Person-name display formatting.
 *
 * The schema stores the full middle name (`middle_name TEXT`), but every
 * full-name surface in the app displays it abbreviated to an initial —
 * "Pedro P. Reyes". The one deliberate exception is the beneficiary view
 * page in the client, which shows the middle name in full.
 */

/** Middle name as a single initial — `"Poblete"` → `"P."`; empty-safe. */
export function middleInitialOf(middleName?: string | null): string {
  const name = middleName?.trim();
  return name ? `${name.charAt(0).toUpperCase()}.` : '';
}

/**
 * `"Pedro P. Reyes Jr."` — first-name-first full name with the middle name
 * abbreviated to an initial. Empty parts are dropped, so no double spaces.
 */
export function displayFullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
  nameExtension?: string | null;
}): string {
  return [parts.firstName, middleInitialOf(parts.middleName), parts.surname, parts.nameExtension]
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}
