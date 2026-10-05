#!/usr/bin/env python3
"""
Regenerate docs/diagrams/06-erd.md in Oracle Data Modeler physical/relational
notation, straight from a live introspection of the KAPWA schema.

Usage:
    DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_NAME=<db> python3 erdgen2.py

Notation implemented (Oracle Data Modeler relational diagram conventions):
  * table box = header (table name) + one row per column, reading
    `column_name  datatype  <PK|FK|UK>  NN`  (name first, as Oracle draws it)
  * NN = NOT NULL ("Allow Nulls" off) shown per column
  * relationship line solid  = identifying (child PK contains the FK)
                        dashed = non-identifying
  * `||` parent end = FK NOT NULL (mandatory), `o|` = FK nullable (optional)
  * relationship label = the foreign-key constraint name
  * a parent living in another cluster is repeated here as a PK-only stub,
    the way Data Modeler lets one table belong to several subviews
"""
import collections
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "06-erd.md")
CLUSTER_DEF = json.load(open(os.path.join(HERE, "clusters.json")))

HOST = os.environ.get("DB_HOST", "localhost")
PORT = os.environ.get("DB_PORT", "5433")
USER = os.environ.get("DB_USER", "kapwa")
NAME = os.environ.get("DB_NAME", "erd_fresh")

# Tie-break target aspect ratio (landscape US Letter = 1.29).
TARGET_ASPECT = 1.2

# Usable page areas in points, mirroring print-diagrams.mjs (MARGIN = 24pt/side;
# the 16pt caption band at the foot of each page is reserved, not usable).
# Insertion order IS the print order: best_page() returns the first that clears
# the floor. Both orientations are listed because a tall diagram (`cases` is 63
# rows) clears 5pt in A3 portrait but not in A3 landscape -- and portrait is
# half the paper of A2.
PAGES = {
    "Letter":   (8.5 * 72 - 48, 11 * 72 - 64),
    "A3 land.": (16.54 * 72 - 48, 11.69 * 72 - 64),
    "A3 port.": (11.69 * 72 - 48, 16.54 * 72 - 64),
    "A2 land.": (23.4 * 72 - 48, 16.5 * 72 - 64),
    "A2 port.": (16.5 * 72 - 48, 23.4 * 72 - 64),
}

# Coarser paper ranking (both orientations of one size are equivalent), used
# when choosing between LR and TB layouts: smaller sheet wins first.
PAPER_RANK = {"Letter": 0, "A3": 1, "A2": 2}

# -------------------------------------------------------------------------
# type normalisation
#
# format_type() emits multi-word names ("character varying(255)",
# "timestamp without time zone") which Mermaid cannot parse in the datatype
# slot. These are the exact PostgreSQL aliases -- no information is lost.
# -------------------------------------------------------------------------
TYPE_ALIASES = [
    ("character varying", "varchar"),
    ("timestamp with time zone", "timestamptz"),
    ("timestamp without time zone", "timestamp"),
    ("time with time zone", "timetz"),
    ("time without time zone", "time"),
    ("double precision", "float8"),
    ("bit varying", "varbit"),
]


def norm_type(t: str) -> str:
    for long, short in TYPE_ALIASES:
        if long in t:
            t = t.replace(long, short)
    return t


# -------------------------------------------------------------------------
# introspection
# -------------------------------------------------------------------------
def psql(sql: str) -> str:
    env = dict(os.environ, PGPASSWORD=os.environ.get("DB_PASSWORD", "kapwa"))
    r = subprocess.run(
        ["psql", "-h", HOST, "-p", PORT, "-U", USER, "-d", NAME,
         "-X", "-q", "-A", "-F", "|", "-c", sql],
        capture_output=True, text=True, env=env,
    )
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        sys.exit(f"psql failed for: {sql[:80]}")
    return r.stdout


