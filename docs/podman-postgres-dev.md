# Using Podman Postgres for Local Development

The Kapwa API needs a local PostgreSQL for development and for running TypeORM
migrations / tests. The default Docker tooling requires the Docker daemon, which
is not always available on this machine. **Use Podman instead.**

Podman (v6) and `podman-compose` are already installed:

```bash
podman --version   # podman version 6.x
podman-compose --version
```

## One-time setup

### 1. Podman machine / storage

Podman can warn about a graph-driver mismatch (`overlay` vs `vfs`). This is
harmless; Podman falls back to `vfs`. If you want to silence it and use the
`overlay` driver:

```bash
# only if you have never used podman on this machine before
rm -rf ~/.local/share/containers/storage
```

### 2. Registries config (optional)

The compose file references short names (`postgres`, `minio/minio`, `caddy`).
Add an alias config once so those short names resolve:

```bash
sudo mkdir -p /etc/containers/registries.conf.d
sudo tee /etc/containers/registries.conf.d/99-kapwa.conf <<-'EOF'
  [aliases]
    "postgres" = "docker.io/library/postgres"
    "minio/minio" = "docker.io/minio/minio"
    "caddy" = "docker.io/library/caddy"
  [registries.search]
    registries = ["docker.io"]
EOF
```

Without this, prefix images with `docker.io/` manually (see below).

## Starting the dev database

The compose file is at `kapwa-server/docker-compose.yml`. The `db` service
builds a Postgres 16 image with `pgaudit` and the Kapwa extensions
(`uuid-ossp`, `pgcrypto`, `pg_trgm`) and exposes port `5432`.

From `kapwa-server/`:

```bash
# start only the database (recommended for local dev — don't run the api service)
podman-compose up -d db
```

If the registries alias is not configured, build/run with the full name:

```bash
# one-off: point podman-compose at the aliased names, or build the image directly:
cd kapwa-server
podman build -t kapwa-db -f Dockerfile.db .
podman run -d --name kapwa-db \
  -e POSTGRES_USER=kapwa -e POSTGRES_PASSWORD=kapwa -e POSTGRES_DB=kapwa \
  -p 5432:5432 \
  kapwa-db
```

The DB defaults (`DB_USER=kapwa`, `DB_PASSWORD=kapwa`, `DB_NAME=kapwa`,
`DB_HOST=localhost`, `DB_PORT=5432`) match `kapwa-server/.env`, so no env
changes are needed.

## Verifying

```bash
pg_isready -h localhost -p 5432
# or
psql -h localhost -p 5432 -U kapwa -d kapwa -c "SELECT 1;"
```

## Running migrations / starting the API

With the podman DB up on `localhost:5432`, from `kapwa-server/`:

```bash
npm run migration:run      # apply TypeORM migrations
npm run start:dev          # start the NestJS API (also bootstraps migrate.ts)
npm run test               # run tests against the local DB
```

## Stopping and cleaning up

```bash
podman-compose down        # stop and remove containers (keeps the kapwa-data volume)
podman-compose down -v     # also delete the DB data volume
podman rm -f kapwa-db      # remove a manually-created container
```

## Notes

- **Do not** point the dev build at the host-system PostgreSQL unless you
  explicitly need to debug schema provisioning there.
- The database is provisioned in this order: `init.sh` extensions →
  `migrate.ts` bootstrap (at API boot) → TypeORM migrations (`migrations/`).
- To test a truly fresh database, wipe the podman volume first:
  `podman-compose down -v && podman-compose up -d db`.
