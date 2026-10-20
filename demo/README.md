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
