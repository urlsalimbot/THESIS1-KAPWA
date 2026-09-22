# KAPWA — Role Segregation & Functional Overlap

Functional-requirements view of the seven roles, derived from the route guards (`routes.tsx`) and controller `@Roles` decorators. **Authentication is a non-functional requirement** and is therefore excluded from the overlap analysis — every role authenticates; what distinguishes them is *what they can do*.

> **Claimant representation:** a claimant is the person who transacts with the system on behalf of a beneficiary — the beneficiary may also be their own claimant. All claimant actions below are scoped to the represented beneficiary record(s) and gated by consent.

---

## 1. Functional requirement areas

| # | Area | Representative capabilities |
|---|---|---|
| F1 | Intake & registration | Beneficiary + claimant + family, household, auto access card |
| F2 | Case lifecycle | Assessment, FSM transitions, interventions |
| F3 | Case approval | Approve & sign, COE/PCV production |
| F4 | Beneficiary management | List/search/detail, family graph, add case |
| F5 | Access cards | Assign, ledger (6 categories), QuickScan, agency summaries, printable PDF |
| F6 | IRF | Create, decrypt/unmask (legal basis), WCPD/PDF export |
| F7 | Programs | Manage (admin) / public list |
| F8 | Announcements | Manage / public display |
| F9 | Referrals | Barangay (submit, review) + inter-agency (respond, promote) |
| F10 | Chat | Direct messages |
| F11 | Notifications | Receive + per-category preferences |
| F12 | Offline sync | Queue, delta sync, conflict resolution |
| F13 | Dashboards & reporting | Role dashboards, tracker, SLA, trends, exports |
| F14 | Audit & compliance | Audit log, hash-chain verify, consent ledger |
| F15 | Admin panel | Users, sync queue, audit log, contact inbox |
| F16 | Document exports | GIS/CSR/IRF/access card, audit logs, service summary, monthly funds, compliance, certificates |
| F17 | Claimant transactions | My dashboard, my access card (read-only), required-document uploads, disbursement receipts, my consent |
| F18 | Public website | Anonymous browsing, registration, contact |

## 2. Role × area matrix

`W` = write/manage · `R` = read/view · `S` = scoped to own barangay/agency/self · `—` = none

| Area | admin | social_worker | coordinator | agency_staff | mayor | auditor | claimant |
|---|---|---|---|---|---|---|---|
| F1 Intake | W | W | — | — | — | — | — |
| F2 Case lifecycle | W | W | — | — | — | — | — |
| F3 Case approval | W | R | — | — | — | — | — |
| F4 Beneficiaries | W | W | R | — | R | R | S (represented) |
| F5 Access cards | W | W | S | S | — | — | R (own) |
| F6 IRF | W | W | — | — | — | R | — |
| F7 Programs | W | R | R | R | R | R | R |
| F8 Announcements | W | W | W | — | R | R | R |
| F9 Referrals | W | W | S (submit) | S (respond) | — | — | — |
| F10 Chat | W | W | W | — | — | — | S |
| F11 Notifications | W | W | W | W | W | W | W |
| F12 Offline sync | W | W | W | — | — | — | — |
| F13 Dashboards/tracker | W | W | S | S | R | R | S |
| F14 Audit & compliance | W | — | — | — | — | W | W (consent) |
| F15 Admin panel | W | — | — | — | — | — | — |
| F16 Document exports | W | W | S | — | R | R | — |
| F17 Claimant transactions | — | — | — | — | — | — | W |
| F18 Public website | (anonymous — no role) | | | | | | |

---

## 3. Overlap groups (functional requirements only)

### Group A — Casework core
**admin + social_worker** — overlap ≈ 90% of the functional surface.
- Shared: F1, F2, F4, F5, F6, F7(R), F8, F9, F10, F11, F12, F13, F16 (GIS/CSR/IRF/certificates), case reads.
- Divergence: **admin** exclusively owns F3 approval, F7 write, F14 audit write, F15 admin panel, and unmasked bulk exports; **social_worker** is the only role that may `request-review` and delete/patch interventions.
- Character: *doers* — the only roles that create and progress cases.

### Group B — Field / partner
**coordinator + agency_staff** — overlap ≈ 40%, and it is the *partner* overlap: referrals + access cards + scoped dashboards + notifications.
- Shared: F9 (opposite directions), F5 (both log/view card activity), F11, F13 (scoped).
- Coordinator extras: F8 announcements, F10 chat, F12 offline sync, F4/F13 barangay reads.
- Agency extras: agency profile, card-activity summaries, inter-agency responses.
- Character: *external-facing* — neither can touch intake, case lifecycle, approvals, or IRFs.

### Group C — Oversight (read-only)
**mayor + auditor** — overlap ≈ 80% *within their read-only surface*.
- Shared: F4 (read), F13 tracker/SLA/reports, F16 service-summary/compliance, F11.
- Auditor extras: F14 audit log + hash-chain verification, audit-log exports.
- Mayor extras: fund utilization, mayor reports.
- Character: *observers* — zero write paths anywhere in the system.

### Group D — Claimant representation
**claimant** — singleton group; represents the beneficiary (who may be the claimant).
- F17 (+ scoped F4/F5 reads, F10 chat, F11 notifications, consent handling, required-document uploads, disbursement receipts). No operational overlap with any staff role by design — the claimant transacts on the beneficiary's behalf while staff deliver the services.

---

## 4. Overlap implications

1. **Group A is the true core**: all operational data flows through admin/social_worker; every other group consumes their output. Any RBAC change here has the widest blast radius.
2. **Group B is the natural unification candidate** (see the earlier coordinator/agency question): the roles share the partner *function set* and differ mainly in **scope** (barangay vs agency) and **referral direction** (refer-in vs respond). Unifying them = one partner role carrying a scope attribute, not a permission merge.
3. **Group C can be merged with zero write-risk** — mayor and auditor are both read-only; the only functional difference is *which reports* (funds vs compliance) and audit-log access.
4. **Claimant must stay isolated** — the only role scoped to the represented beneficiary record(s), and the only non-staff actor in the casework domain.
5. **Auth (non-functional)** is identical across all seven roles (JWT + refresh + optional MFA + person-link for claimants), so it contributes no differentiation — role segregation is purely a functional-requirements concern, as modeled above.
