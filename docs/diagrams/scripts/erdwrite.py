#!/usr/bin/env python3
"""Emit docs/diagrams/06-erd.md — physical model in Oracle Data Modeler notation."""
import json, collections, re

D = json.load(open("/tmp/opencode/erd-schema.json"))
TABLES = D["tables"]; COLS = D["columns"]; CONS = D["constraints"]; FKS = D["fks"]

# ---- clusters covering every table
CLUSTERS = [
    ("C1", "Identity, Users, Contacts & Agencies", [
        "persons", "person_addresses", "person_contacts", "users", "user_tokens",
        "user_barangay_assignments", "beneficiary_claimants", "beneficiary_roles",
        "agencies", "agency_contacts",
    ]),
    ("C2", "Households & Beneficiaries", ["households", "beneficiaries", "household_memberships"]),
    ("C3", "Cases, Case Files & Workflow", [
        "cases", "case_history", "case_requirements", "case_referrals",
        "case_assistances", "case_follow_up_visits", "case_compliance_items",
        "case_payouts", "case_step_locks", "case_control_counters",
        "case_events", "case_event_reminders", "reminder_settings",
    ]),
    ("C4", "Programs, Enrollments & Interventions", [
        "programs", "program_fund_sources", "program_required_documents",
        "form_version_history", "program_enrollments", "program_services",
        "case_interventions",
    ]),
    ("C5", "Referrals", ["referrals", "inter_agency_referrals"]),
    ("C6", "Documents, Reports & IRF", ["csr_reports", "document_vault", "irf_cases"]),
    ("C7", "Access Cards & Number Sequences", ["access_card_services", "access_card_seq", "irf_blotter_seq"]),
    ("C8", "Team Workspace", ["team_status", "team_invites", "team_schedule_blocks", "office_events"]),
    ("C9", "Messaging, Notifications & Content", [
        "chat_messages", "notifications", "notification_preferences",
        "contact_messages", "announcements",
    ]),
    ("C10", "Sync, Analytics, Consent & Platform", [
        "sync_queue", "version_vectors", "idempotency_keys", "consent_ledger",
        "audit_log", "otp_codes", "analysis_runs", "analysis_run_clusters",
        "analysis_run_members", "migrations",
    ]),
]
CLUSTER_OF = {}
for cid, label, tables in CLUSTERS:
    for t in tables:
        CLUSTER_OF[t] = (cid, label)
assert set(CLUSTER_OF) == set(TABLES), sorted(set(TABLES) - set(CLUSTER_OF))

TYPE_MAP = {
    "character varying": "varchar", "numeric": "decimal", "timestamp without time zone": "timestamp",
    "timestamp with time zone": "timestamptz",
}
def phys_type(c):
    dt = c["type"].lower()
    if c["udt"] == "_text":
        return "text[]"
    base = TYPE_MAP.get(dt, dt)
    if base == "varchar" and c.get("len"):
        return f"varchar({c['len']})"
    if base == "decimal" and c.get("prec"):
        sc = int(c.get("scale") or 0)
        return f"decimal({c['prec']},{sc})"
    return base

def col_def(c):
    """mermaid attribute: type name PK/FK/UK"""
    keys = c.get("keys", [])
    marker = " " + ", ".join(keys) if keys else ""
    return f"{phys_type(c)} {c['name']}{marker}"

def pk_cols(t):
    out = set()
    for x in CONS.get(t, []):
        if x["type"] == "p":
            m = re.search(r"PRIMARY KEY \(([^)]+)\)", x["def"])
            if m:
                out |= {c.strip().strip('"') for c in m.group(1).split(",")}
    return out

