# Inter-Agency Beneficiary Tracking — Research & Design

Research for implementing inter-agency beneficiary tracking so that intra-municipal
inter-agency offices (MSWDO, RHU/MHO, PNP-WCPD, PESO, DepEd, DILG, barangay) can
track beneficiaries who move through multiple agency programs and referral channels —
without duplicate records, without consent violations, and without creating a second
siloed registry.

Status: **research + design recommendation**. No code written yet.

---

## 1. What "inter-agency beneficiary tracking" means here

The municipal scenario: one family/person is served by several offices of the same
local government unit (intra-municipal) plus attached national agencies
(inter-agency). Today the pain points are:

1. **Duplicate / fragmented identities** — the same client is enrolled in MSWDO's
   program list, RHU's patient register, and PNP-WCPD's blotter with slight name/DOB
   variations. No cross-reference exists.
2. **No closed referral loop** — MSWDO refers a case to another agency, but there is no
   status tracking, no confirmation of receipt, no outcome capture. `case.referrals`
   (JSONB) only stores a snapshot (`agencyName`, `contactInfo`, `reason`, `status`).
3. **No "who gets what" view** — no way to answer "what services did this household
   already receive, from which office, when?" — which is the core use case of an
   Integrated Beneficiary Registry (IBR).
4. **Consent is ad hoc** — no purpose-scoped, revocable data-sharing agreement between
   offices; the DPA requires a lawful basis per sharing.

The goal is a **municipal integrated beneficiary registry + closed-loop referral layer**
built on KAPWA's existing identity, consent, and audit foundations.

---

## 2. Existing KAPWA foundation (verified in code)

### Identity core
- `Person` entity (`src/beneficiaries/person.entity.ts`) is the canonical person record:
  - `first_name`, `middle_name`, `extension`, `gender`, `dob`, `place_of_birth`,
    `civil_status`, `current_address` (jsonb), `estimated_monthly_income`
  - `philsys_number` UNIQUE nullable (`:31`) — PhilSys Number slot already exists
  - `philhealth_number` nullable (`:46`)
  - `search_vector` tsvector with `select: false` (`:58`) — supports trigram/BM25 search
  - `household-membership.entity.ts` links persons to households
- `Beneficiary` wraps a person with `consent_status`, `category`, `household_id`,
  exposes `philsysNumber` getter (`beneficiary.entity.ts:48`).
- `BeneficiaryRole` carries `access_card_code` UNIQUE, `consent_status`
  (`beneficiary-role.entity.ts:20,17`).
- `BeneficiaryClaimant` links beneficiaries to claimants (proxy claimants) with
  `authorization_url` + `calendar_year` — already models delegated access.
- `consent-ledger.entity.ts` — audit trail with `purpose`, `channel`, `status`,
  `revoked_at`, `revoked_reason`. **This is the natural home for purpose-scoped
  inter-agency sharing consent.**

### Referral surface today
- `referrals` table (baseline migration): barangay-coordinator → MSWDO intake, with
  `status` CHECK in `('pending','accepted','declined')`, `decline_reason`, `case_id`,
  coordinator + client identity fields. **This is intake referral, not inter-agency.**
- `cases.referrals` JSONB: freeform `{agencyName, contactInfo, reason, status}` —
  the closest existing analog to inter-agency referral, but unstructured.
- `access_card_services.agency` — **freeform TEXT** agency name on service logs.
- `irf-export.service.ts` (lines ~115, 144) and `irf.service.ts:246` — hardcode
  `'Agency: MSWDO Norzagaray'` for the IRF → WCPD/PNP export.
- Routes exist: `/referrals`, `/coordinator/referrals[/new]`, `/intake/referrals`
  (ReferralReviewPage).

### Governance / security
- RLS policies: admin full access, barangay-scoped for social_worker/coordinator,
  mayor/auditor read-only, consent-gated read via `pii.interceptor.ts`.
