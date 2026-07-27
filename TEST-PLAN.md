# E2E Test Plan — Playwright MCP

## Roles & Credentials

| Role | Email | Password | Sees |
|------|-------|----------|------|
| admin | admin@mswdo.test | admin123 | Everything except claimant/mayor/auditor pages |
| social_worker | worker1@mswdo.test | worker123 | Intake, Cases, Beneficiaries, IRF, CSR, Filing, Approvals, Access Cards |
| coordinator | coordinator@mswdo.test | coordinator123 | Dashboard, Cases, Intake, Coordinator Dashboard |
| claimant | pedro.claimant@test.com | claimant123 | My Dashboard, My Access Card |
| mayor | mayor@mswdo.test | mayor123 | Reports, Dashboard |
| auditor | auditor@mswdo.test | auditor123 | Audit Logs, Dashboard |

---

## 1. Authentication

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 1.1 | Login admin | Navigate `/login`, fill email+password, click Sign In | Redirect to `/dashboard` or `/programs` |
| 1.2 | Login worker | Same form, worker1 credentials | Sees worker nav items (no Admin/Programs) |
| 1.3 | Login claimant | Same form, pedro.claimant@test.com | Redirect to `/my-dashboard` |
| 1.4 | Login mayor | mayor@mswdo.test / mayor123 | Sees Reports nav item |
| 1.5 | Login auditor | auditor@mswdo.test / auditor123 | Sees Audit Logs nav item |
| 1.6 | Login coordinator | coordinator@mswdo.test / coordinator123 | Sees Barangay Coordinator nav |
| 1.7 | Invalid credentials | Wrong password | Stays on `/login`, shows error toast |
| 1.8 | Logout | Click avatar → Logout | Redirect to landing page, sidebar gone |
| 1.9 | Register claimant | Navigate `/register`, fill form | Email verification prompt |
| 1.10 | Forgot password | Navigate `/forgot-password`, enter email | Success message |

## 2. Dashboard

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 2.1 | Metrics load | Login admin → `/dashboard` | Cards: Served Today, Pending Review, Disbursed Month, Beneficiaries |
| 2.2 | Case Status Chart | Scroll to chart section | Bar/pie chart renders with status counts |
| 2.3 | Needs Attention | Check needs-attention section | Lists overdue/unattended cases |
| 2.4 | Recent Cases table | Check table rows | Columns: Control No, Beneficiary, Status, Worker, Date |
| 2.5 | Trends chart | Check trends section | Monthly case trend chart |
| 2.6 | SLA widget | Check SLA compliance display | SLA metric cards |
| 2.7 | New Intake button | Click "New Intake" | Navigates to `/intake` |

## 3. Cases Module

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 3.1 | Case list loads | Login → `/cases` | Table with columns, data loads without error |
| 3.2 | Search/filter | Type in search box | Table filters results |
| 3.3 | Status filter | Select status from dropdown | Table filters by status |
| 3.4 | Date range filter | Pick date range | Table filters by date |
| 3.5 | Create case | Click "New Case" → fill form | 201, case appears in list |
| 3.6 | View case detail | Click a case row | Navigates to `/cases/:id` |
| 3.7 | Case stepper (5 stages) | View assessment/interventions/exit plan/signatures tabs | Each tab renders correctly |
| 3.8 | Update assessment | Go to Assessment tab → fill → save | PATCH succeeds, data persists |
| 3.9 | Add intervention | Go to Interventions tab → add intervention | POST succeeds, listed |
| 3.10 | Request review | Click "Request Review" | Status transitions to `assessed` |
| 3.11 | Approve case | Click "Approve" | Status transitions to next state |
| 3.12 | Override status | Admin → Override Status dialog | PATCH `/cases/:id/override-status` works |
| 3.13 | Close case | Click "Close" → fill closure form | Status = `closed`, closure date set |
| 3.14 | Case history | Click History tab | Timeline of status changes |

## 4. Intake Module

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 4.1 | Intake form loads | Login → `/intake` | Form renders: beneficiary, claimant, case sections |
| 4.2 | Validation errors | Submit empty form | Zod validation errors shown per field |
| 4.3 | Submit intake | Fill all required fields → submit | 201, case created with enrolled status |
| 4.4 | Match check | Enter existing phone/name | Shows "Person found" alert |
| 4.5 | Intake review page | Navigate `/intake/review` | Lists pending intakes (if any) |