def mermaid_entity(t):
    pk = pk_cols(t)
    lines = [f'    "{t}" {{']
    uniq = set()
    for x in CONS.get(t, []):
        if x["type"] == "u":
            m = re.search(r"UNIQUE \((\s*[^)]+)\)", x["def"])
            if m:
                uniq |= {c.strip() for c in m.group(1).replace('"', "").split(",")}
    fkcols = collections.defaultdict(dict)
    for f in FKS:
        if f["child"] == t:
            for cc, pc in zip(f["cols"], f["pcols"]):
                fkcols[cc][f["parent"]] = pc
    for c in COLS[t]:
        keys = []
        if c["name"] in pk: keys.append("PK")
        if c["name"] in uniq: keys.append("UK")
        if c["name"] in fkcols: keys.append("FK")
        # FK to composite handled by first parent col naming
        lines.append(f"        {col_def({**c, 'keys': keys})}")
    lines.append("    }")
    return "\n".join(lines)

def rel_key(t, cname):
    for f in FKS:
        if f["child"] == t and cname in f["cols"]:
            return f
    return None

def cluster_rels(tables):
    """FK lines with both ends inside the cluster, labelled by FK column."""
    inside = set(tables)
    rels = []
    for f in FKS:
        if f["child"] in inside and f["parent"] in inside:
            rels.append(f)
    return rels

def constraints_md(t):
    if not CONS.get(t):
        return ""
    out = []
    for it in CONS[t]:
        kind = {"p": "PK_", "u": "UQ_", "f": "FK_", "c": "CHK_"}[it["type"]]
        out.append(f"    - **{kind}{it['name']}**: `{it['def']}`")
    return "\n".join(out)

def fk_line(f):
    ccols = ", ".join(f["cols"]); pcols = ", ".join(f["pcols"])
    return f'    "{f["parent"]}" ||--o{{ "{f["child"]}" : "{f["cols"][0]} -> {f["parent"]}.{f["pcols"][0]}"'

L = []
A = L.append

A("# Entity Relationship Diagram — Physical Model")
A("")
A("The **physical** data model for Kapwa, in Oracle Data Modeler notation — every table, column (with its")
A("PostgreSQL datatype, nullability, default and key markers), constraint, and foreign-key relationship as")
A("created by the canonical fresh-boot bootstrap (`kapwa-server/src/database/migrate.ts`) and the TypeORM")
A("migration chain. Introspected from a fresh boot of the current schema (Postgres 18).")
A("")
A("## 1. Conventions (Oracle Data Modeler physical notation)")
A("")
A("| Marker | Meaning |")
A("|---|---|")
A("| `PK` | Primary-key column(s) — `PRIMARY KEY (…)` per table |")
A("| `UK` | Column covered by a `UNIQUE` constraint |")
A("| `FK` | Foreign-key column — the arrow carries the column name |")
A("| `NN` | `NOT NULL` column (the mermaid blocks omit this marker; see the constraint inventory) |")
A("| `||--o{` | One-to-many (crow's foot): one parent row to zero-or-many children |")
A("| `||--||` | One-to-one |")
A("| `o|--o{` | Zero-or-one to zero-or-many |")
A("")
A("Constraints are named in the Oracle style (`PK_`, `UQ_`, `FK_`, `CHK_` prefixes) with their exact `pg_get_constraintdef` text; not every `NOT NULL` column is re-stated per column, but every `CHECK` constraint is listed verbatim.")
A("")
A("**Printing:** every cluster diagram below is rendered to its own US-Letter-size PDF by `docs/diagrams/print-diagrams.mjs` (output in `docs/diagrams/print/`) — run `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs` after editing.")
A("")
A("## 2. Scope")
A("")
A("The model contains **57 base tables, 589 columns, 123 constraints (57 primary keys, 43 foreign keys, 14 unique, 9 check)** from the `public` schema. Tables are grouped into ten subject-area clusters so each diagram fits a letter-size page; cross-cluster foreign keys are drawn in the narrative (Section 4) with their full constraint definitions in Section 5.")
A("")
A("## 3. Cluster Diagrams (physical)")
A("")