- Offline-first sync: `sync_queue` + version_vectors + `beneficiaries-reconciliation.service.ts`.
- IRF export already requires `legal_basis_code` + audit — the pattern to extend to all
  cross-agency sharing.

**Gap summary:** identity + consent + audit primitives exist; what's missing is (a) an
agency registry, (b) normalized agency references on service logs, (c) a closed-loop
inter-agency referral state machine, (d) cross-agency consent purpose codes, (e) a
matching/deduplication service, and (f) an "all services received" read view with RLS.

---

## 3. Philippine legal & policy context (what constrains the design)

### Data Privacy Act (RA 10173) + IRR
- **Lawful bases** for processing without consent: Sec 12 (consent), Sec 13
  (legitimate interest — but **not** for sensitive personal data), plus the exemption
  when processing "is necessary for the performance of a function carried out in the
  public interest or in the exercise of official authority vested in the controller"
  (Sec 13(j)-style public-authority basis, reflected in IRR Rule V).
- IRR **Rule V** (as amended) covers personal data shared between government agencies:
  - Data sharing between agencies must have a lawful basis; head of the source agency
    must approve access to sensitive personal information; agencies must enter a
    **Data Sharing Agreement (DSA)** where appropriate, and log access/audit.
  - NPC Circular 16-02 and NPC Circular 2020-03 (DSAs); NPC Advisory 2025-01 clarifies
    a DSA is not automatically mandatory where a valid legal basis already exists — but
    for cross-office inter-agency data exchange a DSA is the safer, auditable posture.
- **Consent** must be purpose-limited, freely given, and revocable. For children's data
  (VAWC cases) the parent/guardian consent rules apply and data minimization is
  especially strict.
- Implication for design: each inter-agency share should be recorded with a
  `legal_basis_code` and, when consent is the basis, link back to a
  `consent_ledger` record. Reuse the IRF `legal_basis_code` + audit pattern.

### National identity (PhilSys, RA 11055)
- Every Filipino gets a **PhilSys Number (PSN)**; agencies are directed to adopt PSN as
  the standard reference number for service delivery. `everify.gov.ph` enables
  authenticated identity verification.
- Implication: `philsys_number` is already in `Person` — it becomes the **primary
  deterministic key** for cross-agency matching. Non-PhilSys holders fall back to
  probabilistic matching (§5).

### Social registries
- **DSWD Listahanan / NHTS-PR**: the national reference for poverty targeting. LGUs and
  agencies sign DSAs to use Listahanan data; **don't duplicate it** — reference it.
- DILG's **LGUSS** encourages barangay **BIMS** and municipal **CMIMS** profiling —
  KAPWA's household/person model is the natural municipal counterpart.
- **Barangay-level**: LGUs already collect resident profiles; an inter-agency tracking
  layer should reconcile against these without becoming a competing national registry.

### Inter-agency committee structures (the operational driver)
- **MCAT-VAWC / LCAT-VAWC** (municipal/city inter-agency committee on VAWC) under
  DSWD AO 02-2013 and the **JMC 2010-01** (DILG-DSWD-DOJ-NBI-PNP) — MSWDO is the
  **Coordinating Agency (CorA)**. Committees require referral tracking, monitoring of
  case status, and reporting across members (MSWDO, PNP-WCPD, RHU, courts, NGOs).
- **IACAT** (anti-trafficking), **BAC**, **PESO** (employment), **RHU/MHO** (health),
  **DepEd** (children) all have their own committee/reporting obligations.
- Implication: the referral state machine and aggregate reporting should be shaped to
  produce committee reports (e.g., MCAT-VAWC minutes/referral registry), which is a
  concrete, high-value "why".

---

## 4. Technical references (what the literature/standards say)

### Integrated Beneficiary Registry (IBR) — SPDCI / Social Protection Data Core Indicators
- The **SPDCI IBR standard (v1.0.0)** defines standard data elements and APIs so that
  Social Protection Management Information Systems (SP-MIS) interoperate with a central
  IBR. Core IBR objectives: **unique client ID, duplicate prevention, coverage
  monitoring ("who gets what")**, and coordinated service delivery.
