# Deployment — KAPWA on AWS (EC2 + RDS + S3 + CloudFront)

Deploy KAPWA fully on AWS managed services:

| Piece | AWS service | Replaces |
|---|---|---|
| Web frontend (Vite SPA) | **S3** static bucket + **CloudFront** CDN | `kapwa-client` nginx container |
| API (NestJS) | **EC2** running the `kapwa-server` Docker image | Caddy + `kapwa-api` on the old single host |
| Database (Postgres 16) | **RDS** | the `db` container |
| Object storage (MinIO-compatible) | **S3** | the `minio` container |
| TLS for `kapwa.app` | **CloudFront** + **ACM** certificate | Caddy automatic HTTPS |
| DNS | **Route 53** | — |

This guide mirrors `docs/DEPLOYMENT.md` but for the fully-managed AWS path. It
assumes you will run the four small code changes in §3 first (the code as
written targets self-hosted MinIO/Postgres on the compose network).

---

## 1. Target architecture

```
kapwa.app (Route 53 alias record)
        │
        ▼
CloudFront ── ACM cert (us-east-1), TLS terminates here
        │
        ├── default /*         → S3 frontend bucket (private + OAC)
        │                        CloudFront Function rewrites deep links → /index.html
        ├── /api/*             → EC2 :3000 (NestJS API)
        ├── /socket.io/*       → EC2 :3000 (WebSockets)
        └── /health            → EC2 :3000
                                   │
                  ┌────────────────┴───────────────┐
                  ▼                                ▼
              RDS Postgres 16                 S3 storage buckets
              (5432, SG-restricted)           (worker-signatures, documents, …)
```

- The browser only ever talks to CloudFront, so the SPA keeps its **relative**
  `/api/v1` and `VITE_WS_URL=""` URLs — **no frontend code change**.
- EC2 is **stateless**: all data lives in RDS + S3. You can terminate and
  replace the instance without losing anything.
- CloudFront terminates TLS, so EC2 and RDS never need public HTTPS.

---

## 2. Prerequisites

- AWS account with billing enabled.
- `kapwa.app` registered and its nameservers pointed at Route 53 (create a
  hosted zone and set the NS records at your registrar).
- AWS CLI installed locally: `pip install awscli` or
  `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && sudo ./aws/install`.
- Local AWS credentials configured (`aws configure`) with the IAM user from §4.6.

---

## 3. Required code changes (do these first)

These are the four changes that make the code talk to AWS services. Without
them RDS rejects the connection (TLS) and S3 uploads fail (wrong region / taken
bucket names).

### 3.1 RDS TLS — `kapwa-server/src/database/data-source.ts`

RDS refuses non-TLS connections (`rds.force_ssl=1` default). TypeORM currently
passes no `ssl`. Add an env toggle, e.g.:

```ts
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // ...rest unchanged
});
```

Set `DB_SSL=true` only on the AWS host (leave local dev on `false`).

### 3.2 S3 region + bucket names — `kapwa-server/src/minio/minio.service.ts`

The `minio` npm client is S3-compatible, but (a) it needs the bucket **region**
for correct SigV4 signing, and (b) S3 bucket names are **globally unique** —
the hardcoded names (`documents`, `backups`, …) are almost certainly taken.

1. Pass `region` to the client constructor:
   ```ts
   const region = this.config.get<string>('MINIO_REGION', 'us-east-1');
   this.client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey, region });
   ```
2. Prefix every bucket name with a project/env prefix from env:
   ```ts
   const prefix = this.config.get<string>('MINIO_BUCKET_PREFIX', 'kapwa-dev');
   const bucket = (name: string) => `${prefix}-${name}`;
   ```
   Apply `bucket(...)` to `initBuckets()` (lines 100-107) and to
   `uploadDocument()` (`'documents'`, line 91). Then create the buckets as
   `kapwa-prod-worker-signatures`, `kapwa-prod-documents`, etc. in §4.3.

### 3.3 Chat WebSocket origin — `kapwa-server/src/chat/chat.gateway.ts`

`socket.io` validates the `Origin` header on every handshake. Line 16 hardcodes
localhost origins, so chat breaks the moment the page is served from
`https://kapwa.app`. Make it read the same env var the notifications gateway
already uses:

```ts
function wsOrigins(): string[] {
  const raw = process.env.NOTIF_WS_ORIGIN;
  if (raw) return raw.split(',').map((s) => s.trim());
  return ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
}
// gateway: cors: { origin: wsOrigins(), ... }
```

### 3.4 Env — set these in `infra/.env.production` (§5)

