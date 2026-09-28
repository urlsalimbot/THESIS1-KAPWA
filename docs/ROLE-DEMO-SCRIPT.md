# KAPWA — Role Capabilities Demo: Production Script

A shooting script for the **role capabilities** video. Four chapters, one per role:
MSWDO Admin, Social Worker, Barangay Coordinator, Claimant.

Every shot names what is on screen, what the presenter does, and the words to say.
Read the **VO** column aloud or paraphrase it — it is written to be spoken.

**Companion documents — do not re-shoot from these, they are the source material:**

| Document | What it holds |
|---|---|
| `docs/ROLE-MATRIX.md` | The full seven-role functional matrix and overlap analysis |
| `docs/demo-guide.md` | A prose walkthrough of all seven roles, 20-minute format |
| `docs/demo-screenshots/` | 25+ already-captured stills, useful as shot references |

This script covers only the four operational roles, and adds four things the other
documents do not have: shot numbers, on-camera denial beats, the claim/evidence pairing
for every capability claim made on camera, and **presenter notes that flag beats which
cannot be filmed honestly from the UI** — so nothing gets staged to make a point.

---

## 0. Pre-flight

Do all of this **before** the camera is rolling. Every item has bitten a take before.

### 0.1 Environment

- [ ] **Record against a copy, never the data you care about.** This film *writes* — it
      creates beneficiaries, saves interventions, sends referrals. Use a scratch database
      (`kapwa_demo`), not your working tree.
- [ ] Boot Postgres, then from `kapwa-server/`: `npm run migrate` → `npm run seed` →
      `npm run seed:demo`. `seed:demo` drives the **real** HTTP API, so hash chains and audit
      trails stay valid and every screen you film is genuine.
- [ ] `npm run start:dev` (API, port 3000) and `npm run dev` in `kapwa-client/` (port 3001,
      proxies `/api` to 3000). Use whichever URL the demo is served on.
- [ ] Chrome, **F11 full screen**, **Ctrl+0** to reset zoom. Confirm no browser DevTools
      open and no notification toast will land mid-take.

### 0.2 Cast

