#!/usr/bin/env python3
"""
Extract the KAPWA PostgreSQL schema and emit Oracle-dialect DDL suitable for
import into Oracle SQL Developer Data Modeler (ODM).

Usage:
  python3 extract-oracle-ddl.py [--host H] [--port P] [--user U] [--db D] [-o out.sql]

By default it introspects the running podman kapwa-db container:
  podman exec kapwa-db psql -U kapwa -d kapwa ...
Override with --host etc. to point at any PostgreSQL instance.

Type mapping (PG -> Oracle):
  uuid                     -> VARCHAR2(36)
  text / varchar           -> VARCHAR2(<len>) or CLOB
  character varying        -> VARCHAR2(<len>)
  boolean                  -> NUMBER(1)
  smallint/integer         -> NUMBER(5)/NUMBER(10)
  bigint                   -> NUMBER(19)
  numeric(p,s)             -> NUMBER(p,s)
  double precision/real    -> NUMBER
  date                     -> DATE
  timestamp                -> TIMESTAMP
  timestamp with time zone -> TIMESTAMP WITH TIME ZONE
  jsonb                    -> CLOB (JSON; Oracle 21c 'JSON' type alternative)
  bytea                    -> BLOB
  tsvector                 -> CLOB (Oracle Text / full-text index alternative)
  <type>[] (array)         -> CLOB (app serializes to JSON)
"""
import argparse
import subprocess
import sys
import re
from collections import OrderedDict


def psql(conn, sql):
    if conn.get("container"):
        cmd = ["podman", "exec", conn["container"], "psql", "-U", conn["user"],
               "-d", conn["db"], "-t", "-A", "-F", "\t", "-c", sql]
    else:
        cmd = ["psql", "-h", conn["host"], "-p", str(conn["port"]),
               "-U", conn["user"], "-d", conn["db"], "-t", "-A", "-F", "\t", "-c", sql]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("psql error:", r.stderr[-500:], file=sys.stderr)
        sys.exit(1)
    return r.stdout


def rows(conn, sql):
    out = psql(conn, sql)
    result = []
    for line in out.splitlines():
        if not line.strip():
            continue
        result.append(line.rstrip("\n").split("\t"))
    return result


def pg_to_oracle(data_type, char_len, numeric_prec, numeric_scale):
    t = data_type.lower()
    if t == "uuid":
        return "VARCHAR2(36)"
    if t == "character varying":
        return f"VARCHAR2({int(char_len)})" if char_len else "VARCHAR2(4000)"
    if t == "text":
        return "CLOB"
    if t == "boolean":
        return "NUMBER(1)"
    if t == "smallint":
        return "NUMBER(5)"
    if t == "integer":
        return "NUMBER(10)"
    if t == "bigint":
        return "NUMBER(19)"
    if t == "numeric" or t == "decimal":
        if numeric_prec is not None and numeric_scale is not None:
            return f"NUMBER({int(numeric_prec)},{int(numeric_scale)})"
        return "NUMBER"
    if t in ("real", "double precision"):
        return "NUMBER"
    if t == "date":
        return "DATE"
    if t == "timestamp without time zone":
        return "TIMESTAMP"
    if t == "timestamp with time zone":
        return "TIMESTAMP WITH TIME ZONE"
    if t == "jsonb":
        return "CLOB"  # JSON; Oracle 21c native JSON alternative
    if t == "bytea":
        return "BLOB"
    if t == "tsvector":
        return "CLOB"  # Oracle Text / CTX_DDL alternative
    if t == "array":
        return "CLOB"  # PG array; app serializes to JSON
    return "VARCHAR2(4000)"