- Key guidance: a single registry should store only the **minimum identifying data +
  eligibility + program participation links**, not every program's full case file.
  KAPWA's `persons` + `access_card_services` split already matches this shape.

### World Bank — Integrated (Integrated Social) Registries
- Distinction that matters: a **Social Registry** (SR) answers "who is poor/eligible"
  (Listahanan), while an **Integrated Beneficiary Registry** answers "**who receives
  what**" — the dynamic participation layer on top. For inter-agency tracking, we build
  the **IBR layer** (participation/services across agencies), not another SR.
- Brazil's **CadÚnico** is the canonical large-scale single registry: one family
  register, unique ID, decentralized network of municipal registration agents, and all
  programs draw from it. Its lesson: centralize the **identity + participation index**,
  keep program-specific data in each program's system.

### Record linkage & Master Data
- **Fellegi–Sunter probabilistic matching**: score pairs by agreement/disagreement on
  name, DOB, sex; **block/index** on soundex/phonetics + DOB year to avoid O(n²).
- Practical stack for Postgres: pg_trgm (already used), `similarity()`, plus the
  tsvector `search_vector` already on `Person`. Dedup tooling inspiration: Splink,
  OpenEMPI, or a small in-house matcher.
- **Master Data / golden record**: one canonical Person record; duplicates are merged
  into it with a survivor record + audit, never deleted. KAPWA's reconciliation service
  is the hook point.

### Closed-loop referral systems
- Standard lifecycle: **intake → routing → receipt → action/status → outcome →
  feedback**. Statuses like `referred → received → actioned → closed` with timestamps,
  notes, and outcome codes. Each referral is a first-class record with from/to agency,
  case link, consent link, legal basis, and audit.
- Unite Us / PlanStreet-style systems are the commercial analogs for social-services
  cross-organization referral networks.

---

## 5. Recommended architecture (Option C — hybrid IBR + closed-loop referrals)

Three options considered:
- **A. KAPWA becomes the municipal IBR hub** — all agencies get accounts; everyone logs
  services against the master Person. Strongest dedup + reporting; hardest adoption and
  data-governance lift.
- **B. Federated referral + linkage only** — agencies keep their own systems; KAPWA
  offers an inter-agency referral API + identity-resolution service + consent-gated
  shares. Lowest adoption barrier, DPA-friendly, but weaker dedup and no "who gets what".
- **C. Hybrid (recommended)** — KAPWA is the municipal IBR **core** (it already is, per
  §2), with a **closed-loop inter-agency referral module** + **identity resolution
  service** + **consent-gated sharing** + **de-identified committee reports**. Phased so
  each step is independently valuable.

### Phase 0 — Agency registry (small, foundational)
- New `agencies` lookup table: `id`, `code` (e.g. `MSWDO`, `RHU`, `WCPD`, `PESO`,
  `DILG`, `DSWD`, `DepEd`), `name`, `type`, `contact_info`, `is_active`.
- Seed with the intra-municipal offices; `irf-export.service.ts` hardcoded
  `'MSWDO Norzagaray'` becomes a lookup.

### Phase 1 — Closed-loop inter-agency referral
- New `inter_agency_referrals` table (or formalize `cases.referrals` JSONB into a real
  table):
  - `id`, `case_id` FK, `from_agency_id` FK, `to_agency_id` FK, `person_id` FK
    (resolve to Person, not freeform names),
  - status machine `referred → received → actioned → closed` (+ `declined`) with
    timestamps per transition (`received_at`, `actioned_at`, `closed_at`, `outcome`),
  - `reason`, `notes`, `consent_ledger_id` FK, `legal_basis_code`,
    `created_by` (agency user), audit columns.
- Keep the existing barangay→MSWDO `referrals` intake as-is; inter-agency is a distinct
  flow. Update the case "Referral" intervention to link to the new records.
- Normalize `access_card_services.agency` (freeform TEXT) → `agency_id` FK so service
  logs become the "who got what from which office" spine.

