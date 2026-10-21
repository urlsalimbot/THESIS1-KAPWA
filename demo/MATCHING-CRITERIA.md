# Client Deduplication — matching criteria

Defines exactly how **Client Deduplication** decides that an imported row matches
a person already in KAPWA, or another row in the same file. Everything below is
taken from the running code; file and function names are listed at the end.

## 1. What the import provides

| Baseline column | Used for |
|---|---|
| Last Name | name similarity (0.50) |
| First Name | name similarity (0.50) |
| Middle Name | exact match (0.05) |
| Birthday | exact date match (0.25) |
| Barangay | exact text match (0.10) |
| Remarks | carried into the record; not scored |

The optional **declared extra fields** can add phone, email or PhilSys as an
identifier (0.10, see below). The six baseline columns alone are enough to
clear the threshold — that is why the exported barangay list works with no
extra mapping.

Rows missing a last name, first name or birthday are rejected at upload; dates
are normalised to `YYYY-MM-DD` and read as text, never as Excel serials.

## 2. Normalisation

- Text fields are compared as `trim().toLowerCase()` — no accent folding, no
  punctuation stripping.
- Birthdays must be the **same calendar date**; there is no "close enough" date.
- Barangay is compared as text; `FVR` and `Friendship Village Resources (FVR)`
  are different values.
- Phone numbers are reduced to their trailing ten digits; email and PhilSys are
  lowercased.

## 3. Candidate gate (who is even compared)

Before scoring, the database is asked for persons whose name is broadly similar:

```sql
WHERE similarity(p.surname, $lastName) > 0.3
   OR similarity(p.first_name, $firstName) > 0.3
ORDER BY similarity(surname) + similarity(first_name) DESC
LIMIT 30
```

- The gate uses PostgreSQL **pg_trgm** (`similarity`), a different metric from
  the scorer below. A row whose name is completely unlike an existing client is
  never compared, even if birthday or phone would agree.
- Only the 30 most name-similar people are returned. On a very common name this
  limit can hide a lower-ranked candidate.

## 4. The score

For every row/candidate pair:

| Signal | Definition | Weight |
|---|---|---|
| Name | average of surname and first-name similarity (cosine over character trigrams, lowercased, padded) | **0.50** |
| Birthday | exact `YYYY-MM-DD` equality | **0.25** |
| Barangay | exact normalised equality | **0.10** |
| Middle name | exact normalised equality | **0.05** |
| Identifier | any one of phone / email / PhilSys equals the record's | **0.10** |
| Household served | a member of the matched household already has an intervention | **+0.10** |

```
score = 0.50 · (simSurname + simFirstName)/2
      + 0.25 · birthdayMatch
      + 0.10 · barangayMatch
      + 0.05 · middleNameMatch
      + 0.10 · (phoneMatch ∨ emailMatch ∨ philsysMatch)
      + 0.10 · householdServed          (household candidates only)
```

The result is clamped to `[0, 1]`. A pair is a **candidate match** when
`score ≥ threshold`.

- **Default threshold: 0.75.** It is stored per run (`match_threshold`,
  `numeric(4,3)`) and the API accepts 0–1, but the current New-run screen does
  not expose it — every UI-created run uses **0.75**.
- A row keeps at most its **three highest-scoring candidates**, sorted
  descending. A row with no candidate at or above the threshold is `no_match`.

With the plain weights above, the threshold can be reached on name + birthday +
barangay alone (0.85) — the minimal profile of a barangay list that carries no
phone or email.

## 5. Order of the sweep

1. **Duplicates inside the file, first.** Each row is compared only against the
   **earlier** rows of the same file. If any earlier row reaches the threshold,
   the row is a duplicate and is **not** compared to the database at all. The
   earlier row carries the identity; the later row is set aside by a reviewer
   decision (it creates no client). This ordering is deliberate: it is what
   prevents a duplicate pair from also matching the database and producing two
   records.
2. **Database sweep.** Only rows that are not duplicates are compared to
   persons, using the gate and score above.
3. **Household sweep.** For matched persons, their households are offered as
   candidates **only when someone in the household has already been served**
   (has at least one intervention). The score is the best member match **+0.10**,
   and the candidate appears only if it still reaches the threshold. Its purpose
   is to surface "this person's household is already a client".

## 6. Decisions and what finalize does

| Candidate type | Decision | Effect at finalize |
|---|---|---|
| Duplicate row (`import_row`) | choose which row survives | surviving row proceeds; the other is **deprioritized** (no client created) |
| Existing person (`db_person`) | **same person** → keep / deprioritize | the existing record is **updated** (interventions attach to it); deprioritize moves the row to the bottom of the priority list and requires a remark |
| Existing person | **different person** | the match is removed and the row is imported as a **new client** |
| Household | same person / different | as above; the match exists to warn that the household is already served |

Finalize **creates** clients for matched-as-new and no-match rows, **updates**
records for same-person rows, and **never creates a second record** for rows set
aside as duplicates. When a same-person row carries a barangay that differs from
the stored current address, the address is updated and counted as a
`barangayUpdate` (remark: "Barangay updated to …"). The priority list
(`CD-YYYY-MMM-NNN.xlsx`) sorts deprioritized rows last.

## 7. Worked examples — the 80-row demo file

Both production and this workbook keep a middle name as a **full name or
blank**; no initials.

