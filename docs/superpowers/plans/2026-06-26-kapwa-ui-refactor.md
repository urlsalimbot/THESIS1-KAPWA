# KAPWA Client UI/UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Tailwind CSS properly, define design tokens, fix all dead inline classes, and create consistent UI across 20+ pages.

**Architecture:** Single-page app using React 18 + React Router 6. Tailwind CSS 3.4 already installed but not wired (no PostCSS config, no `@tailwind` directives). Need to add PostCSS config, define tokens, migrate CSS, then fix each page's inline arbitrary-value classes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3.4, Lucide React icons

**Global Constraints:**
- Colors must use token values from design spec (`primary`, `surface`, `text-primary`, etc.) — no arbitrary hex in JSX
- Keep existing CSS classes for structural layout (`.header`, `.sidebar`, `.layout`) but rewrite with `@apply`
- Remove all `text-[#...]`, `bg-[#...]`, `shadow-card`, `font-heading` from JSX — these are dead code without working Tailwind
- No new npm packages beyond what's already in package.json
- No Tailwind plugins (keep it minimal)

---

### Task 1: Bootstrap PostCSS + Tailwind Configuration

**Files:**
- Create: `postcss.config.js`
- Modify: `tailwind.config.js`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing
- Produces: working Tailwind CSS pipeline with custom design tokens

- [ ] **Step 1: Create postcss.config.js**

```bash
cat > /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client/postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
```

- [ ] **Step 2: Update tailwind.config.js with design tokens**

