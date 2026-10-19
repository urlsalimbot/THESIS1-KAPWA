/**
 * Demo extras — the modules no other seed script touches.
 *
 * seed-demo drives the whole case story through the API; this fills what is
 * still empty once it has run: announcements, the contact inbox, chat threads,
 * team invites, household clustering, 4Ps payouts/compliance, and two
 * client-dedup operations — one finalized with a real priority list, one left in
 * review with an intra-list duplicate pair and a database match for the operator
 * to resolve in front of an audience.
 *
 * Idempotent by its own keys: announcement slug, conversation id, invite
 * (from, to, date), and the `demo-` operation sources. A second run is a no-op.
 *
 * shortcut: everything that owns rules goes through the API (dedup — the
 * priority list is written by the finalize worker; 4Ps; clustering), everything
 * that is a plain row goes in as SQL. Upgrade a block to its endpoint if that
 * module grows rules a direct insert would skip.
 *
 * Prerequisites: `npm run seed` + `npm run seed:programs` + `npm run seed:demo`
 * (it needs cases for the 4Ps schedules and a real client for the dedup match).
 * The API must be running — the dedup finalize is a background job there.
 *
 * Run: npm run seed:extras
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from './data-source';
import { call, login, uploadFile } from './seed-http';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function userId(email: string): Promise<string> {
  const rows = await AppDataSource.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!rows[0]) throw new Error(`no account ${email} — run npm run seed first`);
  return rows[0].id;
}

// --- Announcements: the public list and the manage list ----------------------

async function seedAnnouncements(authorId: string): Promise<void> {
  const rows: Array<[string, string, string, string, boolean, string, number]> = [
    ['Libreng Gamot at Check-up', 'demo-libreng-gamot',
      'Free medicines and medical check-up for senior citizens, 8 AM to 4 PM at the MSWDO office.',
      '<p>The MSWDO Norzagaray invites all senior citizens to the quarterly <strong>Libreng Gamot at Check-up</strong>. Bring your senior citizen ID and maintenance prescription.</p>',
      true, 'published', 6],
    ['4Ps Payout Schedule — Poblacion', 'demo-4ps-payout',
      'The next 4Ps payout for Poblacion beneficiaries is on the 15th, 8 AM to 3 PM.',
      '<p>Bring your 4Ps ID and household booklet. Grantees who cannot attend may send an authorized representative with a letter.</p>',
      false, 'published', 4],
    ['Senior Citizen Registration', 'demo-senior-registration',
      'On-site registration for unregistered senior citizens, every weekday.',
      '<p>For new senior citizen IDs and booklet updates. Bring a birth certificate or a barangay certification of age.</p>',
      false, 'published', 3],
    ['Office Closure — Barangay Assembly', 'demo-office-closure',
      'The MSWDO office is closed in the afternoon for the barangay assembly.',
      '<p>Business resumes the next working day at 8 AM.</p>',
      false, 'published', 2],
    ['AICS Application Reminder', 'demo-aics-draft',
      'Reminder on the documents needed for AICS applications. (Draft)',
      '<p>Draft copy pending the MSWDO head\'s review before publishing.</p>',
      false, 'draft', 0],
  ];

  for (const [title, slug, excerpt, bodyHtml, pinned, status, daysAgo] of rows) {
    await AppDataSource.query(
      `INSERT INTO announcements (id, title, slug, excerpt, body_html, body_text, status, pinned, published_at, created_by, created_at, updated_at)
       VALUES (uuid_generate_v7(), $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       ON CONFLICT (slug) DO NOTHING`,
      [title, slug, excerpt, bodyHtml, excerpt, status, pinned,
        status === 'published' ? new Date(Date.now() - daysAgo * 86_400_000) : null, status === 'published' ? authorId : null],
    );
  }
  console.log('announcements: 4 published + 1 draft');
}

// --- Contact inbox: what the public contact form leaves behind ---------------

async function seedContactInbox(): Promise<void> {
  const rows: Array<[string, string, string, string, string, string]> = [
    ['Marites Salvador', 'marites.salvador@example.com', 'Burial assistance',
      'Good day, my father passed away last week. What are the requirements for burial assistance? Thank you.',
      'new', '2 days'],
    ['Joel Bautista', 'joel.bautista@example.com', 'Senior citizen ID',
      'Ask ko lang po kung pwede mag-walk in for senior citizen ID registration? Wala po kasing schedule online.',
      'new', '1 day'],
    ['Grace Domingo', 'grace.domingo@example.com', 'PWD discount concern',
      'A store in Poblacion refused my PWD discount. Saan po pwede mag-report?',
      'read', '5 days'],
  ];

  for (const [name, email, subject, message, status, ago] of rows) {
    await AppDataSource.query(
      `INSERT INTO contact_messages (id, name, email, subject, message, status, created_at)
       SELECT uuid_generate_v7(), $1::varchar, $2::varchar, $3::varchar, $4::text, $5::varchar, now() - $6::interval
        WHERE NOT EXISTS (SELECT 1 FROM contact_messages WHERE email = $2::varchar AND subject = $3::varchar)`,
      [name, email, subject, message, status, ago],
    );
  }

  // One answered thread, so the panel shows the reply state too.
  const replied = await AppDataSource.query(
    `SELECT id FROM contact_messages WHERE email = 'grace.domingo@example.com' LIMIT 1`,
  );
  if (replied[0]) {
    await AppDataSource.query(
      `INSERT INTO contact_message_replies (id, message_id, content, created_at)
       SELECT uuid_generate_v7(), $1::uuid, $2::text, now() - interval '3 days'
        WHERE NOT EXISTS (SELECT 1 FROM contact_message_replies WHERE message_id = $1::uuid)`,
      [replied[0].id, 'Thank you for reporting. Please file the complaint at the MSWDO office so we can document the establishment. Bring your PWD ID.'],
    );
  }
  console.log('contact inbox: 2 new + 1 answered');
}

// --- Messages: three threads, since an empty inbox demos badly ---------------

async function seedChat(): Promise<void> {
  const worker = await userId('worker1@mswdo.test');
  const admin = await userId('admin@mswdo.test');
  const claimant = await userId('pedro.claimant@test.com');
  const coordinator = await userId('coordinator.bangkal@mswdo.test');

  const conversations: Array<[string, string, string, string, boolean, number][]> = [
    // [senderId, senderName, recipientId, content, isRead, minutesAgo]
    [
      [claimant, 'Pedro Reyes', worker, 'Good morning po. Nakuha na po ba ang assessment result ng case ko?', true, 180],
      [worker, 'Juan Dela Cruz', claimant, 'Good morning, Mr. Reyes. Nasa review pa po ang assessment. Sasabihan ko po kayo kapag approved na.', true, 172],
      [claimant, 'Pedro Reyes', worker, 'Salamat po. Susundan ko na lang po dito.', true, 168],
    ],
    [
      [coordinator, 'Bangkal Coordinator', worker, 'For scheduling po: meron tayong 4Ps payout sa 15th. Pwede po ba tayong mag-coordinate ng barangay list?', true, 90],
      [worker, 'Juan Dela Cruz', coordinator, 'Yes po. Padala niyo na lang ang listahan at ipapa-validate ko sa MSWDO.', false, 60],
    ],
    [
      [admin, 'Rosario Mendoza', worker, 'Reminder: i-submit ang weekly case tracker summary bago mag-5 PM.', true, 300],
      [worker, 'Juan Dela Cruz', admin, 'Noted po, I will send it after the home visit.', true, 290],
    ],
  ];

  let inserted = 0;
  for (const thread of conversations) {
    for (const [senderId, senderName, recipientId, content, isRead, minutesAgo] of thread) {
      const conversationId = [senderId, recipientId].sort().join('_');
      const before = await AppDataSource.query('SELECT count(*)::int AS n FROM chat_messages');
      await AppDataSource.query(
        `INSERT INTO chat_messages (id, sender_id, sender_name, recipient_id, content, is_read, conversation_id, read_at, created_at)
         SELECT uuid_generate_v7(), $1::text, $2::text, $3::text, $4::text, $5::boolean, $6::text, $7::timestamp, now() - ($8::text || ' minutes')::interval
          WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE conversation_id = $6::text AND content = $4::text)`,
        [senderId, senderName, recipientId, content, isRead, conversationId, isRead ? new Date() : null, minutesAgo],
      );
      const after = await AppDataSource.query('SELECT count(*)::int AS n FROM chat_messages');
      if (after[0].n > before[0].n) inserted++;
    }
  }
  console.log(`messages: 3 threads (${inserted} new message(s))`);
}

// --- Team workspace: pending invites, so the dialog's inbox is not bare -----

async function seedTeamInvites(): Promise<void> {
  const admin = await userId('admin@mswdo.test');
  const worker1 = await userId('worker1@mswdo.test');
  const worker2 = await userId('worker2@mswdo.test');
  const coordinator = await userId('coordinator.bangkal@mswdo.test');

  const invites: Array<[string, string, string, string, string, number]> = [
    [admin, worker1, 'home_visit', 'Bigte home visit for the senior citizen renewal', 'pending', 2],
    [admin, worker2, 'field_day', 'Matictic field day — validation of the 4Ps list', 'pending', 4],
    [coordinator, worker1, 'in_office', 'Client interview at the barangay hall', 'accepted', -3],
  ];

  for (const [from, to, blockType, note, status, dayOffset] of invites) {
    await AppDataSource.query(
      `INSERT INTO team_invites (id, from_user_id, to_user_id, invite_date, block_type, note, status, responded_at, created_at)
       SELECT uuid_generate_v7(), $1::uuid, $2::uuid, CURRENT_DATE + $6::int, $3::varchar, $4::text, $5::varchar,
              CASE WHEN $5::varchar = 'pending' THEN NULL ELSE now() END, now()
        WHERE NOT EXISTS (
          SELECT 1 FROM team_invites WHERE from_user_id = $1::uuid AND to_user_id = $2::uuid AND invite_date = CURRENT_DATE + $6::int)`,
      [from, to, blockType, note, status, dayOffset],
    );
  }
  console.log('team invites: 2 pending + 1 accepted');
}

// --- 4Ps: a real payout schedule and compliance checklist -------------------

async function seedFourPs(token: string): Promise<void> {
  // Newest first: seed-demo's cases are created "now", the analytics seed's are
  // historical — the presenter opens one of the recent ones.
  const cases: Array<{ id: string; control_no: string }> = await AppDataSource.query(
    'SELECT id, control_no FROM cases ORDER BY created_at DESC LIMIT 2',
  );
  if (cases.length === 0) return console.log('4Ps: skipped — no cases (run npm run seed:demo first)');

  let scheduled = 0;
  for (const c of cases) {
    await call(token, 'POST', `/fourps/${c.id}/generate-compliance`, undefined, 'compliance');
    const existing = await AppDataSource.query('SELECT count(*)::int AS n FROM case_payouts WHERE case_id = $1', [c.id]);
    if (existing[0].n > 0) continue;
    for (let cycle = 1; cycle <= 3; cycle++) {
      const when = new Date();
      when.setMonth(when.getMonth() + cycle, 15);
      const r = await call(token, 'POST', `/fourps/${c.id}/payouts`, {
        scheduledAt: when.toISOString().slice(0, 10),
        cycleNo: `CY${when.getFullYear()}-0${cycle}`,
        amount: 1200,
      }, `payout-c${cycle}`);
      if (r.status < 400) scheduled++;
    }
  }
  console.log(`4Ps: compliance for ${cases.length} case(s), ${scheduled} payout tranche(s) scheduled`);
}

// --- Analytics: a real clustering run instead of hand-written clusters ------

async function seedClustering(token: string): Promise<void> {
  const done = await AppDataSource.query(`SELECT count(*)::int AS n FROM analysis_runs WHERE status = 'completed'`);
  if (done[0].n > 0) return console.log('clustering: a completed run already exists');

  const r = await call(token, 'POST', '/analytics/clustering/runs', { kRange: [2, 4] }, 'clustering');
  if (r.status >= 400) {
    // The one refusal worth explaining: clustering needs enough households, and
    // only the analytics seed creates them.
    const hint = r.json?.message?.code === 'insufficient_data'
      ? ` (needs ${r.json.message.required} households, has ${r.json.message.actual} — run npm run seed:analytics first)`
      : '';
    return console.log(`clustering: not seeded — API said ${r.status}${hint}`);
  }
  const clusters = (await AppDataSource.query('SELECT count(*)::int AS n FROM analysis_run_clusters WHERE run_id = $1', [r.json.id]))[0].n;
  console.log(`clustering: ${clusters} cluster(s) over ${r.json.metrics?.dataset_size ?? '?'} households`);
}

// --- Client dedup: one finished run, one waiting for the operator -----------

const DEDUP_HEADER = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks';
const dedupRow = (...v: string[]) => v.map((x) => x.replace(/,/g, ' ')).join(',');

async function createOperation(token: string, source: string, csv: string): Promise<string> {
  const created = await call(token, 'POST', '/client-dedup/operations', {
    source,
    interventionType: 'financial_grant',
    columnMap: {
      baseline: { lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name', birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks' },
      extras: [],
    },
  }, 'dedup-create');
  if (created.status >= 400) throw new Error(`could not create ${source}: ${created.status}`);
  const id: string = created.json.id;
  await uploadFile(token, `/client-dedup/operations/${id}/upload`, {}, source, Buffer.from(csv), 'text/csv');
  return id;
}

async function seedDedup(token: string): Promise<void> {
  const existing = await AppDataSource.query(`SELECT count(*)::int AS n FROM client_import_operations WHERE source LIKE 'demo-%'`);
  if (existing[0].n > 0) return console.log('dedup: demo operations already exist');

  // A real client for the review screen to match against.
  const person = (await AppDataSource.query(
    `SELECT p.surname, p.first_name, p.middle_name, to_char(p.dob, 'YYYY-MM-DD') AS dob,
            coalesce((SELECT a.barangay FROM person_addresses a WHERE a.person_id = p.id LIMIT 1), 'Poblacion') AS barangay
       FROM persons p JOIN beneficiaries b ON b.person_id = p.id
      WHERE p.dob IS NOT NULL ORDER BY p.created_at LIMIT 1`,
  ))[0];
  if (!person) return console.log('dedup: skipped — no client to match against (run npm run seed:demo first)');

  // A: all new names — finalizes cleanly and writes the priority list.
  const batchA = [
    DEDUP_HEADER,
    dedupRow('Zabala', 'Conchita', 'Marasigan', '1955-04-11', 'Bigte', 'Senior citizen list'),
    dedupRow('Yandoc', 'Feliciano', 'Bautista', '1968-09-02', 'Matictic', 'Senior citizen list'),
    dedupRow('Ximenez', 'Perlita', 'Osorio', '1974-12-19', 'Partida', 'Senior citizen list'),
    dedupRow('Wenceslao', 'Rodel', 'Aguinaldo', '1981-06-30', 'Poblacion', 'Senior citizen list'),
    dedupRow('Villamor', 'Ester', 'Padilla', '1959-02-07', 'FVR', 'Senior citizen list'),
    dedupRow('Ubaldo', 'Marcelino', 'Reyes', '1963-08-23', 'San Mateo', 'Senior citizen list'),
  ].join('\n');

  const a = await createOperation(token, 'demo-dedup-a.csv', batchA);
  const queued = await call(token, 'POST', `/client-dedup/operations/${a}/finalize`, {}, 'dedup-finalize');
  let summary: any = null;
  for (let i = 0; i < 30 && queued.status < 400; i++) {
    await sleep(2_000);
    const op = await call(token, 'GET', `/client-dedup/operations/${a}`);
    if (op.json.status === 'finalized') { summary = op.json.finalizeSummary; break; }
    if (op.json.finalizeError) { console.warn(`  WARN finalize failed: ${op.json.finalizeError}`); break; }
  }
  console.log(`dedup A: finalized ${summary ? JSON.stringify(summary) : '(still running — check the review screen)'}`);

  // B: left in review — one match against KAPWA, one duplicate pair inside the
  // list, one genuinely new client. This is the file the operator works through.
  const batchB = [
    DEDUP_HEADER,
    dedupRow(person.surname, person.first_name, person.middle_name ?? '', person.dob, person.barangay, 'Re-submitted from the barangay list'),
    dedupRow('Aguinaldo', 'Rosario', 'Buenaventura', '1977-03-15', 'Bigte', 'Walk-in applicant'),
    dedupRow('Aguinaldo', 'Rosario', 'Buenaventura', '1977-03-15', 'Bigte', 'Walk-in applicant (duplicate entry)'),
    dedupRow('Trinidad', 'Herminia', 'Salcedo', '1969-11-08', 'Minuyan', 'Referral from the barangay'),
  ].join('\n');

  const b = await createOperation(token, 'demo-dedup-b.csv', batchB);

  // Written out so the presenter can also upload it by hand during the demo.
  const dir = join(__dirname, 'demo-data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'dedup-demo.csv'), batchB + '\n');
  console.log(`dedup B: ${b} left in review (1 KAPWA match + 1 duplicate pair); sample at src/database/demo-data/dedup-demo.csv`);
}

// --- Run --------------------------------------------------------------------

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    throw new Error('refusing to seed demo data with NODE_ENV=production (pass --force to override)');
  }

  const token = await login('admin@mswdo.test', 'admin123');
  await AppDataSource.initialize();
  try {
    const admin = await userId('admin@mswdo.test');
    await seedAnnouncements(admin);
    await seedContactInbox();
    await seedChat();
    await seedTeamInvites();
    await seedFourPs(token);
    await seedClustering(token);
    await seedDedup(token);
  } finally {
    await AppDataSource.destroy();
  }

  console.log('\n=== DONE ===');
  console.log('show: /announcements/manage · /messages (contact + chat) · /team · /cases/:id/payouts');
  console.log('      /analytics (clustering) · /client-dedup (one finished, one to review)');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
