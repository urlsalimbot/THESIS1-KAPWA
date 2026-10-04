/**
 * Team-workspace demo seed — calendar simulation for LAN testing.
 *
 * Simulates a full MSWDO staff roster on the team workspace calendar:
 *   - 10 NEW social workers (realistic Filipino names, worker.<surname>@mswdo.test,
 *     bcrypt 'worker123') + 2 NEW coordinators (coordinator.minuyan@mswdo.test /
 *     coordinator.soriano@mswdo.test, bcrypt 'coordinator123', primary barangay
 *     assignments via user_barangay_assignments) — the workspace roster
 *     (admin + social_workers, zero-filled by the achievements rollup) lands
 *     at ~13 staff including the existing admin/worker1/worker2.
 *   - Schedule blocks for every new + existing social worker across the
 *     CURRENT week (Mon–Fri): 2–4 blocks each, deterministic mix of
 *     in_office / home_visit / field_day / on_leave / remote, a couple with
 *     start/end times, 1–2 with visible_to='team_coordinators' per new worker
 *     (they hold a primary barangay, so coordinators can actually see them).
 *   - One whereabouts status per staff (mix of types + notes), two toggled to
 *     'team_coordinators'.
 *   - 3 office events this week (Team Meeting weekly-repeat, Medical Mission
 *     staff-coordinators-visible, FDS Session), all owned by admin.
 *   - 3 schedule invites: 2 pending worker→worker, 1 accepted (materialized
 *     block owned by the invitee + accepted status — mirrors the service's
 *     accept path directly in SQL).
 *   - Modest achievements history per new social worker: 2–3 case_history
 *     rows (actor = staff, existing case ids), 1–2 case_interventions
 *     (created_by = staff), 1 document_vault row (uploaded_by = staff,
 *     category 'requirement') — all dated within the current week so the
 *     /team/achievements rollup populates.
 *
 * Direct DB inserts with explicit JS-generated UUIDs (uuid v7, no
 * uuid_generate_v7 dependency — same generator the entities use). Idempotent:
 * users land via ON CONFLICT (email) DO NOTHING (per-account skip, like
 * seed-demo; the seed also ADOPTS pre-existing accounts under the same
 * emails, so it is safe to run before or after seed-accounts), and every
 * team row is guarded by NOT EXISTS / ON CONFLICT so re-runs are no-ops.
 *
 * Run: npm run seed:team-demo
 */
