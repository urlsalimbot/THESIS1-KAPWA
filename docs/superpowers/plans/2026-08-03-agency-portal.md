# Inter-Agency Roles & Agency Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `agency_staff` role and a dedicated agency-facing portal (dashboard, referrals, card activities, agency profile) for non-MSWDO agency users, keeping them referral-scoped and out of the MSWDO-only modules.

**Architecture:** New `AgencyPortalModule` on the server (`GET /agency-portal/dashboard`, `GET /agency-portal/profile`) reusing the existing `InterAgencyReferralsService.findInbox` for scoped data; `agency_staff` added to the `UserRole` enum and to the `@Roles` lists of inter-agency-referrals/access-cards/agencies controllers; users API accepts + persists `agencyId`. Client: 4 new pages under `/agency/*` reusing shared referral components extracted from `InterAgencyReferralsPage.tsx`, an "Agency Portal" nav section, role redirect, Topbar agency label, and an agency select in the admin UsersPanel.

**Tech Stack:** NestJS 11, TypeORM (Postgres 16), Zod 3 + ZodPipe, JWT + Roles guards, React 19 + SWR + Vite, Zod 4 (client), vitest + @testing-library/react (client), Jest + ts-jest (server).

## Global Constraints

- **RLS is DORMANT.** Service-layer scoping only; NO RLS policies in any migration (there are no new migrations in this plan — `users.role` is TEXT and `users.agency_id` already exists).
- **Server tests:** run from `kapwa-server/` with `npx jest <relative/path> --coverage=false`. Never bare `npm test`.
- **Client tests:** run from `kapwa-client/` with `npx vitest run <relative/path>`.
- **Server typecheck:** `cd kapwa-server && npx tsc --noEmit`. **Client build:** `cd kapwa-client && npm run build` (known ~20 pre-existing baseline TS errors in FamilyTreeGraph.tsx/api.ts/test files — not your concern; only fix errors in files you touch).
- **Agency scoping rule (server-authoritative):** an agency_staff user's data is scoped to their `agencyId` ∈ {from_agency_id, to_agency_id}; admin sees everything (scoped to admin's own agencyId for portal counts). agency_staff with NO agencyId → 403 on portal endpoints, `[]` inbox, 403 on create.
- **Referral-scoped only:** `agency_staff` is NOT added to beneficiaries/cases/intake/irf/approvals/tracker controllers.
- **Error codes:** 403 Forbidden (no agencyId, non-participating agency), 404 NotFoundException (missing agency/user), 400 via existing XOR DTO refine (log activity with both/neither agency fields).
- **Naming/copy rules:** conventional commits (`feat:`, `fix:`, `test:`). No code comments unless the surrounding file uses them.
- **Existing shared state:** the `InterAgencyReferralsPage.tsx` extraction MUST NOT change MSWDO behavior — the MSWDO page becomes a thin wrapper; existing `InterAgencyReferralsPage.test.tsx` must keep passing.
- **UsersPanel note:** the client currently sends `full_name` (snake_case) on create but `fullName` (camelCase) on update — keep each call's existing shape; only ADD `agencyId` to both.

---

## File Structure

**Server — new**
- `kapwa-server/src/agency-portal/agency-portal.module.ts`
- `kapwa-server/src/agency-portal/agency-portal.controller.ts`
- `kapwa-server/src/agency-portal/agency-portal.service.ts`
- `kapwa-server/src/agency-portal/agency-portal.service.spec.ts`

**Server — modified**
- `kapwa-server/src/auth/user.entity.ts` — add `agency_staff` to `UserRole` enum
- `kapwa-server/src/users/dto/users.zod.ts` — `UserRoleEnum` + `agencyId` on create/update schemas
- `kapwa-server/src/users/users.service.ts` — persist `agencyId` on create/update
- `kapwa-server/src/users/users.service.spec.ts` — new tests (locate/verify during implementation)
- `kapwa-server/src/agencies/agencies.controller.ts` — `GET /:id`, roles incl. `agency_staff`
- `kapwa-server/src/agencies/agencies.service.spec.ts` — controller `GET /:id` coverage note (service `findById` already tested)
- `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts` — add `agency_staff` to all `@Roles`
- `kapwa-server/src/access-cards/access-cards.controller.ts` — add `agency_staff` to 5 routes
- `kapwa-server/src/app.module.ts` — register `AgencyPortalModule`

**Client — new**
- `kapwa-client/src/pages/AgencyDashboardPage.tsx` + `.test.tsx`
- `kapwa-client/src/pages/AgencyReferralsPage.tsx` + `.test.tsx`
- `kapwa-client/src/pages/AgencyCardActivitiesPage.tsx` + `.test.tsx`
- `kapwa-client/src/pages/AgencyProfilePage.tsx` + `.test.tsx`
- `kapwa-client/src/components/referrals/ReferralCard.tsx`
- `kapwa-client/src/components/referrals/CreateReferralForm.tsx`
- `kapwa-client/src/components/referrals/referral-utils.ts`

**Client — modified**
- `kapwa-client/src/lib/query-keys.ts` — `agencyPortal` group
- `kapwa-client/src/components/ProtectedRoute.tsx` — redirect map + `agency_staff`
- `kapwa-client/src/components/Topbar.tsx` — agency_staff label resolution
- `kapwa-client/src/components/UsersPanel.tsx` — agency select + `agency_staff` role option
- `kapwa-client/src/routes.tsx` — 5 agency routes
- `kapwa-client/src/lib/nav-config.tsx` — "Agency Portal" section
- `kapwa-client/src/pages/InterAgencyReferralsPage.tsx` — thin wrapper over shared components

---

### Task 1: agency_staff role + users API agencyId

**Files:**
- Modify: `kapwa-server/src/auth/user.entity.ts`
- Modify: `kapwa-server/src/users/dto/users.zod.ts`
- Modify: `kapwa-server/src/users/users.service.ts`
- Modify: `kapwa-server/src/users/users.service.spec.ts` (locate during implementation; if none exists, create it)

**Interfaces:**
- Consumes: `UserRole` enum (`src/auth/user.entity.ts`), `UsersService` (`src/users/users.service.ts`), zod DTOs (`src/users/dto/users.zod.ts`).
- Produces: `UserRole.agency_staff`; `CreateUserInputSchema` with `agencyId: z.string().uuid().optional()`; `UpdateUserSchema` with `agencyId: z.string().uuid().optional()`; `UsersService.createUser`/`update` persist `agencyId` (as `agencyId` on the entity, column `agency_id`).

- [ ] **Step 1: Add `agency_staff` to the UserRole enum**

In `kapwa-server/src/auth/user.entity.ts`, find the enum (line 4) and add `agency_staff`:

```ts
export enum UserRole {
  ADMIN = 'admin',
  SW = 'social_worker',
  COORDINATOR = 'coordinator',
  CLAIMANT = 'claimant',
  MAYOR = 'mayor',
  AUDITOR = 'auditor',
  AGENCY_STAFF = 'agency_staff',
}
```

Note: if the enum uses a different shape (e.g. shorthand members), mirror the existing entries exactly — add `AGENCY_STAFF = 'agency_staff'` (or the matching shorthand) after `AUDITOR`.

- [ ] **Step 2: Extend the users zod DTOs**

In `kapwa-server/src/users/dto/users.zod.ts`:

```ts
export const UserRoleEnum = z.enum([
  'admin', 'social_worker', 'coordinator', 'claimant', 'mayor', 'auditor', 'agency_staff'
]);
```

Add to `CreateUserInputSchema` (after `permitted_barangays`):

```ts
  agency_id: z.string().uuid().optional(),
```

Add to `UpdateUserSchema` (after `permittedBarangays`):

```ts
  agencyId: z.string().uuid().optional(),
```

- [ ] **Step 3: Persist agencyId in UsersService**

