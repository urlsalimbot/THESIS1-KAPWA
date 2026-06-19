# Kapwa — MSWDO Norzagaray

## What This Is

Kapwa is a social support software for the Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan. It replaces paper-based workflows with a digital system for claimant/beneficiary profiling and intervention tracking — enabling social workers to register beneficiaries, conduct full social case studies, manage intervention workflows (application → assessment → approval → release → follow-up), and generate compliance reports for LGU and DSWD requirements.

Built as a progressive web app with offline-first capability for field workers, with a React 18 + Capacitor 6 client and a NestJS 11 + PostgreSQL 16 server.

## Core Value

Social workers can register any claimant, conduct a full social case study, and track every intervention they receive — from application through release — reliably even without internet connectivity.

## Requirements

### Validated

Existing Kapwa codebase capabilities:

- ✓ **JWT authentication with role-based access** — User login, role assignment, protected routes
- ✓ **Case management FSM** — pending_assessment → in_review → approved → disbursed → closed lifecycle
- ✓ **Beneficiary entity and database schema** — Basic beneficiary registration structure
- ✓ **Intervention entity and database schema** — Basic intervention recording structure
- ✓ **Offline sync protocol** — Delta sync with Ed25519 signatures, version vectors, conflict resolution
- ✓ **PWA + Capacitor mobile deployment** — Cross-platform (browser + Android/iOS native)
- ✓ **RBAC + ABAC authorization pipeline** — Role-based and attribute-based access control
- ✓ **Socket.IO real-time messaging** — Chat infrastructure
- ✓ **Zod validation pipeline** — API boundary validation
- ✓ **Dashboard view** — Aggregated data display
- ✓ **Reporting infrastructure** — Export/generation capabilities

### Active

- [ ] **BEN-01**: MSWDO staff can register beneficiaries with full social case study data (demographics, household composition, income, case history, assessment notes, referrals)
- [ ] **BEN-02**: Staff can categorize beneficiaries by type (senior, PWD, child, solo parent, etc.)
- [ ] **BEN-03**: Staff can search and filter beneficiaries by name, category, location, status
- [ ] **INT-01**: Staff can log interventions (food packs, cash assistance, medical aid, etc.) with date, amount, and type
- [ ] **INT-02**: Staff can run end-to-end intervention workflow: application → assessment → approval → release → follow-up
- [ ] **INT-03**: System enforces eligibility rules and tracks intervention limits per beneficiary per period
- [ ] **INT-04**: Staff can view complete intervention history per beneficiary
- [ ] **RPT-01**: System can export reports in DSWD/LGU-compliant formats
- [ ] **RPT-02**: Dashboard shows key metrics (beneficiaries served, interventions by type, pending cases)
- [ ] **AUTH-01**: Adapt role model for MSWDO hierarchy (staff, supervisor, admin, beneficiary)
- [ ] **AUTH-02**: Beneficiary self-service view (check own interventions and status)
- [ ] **SYNC-01**: Full offline capability — field workers can register beneficiaries and log interventions offline, sync when connected
- [ ] **SYNC-02**: Conflict resolution for concurrent offline edits
- [ ] **GOV-01**: Compliance with government IT standards (DICT guidelines, data privacy)

### Out of Scope

- **Integration with DSWD national databases** — Standalone system; export reports for external submission instead
- **Real-time chat between beneficiaries and staff** — Chat infrastructure exists but not prioritized for MSWDO v1
- **Scheduling/appointment system** — Not core to profiling and intervention tracking
- **Financial management (budget tracking)** — Beyond MSWDO case management scope

## Context

Kapwa is being built for deployment at the MSWDO of Norzagaray, Bulacan as a thesis project. The existing codebase already has a robust technical foundation including NestJS modular architecture, offline-first sync, JWT auth with RBAC/ABAC, and Capacitor mobile deployment. The codebase also has known technical debt (sub-50% test coverage, NestJS version mismatch, TypeORM alpha dependency, sync service complexity) that will need attention as development progresses.

**Constraints:**
- Cloud-hosted with offline capability for field workers
- Government IT standards compliance
- Timeline: current semester (~2-3 months)
- Target: full deployment at Norzagaray MSWDO

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on existing Kapwa codebase | Avoid rebuild; existing sync, auth, and case infrastructure significantly accelerates development | — Pending |
| Offline-first for field workers | MSWDO workers operate in areas with intermittent connectivity | — Pending |
| Cloud-hosted with Capacitor mobile | Field accessibility without requiring constant internet | — Pending |
| DSWD-format export over API integration | Simpler, thesis-scope appropriate; standalone system | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-19 after initialization*
