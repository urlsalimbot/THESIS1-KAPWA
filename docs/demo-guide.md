# KAPWA Demo Guide — MSWDO Norzagaray Social Welfare System

> For presenters and stakeholders. Plain language, no technical jargon.
> Everything here can be shown on one screen at **http://localhost:8080** (Google Chrome recommended).

---

## Before you start (checklist)

- [ ] The computer is on and Chrome is installed
- [ ] Open **http://localhost:8080** — you should see the KAPWA welcome page
- [ ] If the page says "connection is not secure" or won't open: type the address with **http://** (not https) and press Enter
- [ ] Use the sample accounts below to sign in. Each role sees only what that role is allowed to see.
- [ ] **Full screen:** press **F11** so the app fills the whole screen; if text looks too big/small, press **Ctrl + 0** to reset the browser zoom

## Sample accounts

| Role | Who this represents | Email | Password |
|---|---|---|---|
| **Admin** | MSWDO Office Head | admin@mswdo.test | admin123 |
| **Social Worker** | Field social worker | worker1@mswdo.test | worker123 |
| **Barangay Coordinator** | Barangay representative | coordinator.bigte@mswdo.test | coordinator123 |
| **Agency Staff** | RHU / partner agency | rhu.staff@norzagaray.test | rhu123 |
| **Claimant** | Resident beneficiary | pedro.claimant@test.com | claimant123 |
| **Mayor** | Mayor's Office | mayor@mswdo.test | mayor123 |
| **Auditor** | Internal auditor | auditor@mswdo.test | auditor123 |

Tip: write these on a board or hand out a printed card. To switch roles, click your avatar (top-right) → **Logout** → sign in again.

---

## Suggested 20-minute demo flow

### 1. Welcome (1 min)
Landing page → click **Sign In**. Explain: *"KAPWA is the social welfare system of MSWDO Norzagaray — one system for intake, case management, approvals, agencies, and transparency."*

### 2. Admin — the big picture (4 min)
Sign in as **admin@mswdo.test / admin123**.

- **Dashboard** — "Served Today", totals, and the recent-cases table. This is the office's morning view.
- **Cases** (sidebar) — the case list: notice each case shows surname, first name, gender, age group, barangay, status. Click **View** on *Juan Dela Cruz*.
  - **Case detail** — the heart of the system: the case goes through a guided 5-step workflow: *Assessment → Implement HIP → Service Delivery → Transition → Closure*.
  - Click **Service Delivery** — show the *Inter-Agency Referrals* section: MSWDO can refer a beneficiary to a partner agency right from the case file.
- **Beneficiaries** — the master list of residents served (7 sample records with age and household).
- **Approvals** — the pipeline: cases waiting for review, active cases, transitioning cases. Click **Select Mode** to show bulk tools.
- **Announcements** — the published schedule for August 2026 (click through to the public page to show residents' view).

### 3. Social Worker — fieldwork (3 min)
**Logout** → sign in as **worker1@mswdo.test / worker123**.

- **General Intake** — the registration form: client details + consent checkbox (Data Privacy Act). This is where a new resident is registered.
- Note the worker does **not** see Admin Panel or Programs — role-based access.
- **Daily Tracker** — the day's log with "Total Cases" counter.

### 4. Barangay Coordinator (2 min)
**Logout** → **coordinator.bigte@mswdo.test / coordinator123**.

- **Barangay Coordinator dashboard** — what the barangay sees for its own area.
- **Referrals** and **Access Cards** — the coordinator's tools.

### 5. Agency Staff — the partner-agency view (3 min)
**Logout** → **rhu.staff@norzagaray.test / rhu123**.

- **Inter-Agency Referrals** — the referral from MSWDO for *Pedro Ramos* (Medical follow-up) is waiting here. This is the cross-agency handoff working end-to-end.
- **Card Activities** — scanning and logging a beneficiary's access card.
- **Agency Profile** — the RHU's own page.

### 6. Claimant — the resident's view (2 min)
**Logout** → **pedro.claimant@test.com / claimant123**.

- **My Dashboard** — what the resident sees about their own record.
- **My Access Card** — the digital access card.

### 7. Mayor & Auditor — transparency (2 min)
- **Logout** → **mayor@mswdo.test / mayor123** → **Reports** — the Mayor's Office view (aggregate numbers only, no personal data).
- **Logout** → **auditor@mswdo.test / auditor123** → **Audit Logs** — tamper-proof record: every change is chained (hash-chain verification), so nothing can be altered silently.

### 8. Filipino language — closing wow (1 min)
Sign in as admin → **Settings** → **Language Preference** → choose **Filipino**. The whole system switches instantly. Switch back to English.

### 9. Q&A talking points
- **Offline-first:** field workers can log interventions offline; the phone/tablet syncs when back online (sync queue in the top bar).
- **Consent & privacy:** consent is recorded per beneficiary (RA 10173); personal data is masked by default and unmasking requires a logged justification.
- **DSWD-aligned:** the case workflow follows the KILOS UNLAD phases; certificates (Indigency, Eligibility, Referral) generate one-click PDFs.
- **Agencies:** RHU, WCPD, PESO, DILG, DSWD, DepEd are partner agencies in the system.

---

## Troubleshooting during the demo

| Symptom | Fix |
|---|---|
| Page won't open | Use `http://localhost:8080` (not https); check the server computer is on |
| "Something went wrong" screen | Click **Try Again**; if it persists, ask the technical person to check the service |
| Wrong screen / not signed in | Click avatar (top-right) → **Logout** → sign in with the correct account |
| Browser shows warnings | Chrome may warn about the test server — click **Advanced → Proceed** |
| App does not fill the whole screen | Press **F11** (fullscreen). If it still looks zoomed, press **Ctrl + 0** (reset zoom). A narrow window switches the app to its phone layout — widen the window to bring back the side menu |
| You see an old version of the app | Press **Ctrl + Shift + R** (hard refresh) |

## Screenshots

Full-size screenshots of every screen in this guide are in `docs/demo-screenshots/` (e.g. `demo-admin-dashboard.png`, `demo-agency-referrals.png`).