## 5. Beneficiaries Module

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 5.1 | List loads | Login → `/beneficiaries` | Table with data, pagination |
| 5.2 | Search beneficiary | Type name → debounced search | Table filters |
| 5.3 | View beneficiary | Click row → `/beneficiaries/:id` | Profile, family graph, cases, services tabs |
| 5.4 | Family tree graph | Go to Family tab | Graph renders with nodes + edges |
| 5.5 | Consent history | Go to Consent tab | Ledger rows with status |
| 5.6 | Revoke consent | Click Revoke on active consent | Status changes to `revoked` |
| 5.7 | Access card summary | Go to Access Card tab | Service history table |
| 5.8 | Create beneficiary | Click "New" → fill + submit | 201 |

## 6. Programs Module (Admin)

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 6.1 | List loads | Login admin → `/programs` | Program cards/table |
| 6.2 | Create program | Click "New Program" → fill form (name, category, waiting period, docs, fund sources, workflow, form template) | 201 |
| 6.3 | Edit program | Click edit on existing | PATCH succeeds |
| 6.4 | Delete program | Click delete → confirm | 200, removed from list |
| 6.5 | View program detail | Click program card | Detail view with workflow steps |
| 6.6 | Non-admin blocked | Login worker → `/programs` | Redirect or 403 |

## 7. IRF Module

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 7.1 | List loads | Login → `/irf` | Table with blotter entries |
| 7.2 | Create IRF | Click "New IRF" → fill form (category, persons, narration) | 201 |
| 7.3 | View IRF detail | Click row → `/irf/:id` | Detail with person info, narration |
| 7.4 | Change disposition | Click disposition dropdown → select new | PATCH succeeds |
| 7.5 | Refer to WCPD | Click "Refer to WCPD" | Status updates |
| 7.6 | Refer to PNP | Click "Refer to PNP" | Status updates |
| 7.7 | Dismiss IRF | Click "Dismiss" → enter reason | Status = dismissed |
| 7.8 | Export PDF | Click "Export PDF" | PDF downloads / opens |
| 7.9 | Export WCPD | Click "Export WCPD" | WCPD-formatted document |

## 8. Access Cards Module

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 8.1 | List loads | Login → `/access-cards` | Table with card codes |
| 8.2 | Look up card | Enter card code in search | Card detail view |
| 8.3 | Assign card | Click "Assign" → select beneficiary | POST `/access-cards/assign/:id` |
| 8.4 | Log service | Click "Log Service" → fill form | POST `/access-cards/log` |
| 8.5 | View card summary | Navigate `/beneficiary/:id/access-card` | Service history summary |
| 8.6 | Print card | Navigate `/beneficiaries/:id/card/print` | Print-friendly view |

## 9. Admin Panel

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 9.1 | Page loads | Login admin → `/admin` | Tabbed interface |
| 9.2 | Users tab | Click Users tab | User table with roles |
| 9.3 | Create user | Fill new user form | POST `/users` |
| 9.4 | Edit user | Click edit → change role | PATCH `/users/:id` |
| 9.5 | Deactivate user | Toggle active | User deactivated |
| 9.6 | System tab | Click System tab | Config settings |
| 9.7 | Audit tab | Click Audit tab | Audit log viewer |

## 10. Settings

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 10.1 | Profile loads | Login → `/settings` | Profile form (name, email, phone) |
| 10.2 | Update profile | Change name → save | PATCH user, toast success |
| 10.3 | Change password | Fill current + new password | POST `/auth/change-password` |
| 10.4 | MFA setup | Click "Enable MFA" → scan QR → enter code | MFA enabled |
| 10.5 | Notification prefs | Toggle notification channels | PUT `/notifications/preferences` |
| 10.6 | Update phone | Change phone → save | POST `/auth/update-phone` |

## 11. CSR Generator

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 11.1 | List loads | Login → `/csr` | CSR report table |
| 11.2 | Create CSR | Click "New CSR" → fill form (long form with all sections) | POST `/csr`, 201 |
| 11.3 | Edit CSR | Click edit → modify → save | PATCH `/csr/:id` |
| 11.4 | Delete CSR | Click delete | 200 |
| 11.5 | View CSR detail | Click row | Full report view |
| 11.6 | Finalize CSR | Click "Finalize" | Can no longer edit |
| 11.7 | Generate PDF | Click "Download PDF" | `/csr/:controlNo/pdf` |