In `kapwa-server/src/users/users.service.ts`:

Extend the `CreateUserInput` interface:

```ts
export interface CreateUserInput {
  email: string;
  password: string;
  role: string;
  full_name?: string;
  phone?: string;
  assigned_barangay?: string;
  permitted_barangays?: string[];
  agency_id?: string;
}
```

In `createUser`, after `assignedBarangay: dto.assigned_barangay,` add:

```ts
      agencyId: dto.agency_id,
```

Extend `update`'s data type:

```ts
  async update(id: string, data: { fullName?: string; role?: string; isActive?: boolean; assignedBarangay?: string; permittedBarangays?: string[]; agencyId?: string }) {
```

In `update`, after the `assignedBarangay` line add:

```ts
    if (data.agencyId !== undefined) user.agencyId = data.agencyId;
```

- [ ] **Step 4: Write/extend the users service spec**

Locate `kapwa-server/src/users/users.service.spec.ts`. If it exists, append these tests inside the existing `describe` (matching its repo-mock style — check how it mocks `userRepo` first and mirror it):

```ts
  it('createUser persists agencyId for agency_staff', async () => {
    userRepo.findOne.mockResolvedValue(null);
    userRepo.create.mockImplementation((dto: any) => dto);
    userRepo.save.mockImplementation(async (dto: any) => ({ id: 'u1', ...dto, password: 'hashed' }));

    const result = await service.createUser({
      email: 'rhu@norzagaray.test',
      password: 'password123',
      role: 'agency_staff',
      agency_id: 'ag-rhu',
    } as any);

    expect(result.agencyId).toBe('ag-rhu');
    expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'ag-rhu', role: 'agency_staff' }));
  });

  it('update persists agencyId', async () => {
    const user = { id: 'u1', role: 'agency_staff', agencyId: undefined, save: jest.fn() };
    userRepo.findOne.mockResolvedValue(user);

    await service.update('u1', { agencyId: 'ag-rhu' });

    expect(user.agencyId).toBe('ag-rhu');
  });
```

If no spec file exists, create `kapwa-server/src/users/users.service.spec.ts` following the repo's standard TestingModule pattern (`Test.createTestingModule` with `{ provide: getRepositoryToken(User), useValue: userRepoMock }`) and add the two tests above plus a `should be defined` test. If the existing spec mocks differently (e.g. `service` created directly), adapt.

- [ ] **Step 5: Run the users spec**

Run from `kapwa-server/`:

```bash
npx jest src/users/users.service.spec.ts --coverage=false
```

Expected: all tests pass (existing + 2 new).

- [ ] **Step 6: Typecheck + commit**

```bash
cd kapwa-server && npx tsc --noEmit
```

Expected: no NEW errors (pre-existing baseline allowed). Then:

```bash
git add kapwa-server/src/auth/user.entity.ts kapwa-server/src/users
git commit -m "feat: add agency_staff role and persist user agencyId"
```

---

### Task 2: Agency portal server module

**Files:**
- Create: `kapwa-server/src/agency-portal/agency-portal.module.ts`
- Create: `kapwa-server/src/agency-portal/agency-portal.controller.ts`
- Create: `kapwa-server/src/agency-portal/agency-portal.service.ts`
- Create: `kapwa-server/src/agency-portal/agency-portal.service.spec.ts`
- Modify: `kapwa-server/src/app.module.ts`

**Interfaces:**
- Consumes: `InterAgencyReferralsService` from `src/inter-agency-referrals/inter-agency-referrals.service.ts` — `findInbox(caller: User): Promise<InterAgencyReferral[]>` (returns referrals where caller.agencyId ∈ {fromAgencyId, toAgencyId}, relations fromAgency/toAgency/person/case; admin sees all); `AgenciesService` from `src/agencies/agencies.service.ts` — `findById(id: string): Promise<Agency | null>`; `User` from `src/auth/user.entity.ts` (has `id`, `role`, `agencyId?`); `AuthenticatedRequest` from `src/auth/types`.
- Produces: `AgencyPortalService.getDashboard(caller): Promise<{ agency, counts, recent }>`; `AgencyPortalService.getProfile(caller): Promise<Agency>`; controller routes `GET /agency-portal/dashboard` and `GET /agency-portal/profile`, both `@Roles('agency_staff','admin')`.

- [ ] **Step 1: Write the failing service spec**

Create `kapwa-server/src/agency-portal/agency-portal.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AgencyPortalService } from './agency-portal.service';
import { InterAgencyReferralsService } from '../inter-agency-referrals/inter-agency-referrals.service';
import { AgenciesService } from '../agencies/agencies.service';

function agencyUser(id: string, agencyId: string, role = 'agency_staff') {
  return { id, role, agencyId } as any;
}

describe('AgencyPortalService', () => {
  let service: AgencyPortalService;
  let referralsMock: any;
  let agenciesMock: any;

  beforeEach(async () => {
    referralsMock = { findInbox: jest.fn() };
    agenciesMock = { findById: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgencyPortalService,
        { provide: InterAgencyReferralsService, useValue: referralsMock },
        { provide: AgenciesService, useValue: agenciesMock },
      ],
    }).compile();
    service = module.get<AgencyPortalService>(AgencyPortalService);
  });

  const ref = (id: string, from: string, to: string, status: string) => ({
    id, fromAgencyId: from, toAgencyId: to, status,
  });

  describe('getDashboard', () => {
    it('returns agency info + counts scoped to the caller agency', async () => {
      agenciesMock.findById.mockResolvedValue({ id: 'ag-rhu', code: 'RHU', name: 'RHU' });
      referralsMock.findInbox.mockResolvedValue([
        ref('r1', 'ag-mswdo', 'ag-rhu', 'referred'),
        ref('r2', 'ag-mswdo', 'ag-rhu', 'referred'),
        ref('r3', 'ag-mswdo', 'ag-rhu', 'closed'),
        ref('r4', 'ag-rhu', 'ag-deped', 'received'),
        ref('r5', 'ag-rhu', 'ag-deped', 'declined'),
      ]);

      const result = await service.getDashboard(agencyUser('u1', 'ag-rhu'));

      expect(agenciesMock.findById).toHaveBeenCalledWith('ag-rhu');
      expect(referralsMock.findInbox).toHaveBeenCalledWith(agencyUser('u1', 'ag-rhu'));
      expect(result.agency.code).toBe('RHU');
      expect(result.counts).toEqual({
        total: 5,
        sent: 2,
        received: 3,
        byStatus: { referred: 2, received: 1, actioned: 0, closed: 1, declined: 1 },
      });
      expect(result.recent.length).toBe(5);
    });

    it('caps recent at 5', async () => {
      agenciesMock.findById.mockResolvedValue({ id: 'ag-rhu', code: 'RHU' });
      referralsMock.findInbox.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ref(`r${i}`, 'ag-mswdo', 'ag-rhu', 'referred')),
      );
      const result = await service.getDashboard(agencyUser('u1', 'ag-rhu'));
      expect(result.recent.length).toBe(5);
    });

    it('throws 403 when caller has no agencyId', async () => {
      await expect(service.getDashboard(agencyUser('u1', ''))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getProfile', () => {
    it('returns the caller agency', async () => {
      agenciesMock.findById.mockResolvedValue({ id: 'ag-rhu', code: 'RHU', name: 'RHU' });
      const result = await service.getProfile(agencyUser('u1', 'ag-rhu'));
      expect(result).toEqual({ id: 'ag-rhu', code: 'RHU', name: 'RHU' });
    });

    it('throws 403 when caller has no agencyId', async () => {
      await expect(service.getProfile(agencyUser('u1', ''))).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run from `kapwa-server/`:

```bash
npx jest src/agency-portal/agency-portal.service.spec.ts --coverage=false
```

Expected: FAIL — module/service not found.

- [ ] **Step 3: Write the service**

Create `kapwa-server/src/agency-portal/agency-portal.service.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Agency } from '../agencies/agency.entity';
import { AgenciesService } from '../agencies/agencies.service';
import { User } from '../auth/user.entity';
import { InterAgencyReferralsService } from '../inter-agency-referrals/inter-agency-referrals.service';

