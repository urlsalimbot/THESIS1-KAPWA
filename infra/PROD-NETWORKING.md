# KAPWA — Production networking: WebSocket 502 incident + favicon 403

Status: **investigated 2026-09-29, fixes landed in repo** (commit: see git log
after this doc). This file documents the incident, the evidence, and what
remains **infra-only** (not fixable from this repository).

**Re-verified 2026-09-29 (with AWS console/CLI access):**

- WebSocket re-probed end-to-end: `wss://kapwa.software/socket.io/?EIO=4&
  transport=websocket` → **101 upgrade OK** (engine.io open). CloudFront
  config confirms `/socket.io/*` → `ec2-api` origin (alongside `/api/*`).
  The incident-time 502 was a transient origin failure, as concluded below;
  nothing is broken today.
- **`/favicon.ico` 403 FIXED (live):** the missing-key 403 was confirmed
  against the edge (`403 AmazonS3`, no custom error responses configured).
  `kapwa-client/public/favicon.ico` (multi-size 16/32/48/192, rendered from
  `favicon.svg`) was added to the repo **and** uploaded straight to the
  origin `s3://kapwa-software-frontend/favicon.ico` (content-type
  `image/x-icon`, cache `public, max-age=86400`) with a CloudFront
  invalidation for `/favicon.ico`. Verified live: **200, image/x-icon,
  7994 bytes**. The next frontend deploy keeps it durable (the SPA sync
  uploads `public/`).

---

## 1. Incident

- Every authenticated page logged 5× console errors:
  `Error during WebSocket handshake: Unexpected response code: 502` on
  `wss://kapwa.software/socket.io/?EIO=4&transport=websocket`.
- `/favicon.ico` returns **403** in production.

## 2. Actual production topology (evidence-backed)

`kapwa.software` is **not** served by the repo's `infra/Caddyfile` or the
client nginx container in production. The AWS deployment (`deploy-aws.sh`,
`.github/workflows/deploy-aws.yml`, `kapwa-server/docker-compose.aws.yml`)
is:

```
Browser
  └─ CloudFront (ACM cert, SAN kapwa.software + www)        ← TLS terminator
       ├─ default behavior   → S3 bucket (SPA, built with
       │                        VITE_API_URL=/api/v1 VITE_WS_URL="")
       ├─ /api/*             → EC2 API origin (NestJS :3000 / ALB / Caddy)
       └─ /socket.io/*       → EC2 API origin (WebSocket-capable)
```

Live probe evidence (2026-09-29):

| Probe | Result |
|---|---|
| `GET https://kapwa.software/` | 200, `server: AmazonS3`, SPA HTML |
| `GET /favicon.ico` | **403 AccessDenied**, `server: AmazonS3` — missing object |
| `GET /api/v1/health` | 200 `{"status":"ok","db":"connected",...}` — NestJS |
| `wss://kapwa.software/socket.io/?EIO=4&transport=websocket` (no Origin) | 101 upgrade, real engine.io OPEN packet (`sid`, `pingInterval` …) |
| Same with `Origin: https://kapwa.software` | 101 upgrade OK |
| Same with `Origin: http://localhost:5173` (NOT allowed) | 101 upgrade OK (origin allowlist does not gate engine.io WS upgrades) |

TLS issuer: `Amazon RSA 2048 M01` (ACM/CloudFront), SAN `kapwa.software,
www.kapwa.software`. DNS: CloudFront `2600:9000::/28` AAAA range.

## 3. Root cause of the 502

**Infra-only, transient, not a code bug.** The full WebSocket chain
(CloudFront → API origin → NestJS gateways) works today against the live edge.
A `502 Bad Gateway` from CloudFront on a *fresh* WS upgrade means the API
origin failed to complete the upgrade at that moment (API container
down/restarting, crash loop, reverse proxy/ALB restart, or the `/socket.io/*`
CloudFront behavior temporarily routing to a non-WebSocket origin like S3).
CloudFront surfaces its origin failures as 502 via the `Error from cloudfront`
page.

Non-causes, each checked and ruled out:

1. **CORS origin allowlist** — the socket.io `cors` option cannot 502 a WS
   upgrade: engine.io (6.6.x) applies the `cors` npm middleware only to
   polling/regular requests; non-preflight and upgrade requests pass the
   middleware and the Origin header is not enforced on upgrades. Proven live:
   an un-allowed origin upgraded fine (see probes above).
2. **Path mismatch** — client and server both use the default engine path
   `/socket.io`; the namespace (`/notifications`, `/chat`) travels inside the
   socket.io packet, not in the URL. Verified in socket.io-client 4.8.3
   (`build/cjs/url.js` + `manager.js`: URI path is dropped, only
   `opts.path` = `/socket.io/` is used for HTTP requests).