- `NOTIF_WS_ORIGIN=https://kapwa.app` (both WebSocket gateways)
- `APP_URL=https://kapwa.app` (email links)
- `DB_SSL=true`, `MINIO_REGION`, `MINIO_BUCKET_PREFIX` per §5.

> These are the *only* code changes. Everything else in the repo works against
> RDS and S3 as-is, including the fresh-boot bootstrap: `migrate.js` creates
> the `uuid-ossp` / `pgcrypto` / `pg_trgm` extensions and the custom
> `uuid_generate_v7()` function on RDS, and `pgaudit` is optional (SAVEPOINT /
> ROLLBACK-guarded).

---

## 4. Provision AWS resources

> Replace `ap-southeast-1` below with your region (nearest to Norzagaray,
> Bulacan: `ap-southeast-1` Singapore or `ap-southeast-2` Sydney). Keep the
> same region for everything **except** ACM/CloudFront (see 4.7).

### 4.1 VPC / security groups

Use the default VPC. Create two security groups:

| SG | Allows | Used by |
|---|---|---|
| `kapwa-rds-sg` | inbound `5432` from `kapwa-ec2-sg` | RDS |
| `kapwa-ec2-sg` | inbound `3000` from CloudFront ranges; inbound `22` from your IP | EC2 |

CloudFront connects from a global range — fetch it and apply:
`https://ip-ranges.amazonaws.com/ip-ranges.json` → filter `service=CLOUDFRONT`.
For a quick start you may allow `3000` from `0.0.0.0/0` and rely on the app's
`helmet()` + `ThrottlerGuard` (`app.module.ts:105`) — but restrict it if you
can. EC2 does **not** need ports 80/443 (CloudFront is the only entry).

### 4.2 RDS Postgres

```
aws rds create-db-instance \
  --db-instance-identifier kapwa \
  --engine postgres --engine-version 16 \
  --db-instance-class db.t3.micro \
  --allocated-storage 20 --storage-type gp3 \
  --master-username kapwa --master-user-password '<strong-password>' \
  --db-name kapwa \
  --vpc-security-group-ids sg-<kapwa-rds-sg> \
  --no-publicly-accessible --multi-az false \
  --backup-retention-period 7 \
  --storage-encrypted
```

Notes:
- Take the **endpoint** from the console (e.g. `kapwa.xxxxx.ap-southeast-1.rds.amazonaws.com`) — that becomes `DB_HOST`.
- Extensions (`uuid-ossp`, `pgcrypto`, `pg_trgm`) are created automatically by `migrate.js`; no action needed.
- Audit logging (pgaudit parity): create a custom parameter group with
  `shared_preload_libraries=pgaudit` + `pgaudit.log=all` and attach it. Optional.

### 4.3 S3 buckets

**Frontend bucket** (private, served via CloudFront + OAC):

```
aws s3api create-bucket --bucket kapwa-app-frontend --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
aws s3api put-public-access-block --bucket kapwa-app-frontend \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

**Storage buckets** (replace the MinIO service). Create one per app bucket with
the prefix from §3.2:

```
for b in worker-signatures client-receipts irf-attachments coa-exports backups documents; do
  aws s3api create-bucket --bucket "kapwa-prod-$b" --region ap-southeast-1 \
    --create-bucket-configuration LocationConstraint=ap-southeast-1
  aws s3api put-public-access-block --bucket "kapwa-prod-$b" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket "kapwa-prod-$b" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
done
```

`initBuckets()` still calls `makeBucket` on startup — either grant the app's
IAM role `s3:CreateBucket`, or pre-create the buckets (above) and only grant
`HeadBucket`/read/write; the existence check then short-circuits.

### 4.4 IAM user for deployment (CLI + GitHub Actions)

Create one IAM user `kapwa-deploy` with programmatic access and attach an
inline policy allowing:

- `s3:GetObject/PutObject/DeleteObject/ListBucket` on the frontend bucket + storage buckets,
- `cloudfront:CreateInvalidation/GetInvalidation`,
- (optional) `ecr:*` if you push images to ECR instead of building on the box.

Save the access key/secret for §4.6 and GitHub Actions secrets.

### 4.5 EC2 instance (API)

```
aws ec2 run-instances \
  --image-id ami-0xxxxx   # Ubuntu 24.04 LTS, current in your region
  --instance-type t3.small \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}'
  --security-group-ids sg-<kapwa-ec2-sg> \
  --key-name <your-key-pair>
```

Then install Docker + Compose v2 and clone the repo:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu   # log out/in after
git clone https://github.com/<you>/THESIS1-KAPWA.git /opt/kapwa
```

