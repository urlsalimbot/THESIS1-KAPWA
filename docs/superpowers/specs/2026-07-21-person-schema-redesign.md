# Person Schema Redesign — Unified Person Model

**Status:** Approved for implementation
**Date:** 2026-07-21

## Problem

Three separate entities hold overlapping personal data with inconsistent depth:
- `Beneficiary` (rich, 20+ fields)
- `FamilyMember` (minimal, 6 fields — fullName, relationship, age, occupation, income, status)
- `User (claimant)` (disconnected, linked only via `Beneficiary.userId`)

No single source of truth for a person. A family member becoming a beneficiary requires re-entry. A beneficiary listed as family member in another household duplicates data. A claimant (representative for bedridden/disabled beneficiary) has no formal relationship.

## Solution: Unified Person Model

```
persons (canonical person record)
  ├── beneficiary_roles (thin: consent, accessCardCode, category)
  ├── household_memberships (replaces FamilyMember)
  ├── beneficiary_claimants (claimant represents beneficiary)
  └── users.personId (grounds every account in a real person)
```

## Tables

### persons

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | BaseEntity |
| surname | varchar | required |
| firstName | varchar | required |
| middleName | varchar | nullable |
| gender | enum('Male','Female') | required |
| dob | date | required |
| address | varchar | nullable |
| phone | varchar | nullable |
| philsysNumber | varchar | unique, nullable |
| placeOfBirth | varchar | nullable |
| civilStatus | varchar | nullable |
| currentAddress | jsonb | nullable |
| provincialAddress | jsonb | nullable |
| philhealthNumber | varchar | nullable |
| occupation | varchar | nullable |
| estimatedMonthlyIncome | decimal(12,2) | nullable |
| age | integer | nullable |
| searchVector | tsvector | FTS |
| createdAt | timestamp | auto |
| updatedAt | timestamp | auto |

### beneficiary_roles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | BaseEntity |
| personId | uuid (FK→persons) | unique, required |
| householdId | varchar (FK→households) | nullable |
| userId | varchar (FK→users) | nullable — claimant account |
| consentStatus | varchar | default 'active' |
| accessCardCode | varchar | unique, nullable |
| category | varchar | nullable |
| createdAt | timestamp | auto |
| updatedAt | timestamp | auto |

### household_memberships (replaces family_members)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | BaseEntity |
| personId | uuid (FK→persons) | required |
| householdId | varchar (FK→households) | nullable |
| relationship | varchar | required |
| isPrimary | boolean | default false |
| status | varchar | nullable |
| createdAt | timestamp | auto |
| updatedAt | timestamp | auto |

### beneficiary_claimants

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | BaseEntity |
| beneficiaryId | uuid (FK→persons) | required |
| claimantId | uuid (FK→persons) | required |
| relationship | varchar | spouse, child, legal_guardian, unrelated_caretaker |
| authorizationUrl | varchar | nullable — document for unrelated claimants |
| calendarYear | integer | for 2-unrelated limit enforcement |
| isPrimary | boolean | default true |
| createdAt | timestamp | auto |

### users (existing, add personId)

| Column | Type | Notes |
|--------|------|-------|
| ...existing | ... | |
| personId | varchar (FK→persons) | nullable |

## Migration

1. Create `persons` table, migrate all `Beneficiary` rows into `persons` + `beneficiary_roles`
2. Create `household_memberships` table, migrate all `FamilyMember` rows
3. Create `beneficiary_claimants` table
4. Add `person_id` to `users`
5. Drop `family_members` table
6. Remove person fields from `beneficiaries` (keep only beneficiary-specific fields)

## Backward Compatibility

- Keep `Beneficiary` entity but as a query joining `persons` + `beneficiary_roles`
- Keep `FamilyMember` as a deprecated type alias for `HouseholdMembership`
- Service methods remain the same — internal queries change
