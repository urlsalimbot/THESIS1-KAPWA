import { createRequire } from 'node:module';

/**
 * Bridge for lazily-loaded CommonJS-only dependencies (pdfkit, exceljs,
 * csv-stringify, twilio). A static import would load them at boot; the
 * builders only pay for them when an export actually runs.
 */
export const nodeRequire = createRequire(import.meta.url);