def ident(name, maxlen=30):
    """Oracle identifiers are <=30 chars by default; keep them clean."""
    n = re.sub(r"[^A-Za-z0-9_]", "_", name)
    return n[:maxlen].rstrip("_")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--container", default="kapwa-db")
    ap.add_argument("--host", default=None)
    ap.add_argument("--port", type=int, default=5432)
    ap.add_argument("--user", default="kapwa")
    ap.add_argument("--db", default="kapwa")
    ap.add_argument("-o", "--output", default="docs/database/kapwa-oracle-ddl.sql")
    a = ap.parse_args()

    conn = {"container": a.container, "host": a.host, "port": a.port,
            "user": a.user, "db": a.db}
    if a.host:
        conn.pop("container")

    # ---- tables + columns (ordered by ordinal) ----
    tables = OrderedDict()
    for r in rows(conn, """
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
        ORDER BY table_name
    """):
        tables[r[0]] = []

    for r in rows(conn, """
        SELECT table_name, column_name, data_type,
               COALESCE(character_maximum_length::text,''),
               COALESCE(numeric_precision::text,''), COALESCE(numeric_scale::text,''),
               COALESCE(is_nullable,''), COALESCE(column_default,''),
               ordinal_position
        FROM information_schema.columns
        WHERE table_schema='public'
        ORDER BY table_name, ordinal_position
    """):
        tn, cn, dt = r[0], r[1], r[2]
        char_len = int(r[3]) if r[3] else None
        prec = int(r[4]) if r[4] else None
        scale = int(r[5]) if r[5] else None
        nullable = r[6]
        default = r[7]
        tables.setdefault(tn, []).append({
            "name": cn, "type": dt, "char_len": char_len, "prec": prec,
            "scale": scale, "nullable": nullable, "default": default,
        })

    # ---- PKs / unique constraints ----
    pks = {}      # table -> [cols]
    uks = {}      # table -> [ [cols...] ]
    for r in rows(conn, """
        SELECT tc.table_name, tc.constraint_name, kcu.column_name, tc.constraint_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema='public' AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
        ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    """):
        tn, cn, col, ct = r[0], r[1], r[2], r[3]
        if ct == "PRIMARY KEY":
            pks.setdefault(tn, []).append(col)
        else:
            uks.setdefault(tn, []).append([cn, col])  # constraint name, column

    # group unique columns by constraint name (composite uniques)
    uks_grouped = {}
    for tn, pairs in uks.items():
        by_constraint = {}
        for cname, col in pairs:
            by_constraint.setdefault(cname, []).append(col)
        uks_grouped[tn] = list(by_constraint.values())
    uks = uks_grouped

    # ---- FKs ----
    fks = []
    for r in rows(conn, """
        SELECT tc.table_name, kcu.column_name,
               ccu.table_name AS ref_table, ccu.column_name AS ref_col,
               rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        LEFT JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
        WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
        ORDER BY tc.table_name, kcu.ordinal_position
    """):
        fks.append({"table": r[0], "col": r[1], "ref_table": r[2], "ref_col": r[3],
                    "delete_rule": r[4]})

    # ---- indexes (non-constraint, e.g. gin/trgm/b-tree) ----
    indexes = []
    for r in rows(conn, """
        SELECT tablename, indexname, indexdef FROM pg_indexes
        WHERE schemaname='public' AND indexdef NOT ILIKE '%UNIQUE INDEX%'
          AND indexname NOT IN (SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexdef ILIKE '%PRIMARY KEY%')
        ORDER BY tablename, indexname
    """):
        indexes.append({"table": r[0], "name": r[1], "def": r[2]})

    # ---- sequences / identity columns ----
    identities = {}  # table -> column(s) with GENERATED identity
    for r in rows(conn, """
        SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND is_identity='YES' OR (
          column_default IS NOT NULL AND column_default LIKE 'nextval%'
          AND table_schema='public')
        ORDER BY table_name
    """):
        identities.setdefault(r[0], []).append(r[1])

    standalone_seqs = []
    for r in rows(conn, """
        SELECT sequencename FROM pg_sequences WHERE schemaname='public'
          AND sequencename NOT LIKE '%\\_id\\_seq'
        ORDER BY 1
    """):
        standalone_seqs.append(r[0])

    # ---------- generate DDL ----------
    L = []
    L.append("-- ============================================================================")
    L.append("-- KAPWA — MSWDO Norzagaray Social Welfare System")
    L.append("-- Oracle DDL export (reverse-engineered from PostgreSQL)")
    L.append("-- Generated for import into Oracle SQL Developer Data Modeler (ODM).")
    L.append("--")
    L.append("-- Source: PostgreSQL (43 tables), translated to Oracle 19c/21c dialect.")
    L.append("-- Type notes:")
    L.append("--   uuid      -> VARCHAR2(36)   (app generates UUID v7; no DB default)")
    L.append("--   jsonb     -> CLOB           (Oracle 21c: use native JSON type if desired)")
    L.append("--   bytea     -> BLOB")
    L.append("--   tsvector  -> CLOB           (Oracle Text / CTX_DDL alternative)")
    L.append("--   <type>[]  -> CLOB           (PG arrays; application serializes as JSON)")
    L.append("--   boolean   -> NUMBER(1)")
    L.append("-- Not translated (PostgreSQL-specific): ROW LEVEL SECURITY policies,")
    L.append("--   pgAudit, CHECK constraints (e.g. cases.status IN (...), persons.gender"),
    L.append("--   IN ('Male','Female')), gen_random/uuid_generate_v7() defaults,")
    L.append("--   tsvector/gin/trgm indexes.")
    L.append("-- ============================================================================")
    L.append("")
    L.append("-- ===================== SEQUENCES / IDENTITY =====================")
    for s in standalone_seqs:
        L.append(f"CREATE SEQUENCE {s.upper()};")
    L.append("")

    L.append("-- ===================== TABLES =====================")
    for tn, cols in tables.items():
        upper = tn.upper()
        L.append(f"CREATE TABLE {upper} (")
        lines = []
        for c in cols:
            ot = pg_to_oracle(c["type"], c["char_len"], c["prec"], c["scale"])
            nn = "NOT NULL" if c["nullable"] == "NO" else "NULL"
            # identity (serial) columns -> GENERATED BY DEFAULT AS IDENTITY
            if tn in identities and c["name"] in identities[tn]:
                lines.append(f"    {c['name'].upper()} NUMBER(10) GENERATED BY DEFAULT AS IDENTITY  -- was {c['type'].lower()}, ")
                continue
            extra = ""
            if c["type"].lower() in ("jsonb", "array"):
                extra = "  -- JSON / array, stored as text (Oracle 21c: native JSON)"
            elif c["type"].lower() == "tsvector":
                extra = "  -- full-text vector (Oracle Text alternative)"
            elif c["type"].lower() == "bytea":
                extra = "  -- binary"
            elif c["type"].lower() == "uuid":
                extra = "  -- UUID v7 (application-generated)"
            lines.append(f"    {c['name'].upper()} {ot} {nn}{extra}, ")
        # PK
        constraints = []
        if tn in pks:
            pk_name = ident(f"PK_{tn}")
            pk_cols = ", ".join(c.upper() for c in pks[tn])
            constraints.append(f"CONSTRAINT {pk_name} PRIMARY KEY ({pk_cols})")
        # inline unique constraints (composite-aware)
        for uk_cols in uks.get(tn, []):
            uk_name = ident(f"UK_{tn}_{'_'.join(uk_cols)}")
            constraints.append(f"CONSTRAINT {uk_name} UNIQUE ({', '.join(c.upper() for c in uk_cols)})")
        # inline FKs
        for f in fks:
            if f["table"] == tn:
                fk_name = ident(f"FK_{f['table']}_{f['col']}")
                rule = " ON DELETE CASCADE" if f["delete_rule"] == "CASCADE" else ""
                constraints.append(f"CONSTRAINT {fk_name} FOREIGN KEY ({f['col'].upper()}) "
                                   f"REFERENCES {f['ref_table'].upper()} ({f['ref_col'].upper()}){rule}")
        if constraints:
            lines.append(",\n".join(f"    {c}" for c in constraints))
        L.append("\n".join(lines))
        L.append(");")
        L.append("")
    L.append("")

    L.append("-- ===================== INDEXES =====================")
    for ix in indexes:
        # translate to a plain b-tree-ish CREATE INDEX; keep only simple ones
        m = re.search(r"ON (?:public\.)?\w+ USING (\w+) \((.+)\)", ix["def"])
        if not m:
            continue
        method, cols = m.group(1), m.group(2)
        if method in ("gin", "gist"):
            continue  # PG-specific; not portable
        ix_name = ident(f"IX_{ix['table']}_{re.sub(r'\\s+', '_', cols)}")
        L.append(f"CREATE INDEX {ix_name} ON {ix['table'].upper()} ({cols});")
    L.append("")

    L.append("-- ===================== COMMENTS (optional, ODM-friendly) =====================")
    for tn, cols in tables.items():
        pass  # comment scaffolding; add if needed

    ddl = "\n".join(L)
    with open(a.output, "w") as f:
        f.write(ddl)
    print(f"Wrote {a.output}: {len(tables)} tables, {len(fks)} foreign keys, "
          f"{len(indexes)} indexes, {len(standalone_seqs)} sequences "
          f"({len(ddl.splitlines())} lines)")


if __name__ == "__main__":
    main()