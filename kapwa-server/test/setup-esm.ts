import { jest } from '@jest/globals';

// Jest injects `describe`/`it`/`expect` into ESM test files but not the `jest`
// object itself. Re-expose it so the existing 140+ specs keep the familiar API.
(globalThis as unknown as { jest: typeof jest }).jest = jest;
