# E2E Test Results — IRF Module & Access Cards Module

Date: 2026-07-27
Tester: API automated (curl + Python)

---

## Test 7: IRF Module

| # | Test | Result | Notes |
|---|------|--------|-------|
| 7.1 | List loads | ✅ PASS | 6 IRF entries returned |
| 7.2 | Create IRF | ✅ PASS | Encryption via pgcrypto works; fixed cipher name from `aes-256-cbc/pad:pkcs` to `aes-cbc/pad:pkcs` for PG 16 compat |
| 7.3 | View IRF detail | ✅ PASS | Detail with person info, narration encrypted |
| 7.4 | Override disposition | ✅ PASS | `PATCH /irf/:id/override-disposition` with valid target enum |
| 7.5 | Refer to WCPD | ✅ PASS | `PATCH /irf/:id/refer-wcpd` |
| 7.6 | Refer to PNP | ✅ PASS | `PATCH /irf/:id/refer-pnp` |
| 7.7 | Dismiss IRF | ✅ PASS | `PATCH /irf/:id/dismiss` with `{ reason }` body |
| 7.8 | Export PDF | ✅ PASS | Password-protected PDF (2967 bytes) |
| 7.9 | Export WCPD | ✅ PASS | Structured JSON with `WCPD-EXPORT-v1` format |

**Bugs found & fixed:**
- `irf.service.ts:46` and `irf.service.ts:205`: pgcrypto cipher string `aes-256-cbc/pad:pkcs` not supported on PostgreSQL 16; changed to `aes-cbc/pad:pkcs`
- Server requires `IRF_ENCRYPTION_KEY` env var (hex, 32 bytes)

---

## Test 8: Access Cards Module

| # | Test | Result | Notes |
|---|------|--------|-------|
| 8.1 | List loads | ✅ PASS | Lists all access card service records |
| 8.2 | Look up card | ✅ PASS | `GET /access-cards/:cardCode` returns service history |
| 8.3 | Assign card | ✅ PASS | `POST /access-cards/assign/:beneficiaryId` generates code `NORZ-AC-2026-NNNN` |
| 8.4 | Log service | ✅ PASS | `POST /access-cards/log` with valid category (`case_service`, `referral`, `community_service`, `seminar`) |
| 8.5 | View card summary | ✅ PASS | `GET /access-cards/beneficiary/:id/card/summary` — counts by category |
| 8.6 | Print/View card | ✅ PASS | `GET /access-cards/beneficiary/:id/card` — full beneficiary card view |

**Bugs found & fixed:**
- `access-cards.service.ts:45` and `access-cards.service.ts:63`: Queried `surname, first_name, barangay` from `beneficiaries` table (columns don't exist); fixed with `JOIN persons` on `person_id`.

---

## Summary

- **Total tests**: 15
- **Passed**: 15
- **Failed**: 0
- **Bugs fixed**: 3 (2 pgcrypto cipher strings, 2 beneficiary column references)
