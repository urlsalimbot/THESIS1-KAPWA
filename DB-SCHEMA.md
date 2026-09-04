# Kapwa Database Schema (PostgreSQL + TypeORM)

## Overview
- **ORM**: TypeORM (JavaScript/TypeScript decorators)
- **Database**: PostgreSQL with extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`, `btree_gist`
- **UUIDv7**: Custom PL/pgSQL function `uuid_generate_v7()` for time-ordered UUIDs
- **All PKs**: UUID v7, auto-generated via `@BeforeInsert()` decorator in `BaseEntity`. Migration SQL uses `DEFAULT uuid_generate_v7()`

---

## Active Tables (Current Schema)

### 1. `persons` — Unified person records (core identity table)
*Created by: 20260720000001-UnifiedPersonModel*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `surname` | TEXT | NOT NULL |
| `first_name` | TEXT | NOT NULL |
| `middle_name` | TEXT | |
| `extension` | TEXT | (Jr., Sr., III, etc.) |
| `gender` | TEXT | CHECK (IN 'Male','Female') |
| `dob` | DATE | NOT NULL |
| `address` | TEXT | |
| `phone` | TEXT | |
| `philsys_number` | TEXT | UNIQUE |
| `place_of_birth` | TEXT | |
| `civil_status` | TEXT | |
| `current_address` | JSONB | |
| `email` | TEXT | |
| `philhealth_number` | TEXT | |
| `occupation` | TEXT | |
| `estimated_monthly_income` | DECIMAL(12,2) | |
| `age` | INTEGER | |
| `search_vector` | TSVECTOR | GIN index for full-text search |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_persons_search` (GIN tsvector), `idx_persons_name_trgm` (GIN trigram on surname,first_name), `idx_persons_address`, `idx_persons_philsys`, `idx_persons_email`

---

### 2. `users` — Application user accounts
*Entity: auth/user.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `email` | TEXT | UNIQUE, NOT NULL |
| `password` | TEXT | NOT NULL (hashed) |
| `role` | TEXT | DEFAULT 'social_worker' — Enum: `social_worker`, `admin`, `coordinator`, `claimant`, `mayor`, `auditor` |
| `full_name` | TEXT | |
| `phone` | TEXT | |
| `person_id` | UUID | FK → persons(id) — links user to person record |
| `pending_person_id` | UUID | |
| `person_link_code` | TEXT | One-time code for self-link |
| `person_link_code_expires_at` | TIMESTAMP | |
| `assigned_barangay` | TEXT | |
| `permitted_barangays` | TEXT[] | DEFAULT '{}' |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `device_id` | TEXT | |
| `mfa_secret` | TEXT | |
| `mfa_enabled` | BOOLEAN | DEFAULT FALSE |
| `token_version` | INTEGER | DEFAULT 0 — for JWT invalidation |
| `email_verified` | BOOLEAN | DEFAULT TRUE |
| `verification_token` | TEXT | |
| `verification_token_expires_at` | TIMESTAMP | |
| `reset_token` | TEXT | |
| `reset_token_expires_at` | TIMESTAMP | |
| `new_email` | TEXT | |
| `new_email_token` | TEXT | |
| `new_email_token_expires_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_users_verification_token`, `idx_users_reset_token`, `idx_users_new_email_token`, `idx_user_person`

---

### 3. `beneficiaries` — Beneficiary registrations (thin wrapper around persons)
*Entity: beneficiaries/beneficiary.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `person_id` | UUID | FK → persons(id), NOT NULL |
| `access_card_code` | TEXT | UNIQUE |
| `user_id` | UUID | |
| `household_id` | UUID | FK → households(id) |
| `consent_status` | TEXT | DEFAULT 'active' |
| `category` | TEXT | |
| `hash` | TEXT | Audit hash chain |
| `prev_hash` | TEXT | Previous record hash |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

*(All person fields (surname, firstName, etc.) accessed via FK join — flattened via `@Expose()` getters in entity)*

**Indexes**: `idx_beneficiary_access_card`, `idx_beneficiary_person`, `idx_beneficiary_user`, `idx_beneficiary_category_trgm` (GIN trigram)

**RLS**: Row-Level Security enabled — policies based on `app.current_role` and `app.current_barangay`

---

