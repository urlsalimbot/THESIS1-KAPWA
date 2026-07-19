# Worker/Admin Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the social_worker/admin dashboard into a widget-based bento-grid layout with independent data fetching, role-based visibility, and drag-and-drop reordering of chart/alert widgets.

**Architecture:** `DashboardEngine` wraps a `react-grid-layout` zone containing 5 movable widgets (CaseStatusChart, SlaWidget, TrendsChart, NeedsAttention, BarangayBreakdown) between a fixed StatsRow (6 KPI cards) and a fixed DataTable. Each widget is self-contained with its own SWR query, loading skeleton, and empty state.

**Tech Stack:** react-grid-layout (DnD), recharts (charts), SWR (data fetching), TypeScript

## Global Constraints

- All dashboard widgets go in `src/components/dashboard/` (alongside existing `widgets/` dir)
- Each widget fetches its own data via SWR using existing query keys from `@/lib/query-keys`
- DnD scope: only the 5 chart/alert widgets — stat cards, calendar, and DataTable remain fixed
- DnD persists layout to `localStorage` keyed by `dashboard-layout-{role}`
- DnD disabled below `lg` breakpoint

---

### Task 1: Backend — Expand GET /dashboard to include full metrics

**Files:**
- Modify: `kapwa-server/src/dashboard/dashboard.controller.ts:27-60`

**Interfaces:**
- Consumes: existing `DashboardService.getMetrics(userBarangay)`, `getSlaCompliance()`, `getServedToday()`, `getLastSync()`, `getRecentCases()`
- Produces: expanded `GET /dashboard` response with `totalCases`, `approvedCases`, `disbursedCases`, `byStatus`, `recentInterventions`

- [ ] **Step 1: Modify the controller to destructure metrics and include them**

Replace the response object in `getDashboard()` to include full metrics from `dashService.getMetrics()`:

```typescript
const [metrics, sla, servedToday, lastSync] = await Promise.all([
  this.dashService.getMetrics(userBarangay),
  this.dashService.getSlaCompliance(),
  this.dashService.getServedToday(),
  this.dashService.getLastSync(),
]);

let recentCasesRaw: any[] = [];
try {
  recentCasesRaw = await this.dashService.getRecentCases(userBarangay);
} catch (e: unknown) {
  const errMsg = e instanceof Error ? e.message : String(e);
  const errStack = e instanceof Error ? e.stack : '';
  this.logger.error('getRecentCases failed', errMsg, errStack);
}

return {
  servedToday,
  servedChange: '+0%',
  pendingReview: metrics.byStatus?.find((s: any) => s.status === 'in_review')?.count || 0,
  urgentCount: sla.overdueCount || 0,
  disbursedMonth: metrics.totalDisbursedAmount || 0,
  beneficiaryCount: metrics.uniqueHouseholds || 0,
  totalCases: metrics.totalCases || 0,
  approvedCases: metrics.approvedCases || 0,
  disbursedCases: metrics.disbursedCases || 0,
  recentInterventions: metrics.recentInterventions || 0,
  byStatus: metrics.byStatus || [],
  lastSync,
  recentCases: recentCasesRaw.map((c: any) => ({
    id: c.controlNo,
    name: `${c.beneficiary?.firstName || ''} ${c.beneficiary?.surname || ''}`.trim(),
    category: c.serviceRequested?.join(', ') || '',
    barangay: c.beneficiary?.address?.split(',').pop()?.trim() || '',
    remarks: c.remarks || '',
    date: c.updatedAt,
    status: c.status,
  })),
};
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-server && npx tsc --noEmit 2>&1 | head -5
```

