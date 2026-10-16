# Accounts for people with no email address and no mobile number

**Question:** how do we give a claimant-beneficiary a login when the household has no email address and no phone?

**Answer shipped:** the office issues the credentials at the counter — a short
claimant ID plus a temporary password, shown once on a printable slip, with a
forced password change at first sign-in. Implemented in intake
(`AccountProvisioningService.provision`, the `/intake` response and the
`ClaimantCredentialsDialog` slip); login accepts the ID in the same field as an
email address.

This note records the options that were considered, why this one was chosen, and
what is still missing.

---

## 1. Why this is the common case, not an edge case

The MSWDO serves walk-in claimants: elderly residents, households that share one
handset (often the barangay captain's), and people whose only contact detail is
their address. Requiring an email address or a mobile number does not produce
one — it blocks the intake. The system previously did exactly that:

* `POST /intake` rejected a claimant without contact details ("Required"), and
* `AccountProvisioningService` flagged *"Claimant has no email or phone; account
  not created"* — the person could be recorded as a beneficiary and never sign in
  to see their own case.

Both gates are now gone: contact details are optional for every person on an
intake, and the account is issued instead of delivered.

## 2. The options

| Approach | What the claimant needs | Recovery when lost | Why it was accepted or rejected here |
|---|---|---|---|
| **A. Staff-issued username + temporary password** (chosen) | Nothing but the slip. Works for a walk-in with no device of their own — they can sign in later at the office, a relative's phone, or a barangay kiosk. | The office issues new credentials after checking identity in person. The person is standing at the counter; a human already verifies them. | **Accepted.** No prerequisite infrastructure, no new dependency, and it reuses the `mustChangePassword` path that staff-provisioned accounts already use. |
| B. Phone number as the identifier (no email) | A handset, continuously. | Same number, so also the thing most likely to change. | Rejected as the *only* option: still excludes anyone without a phone, which is the population in question. Already existed for people who *do* have a number (the phone-only path uses a synthetic address). |
| C. One-time handout code → long-lived device session | A device, once. | The office issues a new code. | Rejected for now: it removes the password but binds the account to a device the household may not own; the token must be stored and revoked, and a shared phone silently becomes a shared account. Worth revisiting as an *addition* on top of A (a "sign in with a code" kiosk flow). |
| D. QR onboarding (scan → device-bound passkey) | A phone with a camera, and a modern browser. | New QR at the office. | Rejected: assumes a smartphone per claimant, which is precisely what many do not have. Pattern reference: QRAuth-style QR + passkeys + device trust exists for exactly this flow, but the prerequisite is the blocker. |
| E. Staff-only access (the worker shows the case) | Nothing at all. | n/a | Rejected as the whole answer, kept as the fallback: the claimant never gets their own access, cannot see their case, and every question costs a trip to the office. |
| F. Access-card code + PIN | The card they already receive. | New card / new PIN at the office. | Rejected *for now, attractive later*: the office already hands out a household access card with a code, so it is a natural identifier. It was not chosen because the card belongs to the **household**, while the account belongs to the **claimant** (who may represent up to two beneficiaries), and the existing card flow is a lookup, not an authentication path. A future option is to accept the card code *as an additional username*. |

Pattern sources consulted (kept because they document the mechanics rather than
marketing): Auth0's support note on creating users with **username + password
instead of email + password** (the account model this implementation mirrors),
the IFRC **DIGID** set-up guide (beneficiaries creating and using a digital
identity wallet, including assisted enrolment), and the **QRAuth** project (QR +
passkey + device trust) as the reference for option D. Broader searches for
World Bank ID4D / GovStack guidance returned nothing usable in this session —
the search quota was exhausted — so the choice above is driven by the local
constraints in §1 and by what the codebase already provides, not by copying a
specific programme's design.

## 3. What was built

* `users.username` (unique when set) — `CLM-000123`, from a database sequence.
  The ID is global, not per-year: it identifies a person, and a person does not
  reset with the calendar.
* `users.email` stays `NOT NULL UNIQUE` with an unusable synthetic address
  (`claimant-clm-000123@claimant.kapwa.local`). Keeping the constraint means
  every existing query, index and lookup is untouched; the pattern was already
  in use for phone-only claimants.
* Temporary password: 8 characters from an alphabet with **no confusable
  characters** (`0/O`, `1/I/L`, `5/S` are absent) so it survives being read
  aloud across a counter.
* `must_change_password = true` — the client already forces a password change
  before any other route is reachable, and `changePassword` clears the flag.
* The credentials are returned **once**, in the intake response, for the slip.
  They are never logged (the audit entry records the username only) and never
  returned again.
* Recovery: `mustChangePassword` + the office's in-person re-issuance. The
  slip says so.

## 4. Trade-offs the office should know

* **Claimant IDs are sequential and therefore guessable.** They are identifiers,
  not secrets — the same property as an email address. The password is the
  secret, logins are rate-limited (5–10/minute on the auth routes), and the
  account is forced to change the password on first use.
* **No email verification is possible** for these accounts, so `emailVerified` is
  set true and the synthetic address can never receive mail. A password reset by
  email is therefore meaningless for them — see below.
* **Nothing reaches the household electronically.** Reminders, consent
  notifications and other client-facing messages already fall back to the
  assigned worker rather than failing, and that remains the case.

## 5. What is still missing (deliberate next step)

**Re-issuing credentials for an office-issued account.** Today, if a claimant
forgets the password they were handed (or changes it and forgets the new one),
the office has no button for it: the existing "issue password reset" flow emails
a link to the synthetic address, which nobody can read. The follow-up is a staff
action on the beneficiary/claimant record — "issue new sign-in details" — that
generates a fresh temporary password, sets `mustChangePassword` and shows it once
on the same slip. Until that exists, the workaround is an administrator reset via
the users screen.

Related follow-ups, in the order they would help most:

1. Accept the household **access-card code** as an additional username (§2, F).
2. A kiosk mode: the claimant signs in at the barangay hall to view their case
   without owning a device (§2, C).
3. Optional "no-contact" flag on the household so reports can count how many
   families are unreachable electronically — an official statistic worth having.