def cluster_section(cid, label, tables):
    A(f"### {cid} — {label}")
    A("")
    rels = cluster_rels(tables)
    A("```mermaid")
    A("erDiagram")
    for t in tables:
        A(mermaid_entity(t))
        A("")
    for f in rels:
        A(fk_line(f))
    A("```")
    A("")
    A("**Foreign keys within this cluster:**")
    for f in rels:
        A(f"- `{f['name']}`: `{f['child']}({', '.join(f['cols'])})` → `{f['parent']}({', '.join(f['pcols'])})`")
    if not rels:
        A("- *(none — all relationships are cross-cluster, see Section 4)*")
    # physical column tables
    A("")
    A("**Physical columns:**")
    A("")
    for t in tables:
        pk = pk_cols(t)
        uniq = set()
        for x in CONS.get(t, []):
            if x["type"] == "u":
                m = re.search(r"UNIQUE \((\s*[^)]+)\)", x["def"])
                if m:
                    uniq |= {c.strip() for c in m.group(1).replace('"', "").split(",")}
        fkc = set()
        for f in FKS:
            if f["child"] == t:
                fkc |= set(f["cols"])
        A(f"**`{t}`** (column · datatype · null · key · default)")
        A("")
        A("| Column | Datatype | Null | Key | Default |")
        A("|---|---|---|---|---|")
        for c in COLS[t]:
            key = "PK" if c["name"] in pk else ("UK" if c["name"] in uniq else ("FK" if c["name"] in fkc else ""))
            null = "YES" if c["null"] == "YES" else "NO"
            dflt = (c["default"] or "").replace("|", "\\|").replace("`", "")
            A(f"| `{c['name']}` | {phys_type(c)} | {null} | {key} | {dflt} |")
        cons = constraints_md(t)
        if cons:
            A("")
            A("Constraints:")
            A("")
            A(cons)
        if t == "case_interventions":
            A("")
            A("> ⚠ Legacy table: `case_id`, `program_id` and `program_enrollment_id` are **unconstrained** columns (no FK rows exist in `pg_constraint`); only `created_by` → `users(id)` is a real foreign key. Referential integrity for these links is enforced in the application layer (`CaseInterventionService`).")
        A("")
    cross = []
    for f in FKS:
        cid_p, _ = CLUSTER_OF[f["parent"]]
        cid_c, _ = CLUSTER_OF[f["child"]]
        if cid_p != cid_c and cid in (cid_p, cid_c):
            cross.append((f, cid_p, cid_c))
    if cross:
        A(f"**Outgoing/incoming cross-cluster foreign keys involving `{label}`:**")
        A("")
        for f, cp, cc in cross:
            A(f"- `{f['name']}`: `{f['child']}({', '.join(f['cols'])})` → `{f['parent']}({', '.join(f['pcols'])})` ({cp} → {cc})")
        A("")

for cid, label, tables in CLUSTERS:
    cluster_section(cid, label, tables)

A("## 4. Full Relationship Inventory (all 43 foreign keys)")
A("")
A("| FK Constraint | Child table (columns) | Parent table (columns) |")
A("|---|---|---|")
for f in FKS:
    A(f"| `{f['name']}` | `{f['child']}({', '.join(f['cols'])})` | `{f['parent']}({', '.join(f['pcols'])})` |")

A("")
A("## 5. Constraint Inventory (all 123)")
A("")
A("| Table | Constraint | Type | Definition |")
A("|---|---|---|---|")
kinds = {"p": "PRIMARY KEY", "u": "UNIQUE", "f": "FOREIGN KEY", "c": "CHECK"}
for t in TABLES:
    for it in CONS.get(t, []):
        A(f"| `{t}` | `{it['name']}` | {kinds[it['type']]} | `{it['def'].replace('|', '\\|')}` |")

