# Access Card View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `category` column to access card services, auto-log case interventions, and build a per-beneficiary Access Card view page with a preview card on BeneficiaryViewPage.

**Architecture:** Backend: add `category` enum column, auto-log on intervention creation, add summary endpoint. Frontend: preview card in BeneficiaryViewPage, new AccessCardViewPage at `/beneficiary/:id/access-card`.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, React, SWR, Tailwind

## Global Constraints

- Follow existing NestJS module patterns (controller, service, entity, zod DTO)
- All DB changes via TypeORM migration
- Use existing `access_card_services` table (`AccessCardService` entity)
- Frontend: use SWR for data fetching, lucide-react for icons, Tailwind classes
- Add `claimant` role to relevant access card GET endpoints

---

### Task 1: Add `category` column to `AccessCardService` entity + migration

**Files:**
- Modify: `kapwa-server/src/access-cards/access-card-service.entity.ts`
- Create: `kapwa-server/src/database/migrations/1740000000003-AccessCardCategory.ts`
- Modify: `kapwa-server/src/access-cards/dto/access-cards.zod.ts`

**Interfaces:**
- Consumes: Existing `AccessCardService` entity
- Produces: Entity with `category` field, updated migration, DTO with `category`

- [ ] **Step 1: Add `category` column to entity**

```typescript
// kapwa-server/src/access-cards/access-card-service.entity.ts
// Add after workerNameSign:
@Column({ name: 'category', nullable: true })
category?: string;
```

- [ ] **Step 2: Create migration file**

```typescript
// kapwa-server/src/database/migrations/1740000000003-AccessCardCategory.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessCardCategory1740000000003 implements MigrationInterface {
  name = 'AccessCardCategory1740000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE access_card_services ADD COLUMN category TEXT`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE access_card_services DROP COLUMN category`
    );
  }
}
```

- [ ] **Step 3: Update DTO to include category**

```typescript
// kapwa-server/src/access-cards/dto/access-cards.zod.ts
export const LogServiceSchema = z.object({
  accessCardCode: z.string().min(1),
  serviceRendered: z.string().min(1),
  serviceDate: z.string().min(1),
  cost: z.number().nonnegative().optional(),
  agency: z.string().optional(),
  workerNameSign: z.string().optional(),
  category: z.enum(['case_service', 'referral', 'community_service', 'seminar']).optional().default('referral'),
});
```

- [ ] **Step 4: Run migration and verify**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server
npx nest build
# Run: npx typeorm migration:run (or however the project runs migrations)
```

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/access-cards/access-card-service.entity.ts
git add kapwa-server/src/database/migrations/1740000000003-AccessCardCategory.ts
git add kapwa-server/src/access-cards/dto/access-cards.zod.ts
git commit -m "feat(access-card): add category column to access_card_services"
```

---

### Task 2: Add summary endpoint + auto-log on intervention creation

**Files:**
- Modify: `kapwa-server/src/access-cards/access-cards.service.ts`
- Modify: `kapwa-server/src/access-cards/access-cards.controller.ts`
- Modify: `kapwa-server/src/case-interventions/case-interventions.service.ts`
- Modify: `kapwa-server/src/case-interventions/case-interventions.module.ts`

**Interfaces:**
- Consumes: `AccessCardService` entity, `CaseIntervention` entity, `Case` entity
- Produces: `GET /access-cards/beneficiary/:id/card/summary` endpoint, auto-log on intervention create

- [ ] **Step 1: Add `getSummary` and `logService` methods to AccessCardsService**