### 4. `households` — Household groupings
*Entity: beneficiaries/household.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `primary_beneficiary_id` | UUID | |
| `barangay` | TEXT | |
| `estimated_income` | DECIMAL(12,2) | |
| `verified_by` | TEXT | |
| `verified_at` | TIMESTAMP | DEFAULT NOW() |
| *(members)* | | Via OneToMany → household_memberships |

---

### 5. `household_memberships` — Links persons to households
*Entity: beneficiaries/household-membership.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `person_id` | UUID | FK → persons(id), NOT NULL |
| `household_id` | UUID | FK → households(id) |
| `relationship` | TEXT | NOT NULL |
| `is_primary` | BOOLEAN | DEFAULT FALSE |
| `status` | TEXT | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_hm_person`, `idx_hm_household`

---

### 6. `beneficiary_claimants` — Claimant relationships for beneficiaries
*Entity: beneficiaries/beneficiary-claimant.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `beneficiary_id` | UUID | FK → persons(id), NOT NULL |
| `claimant_id` | UUID | FK → persons(id), NOT NULL |
| `relationship` | TEXT | NOT NULL |
| `authorization_url` | TEXT | |
| `calendar_year` | INTEGER | |
| `is_primary` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_bc_beneficiary`, `idx_bc_claimant`, `idx_bc_unique_primary` (UNIQUE beneficiary_id, claimant_id)

---

### 7. `beneficiary_roles` — Role/consent/access-card records per person
*Entity: beneficiaries/beneficiary-role.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `person_id` | UUID | FK → persons(id), NOT NULL |
| `household_id` | UUID | |
| `user_id` | UUID | |
| `consent_status` | TEXT | DEFAULT 'active' |
| `access_card_code` | TEXT | UNIQUE |
| `category` | TEXT | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

---