Expected: no errors in dashboard.controller.ts

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/dashboard/dashboard.controller.ts
git commit -m "feat(api): expand GET /dashboard with full metrics"
```

---

### Task 2: Install react-grid-layout

**Files:**
- Modify: `kapwa-client/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd kapwa-client && npm install react-grid-layout && npm install -D @types/react-grid-layout
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('react-grid-layout')" && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/package.json kapwa-client/package-lock.json
git commit -m "feat: add react-grid-layout dependency"
```

---

### Task 3: Create StatsRow widget — 6 KPI stat cards

**Files:**
- Create: `kapwa-client/src/components/dashboard/StatsRow.tsx`

**Interfaces:**
- Consumes: SWR key `queryKeys.dashboard.stats()` → `GET /dashboard`
- Produces: `<StatsRow data={DashboardData} />` — renders 6 stat cards in responsive grid

- [ ] **Step 1: Create the component**

```tsx
import { TrendingUp, Clock, DollarSign, Users, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardData {
  label: string;
  value: string;
  change: string;
  icon: React.ElementType;
  urgent?: boolean;
}

function StatCardItem({ stat }: { stat: StatCardData }) {
  const Icon = stat.icon;
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${stat.urgent ? 'ring-1 ring-destructive/30 bg-destructive/5' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</span>
          <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center shadow-sm ${stat.urgent ? 'bg-red-100 text-red-700' : 'bg-muted'}`}>
            <Icon size={16} />
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground font-heading tracking-tight tabular-nums mb-0.5">{stat.value}</div>
        <p className={`text-xs ${stat.urgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{stat.change}</p>
      </CardContent>
    </Card>
  );
}

interface StatsRowProps {
  servedToday: number;
  pendingReview: number;
  urgentCount: number;
  disbursedMonth: number;
  beneficiaryCount: number;
  recentInterventions: number;
}

export function StatsRow(data: StatsRowProps) {
  const stats: StatCardData[] = [
    { label: 'Served Today', value: String(data.servedToday), change: 'from yesterday', icon: TrendingUp },
    { label: 'Pending Review', value: String(data.pendingReview), change: 'cases pending assessment', icon: Clock },
    { label: 'Overdue SLA', value: String(data.urgentCount), change: 'exceeded 72h window', icon: AlertTriangle, urgent: data.urgentCount > 0 },
    { label: 'Disbursed Month', value: `₱${data.disbursedMonth.toLocaleString()}`, change: `${data.beneficiaryCount} households`, icon: DollarSign },
    { label: 'Households Served', value: String(data.beneficiaryCount), change: 'unique households', icon: Users },
    { label: 'Recent Interventions', value: String(data.recentInterventions), change: 'in last 7 days', icon: Activity },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {stats.map(s => <StatCardItem key={s.label} stat={s} />)}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep StatsRow || echo "No errors"
```

Expected: no errors from StatsRow.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/StatsRow.tsx
git commit -m "feat(dashboard): add StatsRow widget with 6 KPI cards"
```

---

### Task 4: Create CaseStatusChart widget — bar chart from byStatus

**Files:**
- Create: `kapwa-client/src/components/dashboard/CaseStatusChart.tsx`

**Interfaces:**
- Consumes: `byStatus: { status: string; count: number }[]`
- Produces: `<CaseStatusChart data={byStatus} />`

- [ ] **Step 1: Create component**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  disbursed: 'Disbursed',
  closed: 'Closed',
};

interface CaseStatus {
  status: string;
  count: number;
}

interface CaseStatusChartProps {
  data: CaseStatus[];
}

export function CaseStatusChart({ data }: CaseStatusChartProps) {
  const chartData = data.map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    count: d.count,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Case Status</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-8 text-center">No case data</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Case Status</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep CaseStatusChart || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/CaseStatusChart.tsx
git commit -m "feat(dashboard): add CaseStatusChart widget"
```

---

### Task 5: Create SlaWidget — SLA compliance status

**Files:**
- Create: `kapwa-client/src/components/dashboard/SlaWidget.tsx`

**Interfaces:**
- Consumes: `urgentCount: number`
- Produces: `<SlaWidget overdueCount={number} />`

- [ ] **Step 1: Create component**

```tsx
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SlaWidgetProps {
  overdueCount: number;
}

export function SlaWidget({ overdueCount }: SlaWidgetProps) {
  const navigate = useNavigate();
  const compliant = overdueCount === 0;

  return (
    <Card className={compliant ? '' : 'ring-1 ring-destructive/30'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} />
          SLA Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          {compliant
            ? <CheckCircle size={20} className="text-green-600" />
            : <AlertTriangle size={20} className="text-destructive" />
          }
          <span className={`font-semibold ${compliant ? 'text-green-700' : 'text-destructive'}`}>
            {compliant ? 'Compliant' : `${overdueCount} Overdue`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Cases exceeding 72-hour SLA window
        </p>
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/cases')}>
          View Cases
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep SlaWidget || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/SlaWidget.tsx
git commit -m "feat(dashboard): add SlaWidget"
```

---

### Task 6: Create NeedsAttention widget — pending/urgent cases

**Files:**
- Create: `kapwa-client/src/components/dashboard/NeedsAttention.tsx`

**Interfaces:**
- Consumes: `recentCases: CaseRow[]` with `status` field
- Produces: `<NeedsAttention cases={CaseRow[]} />`

- [ ] **Step 1: Create component**

```tsx
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NeedsAttentionCase {
  id: string;
  name: string;
  status: string;
}

interface NeedsAttentionProps {
  cases: NeedsAttentionCase[];
}

const ACTION_LABELS: Record<string, string> = {
  pending_assessment: 'Assess',
  in_review: 'Review',
};

export function NeedsAttention({ cases }: NeedsAttentionProps) {
  const navigate = useNavigate();
  const needsAttention = cases.filter(c => c.status === 'pending_assessment' || c.status === 'in_review').slice(0, 5);

  if (needsAttention.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Needs Attention</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-4 text-center">No pending actions</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          Needs Attention ({needsAttention.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {needsAttention.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={10} /> {c.status.replace('_', ' ')}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>
                <Eye size={12} className="mr-1" /> {ACTION_LABELS[c.status] || 'View'}
              </Button>
            </div>
          </div>
        ))}
        {needsAttention.length >= 5 && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/cases')}>
            View All ({c => c.length} total)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep NeedsAttention || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/NeedsAttention.tsx
git commit -m "feat(dashboard): add NeedsAttention widget"
```

---

### Task 7: Create BarangayBreakdown widget — cases by barangay

**Files:**
- Create: `kapwa-client/src/components/dashboard/BarangayBreakdown.tsx`

**Interfaces:**
- Consumes: `recentCases: { barangay: string }[]`
- Produces: `<BarangayBreakdown cases={CaseRow[]} />`

- [ ] **Step 1: Create component**

```tsx
import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface BarangayItem {
  name: string;
  count: number;
}

interface BarangayBreakdownProps {
  cases: BarangayItem[];
}

export function BarangayBreakdown({ cases }: BarangayBreakdownProps) {
  if (cases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Barangay</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-4 text-center">No data</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">By Barangay</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={cases} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep BarangayBreakdown || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/BarangayBreakdown.tsx
git commit -m "feat(dashboard): add BarangayBreakdown widget"
```

---

### Task 8: Extract TrendsChart into its own component

**Files:**
- Create: `kapwa-client/src/components/dashboard/TrendsChart.tsx`
- Modify: `kapwa-client/src/pages/DashboardPage.tsx` (remove inline trends section)

**Interfaces:**
- Consumes: `GET /dashboard/trends` → `TrendData[]`
- Produces: `<TrendsChart data={TrendData[]} />`

- [ ] **Step 1: Create TrendsChart component**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendData {
  month: string;
  casesCreated: number;
  disbursed: number;
}

interface TrendsChartProps {
  data: TrendData[];
}

export function TrendsChart({ data }: TrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Monthly Trends (6mo)</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-8 text-center">No trend data</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Monthly Trends (6mo)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: '12px' }} />
            <Bar dataKey="casesCreated" name="Cases" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="disbursed" name="Disbursed (₱)" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep TrendsChart || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/TrendsChart.tsx
git commit -m "feat(dashboard): extract TrendsChart widget"
```

---

### Task 9: Extract ActivityCalendar into its own component

**Files:**
- Create: `kapwa-client/src/components/dashboard/ActivityCalendar.tsx`

**Interfaces:**
- Consumes: `data: DailyCounts` (Record<string, { interventions: number; cases: number }>)
- Produces: `<ActivityCalendar data={DailyCounts} year={number} month={number} />`

- [ ] **Step 1: Create component**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface DailyCounts {
  [day: string]: { interventions: number; cases: number };
}

interface ActivityCalendarProps {
  data: DailyCounts | null;
  year: number;
  month: number;
}

export function ActivityCalendar({ data, year, month }: ActivityCalendarProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Activity Calendar</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-8 text-center">Loading...</p></CardContent>
      </Card>
    );
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const today = new Date();

  const weeks: { day: number; count: number }[][] = [];
  let week: { day: number; count: number }[] = [];
  for (let i = 0; i < firstDay; i++) week.push({ day: 0, count: -1 });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const counts = data[key];
    const total = counts ? counts.interventions + counts.cases : 0;
    week.push({ day: d, count: total });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push({ day: 0, count: -1 }); weeks.push(week); }

  const maxCount = Math.max(1, ...Object.values(data).flatMap(d => d.cases + d.interventions));
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const colors = ['bg-muted', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-500'];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Activity Calendar</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">{monthName}</p>
        <div className="grid grid-cols-7 gap-0.5 text-[9px] leading-none">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[8px] text-muted-foreground py-0.5 font-medium">{d}</div>
          ))}
          {weeks.flat().map((cell, i) => {
            if (cell.day === 0) return <div key={i} />;
            const intensity = cell.count > 0 ? Math.min(Math.ceil((cell.count / maxCount) * 4), 4) : 0;
            const isToday = cell.day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
            return (
              <div
                key={i}
                title={`${monthName} ${cell.day}: ${cell.count} activities`}
                className={`rounded-sm h-5 flex items-center justify-center text-[8px] font-medium transition-colors ${colors[intensity]} ${isToday ? 'ring-1 ring-primary' : ''} ${cell.count > 0 ? 'text-white' : 'text-muted-foreground'}`}
              >
                {cell.day}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep ActivityCalendar || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/dashboard/ActivityCalendar.tsx
git commit -m "feat(dashboard): extract ActivityCalendar widget"
```

---

### Task 10: Add dashboard metrics query key

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts`

- [ ] **Step 1: Add the metrics query key**

Add after `dailyCounts`:

```typescript
metrics: () => memo('dashboard.metrics', () => ['dashboard', 'metrics'] as const),
```

- [ ] **Step 2: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts
git commit -m "feat: add dashboard metrics query key"
```

---

### Task 11: Create DashboardEngine — DnD layout orchestrator

**Files:**
- Create: `kapwa-client/src/components/dashboard/DashboardEngine.tsx`

**Interfaces:**
- Produces: `<DashboardEngine widgets={WidgetConfig[]} layouts={...} />`
- Consumes: widget config array with `key`, `component`, `minW`, `defaultPosition`

- [ ] **Step 1: Create DashboardEngine component**

```tsx
import { useState, useEffect, useCallback, ReactNode } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

export interface WidgetConfig {
  key: string;
  component: ReactNode;
  defaultW?: number;
  defaultH?: number;
  minW?: number;
  minH?: number;
}

interface DashboardEngineProps {
  widgets: WidgetConfig[];
  rowHeight?: number;
  cols?: { lg: number; md: number; sm: number; xs: number; xxs: number };
  storageKey?: string;
}

const DEFAULT_COLS = { lg: 3, md: 2, sm: 1, xs: 1, xxs: 1 };

function getDefaultLayout(widgets: WidgetConfig[]) {
  return widgets.map((w, i) => ({
    i: w.key,
    x: (i * 2) % 6,
    y: Math.floor(i / 3) * 2,
    w: w.defaultW ?? 2,
    h: w.defaultH ?? 5,
    minW: w.minW ?? 2,
    minH: w.minH ?? 3,
  }));
}

export function DashboardEngine({
  widgets,
  rowHeight = 60,
  cols = DEFAULT_COLS,
  storageKey = 'dashboard-layout',
}: DashboardEngineProps) {
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { lg: getDefaultLayout(widgets) };
  });

  const onLayoutChange = useCallback((layout: any[]) => {
    const newLayouts = { lg: layout };
    setLayouts(newLayouts);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newLayouts));
    } catch {}
  }, [storageKey]);

  const layout = layouts.lg || getDefaultLayout(widgets);

  // On mobile (< lg breakpoint, 1024px), disable DnD by rendering a static grid
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={cols}
      rowHeight={rowHeight}
      width={1200}
      onLayoutChange={onLayoutChange}
      isDraggable={!isMobile}
      isResizable={!isMobile}
      draggableHandle=".widget-drag-handle"
    >
      {widgets.map(w => (
        <div key={w.key} className="relative">
          {!isMobile && (
            <div className="widget-drag-handle absolute top-1 right-2 z-10 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="3" cy="3" r="1"/><circle cx="9" cy="3" r="1"/><circle cx="3" cy="9" r="1"/><circle cx="9" cy="9" r="1"/><circle cx="3" cy="6" r="1"/><circle cx="9" cy="6" r="1"/></svg>
            </div>
          )}
          {w.component}
        </div>
      ))}
    </GridLayout>
  );
}
```

- [ ] **Step 2: Create minimal CSS for grid transitions**

Create `kapwa-client/src/components/dashboard/dashboard-engine.css`:

```css
.react-grid-item {
  transition: none;
}
.react-grid-item.react-draggable-dragging {
  z-index: 100;
  opacity: 0.9;
}
.react-grid-placeholder {
  background: hsl(var(--primary) / 0.15) !important;
  border-radius: var(--radius);
}
```

- [ ] **Step 3: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep DashboardEngine || echo "No errors"
```

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/components/dashboard/DashboardEngine.tsx kapwa-client/src/components/dashboard/dashboard-engine.css
git commit -m "feat(dashboard): add DashboardEngine with DnD grid layout"
```

---

### Task 12: Rewrite DashboardPage to use DashboardEngine

**Files:**
- Modify: `kapwa-client/src/pages/DashboardPage.tsx` — replace inline sections with widget composition

- [ ] **Step 1: Rewrite DashboardPage**

Replace the entire file content:

```tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, DollarSign, Plus, Eye } from 'lucide-react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { ClaimantWidgets } from '@/components/dashboard/widgets/ClaimantWidgets';
import { MayorWidgets } from '@/components/dashboard/widgets/MayorWidgets';
import { AuditorWidgets } from '@/components/dashboard/widgets/AuditorWidgets';
import { CoordinatorWidgets } from '@/components/dashboard/widgets/CoordinatorWidgets';
import { SlaTimer } from '@/components/sla/SlaTimer';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { CaseStatusChart } from '@/components/dashboard/CaseStatusChart';
import { SlaWidget } from '@/components/dashboard/SlaWidget';
import { TrendsChart } from '@/components/dashboard/TrendsChart';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { BarangayBreakdown } from '@/components/dashboard/BarangayBreakdown';
import { ActivityCalendar } from '@/components/dashboard/ActivityCalendar';
import { DashboardEngine } from '@/components/dashboard/DashboardEngine';
import type { WidgetConfig } from '@/components/dashboard/DashboardEngine';

interface Stat { label: string; value: string; change: string; icon: React.ElementType; iconClass: string; }
interface CaseRow { id: string; name: string; category: string; barangay: string; remarks: string; date: string; status: string; updatedAt?: string; }

interface DashboardData {
  servedToday?: number; servedChange?: string; lastSync?: string;
  pendingReview?: number; urgentCount?: number; disbursedMonth?: number;
  beneficiaryCount?: number; recentInterventions?: number;
  totalCases?: number; approvedCases?: number; disbursedCases?: number;
  byStatus?: { status: string; count: number }[];
  recentCases?: CaseRow[];
}

interface TrendData {
  month: string; casesCreated: number; disbursed: number;
}

interface DailyCounts {
  [day: string]: { interventions: number; cases: number };
}

function CaseActions({ id }: { id: string }) {
  const nav = useNavigate();
  return (
    <Button variant="ghost" size="sm" onClick={() => nav(`/cases/${id}`)} aria-label="View Case">
      <Eye size={14} className="mr-1" /> View
    </Button>
  );
}

const StatusBadge = React.memo(({ status }: { status: string }) => {
  const variantMap: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    approved: 'default', in_review: 'secondary', pending_assessment: 'outline', disbursed: 'secondary', closed: 'outline',
  };
  const labelMap: Record<string, string> = {
    pending_assessment: 'Pending', in_review: 'In Review', approved: 'Approved', disbursed: 'Disbursed', closed: 'Closed',
  };
  return <Badge variant={variantMap[status] || 'outline'}>{labelMap[status] || status}</Badge>;
});

const DEFAULT_SLA_HOURS = 48;

const dashboardCaseColumns: ColumnDef<CaseRow>[] = [
  { accessorKey: 'id', header: 'Case ID', cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.id}</span> },
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge> },
  { accessorKey: 'barangay', header: 'Barangay' },
  { accessorKey: 'remarks', header: 'Remarks', cell: ({ row }) => <span className="text-xs">{row.original.remarks}</span> },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    accessorKey: 'sla', header: 'SLA', cell: ({ row }) => {
      const { updatedAt } = row.original;
      if (!updatedAt) return <span className="text-xs text-muted-foreground">&mdash;</span>;
      return <SlaTimer stageStartedAt={updatedAt} slaHours={DEFAULT_SLA_HOURS} size="sm" />;
    },
  },
  { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{row.original.date}</span> },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <CaseActions id={row.original.id} />,
  },
];

