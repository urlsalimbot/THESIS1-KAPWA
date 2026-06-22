---
status: testing
phase: 03-intervention-tracking-case-management
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-SUMMARY.md
started: 2026-06-22T15:10:00Z
updated: 2026-06-22T15:10:00Z
---

## Current Test

number: 1
name: Cases page shows status badges
expected: |
  On the Cases page, each case row displays a colored status badge
  (pending=amber, in_review=blue, approved=green, disbursed=purple, closed=gray)
  in a "Status" column between Category and the action buttons.
awaiting: user response

## Tests

### 1. Cases page shows status badges
expected: Cases page shows colored status badges per case status (pending=amber, in_review=blue, approved=green, disbursed=purple, closed=gray) in Status column
result: [pending]

### 2. Social Worker "Request Review" button
expected: When role=social_worker and case is pending, "Request Review" button appears. Clicking it changes status to in_review.
result: [pending]

### 3. Admin "Disburse" button
expected: When role=admin and case is approved, "Disburse" button appears. Clicking it changes status to disbursed.
result: [pending]

### 4. Admin/SW "Close" button
expected: When role=admin/social_worker and case is disbursed, "Close" button appears. Clicking it changes status to closed.
result: [pending]

### 5. Admin override with mandatory reason
expected: When role=admin, "Override Status" option allows changing to any status. Requires a reason. Override is recorded in audit trail.
result: [pending]

### 6. Log Intervention on disbursed case
expected: On a disbursed case, social worker can click "Log Intervention" → form opens with intervention type, fund source dropdown, amount, service date fields.
result: [pending]

### 7. Signature capture via SignaturePad
expected: Intervention form includes a SignaturePad canvas for worker signature. Tapping/clicking opens drawing surface. User draws and accepts.
result: [pending]

### 8. Receipt/image upload
expected: Intervention form includes a receipt upload field. User can select an image file and it uploads via MinIO.
result: [pending]

### 9. Duplicate intervention rejection
expected: Logging the same intervention type for the same household within 30 days returns an error/conflict message (409).
result: [pending]

### 10. Case Tracker auto-creation
expected: When an intervention is logged, a Case Tracker entry is auto-created with format NORZ-TRACK-YYYY-MMDD-NNN.
result: [pending]

### 11. SLA overdue badge
expected: Cases exceeding the 3-day SLA per gate show an "Overdue" badge with red AlertTriangle styling on CasesPage.
result: [pending]

### 12. Fund source display
expected: Interventions table shows a Fund Source badge/column between Amount and Agency.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

[none yet]