### 8. `cases` — Social welfare case management (core case table)
*Entity: cases/case.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `control_no` | TEXT | UNIQUE, NOT NULL |
| `beneficiary_id` | UUID | FK → beneficiaries(id) |
| `service_requested` | TEXT[] | |
| `requirements_checklist` | JSONB | |
| `status` | TEXT (VARCHAR) | CHECK IN ('enrolled','assessed','in_review','active','transitioning','closed'), DEFAULT 'enrolled' |
| `certificate_url` | TEXT | |
| `petty_cash_voucher_url` | TEXT | |
| `approved_by_signature` | TEXT | |
| `approved_by_role` | VARCHAR | |
| `assigned_worker_id` | UUID | FK → users(id) |
| `assigned_worker_name` | TEXT | |
| `problems_presented` | TEXT | |
| `social_worker_assessment` | TEXT | |
| `client_category` | TEXT | |
| `nature_of_service` | TEXT[] | |
| `financial_subsidies` | JSONB | |
| `amount_assistance` | DECIMAL(12,2) | |
| `mode_financial_assistance` | TEXT | |
| `source_of_fund` | TEXT | |
| `legislator_specify` | TEXT | |
| `other_assistance` | JSONB | |
| `interviewed_by` | TEXT | |
| `client_signature` | TEXT | |
| `self_reliance_plan` | TEXT | |
| `referrals` | JSONB | Array of {agencyName, contactInfo, reason, status, notes} |
| `follow_up_date` | DATE | |
| `exit_notes` | TEXT | |
| `frva_score` | DECIMAL(5,2) | FRVA assessment score |
| `swdi_score` | DECIMAL(5,2) | SWDI assessment score |
| `family_dialogue_notes` | TEXT | |
| `self_reliance_level` | INTEGER | |
| `sustainability_plan` | TEXT | |
| `transition_date` | DATE | |
| `closure_outcome` | TEXT | |
| `closure_date` | DATE | |
| `follow_up_visits` | JSONB | Array of {date, type, notes, outcome} |
| `hash` | TEXT | Audit hash chain |
| `prev_hash` | TEXT | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_case_status`, `idx_case_control`

**RLS**: Row-Level Security enabled

---

### 9. `case_history` — Case status transition audit log
*Entity: cases/case-history.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `case_id` | VARCHAR | NOT NULL |
| `from_status` | TEXT | Enum values matching case statuses |
| `to_status` | TEXT | NOT NULL, enum values matching case statuses |
| `changed_by_role` | VARCHAR | |
| `changed_by_id` | VARCHAR | |
| `remarks` | VARCHAR | |
| `transition_type` | VARCHAR | DEFAULT 'standard' — values: 'standard', 'override' |
| `override_reason` | VARCHAR | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Index**: `IDX_case_history_case_id` on case_id

---

### 10. `case_interventions` — Services/interventions delivered per case
*Entity: case-interventions/case-intervention.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `case_id` | TEXT | NOT NULL |
| `program_id` | UUID | |
| `service_name` | TEXT | NOT NULL |
| `category` | TEXT | |
| `delivery_date` | DATE | |
| `amount` | DECIMAL(12,2) | |
| `mode_of_delivery` | TEXT | |
| `fund_source` | TEXT | |
| `notes` | TEXT | |
| `delivered_by` | TEXT | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Index**: `idx_case_interventions_case` on case_id

*(Replaces the old `interventions` table which was dropped)*

---

### 11. `programs` — Social service programs
*Entity: programs/program.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `name` | TEXT | NOT NULL |
| `category` | TEXT | |
| `waiting_period_days` | INTEGER | |
| `required_documents` | JSONB | String array |
| `fund_sources` | TEXT[] | |
| `approval_workflow` | JSONB | Array of {stepName, approverRole, slaDays, order} |
| `form_template` | JSONB | Dynamic form definition |
| `legal_basis` | TEXT | |
| `form_version` | INTEGER | DEFAULT 1 |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

---

### 12. `form_version_history` — Versioned program form templates
*Entity: programs/form-version-history.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `program_id` | UUID | FK → programs(id) ON DELETE CASCADE, NOT NULL |
| `form_template` | JSONB | NOT NULL |
| `version` | INTEGER | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Index**: `idx_form_version_history_program_id`

---

### 13. `referrals` — Barangay coordinator referrals
*Entity: referrals/referral.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `coordinator_id` | UUID | FK → users(id), NOT NULL |
| `barangay` | TEXT | NOT NULL |
| `surname` | TEXT | NOT NULL |
| `first_name` | TEXT | NOT NULL |
| `middle_name` | TEXT | |
| `extension` | TEXT | |
| `gender` | TEXT | NOT NULL |
| `dob` | DATE | NOT NULL |
| `address` | JSONB | |
| `phone` | TEXT | |
| `reason` | TEXT | NOT NULL |
| `status` | TEXT | DEFAULT 'pending', CHECK IN ('pending','accepted','declined') |
| `decline_reason` | TEXT | |
| `case_id` | UUID | FK → cases(id) |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_referral_coordinator`, `idx_referral_status`, `idx_referral_barangay`

---

### 14. `irf_cases` — Incident Report Forms (intake + blotter)
*Entity: irf/irf-case.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `blotter_entry_number` | TEXT | UNIQUE, NOT NULL |
| `case_category` | TEXT (Enum) | CHECK IN ('Abuse','Neglect','Exploitation','Criminal') |
| `datetime_reported` | TIMESTAMP | |
| `datetime_incident` | TIMESTAMP | |
| `item_a_reporting_person` | JSONB | Reporting person details |
| `item_b_person_reported` | JSONB | Person reported details |
| `case_id` | UUID | FK → cases(id) |
| `encrypted_narration` | BYTEA | AES-256 encrypted narration |
| `case_disposition` | CUSTOM ENUM `irf_disposition` | NOT NULL, DEFAULT 'Under Investigation' — values: 'Under Investigation', 'Referred to PNP', 'Referred to WCPD', 'Dismissed', 'Closed' |
| `key_wraps` | JSONB | Array of {userId, encryptedKey} — per-user key wrapping |
| `key_version` | INTEGER | DEFAULT 1 — key rotation tracking |
| `dismissal_reason` | TEXT | |
| `msdw_signature_url` | TEXT | MSDW officer signature |
| `reporting_signature_url` | TEXT | Reporting party signature |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**RLS**: Row-Level Security enabled

---

### 15. `access_card_services` — Service log per access card
*Entity: access-cards/access-card-service.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `access_card_code` | TEXT | NOT NULL |
| `service_date` | DATE | NOT NULL |
| `service_rendered` | TEXT | NOT NULL |
| `cost` | DECIMAL(12,2) | |
| `agency` | TEXT | |
| `worker_name_sign` | TEXT | |
| `category` | TEXT | |
| `intervention_id` | UUID | |
| `logged_by` | UUID | FK → users(id) |
| `source_barangay` | TEXT | |