def introspect() -> dict:
    raw = psql("""
select 'TABLE|'||c.relname
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
union all
select 'COL|'||t.relname||'|'||a.attname||'|'||format_type(a.atttypid,a.atttypmod)
       ||'|'||case when a.attnotnull then 'NO' else 'YES' end
       ||'|'||coalesce(pg_get_expr(d.adbin,d.adrelid),'')||'|'||a.attnum
  from pg_attribute a
  join pg_class t on t.oid=a.attrelid
  join pg_namespace n on n.oid=t.relnamespace
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where n.nspname='public' and t.relkind='r' and a.attnum>0 and not a.attisdropped
union all
select 'CON|'||conrelid::regclass::text||'|'||contype::text||'|'||conname
       ||'|'||pg_get_constraintdef(oid)
  from pg_constraint where connamespace='public'::regnamespace
union all
select 'IDX|'||i.indexrelid::regclass::text
  from pg_index i
  join pg_class t on t.oid=i.indrelid
  join pg_namespace n on n.oid=t.relnamespace
 where n.nspname='public' and t.relkind='r'
""")
    tables, columns, constraints = [], collections.defaultdict(list), collections.defaultdict(list)
    indexes = 0
    for line in raw.splitlines():
        p = line.split("|")
        if p[0] == "TABLE":
            tables.append(p[1])
        elif p[0] == "COL":
            columns[p[1]].append({
                "name": p[2], "type": p[3], "null": p[4],
                "default": p[5], "pos": int(p[6]),
            })
        elif p[0] == "CON":
            constraints[p[1]].append({"type": p[2], "name": p[3], "def": p[4]})
        elif p[0] == "IDX":
            indexes += 1

    fks = []
    for t, items in constraints.items():
        for c in items:
            if c["type"] != "f":
                continue
            m = re.search(r"FOREIGN KEY \(([^)]*)\) REFERENCES ([\w\"]+)\(([^)]*)\)", c["def"])
            if not m:
                sys.stderr.write(f"unparsed FK: {t}.{c['name']}\n")
                continue
            fks.append({
                "child": t,
                "cols": [x.strip().strip('"') for x in m.group(1).split(",")],
                "parent": m.group(2).strip('"'),
                "pcols": [x.strip().strip('"') for x in m.group(3).split(",")],
                "name": c["name"],
                "def": c["def"],
            })
    return {
        "tables": sorted(tables),
        "columns": dict(columns),
        "constraints": dict(constraints),
        "fks": fks,
        "indexes": indexes,
    }


# -------------------------------------------------------------------------
# key sets
# -------------------------------------------------------------------------
def key_sets(S):
    pk, uk, fkcol = {}, {}, collections.defaultdict(set)
    for t, items in S["constraints"].items():
        for c in items:
            body = c["def"]
            m = re.match(r"(?:PRIMARY KEY|UNIQUE) \(([^)]*)\)", body)
            if c["type"] == "p" and m:
                pk[t] = [x.strip().strip('"') for x in m.group(1).split(",")]
            elif c["type"] == "u" and m:
                # A composite UNIQUE makes each column unique only in
                # combination with the others, which is not a per-column
                # property -- so only single-column uniques become a UK marker.
                # Composite ones are table-level constraints (Section 5).
                cols = [x.strip().strip('"') for x in m.group(1).split(",")]
                if len(cols) == 1:
                    uk.setdefault(t, set()).add(cols[0])
    for f in S["fks"]:
        for c in f["cols"]:
            fkcol[f["child"]].add(c)
    return pk, uk, fkcol


def fk_nullable(S, fk) -> bool:
    cols = {c["name"]: c for c in S["columns"].get(fk["child"], [])}
    return any(cols.get(c, {}).get("null") == "YES" for c in fk["cols"])


def fk_identifying(pk, fk) -> bool:
    """True when the child's PK is exactly (or contains) the FK columns."""
    child_pk = pk.get(fk["child"], [])
    return bool(child_pk) and set(fk["cols"]) <= set(child_pk) and len(child_pk) == len(fk["cols"])


