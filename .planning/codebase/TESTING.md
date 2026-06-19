# Testing Patterns

**Analysis Date:** 2026-06-19

## Test Framework

**Server (NestJS):**
- **Runner:** Jest v29.7.0
- **Config:** `kapwa-server/jest.config.ts`
- **Transform:** ts-jest
- **Assertion:** Jest built-in (`expect`)
- **Run Commands:**
  ```bash
  npm test              # jest --coverage (in kapwa-server/)
  npm run test:watch    # jest --watch
  npm run test:cov      # jest --coverage
  npm run test:unit     # jest --testPathPattern=unit
  ```

**Client (React):**
- **Runner:** Vitest v1.2.0
- **Config:** `kapwa-client/vitest.config.ts`
- **Environment:** jsdom (DOM simulation)
- **Assertion:** Vitest built-in (`expect`)
- **Run Commands:**
  ```bash
  npm test              # vitest (in kapwa-client/)
  npm run test:run      # vitest run
  ```

## Test File Organization

**Server — Co-located with source:**
- Test files sit next to the code they test: `src/auth/auth.service.spec.ts`
- Pattern: `*.spec.ts` — configured via `testRegex: '.*\\.spec\\.ts$'`
- Directory:
  ```
  src/
  ├── auth/
  │   ├── auth.service.ts
  │   ├── auth.service.spec.ts    ← co-located
  │   ├── auth.controller.ts
  │   └── ...
  ├── sync/
  │   ├── sync.service.ts
  │   ├── sync.service.spec.ts    ← unit
  │   ├── sync.integration.spec.ts ← integration
  │   └── ...
  ```

**Client — Separate `tests/` directory:**
- Test files in `kapwa-client/tests/` directory
- Pattern: `*.test.ts` — configured via `include: ['tests/**/*.test.ts']`
- Directory:
  ```
  tests/
  ├── setup.ts            # global test setup
  ├── e2e.test.ts         # E2E tests against running server
  └── sync-conflict.test.ts # unit tests for conflict resolution
  ```

**Coverage Configuration (Server):**
- Collects from all `src/` TypeScript files except:
  - `*.interface.ts`
  - `*.module.ts`
  - `main.ts`
  - `database/**`
- Output: `coverage/` at project root

**Coverage (Client):**
- Not explicitly configured in vitest config — defaults apply

## Test Structure

**Server (NestJS) — Standard pattern:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from './user.entity';

// Module-level mock for external libraries
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let repoMock: Partial<Repository<User>>;

  beforeEach(async () => {
    // 1. Create mock objects
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // 2. Compile NestJS testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repoMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    // 3. Get service from module
    service = module.get<AuthService>(AuthService);
  });

  // 4. "should be defined" sanity check
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 5. Grouped method tests
  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue({ id: '1' });
      await expect(service.register({ email: 'test@test.com', password: 'pass' }))
        .rejects.toThrow('Email already registered');
    });
  });
});
```

**Client (Vitest) — Standard pattern:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({ execute: vi.fn().mockResolvedValue([]) })
}));

describe('Sync Conflict Resolution', () => {
  describe('mergeRecords', () => {
    it('should keep server version for financial fields', () => {
      const server = { amount: 1000, status: 'approved' };
      const client = { amount: 2000, status: 'disbursed' };
      const result = mergeRecords(server as any, client as any);
      expect(result.amount).toBe(1000);
    });
  });
});
```

**Common Patterns:**
- `describe` blocks: 2-3 levels deep (module > method > scenario)
- `it('should ...')` phrasing for test descriptions
- `beforeEach` for fresh mocks per test
- `async` tests with `await expect(...).rejects.toThrow()` pattern for error cases
- `.todo()` for planned but unimplemented tests (`it.todo('should apply Server Wins...')`)

## Mocking

**Framework (Server):** Jest `jest.fn()` and `jest.mock()`
**Framework (Client):** Vitest `vi.fn()` and `vi.mock()`

**Repository Mock Pattern (Server):**
```typescript
// Mock object matching Repository<T> shape
repoMock = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  findAndCount: jest.fn(),
};
```

**External Library Mock (Server):**
```typescript
jest.mock('bcrypt');  // module-level mock
// Then in tests:
(bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
(bcrypt.compare as jest.Mock).mockResolvedValue(true);
```

**Vitest `vi.mock` Pattern (Client):**
```typescript
vi.mock('../src/lib/offline-queue', () => ({
  getPendingChanges: vi.fn().mockResolvedValue([]),
  getConflictChanges: vi.fn().mockResolvedValue([]),
  getVersionVector: vi.fn().mockResolvedValue({ localVersion: 1, serverVersion: 0 }),
  queueChange: vi.fn().mockResolvedValue({ id: 'test-1' }),
  markSynced: vi.fn(),
  markConflict: vi.fn(),
  resolveConflict: vi.fn()
}));
```

**QueryRunner Mock (Server — integration tests):**
```typescript
queryRunnerMock = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  query: jest.fn().mockImplementation((sql, params) => {
    if (sql.startsWith('SELECT')) {
      const tableMatch = sql.match(/FROM "(\w+)"/);
      return Promise.resolve(records[tableMatch?.[1] || ''] || []);
    }
    return Promise.resolve([]);
  }),
};
```