The instance needs no Elastic IP — CloudFront reaches it by its public DNS /
IP as the origin. (If you later want an ALB or private subnet, point the
origin there instead.)

### 4.6 Place secrets on the box

`infra/.env.production` is gitignored and never committed. Create it directly
on the EC2 per §5.

### 4.7 ACM certificate (must be `us-east-1` for CloudFront)

```
aws acm request-certificate --region us-east-1 \
  --domain-name kapwa.app --validation-method DNS
```

Confirm the request, then create the DNS validation CNAME records in Route 53
(pending validation usually completes in minutes). Also request a second cert
for `www.kapwa.app` if you want the apex + www to both resolve (or add it as a
SAN on the first request).

### 4.8 CloudFront distribution

Create a distribution with two origins:

| Origin | Domain | Notes |
|---|---|---|
| S3 | `kapwa-app-frontend.s3.ap-southeast-1.amazonaws.com` | **Origin access control (OAC)** — update the bucket policy to allow `cloudfront.amazonaws.com` principal, `s3:GetObject`, on `arn:aws:s3:::kapwa-app-frontend/*` |
| API | `<ec2-public-dns>:3000` | plain **HTTP** origin (CloudFront adds TLS on the viewer side) |

Behaviors (mirror the deleted `kapwa-client/nginx.conf`):

| Path pattern | Origin | Notes |
|---|---|---|
| `/api/*` | API | Forward all query strings; **no caching** (TTL 0) |
| `/socket.io/*` | API | WebSockets enabled, forward Upgrade headers, TTL 0, forward all query strings |
| `/health` | API | TTL 0 |
| `Default (*)` | S3 | SPA fallback for react-router deep links — see the caveat below |

> **Caveat — do not use a distribution-level custom-error response for the SPA
> fallback.** CloudFront's distribution-level `CustomErrorResponses` (map `403`
> and `404` → `200 /index.html`, TTL 0) applies to **every** cache behavior,
> including `/api/*` and `/socket.io/*`. Any API `403` or `404` body is then
> replaced by the SPA HTML with status `200` — RBAC denials, `Missing CSRF
> token`, and unknown API routes all become invisible to the client.
>
> Instead, leave distribution-level `CustomErrorResponses` at `Quantity: 0` and
> attach a **viewer-request CloudFront Function** to the default (S3) behavior
> that rewrites extension-less paths (not starting with `/api/` or `/socket.io/`)
> to `/index.html`. The deployed function is `kapwa-spa-rewrite`:
>
> ```js
> function handler(event) {
>   var req = event.request;
>   var uri = req.uri || '/';
>   if (uri.indexOf('/api/') === 0 || uri.indexOf('/socket.io/') === 0) return req;
>   if (uri === '/') return req;
>   var last = uri.substring(uri.lastIndexOf('/') + 1);
>   if (last.indexOf('.') !== -1) return req;   // real asset → serve as-is
>   req.uri = '/index.html';
>   return req;
> }
> ```
>
> API paths are never rewritten, so their status codes reach the browser
> unchanged. Verify after any change: `GET /physical-files` → `200` HTML, and
> `GET /api/v1/does-not-exist` → `404` JSON.

Viewer protocol policy: **Redirect HTTP → HTTPS** (mandatory for the
HSTS-preloaded `.app` TLD). Apply CloudFront's managed
`SecurityHeadersPolicy` response-headers policy to the default behavior to
reproduce the old Caddy headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, …) — the API behavior already gets `helmet()` from Nest.

### 4.9 Route 53

Create/confirm the hosted zone for `kapwa.app` and add:

- `kapwa.app` → **A alias** → the CloudFront distribution
- `www.kapwa.app` → **A alias** → same distribution (if you used a SAN cert)
- the ACM validation CNAMEs (§4.7)

---

## 5. `infra/.env.production` (on the EC2)

Start from `infra/.env.example`. For AWS, fill in:

```bash
# --- Database (RDS) ---
DB_HOST=kapwa.xxxxx.ap-southeast-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=kapwa
DB_PASSWORD=<master password from §4.2>
DB_NAME=kapwa
DB_SSL=true                       # §3.1 — required by RDS

# --- Object storage (S3) ---
MINIO_ENDPOINT=s3.ap-southeast-1.amazonaws.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_REGION=ap-southeast-1       # §3.2
MINIO_BUCKET_PREFIX=kapwa-prod    # §3.2
MINIO_ROOT_USER=<kapwa-deploy access key>
MINIO_ROOT_PASSWORD=<kapwa-deploy secret>

# --- Auth ---
JWT_SECRET=$(openssl rand -hex 32)
SYNC_SECRET=$(openssl rand -hex 32)

# --- IRF encryption (API fails closed without it) ---
IRF_ENCRYPTION_KEY=$(openssl rand -hex 32)

# --- App ---
NODE_ENV=production
PORT=3000
APP_URL=https://kapwa.app
NOTIF_WS_ORIGIN=https://kapwa.app     # §3.3 + notifications gateway

# --- Email (log-only until set; REQUIRED before going live) ---
# EMAIL_HOST=smtp.your-provider.com
# EMAIL_PORT=587
# EMAIL_USER=...
# EMAIL_PASS=...
# EMAIL_FROM=KAPWA MSWDO <noreply@kapwa.app>
```