def fk_one_to_one(S, fk) -> bool:
    """True when a UNIQUE constraint covers exactly the FK columns.

    Only then can one parent row match at most one child row; a composite
    UNIQUE that merely *includes* the FK columns does not qualify unless the
    constraint's columns are exactly the FK's.
    """
    want = set(fk["cols"])
    for c in S["constraints"].get(fk["child"], []):
        if c["type"] != "u":
            continue
        m = re.match(r"UNIQUE \(([^)]*)\)", c["def"])
        if m and {x.strip().strip('"') for x in m.group(1).split(",")} == want:
            return True
    return False


# -------------------------------------------------------------------------
# mermaid emission
# -------------------------------------------------------------------------
def emit_entity(S, pk, uk, fkcol, table, stub=False):
    lines = [f'    "{table}" {{']
    cols = S["columns"].get(table, [])
    if stub:
        keep = set(pk.get(table, []))
        cols = [c for c in cols if c["name"] in keep]
    for c in cols:
        name = c["name"]
        is_pk = name in pk.get(table, [])
        is_uk = name in uk.get(table, set())
        is_fk = name in fkcol.get(table, set())
        # Mermaid accepts exactly ONE key token per row, so pick the most
        # structural marker and fold the rest into the trailing note.
        if is_pk:
            key = "PK"
        elif is_fk:
            key = "FK"
        elif is_uk:
            key = "UK"
        else:
            key = None
        note = []
        if c["null"] == "NO":
            note.append("NN")
        if is_uk and key != "UK":
            note.append("UK")
        if is_fk and key != "FK":
            note.append("FK")
        # Mermaid grammar: <type> <name> [key] ["comment"]
        # We put the COLUMN NAME in the type slot and the DATATYPE in the name
        # slot so the row reads `name datatype` the way Oracle draws it.
        row = f"        {name} {norm_type(c['type'])}"
        if key:
            row += " " + key
        if note:
            row += ' "' + ", ".join(note) + '"'
        lines.append(row)
    lines.append("    }")
    return lines


def emit_cluster(S, pk, uk, fkcol, cluster, label_mode="constraint"):
    """Return (mermaid_source, stats)."""
    members = set(cluster["tables"])
    missing = [t for t in cluster["tables"] if t not in S["columns"]]
    if missing:
        sys.exit(f"{cluster['id']}: tables not in schema: {missing}")

    stubs = set()
    rels = []
    for fk in S["fks"]:
        if fk["child"] not in members:
            continue
        if fk["parent"] not in members:
            stubs.add(fk["parent"])
        ident = fk_identifying(pk, fk)
        dash = "--" if ident else ".."
        opt = "o|" if fk_nullable(S, fk) else "||"
        child_end = "o|" if fk_one_to_one(S, fk) else "o{"
        label = fk["name"] if label_mode == "constraint" else ",".join(fk["cols"])
        rels.append(f'    "{fk["parent"]}" {opt}{dash}{child_end} "{fk["child"]}" : "{label}"')

    body = []
    for t in cluster["tables"]:
        body += emit_entity(S, pk, uk, fkcol, t)
    for t in sorted(stubs):
        body += emit_entity(S, pk, uk, fkcol, t, stub=True)
    body += sorted(rels)

    # column/row sanity
    for t in cluster["tables"]:
        for c in S["columns"][t]:
            if " " in norm_type(c["type"]):
                sys.exit(f"multi-word type survived: {t}.{c['name']} -> {c['type']}")

    stats = {
        "tables": len(cluster["tables"]),
        "stubs": len(stubs),
        "rels": len(rels),
        "cols": sum(len(S["columns"][t]) for t in cluster["tables"]),
    }
    return body, stats


def render_size(src: str):
    """Render mermaid source; return (width, height) of its viewBox in px."""
    with tempfile.NamedTemporaryFile("w", suffix=".mmd", delete=False) as f:
        f.write(src)
        path = f.name
    out = path + ".svg"
    env = dict(os.environ)
    env.setdefault("PUPPETEER_EXECUTABLE_PATH", "/usr/bin/google-chrome-stable")
    subprocess.run(
        ["npx", "-y", "@mermaid-js/mermaid-cli", "-i", path, "-o", out, "-b", "white"],
        capture_output=True, text=True, env=env,
    )
    if not os.path.exists(out):
        return None
    s = open(out).read()
    m = re.search(r'viewBox="([\d.\- ]+)"', s)
    if not m:
        return None
    x, y, w, h = [float(v) for v in m.group(1).split()]
    return (w, h) if w > 0 and h > 0 else None


