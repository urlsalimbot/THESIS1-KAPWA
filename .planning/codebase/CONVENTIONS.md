# Coding Conventions

**Analysis Date:** 2026-06-19

## Naming Patterns

**Files:**
- **Client (React):** PascalCase for components (`ChainViewer.tsx`, `ProtectedRoute.tsx`, `JsonSchemaForm.tsx`), camelCase for utilities (`auth-context.tsx`, `offline-queue.ts`, `api.ts`)
- **Server (NestJS):** kebab-case for module directories (`access-cards/`, `auth/`, `beneficiaries/`), PascalCase for class files (`auth.service.ts`, `auth.controller.ts`, `user.entity.ts`), lowercase with dots for DTO/test files (`auth.zod.ts`, `auth.service.spec.ts`)

**Functions:**
- **Client:** camelCase for all functions — `handleSubmit`, `handleChange`, `fetchUser`, `resolveMfa`, `cancelMfa`, `markAsRead`, `handleClickOutside`
- **Server (NestJS):** camelCase for service methods — `register()`, `validateUser()`, `login()`, `findById()`, `setupMfa()`, `enableMfa()`, `generateCode()`, `logService()`

**Variables:**
- camelCase throughout — `formData`, `unreadCount`, `pendingCount`, `dropdownRef`, `authorized`, `mfaChallenge`, `mfaCode`
- `const` for constants/immutable values, `let` for mutable state refs, no `var`
- Destructuring heavily used — `const { user, token, login } = useAuth()`, `const [formData, setFormData] = useState(...)`

**Types:**
- PascalCase interfaces — `User`, `AuthContextType`, `NavItem`, `JsonSchema`, `FieldSchema`, `ProtectedRouteProps`, `Notification`, `QueuedChange`, `VersionVector`, `SyncOperation`
- Enum PascalCase with UPPER values — `UserRole { SW = 'social_worker', ADMIN = 'admin', ... }`
- Zod schemas PascalCase with Schema suffix — `UserCreateSchema`, `LoginSchema`, `MfaEnableSchema`
- Inferred types from Zod: `UserCreateInput = z.infer<typeof UserCreateSchema>`
- React component props defined as inline interfaces with `Props` suffix or within file

**Constants:**
- UPPER_SNAKE_CASE for module-level primitives — `API`, `QUEUE_KEY`, `VERSION_KEY`, `AUTH_KEY`, `REFRESH_KEY`, `USER_KEY`, `MIN_PASSWORD_LENGTH`, `BCRYPT_SALT_ROUNDS`, `PBKDF2_ITERATIONS`, `STORAGE_KEY`, `DB_KEY`

## Code Style

**Formatting:**
- No Prettier or Biome config detected. Code style appears to follow TypeScript defaults.
- 2-space indentation inferred from file content
- Semicolons used consistently
- Single quotes preferred for strings (`'string'` not `"string"`)

**Linting:**
- **Server:** ESLint configured with `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` — run via `npm run lint` in `kapwa-server/` which executes `eslint "{src,test}/**/*.ts" --fix`
- **Client:** No ESLint config detected
- TypeScript strict mode enabled in both projects, `noUnusedLocals: false` and `noUnusedParameters: false` in client

## Import Organization

**Order (both client and server):**

1. **External framework imports** (React, NestJS, third-party)
   ```typescript
   import React, { useState, useCallback } from 'react';
   import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
   ```

2. **Project-specific imports** (relative paths)
   ```typescript
   import { useAuth } from '../lib/auth-context';
   import { AuthService } from './auth.service';
   ```

3. **CSS imports** (client only)
   ```typescript
   import '../index.css';
   ```

**No blank-line grouping within the import block** — imports are grouped implicitly by path depth (external > internal).

**Path Aliases:**
- **Server:** `@/*` maps to `src/*` via tsconfig paths
- **Client:** No path aliases detected; all imports are relative (`../lib/auth-context`, `../components/Layout`)

## Error Handling

**Patterns:**

- **Server (NestJS):** Use `@nestjs/common` exception classes via `throw new`:
  ```typescript
  throw new ConflictException('Email already registered');
  throw new UnauthorizedException('Invalid credentials');
  throw new BadRequestException('Invalid TOTP code');
  throw new NotFoundException('User not found');
  ```

- **Client (React):** Try/catch blocks in async functions, throwing `Error`:
  ```typescript
  try {
    const data = await login(email, password);
  } catch (err) {
    setError('Invalid email or password');
  }
  ```

