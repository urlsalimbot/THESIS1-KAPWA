# OWASP ZAP scan — KAPWA NestJS API

Date: 2026-09-22
Target: `http://localhost:3000` (native NestJS dev API, fresh dev DB)
Tool: `ghcr.io/zaproxy/zaproxy:stable` — `zap-api-scan.py` (OpenAPI import + active scan)
Spec: `http://localhost:3000/api/docs-json`
Auth: ZAP replacer injected `Authorization: Bearer <admin JWT>` on every request
Scan: `-m 2 -T 12` (spider 2 min, active 12 min max)
Reports: `zap-report.html`, `zap-report.json`, `zap-report.md` (this directory)

## Result

```
FAIL-NEW: 0   FAIL-INPROG: 0   WARN-NEW: 4   WARN-INPROG: 0   INFO: 0   IGNORE: 0   PASS: 115
```

## Warnings (risk > informational)

### 1. Server error (500) + error disclosure on public endpoints — REAL
`GET /api/v1/programs/public/:id` and `GET /api/v1/announcements/public/photo/:id` return **500**
for a non-UUID id, and the body leaks the DB error:

```json
{"statusCode":500,"message":"invalid input syntax for type uuid: \"id\"", ...}
```

ZAP raised it twice (`A Server Error response code` x6, `Application Error Disclosure` x2).
Cause: the route param is passed straight to Postgres without a `ParseUUIDPipe`/guard, so a
malformed id becomes a 500 instead of 400/404, and the raw driver message reaches the client.
Fix: validate the param (`ParseUUIDPipe`) and return 404; keep driver details out of responses.

### 2. Password in the URL — REAL
`GET /api/v1/irf/:id/export-pdf?legalBasis=…&password=ZAP` puts the IRF PDF password in the
query string (`Information Disclosure - Sensitive Information in URL` x1). Query strings are
logged by proxies/servers and can leak via history/referrer.
Fix: send the password in a POST body or a header; the client already uses `fetch` so this is a
small change (`api.ts exportIrfPdf`).

### 3. Cookie without HttpOnly — BY DESIGN (documented)
`csrf-token` is set with `httpOnly: false` (`common/csrf.guard.ts`). That is required by the
double-submit CSRF pattern (the SPA must read it). It is already `sameSite: 'lax'` and
`secure` in production. Action: none; consider a code comment so future scans don't re-flag it.

### 4. SQL Injection x5 — FALSE POSITIVE
Every instance was a rate-limited `429 Too Many Requests` with no evidence. Manual check with
`?search=' OR 1=1--` returned `200 {"data":[],"total":0}` — queries are parameterized
(TypeORM/`$1`). Re-run without the throttler, or raise the throttle limit for the scan, to
clear this class.

## Informational (not vulnerabilities)
- `A Client Error response code` x656 — mostly `401` from authenticated endpoints hit without a
  valid session on the first spider pass.
- `Session Management Response Identified` x31, `Non-Storable Content` x5 — expected for a
  token-authenticated JSON API.

## Recommended next steps
1. Add `ParseUUIDPipe` (or id validation) to `programs/public/:id` and
   `announcements/public/photo/:id`; map bad ids to 404.
2. Move the IRF export password out of the query string.
3. Add a comment on the intentional `httpOnly:false` CSRF cookie.
4. Re-run ZAP with the throttler relaxed (or an allow-listed scanner IP) to confirm the SQLi
   alerts disappear.

## Reproduce
```bash
TOKEN=$(node -e '(async()=>{const r=await fetch("http://localhost:3000/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@mswdo.test",password:"admin123"})});process.stdout.write((await r.json()).accessToken||"")})()')
podman run --rm --network=host -v $PWD/test-results/zap-2026-09-22:/zap/wrk:z \
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t http://localhost:3000/api/docs-json -f openapi \
  -J /zap/wrk/zap-report.json -r /zap/wrk/zap-report.html -w /zap/wrk/zap-report.md \
  -m 2 -T 12 \
  -z "-config replacer.full_list(0).description=Auth -config replacer.full_list(0).enabled=true -config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Authorization -config replacer.full_list(0).replacement=Bearer $TOKEN"
```
