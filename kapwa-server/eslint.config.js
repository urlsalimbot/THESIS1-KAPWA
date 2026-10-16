const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Pragmatic relaxations for this codebase:
      '@typescript-eslint/no-explicit-any': 'off',
      // Dynamic require() is used deliberately for lazy-loaded heavy/optional
      // deps (pdfkit, csv-stringify, twilio, crypto).
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Every `query()` in the request path must be parameterized. Building SQL
    // with a template literal is the classic injection shape, and there is no
    // reason for it outside the schema layer — request-path code passes values
    // as `$1` (the parameterized call is the same length). The one deliberate
    // exception is `src/database/**`, where migrations and the bootstrap build
    // DDL identifiers, which Postgres will not accept as parameters; that code
    // validates its identifiers instead (see database/sequences.ts).
    files: ['src/**/*.ts', 'test/**/*.ts'],
    ignores: ['src/database/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // A template literal passed to `query()` is fine — that is how the
          // parameterized multi-line SQL is written. What must not happen is an
          // *interpolation* inside it: `${id}` becomes part of the statement
          // instead of a bound `$1`. The selector therefore matches the
          // expression nodes inside the literal, not the literal itself.
          selector:
            "CallExpression[callee.property.name='query'] > TemplateLiteral:first-child > :matches(Identifier, CallExpression, MemberExpression, ConditionalExpression, BinaryExpression)",
          message:
            'Parameterize SQL: pass values as $1 instead of interpolating them (see docs/system-audit-2026-10-16.md §4.3).',
        },
      ],
    },
  },
  {
    // The structural exceptions, reviewed line by line in the 2026-10-16 audit:
    // these six build the *shape* of a statement — a whitelisted table name
    // (sync's `resolveTableName` + `sanitizePayload`), a constant fragment
    // (`lookup`, `withdrawnFilter`, `statusClause`), a clause whose own values
    // are bound as `$n` (dashboard, audit, the tracker queries) — while every
    // value travels as a parameter. Postgres cannot bind an identifier, so the
    // rule cannot be satisfied literally here; it stays a warning so the sites
    // remain visible in review without failing the build.
    files: [
      'src/access-cards/access-cards.service.ts',
      'src/audit/audit.service.ts',
      'src/cases/case-step-locks.service.ts',
      'src/cases/cases.service.ts',
      'src/dashboard/dashboard.service.ts',
      'src/sync/sync.service.ts',
    ],
    rules: {
      'no-restricted-syntax': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];