const WORKER_ROLES = ['social_worker', 'admin'];

const offlineStats: Stat[] = [
  { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
  { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
  { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const { user } = useAuth();
  const role = user?.role || '';

  const swrKey = WORKER_ROLES.includes(role) ? queryKeys.dashboard.stats() : null;
  const { data, isLoading } = useSWR<DashboardData>(swrKey);
  const { data: trends } = useSWR<TrendData[]>(WORKER_ROLES.includes(role) ? queryKeys.dashboard.trends() : null);
  const now = new Date();
  const { data: dailyCounts } = useSWR<DailyCounts>(
    WORKER_ROLES.includes(role) ? queryKeys.dashboard.dailyCounts(now.getFullYear(), now.getMonth() + 1) : null,
  );

  const cases = useMemo(() => data?.recentCases ?? [], [data]);
  const lastSync = data ? Date.now() : null;
  const loading = isLoading && WORKER_ROLES.includes(role);

  // Compute barangay breakdown from recentCases
  const barangayData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      const b = c.barangay || 'Unknown';
      counts[b] = (counts[b] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [cases]);

  if (loading) {
    return (
      <PageShell title="Dashboard" description="Overview of social welfare operations and metrics.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><CardGridSkeleton /></CardContent></Card>
          ))}
        </div>
        <div className="mt-6"><TableSkeleton rows={5} /></div>
      </PageShell>
    );
  }

  if (!WORKER_ROLES.includes(role)) {
    return (
      <PageShell title="Dashboard" description="Overview of social welfare operations and metrics.">
        {role === 'claimant' && <ClaimantWidgets />}
        {role === 'mayor' && <MayorWidgets />}
        {role === 'auditor' && <AuditorWidgets />}
        {role === 'coordinator' && <CoordinatorWidgets />}
        {!['claimant', 'mayor', 'auditor', 'coordinator'].includes(role) && <EmptyState variant="no-access" />}
      </PageShell>
    );
  }

  const widgets: WidgetConfig[] = [
    { key: 'case-status', component: <CaseStatusChart data={data?.byStatus || []} />, defaultW: 2, defaultH: 5, minH: 4 },
    { key: 'sla', component: <SlaWidget overdueCount={data?.urgentCount ?? 0} />, defaultW: 1, defaultH: 5, minH: 4 },
    { key: 'trends', component: <TrendsChart data={trends || []} />, defaultW: 2, defaultH: 5, minH: 4 },
    { key: 'needs-attention', component: <NeedsAttention cases={cases} />, defaultW: 2, defaultH: 5, minH: 4 },
    { key: 'barangay', component: <BarangayBreakdown cases={barangayData} />, defaultW: 1, defaultH: 5, minH: 4 },
  ];

  return (
    <PageShell title="Dashboard" description="Overview of social welfare operations and metrics." cachedAt={lastSync ?? undefined}
      actions={
        <Button size="sm" onClick={() => navigate('/intake')}>
          <Plus size={14} className="mr-1" /> New Intake
        </Button>
      }>

      {/* Fixed: Stat cards */}
      {data && (
        <StatsRow
          servedToday={data.servedToday ?? 0}
          pendingReview={data.pendingReview ?? 0}
          urgentCount={data.urgentCount ?? 0}
          disbursedMonth={data.disbursedMonth ?? 0}
          beneficiaryCount={data.beneficiaryCount ?? 0}
          recentInterventions={data.recentInterventions ?? 0}
        />
      )}

      {/* DnD Widget Grid */}
      <div className="mt-4">
        <DashboardEngine
          widgets={widgets}
          storageKey={`dashboard-layout-${role}`}
        />
      </div>

      {/* Fixed: Activity Calendar + Recent Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-1">
          <ActivityCalendar data={dailyCounts ?? null} year={now.getFullYear()} month={now.getMonth() + 1} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight mb-3">Recent Cases</h2>
          <DataTable columns={dashboardCaseColumns} data={cases} rowCount={cases.length} pagination={pagination} onPaginationChange={setPagination} sorting={[]} />
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep -E "DashboardPage\.tsx" | grep -v "__tests__" | grep -v "\.test\."
```

Expected: No TypeScript errors in DashboardPage.tsx.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): rewrite DashboardPage with widget engine"
```

---

### Task 13: Full build verification

- [ ] **Step 1: Build both packages**

```bash
cd kapwa-server && npx tsc --noEmit 2>&1 | head -10
cd kapwa-client && npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep -v "\.test\." | head -20
```

Expected: Only pre-existing errors (FamilyTreeGraph, api.ts, test files) — no new errors from dashboard changes.

- [ ] **Step 2: Verify DnD don't break pages that import removed files**

```bash
cd kapwa-client && npx tsc --noEmit 2>&1 | grep -E "cannot find|Module not found" | grep -iv "__tests__"
```

Expected: No "cannot find" errors.