| Rows | Signals | Score | Outcome at 0.75 |
|---|---|---|---|
| 2–9, exact match with a full middle name on both sides (Castillo `Cruz`, Dimagiba `Dimayuga`, Reyes `Poblete`) | name 1.00 + birthday + barangay + middle | **0.90** | KAPWA match |
| 2–9, exact match, no middle name on either side (Garcia, Mendoza, Villanueva, Ramos, Santos) | name 1.00 + birthday + barangay | **0.85** | KAPWA match |
| 10, `Fernandes, Liza` vs `Fernandez, Liza` | name 0.90 (surname cosine ≈ 0.80, first 1.00) + birthday + barangay | **0.80** | KAPWA match (fuzzy) |
| 11–22, middle name present vs absent | name 1.00 + birthday + barangay | **0.85** | duplicate pair |
| 11–22, `Jocelyn` vs `Jocelyne` | first-name cosine ≈ 0.71 + birthday + barangay + middle | **0.86** | duplicate pair |
| 11–22, `Dela Peña` vs `Dela Pena` | name 1.00 + birthday + barangay; middle not equal (accent kept) | **0.85** | duplicate pair |
| 23–81, new clients | name similarity low against every candidate | **< 0.75** | new client |

Expected for that file: **9 KAPWA matches, 6 duplicate pairs, 59 new clients**
(verified against the live production client list with this exact formula).

## 8. Known limits

- **No fuzzy dates.** A one-day birthday difference loses 0.25 and usually drops
  a pair below the threshold.
- **Barangay must match textually.** The seed data stores `FVR` while the
  official list says `Friendship Village Resources (FVR)`; those rows lose 0.10.
- **Middle name is all-or-nothing.** `Cruz` and `C.` do not match (0.05).
- **Identifiers only exist if declared.** The six baseline columns carry no
  phone/email; an identifier can only add 0.10 when the column map declares it.
- **Name gate is strict at 0.3.** Two records that agree on birthday, barangay
  and phone but have dissimilar names are never compared.
- **Top three only.** A row with four plausible candidates shows three.
- **Threshold is fixed in the UI.** The API allows 0–1 per run, but the screen
  always sends the default 0.75.

## 9. Code map

| Concern | Location |
|---|---|
| Signals, score, default threshold | `kapwa-server/src/dedup/dedup-matcher.service.ts` (`personSignals`, `dedupScore`, `DEDUP_THRESHOLD_DEFAULT`) |
| Sweep order, duplicate rule, Top-3, household rule | `kapwa-server/src/dedup/dedup-match-sweep.service.ts` (`sweep`) |
| Candidate gate, trigram similarity | `kapwa-server/src/dedup/dedup-adapter.ts` (`searchSimilar`, `trigramSim`) |
| Threshold per run + sweep wiring | `kapwa-server/src/dedup/dedup.service.ts:289-292`, `dedup.entity.ts` (`match_threshold`) |
| Decisions, finalize, barangay update | `kapwa-server/src/dedup/dedup.service.ts` (`decide`, `finalize`) |
| Parser and column mapping | `kapwa-server/src/dedup/dedup-parse.service.ts` (`parseImportFile`) |

The **intake** prior-record check is a separate scorer
(`src/intake/match-scoring.ts`, weights 0.35 name / 0.20 family / 0.20 identifier
/ 0.15 birthday / 0.10 barangay, with a phonetic-surname rule). Do not mix the
two when presenting: Client Deduplication uses the weights in this document.

## 10. Boundary cases — two otherwise identical rows, one field apart

Scores below use the same formula (no declared identifier, no household boost,
which is how the intra-file sweep always scores):

| Difference between the two rows | Score | Duplicate pair? |
|---|---|---|
| Only **barangay** differs | **0.80** (0.75 if the middle name is empty/unequal) | **Yes** |
| Only **birthday** differs | **0.65** (0.60 without a middle name) | **No** |
| Only birthday differs, but a declared phone/email/PhilSys is equal | **0.75** | Yes, exactly on the threshold |
| Only middle name differs | **0.85** | Yes |
| Barangay **and** birthday differ | **0.55** | No |
| First-name typo (`Juan` → `Jhoan`) | 0.741 | No |

**Consequences.**

- **Barangay-only pair → one client.** Both rows become a duplicate pair; the
  reviewer keeps one and the other creates nothing. The surviving row's
  barangay is what gets written, and if the survivor is matched to an existing
  person whose current address differs, finalize **overwrites** that address
  (`barangayUpdate`, remark "Barangay updated to …"). Keep the row that carries
  the correct address.
- **Birthday-only pair → two clients, by design.** The rows are *not* a
  duplicate pair, so both are swept against KAPWA independently. The row whose
  birthday matches an existing person is retained and updates that record
  (0.90 with middle name, 0.85 without); the row with the other birthday scores
  0.65 against the very same person — below 0.75 — finds no candidate, and is
  imported as a **new client**. If neither birthday exists in KAPWA, both rows
  become new clients. There is no manual "same person" link to offer because no
  candidate is shown below the threshold.
- A **declared identifier** is the only signal that rescues a birthday-differing
  pair, and only to exactly 0.75.
- Practical rule for preparing a list: **birthday conflicts must be fixed
  before upload**; barangay conflicts are tolerated but choose the surviving
  row's address deliberately.