```typescript
// kapwa-server/src/access-cards/access-cards.service.ts
// Add imports
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessCardService } from './access-card-service.entity';

const ACCESS_CARD_PAD_WIDTH = 4;
@Injectable()
export class AccessCardsService {
  constructor(
    @InjectRepository(AccessCardService)
    private repo: Repository<AccessCardService>,
  ) {}

  async generateAndAssign(beneficiaryId: string): Promise<string> { /* existing code */ }

  async findBeneficiaryCard(beneficiaryId: string) { /* existing code */ }

  async getSummary(beneficiaryId: string) {
    const ben = await this.repo.query(
      'SELECT id, access_card_code, surname, first_name, barangay FROM beneficiaries WHERE id = $1',
      [beneficiaryId]
    );
    if (!ben?.[0]?.access_card_code) {
      throw new NotFoundException('Beneficiary has no Access Card');
    }
    const code = ben[0].access_card_code;
    const services = await this.repo.find({ where: { accessCardCode: code } });
    const byCategory: Record<string, number> = {};
    for (const s of services) {
      const cat = s.category || 'case_service';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    return { cardCode: code, total: services.length, byCategory };
  }

  async logService(data: { accessCardCode: string; serviceRendered: string; serviceDate: Date; cost?: number; agency?: string; workerNameSign?: string; category?: string }) {
    const entry = this.repo.create({
      accessCardCode: data.accessCardCode,
      serviceRendered: data.serviceRendered,
      serviceDate: data.serviceDate,
      cost: data.cost,
      agency: data.agency,
      workerNameSign: data.workerNameSign,
      category: data.category || 'referral',
    });
    return this.repo.save(entry);
  }

  async autoLogFromIntervention(intervention: { caseId: string; serviceName: string; deliveryDate?: string; amount?: number }) {
    // Find case -> beneficiary -> check access card
    const caseRow = await this.repo.query(
      'SELECT id, beneficiary_id FROM cases WHERE id = $1',
      [intervention.caseId]
    );
    if (!caseRow?.[0]?.beneficiary_id) return;
    const ben = await this.repo.query(
      'SELECT id, access_card_code FROM beneficiaries WHERE id = $1',
      [caseRow[0].beneficiary_id]
    );
    if (!ben?.[0]?.access_card_code) return; // no access card
    const entry = this.repo.create({
      accessCardCode: ben[0].access_card_code,
      serviceRendered: intervention.serviceName,
      serviceDate: intervention.deliveryDate ? new Date(intervention.deliveryDate) : new Date(),
      cost: intervention.amount,
      category: 'case_service',
    });
    await this.repo.save(entry);
  }

  async findByCard(cardCode: string) { /* existing code */ }
  async findAll(page = 1, limit = 10) { /* existing code */ }
}
```

- [ ] **Step 2: Update controller with summary endpoint + claimant roles**

```typescript
// kapwa-server/src/access-cards/access-cards.controller.ts
// Add summary endpoint after findBeneficiaryCard:

@Get('beneficiary/:id/card/summary')
@Roles('admin', 'social_worker', 'claimant')
@ApiOperation({ summary: 'Get access card summary counts' })
async getSummary(@Param('id', new ParseUUIDPipe()) id: string) {
  return this.svc.getSummary(id);
}

// Change existing beneficiary/card and log endpoints to include claimant:
@Get('beneficiary/:id/card')
@Roles('admin', 'social_worker', 'claimant')
async findBeneficiaryCard(@Param('id', new ParseUUIDPipe()) id: string) {
  return this.svc.findBeneficiaryCard(id);
}

@Post('log')
@Roles('admin', 'social_worker')
async logService(@Body(new ZodPipe(LogServiceSchema)) body: { accessCardCode: string; serviceRendered: string; serviceDate: string; cost?: number; agency?: string; workerNameSign?: string; category?: string }) {
  return this.svc.logService({ ...body, serviceDate: new Date(body.serviceDate) });
}

@Get(':cardCode')
@Roles('admin', 'social_worker', 'claimant')
async findByCard(@Param('cardCode') cardCode: string) {
  return this.svc.findByCard(cardCode);
}
```

- [ ] **Step 3: Inject AccessCardsService into CaseInterventionsService and call auto-log**

```typescript
// kapwa-server/src/case-interventions/case-interventions.service.ts
import { Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';
import { AccessCardsService } from '../access-cards/access-cards.service';

@Injectable()
export class CaseInterventionsService {
  constructor(
    @InjectRepository(CaseIntervention)
    private interventionRepo: Repository<CaseIntervention>,
    @Inject(forwardRef(() => AccessCardsService))
    private accessCardsService: AccessCardsService,
  ) {}

  async findByCaseId(caseId: string) { /* existing */ }

  async create(caseId: string, data: CreateCaseInterventionInput) {
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? undefined : v]),
    );
    const intervention = this.interventionRepo.create({ caseId, ...cleaned });
    const saved = await this.interventionRepo.save(intervention);

    // Auto-log to access card if beneficiary has one
    try {
      await this.accessCardsService.autoLogFromIntervention({
        caseId: saved.caseId,
        serviceName: saved.serviceName,
        deliveryDate: saved.deliveryDate,
        amount: saved.amount ? Number(saved.amount) : undefined,
      });
    } catch (e) {
      // Silently fail — access card logging is non-critical
      console.warn('Failed to auto-log intervention to access card:', e);
    }

    return saved;
  }

  async update(caseId: string, id: string, data: UpdateCaseInterventionInput) { /* existing */ }
  async delete(caseId: string, id: string) { /* existing */ }
}
```