const STATUSES = ['referred', 'received', 'actioned', 'closed', 'declined'] as const;

@Injectable()
export class AgencyPortalService {
  constructor(
    private referralsService: InterAgencyReferralsService,
    private agenciesService: AgenciesService,
  ) {}

  async getDashboard(caller: User) {
    const agencyId = this.requireAgencyId(caller);
    const [agency, referrals] = await Promise.all([
      this.agenciesService.findById(agencyId),
      this.referralsService.findInbox(caller),
    ]);
    const counts = {
      total: referrals.length,
      sent: referrals.filter(r => r.fromAgencyId === agencyId).length,
      received: referrals.filter(r => r.toAgencyId === agencyId).length,
      byStatus: {
        referred: referrals.filter(r => r.status === 'referred').length,
        received: referrals.filter(r => r.status === 'received').length,
        actioned: referrals.filter(r => r.status === 'actioned').length,
        closed: referrals.filter(r => r.status === 'closed').length,
        declined: referrals.filter(r => r.status === 'declined').length,
      },
    };
    return { agency, counts, recent: referrals.slice(0, 5) };
  }

  async getProfile(caller: User): Promise<Agency | null> {
    const agencyId = this.requireAgencyId(caller);
    return this.agenciesService.findById(agencyId);
  }

  private requireAgencyId(caller: User): string {
    if (!caller.agencyId) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }
    return caller.agencyId;
  }
}
```

Note: `STATUSES` is declared but unused — remove it unless you use it; do NOT leave unused declarations (typecheck will flag under noUnusedLocals).

- [ ] **Step 4: Run the spec to verify it passes**

Run from `kapwa-server/`:

```bash
npx jest src/agency-portal/agency-portal.service.spec.ts --coverage=false
```

Expected: PASS (5 tests).

- [ ] **Step 5: Write the controller**

Create `kapwa-server/src/agency-portal/agency-portal.controller.ts`:

```ts
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { AgencyPortalService } from './agency-portal.service';

@ApiTags('Agency Portal')
@Controller('agency-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgencyPortalController {
  constructor(private readonly svc: AgencyPortalService) {}

  @Get('dashboard')
  @Roles('agency_staff', 'admin')
  @ApiOperation({ summary: 'Agency dashboard: referral counts + recent' })
  async dashboard(@Request() req: AuthenticatedRequest) {
    return this.svc.getDashboard(req.user);
  }

  @Get('profile')
  @Roles('agency_staff', 'admin')
  @ApiOperation({ summary: 'The caller agency profile' })
  async profile(@Request() req: AuthenticatedRequest) {
    return this.svc.getProfile(req.user);
  }
}
```

- [ ] **Step 6: Write the module + register it**

Create `kapwa-server/src/agency-portal/agency-portal.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AgencyPortalController } from './agency-portal.controller';
import { AgencyPortalService } from './agency-portal.service';
import { InterAgencyReferralsModule } from '../inter-agency-referrals/inter-agency-referrals.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InterAgencyReferralsModule, AgenciesModule, AuthModule],
  controllers: [AgencyPortalController],
  providers: [AgencyPortalService],
})
export class AgencyPortalModule {}
```

Verify `InterAgencyReferralsModule` exports `InterAgencyReferralsService` (it does — `exports: [InterAgencyReferralsService]` from Task 2 of the inter-agency plan) and `AgenciesModule` exports `AgenciesService` (it does).

In `kapwa-server/src/app.module.ts`:
- Add import: `import { AgencyPortalModule } from './agency-portal/agency-portal.module';` (near the other module imports)
- Add `AgencyPortalModule,` to the `imports` array (after `InterAgencyReferralsModule,` if present, else anywhere consistent)

- [ ] **Step 7: Typecheck + verify boot**

```bash
cd kapwa-server && npx tsc --noEmit
```

Expected: no NEW errors. If a dev server is running, it hot-reloads; otherwise verify via `npm run start:dev` briefly or rely on typecheck (migrations not affected — no new tables).

- [ ] **Step 8: Commit**

```bash
git add kapwa-server/src/agency-portal kapwa-server/src/app.module.ts
git commit -m "feat: add agency portal dashboard and profile endpoints"
```

---

### Task 3: Guard additions + GET /agencies/:id

**Files:**
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.controller.ts`
- Modify: `kapwa-server/src/agencies/agencies.controller.ts`
- Modify: `kapwa-server/src/agencies/agencies.service.spec.ts` (add `findById` → 404/controller coverage where the existing spec structure allows)

**Interfaces:**
- Consumes: existing controllers + `AgenciesService.findById` (exists, returns `Promise<Agency | null>`).
- Produces: `agency_staff` allowed on: all inter-agency-referrals routes; access-cards `GET :code/summary`, `GET :cardCode`, `GET beneficiary/:id/card`, `POST log`, `GET /`; agencies `GET /` + new `GET /:id`.

- [ ] **Step 1: Add agency_staff to inter-agency-referrals controller**

In `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts`, replace every `@Roles('admin', 'social_worker')` with:

```ts
  @Roles('admin', 'social_worker', 'agency_staff')
```

There are 8 occurrences (inbox, person/:personId, create, receive, action, close, decline, promote-to-case). Use replaceAll.

- [ ] **Step 2: Add agency_staff to access-cards controller**

In `kapwa-server/src/access-cards/access-cards.controller.ts`, the five routes below change `@Roles(...)` to include `'agency_staff'`:

| Route | New roles |
|---|---|
| `GET beneficiary/:id/card` | `'admin', 'social_worker', 'claimant', 'coordinator', 'agency_staff'` |
| `GET :code/summary` | `'admin', 'social_worker', 'claimant', 'coordinator', 'agency_staff'` |
| `GET :cardCode` | `'admin', 'social_worker', 'claimant', 'coordinator', 'agency_staff'` |
| `GET /` | `'admin', 'social_worker', 'coordinator', 'agency_staff'` |
| `POST log` | find the `@Post('log')` route's `@Roles` and add `'agency_staff'` |

Do NOT touch `GET beneficiary/:id/card/summary` or any other route unless listed above.

- [ ] **Step 3: Add agency_staff + GET /:id to agencies controller**

In `kapwa-server/src/agencies/agencies.controller.ts`:
- Change `@Roles('admin', 'social_worker', 'coordinator')` on `GET /` to `@Roles('admin', 'social_worker', 'coordinator', 'agency_staff')`.
- Add a new route (before or after the existing `@Get()` — order does not matter here since `:id` is a separate segment):

```ts
  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'Get an agency by id' })
  async findById(@Param('id') id: string) {
    const agency = await this.svc.findById(id);
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }
```

Add `NotFoundException` and `Param` to the `@nestjs/common` import list if not already imported.

- [ ] **Step 4: Extend the agencies service spec**

In `kapwa-server/src/agencies/agencies.service.spec.ts`, append (the controller `findById` delegates to `svc.findById` which is already covered; add a test that `findById` returns null when missing if not present):

```ts
  it('findById returns null when missing', async () => {
    repoMock.findOne.mockResolvedValue(null);
    const result = await service.findById('nope');
    expect(result).toBeNull();
  });
```

(If a similar test already exists, skip.)

- [ ] **Step 5: Run affected specs + typecheck**

Run from `kapwa-server/`:

```bash
npx jest src/inter-agency-referrals/inter-agency-referrals.service.spec.ts src/access-cards/access-cards.service.spec.ts src/agencies/agencies.service.spec.ts --coverage=false
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx tsc --noEmit
```