> Keep this file on the box. It is excluded from rsync and git.

---

## 6. Deploy the API (EC2)

On the instance, run the stack with a slim compose file that has **only the
api service** (no db / minio / client / caddy). Add
`kapwa-server/docker-compose.aws.yml`:

```yaml
services:
  api:
    build: .
    container_name: kapwa-api
    restart: unless-stopped
    expose:
      - "3000"
    env_file:
      - ../infra/.env.production
    healthcheck:
      test: ["CMD", "node", "-e", 'http=require("http");http.get("http://localhost:3000/api/v1/health",r=>process.exit(r.statusCode<500?0:1)).on("error",()=>process.exit(1))']
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 30s
```

Then, from `/opt/kapwa`:

```bash
cd kapwa-server
docker compose -f docker-compose.aws.yml up -d --build

# Wait for health
until curl -sf http://localhost:3000/api/v1/health >/dev/null 2>&1; do sleep 2; done

# Fresh-boot schema bootstrap (idempotent; builds the whole schema on RDS)
docker exec kapwa-api node dist/database/migrate.js

# Incremental TypeORM migrations (no-op on fresh DBs)
docker exec kapwa-api node dist/database/run-migrations.js

# Seed only on an empty DB (users table)
docker exec kapwa-api node dist/database/seed-accounts.js
docker exec kapwa-api node dist/database/seed-programs.js
```

The API reads `DB_HOST`/`MINIO_*` from `infra/.env.production`, so it connects
to RDS and S3 directly. `migrate.js` creates the extensions and `uuid_generate_v7()`
on RDS as part of the bootstrap.

---

## 7. Deploy the frontend (S3 + CloudFront)

From any machine with the repo and AWS CLI (§4.4):

```bash
cd kapwa-client
VITE_API_URL=/api/v1 VITE_WS_URL="" npm run build   # → dist/

aws s3 sync dist/ s3://kapwa-app-frontend --delete \
  --cache-control "no-cache" \
  --exclude "assets/*"

aws s3 sync dist/assets/ s3://kapwa-app-frontend/assets/ \
  --cache-control "public, max-age=31536000, immutable"

aws cloudfront create-invalidation \
  --distribution-id <dist-id> --paths "/*"
```

- `index.html`, `sw.js`, `manifest.json` → `no-cache` (Vite emits hashed asset
  names, so `index.html` is the only mutable entry point).
- `assets/*` → `immutable` (Vite hashes these filenames; the old nginx used
  `expires 1y`).
- Always invalidate — CloudFront caches the SPA by default.

---

## 8. Update flow (no data loss)

**API:** on the EC2,

```bash
cd /opt/kapwa && git pull
cd kapwa-server && docker compose -f docker-compose.aws.yml up -d --build api
docker exec kapwa-api node dist/database/run-migrations.js   # pending upgrades
```

**Frontend:** repeat §7 (sync + invalidate). RDS and S3 buckets are untouched,
so no data risk.

---

## 9. Verification

```bash
curl -sf https://kapwa.app/api/v1/health        # → 200 OK
curl -I https://kapwa.app/                       # 200, TLS, security headers
curl -sf https://kapwa.app/api/docs              # Swagger (same-origin)
```

Then in a browser: log in, open the dashboard (API + notification socket), and
send a chat message (chat socket) — all three must connect. Confirm the
browser shows a valid cert for `kapwa.app` and that a deep link like
`https://kapwa.app/cases/<uuid>` returns the app (SPA fallback), not a 404
from S3.

---

## 10. Cost estimate (ap-southeast-1, ~USD/month)

| Resource | Spec | ~Cost |
|---|---|---|
| EC2 `t3.small` | 2 vCPU / 2 GB, 30 GB gp3 | $16 |
| RDS `db.t3.micro` | 20 GB gp3, single-AZ | $13 |
| S3 (frontend + storage) | small | < $1 |
| CloudFront | light traffic | < $1 |
| Route 53 + ACM | hosted zone + cert | $0.50 |

