import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The intervention and program-type catalogs — the indexed vocabulary shared by
 * the server (seeds, zod schemas, enrollment service) and the client
 * (intervention logging UIs). The canonical list lives in
 * `docs/superpowers/specs/case-catalog.json`; each side mirrors it in code and
 * a parity spec ties the two copies to the file, so a catalog change lands in
 * both surfaces or fails loudly.
 *
 * Sources (research-verified 2026-10-04): DSWD AO 10 s. 2007 intervention and
 * diversion program examples; Quezon MSWDO Operation Manual 2025 helping
 * strategies; see design spec Appendix B/C.
 */

const CATALOG = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'docs', 'superpowers', 'specs', 'case-catalog.json'), 'utf8'),
) as { interventionTypes: string[]; programTypes: string[] };

export const INTERVENTION_TYPES: readonly string[] = CATALOG.interventionTypes;
export const PROGRAM_TYPES: readonly string[] = CATALOG.programTypes;

/** The 22-code catalog as a zod enum literal tuple. */
export const INTERVENTION_TYPE_VALUES = INTERVENTION_TYPES as unknown as [
  string, ...string[],
];