Expected: all pass; no new typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts kapwa-server/src/access-cards/access-cards.controller.ts kapwa-server/src/agencies
git commit -m "feat: allow agency_staff on referral, access-card, and agency routes"
```

---

### Task 4: Extract shared referral components

**Files:**
- Create: `kapwa-client/src/components/referrals/referral-utils.ts`
- Create: `kapwa-client/src/components/referrals/ReferralCard.tsx`
- Create: `kapwa-client/src/components/referrals/CreateReferralForm.tsx`
- Modify: `kapwa-client/src/pages/InterAgencyReferralsPage.tsx` (thin wrapper)

**Interfaces:**
- Consumes: `api` from `../lib/api` (relative from components dir: `../../lib/api`), `queryKeys` from `../../lib/query-keys`, `useDebouncedSearch` from `@/hooks/useDebouncedSearch`, `useAuth` from `../../lib/auth-context`, UI components (`PageShell` NOT used here — only `Badge`, `Button`, `EmptyState` from `@/components/...`).
- Produces (used by Task 5):
  - `referral-utils.ts`: `Agency` interface, `ReferralStatus` type, `InterAgencyReferral` interface, `STATUS_LABELS`, `LEGAL_BASIS_OPTIONS`, `StatusTimeline` component.
  - `ReferralCard.tsx`: `ReferralCard({ referral, myAgencyId, onTransition, disabled? })`.
  - `CreateReferralForm.tsx`: `CreateReferralForm({ agencies, onCreated })`.

- [ ] **Step 1: Write referral-utils.ts**

Create `kapwa-client/src/components/referrals/referral-utils.ts`:

```ts
export interface Agency {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export type ReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

export interface InterAgencyReferral {
  id: string;
  personId: string;
  caseId?: string;
  fromAgencyId: string;
  toAgencyId: string;
  status: ReferralStatus;
  reason: string;
  notes?: string;
  legalBasisCode: string;
  outcome?: string;
  declinedReason?: string;
  fromAgency?: Agency;
  toAgency?: Agency;
  person?: { id: string; surname: string; firstName: string };
  createdAt: string;
}

export const STATUS_LABELS: Record<ReferralStatus, string> = {
  referred: 'Referred',
  received: 'Received',
  actioned: 'Actioned',
  closed: 'Closed',
  declined: 'Declined',
};

export const LEGAL_BASIS_OPTIONS = ['public_authority_sec13', 'consent_verified', 'emergency_situation'];
```

- [ ] **Step 2: Write StatusTimeline (in referral-utils.ts, append)**

Append to `referral-utils.ts`:

```ts
import type { ReactElement } from 'react';

export function StatusTimeline({ status }: { status: ReferralStatus }): ReactElement {
  const steps: ReferralStatus[] = ['referred', 'received', 'actioned', 'closed'];
  const activeIndex = status === 'declined' ? -1 : steps.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label="status-timeline">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${i <= activeIndex ? 'bg-primary' : 'bg-muted'}`}
          />
          {i < steps.length - 1 && (
            <span className={`h-px w-4 ${i < activeIndex ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write ReferralCard.tsx**

Create `kapwa-client/src/components/referrals/ReferralCard.tsx`:

```tsx
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InterAgencyReferral, STATUS_LABELS, StatusTimeline } from './referral-utils';

export function ReferralCard({
  referral,
  myAgencyId,
  onTransition,
  disabled = false,
}: {
  referral: InterAgencyReferral;
  myAgencyId?: string;
  onTransition: (id: string, action: string, body?: Record<string, string>) => Promise<void>;
  disabled?: boolean;
}) {
  const [outcome, setOutcome] = useState('');
  const isReceiver = referral.toAgencyId === myAgencyId;
  const canReceive = isReceiver && referral.status === 'referred';
  const canAction = isReceiver && referral.status === 'received';
  const canClose = isReceiver && referral.status === 'actioned';
  const canDecline = isReceiver && referral.status === 'referred';
  const personName = referral.person
    ? `${referral.person.firstName} ${referral.person.surname}`.trim()
    : 'Person';

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{personName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {referral.fromAgency?.name || referral.fromAgencyId} →{' '}
            {referral.toAgency?.name || referral.toAgencyId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {referral.status !== 'declined' && <StatusTimeline status={referral.status} />}
          <Badge variant={referral.status === 'declined' ? 'destructive' : 'default'}>
            {STATUS_LABELS[referral.status]}
          </Badge>
        </div>
      </div>
      <p className="text-sm">{referral.reason}</p>
      <p className="text-xs text-muted-foreground">
        Basis: {referral.legalBasisCode} · {new Date(referral.createdAt).toLocaleDateString()}
      </p>
      {referral.notes && <p className="text-xs text-muted-foreground">Notes: {referral.notes}</p>}
      {referral.outcome && <p className="text-xs text-muted-foreground">Outcome: {referral.outcome}</p>}
      {referral.declinedReason && (
        <p className="text-xs text-destructive">Declined: {referral.declinedReason}</p>
      )}
      {canReceive && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onTransition(referral.id, 'receive')} disabled={disabled}>
            Receive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled}
            onClick={() =>
              onTransition(referral.id, 'decline', {
                declinedReason: 'Unable to accommodate',
              })
            }
          >
            Decline
          </Button>
        </div>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')} disabled={disabled}>
          Mark Actioned
        </Button>
      )}
      {canClose && (
        <div className="flex gap-2 items-end">
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="Outcome"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <Button
            size="sm"
            onClick={() => onTransition(referral.id, 'close', { outcome })}
            disabled={disabled || !outcome.trim()}
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write CreateReferralForm.tsx**

Create `kapwa-client/src/components/referrals/CreateReferralForm.tsx`:

```tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Agency, LEGAL_BASIS_OPTIONS } from './referral-utils';

export function CreateReferralForm({
  agencies,
  onCreated,
}: {
  agencies: Agency[];
  onCreated: () => void;
}) {
  const [toAgencyId, setToAgencyId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [legalBasisCode, setLegalBasisCode] = useState(LEGAL_BASIS_OPTIONS[0]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ beneficiaryId: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { results, loading } = useDebouncedSearch(query, 300, 8);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !toAgencyId || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/inter-agency-referrals', {
        beneficiaryId: selected.beneficiaryId,
        toAgencyId,
        reason,
        notes: notes || undefined,
        legalBasisCode,
      });
      setSelected(null);
      setQuery('');
      setReason('');
      setNotes('');
      setToAgencyId('');
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-3"
    >
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Send size={16} className="text-primary" /> Create Referral
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="iar-to-agency">
            To Agency *
          </label>
          <select
            id="iar-to-agency"
            value={toAgencyId}
            onChange={e => setToAgencyId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            required
          >
            <option value="">Select agency...</option>
            {agencies.map(a => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="iar-legal-basis">
            Legal Basis *
          </label>
          <select
            id="iar-legal-basis"
            value={legalBasisCode}
            onChange={e => setLegalBasisCode(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {LEGAL_BASIS_OPTIONS.map(o => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Beneficiary *</label>
        {selected ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{selected.label}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground">
              Clear
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search beneficiary by name..."
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            {loading && <p className="text-xs text-muted-foreground">Searching...</p>}
            {results.length > 0 && (
              <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
                {results.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setSelected({ beneficiaryId: r.id, label: r.fullName });
                        setQuery('');
                      }}
                    >
                      {r.fullName} <span className="text-xs text-muted-foreground">{r.barangay}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="iar-reason">
          Reason *
        </label>
        <textarea
          id="iar-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          rows={2}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="iar-notes">
          Notes
        </label>
        <textarea
          id="iar-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          rows={2}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        size="sm"
        disabled={submitting || !selected || !toAgencyId || !reason.trim()}
      >
        {submitting ? 'Saving...' : 'Create Referral'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Convert InterAgencyReferralsPage into a thin wrapper**

In `kapwa-client/src/pages/InterAgencyReferralsPage.tsx`, replace the ENTIRE file content with:

```tsx
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ArrowLeftRight } from 'lucide-react';
import { ReferralCard } from '@/components/referrals/ReferralCard';
import { CreateReferralForm } from '@/components/referrals/CreateReferralForm';
import { Agency, InterAgencyReferral } from '@/components/referrals/referral-utils';

export { Agency, InterAgencyReferral };

export function InterAgencyReferralsPage() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');

  const { data: referrals, isLoading } = useSWR<InterAgencyReferral[]>(
    queryKeys.interAgencyReferrals.inbox(),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const myAgencyId = user?.agencyId;

  const visible = (referrals || []).filter(r => {
    if (filter === 'all') return true;
    if (filter === 'received') return r.toAgencyId === myAgencyId;
    return r.fromAgencyId === myAgencyId;
  });

  async function transition(id: string, action: string, body?: Record<string, string>) {
    try {
      await api.patch(`/inter-agency-referrals/${id}/${action}`, body);
      await mutate(queryKeys.interAgencyReferrals.inbox());
    } catch {
      // surfaced via SWR revalidation; keep MSWDO page behavior unchanged
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Inter-Agency Referrals" description="Track referrals between agencies">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Inter-Agency Referrals"
      description="Track referrals between agencies"
      icon={<ArrowLeftRight className="text-primary" />}
    >
      <CreateReferralForm
        agencies={agencies || []}
        onCreated={() => mutate(queryKeys.interAgencyReferrals.inbox())}
      />

      <div className="mt-4 mb-2 flex gap-1">
        {(['all', 'received', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <ReferralCard key={r.id} referral={r} myAgencyId={myAgencyId} onTransition={transition} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

**IMPORTANT — preserve the existing page's `transition` error behavior:** the previous page had a `transitionError`/`transitioning` state (added in the final review fix wave of the inter-agency plan). Check the CURRENT `InterAgencyReferralsPage.tsx` before replacing — if it has `transitioning`/`transitionError` states, carry them into the wrapper exactly (refer to the fix report at `.superpowers/sdd/fix-final-review-report.md` for what was added). The wrapper must keep MSWDO behavior identical; the `disabled` prop on `ReferralCard` exists for this. If the current page has these states, restore them here; if not, the above code is correct as-is.

- [ ] **Step 6: Run the existing MSWDO page tests**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/InterAgencyReferralsPage.test.tsx
```

Expected: PASS (3 tests) — proves the extraction didn't break MSWDO behavior. Also run:

```bash
npx vitest run src/pages/InterAgencyReferralsPage.test.tsx src/pages/AccessCardViewPage.test.tsx
```

Expected: both pass.

- [ ] **Step 7: Build + commit**

```bash
cd kapwa-client && npm run build
```

Expected: build succeeds (pre-existing baseline errors excluded — verify none of YOUR files are in the error list). Then:

```bash
git add kapwa-client/src/components/referrals kapwa-client/src/pages/InterAgencyReferralsPage.tsx
git commit -m "refactor: extract shared referral card and create form components"
```

---

### Task 5: Agency portal client pages

**Files:**
- Create: `kapwa-client/src/pages/AgencyDashboardPage.tsx` (+ `.test.tsx`)
- Create: `kapwa-client/src/pages/AgencyReferralsPage.tsx` (+ `.test.tsx`)
- Create: `kapwa-client/src/pages/AgencyCardActivitiesPage.tsx` (+ `.test.tsx`)
- Create: `kapwa-client/src/pages/AgencyProfilePage.tsx` (+ `.test.tsx`)
- Modify: `kapwa-client/src/lib/query-keys.ts`

**Interfaces:**
- Consumes: `queryKeys.agencyPortal.dashboard()` (Task 5 adds it) → `['agency-portal','dashboard']`; `queryKeys.agencyPortal.profile()` → `['agency-portal','profile']`; `queryKeys.agencies.list()` → `['agencies']` (exists); `ReferralCard`/`CreateReferralForm`/`Agency`/`InterAgencyReferral` from `@/components/referrals/*` (Task 4); `useAuth` → `user.agencyId`; server endpoints `GET /agency-portal/dashboard`, `GET /agency-portal/profile`, `GET /access-cards/:code`, `POST /access-cards/log`.
- Produces: 4 page components used by Task 6 routes.

- [ ] **Step 1: Add agencyPortal query keys**

In `kapwa-client/src/lib/query-keys.ts`, after the `interAgencyReferrals` group (added in the inter-agency plan), add:

```ts
  agencyPortal: {
    dashboard: () => memo('agencyPortal.dashboard', () => ['agency-portal', 'dashboard'] as const),
    profile: () => memo('agencyPortal.profile', () => ['agency-portal', 'profile'] as const),
  },
```

- [ ] **Step 2: Write AgencyDashboardPage**

Create `kapwa-client/src/pages/AgencyDashboardPage.tsx`:

```tsx
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Inbox, ClipboardCheck, IdCard, ArrowLeftRight } from 'lucide-react';
import { STATUS_LABELS, InterAgencyReferral, Agency } from '@/components/referrals/referral-utils';

interface DashboardData {
  agency: Agency;
  counts: {
    total: number;
    sent: number;
    received: number;
    byStatus: Record<string, number>;
  };
  recent: InterAgencyReferral[];
}

export function AgencyDashboardPage() {
  const { data, isLoading } = useSWR<DashboardData>(queryKeys.agencyPortal.dashboard());

  if (isLoading) {
    return (
      <PageShell title="Agency Dashboard" description="Overview of your agency's referrals">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  const stats = [
    { label: 'Total', value: data?.counts.total ?? 0, icon: <ArrowLeftRight size={16} /> },
    { label: 'Sent', value: data?.counts.sent ?? 0, icon: <Inbox size={16} /> },
    { label: 'Received', value: data?.counts.received ?? 0, icon: <ClipboardCheck size={16} /> },
    { label: 'Closed', value: data?.counts.byStatus.closed ?? 0, icon: <IdCard size={16} /> },
    { label: 'Declined', value: data?.counts.byStatus.declined ?? 0, icon: <IdCard size={16} /> },
  ];

  return (
    <PageShell
      title={data?.agency.name || 'Agency Dashboard'}
      description={`${data?.agency.code || 'Agency'} — referral overview`}
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-1">{s.icon}</div>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        <Link to="/agency/referrals">
          <Button size="sm">View Inbox</Button>
        </Link>
        <Link to="/agency/card-activities">
          <Button size="sm" variant="secondary">Log Activity</Button>
        </Link>
      </div>

      <h2 className="text-sm font-semibold mb-3">Recent Referrals</h2>
      {data?.recent.length === 0 || !data ? (
        <p className="text-sm text-muted-foreground">No referrals yet.</p>
      ) : (
        <div className="space-y-3">
          {data.recent.map(r => (
            <div key={r.id} className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">
                  {r.person ? `${r.person.firstName} ${r.person.surname}` : 'Person'}
                </p>
                <Badge variant={r.status === 'declined' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {STATUS_LABELS[r.status] || r.status}
                </Badge>
              </div>
              <p className="text-sm">{r.reason}</p>
              <p className="text-xs text-muted-foreground">
                {(r.fromAgency?.name || r.fromAgencyId)} → {(r.toAgency?.name || r.toAgencyId)} ·{' '}
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 3: Write AgencyDashboardPage test**

Create `kapwa-client/src/pages/AgencyDashboardPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyDashboardPage } from './AgencyDashboardPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'agency_staff', agencyId: 'ag-rhu' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyDashboardPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agency-portal')) {
        return Promise.resolve({
          agency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray', type: 'health' },
          counts: { total: 5, sent: 2, received: 3, byStatus: { referred: 2, received: 1, actioned: 0, closed: 1, declined: 1 } },
          recent: [
            {
              id: 'r1', personId: 'p1', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
              status: 'referred', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13',
              createdAt: '2026-08-01T00:00:00.000Z',
              fromAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
              toAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
              person: { id: 'p1', firstName: 'Juan', surname: 'Santos' },
            },
          ],
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders agency name and stat cards', async () => {
    renderWithSWR(<AgencyDashboardPage />);
    expect(await screen.findByRole('heading', { name: 'Rural Health Unit - Norzagaray' })).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('renders recent referrals with status', async () => {
    renderWithSWR(<AgencyDashboardPage />);
    expect(await screen.findByText('Medical follow-up')).toBeTruthy();
    expect(screen.getByText('Referred')).toBeTruthy();
  });
});
```

- [ ] **Step 4: Write AgencyReferralsPage**

Create `kapwa-client/src/pages/AgencyReferralsPage.tsx`:

```tsx
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ArrowLeftRight } from 'lucide-react';
import { ReferralCard } from '@/components/referrals/ReferralCard';
import { CreateReferralForm } from '@/components/referrals/CreateReferralForm';
import { Agency, InterAgencyReferral } from '@/components/referrals/referral-utils';

export function AgencyReferralsPage() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  const { data: referrals, isLoading } = useSWR<InterAgencyReferral[]>(
    queryKeys.interAgencyReferrals.inbox(),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const myAgencyId = user?.agencyId;

  const visible = (referrals || []).filter(r => {
    if (filter === 'all') return true;
    if (filter === 'received') return r.toAgencyId === myAgencyId;
    return r.fromAgencyId === myAgencyId;
  });

  async function transition(id: string, action: string, body?: Record<string, string>) {
    setTransitioning(true);
    setTransitionError('');
    try {
      await api.patch(`/inter-agency-referrals/${id}/${action}`, body);
      await mutate(queryKeys.interAgencyReferrals.inbox());
    } catch (err: any) {
      setTransitionError(err?.message || 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Referrals" description="Track referrals between agencies">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Referrals"
      description="Track referrals between agencies"
      icon={<ArrowLeftRight className="text-primary" />}
    >
      <CreateReferralForm
        agencies={agencies || []}
        onCreated={() => mutate(queryKeys.interAgencyReferrals.inbox())}
      />

      <div className="mt-4 mb-2 flex gap-1">
        {(['all', 'received', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {transitionError && <p className="text-xs text-destructive mb-2">{transitionError}</p>}

      {visible.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <ReferralCard
              key={r.id}
              referral={r}
              myAgencyId={myAgencyId}
              onTransition={transition}
              disabled={transitioning}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 5: Write AgencyReferralsPage test**

Create `kapwa-client/src/pages/AgencyReferralsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyReferralsPage } from './AgencyReferralsPage';

const { mockApiGet, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: (...args: unknown[]) => mockApiPatch(...args), put: vi.fn(), del: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'agency_staff', agencyId: 'ag-rhu' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyReferralsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([
          {
            id: 'r1', personId: 'p1', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
            status: 'referred', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13',
            createdAt: '2026-08-01T00:00:00.000Z',
            fromAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
            toAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            person: { id: 'p1', firstName: 'Juan', surname: 'Santos' },
          },
        ]);
      }
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
          { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders referral card and receive action for receiving agency', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyReferralsPage />);
    expect(await screen.findByText('Juan Santos')).toBeTruthy();
    const receiveButton = await screen.findByRole('button', { name: 'Receive' });
    await user.click(receiveButton);
    expect(mockApiPatch).toHaveBeenCalledWith('/inter-agency-referrals/r1/receive', undefined);
  });
});
```

- [ ] **Step 6: Write AgencyCardActivitiesPage**

Create `kapwa-client/src/pages/AgencyCardActivitiesPage.tsx`:

```tsx
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Search } from 'lucide-react';

interface ServiceEntry {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  category: string;
  cost?: number;
  agency?: string;
  workerNameSign?: string;
}

export function AgencyCardActivitiesPage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [services, setServices] = useState<ServiceEntry[] | null>(null);
  const [personName, setPersonName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  const [category, setCategory] = useState('community_service');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [agencyId, setAgencyId] = useState(user?.agencyId || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setServices(null);
    try {
      const result: any = await api.get(`/access-cards/${code.trim()}`);
      setServices(result);
      try {
        const summary: any = await api.get(`/access-cards/${code.trim()}/summary`);
        if (summary?.person) setPersonName(`${summary.person.firstName} ${summary.person.surname}`);
      } catch {}
    } catch {
      setError('Access card not found');
    }
    setLoading(false);
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    if (!remarks.trim() || !agencyId) return;
    setSubmitting(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: code.trim(),
        serviceRendered: remarks,
        serviceDate,
        category,
        agencyId,
      });
      setRemarks('');
      const result: any = await api.get(`/access-cards/${code.trim()}`);
      setServices(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to log activity');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell title="Card Activities" description="Verify cards and log activities">
      <form onSubmit={handleVerify} className="flex gap-2 mb-4">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Enter card code (e.g. NORZ-AC-2026-0001)"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={loading || !code.trim()}>
          <Search size={14} className="mr-1" /> {loading ? 'Checking...' : 'Verify'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {services && (
        <>
          {personName && <p className="text-sm font-semibold mb-2">{personName}</p>}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border mb-4">
            <h3 className="text-sm font-semibold mb-2">Service History ({services.length})</h3>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services logged yet.</p>
            ) : (
              <div className="divide-y">
                {services.map((s: ServiceEntry) => (
                  <div key={s.id} className="py-2 flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{s.serviceRendered}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] mr-1">{s.category}</Badge>
                        {new Date(s.serviceDate).toLocaleDateString()}
                      </p>
                    </div>
                    {s.cost != null && Number(s.cost) > 0 && (
                      <span className="text-sm font-medium tabular-nums">₱{Number(s.cost).toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleLog} className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-3">
            <h3 className="text-sm font-semibold">Log Activity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="community_service">Community Service</option>
                  <option value="seminar">Seminar</option>
                  <option value="distribution">Distribution</option>
                  <option value="referral">Referral</option>
                  <option value="case_service">Case Service</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Date *</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={e => setServiceDate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Agency *</label>
              <select
                value={agencyId}
                onChange={e => setAgencyId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                required
              >
                <option value="">Select agency...</option>
                {(agencies || []).map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Remarks *</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                placeholder="Describe the activity..."
              />
            </div>
            <Button type="submit" size="sm" disabled={submitting || !remarks.trim() || !agencyId}>
              <Check size={14} className="mr-1" /> {submitting ? 'Logging...' : 'Log Activity'}
            </Button>
          </form>
        </>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 7: Write AgencyCardActivitiesPage test**

Create `kapwa-client/src/pages/AgencyCardActivitiesPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyCardActivitiesPage } from './AgencyCardActivitiesPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: (...args: unknown[]) => mockApiPost(...args), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'agency_staff', agencyId: 'ag-rhu' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyCardActivitiesPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) {
        return Promise.resolve([{ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit' }]);
      }
      if (k.includes('access-cards') && k.includes('summary')) {
        return Promise.resolve({ person: { id: 'p1', firstName: 'Juan', surname: 'Santos' } });
      }
      if (k.includes('access-cards')) {
        return Promise.resolve([
          { id: 's1', serviceRendered: 'Medical Consultation', serviceDate: '2026-07-20', category: 'referral' },
        ]);
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('verifies a card and shows service history', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyCardActivitiesPage />);
    await user.type(screen.getByPlaceholderText(/Enter card code/), 'NORZ-AC-2026-0042');
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    expect(await screen.findByText('Medical Consultation')).toBeTruthy();
    expect(screen.getByText('Juan Santos')).toBeTruthy();
  });

  it('logs an activity with the pre-selected agency', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyCardActivitiesPage />);
    await user.type(screen.getByPlaceholderText(/Enter card code/), 'NORZ-AC-2026-0042');
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    await user.type(await screen.findByPlaceholderText(/Describe the activity/), 'Dental checkup');
    await user.click(screen.getByRole('button', { name: 'Log Activity' }));
    expect(mockApiPost).toHaveBeenCalledWith('/access-cards/log', expect.objectContaining({
      accessCardCode: 'NORZ-AC-2026-0042',
      serviceRendered: 'Dental checkup',
      agencyId: 'ag-rhu',
    }));
  });
});
```

- [ ] **Step 8: Write AgencyProfilePage**

Create `kapwa-client/src/pages/AgencyProfilePage.tsx`:

```tsx
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Building2 } from 'lucide-react';

export function AgencyProfilePage() {
  const { data: agency, isLoading } = useSWR<{ id: string; code: string; name: string; type?: string; contactInfo?: Record<string, unknown> | null }>(
    queryKeys.agencyPortal.profile(),
  );

  if (isLoading) {
    return (
      <PageShell title="Agency Profile" description="Your agency information">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={agency?.name || 'Agency Profile'}
      description="Your agency information"
      icon={<Building2 className="text-primary" />}
    >
      <div className="rounded-lg bg-card p-6 shadow-sm border border-border space-y-3 max-w-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Building2 size={24} className="text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-lg">{agency?.name}</p>
            <p className="text-xs text-muted-foreground">{agency?.code}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p>{agency?.type || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contact</p>
            <p>{agency?.contactInfo ? JSON.stringify(agency.contactInfo) : '—'}</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 9: Write AgencyProfilePage test**

Create `kapwa-client/src/pages/AgencyProfilePage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyProfilePage } from './AgencyProfilePage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'agency_staff', agencyId: 'ag-rhu' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyProfilePage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      if (JSON.stringify(key).includes('agency-portal')) {
        return Promise.resolve({ id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray', type: 'health' });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders agency info', async () => {
    renderWithSWR(<AgencyProfilePage />);
    expect(await screen.findByRole('heading', { name: 'Rural Health Unit - Norzagaray' })).toBeTruthy();
    expect(screen.getByText('RHU')).toBeTruthy();
    expect(screen.getByText('health')).toBeTruthy();
  });
});
```

- [ ] **Step 10: Run all new client tests + build**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/AgencyDashboardPage.test.tsx src/pages/AgencyReferralsPage.test.tsx src/pages/AgencyCardActivitiesPage.test.tsx src/pages/AgencyProfilePage.test.tsx
npm run build
```

Expected: all new tests pass (2+1+2+1 = 6); build succeeds (only pre-existing baseline errors allowed).

- [ ] **Step 11: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts kapwa-client/src/pages/AgencyDashboardPage.tsx kapwa-client/src/pages/AgencyDashboardPage.test.tsx kapwa-client/src/pages/AgencyReferralsPage.tsx kapwa-client/src/pages/AgencyReferralsPage.test.tsx kapwa-client/src/pages/AgencyCardActivitiesPage.tsx kapwa-client/src/pages/AgencyCardActivitiesPage.test.tsx kapwa-client/src/pages/AgencyProfilePage.tsx kapwa-client/src/pages/AgencyProfilePage.test.tsx
git commit -m "feat: add agency portal dashboard, referrals, card activities, and profile pages"
```

---

### Task 6: Routes, nav, redirect, Topbar, UsersPanel

**Files:**
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/lib/nav-config.tsx`
- Modify: `kapwa-client/src/components/ProtectedRoute.tsx`
- Modify: `kapwa-client/src/components/Topbar.tsx`
- Modify: `kapwa-client/src/components/UsersPanel.tsx`

**Interfaces:**
- Consumes: the 4 pages from Task 5; `queryKeys.agencies.list()`; `useAuth` user (`role`, `agencyId`); server `GET /agencies`, `POST /users`, `PUT /users/:id` (now accepting `agencyId` from Task 1).
- Produces: `/agency/*` routes, "Agency Portal" nav section, `agency_staff → /agency/dashboard` redirect, Topbar label, UsersPanel agency select.

- [ ] **Step 1: Add routes**

In `kapwa-client/src/routes.tsx`, add imports (near the other page imports):

```tsx
import { AgencyDashboardPage } from './pages/AgencyDashboardPage';
import { AgencyReferralsPage } from './pages/AgencyReferralsPage';
import { AgencyCardActivitiesPage } from './pages/AgencyCardActivitiesPage';
import { AgencyProfilePage } from './pages/AgencyProfilePage';
```

Add routes (after the `/intake/inter-agency-referrals` route):

```tsx
  { path: '/agency', element: <Navigate to="/agency/dashboard" replace /> },
  { path: '/agency/dashboard', element: <Private roles={['agency_staff','admin']}><AgencyDashboardPage /></Private> },
  { path: '/agency/referrals', element: <Private roles={['agency_staff','admin']}><AgencyReferralsPage /></Private> },
  { path: '/agency/card-activities', element: <Private roles={['agency_staff','admin']}><AgencyCardActivitiesPage /></Private> },
  { path: '/agency/profile', element: <Private roles={['agency_staff','admin']}><AgencyProfilePage /></Private> },
```

Verify `Navigate` is imported from `react-router-dom` in routes.tsx (add if missing). Verify `Private` is the component used for role-guarded routes (the existing inter-agency route uses `<Private roles={...}>` — match that exact component; if the file calls it something else, use the existing name).

- [ ] **Step 2: Add nav section**

In `kapwa-client/src/lib/nav-config.tsx`, add an "Agency Portal" group. Find where `ArrowLeftRight` is imported (it's already there from the inter-agency plan). Add icons: `LayoutDashboard` (already used), `Send` (already used), `BadgeCheck` (already used), `Building2` (add to imports if missing). Append a new group after the "Core" group (or after "Operations"):

```tsx
  {
    label: 'Agency Portal',
    items: [
      { path: '/agency/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['agency_staff', 'admin'] },
      { path: '/agency/referrals', label: 'Referrals', icon: <Send size={20} />, roles: ['agency_staff', 'admin'] },
      { path: '/agency/card-activities', label: 'Card Activities', icon: <BadgeCheck size={20} />, roles: ['agency_staff', 'admin'] },
      { path: '/agency/profile', label: 'Agency Profile', icon: <Building2 size={20} />, roles: ['agency_staff', 'admin'] },
    ],
  },
```

Match the existing nav-config structure exactly (check how `items` and `roles` are typed — from the earlier grep: `path: string; label: string; icon: ReactNode; roles: string[]`).

- [ ] **Step 3: Add redirect map entry**

In `kapwa-client/src/components/ProtectedRoute.tsx`, add to `roleRedirectMap`:

```ts
  agency_staff: '/agency/dashboard',
```

- [ ] **Step 4: Topbar label for agency_staff**

In `kapwa-client/src/components/Topbar.tsx`:
- Import `useSWR` and `queryKeys` (check what's already imported; `queryKeys` may need adding).
- Add a fetch for the agency name when the user is agency_staff:

```tsx
  const isAgencyStaff = user?.role === 'agency_staff';
  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(
    isAgencyStaff ? queryKeys.agencies.list() : null,
  );
  const agencyLabel = isAgencyStaff && user?.agencyId
    ? (agencies || []).find(a => a.id === user.agencyId)?.name || 'Agency Staff'
    : '';
```

- Replace the `roleLabel` computation so agency_staff uses the resolved agency name:

```tsx
  const roleLabel = user?.role
    ? isAgencyStaff
      ? agencyLabel
      : ({ admin: 'MSWDO Admin', social_worker: 'MSWDO Social Worker', coordinator: 'Brgy Coordinator', claimant: 'Claimant', mayor: "Mayor's Office", auditor: 'Auditor' } as Record<string, string>)[user.role] || user.role.replace(/_/g, ' ')
    : '';
```

- **IMPORTANT:** read the current Topbar first — the roleLabel snippet may be inline in the JSX (`<span>{roleLabel}</span>` or similar). Locate where the label renders and ensure the resolved `agencyLabel` shows there. Also check `useSWR` import path and existing imports (`import useSWR from 'swr'`).

- [ ] **Step 5: UsersPanel agency select**

In `kapwa-client/src/components/UsersPanel.tsx`:

1. Add `agency_staff` to `ROLE_LABELS`:

```tsx
  agency_staff: 'Agency Staff',
```

2. Add `agencyId` to the `AppUser` interface:

```tsx
  agencyId?: string;
```

3. Fetch agencies (near the top of the `UsersPanel` component):

```tsx
  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());
```

Add `import { queryKeys } from '../lib/query-keys';` if missing (the file currently imports `api` from `../lib/api` — check).

4. **Create dialog:** locate the create-user dialog's role select. Add an agency select shown only when the chosen role is `agency_staff`:

```tsx
      {createRole === 'agency_staff' && (
        <div className="space-y-1">
          <Label>Agency *</Label>
          <Select value={createAgencyId} onValueChange={setCreateAgencyId}>
            <SelectTrigger><SelectValue placeholder="Select agency..." /></SelectTrigger>
            <SelectContent>
              {(agencies || []).map(a => (
                <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
```

Add state `const [createAgencyId, setCreateAgencyId] = useState('');` and include `agency_id: createAgencyId` in the create POST body when set.

5. **Edit dialog:** similar — add `editAgencyId` state (populated in `openEdit` from `user.agencyId`), show the agency select when `editRole === 'agency_staff'`, and include `agencyId: editAgencyId` in the `saveEdit` PUT body when set.

**IMPORTANT:** read the full current UsersPanel before editing — it has a create dialog, an edit dialog, `EditableRoleCell` (inline role change via PUT `{ role }`), and role filter dropdown. Add the agency select in BOTH dialogs (create + edit). The role filter dropdown needs no change (it filters by role string; `agency_staff` will work via `ROLE_OPTIONS`). Match the existing `Label`/`Select`/`SelectTrigger`/`SelectContent`/`SelectItem` component usage (already imported in the file).

- [ ] **Step 6: Run client tests + build**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/AgencyDashboardPage.test.tsx src/pages/AgencyReferralsPage.test.tsx src/pages/AgencyCardActivitiesPage.test.tsx src/pages/AgencyProfilePage.test.tsx src/pages/InterAgencyReferralsPage.test.tsx
npm run build
```

Expected: all pass; build succeeds (pre-existing baseline errors only).

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/routes.tsx kapwa-client/src/lib/nav-config.tsx kapwa-client/src/components/ProtectedRoute.tsx kapwa-client/src/components/Topbar.tsx kapwa-client/src/components/UsersPanel.tsx
git commit -m "feat: wire agency portal routes, nav, redirect, topbar label, and user agency select"
```

---

### Task 7: Server + client verification pass

**Files:**
- Modify: `kapwa-server/src/database/seed-accounts.ts` (optional demo agency_staff account)
- No other new files.

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: full-suite verification + a demo agency_staff seed account.

- [ ] **Step 1: (Optional) Add demo agency_staff seed account**

In `kapwa-server/src/database/seed-accounts.ts`, add to `ACCOUNT`:

```ts
  rhu_staff: { id: '20000000-0000-0000-0000-000000000009', email: 'rhu.staff@norzagaray.test', role: 'agency_staff', fullName: 'Dra. RHU Staff', phone: '09179999999' },
```

And to `ACCOUNT_CREDENTIALS`:

```ts
  rhu_staff: { password: 'rhu123' },
```

Note: the seed's `INSERT` does not set `agency_id` — after seeding, assign it manually via SQL (or leave unassigned for the 403-path test). Document in a comment-free commit message: demo account `rhu.staff@norzagaray.test / rhu123`, agency_id must be set via `UPDATE users SET agency_id = (SELECT id FROM agencies WHERE code='RHU') WHERE email='rhu.staff@norzagaray.test';` before use. If the seed file structure differs from this sketch (verify first), adapt.

- [ ] **Step 2: Run the full feature server suite**

Run from `kapwa-server/`:

```bash
npx jest src/agency-portal/agency-portal.service.spec.ts src/users/users.service.spec.ts src/inter-agency-referrals/inter-agency-referrals.service.spec.ts src/access-cards/access-cards.service.spec.ts src/agencies/agencies.service.spec.ts --coverage=false
```

Expected: all pass (including the 2 new users tests + 5 agency-portal tests).

- [ ] **Step 3: Server typecheck**

```bash
cd kapwa-server && npx tsc --noEmit
```

Expected: no NEW errors.

- [ ] **Step 4: Run the full client feature suite**

Run from `kapwa-client/`:

```bash
npx vitest run src/pages/AgencyDashboardPage.test.tsx src/pages/AgencyReferralsPage.test.tsx src/pages/AgencyCardActivitiesPage.test.tsx src/pages/AgencyProfilePage.test.tsx src/pages/InterAgencyReferralsPage.test.tsx src/pages/AccessCardViewPage.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Client build**

```bash
cd kapwa-client && npm run build
```

Expected: succeeds (pre-existing baseline errors only, none in files touched by this plan).

- [ ] **Step 6: Commit (if any changes were made in Step 1)**

```bash
git add kapwa-server/src/database/seed-accounts.ts
git commit -m "feat: add demo agency_staff seed account"
```

If no seed change was made, skip this commit.

---

## Self-Review

**Spec coverage:**
- §4.1 role enum → Task 1; §4.2 role assignment (users API) → Task 1; §4.3 redirect + labels → Task 6.
- §5.1 agency-portal module (dashboard/profile + 403) → Task 2.
- §5.2 guard additions → Task 3; §5.3 `GET /agencies/:id` → Task 3; §5.4 users API agencyId → Task 1.
- §6.1 routes → Task 6; §6.2 nav → Task 6; §6.3 four pages → Task 5 (shared components → Task 4); §6.4 query keys → Task 5; §6.5 UsersPanel → Task 6.
- §7 security/scoping → Tasks 2–3 (no new PII surface); §8 error handling → Tasks 2–3 (403/404/400).
- §9 testing → Tasks 1, 2, 5, 6 (unit) + Task 7 (verification); §9.3 E2E → follow-up after implementation (not in this plan's tasks; user-initiated like the previous feature).

**Placeholder scan:** every step has concrete code or commands; no TBD/TODO. Task 1 Step 4 and Task 6 Steps 4–5 include explicit "read the current file first / adapt if structure differs" guidance because those files' exact current shapes vary — the surrounding steps still give complete target code.

**Type consistency:** `Agency`, `InterAgencyReferral`, `ReferralStatus`, `STATUS_LABELS`, `StatusTimeline`, `ReferralCard({referral, myAgencyId, onTransition, disabled?})`, `CreateReferralForm({agencies, onCreated})` are identical across Tasks 4–6. `queryKeys.agencyPortal.dashboard()/profile()` match Task 5 + Task 6 usage. `agency_staff` string is consistent across server enum, zod enum, guards, client roles arrays, redirect map, ROLE_LABELS. `CreateUserInputSchema.agency_id` (snake) vs `UpdateUserSchema.agencyId` (camel) intentionally matches the existing create/update asymmetry in the users module (create uses snake_case, update uses camelCase) — preserved deliberately.
