# Phase 12: Accessibility & Differentiators - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 12-accessibility-differentiators
**Areas discussed:** WCAG 2.1 AA Accessibility, Role-Specific Dashboards, PII Masking (RA 10173), SLA Timers (RA 11032), Quick Actions, Bulk Operations

---

## WCAG 2.1 AA Accessibility

| Option | Description | Selected |
|--------|-------------|----------|
| axe-core in CI | Automated axe-core checks in test suite + manual screen reader review | ✓ |
| Manual audit only | Full screen reader audit before milestone close | |
| Both automated + manual | axe-core in CI + dedicated manual audit per phase | |
| NVDA only | Most common on Windows (97% of screen reader users) | ✓ |
| NVDA + VoiceOver | NVDA for Windows + VoiceOver for macOS/iOS | |
| All three (NVDA+VO+JAWS) | Full coverage including JAWS | |
| Critical flows only | Focus indicators, Tab order, Escape to close | |
| Full keyboard | All interactive elements reachable and operable via keyboard | ✓ |
| Full + shortcuts | Full keyboard + role-specific keyboard shortcuts | |
| Audit existing + fix | Run contrast audit, fix failures | ✓ |
| Design tokens overhaul | Rebuild color tokens with WCAG AA ratios | |
| Third-party audit | Hire accessibility consultant | |

**User's choice:** axe-core in CI + NVDA + Full keyboard + Audit existing + fix

---

## Role-Specific Dashboards

| Option | Description | Selected |
|--------|-------------|----------|
| Shared page, filtered widgets | Single dashboard with role-conditional widget visibility | ✓ |
| Individual pages per role | Completely separate dashboard per role | |
| Current approach + polish | Polish existing per-role pages | |
| Status tracker + service history | Claimant: read-only status timeline + history | ✓ |
| Full portal | Status, history, document upload, appointments, messages | |
| Minimal status only | Simple status badge + next steps | |
| Aggregate dashboards | Mayor: summary stats, no PII. Auditor: audit log, hash verification | ✓ |
| Same as worker + read-only | Same dashboard but read-only | |
| Custom report builder | Filterable reports with CSV export | |
| Scoped to barangay | Coordinator data filtered to assigned barangay | ✓ |
| Full view scoped | Same as worker but auto-filtered | |
| Worker lite | Subset of worker dashboard | |

**User's choice:** Shared page + filtered widgets, Claimant: status tracker, Mayor/Auditor: aggregate, Coordinator: barangay-scoped

---

## PII Masking (RA 10173)

| Option | Description | Selected |
|--------|-------------|----------|
| Name + contact + address | Mask name, phone, address for non-worker roles | |
| Everything identifier | Name, contact, address, case details — all masked. Only MSWDO workers see full data | ✓ |
| Case-by-case consent | No default masking — driven by consent status | |
| Click-to-reveal with audit log | Temporary unmask with who/when/why logged | ✓ |
| Role-based always visible | Always visible if role authorized | |
| Full request workflow | Request → supervisor approval → reveal | |
| Masking follows consent status | Revoked consent = masked for everyone | ✓ |
| Separate from consent | Role-based masking independent of consent | |
| Consent-dependent full masking | Revoked = all masked, active = role-based | |
| Masked exports with unmask | CSV/PDF mask PII by default, unmask with audit trail | ✓ |
| Always masked | Exports never include PII | |
| Role-based export | MSWDO gets unmasked, others get masked | |

**User's choice:** Everything identifier masked, Click-to-reveal with audit trail, Masking follows consent, Masked exports with unmask option

---

## SLA Timers (RA 11032)

| Option | Description | Selected |
|--------|-------------|----------|
| Intake→Assessment + Assessment→Approval | Track days elapsed for two key stages | ✓ |
| Full lifecycle | SLA on every state transition | |
| Manual only | No automated timers | |
| Case-by-case in table | Each case shows days elapsed + color indicator | ✓ |
| Dashboard aggregate only | SLA compliance rate shown on dashboard | |
| Both per-case + aggregate | Per-case timer AND dashboard compliance rate | |
| Standard RA 11032 | 3 working days per stage | |
| Configurable per program | Different SLAs per program type | ✓ |
| Fixed 5 working days | 5 days per stage | |
| Visual warning + admin notification | Red indicator + admin notification on breach | ✓ |
| Auto-escalate to admin | Case reassigned to admin on breach | |
| Log only | SLA breach logged for reporting | |

**User's choice:** Intake→Assessment + Assessment→Approval, Per-case table display, Configurable per program, Visual warning + admin notification

---

## Quick Actions

| Option | Description | Selected |
|--------|-------------|----------|
| New Intake + Approve + Search | Quick links to GIS intake, approvals queue, global search | ✓ |
| Full command palette | Cmd+K / Ctrl+K palette with all actions | |
| Role-specific quick actions | Each role gets relevant quick actions | |
| Topbar + Dashboard widget | Quick actions in topbar + dashboard panel | ✓ |
| Dashboard only | Quick actions only on dashboard | |
| Floating action button | FAB in bottom-right on all pages | |
| Yes, by name+ID+barangay | Global search using trigram + BM25 | ✓ |
| Yes, full-text | Full-text search across all entities | |
| No global search | Per-page search only | |

**User's choice:** New Intake + Approve + Search, Topbar + Dashboard widget, Global search by name/ID/barangay

---

## Bulk Operations

| Option | Description | Selected |
|--------|-------------|----------|
| Approve + Reassign + Export | Batch approve, reassign, export records | ✓ |
| Full CRUD | Bulk create, update, delete | |
| Only Export | Select + export to CSV/PDF only | |
| Checkbox per row + select all | Checkbox column with select all | ✓ |
| Drag-select rows | Click-drag to select range | |
| Filter-then-act | Apply filters → select all matching | |
| Summary dialog | "Approve 12 cases?" with count + preview | ✓ |
| One-click execute | No confirmation | |
| Bulk with review list | Full list before confirming | |
| Toast with progress | Sonner toast with live progress bar | ✓ |
| Background + notification | Kick off, notify when done | |
| Modal progress screen | Full modal with per-item status | |

**User's choice:** Approve + Reassign + Export, Checkbox per row + select all, Summary dialog, Toast with live progress

---

## Agent's Discretion

- Auto-mask timeout duration (default 30s suggested)
- Layout specifics for role widgets within shared dashboard
- Exact keyboard shortcut keys
- Bulk operation page size and timeout limits

## Deferred Ideas

None — discussion stayed within phase scope.
