import { fileURLToPath } from 'node:url';

/**
 * `__dirname` equivalent for ESM. The `import.meta.dirname` shorthand is not
 * available in Jest's ESM VM, so every call site passes `import.meta.url`
 * through here instead.
 */
export function esmDirname(metaUrl: string): string {
  return fileURLToPath(new URL('.', metaUrl));
}