- **Client API layer:** `apiFetch` utility in `kapwa-client/src/lib/api.ts` throws on non-ok responses:
  ```typescript
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  ```

- **Global filter:** `AllExceptionsFilter` in `kapwa-server/src/common/filters/http-exception.filter.ts` catches all exceptions globally and returns structured JSON:
  ```typescript
  response.status(status).json({
    statusCode: status,
    message: ...,
    timestamp: new Date().toISOString(),
    path: request.url,
  });
  ```

## Logging

**Framework:**
- **Server:** NestJS `Logger` class — `private readonly logger = new Logger(AuthService.name)` — used in services, filters, and main
- **Client:** `console.error` with component prefix — `console.error("NotificationsDropdown:", e)` or `console.error("AuthContext:", e)`

**Patterns:**
- Server: `this.logger.error(...)` for exceptions in catch blocks and global filter
- Client: `console.error("ComponentName:", error)` in catch blocks only (no info/debug/warn logging found)

## Comments

**When to Comment:**
- Minimal comments overall — code is largely self-documenting
- Block comments `// Note: ...` used for architectural notes (e.g., `// Token rotation: verify version still matches`)
- Section divider comments used in `index.css` (e.g., `/* Header */`, `/* Sidebar */`, `/* Cards */`)
- Section dividers in `api.ts`: `// ===== CSR =====`

**JSDoc/TSDoc:**
- Not used in source files. No JSDoc/TSDoc annotations found on any functions or classes.
- NestJS Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`) on controllers serve as documentation instead

## Function Design

**Size:**
- Page components and services average 50-150 lines
- Utility files average 100-150 lines
- Single-responsibility functions (e.g., `fetchUser`, `cancelMfa`, `incrementLocalVersion`) are short (5-15 lines)

**Parameters:**
- Named parameters via destructured objects for complex configs — `({ email, password, role, fullName })`, `({ children, roles })`
- Simple parameters inline for straightforward functions — `(email, password)`, `(id, code)`

**Return Values:**
- Async functions return `Promise<T>` or `Promise<void>`
- React hooks return state values directly
- Service methods return plain objects or throw on error

## Module Design

**Exports:**
- Named exports for all components and utilities — `export function LoginPage()` not `export default function LoginPage()`
- Exception: `JsonSchemaForm.tsx` and `NotificationsDropdown.tsx` use `export default`

**Barrel Files:**
- Not used. Each module imports directly from specific files.
- Server modules use `@Module` decorators with explicit provider/controller/import lists

## React Patterns

**Hooks:**
- `useState`, `useEffect`, `useCallback`, `useRef`, `useNavigate`, `useLocation` from React/React Router
- Custom hooks: `useAuth()` in `auth-context.tsx`
- `useCallback` used for handlers passed as props (`handleChange`, `validate`, `handleSubmit` in `JsonSchemaForm.tsx`)

**Component Patterns:**
- Function components with hooks (no class components except `ErrorBoundary`)
- Props interface defined above component
- Context API via `createContext` + `useContext` for auth state
- `ProtectedRoute` pattern wrapping children with role-based access

## Server Patterns (NestJS)

**Module Structure:**
```
module-name/
├── dto/
│   └── module-name.zod.ts    # Zod validation schemas
├── module-name.controller.ts # Route handlers
├── module-name.service.ts    # Business logic
├── module-name.module.ts     # Module definition (DI)
├── module-name.entity.ts     # TypeORM entity (if DB-backed)
├── constants.ts              # Module-level constants
└── module-name.service.spec.ts # Tests (co-located)
```

**Validation:**
- Zod schemas for request validation, applied via `ZodPipe` — `@Body(new ZodPipe(UserCreateSchema))`
- `class-validator` and `class-transformer` in dependencies but Zod is the primary validation mechanism
- Zod schemas in `dto/*.zod.ts` files per module

**Decorators:**
- `@Injectable()`, `@Controller()`, `@Module()`, `@Entity()` — standard NestJS/TypeORM decorators
- `@Get()`, `@Post()`, `@Patch()`, `@Delete()`, `@Param()`, `@Body()`, `@Query()`, `@Request()`
- `@UseGuards(JwtAuthGuard)`, `@UseGuards(AuthGuard('jwt'))`, `@Roles('admin')`
- `@InjectRepository()` for TypeORM repository injection
- Swagger decorators on controller methods

**Dependency Injection:**
- Constructor-based injection — `constructor(private userRepo: Repository<User>, private jwtService: JwtService) {}`
- Providers registered in module files

---

*Convention analysis: 2026-06-19*