```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2E5C8A', dark: '#1E3D5C', light: '#E8F0F7' },
        surface: { DEFAULT: '#F9F9FD', white: '#FFFFFF' },
        border: '#E0E1E3',
        'text-primary': '#1A1A1A',
        'text-secondary': '#707070',
        'text-muted': '#6B7280',
        success: { bg: '#D4EDDA', text: '#155724' },
        warning: { bg: '#FFF3CD', text: '#856404' },
        info: { bg: '#D1ECF1', text: '#0C5460' },
        disbursed: { bg: '#E2E3E5', text: '#383D41' },
        closed: { bg: '#F5F5F5', text: '#707070' },
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Update index.css with @tailwind directives + @layer components**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    @apply bg-surface text-text-primary min-h-screen;
  }
}

@layer components {
  .header {
    @apply bg-surface-white border-b border-border shadow-card px-6 flex justify-between items-center h-16;
  }
  .header-left {
    @apply flex items-center gap-4;
  }
  .header-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    @apply font-bold text-base tracking-tight text-primary;
  }
  .header-right {
    @apply flex items-center gap-4;
  }
  .municipal-seal {
    @apply w-10 h-10 rounded-full bg-primary flex items-center justify-center;
  }
  .search-bar {
    @apply relative w-64;
  }
  .search-input {
    @apply w-full py-2 pl-9 pr-4 bg-[#F8FAFC] border border-border rounded-full font-body text-sm text-text-primary outline-none;
  }
  .search-input:focus {
    @apply border-primary;
  }
  .search-icon {
    @apply absolute left-3 top-1/2 -translate-y-1/2 text-text-muted;
  }
  .icon-btn {
    @apply w-10 h-10 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer text-text-muted;
  }
  .icon-btn:hover {
    @apply bg-[#F5F6F7];
  }
  .profile-area {
    @apply flex items-center pl-4 border-l border-border;
  }
  .profile-avatar {
    @apply w-8 h-8 rounded-full bg-primary-light flex items-center justify-center shadow-card text-xs font-medium text-primary;
  }
  .layout {
    @apply flex min-h-[calc(100vh-4rem)];
  }
  .sidebar {
    @apply w-64 bg-surface-white border-r border-border py-4;
  }
  .sidebar-nav {
    @apply flex flex-col gap-0.5;
  }
  .nav-link {
    @apply flex items-center gap-4 px-6 py-2 font-body text-base text-text-secondary no-underline transition-colors duration-200;
  }
  .nav-link:hover {
    @apply bg-[#F5F5F5] text-text-secondary;
  }
  .nav-link.active {
    @apply bg-primary-light border-l-4 border-primary pl-5 text-primary font-bold;
  }
  .main-content {
    @apply flex-1 p-6 bg-surface min-h-[calc(100vh-4rem)];
  }
  .page-header { @apply mb-4; }
  .page-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    @apply font-bold text-2xl leading-8 text-text-primary;
  }
  .page-desc { @apply font-body text-sm leading-5 text-text-secondary mt-1; }
  .toolbar { @apply flex justify-between items-center mb-4; }
  .toolbar-left { @apply flex gap-2; }
  .toolbar-right { @apply flex gap-2; }
  .btn {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded font-body text-sm font-medium cursor-pointer transition-all duration-200 border-none;
  }
  .btn-primary { @apply bg-primary text-white; }
  .btn-primary:hover { @apply bg-primary-dark; }
  .btn-secondary { @apply bg-surface-white text-text-primary border border-border; }
  .btn-secondary:hover { @apply bg-[#F5F5F5]; }
  .form-group { @apply mb-4; }
  .form-label { @apply block font-body text-sm font-medium text-text-primary mb-1; }
  .form-input {
    @apply w-full px-3 py-2 bg-[#F8FAFC] border border-border rounded font-body text-sm text-text-primary outline-none;
  }
  .form-input:focus {
    @apply border-primary shadow-[0_0_0_2px_rgba(46,92,138,0.2)];
  }
  .form-select {
    @apply w-full px-3 py-2 bg-[#F8FAFC] border border-border rounded font-body text-sm text-text-primary outline-none cursor-pointer;
  }
  .badge { @apply inline-block px-2 py-1 rounded text-xs font-medium font-body; }
  .badge-category { @apply bg-primary-light text-primary; }
  .badge-pending { @apply bg-warning-bg text-warning-text; }
  .badge-review { @apply bg-info-bg text-info-text; }
  .badge-approved { @apply bg-success-bg text-success-text; }
  .badge-disbursed { @apply bg-disbursed-bg text-disbursed-text; }
  .badge-closed { @apply bg-closed-bg text-closed-text; }
  .card {
    @apply bg-surface-white border border-border rounded-lg p-4 mb-4 shadow-card;
  }
  .stats-grid { @apply grid grid-cols-4 gap-4 mb-6; }
  .stat-card { @apply bg-surface-white p-4 rounded-lg shadow-card; }
  .stat-label {
    @apply font-body text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1;
  }
  .stat-value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    @apply text-2xl font-bold text-text-primary;
  }
  .table-container {
    @apply bg-surface-white border border-border rounded-lg overflow-hidden shadow-card;
  }
  .table-wrapper { @apply overflow-x-auto; }
  .table { @apply w-full border-collapse font-body; }
  .table thead { @apply bg-surface-white border-b border-border shadow-card; }
  .table th {
    @apply text-left text-xs font-semibold text-text-primary uppercase px-4 py-3 border-r border-border tracking-wide;
  }
  .table td {
    @apply px-4 py-3 text-sm text-text-primary border-r border-b border-border;
  }
  .table tbody tr:nth-child(even) { @apply bg-[#F5F5F5]; }
  .table tbody tr:hover { @apply bg-primary-light; }
  .frozen-col { @apply sticky left-0 bg-inherit z-[1] shadow-[2px_0_4px_0px_rgba(0,0,0,0.05)]; }
  .table th.frozen-col { @apply bg-surface-white; }
  .pagination {
    @apply flex items-center justify-between px-4 py-3 font-body text-sm text-text-secondary border-t border-border;
  }
  .error-msg {
    @apply px-4 py-3 bg-warning-bg text-warning-text rounded font-body text-sm mb-4;
  }
  .success-msg {
    @apply px-4 py-3 bg-success-bg text-success-text rounded font-body text-sm mb-4;
  }
  .filter-pills {
    @apply flex items-center gap-2 px-4 py-3 bg-surface-white border border-border rounded-t-lg border-b-0;
  }
  .filter-pill {
    @apply flex items-center gap-1 px-3 py-1.5 bg-surface-white border border-border rounded-full font-body text-sm text-text-primary cursor-pointer;
  }
  .filter-pill:hover { @apply bg-[#F5F5F5]; }
  .clear-btn {
    @apply ml-auto px-3 py-1.5 font-body text-sm font-medium text-primary bg-transparent border-none cursor-pointer;
  }
  .clear-btn:hover { @apply underline; }

  /* Login page */
  .login-container { @apply min-h-screen flex items-center justify-center bg-surface; }
  .login-card { @apply w-full max-w-md bg-surface-white rounded-2xl shadow-card p-8; }
  .login-logo { @apply w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4; }
  .login-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    @apply font-bold text-2xl text-text-primary text-center;
  }
  .login-subtitle { @apply font-body text-sm text-text-secondary text-center mt-1; }
}

/* Print styles */
@media print {
  @page { size: A4 portrait; margin: 15mm; }
  body { background: white !important; font-size: 10.5pt; color: #000; }
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

Wait — this is way too much code to paste inline. Let me just write the index.css directly instead.

- [ ] **Step 4: Verify dev server starts**

```bash
cd kapwa-client && npm run dev
```

Expected: Vite dev server starts on localhost:3001, no compilation errors.

- [ ] **Step 5: Commit**

```bash
git add postcss.config.js tailwind.config.js src/index.css
git commit -m "feat: wire up Tailwind CSS with design tokens"
```

---

### Task 2: Fix LoginPage.tsx — replace dead classes with Tailwind tokens

**Files:**
- Modify: `src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: Tailwind CSS token classes from Task 1
- Produces: Working login page