def best_page(size):
    """Smallest page print-diagrams.mjs will choose, and the text it prints at.

    This is the number that decides whether a printed cluster is legible, so
    it -- not the aspect ratio -- is what direction selection optimises.
    """
    if not size:
        return None, -1.0
    w, h = size
    for name, (uw, uh) in PAGES.items():
        p = 14 * min(uw / w, uh / h)
        if p >= 5:                       # first page that clears the floor wins
            return name, p
    # Nothing clears 5pt: take whichever A2 orientation reads larger.
    name, dims = max(
        ((n, d) for n, d in PAGES.items() if n.startswith("A2")),
        key=lambda kv: 14 * min(kv[1][0] / w, kv[1][1] / h),
    )
    return name, 14 * min(dims[0] / w, dims[1] / h)


def font_pt(size) -> float:
    """Points the diagram is actually printed at (delegates to best_page)."""
    return best_page(size)[1]


def pick_direction(cluster_body):
    """Try LR and TB; keep the one that lands on the smaller sheet of paper.

    Paper size comes first: a cluster that still clears the 5pt floor on A3
    should not be reshaped onto A2 just to gain a point or two of text. Only
    within the same paper does raw legibility decide; aspect breaks ties.
    """
    results = {}
    for d in ("LR", "TB"):
        src = "erDiagram\n    direction %s\n" % d + "\n".join(cluster_body) + "\n"
        try:
            results[d] = (render_size(src), src)
        except Exception:
            results[d] = (None, src)

    def score(item):
        size = item[1][0]
        if not size:                       # unrenderable: always lose
            return (-99, -1.0)
        name, p = best_page(size)
        paper = PAPER_RANK.get(name.split()[0], 9)   # "A3 port." -> "A3"
        return (-paper, p)

    best = max(results.items(), key=score)
    return best[0], font_pt(best[1][0]), results