### Phase 2 — Identity resolution & dedup
- **Deterministic first**: PSN (`philsys_number`) and PhilHealth Number as exact-match
  keys; add optional `everify.gov.ph` verification for PSN when adopted.
- **Probabilistic fallback**: block on normalized surname + DOB year + sex; score with
  pg_trgm similarity over `search_vector`; present **human-in-the-loop** match
  candidates in the UI (reviewer merges → golden record; survivor + audit, never delete).
- Reuse `beneficiaries-reconciliation.service.ts` as the integration point; expose a
  `matchPerson(dto)` endpoint agencies call when enrolling a client.

### Phase 3 — Consent & data-sharing governance
- Extend `consent_ledger` with purpose codes: e.g. `inter_agency_sharing`,
  `program_enrollment`, `referral_processing`, `reporting_aggregate`.
- Each inter-agency share requires one of: (a) consent record, or (b) public-authority
  basis with `legal_basis_code` + supervisor approval (IRR Rule V pattern).
- Revocation → mask that person's data for the consenting agency(s); keep audit.
- PII interceptor already exists; scope it per agency.

### Phase 4 — "Who gets what" view + committee reporting
- Aggregate read model: `person_id` → list of `(agency, service, date)` from
  `access_card_services` + intervention history. RLS: full for admin/MSWDO (CorA),
  own-agency only for others, de-identified for mayor/auditor.
- Pre-built reports: **MCAT-VAWC / LCAT-VAWC referral registry** (closed cases with
  outcome), duplicate-beneficiary report, per-agency service totals. This gives the
  committee a reason to adopt and the LGU a governance deliverable.

---

## 6. Open questions (need stakeholder answers)

1. **Adoption**: will other offices actually enter data into KAPWA, or must we expose a
   read/write API to their existing systems (BIMS/CMIMS, patient registries)? This decides
   how far Phase 2/4 go vs. a federated API layer (Option B).
2. **Controller vs. joint processing**: is MSWDO the data controller with the LGU as the
   processor umbrella, or a joint-controller arrangement across offices? Shapes DSA form
   (NPC Circular 2020-03) and who signs.
3. **PSN adoption**: is the municipality/DSWD pushing PhilSys verification now
   (`everify.gov.ph`), or should PSN stay an optional field? Budget/timeline for API.
4. **Listahanan integration**: any existing DSA with DSWD for Listahanan reference, or
   is this purely internal municipal data? (Don't build a competing SR — reference.)
5. **Children's cases**: VAWC/child cases need parent-guardian consent and stricter
   minimization — confirm whether children appear as separate Persons with
   representative consent (modeled already via BeneficiaryClaimant).
6. **Offline-first sync**: which agencies run offline (barangay kiosks) vs. online-only?
   Sync conflict rules must extend to `inter_agency_referrals`.

---

## 7. Suggested next step

Write a **Phase 1 plan** (`docs/superpowers/plans/2026-08-inter-agency-tracking-phase1.md`)
for the agency registry + `inter_agency_referrals` table + service-log normalization,
with migration, entities, DTOs, RLS policies, and the closed-loop UI. Phases 2–4 stay
design docs until the open questions in §6 are answered.

---

### Sources
- RA 10173 (Data Privacy Act) + IRR, NPC Circulars 16-02, 2020-03, Advisory 2025-01
- RA 11055 (PhilSys Act); everify.gov.ph
- DSWD Listahanan/NHTS-PR; DILG LGUSS (BIMS/CMIMS)
- DSWD AO 02-2013 & DILG-DSWD-DOJ-NBI-PNP JMC 2010-01 (MCAT/LCAT-VAWC)
- SPDCI Integrated Beneficiary Registry standard v1.0.0 (Social Protection Data Core
  Indicators)
- World Bank "Integrated Social Registries" / social registries guidance
- Brazil CadÚnico single-registry case study
- Fellegi–Sunter probabilistic record linkage; Splink/OpenEMPI (MPI) practice