**What to Mock:**
- TypeORM repositories (all CRUD operations)
- External services (JwtService, SmsGatewayService, ConflictResolver)
- Browser APIs in client tests (`window.crypto`, `navigator`)
- Third-party libraries (`bcrypt`, `crypto`)

**What NOT to Mock:**
- The service/class under test (test the real implementation)
- Simple value objects, type definitions

## Fixtures and Factories

**Inline fixtures in test files:**
- Test data is defined inline within each test (no separate fixture files)
- User objects, change records, and sync payloads constructed in the test body:
  ```typescript
  const user = { id: '1', email: 'a@a.com', password: 'hashed' } as User;
  const change: QueuedChange = {
    id: '1', tableName: 'cases', recordId: 'c1', operation: 'UPDATE',
    payload: { status: 'approved' }, clientUpdatedAt: new Date().toISOString(),
    serverVersion: 1, status: 'pending', retryCount: 0
  };
  ```
- Factory helper functions used in sync tests:
  ```typescript
  function signMsg(deviceId: string, changes: any[]): string { ... }
  function setupDataSource(records: Record<string, any[]> = {}) { ... }
  ```

**No external fixture files** — all test data is inline in spec files.

## Test Setup

**Client setup** (`kapwa-client/tests/setup.ts`):
```typescript
// Global beforeAll — mock Web Crypto API
beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random(),
      subtle: { importKey: vi.fn(), sign: vi.fn() }
    }
  });
});

// Per-test beforeEach — mock navigator
beforeEach(() => {
  vi.stubGlobal('navigator', {
    onLine: true,
    geolocation: { getCurrentPosition: vi.fn() }
  });
});

// Per-test afterEach — clean up mocks
afterEach(() => {
  vi.restoreAllMocks();
});
```

## Test Types

**Unit Tests:**
- Server: Isolated service tests with mocked repositories. 17 spec files found with ~150+ test cases covering services like `auth.service.spec.ts`, `users.service.spec.ts`, `filing.service.spec.ts`, `csr.service.spec.ts`, `chat.service.spec.ts`, `sync.service.spec.ts`, `tracker.service.spec.ts`, `dashboard.service.spec.ts`, `notifications.service.spec.ts`, `cases.service.spec.ts`, `interventions.service.spec.ts`, `programs.service.spec.ts`, `otp.service.spec.ts`, `access-cards.service.spec.ts`, `lcr.service.spec.ts`, `sla.service.spec.ts`, `abac.service.spec.ts`
- Client: Unit tests in `sync-conflict.test.ts` testing offline queue logic and conflict resolution
- Not all server controllers have corresponding spec files

**Integration Tests:**
- `sync.integration.spec.ts` — end-to-end sync flow with mocked DataSource, tests conflict detection, idempotency, and resolution paths
- Uses `Test.createTestingModule` with full provider setup (same pattern as unit tests)

**E2E Tests:**
- `kapwa-client/tests/e2e.test.ts` — full HTTP E2E tests against live backend at `http://localhost:3000/api`
- Tests register → login → CRUD → FSM transitions → dashboard metrics
- Tests offline-queue, sync, and Web Crypto APIs via dynamic imports
- Uses `fetch` directly (no supertest), `faker` for test data generation
- Wrapper script at `tests/run-tests.sh` starts Docker PostgreSQL, then runs client tests

**Not found:**
- No Playwright or Cypress browser E2E tests
- No contract/snapshot tests
- No performance/load tests

## Common Patterns

**Async Testing — Promise rejection (Server):**
```typescript
it('should throw ConflictException if email exists', async () => {
  (repoMock.findOne as jest.Mock).mockResolvedValue({ id: '1', email: 'test@test.com' });
  await expect(service.register({ email: 'test@test.com', password: 'pass' }))
    .rejects.toThrow('Email already registered');
});
```

**Async Testing — Promise resolution (Server):**
```typescript
it('should hash password and save user', async () => {
  (repoMock.findOne as jest.Mock).mockResolvedValue(null);
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  const result = await service.register({ email: 'test@test.com', password: 'pass' });
  expect(bcrypt.hash).toHaveBeenCalledWith('pass', 12);
  expect(result).toHaveProperty('id');
});
```

**Async Testing — Client E2E (fetch-based):**
```typescript
it('should register new user', async () => {
  const email = faker.internet.email();
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test1234', role: 'social_worker', fullName: 'Test Worker' })
  });
  expect(res.ok).toBe(true);
  const user = await res.json();
  expect(user.email).toBe(email);
});
```

**Idempotency Testing (Server):**
```typescript
it('returns cached result for duplicate idempotency key', async () => {
  const first = await service.processDelta(batch);
  const second = await service.processDelta(batch);
  expect(second).toEqual(first);
});
```

**Numeric Tests in Conflict Resolver — numbered comments for coverage tracking:**
```typescript
// 1. Server wins for financial tables
it('1/12: server_wins for financial tables (interventions)', () => { ... });
// 2. Server wins for disbursements
it('2/12: server_wins for financial tables (disbursements)', () => { ... });
```

## Coverage

**Server Requirements:**
- `npm test` runs with `--coverage` by default
- Coverage directory: `kapwa-server/coverage/`
- Exclusions: interfaces, modules, main.ts, database/

**Client Requirements:**
- No coverage config in vitest.config.ts (defaults apply)
- No coverage enforcements detected

---

*Testing analysis: 2026-06-19*