- [ ] **Step 4: Update module to register cross-dependency**

```typescript
// kapwa-server/src/case-interventions/case-interventions.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseInterventionsController } from './case-interventions.controller';
import { CaseInterventionsService } from './case-interventions.service';
import { CaseIntervention } from './case-intervention.entity';
import { AccessCardsModule } from '../access-cards/access-cards.module';

@Module({
  imports: [TypeOrmModule.forFeature([CaseIntervention]), forwardRef(() => AccessCardsModule)],
  controllers: [CaseInterventionsController],
  providers: [CaseInterventionsService],
  exports: [CaseInterventionsService],
})
export class CaseInterventionsModule {}
```

- [ ] **Step 5: Build and verify**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx nest build
```

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/access-cards/access-cards.service.ts
git add kapwa-server/src/access-cards/access-cards.controller.ts
git add kapwa-server/src/case-interventions/case-interventions.service.ts
git add kapwa-server/src/case-interventions/case-interventions.module.ts
git commit -m "feat(access-card): add summary endpoint, auto-log interventions, open claimant roles"
```

---

### Task 3: Update BeneficiaryViewPage with Access Card preview card

**Files:**
- Modify: `/home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client/src/pages/BeneficiaryViewPage.tsx`

**Interfaces:**
- Consumes: `GET /access-cards/beneficiary/:id/card/summary` endpoint
- Produces: Richer access card preview in right sidebar

- [ ] **Step 1: Add SWR query for access card summary**

Add import for `CreditCard` icon (already imported on line 20).

Add after the family graph SWR call (around line 142):

```typescript
const { data: cardSummary } = useSWR<{ cardCode: string; total: number; byCategory: Record<string, number> }>(
  id && beneficiary?.accessCardCode ? queryKeys.accessCards.summary(id) : null,
);
```

- [ ] **Step 2: Replace ID References section**

Replace lines 594-616 (the ID References card) with:

```tsx
{/* Access Card */}
<div className="rounded-lg bg-card p-4 shadow-sm border border-border">
  <div className="flex items-center gap-2 text-primary mb-3">
    <CreditCard size={16} />
    <h3 className="text-xs font-semibold uppercase tracking-wider">Access Card</h3>
  </div>
  {beneficiary.accessCardCode ? (
    <div>
      <p className="text-xs text-muted-foreground">Card Code</p>
      <p className="font-mono text-sm font-medium text-primary">{beneficiary.accessCardCode}</p>
      {cardSummary && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(cardSummary.byCategory).map(([cat, count]) => (
            <Badge key={cat} variant="secondary" className="text-[10px]">
              {count}
              <span className="ml-0.5 font-normal">
                {cat === 'case_service' ? 'Case' : cat === 'referral' ? 'Referrals' : cat === 'community_service' ? 'Community' : 'Seminars'}
              </span>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <Button size="sm" className="flex-1" onClick={() => navigate(`/beneficiary/${id}/access-card`)}>
          <ClipboardList size={14} className="mr-1" /> View Record
        </Button>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/beneficiary/${id}/card/print`)}>Print</Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={handleReprint}>Reprint</Button>
      </div>
    </div>
  ) : (
    <Button onClick={handleAssignCard} disabled={assigning} className="w-full" size="sm">
      {assigning ? 'Assigning...' : 'Generate & Assign Card'}
    </Button>
  )}
