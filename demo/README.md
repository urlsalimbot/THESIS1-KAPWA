# Deduplication demo file

`dedup-demo.xlsx` — a 15-row barangay client list for demonstrating **Client
Deduplication** end to end. Sheet 1 (`Barangay list`), one header row:

| Last Name | First Name | Middle Name | Birthday | Barangay | Remarks |
|---|---|---|---|---|---|

Those six headers are exactly what the **Define** screen pre-fills, so the file
uploads with no column remapping. Birthdays are text (`YYYY-MM-DD`), not Excel
dates, so they read verbatim.

## What the rows demonstrate

| Rows | Content | What the review shows |
|---|---|---|
| 2–4 | Dela Cruz, Juan · Santos, Maria · Reyes, Pedro — clients that exist in a freshly seeded KAPWA | **KAPWA matches** → deciding "same person" records the service on the existing client (no new record) |
| 5–6 | Aguinaldo, Rosario, Buenaventura — the same person entered twice | **1 · Duplicates in this list** → one row is set aside ("review needed"); only one client is ever created |
| 7–16 | Ten new clients (Macaraeg, Bungubung, Quimson, Valderrama, Malabanan, Dimaculangan, Villareal, Bacani, Sarmiento, Panganiban) | **No match / New client** → created on finalize |

## Verified result (dev and prod, October 2026)

Upload: **15 rows · 7 matches** in ~1 s.
Finalize: **created 11 · updated 3 · deprioritized 1**, priority list written.
Post-checks: exactly **one** Aguinaldo record, no duplicate pair, all three
existing clients retained rather than duplicated.

## Demo flow

1. **Client Deduplication → New run**: source `dedup-demo.xlsx`, intervention
   type *Financial Grant*; the six columns are already mapped → **Upload**.
2. Review: *All rows* · **1 · Duplicates in this list** · **2 · KAPWA matches**.
   Open the duplicate pair and keep the first row; accept the KAPWA matches as
   "same person".
3. **Finalize & save priority list** — it queue as a background job; the
   confirmation card shows the counts and the downloadable priority list.

If the database was seeded less than a full run ago (no Dela Cruz/Santos/Reyes),
the three "existing client" rows become new clients instead — the duplicate pair
and the rest behave the same.

---

## The 80-row file (`dedup-demo-80.xlsx`)

Same sheet (`Barangay list`) and the same six headers, so **Define** pre-fills
with no remapping. **80 data rows** plus the header row. Birthdays are text
(`YYYY-MM-DD`), as in the 15-row file.

| Rows | Content | Expected in review |
|---|---|---|
| 2–9 | Eight exact matches against seeded production clients — Castillo, Dimagiba, Garcia, Mendoza, Villanueva, Ramos, Santos, Reyes — with their real birthdays and barangays | **KAPWA matches** → "same person" records the service on the existing client |
| 10 | One deliberate **fuzzy** match: `Fernandes, Liza` against production's `Fernandez, Liza` — same birthday, middle initial and barangay, one letter apart in the surname | **KAPWA match** — a probable, not exact, hit: the system offers the candidate and the human confirms |
| 11–22 | Six people entered twice: full middle name vs middle initial in five pairs, and `Jocelyn` / `Jocelyne` in the sixth | **6 · Duplicates in this list** — one row per pair is set aside |
| 23–81 | 59 new clients across all 13 barangays, 1950–2004 birth years | **No match / New client** → created on finalize |

**Numbers to expect (default 0.75 threshold):** **9 KAPWA matches** (8 exact at
0.85–0.90 plus the fuzzy match at 0.85), **6 duplicate pairs** (0.85–0.86), and
**59 new clients**. The matching signals are name similarity, birthday and
barangay; a served household can only raise a score. The full rules — weights,
candidate gate, duplicate ordering, and limits — are in
[`demo/MATCHING-CRITERIA.md`](MATCHING-CRITERIA.md).

**Before you finalize:** uploading and reviewing creates no client records.
**Finalizing creates the 59 new clients** and updates the nine matched ones —
that is the intended demonstration, but do not finalize if you want to keep the
production client list exactly as it is. After finalize, the confirmation card
shows the counts and the downloadable priority list (`CD-YYYY-MMM-NNN.xlsx`).

