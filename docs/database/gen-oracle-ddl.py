#!/usr/bin/env python3
"""
Generate docs/database/kapwa-oracle.ddl -- an Oracle translation of the KAPWA
PostgreSQL schema, shaped for Oracle SQL Developer Data Modeler's
File > Import > DDL File.

Usage:
    DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_NAME=erd_fresh \
        python3 gen-oracle-ddl.py

Design notes (why the file looks the way it does):

* Import order. Data Modeler's DDL importer wants the CREATE TABLE statements
  grouped apart from ALTER TABLE ... ADD CONSTRAINT and CREATE INDEX. So: one
  block of tables, then foreign keys, then indexes. Primary keys, unique
  constraints and checks stay inline -- they are part of the table definition
  in the SQL standard and every parser handles them there.

* text -> VARCHAR2(4000), not CLOB. Oracle cannot build a B-tree index on a LOB
  (ORA-02327), and it will not compare one either (ORA-00932). Mapping text to
  CLOB would invalidate the unique constraints, the check constraints and most
  of the indexes. jsonb / tsvector / arrays keep CLOB: nothing indexes or
  checks them. A guard below asserts this rather than trusting it.

* Partial indexes. Oracle has none. A partial index whose predicate is only
  `col IS NOT NULL` becomes a plain UNIQUE index -- Oracle unique indexes
  already permit many NULLs, so the two are equivalent. Partial indexes with a
  value predicate, and the two GIN indexes, are emitted as comments so the
  information survives without breaking the import.
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "kapwa-oracle.ddl")

HOST = os.environ.get("DB_HOST", "localhost")
PORT = os.environ.get("DB_PORT", "5433")
USER = os.environ.get("DB_USER", "kapwa")
NAME = os.environ.get("DB_NAME", "erd_fresh")

# Oracle SQL reserved words (Oracle Database SQL Language Reference). These
# cannot be used as non-quoted identifiers, so no table/column/constraint name
# in the schema may collide with one.
ORACLE_RESERVED = {
    "ACCESS", "ADD", "ALL", "ALTER", "AND", "ANY", "AS", "ASC", "AUDIT",
    "BETWEEN", "BY", "CHAR", "CHECK", "CLUSTER", "COLUMN", "COLUMN_VALUE",
    "COMMENT", "COMPRESS", "CONNECT", "CREATE", "CURRENT", "DATE", "DECIMAL",
    "DEFAULT", "DELETE", "DESC", "DISTINCT", "DROP", "ELSE", "EXCLUSIVE",
    "EXISTS", "FILE", "FLOAT", "FOR", "FROM", "GRANT", "GROUP", "HAVING",
    "IDENTIFIED", "IMMEDIATE", "IN", "INCREMENT", "INDEX", "INITIAL",
    "INSERT", "INTEGER", "INTERSECT", "INTO", "IS", "LEVEL", "LIKE", "LOCK",
    "LONG", "MAXEXTENTS", "MINUS", "MLSLABEL", "MODE", "MODIFY",
    "NESTED_TABLE_ID", "NOAUDIT", "NOCOMPRESS", "NOT", "NOWAIT", "NULL",
    "NUMBER", "OF", "OFFLINE", "ON", "ONLINE", "OPTION", "OR", "ORDER",
    "PCTFREE", "PRIOR", "PRIVILEGES", "PUBLIC", "RAW", "RENAME", "RESOURCE",
    "REVOKE", "ROW", "ROWID", "ROWNUM", "ROWS", "SELECT", "SESSION", "SET",
    "SHARE", "SIZE", "SMALLINT", "START", "SUCCESSFUL", "SYNONYM", "SYSDATE",
    "TABLE", "THEN", "TO", "TRIGGER", "UID", "UNION", "UNIQUE", "UPDATE",
    "USER", "VALIDATE", "VALUES", "VARCHAR", "VARCHAR2", "VIEW", "WHENEVER",
    "WHERE", "WITH",
}

NON_INDEXABLE = {"CLOB", "BLOB", "NCLOB", "LONG"}


def psql_rows(sql):
    """Run a query, return a list of field-lists (tab separated, no header)."""
    env = dict(os.environ, PGPASSWORD=os.environ.get("DB_PASSWORD", "kapwa"))
    r = subprocess.run(
        ["psql", "-h", HOST, "-p", PORT, "-U", USER, "-d", NAME,
         "-A", "-t", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True, env=env)
    if r.returncode:
        sys.exit(f"psql failed: {r.stderr.strip()}\nquery: {sql[:200]}")
    return [ln.split("\t") for ln in r.stdout.splitlines() if ln.strip()]


# ---------------------------------------------------------------------------
# catalog
# ---------------------------------------------------------------------------
def load():
    tables = [r[0] for r in psql_rows("""
        SELECT c.relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
         ORDER BY 1""")]

    columns = {}
    for tbl, col, typ, nn, default, pos in psql_rows("""
        SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
               a.attnotnull,
               coalesce(pg_get_expr(d.adbin, d.adrelid), '<none>'),
               a.attnum
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY c.relname, a.attnum"""):
        columns.setdefault(tbl, []).append(
            {"name": col, "type": typ, "notnull": nn == "t",
             "default": None if default == "<none>" else default,
             "pos": int(pos)})

    cons = []
    for tbl, cname, ctype, cdef in psql_rows("""
        SELECT c.relname, con.conname, con.contype,
               pg_get_constraintdef(con.oid)
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = con.connamespace
         WHERE n.nspname = 'public'
         ORDER BY c.relname, con.conname"""):
        cons.append({"table": tbl, "name": cname, "type": ctype, "def": cdef})

    # indexes not backing a primary key / unique constraint
    idx_rows = psql_rows("""
        SELECT i.tablename, i.indexname, i.indexdef
          FROM pg_indexes i
         WHERE i.schemaname = 'public'
           AND i.indexname NOT IN (
                 SELECT c.relname FROM pg_constraint con
                   JOIN pg_class c ON c.oid = con.conindid
                  WHERE con.conindid <> 0)
         ORDER BY i.tablename, i.indexname""")
    return tables, columns, cons, idx_rows


# ---------------------------------------------------------------------------
# translation
# ---------------------------------------------------------------------------
def oracle_type(pg_type):
    """PostgreSQL type -> Oracle type. Raises on anything unexpected."""
    t = pg_type.strip()
    if t.endswith("[]"):
        return "CLOB"                      # PG arrays serialise as JSON client-side
    if t == "uuid":
        return "VARCHAR2(36)"
    if t == "text":
        return "VARCHAR2(4000)"
    m = re.fullmatch(r"character varying\((\d+)\)", t)
    if m:
        return f"VARCHAR2({m.group(1)})"
    if t == "character varying":
        return "VARCHAR2(4000)"
    m = re.fullmatch(r"character\((\d+)\)", t)
    if m:
        return f"CHAR({m.group(1)})"
    if t == "character":
        return "CHAR(1)"
    if t == "integer":
        return "NUMBER(10)"
    if t == "bigint":
        return "NUMBER(19)"
    if t == "smallint":
        return "NUMBER(5)"
    m = re.fullmatch(r"numeric\((\d+)(?:,\s*(\d+))?\)", t)
    if m:
        return "NUMBER(" + m.group(1) + (f", {m.group(2)}" if m.group(2) else "") + ")"
    if t == "numeric":
        return "NUMBER"
    if t == "double precision":
        return "FLOAT"
    if t == "real":
        return "BINARY_FLOAT"
    if t == "boolean":
        return "NUMBER(1)"
    if t == "date":
        return "DATE"
    if t == "timestamp without time zone":
        return "TIMESTAMP"
    if t == "timestamp with time zone":
        return "TIMESTAMP WITH TIME ZONE"
    if t == "time without time zone":
        return "TIMESTAMP"                 # Oracle has no TIME type
    if t in ("jsonb", "json", "tsvector"):
        return "CLOB"
    if t == "bytea":
        return "BLOB"
    raise SystemExit(f"unhandled PostgreSQL type: {pg_type!r}")


def oracle_default(pg_type, raw):
    """PostgreSQL default -> Oracle default expression (None = drop it)."""
    if raw is None:
        return None
    r = raw.strip()
    if r == "now()":
        if pg_type == "timestamp with time zone":
            return "SYSTIMESTAMP"
        if pg_type == "date":
            return "SYSDATE"
        return "LOCALTIMESTAMP"
    if r == "uuid_generate_v7()":
        return None                        # generated by the application
    if r in ("true", "false"):
        return "1" if r == "true" else "0"
    if re.fullmatch(r"-?\d+(\.\d+)?", r):
        return r
    if r.startswith("nextval("):
        return None                        # becomes GENERATED ... AS IDENTITY
    m = re.fullmatch(r"'((?:[^']|'')*)'::[a-z ]+", r)
    if m:
        return "'" + m.group(1) + "'"
    raise SystemExit(f"unhandled default: {raw!r}")


CAST_RE = re.compile(
    r"::\s*(?:character\s+varying|(?:timestamp|time)\s+without\s+time\s+zone"
    r"|(?:timestamp|time)\s+with\s+time\s+zone|[a-z_]+)(?:\s*\[\])?", re.I)


def strip_casts(s):
    """Drop PostgreSQL casts, leaving quoted literals alone."""
    out, i, n = [], 0, len(s)
    while i < n:
        if s[i] == "'":
            j = i + 1
            while j < n:
                if s[j] == "'":
                    if j + 1 < n and s[j + 1] == "'":
                        j += 2
                        continue
                    j += 1
                    break
                j += 1
            out.append(s[i:j])
            i = j
            continue
        m = CAST_RE.match(s, i)
        if m:
            i = m.end()
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def any_to_in(s):
    """Rewrite `x = ANY (ARRAY[...])` to `x IN (...)` using paren matching."""
    while True:
        m = re.search(r"=\s*ANY\s*\(", s)
        if not m:
            return s
        start = m.end()
        depth, i = 1, start
        while i < len(s):
            if s[i] == "(":
                depth += 1
            elif s[i] == ")":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        if depth:
            raise SystemExit(f"unbalanced ANY expression: {s!r}")
        inner = s[start:i].strip()
        while inner.startswith("(") and inner.endswith(")"):
            inner = inner[1:-1].strip()
        m2 = re.fullmatch(r"ARRAY\[(.*)\]", inner, re.S)
        if not m2:
            raise SystemExit(f"unhandled ANY form: {inner!r} in {s!r}")
        s = s[:m.start()].rstrip() + " IN (" + m2.group(1) + ")" + s[i + 1:]


def oracle_check(pg_def):
    """`CHECK (<pg expr>)` -> `CHECK (<oracle expr>)`."""
    expr = strip_casts(pg_def)
    expr = any_to_in(expr)
    left = re.search(r"::|\bANY\b|\bARRAY\b|\bnow\s*\(|\btrue\b|\bfalse\b",
                     expr, re.I)
    if left:
        raise SystemExit(
            f"check left untranslated ({left.group(0)!r}): {expr!r}")
    if not balance_ok(expr):
        raise SystemExit(f"unbalanced check expression: {expr!r}")
    return expr


def balance_ok(s):
    depth = 0
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


def index_columns(indexdef):
    """Column names of the key portion of a CREATE INDEX statement."""
    key = re.search(r"\(([^()]*)\)", indexdef)
    if not key:
        return []
    cols = []
    for part in key.group(1).split(","):
        part = part.strip()
        if not part:
            continue
        # drop an operator class such as `surname gin_trgm_ops`
        cols.append(re.split(r"\s+", part)[0])
    return cols


def partial_predicate(indexdef):
    m = re.search(r"\s+WHERE\s+(.*)$", indexdef, re.S | re.I)
    return m.group(1).strip() if m else None


def emit_index(indexdef):
    """
    Returns (statement_or_None, comment_or_None, usable_columns).

    statement is emitted as real DDL; comment holds a PostgreSQL form that
    Oracle cannot express. usable_columns are the columns that must not end up
    mapped to a LOB.
    """
    m = re.match(
        r"CREATE (UNIQUE )?INDEX (\S+) ON (?:public\.)?(\S+) "
        r"USING \w+ \(([^()]*)\)(.*)$", indexdef, re.S)
    if not m:
        raise SystemExit(f"unhandled index form: {indexdef}")
    unique, name, tbl, cols_raw, tail = m.groups()
    cols = [re.split(r"\s+", c.strip())[0] for c in cols_raw.split(",") if c.strip()]
    pred = partial_predicate(indexdef)
    collist = ", ".join(cols)
    verb = "CREATE UNIQUE INDEX" if unique else "CREATE INDEX"

    if "USING gin" in indexdef or "USING gist" in indexdef:
        return (None,
                f"-- {indexdef.replace('public.', '')}\n"
                f"--   ^ GIN/GiST index: no Oracle equivalent in plain DDL;"
                f" use Oracle Text / a function-based index instead.",
                [])

    if pred is None:
        return (f"{verb} {name} ON {tbl} ({collist});", None, cols)

    # `WHERE (col IS NOT NULL)` -> plain index (Oracle unique indexes already
    # allow any number of NULLs, so the two are equivalent).
    nn = re.fullmatch(r"\(?\s*(?:\w+\.)?(\w+)\s+IS NOT NULL\s*\)?", pred)
    if nn:
        if nn.group(1) in cols:
            return (f"{verb} {name} ON {tbl} ({collist});", None, cols)
        return (None,
                f"-- {indexdef.replace('public.', '')}\n"
                f"--   ^ partial index, predicate is not on an indexed column.",
                [])

    return (None,
            f"-- {indexdef.replace('public.', '')}\n"
            f"--   ^ PostgreSQL partial index. Oracle has no partial indexes;"
            f" the predicate\n--     {pred}\n"
            f"--     would have to become a function-based index.",
            [])


# ---------------------------------------------------------------------------
# assembly
# ---------------------------------------------------------------------------
def main():
    tables, columns, cons, idx_rows = load()

    pk = {c["table"]: c for c in cons if c["type"] == "p"}
    uniques = [c for c in cons if c["type"] == "u"]
    fks = [c for c in cons if c["type"] == "f"]
    checks = [c for c in cons if c["type"] == "c"]

    # Work out which indexes can be expressed in Oracle before deciding types:
    # every column they touch must end up indexable (i.e. not a LOB).
    emitted_idx, commented_idx = [], []
    must_indexable = set()                  # (table, column) pairs
    for tbl, name, indexdef in idx_rows:
        stmt, note, usable = emit_index(indexdef)
        if stmt:
            emitted_idx.append((tbl, stmt))
            must_indexable.update((tbl, c) for c in usable)
        else:
            commented_idx.append((name, note))

    # Primary key and unique-constraint columns are backed by indexes too.
    for c in cons:
        if c["type"] in ("p", "u"):
            cols = re.search(r"\(([^()]*)\)", c["def"])
            if cols:
                must_indexable.update(
                    (c["table"], x.strip())
                    for x in cols.group(1).split(",") if x.strip())

    types = {}                              # (table, column) -> oracle type
    for tbl in tables:
        for col in columns[tbl]:
            types[(tbl, col["name"])] = oracle_type(col["type"])

    # Guard: nothing an index or key depends on may be a LOB.
    for key, typ in types.items():
        if key in must_indexable and typ.split("(")[0].split()[0] in NON_INDEXABLE:
            raise SystemExit(
                f"{key[0]}.{key[1]} is indexed/keyed but maps to {typ} -- "
                f"Oracle cannot index a LOB")

    # Oracle forbids reserved words as unquoted identifiers but allows them as
    # quoted ones. Quote the handful of collisions, and insist that nothing
    # else refers to them -- a column quoted in CREATE TABLE but not in a
    # constraint would silently produce SQL that does not parse.
    reserved_cols = set()
    for tbl in tables:
        if tbl.upper() in ORACLE_RESERVED:
            raise SystemExit(f"table name is an Oracle reserved word: {tbl} -- "
                             f"rename it before generating")
        for col in columns[tbl]:
            ident = col["name"]
            if len(ident) > 128:
                raise SystemExit(f"identifier too long for Oracle: {ident}")
            if ident.upper() in ORACLE_RESERVED:
                reserved_cols.add((tbl, ident))
    for c in cons:
        if c["type"] == "n":
            continue                        # NOT NULL: emitted inline, already quoted
        if len(c["name"]) > 128:
            raise SystemExit(f"constraint name too long for Oracle: {c['name']}")
        for _, ident in reserved_cols:
            if re.search(rf"\b{re.escape(ident)}\b", c["def"], re.I):
                raise SystemExit(
                    f"reserved word {ident!r} is referenced by constraint "
                    f"{c['name']} on {c['table']}; quoting the column alone "
                    f"would not be enough")
    for tbl, stmt in emitted_idx:
        for _, ident in reserved_cols:
            if re.search(rf"\b{re.escape(ident)}\b", stmt, re.I):
                raise SystemExit(
                    f"reserved word {ident!r} is referenced by an index on "
                    f"{tbl}; quoting the column alone would not be enough")

    # ---------------- tables ----------------
    table_blocks = []
    identity_cols = set()
    for tbl in tables:
        lines = []
        for col in columns[tbl]:
            otype = types[(tbl, col["name"])]
            default = oracle_default(col["type"], col["default"])
            is_identity = default is None and col["default"] and \
                col["default"].startswith("nextval(")
            if is_identity:
                identity_cols.add((tbl, col["name"]))
                if otype not in ("NUMBER(10)", "NUMBER(19)"):
                    raise SystemExit(f"identity column must be numeric: {tbl}.{col['name']} ({otype})")
            frag = f"    {col['name']} {otype}"
            if (tbl, col["name"]) in reserved_cols:
                frag = f'    "{col["name"]}" {otype}'
            if is_identity:
                # Oracle implies NOT NULL for identity columns, so do not repeat it.
                frag += " GENERATED BY DEFAULT AS IDENTITY"
            else:
                if default is not None:
                    frag += f" DEFAULT {default}"
                if col["notnull"]:
                    frag += " NOT NULL"
            lines.append(frag + ",")

        def inline(table, kind):
            return [c for c in cons
                    if c["table"] == table and c["type"] == kind]

        tagged = []
        for c in inline(tbl, "p"):
            tagged.append(f"    CONSTRAINT {c['name']} {c['def']},")
        for c in inline(tbl, "u"):
            tagged.append(f"    CONSTRAINT {c['name']} {c['def']},")
        for c in sorted(inline(tbl, "c"), key=lambda x: x["name"]):
            tagged.append(f"    CONSTRAINT {c['name']} {oracle_check(c['def'])},")

        body = lines + tagged
        if body:
            body[-1] = body[-1].rstrip(",")
        table_blocks.append(f"CREATE TABLE {tbl} (\n" + "\n".join(body) + "\n);")

    # ---------------- foreign keys ----------------
    fk_lines = []
    for c in fks:
        fk_lines.append(f"ALTER TABLE {c['table']} ADD CONSTRAINT {c['name']}\n"
                        f"    {c['def']};")

    # ---------------- indexes ----------------
    idx_lines = [stmt for _, stmt in emitted_idx]

    # ---------------- header ----------------
    header = f"""\