## 12. Chat / Messages

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 12.1 | Conversation list | Login admin → `/messages` | List of conversations |
| 12.2 | Open conversation | Click a conversation | Message thread loads |
| 12.3 | Send message | Type message → send | POST `/chat/send`, appears in thread |
| 12.4 | Unread count | Check sidebar badge | Unread indicator |
| 12.5 | Mark read | Open conversation | POST `/chat/conversation/:id/read` |

## 13. Notifications

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 13.1 | Notification list | Navigate `/notifications` | List of notifications |
| 13.2 | Mark all read | Click "Mark all read" | POST `/notifications/read-all` |
| 13.3 | In-app dropdown | Click bell icon | Dropdown with recent notifications |
| 13.4 | Notification preferences | Navigate settings → notifications | Toggle per channel/category |

## 14. Filing Module

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 14.1 | List loads | Login → `/filing` | Document list |
| 14.2 | Upload document | Click "Upload" → select file | POST `/filing/upload` |
| 14.3 | Download document | Click download icon | GET `/filing/:id/download` |
| 14.4 | Delete document | Click delete → confirm | DELETE `/filing/:id` |

## 15. Approvals Pipeline

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 15.1 | List loads | Login → `/approvals` | Pending approval items |
| 15.2 | Approve item | Click "Approve" | Status updates |
| 15.3 | Reject item | Click "Reject" → enter reason | Status = rejected |

## 16. Daily Tracker

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 16.1 | Tracker loads | Login → `/tracker` | Daily tracker table |
| 16.2 | Date navigation | Pick a date | Cases for that date |
| 16.3 | Stats | Check stats section | Case counts by status |

## 17. Role-Based Access Control

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 17.1 | Worker blocked from Admin | Login worker → navigate `/admin` | Redirect to `/dashboard` |
| 17.2 | Worker blocked from Programs | Navigate `/programs` | Redirect |
| 17.3 | Claimant sees own dashboard | Login claimant → navigates to `/my-dashboard` | Claimant-specific view |
| 17.4 | Claimant sees own access card | Navigate `/my-access-card` | Their card data |
| 17.5 | Mayor sees reports | Login mayor → `/reports` | Mayor reports dashboard |
| 17.6 | Auditor sees audit logs | Login auditor → `/audit-logs` | Audit log viewer |
| 17.7 | Coordinator dashboard | Login coordinator → `/coordinator` | Coordinator-specific layout |

## 18. Edge Cases

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 18.1 | Refresh token | Wait 1h → check still logged in | Silent refresh works |
| 18.2 | CSRF protection | Submit form without CSRF token | 403 |
| 18.3 | Rate limiting | Rapid repeated login attempts | 429 after N attempts |
| 18.4 | Empty state | View module with no data | "No records found" message |
| 18.5 | Network error | Disconnect → try action | Offline queue fallback |
| 18.6 | Pagination | Create 25+ items → check page 2 | Next page loads |
| 18.7 | Concurrent edit | Two tabs → edit same case | Conflict resolution dialog |

---

## Test Data Setup

```sql
-- Run before test suite
npm run seed  -- seeds 9 user accounts

-- Run once to create test entities
INSERT INTO beneficiaries (...) VALUES (...);
INSERT INTO cases (...) VALUES (...);
INSERT INTO programs (...) VALUES (...);
INSERT INTO irf_cases (...) VALUES (...);
-- or use the API via test setup hooks
```

## Playwright MCP Commands Reference

| Action | Command |
|--------|---------|
| Navigate | `browser_navigate url: "http://localhost:3001/login"` |
| Snapshot | `browser_snapshot` → find element refs |
| Type | `browser_type target: "[placeholder=\"...\"]", text: "..."` |
| Click | `browser_click target: "button \"Submit\""` |
| Form fill | `browser_fill_form fields: [...]` |
| Screenshot | `browser_take_screenshot filename: "page.png"` |
| Console | `browser_console_messages level: "error"` |
| Wait | `browser_wait_for text: "Loading..."` or `time: 2` |
| Dropdown | `browser_select_option target: "select", values: ["option"]` |
| Hover | `browser_hover target: "ref"` |