import { v7 as uuidv7 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import { BARANGAYS } from '../common/constants';

const SALT_ROUNDS = 12;
const WORKER_PASSWORD = 'worker123';
const COORDINATOR_PASSWORD = 'coordinator123';

// --- New staff roster ---------------------------------------------------------

interface NewSocialWorker {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  homeBarangay: string;
}

interface NewCoordinator {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  barangay: string;
}

// homeBarangay = primary assignment (is_primary true in user_barangay_assignments)
// so each new worker's team_coordinators blocks are visible to the barangay's
// coordinator — the visible_to toggle is meaningless without a primary row.
const SOCIAL_WORKERS: NewSocialWorker[] = [
  { email: 'worker.natividad@mswdo.test', firstName: 'Maria Lourdes', middleName: 'C.', lastName: 'Natividad', phone: '09171234501', homeBarangay: 'Minuyan' },
  { email: 'worker.bautista@mswdo.test', firstName: 'Ramon', middleName: 'B.', lastName: 'Bautista', phone: '09171234502', homeBarangay: 'Bigte' },
  { email: 'worker.deguzman@mswdo.test', firstName: 'Francis', middleName: 'A.', lastName: 'De Guzman', phone: '09171234503', homeBarangay: 'Poblacion' },
  { email: 'worker.salvador@mswdo.test', firstName: 'Josephine', middleName: 'D.', lastName: 'Salvador', phone: '09171234504', homeBarangay: 'Matictic' },
  { email: 'worker.aquino@mswdo.test', firstName: 'Emmanuel', middleName: 'R.', lastName: 'Aquino', phone: '09171234505', homeBarangay: 'San Mateo' },
  { email: 'worker.cayanan@mswdo.test', firstName: 'Rowena', middleName: 'S.', lastName: 'Cayanan', phone: '09171234506', homeBarangay: 'Friendship Village Resources (FVR)' },
  { email: 'worker.manalo@mswdo.test', firstName: 'Edgar', middleName: 'M.', lastName: 'Manalo', phone: '09171234507', homeBarangay: 'Bigte' },
  { email: 'worker.pascual@mswdo.test', firstName: 'Grace', middleName: 'T.', lastName: 'Pascual', phone: '09171234508', homeBarangay: 'Tigbe' },
  { email: 'worker.rosales@mswdo.test', firstName: 'Charito', middleName: 'L.', lastName: 'Rosales', phone: '09171234509', homeBarangay: 'Partida' },
  { email: 'worker.tolentino@mswdo.test', firstName: 'Alvin', middleName: 'P.', lastName: 'Tolentino', phone: '09171234510', homeBarangay: 'San Lorenzo' },
];

const COORDINATORS: NewCoordinator[] = [
  { email: 'coordinator.minuyan@mswdo.test', firstName: 'Teresa', middleName: 'R.', lastName: 'Minuyan', phone: '09171234520', barangay: 'Minuyan' },
  { email: 'coordinator.soriano@mswdo.test', firstName: 'Nerissa', middleName: 'C.', lastName: 'Soriano', phone: '09171234521', barangay: 'Bigte' },
];

// Existing staff the seed also wires onto the calendar (created by
// seed-accounts; missing ones are skipped gracefully).
const EXISTING_STAFF = ['admin@mswdo.test', 'worker1@mswdo.test', 'worker2@mswdo.test'];

// --- Vocabulary (must match the service-level sets) ---------------------------

const BLOCK_TYPES = ['in_office', 'home_visit', 'field_day', 'on_leave', 'remote'];
const STATUS_TYPES = ['in_office', 'home_visit', 'field_day', 'on_leave', 'remote', 'offline'];

const BLOCK_NOTES: Record<string, string[]> = {
  in_office: ['Office desk duty — case records', 'Intake interviews (by appointment)', 'Documentation day — reports'],
  home_visit: ['Home visit — follow-up assessment', 'Joint home visit with barangay coordinator', 'Home visit — case validation'],
  field_day: ['Field day — barangay outreach', 'Field day — payout coordination', 'RDO field day — client interviews'],
  on_leave: ['On leave — personal matter', 'On leave — family medical appointment', 'On leave — half day (AM)'],
  remote: ['Remote — report writing', 'Remote — FDS materials prep'],
};

const STATUS_NOTES: Record<string, string[]> = {
  in_office: ['At the office — main lobby desk', 'Office — finishing assessment reports'],
  home_visit: ['Out on home visit — Minuyan', 'Home visit round — Bigte'],
  field_day: ['Field day — barangay rounds', 'Field day — outreach site'],
  on_leave: ['On leave for today', 'On leave — half day'],
  remote: ['Working from home today', 'Remote — report collation'],
  offline: ['Offline — off duty', 'Unavailable — after office hours'],
};

// Foundational staff calendar rows. worker1/worker2 keep seed-accounts shape
// (no primary barangay), so all of their blocks stay team-visible.
interface PlannedBlock {
  email: string;
  dayIndex: number; // 0 = Monday .. 4 = Friday of the current week
  blockType: string;
  startTime: string | null;
  endTime: string | null;
  note: string;
  visibleTo: string;
}

// Deterministic weekday spread per staff index (distinct days, no PRNG).
function planDaysFor(staffIndex: number): number[] {
  const start = staffIndex % 5;
  return [start, (start + 2) % 5, (start + 3) % 5, (start + 1) % 5];
}

function planBlocks(): PlannedBlock[] {
  const plans: PlannedBlock[] = [];
  const emails = [
    ...SOCIAL_WORKERS.map((s) => s.email),
    'worker1@mswdo.test',
    'worker2@mswdo.test',
  ];
  emails.forEach((email, i) => {
    const count = 2 + (i % 3); // 2..4 blocks
    const days = planDaysFor(i);
    const isNew = i < SOCIAL_WORKERS.length;
    for (let j = 0; j < count; j++) {
      const blockType = BLOCK_TYPES[(i + j * 2) % BLOCK_TYPES.length];
      const notes = BLOCK_NOTES[blockType];
      // A couple of blocks carry a time window (deterministic: every other
      // block slot of the planner).
      const [startTime, endTime] =
        j % 2 === 0 ? (i % 2 === 0 ? ['08:00', '12:00'] : ['13:00', '17:00']) : [null, null];
      // New workers (primary barangay) expose 1–2 blocks to coordinators;
      // existing workers have no primary and stay team-visible.
      let visibleTo = 'team';
      if (isNew && (j === 0 || (i % 3 === 0 && j === 1))) visibleTo = 'team_coordinators';
      plans.push({
        email,
        dayIndex: days[j],
        blockType,
        startTime: startTime as string | null,
        endTime: endTime as string | null,
        note: notes[j % notes.length],
        visibleTo,
      });
    }
  });
  return plans;
}

// The accepted invite materializes a block for the invitee social worker;
// pick the one weekday the planner does NOT already give her so the calendar
// stays clean.
const ACCEPTED_INVITE_TO = 'worker.natividad@mswdo.test';

function acceptedInviteDayIndex(): number {
  const idx = SOCIAL_WORKERS.findIndex((s) => s.email === ACCEPTED_INVITE_TO);
  const used = planDaysFor(idx);
  const free = [0, 1, 2, 3, 4].find((d) => !used.includes(d));
  return free ?? 1;
}

// Achievements footprint per new social worker.
const TRANSITIONS: Array<[string, string]> = [
  ['enrolled', 'assessed'],
  ['assessed', 'in_review'],
  ['in_review', 'active'],
  ['active', 'transitioning'],
];

const SERVICES: Array<{
  name: string;
  category: string;
  amount: number;
  mode: string;
  fund: string;
  interventionType?: string;
}> = [
  { name: 'Home Visit', category: 'HV', amount: 0, mode: 'In-kind', fund: 'LGU', interventionType: 'home_visit' },
  { name: 'Counselling Session', category: 'CS', amount: 0, mode: 'In-kind', fund: 'LGU', interventionType: 'crisis_counseling' },
  { name: 'Case Conference', category: 'CC', amount: 0, mode: 'In-kind', fund: 'LGU', interventionType: 'scsr_generated' },
  { name: 'AICS — Assistance to Individuals in Crisis Situation', category: 'FA', interventionType: 'financial_grant', amount: 2500, mode: 'Cash', fund: 'AICS' },
];

// --- Date helpers (local calendar dates — no UTC shift) ------------------------

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentWeekDates(): string[] {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) =>
    localDateStr(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
  );
}

