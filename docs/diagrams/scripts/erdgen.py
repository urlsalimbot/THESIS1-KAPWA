#!/usr/bin/env python3
"""Introspect the fresh-boot public schema and emit docs/diagrams/06-erd.md
in Oracle Data Modeler physical notation."""
import json, subprocess, collections

PSQL = ["psql", "-h", "/tmp/opencode/kapwa-pg", "-p", "5433", "-U", "kapwa", "-d", "erdgen", "-At", "-F", "\t"]

def q(sql):
    r = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()

DATA = {}

tables_raw = q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")
DATA["tables"] = tables_raw.split("\n") if tables_raw else []

cols_raw = q("""SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default, c.ordinal_position,
       c.character_maximum_length, c.numeric_precision, c.numeric_scale
FROM information_schema.columns c WHERE c.table_schema='public'
ORDER BY c.table_name, c.ordinal_position""")
COLUMNS = collections.defaultdict(list)
for line in cols_raw.split("\n"):
    p = line.split("\t")
    if len(p) >= 10:
        COLUMNS[p[0]].append({"name": p[1], "type": p[2], "udt": p[3], "null": p[4], "default": p[5], "pos": int(p[6]),
                              "len": p[7], "prec": p[8], "scale": p[9]})
DATA["columns"] = COLUMNS

cons_raw = q("""SELECT c.conname, c.contype, t.relname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname='public' AND c.contype IN ('p','u','f','c')
ORDER BY t.relname, c.conname""")
CONSTRAINTS = collections.defaultdict(list)
for line in cons_raw.split("\n"):
    p = line.split("\t")
    if len(p) >= 4:
        CONSTRAINTS[p[2]].append({"name": p[0], "type": p[1], "def": p[3]})
DATA["constraints"] = CONSTRAINTS

FKS = []
for tbl in DATA["tables"]:
    for item in CONSTRAINTS.get(tbl, []):
        if item["type"] != "f":
            continue
        d = item["def"]
        lhs, rhs = d.split("REFERENCES", 1)
        cols = [c.strip() for c in lhs.replace("FOREIGN KEY", "").strip().strip("()").split(",")]
        parent = rhs.split("(")[0].strip()
        pcols = [c.strip() for c in rhs.split("(", 1)[1].split(")", 1)[0].split(",")]
        FKS.append({"child": tbl, "cols": cols, "parent": parent, "pcols": pcols, "name": item["name"]})
DATA["fks"] = FKS

json.dump(DATA, open("/tmp/opencode/erd-schema.json", "w"), indent=1)
print("tables:", len(DATA["tables"]), "| fks:", len(FKS), "| constraints:", sum(len(v) for v in CONSTRAINTS.values()))