# -------------------------------------------------------------------------
# markdown sections
# -------------------------------------------------------------------------
def build(S):
    pk, uk, fkcol = key_sets(S)
    n_named = sum(len(v) for v in S["constraints"].values())
    by = collections.Counter(c["type"] for v in S["constraints"].values() for c in v)
    n_nn = sum(1 for v in S["columns"].values() for c in v if c["null"] == "NO")
    n_ident = sum(1 for f in S["fks"] if fk_identifying(pk, f))
    n_opt = sum(1 for f in S["fks"] if fk_nullable(S, f))
    # Every PK is single-column, but not every one is named `id`.
    n_pkid = sum(1 for v in pk.values() if v[0] == "id")
    odd_pk = sorted(t for t, v in pk.items() if v[0] != "id")
    odd_pk_txt = ", ".join("`%s`" % t for t in odd_pk)

    # ---------------- §1 conventions ----------------
    conv = f"""# Entity Relationship Diagram — Physical Model

The **physical** data model for Kapwa, drawn in Oracle Data Modeler
physical/relational notation — every table, every column with its PostgreSQL
datatype, nullability and key markers, and every foreign-key relationship as
created by the canonical fresh-boot bootstrap
(`kapwa-server/src/database/migrate.ts`) and the TypeORM migration chain.

Regenerate with `python3 docs/diagrams/erdgen2.py` against a fresh boot —
`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_NAME` select the database and cluster
membership lives in `docs/diagrams/clusters.json`. Every number below comes
from the live catalog, not from hand-maintained prose. Re-render the printed
PDFs afterwards with `docs/diagrams/print-diagrams.mjs`.

## 1. Conventions (Oracle Data Modeler physical notation)

**Column rows** read left to right exactly as Data Modeler draws them —
column name first, datatype second:

| Element | Meaning |
|---|---|
| `name  datatype` | column name, then its PostgreSQL type |
| `PK` | primary-key column (`PRIMARY KEY (…)` on the table) |
| `UK` | column whose values are `UNIQUE` on their own (see the note below) |
| `FK` | foreign-key column (the child end of a relationship) |
| `NN` | `NOT NULL` column — Data Modeler's *Allow Nulls* set to off |

A column carries **one** key token in the key slot, in the order
PK > FK > UK. Anything a column also is goes into the trailing note, so
`user_id uuid FK \"NN, UK\"` on `team_status` is a `NOT NULL` unique foreign
key, drawn one-to-one. `UK` appears only when the uniqueness is a property of
that single column: a composite `UNIQUE` constrains a *combination* of
columns, so marking each participant alone would be false — those are listed
as table-level constraints in Section 5.

**Relationships** are crow's-foot lines carrying the FK constraint name:

| Line | Meaning |
|---|---|
| `\\|\\|..o{{` | parent **mandatory**, one-to-many — the FK is `NOT NULL`, so every child has exactly one parent, and one parent may have many children |
| `o\\|..o{{` | parent **optional**, one-to-many — the FK is nullable, so a parent row may have no children |
| `\\|\\|..o\\|` | one-to-one — the FK is also `UNIQUE`, so a parent row matches at most one child |
| **dashed** `..` | non-identifying: the child's primary key does *not* contain the FK |
| **solid** `--` | identifying: the FK columns are part of the child's primary key |

The token on the **left** of a line describes the parent as the child sees it
(`||` when the FK cannot be null, `o|` when it can); the token on the
**right** describes how many child rows one parent row may have.

> **Every relationship here is dashed.** All {len(S['tables'])} tables have a
> *single-column* primary key — {n_pkid} of them named `id`, the other
> {len(S['tables']) - n_pkid} ({odd_pk_txt}) named otherwise — so no foreign key is
> ever part of its child's primary key and {n_ident} identifying relationships
> exist. That is a property of the schema, not a rendering omission.

> **Datatypes are shown in PostgreSQL alias form** so each is a single token:
> `character varying(255)` → `varchar(255)`, `timestamp without time zone`
> → `timestamp`, `timestamp with time zone` → `timestamptz`,
> `time without time zone` → `time`. These are the same types; only the
> spelling differs.

> **Cross-cluster parents appear as PK-only stubs.** A table that is
> referenced from another subject area is repeated in this diagram showing
> only its primary key — the way Data Modeler lets one table belong to
> several subviews at once. Each relationship is drawn exactly once, in the
> cluster that owns the *child* table.

**Printing:** every cluster diagram is rendered to its own PDF by
`docs/diagrams/print-diagrams.mjs` (output in `docs/diagrams/print/`) — run
`PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs`
after editing. The script picks the smallest page — US Letter, then A3 in
either orientation, then A2 — that keeps the text at 5pt or larger.

## 2. Scope

The model contains **{len(S['tables'])} base tables,
{sum(len(v) for v in S['columns'].values())} columns ({n_nn} of them `NOT NULL`),
{n_named} constraints — {by['p']} primary keys, {by['f']} foreign keys, {by['u']}
unique, {by['c']} check and {n_nn} `NOT NULL` column constraints — and
{S['indexes']} indexes** from the `public` schema. Tables are grouped into
{len(CLUSTER_DEF)} subject-area clusters so each diagram fits a printable page;
all {by['f']} foreign keys are drawn on the diagram that owns their child table,
with full constraint definitions in Section 5.

## 3. Cluster Diagrams (physical)
"""
    parts = [conv]
    stats_all = []
    for cluster in CLUSTER_DEF:
        body, stats = emit_cluster(S, pk, uk, fkcol, cluster)
        direction, _, results = pick_direction(body)
        src = "erDiagram\n    direction %s\n" % direction + "\n".join(body) + "\n"
        page, p = best_page(results[direction][0])
        stats["pt"] = p
        stats["page"] = page
        stats_all.append((cluster, stats, direction))
        parts.append(f"\n### {cluster['id']} — {cluster['title']}\n")
        parts.append(f"*{stats['tables']} tables"
                     + (f" + {stats['stubs']} cross-cluster stub" if stats["stubs"] else "")
                     + f", {stats['rels']} relationships, {stats['cols']} columns — `{direction}`*\n")
        parts.append("\n```mermaid\n" + src + "```\n")

    # ---------------- §4 relationship inventory ----------------
    parts.append("\n## 4. Full Relationship Inventory (all %d foreign keys)\n" % len(S["fks"]))
    # parts are joined with "" below, so every appended line carries its own \n.
    parts.append("| FK Constraint | Child table (columns) | Parent table (columns) | Type | Nullable |\n")
    parts.append("|---|---|---|---|---|\n")
    for fk in sorted(S["fks"], key=lambda f: f["name"]):
        ident = "identifying" if fk_identifying(pk, fk) else "non-identifying"
        nullable = "yes" if fk_nullable(S, fk) else "no"
        parts.append(
            f"| `{fk['name']}` | `{fk['child']}({', '.join(fk['cols'])})` "
            f"| `{fk['parent']}({', '.join(fk['pcols'])})` | {ident} | {nullable} |\n"
        )

    # ---------------- §5 constraint inventory ----------------
    parts.append("\n## 5. Constraint Inventory (all %d constraints)\n" % n_named)
    parts.append("| Table | Constraint | Type | Definition |\n")
    parts.append("|---|---|---|---|\n")
    tname = {"p": "PRIMARY KEY", "f": "FOREIGN KEY", "u": "UNIQUE", "c": "CHECK"}
    rows = []
    for t in sorted(S["constraints"]):
        for c in S["constraints"][t]:
            if c["type"] not in tname:
                continue
            rows.append((t, c["name"], tname[c["type"]], c["def"]))
    for t, n, ty, d in rows:
        parts.append(f"| `{t}` | `{n}` | {ty} | `{d}` |\n")
    parts.append(
        f"\n*Plus the {n_nn} column-level `NOT NULL` constraints, listed per column "
        f"in Section 3 — {n_named - n_nn} in the table above plus {n_nn} "
        f"column-level = {n_named} in all.*\n"
    )

    return "".join(parts), stats_all