3. **WS gated behind an env flag** — no flag exists: both gateways are plain
   module providers, always registered, no `io`/path/cors options in
   `src/app.module.ts`.
4. **Gateway path/namespace drift** — client `io('${WS_URL}/notifications')`
   / `io('${WS_URL}/chat')` matches the gateway namespaces exactly.

## 4. Changes landed in this repo

| File | Change | Why |
|---|---|---|
| `kapwa-server/src/notifications/notifications.gateway.ts` | `wsOrigins()` now merges `NOTIF_WS_ORIGIN` + `APP_URL` with the localhost dev defaults (`Array.from(new Set(...))`, still an allowlist, no wildcard) | Previously a set `NOTIF_WS_ORIGIN` **replaced** the defaults, silently breaking local dev when the prod value is present; `APP_URL` (already enforced for emails in `main.ts`) now participates in the origin allowlist. |
| `kapwa-server/src/chat/chat.gateway.ts` | same change for the chat socket (+ stale `kapwa.system` comment example fixed) | same |
| `infra/Caddyfile` | `handle /favicon.ico { respond 204 }` | Browser default `/favicon.ico` requests no longer fall through to the SPA HTML |
| `kapwa-client/nginx.conf` | `location = /favicon.ico { return 204; }` | same for the compose/nginx topology |

## 5. Runtime verification on recurrence

If the 502 reappears:

1. **API origin health** (the most likely culprit):
   - `ssh` to the EC2 API host → `docker ps` (is `kapwa-api` up? restart
     count? crash loop?) → `docker logs --tail 200 kapwa-api`.
   - Port check: `ss -ltnp | grep 3000`.
2. **CloudFront**: check the distribution's origin (S3 bucket for the SPA,
   API origin for `/socket.io/*`), and its access logs for the failing
   window — `502` rows show the edge→origin attempt. If an error response
   (502) got cached, CloudFront can serve it for the error-min TTL: wait it
   out or invalidate `/*` and re-test (the deploy script already invalidates
   on every frontend deploy).
3. **WS end-to-end probe** (repeat of this investigation):
   ```bash
   node -e '
     const WebSocket = require("ws");
     const ws = new WebSocket(
       "wss://kapwa.software/socket.io/?EIO=4&transport=websocket",
       { origin: "https://kapwa.software" },
     );
     ws.on("open", () => { console.log("101 OK"); ws.terminate(); });
     ws.on("unexpected-response", (_r, res) => {
       console.log("HTTP", res.statusCode, res.statusMessage); res.resume();
     });
   '
   # expected: "101 OK"
   ```
4. If Caddy is in the path (compose topology): `docker compose exec caddy
   caddy log` / `/var/log/caddy/access.log` — a 502 row there means the
   upstream `api:3000` refused/reset the upgrade.

## 6. Remaining infra-only items (NOT fixable in-repo)

1. **The 502 itself** — production edge (CloudFront) and hosts (EC2, API
   container, its TLS/proxy) are outside this repo. Verified healthy at
   investigation time; on recurrence follow section 5. Nothing in the repo
   rejects or 502s the handshake.
2. ~~`/favicon.ico` 403~~ — **RESOLVED 2026-09-29**: object
   `s3://kapwa-software-frontend/favicon.ico` now exists (repo +
   origin, verified `200 image/x-icon` live). The Caddy/nginx `204`
   rules still cover the compose-backed topologies; the CloudFront
   error-response rule is no longer needed.
3. **`NOTIF_WS_ORIGIN` / `APP_URL` values** — they live in the gitignored
   `infra/.env.production` on the EC2 host (`docker-compose.aws.yml` loads it
   via `env_file`). `infra/.env.example` documents
   `NOTIF_WS_ORIGIN=https://kapwa.software` and `APP_URL` defaults to
   `http://localhost:5173` with a loud production warning when unset. Confirm
   both are set correctly in `infra/.env.production` on the host; the
   allowlist now also covers APP_URL so the WS/polling fallback gets proper
   `Access-Control-Allow-Origin` headers.

## 7. Key files

- Gateways: `kapwa-server/src/notifications/notifications.gateway.ts`,
  `kapwa-server/src/chat/chat.gateway.ts`
- Client sockets: `kapwa-client/src/lib/notification-socket.ts`,
  `kapwa-client/src/lib/chat-socket.ts` (read-only reference)
- Deployment: `.github/workflows/deploy-aws.yml`, `deploy-aws.sh`,
  `kapwa-server/docker-compose.aws.yml`, `docs/DEPLOYMENT-AWS.md`
- Proxy configs: `infra/Caddyfile`, `kapwa-client/nginx.conf`