Total ≈ **$30–35/month** for a small deployment. Terminate `t3.small` / use
`t3.micro` or a `t4g.small` (ARM, cheaper) to trim it.

---

## 11. Security notes

- **Nothing is publicly reachable except CloudFront.** EC2 and RDS are
  SG-restricted; buckets are private + OAC.
- **EC2 is stateless** — no app data lives on it, so losing the instance costs
  nothing but the image build. Automate §6 with `user-data` if you want.
- **RDS** has encrypted storage (§4.2); take automatic snapshots (already on).
- **IRF data** is encrypted at rest in RDS (`BYTEA` + `IRF_ENCRYPTION_KEY`) and
  in S3 (SSE-S3). Guard the key.
- **Secrets** live only in `infra/.env.production` on the box; IAM for the
  deploy user is least-privilege. Consider AWS Secrets Manager / SSM Parameter
  Store as a hardening step.
- **WAF** (optional): attach AWS WAF to the CloudFront distribution for
  edge-level rate limiting to replace Caddy's `rate_limit`; the API already
  throttles with `@nestjs/throttler`.

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| API boots, then exits | `IRF_ENCRYPTION_KEY` missing/invalid — API fails closed in production (§5) |
| DB connection refused | `DB_SSL` not set / `DB_HOST` is the RDS endpoint, or `kapwa-rds-sg` not on the instance |
| S3 uploads 403 | `MINIO_REGION` wrong (SigV4 signing) or bucket names not prefixed (taken globally) |
| Chat/notifications don't connect | `NOTIF_WS_ORIGIN` missing → set to `https://kapwa.app`; chat gateway still hardcoded if §3.3 not applied |
| Deep link 404s | SPA fallback CloudFront Function (§4.8) not associated with the default cache behavior |
| Stale frontend after deploy | `aws cloudfront create-invalidation --paths "/*"` not run, or `index.html` cached (must be `no-cache`) |
| API health 503 via CloudFront | EC2 SG blocks port 3000 from CloudFront ranges, or the `api` container is down (`docker compose -f docker-compose.aws.yml logs api`) |

---

## 13. Continuous deployment

Two workflows publish the two halves of the stack, each where it belongs:

| Component | Runner | What it does |
|---|---|---|
| **API** | `self-hosted` runner on the EC2 (label `kapwa-aws`) | rsyncs the checkout to `/opt/kapwa`, runs `./deploy-aws.sh api` → rebuild API image, wait for health, apply migrations. **Needs no AWS credentials.** |
| **SPA** | GitHub-hosted `ubuntu-latest` | `npm ci`, then `./deploy-aws.sh frontend` → build, `s3 sync` (no-cache HTML / immutable assets), CloudFront invalidation. Uses the scoped CI credentials. |

Both wait for the `CI` workflow to succeed on `main`, or can be run manually
via **Actions → Deploy AWS → Run workflow**.

### 13.1 Install the self-hosted runner on the EC2

```bash
# On the EC2 (as the ubuntu user, who is in the docker group)
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/<owner>/<repo> --token <REGISTRATION_TOKEN> \
  --labels kapwa-aws --name kapwa-api-runner --unattended
sudo ./svc.sh install ubuntu && sudo ./svc.sh start
```

Get `<REGISTRATION_TOKEN>` from **Repo → Settings → Actions → Runners → New self-hosted runner**.
The runner talks outbound to GitHub only — no inbound SSH is opened.

### 13.2 GitHub configuration

Repository → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `AWS_DEPLOY_ACCESS_KEY_ID` | access key of a user scoped to the frontend bucket + invalidation |
| Secret | `AWS_DEPLOY_SECRET_ACCESS_KEY` | matching secret key |
| Variable | `DEPLOY_PATH` | optional, defaults to `/opt/kapwa` |

The CI user needs only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::kapwa-software-frontend"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::kapwa-software-frontend/*"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      "Resource": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
    }
  ]
}
```

### 13.3 Manual deploy

```bash
./deploy-aws.sh            # API + SPA
./deploy-aws.sh api        # API only (no AWS credentials needed)
./deploy-aws.sh frontend   # SPA only
```

Override defaults via environment: `AWS_HOST` (or `local` when run on the EC2),
`AWS_SSH_KEY`, `DEPLOY_PATH`, `FRONTEND_BUCKET`, `CF_DIST_ID`.

> The legacy `.github/workflows/deploy.yml` targets the self-hosted-PC model
> (single-host docker compose + Caddy). It is superseded by `deploy-aws.yml`
> for the AWS architecture — disable it if the PC runner is no longer used.