CROSS_REF = [
    ("persons", "`kapwa-server/src/beneficiaries/person.entity.ts`"),
    ("person_addresses / person_contacts",
     "`kapwa-server/src/beneficiaries/person-address.entity.ts / person-contact.entity.ts`"),
    ("beneficiaries", "`kapwa-server/src/beneficiaries/beneficiary.entity.ts`"),
    ("households, household_memberships",
     "`kapwa-server/src/beneficiaries/household.entity.ts, household-membership.entity.ts`"),
    ("beneficiary_claimants", "`kapwa-server/src/beneficiaries/beneficiary-claimant.entity.ts`"),
    ("beneficiary_roles", "`kapwa-server/src/beneficiaries/beneficiary-role.entity.ts`"),
    ("consent_ledger", "`kapwa-server/src/beneficiaries/consent-ledger.entity.ts`"),
    ("users, user_tokens", "`kapwa-server/src/auth/user.entity.ts`"),
    ("cases", "`kapwa-server/src/cases/case.entity.ts`"),
    ("case_history", "`kapwa-server/src/cases/case-history.entity.ts`"),
    ("case_requirements", "`kapwa-server/src/cases/case-requirement.entity.ts`"),
    ("case_referrals", "`kapwa-server/src/cases/case-referral.entity.ts`"),
    ("case_assistances", "`kapwa-server/src/cases/case-assistance.entity.ts`"),
    ("case_follow_up_visits", "`kapwa-server/src/cases/case-follow-up-visit.entity.ts`"),
    ("case_step_locks", "`kapwa-server/src/cases/case-step-lock.entity.ts`"),
    ("case_events, case_event_reminders, reminder_settings", "`kapwa-server/src/case-events/*.entity.ts`"),
    ("case_interventions", "`kapwa-server/src/case-interventions/case-intervention.entity.ts`"),
    ("intervention_required_documents", "`kapwa-server/src/cases/intervention-required-document.entity.ts`"),
    ("program_enrollments", "`kapwa-server/src/case-enrollments/program-enrollment.entity.ts`"),
    ("programs, program_services", "`kapwa-server/src/programs/program.entity.ts, program-service.entity.ts`"),
    ("program_fund_sources", "`kapwa-server/src/programs/program-fund-source.entity.ts`"),
    ("program_required_documents", "`kapwa-server/src/programs/program-required-document.entity.ts`"),
    ("form_version_history", "`kapwa-server/src/programs/form-version-history.entity.ts`"),
    ("referrals, inter_agency_referrals",
     "`kapwa-server/src/referrals/referral.entity.ts, kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts`"),
    ("agencies, agency_contacts", "`kapwa-server/src/agencies/agency.entity.ts`"),
    ("csr_reports", "`kapwa-server/src/csr/csr.entity.ts`"),
    ("document_vault", "`kapwa-server/src/filing/filing.entity.ts`"),
    ("irf_cases", "`kapwa-server/src/irf/irf-case.entity.ts`"),
    ("access_card_services", "`kapwa-server/src/access-cards/access-card-service.entity.ts`"),
    ("chat_messages", "`kapwa-server/src/chat/chat.entity.ts`"),
    ("notifications, notification_preferences", "`kapwa-server/src/notifications/notification.entity.ts`"),
    ("contact_messages", "`kapwa-server/src/contact-messages/contact-message.entity.ts`"),
    ("team_status, team_invites, team_schedule_blocks, office_events", "`kapwa-server/src/team/*.entity.ts`"),
    ("sync_queue, version_vectors", "`kapwa-server/src/sync/*.entity.ts`"),
    ("otp_codes", "`kapwa-server/src/otp/otp.entity.ts`"),
    ("audit_log", "`kapwa-server/src/audit/audit-log.entity.ts`"),
    ("canonical DDL (fresh-boot bootstrap)", "`kapwa-server/src/database/migrate.ts`"),
]