- [ ] **Step 1: Replace all arbitrary-value and undefined classes**

Replace these in LoginPage.tsx:
- `bg-[#F9FAFD]` → `bg-surface`
- `shadow-card` → `shadow-card` (now defined in tailwind.config.js)
- `text-[#707070]` → `text-text-secondary`
- `text-[#1A1A1A]` → `text-text-primary`
- `bg-[#2E5C8A]` → `bg-primary`
- `font-heading` → `font-heading` (now defined in tailwind.config.js)

- [ ] **Step 2: Verify login page renders**

Open `http://localhost:3001/login` in browser.
Expected: No console errors, page renders with correct colors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "fix: replace dead Tailwind classes in LoginPage with design tokens"
```

---

### Task 3: Fix DashboardPage.tsx — replace dead classes with Tailwind tokens

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Replace arbitrary-value classes**

Replace:
- `text-[#707070]` → `text-text-secondary`
- `text-[#2E5C8A]` → `text-primary` (for the stat-card icon classes)

- [ ] **Step 2: Verify dashboard renders**

Navigate to `/` after login.
Expected: Dashboard renders without errors, consistent colors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "fix: replace dead Tailwind classes in DashboardPage with design tokens"
```

---

### Task 4: Fix CasesPage.tsx — replace dead classes + table styling

**Files:**
- Modify: `src/pages/CasesPage.tsx`

The UAT-critical page. Has status badges that need to render with proper colors.

- [ ] **Step 1: Replace arbitrary-value classes**

Replace all `text-[#...]` and `bg-[#...]` in CasesPage.tsx with token equivalents.

- [ ] **Step 2: Verify CasesPage renders**

Navigate to `/cases` after login.
Expected: Table renders with correct badge colors, no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/CasesPage.tsx
git commit -m "fix: replace dead Tailwind classes in CasesPage with design tokens"
```

---

### Task 5: Fix Layout.tsx — sidebar, header, offline banner

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Replace arbitrary-value classes in Layout**

Replace all `text-[#...]`, `bg-[#...]` in Layout.tsx with token equivalents.

- [ ] **Step 2: Verify layout renders**

Navigate between pages.
Expected: Sidebar nav items correct colors, header displays properly.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "fix: replace dead Tailwind classes in Layout with design tokens"
```

---

### Task 6: Batch-fix remaining pages — bulk replace dead classes

**Files:**
- Modify: All remaining page files (`IrfPage.tsx`, `IrfDetailPage.tsx`, `BeneficiariesPage.tsx`, `FilingPage.tsx`, `AuditorPage.tsx`, `AccessCardPage.tsx`, `ApprovalPipelinePage.tsx`, `AdminPage.tsx`, `ProgramsPage.tsx`, `MessagesPage.tsx`, `MayorReportsPage.tsx`, `CoordinatorDashboardPage.tsx`, `ClaimantDashboardPage.tsx`, `IntakePage.tsx`, `CaseTrackerPage.tsx`, `CsrPage.tsx`, `MfaSetupPage.tsx`, `MyAccessCardPage.tsx`, `AccessCardPrintView.tsx`, `BeneficiaryViewPage.tsx`)
- Modify: `src/components/ReportsExportButton.tsx`

~141 occurrences across 20+ files. Use sed for bulk replacements.

- [ ] **Step 1: Bulk replace common patterns**

```bash
cd kapwa-client/src
# text-[#1A1A1A] → text-text-primary
find . -name '*.tsx' -exec sed -i 's/text-\[#1A1A1A\]/text-text-primary/g' {} +
# text-[#707070] → text-text-secondary
find . -name '*.tsx' -exec sed -i 's/text-\[#707070\]/text-text-secondary/g' {} +
# text-[#2E5C8A] → text-primary
find . -name '*.tsx' -exec sed -i 's/text-\[#2E5C8A\]/text-primary/g' {} +
# bg-[#2E5C8A] → bg-primary
find . -name '*.tsx' -exec sed -i 's/bg-\[#2E5C8A\]/bg-primary/g' {} +
# bg-[#1e3d5e] → bg-primary-dark
find . -name '*.tsx' -exec sed -i 's/bg-\[#1e3d5e\]/bg-primary-dark/g' {} +
# text-[#1a1a1a] → text-text-primary
find . -name '*.tsx' -exec sed -i 's/text-\[#1a1a1a\]/text-text-primary/g' {} +
```

- [ ] **Step 2: Check for remaining dead classes**

```bash
cd kapwa-client/src && rg -c 'text-\[#|bg-\[#|shadow-card|font-heading' pages/*.tsx components/*.tsx
```

Expected: 0 occurrences remaining.

- [ ] **Step 3: Verify pages render**

Spot-check 5-6 pages: `/intake`, `/beneficiaries`, `/interventions`, `/irf`, `/audit-logs`, `/approvals`.
Expected: No console errors, all pages render with correct colors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ src/components/
git commit -m "fix: bulk-replace dead Tailwind arbitrary-value classes with design tokens"
```

---

### Task 7: UX Polish — loading states and empty states

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (add empty state for cases table)
- Modify: `src/pages/CasesPage.tsx` (add loading spinner, empty state)
- Modify: Other high-traffic pages as identified during verification

- [ ] **Step 1: Add loading spinner component**

Add a reusable LoadingSpinner to index.css @layer components:
```css
.spinner { @apply animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full; }
@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }

.empty-state { @apply text-center py-12 text-text-secondary text-sm; }
```

- [ ] **Step 2: Add empty state to DashboardPage**

Add a message when `cases.length === 0`:
```tsx
{cases.length === 0 ? (
  <div className="empty-state p-8">No recent cases found</div>
) : (/* table */)}
```

- [ ] **Step 3: Add loading state to CasesPage**

Read CasesPage to understand current loading pattern, add spinner.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ src/index.css
git commit -m "feat: add loading spinner and empty state components"
```

---

### Task 8: Verify all pages compile and render

- [ ] **Step 1: Full build test**

```bash
cd kapwa-client && npm run build
```

Expected: No TypeScript or build errors.

- [ ] **Step 2: Visual spot-check**

Login, navigate to each route group, verify no visual regressions.

- [ ] **Step 3: Final commit if needed**