// 'YYYY-MM-DD HH:MM:SS' for TIMESTAMP (no tz) columns — no driver TZ ambiguity.
const at = (date: string, hhmm: string) => `${date} ${hhmm}:00`;
// ISO 8601 with explicit +08:00 offset for TIMESTAMPTZ columns.
const isoAt = (date: string, hhmm: string) => `${date}T${hhmm}:00+08:00`;

// --- Seeding -------------------------------------------------------------------

async function seedTeamDemoCore(ds: DataSource): Promise<void> {
  const q = ds.createQueryRunner();
  await q.connect();
  const week = currentWeekDates();
  const dayName = (i: number) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i];
  const blocks = planBlocks();

  const createdUsers = new Map<string, 'created' | 'existing'>();
  const userById = new Map<string, string>(); // email -> user id

  try {
    // 1. Users — per-account idempotent (ON CONFLICT email DO NOTHING).
    const accounts: Array<{ email: string; password: string; role: string; firstName: string; middleName: string; lastName: string; phone: string }> = [
      ...SOCIAL_WORKERS.map((s) => ({
        email: s.email, password: WORKER_PASSWORD, role: 'social_worker',
        firstName: s.firstName, middleName: s.middleName, lastName: s.lastName, phone: s.phone,
      })),
      ...COORDINATORS.map((c) => ({
        email: c.email, password: COORDINATOR_PASSWORD, role: 'coordinator',
        firstName: c.firstName, middleName: c.middleName, lastName: c.lastName, phone: c.phone,
      })),
    ];
    const hashed = await Promise.all(
      accounts.map(async (a) => ({ a, hash: await bcrypt.hash(a.password, SALT_ROUNDS) })),
    );
    for (const { a, hash } of hashed) {
      const res = await q.query(
        `INSERT INTO users (email, password, role, first_name, middle_name, last_name, phone, is_active, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,true)
         ON CONFLICT (email) DO NOTHING
         RETURNING 1`,
        [a.email, hash, a.role, a.firstName, a.middleName, a.lastName, a.phone],
      );
      createdUsers.set(a.email, res.length ? 'created' : 'existing');
    }

    // 2. Barangay assignments (child table; DELETE + INSERT, mirroring
    // seed-accounts). New workers: primary home barangay + all-barangay
    // permitted scope (so coordinator visibility works). Coordinators:
    // primary assignment only.
    for (const sw of SOCIAL_WORKERS) {
      const rows = await q.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [sw.email]);
      if (!rows.length) continue;
      const userId = rows[0].id;
      await q.query(`DELETE FROM user_barangay_assignments WHERE user_id = $1`, [userId]);
      await q.query(
        `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,true)`,
        [userId, sw.homeBarangay],
      );
      for (const b of BARANGAYS) {
        await q.query(
          `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,false)`,
          [userId, b.name],
        );
      }
    }
    for (const c of COORDINATORS) {
      const rows = await q.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [c.email]);
      if (!rows.length) continue;
      const userId = rows[0].id;
      await q.query(`DELETE FROM user_barangay_assignments WHERE user_id = $1`, [userId]);
      await q.query(
        `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,true)`,
        [userId, c.barangay],
      );
    }

    // 3. Id map for every account the seed touches (new + existing staff).
    for (const email of [...accounts.map((a) => a.email), ...EXISTING_STAFF]) {
      const rows = await q.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
      if (rows.length) userById.set(email, rows[0].id);
    }

    // 4. Schedule blocks per worker (new + existing social workers).
    let blocksInserted = 0;
    for (const b of blocks) {
      const userId = userById.get(b.email);
      if (!userId) continue;
      const res = await q.query(
        `INSERT INTO team_schedule_blocks (id, user_id, block_date, block_type, start_time, end_time, note, visible_to, created_by)
         SELECT $1::uuid,$2::uuid,$3::date,$4::varchar,$5::time,$6::time,$7::text,$8::varchar,$2::uuid
         WHERE NOT EXISTS (
           SELECT 1 FROM team_schedule_blocks
           WHERE user_id = $2 AND block_date = $3 AND block_type = $4 AND note IS NOT DISTINCT FROM $7
         )
         RETURNING 1`,
        [uuidv7(), userId, week[b.dayIndex], b.blockType, b.startTime, b.endTime, b.note, b.visibleTo],
      );
      blocksInserted += res.length;
    }

    // 5. Whereabouts statuses — one per staff (admin + worker1 + worker2 +
    // all new workers), two toggled to coordinators (the Bigte-primary
    // workers, so coordinator.soriano sees a live board).
    const statusPlan: Array<{ email: string; status: string; note: string; visibleTo: string }> = [
      { email: 'admin@mswdo.test', status: 'in_office', note: 'Office — MSWDO head desk', visibleTo: 'team' },
      { email: 'worker1@mswdo.test', status: 'home_visit', note: 'Home visit — Poblacion client', visibleTo: 'team' },
      { email: 'worker2@mswdo.test', status: 'field_day', note: 'Field day — outreach site', visibleTo: 'team' },
    ];
    SOCIAL_WORKERS.forEach((sw, i) => {
      const status = STATUS_TYPES[i % STATUS_TYPES.length];
      const notes = STATUS_NOTES[status];
      statusPlan.push({
        email: sw.email,
        status,
        note: notes[i % notes.length],
        // The two Bigte-primary workers broadcast to coordinators.
        visibleTo: sw.homeBarangay === 'Bigte' ? 'team_coordinators' : 'team',
      });
    });
    let statusesInserted = 0;
    for (const s of statusPlan) {
      const userId = userById.get(s.email);
      if (!userId) continue;
      const res = await q.query(
        `INSERT INTO team_status (id, user_id, status, note, visible_to)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING 1`,
        [uuidv7(), userId, s.status, s.note, s.visibleTo],
      );
      statusesInserted += res.length;
    }

    // 6. Office events this week (owner = admin).
    const adminId = userById.get('admin@mswdo.test') ?? userById.get('worker1@mswdo.test');
    let eventsInserted = 0;
    if (adminId) {
      const events = [
        {
          title: 'Team Meeting', day: 0, start: '08:30', end: '09:30', visibleTo: 'staff',
          location: 'MSWDO Office — Conference Room', notes: 'Standing weekly huddle + case assignment review.',
          repeatRule: JSON.stringify({ freq: 'weekly', interval: 1 }),
        },
        {
          title: 'Medical Mission — Barangay Bigte', day: 2, start: '08:00', end: '16:00',
          visibleTo: 'staff_coordinators', location: 'Bigte Barangay Hall',
          notes: 'Joint RHU–MSWDO medical mission; staff on rotation.', repeatRule: null,
        },
        {
          title: 'FDS Session — San Mateo', day: 3, start: '09:00', end: '12:00', visibleTo: 'staff',
          location: 'San Mateo Barangay Hall',
          notes: 'Family Development Session for active 4Ps households.', repeatRule: null,
        },
      ];
      for (const e of events) {
        const res = await q.query(
          `INSERT INTO office_events (id, title, starts_at, ends_at, repeat_rule, visible_to, location, owner_id, notes)
           SELECT $1::uuid,$2::text,$3::timestamptz,$4::timestamptz,$5::jsonb,$6::varchar,$7::text,$8::uuid,$9::text
           WHERE NOT EXISTS (SELECT 1 FROM office_events WHERE title = $2 AND starts_at = $3)
           RETURNING 1`,
          [uuidv7(), e.title, isoAt(week[e.day], e.start), isoAt(week[e.day], e.end), e.repeatRule, e.visibleTo, e.location, adminId, e.notes],
        );
        eventsInserted += res.length;
      }
    }

    // 7. Schedule invites: 2 pending + 1 accepted. The accepted invite
    // mirrors the service accept path — block owned by the invitee (owner,
    // creator, team-visible) + invite marked accepted with responded_at.
    const invites: Array<{ from: string; to: string; day: number; type: string; note: string; status: 'pending' | 'accepted' }> = [
      { from: 'worker1@mswdo.test', to: 'worker.natividad@mswdo.test', day: 2, type: 'home_visit', note: 'Joint home visit — Minuyan case follow-up', status: 'pending' },
      { from: 'worker.bautista@mswdo.test', to: 'worker2@mswdo.test', day: 3, type: 'field_day', note: 'Field day coordination — Bigte outreach', status: 'pending' },
      { from: 'worker2@mswdo.test', to: ACCEPTED_INVITE_TO, day: acceptedInviteDayIndex(), type: 'in_office', note: 'Intake review session — shared desk day', status: 'accepted' },
    ];
    let invitesInserted = 0;
    for (const inv of invites) {
      const fromId = userById.get(inv.from);
      const toId = userById.get(inv.to);
      if (!fromId || !toId) continue;
      const inviteId = uuidv7();
      const inviteDate = week[inv.day];
      const res = await q.query(
        `INSERT INTO team_invites (id, from_user_id, to_user_id, invite_date, block_type, note, status, created_at, responded_at)
         SELECT $1::uuid,$2::uuid,$3::uuid,$4::date,$5::varchar,$6::text,$7::varchar,NOW(),
           CASE WHEN $7 = 'accepted' THEN NOW() ELSE NULL END
         WHERE NOT EXISTS (
           SELECT 1 FROM team_invites WHERE from_user_id = $2 AND to_user_id = $3 AND invite_date = $4
         )
         RETURNING 1`,
        [inviteId, fromId, toId, inviteDate, inv.type, inv.note, inv.status],
      );
      const inserted = res.length;
      invitesInserted += inserted;
      // Accept materialization: the block is created AS the invitee
      // (userId = toUserId, createdBy = toUserId, visible_to 'team').
      if (inserted && inv.status === 'accepted') {
        const blockRes = await q.query(
          `INSERT INTO team_schedule_blocks (id, user_id, block_date, block_type, start_time, end_time, note, visible_to, created_by)
           SELECT $1::uuid,$2::uuid,$3::date,$4::varchar,NULL::time,NULL::time,$5::text,'team',$2::uuid
           WHERE NOT EXISTS (
             SELECT 1 FROM team_schedule_blocks
             WHERE user_id = $2 AND block_date = $3 AND block_type = $4 AND note IS NOT DISTINCT FROM $5
           )
           RETURNING 1`,
          [uuidv7(), toId, inviteDate, inv.type, inv.note],
        );
        blocksInserted += blockRes.length;
      }
    }

    // 8. Achievements history for the new social workers (case_history +
    // case_interventions + document_vault, all within the current week so
    // the /team/achievements rollup counts them).
    let caseRows: Array<{ id: string; status: string }> = [];
    try {
      caseRows = await q.query(
        `SELECT id::text AS id, status FROM cases ORDER BY created_at DESC LIMIT 15`,
      );
    } catch (e) {
      console.warn(`  WARN cases query failed: ${(e as Error).message}`);
    }
    const preferred = caseRows.filter((c) => ['active', 'in_review', 'transitioning', 'assessed'].includes(c.status));
    const casePool = preferred.length ? preferred : caseRows;

    let historyInserted = 0;
    let interventionsInserted = 0;
    let docsInserted = 0;
    if (!casePool.length) {
      console.warn('  WARN no cases found — achievements history skipped (run seed:demo first)');
    } else {
      for (let i = 0; i < SOCIAL_WORKERS.length; i++) {
        const sw = SOCIAL_WORKERS[i];
        const userId = userById.get(sw.email);
        if (!userId) continue;

        // 2–3 case_history rows, actor = this worker, distinct weekdays.
        const historyCount = 2 + (i % 2);
        for (let j = 0; j < historyCount; j++) {
          const caseId = casePool[(i * 2 + j * 3) % casePool.length].id;
          const [fromStatus, toStatus] = TRANSITIONS[(i + j) % TRANSITIONS.length];
          const res = await q.query(
            `INSERT INTO case_history (id, case_id, from_status, to_status, changed_by_role, changed_by_id, remarks, created_at, transition_type)
             SELECT $1::uuid,$2::text,$3::text,$4::text,'social_worker',$5::text,$6::text,$7::timestamp,'standard'
             WHERE NOT EXISTS (
               SELECT 1 FROM case_history WHERE case_id = $2 AND changed_by_id = $5 AND created_at = $7 AND remarks = $6
             )
             RETURNING 1`,
            [
              uuidv7(),
              caseId,
              fromStatus,
              toStatus,
              userId,
              `[team-demo] seeded status update: ${fromStatus} -> ${toStatus}`,
              at(week[(i + j * 2) % 5], j % 2 === 0 ? '08:30' : '14:00'),
            ],
          );
          historyInserted += res.length;
        }

        // 1–2 interventions, created_by = worker.
        const interventionCount = 1 + (i % 2);
        for (let j = 0; j < interventionCount; j++) {
          const svc = SERVICES[(i + j) % SERVICES.length];
          const caseId = casePool[(i * 2 + j + 1) % casePool.length].id;
          const dayIdx = (i + j * 2 + 1) % 5;
          const res = await q.query(
            `INSERT INTO case_interventions (id, case_id, program_id, service_name, category, delivery_date, amount, mode_of_delivery, fund_source, notes, delivered_by, created_by, created_at)
             SELECT $1::uuid,$2::text,NULL::uuid,$3::text,$4::text,$5::date,$6::numeric,$7::text,$8::text,$9::text,$10::text,$11::uuid,$12::timestamp
             WHERE NOT EXISTS (
               SELECT 1 FROM case_interventions
               WHERE case_id = $2 AND created_by = $11 AND service_name = $3 AND delivery_date = $5
             )
             RETURNING 1`,
            [uuidv7(), caseId, svc.name, svc.category, week[dayIdx], svc.amount, svc.mode, svc.fund, `[team-demo] ${svc.name}`, `${sw.firstName} ${sw.lastName}`, userId, at(week[dayIdx], '10:00')],
          );
          interventionsInserted += res.length;
        }

        // 1 document_vault row, category 'requirement', uploaded_by = worker.
        const caseId = casePool[(i * 2 + 2) % casePool.length].id;
        const dayIdx = (i + 4) % 5;
        const fileName = `birth_certificate_${sw.lastName.toLowerCase().replace(/\s+/g, '')}.pdf`;
        const res = await q.query(
          `INSERT INTO document_vault (id, file_name, original_name, mime_type, file_size, case_id, category, notes, uploaded_by, created_at)
           SELECT $1::uuid,$2::text,$3::text,'application/pdf',24576,$4::uuid,'requirement','[team-demo] seeded upload',$5::uuid,$6::timestamp
           WHERE NOT EXISTS (SELECT 1 FROM document_vault WHERE file_name = $2 AND uploaded_by = $5)
           RETURNING 1`,
          [uuidv7(), fileName, `BC-${sw.lastName}.pdf`, caseId, userId, at(week[dayIdx], '16:00')],
        );
        docsInserted += res.length;
      }
    }

    // 9. Summary.
    const newCount = [...createdUsers.values()].filter((v) => v === 'created').length;
    console.log('\n=== SEED TEAM DEMO DONE ===');
    console.log(`new users created: ${newCount} of ${createdUsers.size}`);
    for (const [email, kind] of createdUsers) {
      console.log(`  ${kind === 'created' ? 'created' : 'exists  '} ${email.padEnd(42)} ${kind === 'created' ? '' : '(adopted — no account change)'}`);
    }
    console.log(`schedule blocks: ${blocksInserted} (${blocks.length} planned + 1 materialized from the accepted invite)`);
    console.log(`statuses: ${statusesInserted} of ${statusPlan.length} planned`);
    console.log(`office events: ${eventsInserted} of 3 planned`);
    console.log(`invites: ${invitesInserted} of 3 planned (2 pending + 1 accepted)`);
    console.log(`case_history rows: ${historyInserted}`);
    console.log(`case_interventions rows: ${interventionsInserted}`);
    console.log(`document_vault rows: ${docsInserted}`);
    console.log('');
    console.log(`  Credentials (new staff): social workers → ${WORKER_PASSWORD}, coordinators → ${COORDINATOR_PASSWORD}`);
    console.log(`  Week simulated: ${week[0]} (${dayName(0)}) — ${week[4]} (${dayName(4)})`);
  } finally {
    await q.release();
  }
}

export async function seedTeamDemo(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await seedTeamDemoCore(AppDataSource);
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedTeamDemo().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
  });
}