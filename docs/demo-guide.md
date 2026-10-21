# KAPWA Demo Guide — MSWDO Norzagaray Social Welfare System

> For presenters and stakeholders. Plain language, no technical jargon.
> Everything here runs on **https://kapwa.software** (Google Chrome recommended).
> The detailed shot-by-shot production script is `docs/ROLE-DEMO-SCRIPT.md`; this page
> is the short version for a live 20-minute walkthrough.

---

## Before you start (checklist)

- [ ] Open Chrome on the demo laptop and go to **https://kapwa.software** — the KAPWA welcome page appears.
- [ ] That is the live production site; there is no server to start and no certificate warning to click through.
- [ ] Use the sample accounts below. Each role sees only what that role is allowed to see.
- [ ] **Full screen:** press **F11**; if text looks too big or small, press **Ctrl + 0**.
- [ ] Leave DevTools closed and silence notifications so no toast lands mid-demo.

## Sample accounts

Only these four roles exist in the system. There is no separate agency, mayor, or auditor login.

| Role | Who this represents | Email | Password |
|---|---|---|---|
| **Admin** | MSWDO Office Head | admin@mswdo.test | admin123 |
| **Social Worker** | Field social worker | worker1@mswdo.test | worker123 |
| **Barangay Coordinator** | Barangay representative (Bigte) | coordinator.bigte@mswdo.test | coordinator123 |
| **Claimant** | Beneficiary representative (Pedro Reyes himself) | pedro.claimant@test.com | claimant123 |

Tip: write these on a card. To switch roles, click your avatar (top-right) → **Logout** → sign in again.

---

## Suggested 20-minute demo flow

### 1. Welcome (1 min)
Landing page → **Programs** and **Announcements** in the public nav. Explain: *"KAPWA is the
social welfare system of MSWDO Norzagaray — one system for intake, case management, approvals,
partner agencies, and public transparency. Anyone can browse the programs and announcements
without an account."*

### 2. Admin — the big picture (5 min)
Sign in as **admin@mswdo.test / admin123**. The admin lands on the Admin Panel.

- **Dashboard** — served today, pending review, disbursed this month, households served, and the
  recent-cases table with its **Barangay** column. The admin is not scoped: the whole municipality.
- **Cases** → **View** on *Pedro Poblete Reyes* (`MSWD-2026-00001`). The case file shows the guided
  workflow, the assessment, the interventions delivered (₱3,000 medical, ₱1,500 educational,
  ₱2,500 AICS), and the Documents card with working **Download** buttons.
- **Completing the assessment is the step's Lock button** — it saves the fields, seals the step
  and moves the case from Enrolled to Assessed. There is no separate “Complete Assessment”
  button; an FRVA or SWDI score is required before the Lock opens.
- **Approvals** — the pipeline: Phase-In (13 cases), Implementation (1), Phase-Out (0).
  Approving a case is admin-only.
- **Announcements** — 5 published (one pinned) and 2 drafts. The published ones are what the
  public saw in the prologue.
- **Programs** — the staff catalogue (19 programs). Only the admin can add, edit, or retire one.
- **Admin Panel → Users** — every account with its role and barangay. Point at the Bigte
  coordinator and at a social worker's 13 permitted barangays. Roles are assigned centrally.
- **Admin Panel → Audit Log** — the chained record of changes (nothing can be edited silently).

### 3. Social Worker — fieldwork (4 min)
**Logout** → **worker1@mswdo.test / worker123**.

- **Dashboard** — the casework home; the sidebar has no Admin Panel, no Programs.
- **General Intake** — the registration form: client details, family, household, and the
  Data Privacy Act consent checkbox. Consent is recorded at intake.
- **Daily Tracker** — the day's log.
- **Cases** — set **Barangay** to **Bigte**, then to **Poblacion**: rows come back both times.
  A field social worker is city-wide; barangay is a lens, not a wall.
- **Denial:** open the incident report `BLT-2026-0001` from a case. The persons are redacted and
  the unlock controls stay inert until a legal basis and reference number are supplied — the
  sensitive fields never reach the browser.
- **Denial:** type `/admin` in the address bar → bounced back to `/dashboard`. The menu is not the
  security; the route guard is.

### 4. Barangay Coordinator (3 min)
**Logout** → **coordinator.bigte@mswdo.test / coordinator123**.

- **Barangay Coordinator dashboard** — everything is Bigte. Two tracker cases and one pending referral.
- **Referrals** — the barangay's referral list; every row carries its **Barangay** column and all
  of them say Bigte. **New Referral** opens the referral form (fill it in, do not submit).
- **Access Cards** — verify a card by its code (e.g. `NORZ-AC-2026-0001`) or open **History** to see
  the Bigte card log. Coordinators can log an activity but cannot touch the case lifecycle.
- **Denial:** type `/cases` → bounced to the coordinator dashboard. No case workflow access at all.

### 5. Claimant — the resident's view (4 min)
**Logout** → **pedro.claimant@test.com / claimant123**.

- **My Dashboard** — his AICS case (`MSWD-2026-00001`, Bigte): status, assigned worker, services
  requested, and the **Service History** of what was actually delivered. He never sees the internal
  assessment notes or the fund source.
- **Documentary Needs** — four required documents, each with its own upload control.
- **My Documents** — the two files he has already submitted, each with a working **Download**.
- **Consent Management** — consent is active, recorded with its purpose and channel, under the
  RA 10173 notice. If the office revokes it on his record, his data stops being served.
- **My Access Card** (`NORZ-AC-2026-0001`) — the household card with its eight service entries
  across the six categories: case services, referrals, community service, seminars, payouts, compliance.
- **Denial:** type `/beneficiaries` or another person's case URL → bounced to `/my-dashboard`.

### 6. Roles, side by side (1 min)
Cut back through the four home pages: the admin carries the municipality, the social worker does the
casework, the coordinator connects one barangay, the claimant sees only his own record.

### 7. Filipino and dark mode (1 min)
Sign in as admin → avatar menu → **Language** → Filipino (the whole system switches); then back to
English. The same menu holds the light/dark toggle.

### 8. Q&A talking points
- **Consent & privacy:** consent is recorded per beneficiary (RA 10173); sensitive records are
  redacted until a legal basis is supplied, and every access is auditable.
- **Audit trail:** the audit log is hash-chained, so changes cannot be altered silently.
- **Packaging:** certificates, case study reports, SCSRs, IRFs, GIS intake sheets, access cards,
  the dedup priority list, and dashboard reports all export as PDF or Excel.
- **Partners:** RHU, WCPD, PESO, DILG, DSWD, DepEd are partner agencies; inter-agency referrals
  produce a signed endorsement letter.
- **Analytics** is a feature-flagged module and is off in this build unless the client is built with
  `VITE_ENABLE_ANALYTICS=true` — do not promise that screen.

---

## Troubleshooting during the demo

| Symptom | Fix |
|---|---|
| Page is slow to appear | First load of a route downloads its chunk; wait a second, then continue |
| "Something went wrong" screen | Click **Try Again**; if it persists, hard refresh with **Ctrl + Shift + R** |
| Wrong screen / not signed in | Avatar (top-right) → **Logout** → sign in with the correct account |
| App does not fill the whole screen | **F11**. If it still looks zoomed, **Ctrl + 0**. A narrow window switches to the phone layout — widen it |
| You see an old version | **Ctrl + Shift + R** (hard refresh) |

## Notes

- Screenshots in `docs/demo-screenshots/` were captured from an earlier database and may differ;
  trust the live site.
- The dedicated artificial capture script with camera directions and presenter notes is
  `docs/ROLE-DEMO-SCRIPT.md`.
