# Technology Stack

**Analysis Date:** 2026-06-19

## Languages

**Primary:**
- TypeScript 5.3+ - Both client (`kapwa-client/`) and server (`kapwa-server/`)

**Secondary:**
- JavaScript (ES2020+) - Configuration files, scripts
- SQL (PostgreSQL) - Database migrations in `kapwa-server/src/database/migrations/`

## Runtime

**Environment (Server):**
- Node.js 20 (LTS) - Backend runtime via `kapwa-server/Dockerfile`

**Environment (Client):**
- Browser (PWA) + Capacitor 6 (Android/iOS native wrappers)

**Package Manager:**
- npm — Both client and server use npm with lockfiles
- Lockfile: Present (`kapwa-client/package-lock.json`, `kapwa-server/package-lock.json`)

## Frameworks

**Server Core:**
- NestJS 11.1 (via `@nestjs/core`, `@nestjs/common`) - Backend framework
- Express platform via `@nestjs/platform-express`
- TypeORM 0.4 alpha - ORM for PostgreSQL (`@nestjs/typeorm` 11.0)

**Client Core:**
- React 18.2 - UI library (`kapwa-client/package.json`)
- Vite 8.0 - Build tool and dev server
- Tailwind CSS 3.4 - Utility-first CSS framework

**Mobile:**
- Capacitor 6.2 - Native mobile wrapper (`@capacitor/android`, `@capacitor/ios`, `@capacitor/core`, `@capacitor/filesystem`)

**Real-time:**
- Socket.IO 4.8 - WebSocket communication (both server `@nestjs/platform-socket.io` and client `socket.io-client`)

**Testing:**
- Jest 29.7 - Server-side testing (`kapwa-server/jest.config.ts`)
- Vitest 1.2 - Client-side testing (`kapwa-client/vitest.config.ts`)
- Playwright 1.59 - E2E browser testing

**Build/Dev:**
- Vite 8.0 - Client dev server (port 3001)
- NestJS CLI 11.0 - Server scaffolding
- ts-jest 29.1 - TypeScript Jest transformer
- ts-node 10.9 - TypeScript execution for tools

## Key Dependencies

**Critical (Server):**
- `pg` 8.11 - PostgreSQL client driver
- `@nestjs/jwt` 10.2, `@nestjs/passport` 10.0, `passport`, `passport-jwt`, `passport-local` - JWT authentication
- `bcrypt` 5.1 - Password hashing
- `typeorm` 0.4 alpha - ORM framework
- `class-validator` 0.14, `class-transformer` 0.5 - DTO validation (legacy)
- `zod` 3.22 - Schema validation
- `twilio` 6.0 - SMS gateway for OTP and notifications
- `pdfkit` 0.19 - PDF generation for CSR reports
- `helmet` 7.1 - Security headers
- `@nestjs/throttler` 6.5 - Rate limiting
- `reflect-metadata` 0.2, `rxjs` 7.8 - NestJS prerequisites

**Critical (Client):**
- `react-router-dom` 6.21 - Client-side routing
- `swr` 2.2 - Stale-while-revalidate data fetching
- `lucide-react` 1.14 - Icon library
- `socket.io-client` 4.8 - WebSocket client
- `esbuild` 0.28 - Bundler dependency

**Infrastructure:**
- `@nestjs/config` 4.0 - Environment configuration
- `cors` 2.8, `@types/cors` - CORS middleware
- `uuid` 14.0 - UUID generation

## Configuration

**Environment:**
- `kapwa-server/.env` - Server environment variables (DB, JWT, Twilio credentials)
- Client uses `VITE_` prefixed env vars (e.g., `VITE_API_URL`, `VITE_WS_URL`)
- `@nestjs/config` ConfigModule loads .env globally

**Key configurations:**
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Database connection
- `JWT_SECRET` - JWT signing key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS gateway
- `SYNC_SECRET` - Sync protocol secret

**Build:**
- `kapwa-server/tsconfig.json` - Server TypeScript config (ES2021, CommonJS modules)
- `kapwa-client/tsconfig.json` - Client TypeScript config (ES2020, ESNext modules)
- `kapwa-server/nest-cli.json` - NestJS CLI config
- `kapwa-client/vite.config.ts` - Vite dev server (port 3001)
- `kapwa-client/tailwind.config.js` - Tailwind CSS config
- `kapwa-server/jest.config.ts` - Jest config (ts-jest transform)
- `kapwa-client/vitest.config.ts` - Vitest config (jsdom environment)

## Platform Requirements

**Development:**
- Node.js 20
- npm
- Docker (for PostgreSQL via `docker-compose.yml`)
- PostgreSQL 16 (local or Docker)
- Android SDK (for Capacitor Android builds)
- Xcode (for Capacitor iOS builds, macOS only)

**Production:**
- Docker host (Docker Compose deployment)
- PostgreSQL 16 with pgAudit, pgcrypto, uuid-ossp, pg_trgm extensions
- Node.js 20 runtime
- Twilio account (for SMS)

---

*Stack analysis: 2026-06-19*