---

### 16. `csr_reports` — Case Study Reports
*Entity: csr/csr.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `case_id` | UUID | NOT NULL |
| `control_no` | TEXT | UNIQUE, NOT NULL |
| `social_worker_name` | TEXT | NOT NULL |
| `social_worker_position` | TEXT | |
| `referral_origin` | TEXT | |
| `reason_for_referral` | TEXT | |
| `problem_presented` | TEXT | |
| `family_background` | TEXT | |
| `socio_economic_profile` | TEXT | |
| `assessment_analysis` | TEXT | |
| `recommendation` | TEXT | |
| `intervention_plan` | TEXT | |
| `client_signature_url` | TEXT | |
| `worker_signature_url` | TEXT | |
| `finalized` | BOOLEAN | DEFAULT FALSE |
| `created_by` | TEXT | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_csr_case`, `idx_csr_control`

---

### 17. `document_vault` — File/document storage
*Entity: filing/filing.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `file_name` | TEXT | NOT NULL (storage path) |
| `original_name` | TEXT | |
| `mime_type` | TEXT | |
| `file_size` | INTEGER | DEFAULT 0 |
| `case_id` | UUID | |
| `beneficiary_id` | UUID | |
| `category` | TEXT | |
| `notes` | TEXT | |
| `requirement_key` | VARCHAR | Maps to program requirement key |
| `uploaded_by` | UUID | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_doc_case`, `idx_doc_beneficiary`

---

### 18. `chat_messages` — In-app messaging
*Entity: chat/chat.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `sender_id` | TEXT | NOT NULL |
| `sender_name` | TEXT | |
| `recipient_id` | TEXT | NOT NULL |
| `content` | TEXT | NOT NULL |
| `conversation_id` | TEXT | NOT NULL |
| `is_read` | BOOLEAN | DEFAULT FALSE |
| `read_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_chat_conversation`, `idx_chat_participants`

---

### 19. `notifications` — Outbound notifications
*Entity: notifications/notification.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `recipient_id` | TEXT | NOT NULL |
| `title` | TEXT | NOT NULL |
| `message` | TEXT | NOT NULL |
| `category` | TEXT (Enum) | DEFAULT 'system' — values: 'case_update', 'sync_conflict', 'system', 'chat', 'approval', 'disbursement', 'sla_escalation' |
| `channel` | TEXT (Enum) | DEFAULT 'in_app' — values: 'sms', 'in_app', 'email' |
| `phone` | TEXT | |
| `email` | TEXT | |
| `reference_id` | TEXT | |
| `is_read` | BOOLEAN | DEFAULT FALSE |
| `sent` | BOOLEAN | DEFAULT FALSE |
| `consent_skipped` | BOOLEAN | DEFAULT FALSE |
| `sent_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_notif_recipient`, `idx_notif_read`, `idx_notifications_email`

---

### 20. `notification_preferences` — Per-user notification opt-in
*Entity: notifications/notification-preference.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `user_id` | VARCHAR | NOT NULL |
| `channel` | VARCHAR | NOT NULL ('sms', 'in_app', 'email') |
| `category` | VARCHAR | NOT NULL (maps to NotificationCategory enum) |
| `opted_in` | BOOLEAN | DEFAULT FALSE |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Unique Index**: `idx_notif_prefs_user_channel_category` (UNIQUE on user_id, channel, category)

---

### 21. `consent_ledger` — Beneficiary consent audit trail
*Entity: beneficiaries/consent-ledger.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `beneficiary_id` | UUID | |
| `purpose` | TEXT | |
| `channel` | TEXT | |
| `status` | TEXT | DEFAULT 'active' |
| `granted_at` | TIMESTAMP | DEFAULT NOW() |
| `revoked_at` | TIMESTAMP | |
| `revoked_reason` | TEXT | |
| `hash` | TEXT | Audit hash chain |
| `prev_hash` | TEXT | |

**Indexes**: `idx_consent_beneficiary`, `idx_consent_status`

**RLS**: Row-Level Security enabled

---