A("")
A("## 6. Entity Cross-References")
A("")
REF = [
    ("persons", "kapwa-server/src/beneficiaries/person.entity.ts"),
    ("person_addresses / person_contacts", "kapwa-server/src/beneficiaries/person-address.entity.ts / person-contact.entity.ts"),
    ("beneficiaries", "kapwa-server/src/beneficiaries/beneficiary.entity.ts"),
    ("households, household_memberships", "kapwa-server/src/beneficiaries/household.entity.ts, household-membership.entity.ts"),
    ("beneficiary_claimants", "kapwa-server/src/beneficiaries/beneficiary-claimant.entity.ts"),
    ("beneficiary_roles", "kapwa-server/src/beneficiaries/beneficiary-role.entity.ts"),
    ("consent_ledger", "kapwa-server/src/beneficiaries/consent-ledger.entity.ts"),
    ("users, user_tokens", "kapwa-server/src/auth/user.entity.ts"),
    ("cases", "kapwa-server/src/cases/case.entity.ts"),
    ("case_history", "kapwa-server/src/cases/case-history.entity.ts"),
    ("case_requirements", "kapwa-server/src/cases/case-requirement.entity.ts"),
    ("case_referrals", "kapwa-server/src/cases/case-referral.entity.ts"),
    ("case_assistances", "kapwa-server/src/cases/case-assistance.entity.ts"),
    ("case_follow_up_visits", "kapwa-server/src/cases/case-follow-up-visit.entity.ts"),
    ("case_step_locks", "kapwa-server/src/cases/case-step-lock.entity.ts"),
    ("case_events, case_event_reminders, reminder_settings", "kapwa-server/src/case-events/*.entity.ts"),
    ("case_interventions", "kapwa-server/src/case-interventions/case-intervention.entity.ts"),
    ("program_enrollments", "kapwa-server/src/case-enrollments/program-enrollment.entity.ts"),
    ("programs, program_services", "kapwa-server/src/programs/program.entity.ts, program-service.entity.ts"),
    ("program_fund_sources", "kapwa-server/src/programs/program-fund-source.entity.ts"),
    ("program_required_documents", "kapwa-server/src/programs/program-required-document.entity.ts"),
    ("form_version_history", "kapwa-server/src/programs/form-version-history.entity.ts"),
    ("referrals, inter_agency_referrals", "kapwa-server/src/referrals/referral.entity.ts, kapwa-server/src/inter-agency-referrals/inter-agency-referral.entity.ts"),
    ("agencies, agency_contacts", "kapwa-server/src/agencies/agency.entity.ts"),
    ("csr_reports", "kapwa-server/src/csr/csr.entity.ts"),
    ("document_vault", "kapwa-server/src/filing/filing.entity.ts"),
    ("irf_cases", "kapwa-server/src/irf/irf-case.entity.ts"),
    ("access_card_services", "kapwa-server/src/access-cards/access-card-service.entity.ts"),
    ("chat_messages", "kapwa-server/src/chat/chat.entity.ts"),
    ("notifications, notification_preferences", "kapwa-server/src/notifications/notification.entity.ts"),
    ("contact_messages", "kapwa-server/src/contact-messages/contact-message.entity.ts"),
    ("team_status, team_invites, team_schedule_blocks, office_events", "kapwa-server/src/team/*.entity.ts"),
    ("sync_queue, version_vectors", "kapwa-server/src/sync/*.entity.ts"),
    ("otp_codes", "kapwa-server/src/otp/otp.entity.ts"),
    ("audit_log", "kapwa-server/src/audit/audit-log.entity.ts"),
    ("canonical DDL (fresh-boot bootstrap)", "kapwa-server/src/database/migrate.ts"),
]
A("| Table(s) | Location |")
A("|---|---|")
for t, loc in REF:
    A(f"| {t} | `{loc}` |")

open("/home/typwtypw/Documents/NC/THESIS1-KAPWA/docs/diagrams/06-erd.md", "w").write("\n".join(L) + "\n")
print("written:", len(L), "lines")