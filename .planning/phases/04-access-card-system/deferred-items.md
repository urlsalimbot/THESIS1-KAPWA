# Deferred Items — Phase 04 (Access Card System)

## Pre-existing: trackerServiceMock missing createEntry mock

**Found during:** Phase 04-03, Task 2
**File:** `kapwa-server/src/interventions/interventions.service.spec.ts`
**Issue:** The `trackerServiceMock` provides `generateTrackerId` but the service calls `this.trackerService.createEntry()`. This causes non-blocking console.error in every create() test that reaches the tracker auto-creation code.

**Root cause:** Prior phase (03) added `createEntry` to the real TrackerService but the test mock was never updated to match. The try/catch in the service makes this non-blocking.

**Fix for future:** Update `trackerServiceMock` in spec to:
```typescript
trackerServiceMock = {
  createEntry: jest.fn().mockResolvedValue({}),
};
```

This is out of scope for 04-03 (pre-existing issue, not caused by current task changes).