### 22. `otp_codes` — One-time password verification
*Entity: otp/otp.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `phone` | TEXT | NOT NULL |
| `code` | TEXT | NOT NULL |
| `verified` | BOOLEAN | DEFAULT FALSE |
| `expires_at` | TIMESTAMP | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_otp_phone`, `idx_otp_expires`

---

### 23. `sync_queue` — Offline sync change queue
*Entity: sync/sync-queue.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `device_id` | TEXT | NOT NULL |
| `table_name` | TEXT | NOT NULL |
| `record_id` | TEXT | NOT NULL |
| `operation` | TEXT | NOT NULL ('INSERT', 'UPDATE', 'DELETE') |
| `payload` | JSONB | |
| `client_updated_at` | TIMESTAMP | NOT NULL |
| `status` | TEXT | DEFAULT 'pending' — values: 'pending', 'applied', 'conflict', 'failed' |
| `idempotency_key` | TEXT | |
| `conflict_reason` | TEXT | |
| `resolved_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Index**: `idx_sync_status`

---

### 24. `version_vectors` — CRDT sync version tracking
*Entity: sync/version-vector.entity.ts*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `device_id` | TEXT | NOT NULL |
| `table_name` | TEXT | NOT NULL |
| `local_version` | INTEGER | DEFAULT 0 |
| `server_version` | INTEGER | DEFAULT 0 |
| `last_synced_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |
| `updated_at` | TIMESTAMP | DEFAULT NOW() |

**Unique Constraint**: UNIQUE (device_id, table_name)

---

### 25. `idempotency_keys` — Idempotent operation tracking
*Created by: 20260619000001-audit-hash-chain*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `key` | TEXT | UNIQUE, NOT NULL |
| `result` | JSONB | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Index**: `idx_idempotency_key`

---

### 26. `audit_log` — General audit log
*Created by: 20260622000005-IRFDispositionEncryption*

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT uuid_generate_v7() |
| `action` | TEXT | NOT NULL |
| `reference_id` | TEXT | |
| `user_id` | TEXT | |
| `details` | JSONB | |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

**Indexes**: `idx_audit_log_action`, `idx_audit_log_reference`

---

### 27. `access_card_seq` — Access card serial number sequence
*Created by: 1740000000000-AaaInitialSchema*

| Column | Type | Constraints |
|---|---|---|
| `id` | SERIAL | PK |
| `year` | INTEGER | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

---

### 28. `irf_blotter_seq` — IRF blotter number sequence
*Created by: 1740000000000-AaaInitialSchema*

| Column | Type | Constraints |
|---|---|---|
| `id` | SERIAL | PK |
| `year` | INTEGER | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

---

## Dropped Tables (NOT currently active)

| Table | Dropped By | Notes |
|---|---|---|
| `interventions` | 20260727000001 | Replaced by `case_interventions` |
| `family_members` | 20260727000002 | Replaced by `household_memberships` |
| `program_assignments` | 20260727000003 | Removed; workflow moved to programs JSONB |
| `program_assignment_steps` | 20260727000003 | Removed; workflow moved to programs JSONB |
| `case_tracker_log` | 20260723000001 | Legacy daily tracking log |

---

## Entity-Relationship Summary

```
persons ──┬──< beneficiaries (FK person_id)
           ├──< household_memberships (FK person_id)
           ├──< beneficiary_claimants (FK beneficiary_id, claimant_id)
           ├──< beneficiary_roles (FK person_id)
           └──< users (FK person_id)

households ──< household_memberships (FK household_id)
           └──< beneficiaries (FK household_id)

users ──┬──< referrals (FK coordinator_id)
         ├──< cases (FK assigned_worker_id)
         └──< access_card_services (FK logged_by)

beneficiaries ──< cases (FK beneficiary_id)

cases ──┬──< referrals (FK case_id)
         ├──< irf_cases (FK case_id)
         ├──< case_history (case_id text)
         ├──< case_interventions (case_id text)
         └──< csr_reports (FK case_id)

programs ──< form_version_history (FK program_id)
```

## RLS Policies

The following tables have Row-Level Security:
- `beneficiaries`
- `cases`
- `consent_ledger`
- `irf_cases`

Roles used in policies: `admin` (full access), `social_worker` / `coordinator` (barangay-scoped via join to `persons.address`), `mayor` / `auditor` (SELECT only).
