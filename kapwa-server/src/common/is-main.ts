import { pathToFileURL } from 'node:url';

/**
 * ESM replacement for `require.main === module`: true when the file is the
 * process entrypoint (compiled dist path or ts-node/tsx source path).
 */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  return !!entry && metaUrl === pathToFileURL(entry).href;
}