</div>
```

- [ ] **Step 3: Build and verify**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | grep 'BeneficiaryViewPage'
```

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/pages/BeneficiaryViewPage.tsx
git commit -m "feat(access-card): update BeneficiaryViewPage with access card preview card"
```

---

### Task 4: Create Access Card detail page `/beneficiary/:id/access-card`

**Files:**
- Create: `/home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client/src/pages/AccessCardViewPage.tsx`
- Modify: `/home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client/src/routes.tsx`
- Modify: `/home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client/src/lib/query-keys.ts`

**Interfaces:**
- Consumes: `GET /access-cards/beneficiary/:id/card`, `GET /beneficiaries/:id`, `GET /beneficiaries/:id/family-graph`
- Produces: Full tabular view page with beneficiary info header

- [ ] **Step 1: Add query keys**

```typescript
// kapwa-client/src/lib/query-keys.ts
// In the accessCards section, add:
summary: (benId: string) => memo(`accessCards.summary.${benId}`, () => ['access-cards', 'beneficiary', benId, 'card', 'summary'] as const),
detail: (benId: string) => memo(`accessCards.detail.${benId}`, () => ['access-cards', 'beneficiary', benId, 'card'] as const),
```

- [ ] **Step 2: Create AccessCardViewPage**

```tsx
// kapwa-client/src/pages/AccessCardViewPage.tsx
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, User, MapPin, Calendar, Phone, Users, Plus } from 'lucide-react';

interface AccessCardService {
  id: string;
  accessCardCode: string;
  serviceDate: string;
  serviceRendered: string;
  cost?: number;
  agency?: string;
  workerNameSign?: string;
  category?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  case_service: 'Case Service',
  referral: 'Referral',
  community_service: 'Community Service',
  seminar: 'Seminar',
};

const CATEGORY_TABS = ['', 'case_service', 'referral', 'community_service', 'seminar'];
const CATEGORY_TAB_LABELS: Record<string, string> = {
  '': 'All',
  case_service: 'Case Services',
  referral: 'Referrals',
  community_service: 'Community',
  seminar: 'Seminars',
};

function CategoryBadge({ category }: { category?: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    case_service: 'default',
    referral: 'secondary',
    community_service: 'outline',
    seminar: 'secondary',
  };
  return (
    <Badge variant={variants[category || ''] || 'outline'} className="text-[10px]">
      {CATEGORY_LABELS[category || ''] || category || 'Unknown'}
    </Badge>
  );
}