def main():
    S = introspect()
    print(f"introspected {len(S['tables'])} tables, "
          f"{sum(len(v) for v in S['columns'].values())} columns, "
          f"{len(S['fks'])} FKs, {S['indexes']} indexes")

    # the table added by the last schema migration is not in the original doc
    for c in CLUSTER_DEF:
        if "programs" in c["tables"] and "intervention_required_documents" not in c["tables"]:
            c["tables"].append("intervention_required_documents")

    body, stats = build(S)

    xref = ["\n## 6. Entity Cross-References\n", "", "| Table(s) | Location |", "|---|---|"]
    for t, loc in CROSS_REF:
        xref.append(f"| {t} | {loc} |")
    body += "\n".join(xref) + "\n"

    if "--out" in sys.argv:
        out = sys.argv[sys.argv.index("--out") + 1]
    else:
        out = OUT
    open(out, "w").write(body)
    print(f"wrote {out} ({len(body.splitlines())} lines)")

    print("\ncluster                 tables  stubs  rels   dir  page   pt   verdict")
    worst = 99.0
    for cluster, st, d in stats:
        pt = st.get("pt", -1)
        worst = min(worst, pt)
        verdict = "OK" if pt >= 5 else ("tight" if pt >= 4 else "TOO SMALL")
        print(f"  {cluster['id']:4} {cluster['title'][:26]:26} {st['tables']:3}  "
              f"{st['stubs']:4}  {st['rels']:4}  {d:3}  {st.get('page') or '?':5} "
              f"{pt:4.1f}  {verdict}")
    print(f"\n  smallest printed font across all clusters: {worst:.1f}pt "
          f"({'readable' if worst >= 5 else 'BELOW the 5pt floor'})")


if __name__ == "__main__":
    main()