Write these on a card for the presenter. `seed-accounts.ts` is the source of truth.

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@mswdo.test` | `admin123` | `/admin` |
| Social Worker | `worker1@mswdo.test` | `worker123` | `/dashboard` |
| Barangay Coordinator | `coordinator.bigte@mswdo.test` | `coordinator123` | `/coordinator/dashboard` |
| Claimant | `pedro.claimant@test.com` | `claimant123` | `/my-dashboard` |

**Use the Bigte coordinator, not any other.** The demo claimant — Pedro Reyes — lives in
Bigte. The story that the barangay that referred him can still see him is the strongest
narrative thread in the film, and it only works if both sides are Bigte.

### 0.3 Three traps that will end a take

1. **There is no Analytics beat by default.** Analytics is behind a feature
   toggle, off unless you build with `VITE_ENABLE_ANALYTICS=true`
   (`kapwa-client/src/lib/feature-flags.ts`). Either set it before filming or cut the
   optional analytics beat in Appendix B. Do not promise a screen that will not load.
2. **Social workers are city-wide; do not film them as barangay-scoped.** MSWDO field
   staff are in scope for every barangay and hold no single primary assignment. The
   social worker can filter the Cases list by *any* barangay and get rows. The one case
   he cannot open is a **restricted** record without a legal basis — that is shot **2.9**,
   and it now renders a visible refusal banner rather than an empty table.
3. **Do not film the admin device wipe.** `POST /admin/wipe/device/:deviceId` is real and
   irreversible: it bumps the user's `tokenVersion` and clears their bound device, forcing
   re-authentication. The Admin Panel has a wipe screen. Keep it closed. There is no honest
   way to show it without a re-seed. (The per-user wipe, `POST /admin/wipe/user/:userId`,
   has been removed from the system.)

### 0.4 Craft notes that separate a demo from a fake

- **Move the mouse slowly and deliberately to every target before clicking.** A click
  with no visible cursor reads as the UI changing by itself, and viewers discount the
  whole take. Pause on the element, then click.
- **Type at roughly human pace** — about 55 ms per character, longer after punctuation.
  Instant text appearing reads as a scripted fake even when the app is real.
- **Hold every beat longer than 1.5 seconds.** Any state change you want the viewer to
  register has to sit still long enough to be seen and understood.
- **Do not cut away during a load.** Lazy-loaded routes show a "Loading…" frame; let it
  resolve on camera rather than cutting.
- **If a beat cannot be shown for real, cut it and say why.** A movie that quietly fakes
  one beat is worthless as evidence for every other beat.

---

## 1. Prologue — the public face (0:00–0:45)

**Purpose:** establish that this is a real LGU system before any role-specific material.

| # | On screen | Presenter action | VO |
|---|---|---|---|
| P.1 | Landing page | Hold on the hero. Do not scroll yet. | "This is KAPWA — the social welfare management system of MSWDO Norzagaray. One system for intake, case management, approvals, partner agencies, and public transparency." |
| P.2 | Public programs list | Click **Programs** in the public nav. | "Anyone can browse the programs MSWDO offers, and the public announcements, with no account at all." |
| P.3 | Public announcement | Click a published announcement. | "These are published to residents. The same list that staff manage is what the public reads — that is shot 1.11." |
| P.4 | Login page | Click **Sign In**. | "Now we will look at the same system from the four roles that operate it. Each one sees a different system." |

---

## 2. Chapter 1 — MSWDO Admin (0:45–6:00)

**Who this is:** Rosario G. Mendoza, MSWDO office head. The only role with no scope limits.

**The one claim this chapter must prove:** *the admin sees all 13 barangays and is the
only role that can approve, issue documents, and manage accounts.*

**Script:**

| # | On screen | Presenter action | VO |
|---|---|---|---|
| 1.1 | Login as `admin@mswdo.test` | Type credentials at human pace. | "Rosario is the MSWDO office head. Her account is not scoped to any barangay — she carries the whole municipality." |
| 1.2 | **Admin Panel** — lands here automatically | Let the redirect land before speaking. | "Note where we landed. Every role is thrown to its own home page on sign-in. For Rosario, that is the admin panel." |
| 1.3 | Admin Panel → **Users** | Open the users list. | "Here are every account in the system — social workers, coordinators, partner agencies, and claimants." |
| 1.4 | User edit drawer → **Role** | Open one user, point at the role field. | "Roles are assigned centrally. A person cannot promote themselves; an admin assigns the role." |
| 1.5 | User edit → **Assigned Barangay** / **Permitted Barangays** | Point at both fields on a coordinator, then on a social worker. | "These two fields are where scope comes from. The coordinator has one barangay assigned — that single value is what limits her. The social worker has all thirteen permitted, because the MSWDO office works municipality-wide and a field officer has to be able to follow a resident into any barangay." |
| 1.6 | **Dashboard** | Click Dashboard in the sidebar. | "The office's morning view: served today, totals, and recent cases across the whole municipality." |
| 1.7 | Dashboard → cases table | Hover a row, show the **barangay** column. | "Note the barangay column. The demo data covers six barangays, and Rosario sees all of them in one list — the office works municipality-wide, not barangay by barangay. Hold that thought; the coordinator chapter is the contrast." |
| 1.8 | **Cases** → open *Pedro Reyes* | Click View on the active Indigent case from Bigte. | "This is a case file. It moves through a guided workflow — assessment, interventions, service delivery, transition, closure." |
| 1.9 | Case → **Service Delivery** | Show the intervention record. | "Every service delivered is recorded here with date, amount, mode, and fund source. This is the audit trail." |
| 1.10 | **Approvals** | Open the approvals pipeline. | "Cases waiting on an office decision. Approving a case is admin-only — the social worker can request review, but cannot approve." |
| 1.11 | **Announcements** | Open Announcements, show published + draft. | "Staff write the announcements. Rosario publishes them; that is what the public saw in shot P.3." |
| 1.12 | **Admin Panel** → Programs | Open Programs. | "The program catalogue has two tiers. This management view is staff-only — the admin and social workers — and only the admin can add, edit, or retire a program. The public list we saw in shot P.2 is a separate, deliberately narrower view." |
| 1.13 | **SETUP: confirm the Bigte coordinator's assignment** | Edit `coordinator.bigte@mswdo.test`, show **Assigned Barangay = Bigte**, save without changing it. | "Before we leave — this is the one assignment that carries the whole next chapter. The Bigte coordinator is scoped to exactly one barangay. Every list she opens will be narrowed to Bigte, and I will prove that on the data, not just the menu." |

**Do not film:** the wipe screen under any circumstances. Close the tab if it opens.

---

## 3. Chapter 2 — Social Worker (6:00–11:00)

**Who this is:** Juan Dela Cruz, field social worker, MSWDO city-wide.

**The one claim this chapter must prove:** *the social worker does the casework — intake,
assessment, interventions — and can request review but cannot approve. He works across the
whole municipality, so barangay is a filter he chooses rather than a limit imposed on him;
what restricts him is the sensitivity of the record, not its location.*

**Script:**

| # | On screen | Presenter action | VO |
|---|---|---|---|
| 2.1 | Logout → login `worker1@mswdo.test` | Avatar → Logout → sign in. | "Now Juan, a field social worker. He and the admin do the actual casework — they are the only roles that create and progress a case." |
| 2.2 | **Dashboard** | Let it land. Point at the sidebar. | "His home is the casework dashboard. Compare the sidebar with Rosario's: no Admin Panel, no Programs, no Analytics." |
| 2.3 | Sidebar, slow pan | Pause on the missing Admin group. | "That absence is the role model working. Those are not hidden buttons — the routes themselves reject his role and bounce him to his own home." |
| 2.4 | **General Intake** | Open the intake form. | "This is where a new resident is registered — client details, family, household, and a consent checkbox under the Data Privacy Act." |
| 2.5 | Intake → consent checkbox | Click the consent checkbox. | "Consent is recorded at the moment of intake and is tracked in a consent ledger. It can be revoked later, and revocation immediately blocks the beneficiary's data." |
| 2.6 | **Daily Tracker** | Open the tracker. | "The day's log — the worker's record of what was handled." |
| 2.7 | **Cases** list | Open Cases. | "Here is something worth being precise about. Juan is a city-wide MSWDO officer, so his case list is not narrowed to one barangay. He is in scope for all thirteen, the way the office actually works." |
| 2.8 | Cases → **barangay filter** → Bigte, then **San Lorenzo** | Set the filter to **Bigte**, then to **San Lorenzo**. Both return rows. | "Barangay is a lens he chooses, not a wall around him. Bigte, San Lorenzo, any of them — the records come back, because a field worker has to be able to follow a resident wherever they live." |
| 2.9 | **DENIAL: a restricted record** | Open a record marked restricted without passing a legal basis. The **red refusal banner** appears under the topbar. | "What does restrict him is not geography — it is the sensitivity of the record. This one is restricted, and it needs a legal basis to open. The system tells him so, in words, on the screen. It does not just hand him an empty page and let him wonder." |
| 2.10 | Case → **Request review** | Open a case, find the review control. | "Here is where admin and social worker genuinely diverge. Sending a case *up* for review is the social worker's move alone — not even the admin can do this one. The two roles are not a seniority ladder; they are different halves of the same workflow." |
| 2.11 | **DENIAL: the approval is missing** | Point at where approval would be; it is not there for him. | "But he cannot *approve*. The approve control is absent, and the endpoint behind it rejects his role even if he reaches it by URL. No social worker can sign off their own case." |
| 2.12 | **DENIAL: try an admin URL** | Type `/admin` into the address bar and press Enter. | "Let me prove the route guard is real and not just a hidden menu. I am typing the admin address directly." |
| 2.13 | Bounced back to `/dashboard` | Hold the redirected page still. | "It bounces me straight back to my own dashboard. The menu was never the security — the guard is." |

**Beat 2.13 is the most important ten seconds in the film.** It is the difference between
"the menu was tidy" and "the system enforces roles." Hold the redirected page for a
count of three after the VO finishes.

> **Presenter note for 2.7–2.9.** Do not claim the social worker is confined to one
> barangay. He is not, and that is by design: MSWDO field staff are city-wide, so
> `seed-accounts.ts` gives every social worker all thirteen barangays as permitted scope and
> the guard's social-worker branch no longer denies on geography at all. If someone asks
> "so can a social worker open a case from any barangay?", the honest answer is **yes**,
> and that is the correct answer for a municipal office.
>
> The contrast with the coordinator in Chapter 3 is the point worth drawing out: the
> coordinator branch *does* inject the assigned barangay when none is supplied
> (`abac.guard.ts`, coordinator branch), which is why beat 3.11 shows a single barangay in
> every row. Two roles, two different scoping models, both deliberate.
>
> **2.9 is now a real on-screen denial, not an ambiguous empty table.** The guard throws a
> `ForbiddenException` carrying its reason, the API client broadcasts any 403 on
> `kapwa:access:denied`, and `AccessDeniedBanner` renders it as a persistent red strip under
> the topbar with a dismiss button. Say the sentence "access denied" in the VO and hold on
> the banner — a viewer who sees the words knows the refusal is enforced, not a loading
> failure.
>
> **Pick the restricted record before you film.** Which routes carry
> `@ResourceSensitivity('restricted')` is a one-line grep; confirm the chosen record
> actually returns 403 without a `legalBasis` parameter before the shoot, or you will be
> standing in front of a page that loads fine.

---

## 4. Chapter 3 — Barangay Coordinator (11:00–14:30)

**Who this is:** the Bigte barangay coordinator.

**The one claim this chapter must prove:** *the coordinator is a partner role, scoped to
one barangay. It can refer residents in and read its own area, and can touch nothing
inside the case lifecycle.*

**Script:**

| # | On screen | Presenter action | VO |
|---|---|---|---|
| 3.1 | Logout → login `coordinator.bigte@mswdo.test` | Sign in. | "This is the barangay coordinator of Bigte. The barangay is the LGU's smallest unit, and this account is locked to Bigte alone." |
| 3.2 | **Barangay Coordinator** dashboard | Let it land. | "The landing page is completely different. This is a scoped view of one barangay, not the municipal dashboard." |
| 3.3 | Dashboard — scope indicators | Point at the barangay name on the widgets. | "Everything here is Bigte. The six barangays the admin was just looking at collapse to the one I am assigned." |
| 3.4 | **Referrals** → New | Open the referral form. | "The coordinator's main job is referrals — identifying a resident in need and referring them to MSWDO." |
| 3.5 | Referral form | Fill it in at human pace; **do not submit**. | "They describe the client's situation and send it to the office. It is a referral *in*, which is the opposite direction from the inter-agency referrals MSWDO sends out." |
| 3.6 | **Access Cards** | Open the access cards view; glance at the **Barangay** column but do not dwell. | "Coordinators can also see and log activity on the household access cards for their barangay. Notice this table has a barangay column too — I will come back to that." |
| 3.7 | **Announcements** | Open Announcements. | "Coordinators can write announcements for their own barangay — they are a communication channel, not just a referral form." |
| 3.8 | **DENIAL: try the cases list** | Type `/cases` into the address bar. | "Now, what a coordinator cannot do. Cases are the heart of the system. Let me try to open them." |
| 3.9 | Bounced to `/coordinator/dashboard` | Hold. | "Bounced back. The coordinator has no case lifecycle access at all — no intake, no assessment, no approval, no interventions." |
| 3.10 | **Referrals** list | Reopen Referrals; point at the **Barangay** column. | "Now the scoping, which the menu cannot show you. Every list a coordinator opens carries a barangay column." |
| 3.11 | Same column — every row | Hold on the column, then compare back to shot 1.7. | "Every row says Bigte. The admin's list in shot 1.7 had six barangays in it. Same table, same system — but my data is scoped to one barangay, not just my navigation." |

**Beat 3.11 is what separates a scoped role from a filtered list.** The nav was already
different in 3.2; this proves the *data* is scoped too.

> **Presenter note — do not stage this one.** The obvious proof, typing a foreign
> barangay into the URL (`/beneficiaries?barangay=Poblacion`), is **not** filmable from
> the UI: `/beneficiaries` is not in the coordinator's route table at all, so the browser
> bounces to the dashboard exactly as in 3.9 and the two beats look identical. The guard
> does enforce the barangay match at the API layer (`abac.guard.ts:50-58`) — the
> coordinator branch rejects any `barangay` that is not their assignment — but there is no
> screen that lets you drive it by hand. Beats 3.10 and 3.11 show the same enforcement
> honestly, through the data. If you want the URL-level proof on camera, it has to be a
> separate cut made in a terminal or Postman, labelled as such.

---

## 5. Chapter 4 — Claimant / Claimant-Beneficiary (14:30–18:30)

**Who this is:** Pedro P. Reyes — a tricycle driver in Bigte, an active Indigent case, and
in the demo he is also his own claimant, so the beneficiary and the account are the same
person. `seed-demo.ts` links them three ways, which is why this dashboard has real data.

**The one claim this chapter must prove:** *the claimant sees their own record and nothing
else — their cases, their card, their documents, their consent. No other resident's data
is reachable at all.*

**Script:**

| # | On screen | Presenter action | VO |
|---|---|---|---|
| 4.1 | Logout → login `pedro.claimant@test.com` | Sign in. | "Finally, the person at the centre of all of this. Pedro Reyes is a tricycle driver in Bigte. He is a beneficiary of the program, and in this account he is also his own claimant — so this is the same person as the case we opened in shot 1.8." |
| 4.2 | **My Dashboard** | Let it land. | "This is his dashboard. Everything on it is his." |
| 4.3 | Dashboard — case status | Point at his case. | "He can see where his own case stands. He is never shown the internal assessment notes, the intervention record, or the fund source." |
| 4.4 | **My Access Card** | Open it. | "His household access card, with the services rendered to his family over the year." |
| 4.5 | Access card — service ledger | Scroll the six-category ledger slowly. | "Every service is logged against his card — case services, referrals, community services, seminars, payouts, and compliance. It is his record, in his hands." |
| 4.6 | **Required documents** | Open the requirements section. | "Where MSWDO needs a document from him, he uploads it. He is not a passive recipient; he completes his part of the case." |
| 4.7 | **Consent** | Open his consent record. | "He can see his consent status and grant it himself. Consent is his to give and his to withdraw." |
| 4.8 | **DENIAL: try the beneficiaries list** | Type `/beneficiaries` into the address bar. | "Now the most important limit of all. That was the master list of every resident MSWDO serves. Let me try to open it." |
| 4.9 | Bounced to `/my-dashboard` | Hold it still. | "Bounced straight back to my own dashboard." |
| 4.10 | Address bar — someone else's case | **Before this take**, copy a case URL from the address bar during shot 1.8 and paste it into the Presenter's note app. Paste it here and press Enter. | "And I cannot reach another person's record by typing their identifier, either. Every claimant action on this system is scoped to the beneficiary he represents." |
| 4.11 | **The consent ledger closes the loop** | Return to his consent screen. | "This is the control that makes it real: if consent is revoked, his own data stops being served to him immediately. The system is built so that a resident's data follows the resident's consent." |

**Beat 4.11 is the emotional and technical climax.** It ties the Data Privacy Act theme
from shot 2.5 back to the person it protects.

> **Presenter note for 4.8–4.10.** All three land on the same result: a bounce back to
> `/my-dashboard`. That is correct and it is the point — the claimant has eight routes
> total, and none of them is a list of other people. Do not go looking for a visible
> "Access Denied" message; there is not one, because the claimant never gets far enough to
> be refused. The three beats are the same proof at three levels of specificity: the route
> is absent, the page is absent, the record is absent.

---

## 6. Closing (18:30–20:00)

| # | On screen | Presenter action | VO |
|---|---|---|---|
| 6.1 | Side-by-side of the four dashboards | Cut between the four home pages. | "Four roles. One system. The admin carries the whole municipality. The social worker does the casework within his assignment. The coordinator connects his barangay to the office. The claimant sees his own record and nothing else." |
| 6.2 | Hold on the landing page | Return to the public page. | "And all of it sits behind public transparency — the programs and announcements are open to every resident, account or not. KAPWA is MSWDO Norzagaray's social welfare management system." |

---

## Appendix A — Capability claims and their on-camera evidence

Every capability asserted in the film, with the shot that proves it. If a shot is missing
from a recording, the claim is unsupported.

| Claim | Proved by | Enforced in code at |
|---|---|---|
| Admin works municipality-wide, not barangay by barangay | 1.7 | `abac.guard.ts:24` — admin returns `true` unconditionally |
| Only admin approves a case | 2.11 | `cases.controller.ts:139-140` — `PATCH /cases/:id/approve`, `@Roles('admin')` |
| Only admin issues COE / PCV | — | `cases.controller.ts:145-152` — both `@Roles('admin')` |
| Program catalogue is tiered: staff read, admin writes | 1.12 | `programs.controller.ts` — `GET` admin+social_worker, `POST`/`PATCH`/`DELETE` admin; public list is a separate controller |
| Social worker does intake and casework | 2.4, 2.7 | `intake.controller.ts`, `cases.controller.ts` — admin + social_worker |
| Social worker can request review, not approve | 2.10, 2.11 | `cases.controller.ts:157-158` — `request-review` is social_worker **only** |
| Social workers are scoped to the whole municipality | 2.7, 2.8 | `abac.guard.ts` social-worker branch — no geographic denial; `seed-accounts.ts` seeds all 13 barangays as permitted |
| Restricted data needs a legal basis | 2.9 | `abac.guard.ts` — `restricted` sensitivity requires `legalBasis`, else `ForbiddenException` |
| A refusal is visible, not a silent empty list | 2.9 | `api.ts` broadcasts 403 on `kapwa:access:denied`; `AccessDeniedBanner` renders it persistently |
| Routes reject the wrong role, not just the menu | 2.12, 2.13, 3.8, 4.8 | `ProtectedRoute.tsx:26` — redirect on role mismatch |
| Coordinator has no case lifecycle access | 3.8, 3.9 | `routes.tsx` — no `/cases` route for `coordinator` |
| Coordinator's lists are auto-scoped to one barangay | 3.10, 3.11 | `abac.guard.ts:62-64` — guard injects the assigned barangay when none is supplied |
| Coordinator cannot read another barangay | 3.11 | `abac.guard.ts:57-61` — an explicit `barangay` must equal the assignment |
| Claimant sees only their own record | 4.8, 4.9, 4.10 | `routes.tsx:147-168` — claimant gets 8 routes, all self-scoped |
| Revoked consent immediately blocks access | 4.11 | `abac.guard.ts:31-39` and `:90-103` — consent ledger check |

## Appendix B — Optional beats

Cut these for time. Each is real, none is load-bearing.

- **Analytics** — real and gated to admin + social worker, but **behind a feature flag,
  off by default**. Set `VITE_ENABLE_ANALYTICS=true` before filming or skip.
- **Chat and notifications** — available to all four roles (`role-access.ts`). A two-shot
  exchange between the admin and the claimant is a good human beat for the closing.
- **Claimant MFA** — `ana.claimant@test.com` has TOTP enabled with a known secret
  (`seed-accounts.ts:181`). A login beat that shows two-factor authentication is a strong
  trust signal if you have the authenticator app set up in advance.
- **Inter-agency referral** — MSWDO referring a beneficiary *out* to a partner agency. The
  mirror image of shot 3.5, and the clearest illustration of why coordinator and agency
  roles exist as a pair.
- **Dark mode and Filipino** — one toggle in the avatar menu each. Cheap, and it shows the
  system was built for the actual users.

## Appendix C — Total

- 4 chapters, 54 shots, ~20 minutes
- 5 distinct denial proofs — the part of the film that makes it evidence rather than marketing
- Every capability claim traceable to a file and line
- Presenter notes flagging what **cannot** be filmed honestly from the UI, and what to
  confirm before the shoot, so nothing gets staged or oversold
- Every denial in this script now renders as a visible, worded refusal on screen — no beat
  relies on a viewer inferring "access refused" from an empty table