export function AccessCardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ serviceRendered: '', serviceDate: '', cost: '', agency: '', workerNameSign: '', category: 'referral' });
  const [adding, setAdding] = useState(false);

  const { data: ben } = useSWR<Record<string, unknown>>(
    id ? queryKeys.beneficiaries.detail(id) : null,
  );
  const { data: famGraph } = useSWR<{ members?: Array<{ fullName: string; relationship: string; age: number }> }>(
    id ? queryKeys.beneficiaries.familyGraph(id) : null,
  );
  const { data: cardData, mutate: cardMutate } = useSWR<{ beneficiary: any; code: string; services: AccessCardService[] }>(
    id ? queryKeys.accessCards.detail(id) : null,
  );

  const filteredServices = (cardData?.services || []).filter(
    s => !activeTab || s.category === activeTab,
  );

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!cardData?.code) return;
    setAdding(true);
    try {
      await api.post('/access-cards/log', {
        accessCardCode: cardData.code,
        serviceRendered: addForm.serviceRendered,
        serviceDate: addForm.serviceDate,
        cost: addForm.cost ? parseFloat(addForm.cost) : undefined,
        agency: addForm.agency || undefined,
        workerNameSign: addForm.workerNameSign || undefined,
        category: addForm.category,
      });
      await cardMutate();
      setShowAddForm(false);
      setAddForm({ serviceRendered: '', serviceDate: '', cost: '', agency: '', workerNameSign: '', category: 'referral' });
    } catch (err) {
      console.error('Failed to add entry:', err);
    } finally {
      setAdding(false);
    }
  }

  const loading = !ben && id;

  if (loading) {
    return (
      <PageShell title="Access Card" description="Loading..." backTo={{ label: 'Back', onClick: () => navigate(-1) }}>
        <CardGridSkeleton />
      </PageShell>
    );
  }

  if (!cardData) {
    return (
      <PageShell title="Access Card" description="" backTo={{ label: 'Back', onClick: () => navigate(-1) }}>
        <EmptyState variant="no-data" />
      </PageShell>
    );
  }

  const benInfo = cardData.beneficiary || {};
  const fullName = ben
    ? `${ben.firstName || ''} ${ben.middleName || ''} ${ben.surname || ''}`.replace(/\s+/g, ' ').trim()
    : `${benInfo.first_name || ''} ${benInfo.surname || ''}`.trim();

  return (
    <PageShell
      title="Access Card"
      description={`Service record for ${fullName}`}
      backTo={{ label: 'Back', onClick: () => navigate(-1) }}
    >
      {/* Beneficiary Header */}
      <div className="rounded-lg bg-card p-4 shadow-sm border border-border mb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {fullName ? fullName.charAt(0) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-foreground truncate">{fullName}</h2>
                <p className="font-mono text-sm text-primary">{cardData.code}</p>
              </div>
              <Badge variant="default" className="text-[10px]">{cardData.services.length} total</Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User size={13} /> {benInfo.gender || ben?.gender || '—'}</span>
              <span className="flex items-center gap-1"><MapPin size={13} /> {benInfo.barangay || ben?.address || '—'}</span>
              {ben?.phone && <span className="flex items-center gap-1"><Phone size={13} /> {`${ben.phone}`}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Family Members */}
      {famGraph?.members && famGraph.members.length > 0 && (
        <div className="rounded-lg bg-card p-4 shadow-sm border border-border mb-4">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Users size={16} />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Family Members ({famGraph.members.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {famGraph.members.map((m, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {m.fullName}
                <span className="ml-1 text-muted-foreground">({m.relationship}, {m.age})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Service Records */}
      <div className="rounded-lg bg-card shadow-sm border border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Service Records</h3>
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus size={14} className="mr-1" /> Add Entry
          </Button>
        </div>

        {/* Category tabs */}
        <div className="px-4 pb-2 flex gap-1 overflow-x-auto">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {CATEGORY_TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Add Entry Form */}
        {showAddForm && (
          <form onSubmit={handleAddEntry} className="mx-4 mb-3 p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Category *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={addForm.category}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="referral">Referral</option>
                  <option value="community_service">Community Service</option>
                  <option value="seminar">Seminar</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Service Date *</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={addForm.serviceDate}
                  onChange={e => setAddForm(f => ({ ...f, serviceDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Service Rendered *</label>
              <input
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={addForm.serviceRendered}
                onChange={e => setAddForm(f => ({ ...f, serviceRendered: e.target.value }))}
                placeholder="e.g., Medical Referral to Norzagaray RHU"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Cost (₱)</label>
                <input type="number" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={addForm.cost} onChange={e => setAddForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Agency</label>
                <input className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={addForm.agency} onChange={e => setAddForm(f => ({ ...f, agency: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Worker Name</label>
                <input className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={addForm.workerNameSign} onChange={e => setAddForm(f => ({ ...f, workerNameSign: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={adding}>{adding ? 'Saving...' : 'Save Entry'}</Button>
              <Button variant="outline" size="sm" type="button" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Table */}
        <div className="px-4 pb-4">
          {filteredServices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No records found</p>
          ) : (
            <div className="space-y-1">
              {filteredServices.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <CategoryBadge category={s.category} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.serviceRendered}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.serviceDate).toLocaleDateString()}
                      {s.agency && ` · ${s.agency}`}
                      {s.workerNameSign && ` · ${s.workerNameSign}`}
                    </p>
                  </div>
                  {s.cost != null && Number(s.cost) > 0 && (
                    <span className="text-xs font-semibold shrink-0">₱{Number(s.cost).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 3: Add route and import**

```tsx
// kapwa-client/src/routes.tsx
// Add import at top:
import { AccessCardViewPage } from './pages/AccessCardViewPage';

// Add route inside the protected routes section:
{ path: '/beneficiary/:id/access-card', element: <Private roles={['admin','social_worker','claimant']}><AccessCardViewPage /></Private> },
```

- [ ] **Step 4: Build and verify**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit 2>&1 | grep -E 'AccessCardViewPage|routes'
```

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/pages/AccessCardViewPage.tsx
git add kapwa-client/src/routes.tsx
git add kapwa-client/src/lib/query-keys.ts
git commit -m "feat(access-card): add AccessCardViewPage with beneficiary info, family, and service records"
```

---

### Task 5: Verify end-to-end

**Files:** N/A — manual verification

- [ ] **Step 1: Rebuild backend and frontend**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && npx nest build
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && npx tsc --noEmit
```

- [ ] **Step 2: Verify all pre-existing errors only (no new errors)**

Expected output: No new type errors introduced.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: finalize access card view implementation"
```
