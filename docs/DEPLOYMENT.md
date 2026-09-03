# Deployment — KAPWA to a machine you own (rsync model)

KAPWA deploys with **rsync + `deploy.sh`** — a source-tree sync, not a
git-pull. The GitHub Actions CD (`deploy.yml`) syncs the working tree to the
target and runs the deploy script, which builds images, starts the stack,
waits for health, runs the fresh-boot DB bootstrap (`migrate.js`), applies
incremental TypeORM migrations, and seeds an empty DB (idempotent).

This doc covers deploying to a **PC/laptop you own** (as opposed to a hosted
droplet). The same flow works for any machine with Docker + SSH.

---

## The deployment model

```
push to main ──> CI (lint · typecheck · test · build · coverage · docker)
                     │ success
                     ▼
            Deploy workflow (deploy.yml)
                     │
           1. rsync working tree → <target>/<DEPLOY_PATH>
              (excludes .git, node_modules, dist, coverage, .planning,
               .superpowers, logs, infra/.env.production, docker-compose.override.yml)
           2. ssh "<target> && cd <DEPLOY_PATH> && ./deploy.sh"
                     │
                     ▼
        build → up -d → health wait → migrate.js → migrations → seeds
```

- **Triggers:** every push to `main` after CI passes, or manually via
  Actions → **Deploy** → *Run workflow*.
- **Secrets stay server-side:** `infra/.env.production` is rsync-excluded, so
  the target keeps its own copy (never uploaded to GitHub).

---

## One-time target prep (the PC)

```bash
# 1. Install Docker + Compose v2
curl -fsSL https://get.docker.com | sh

# 2. Create the app directory (either a fresh path or convert an existing
#    git clone — rsync must own the tree, so remove .git if it was a repo)
sudo mkdir -p /opt/kapwa
sudo rm -rf /opt/kapwa/.git          # only if it was previously a git clone
sudo chown -R <deploy-user>:<deploy-user> /opt/kapwa

# 3. Give the deploy user passwordless SSH access for the CD
#    (add the GitHub Actions public key to ~/.ssh/authorized_keys)

# 4. Ensure docker works WITHOUT sudo for the deploy user
docker ps
# if it errors: sudo usermod -aG docker <deploy-user>   (then log out/in)

# 5. Place the secrets file (rsync will never overwrite it)
#    /opt/kapwa/infra/.env.production  ← from infra/.env.example, fill all values
```

> **Deploy user:** using the main user (e.g. `typwubuntu`) is fine for a
> personal PC. The tradeoff is that the SSH key stored in GitHub Actions can
> then control the whole machine — acceptable if you are the only person with
> repo write access.

---

## GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | reachable address of the PC (e.g. a Tailscale IP `100.x.y.z`) |
| `DEPLOY_USER` | the deploy user (e.g. `typwubuntu`) |
| `DEPLOY_SSH_KEY` | the deploy user's **private** SSH key |
| `DEPLOY_PATH` | target dir on the PC (e.g. `/opt/kapwa`) |
| `DEPLOY_PORT` | SSH port, default `22` |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -H <host> 2>/dev/null` — recommended (pins the host key) |

**Reachability:** GitHub's runners SSH in from the internet, so a home PC
behind NAT needs a tunnel. Tailscale is the easiest:
`curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`,
then use the Tailscale IP as `DEPLOY_HOST`.

---

## Manual deploy (no GitHub)

From any machine with the repo + the SSH key:

```bash
rsync -avz --delete \
  --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' \
  --exclude 'coverage/' --exclude '.planning/' --exclude '.superpowers/' \
  --exclude 'infra/.env.production' \
  ./ <deploy-user>@<host>:<DEPLOY_PATH>/

ssh <deploy-user>@<host> 'cd <DEPLOY_PATH> && ./deploy.sh'
```

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Deploy skipped | CI failed on that push — the Deploy workflow waits for CI success (or run it manually) |
| `docker` permission denied in `deploy.sh` | deploy user not in the `docker` group; `sudo usermod -aG docker <user>` + re-login |
| rsync "permission denied" on the target | `DEPLOY_PATH` not owned by the deploy user; `sudo chown -R <user> <path>` |
| API not healthy after deploy | `docker compose -f kapwa-server/docker-compose.yml logs api`; the API fails closed without a valid `IRF_ENCRYPTION_KEY` |
| Stale config on the target | `infra/.env.production` is deliberately NOT synced — edit it directly on the PC |
| SSH "Host key verification failed" | set `DEPLOY_KNOWN_HOSTS` (or clear the stale key on the runner) |
| Home PC unreachable | check the tunnel (Tailscale status) / port forwarding |

---

## What deploy.sh actually does

1. Validates `infra/.env.production` (JWT, MinIO, IRF key fail-fast).
2. `docker compose build --pull` + `up -d`.
3. Waits up to 60s for the API via Caddy.
4. Runs `migrate.js` (fresh-boot bootstrap) then incremental migrations.
5. Seeds accounts + programs only when the users table is empty.