-- ============================================================================
-- KAPWA - MSWDO Norzagaray Social Welfare System
-- Oracle DDL, translated from the PostgreSQL schema in kapwa-schema.sql.
--
-- Import into Oracle SQL Developer Data Modeler:
--   File > Import > DDL File  ->  add kapwa-oracle.ddl
--   -> pick the Oracle Database version  ->  OK  ->  Compare Model  ->  Merge.
--   The CREATE TABLE block is kept apart from the ALTER TABLE ... and
--   CREATE INDEX statements, which is what the importer expects.
--
-- Contents: {len(tables)} tables, {len(fks)} foreign keys, {len(uniques)} unique constraints,
--   {len(checks)} check constraints, {len(emitted_idx)} indexes
--   ({len(commented_idx)} further indexes are listed as comments, see the INDEX section).
--
-- Type map (PostgreSQL -> Oracle):
--   uuid                        -> VARCHAR2(36)   the application generates UUIDv7
--   text                        -> VARCHAR2(4000)
--   varchar(n) / char(n)        -> VARCHAR2(n) / CHAR(n)
--   boolean                     -> NUMBER(1)      true = 1, false = 0
--   integer / bigint            -> NUMBER(10) / NUMBER(19)
--   numeric(p,s)                -> NUMBER(p,s)
--   timestamp / timestamptz     -> TIMESTAMP / TIMESTAMP WITH TIME ZONE
--   time                        -> TIMESTAMP      Oracle has no TIME type
--   jsonb / tsvector / <type>[] -> CLOB
--   bytea                       -> BLOB
--
-- text maps to VARCHAR2 rather than CLOB on purpose: Oracle cannot build a
-- B-tree index on a LOB (ORA-02327) and cannot compare one (ORA-00932), so
-- CLOB would invalidate the unique constraints, the check constraints and most
-- indexes. A generator guard enforces this. If you intend to *execute* this on
-- a real Oracle instance, promote the long-form content columns (HTML bodies
-- and the like) to CLOB -- none of them is indexed or checked.
--
-- Defaults: now() -> LOCALTIMESTAMP / SYSTIMESTAMP / SYSDATE, true/false -> 1/0,
--   uuid_generate_v7() dropped (application-generated), nextval(...) rewritten
--   as GENERATED BY DEFAULT AS IDENTITY.
--
-- Not translated (PostgreSQL-only, noted where relevant): row-level security
--   policies, the uuid-ossp / pgcrypto / pg_trgm extensions, the hash-chain
--   audit triggers, and the partial / GIN indexes listed as comments below.
--
-- No table or column comments exist in the source schema, so there is no
-- COMMENT ON section.
--
-- Regenerate: DB_NAME=<live db> python3 gen-oracle-ddl.py   (this directory)
-- ============================================================================

"""

    # ---------------- write ----------------
    parts = [header,
             "-- =========================== TABLES ===========================\n\n",
             "\n\n".join(table_blocks),
             "\n\n\n-- ====================== FOREIGN KEYS ============================\n\n",
             "\n".join(fk_lines),
             "\n\n\n-- ========================== INDEXES =============================\n\n",
             "\n".join(idx_lines)]
    if commented_idx:
        parts.append("\n\n-- Indexes that PostgreSQL supports and plain Oracle DDL does not."
                     "\n-- Left as comments so nothing is lost and the import still parses."
                     "\n\n")
        parts.append("\n\n".join(note for _, note in commented_idx))
    parts.append("\n")

    open(OUT, "w", encoding="ascii").write("".join(parts))

    print(f"wrote {OUT}")
    print(f"  tables        {len(tables)}")
    print(f"  foreign keys  {len(fks)}")
    print(f"  uniques       {len(uniques)}")
    print(f"  checks        {len(checks)}")
    print(f"  indexes       {len(emitted_idx)} emitted, {len(commented_idx)} commented")
    print(f"  identity cols {len(identity_cols)}")


if __name__ == "__main__":
    main()
