/**
 * Demo extras — the modules no other seed script touches.
 *
 * Everything here is *created through the API*, by the same endpoints the client
 * calls, so the rows, derived columns, counters and audit entries are the app's
 * own rather than a hand-written imitation of them:
 *
 *   announcements    POST /announcements + PATCH /:id/pin      (manage screen)
 *   contact inbox    POST /contact-messages + /:id/reply        (public form + panel)
 *   messages         POST /chat/send, as each participant        (MessagesPage)
 *   team invites     POST /team/invites + PATCH /:id/accept      (Team Workspace)
 *   4Ps              POST …/generate-compliance, …/:caseId/payouts,
 *                    PATCH …/compliance/:id/meet, …/payouts/:id/status
 *   clustering       POST /analytics/clustering/runs
 *   client dedup     create → upload → finalize (the worker writes the priority list)
 *
 * Nothing is seeded for a feature the client cannot reach: no document vault
 * (no page reads it) and no bare beneficiary remarks (no page lists them; the
 * dedup finalize writes the ones that matter). Reads — the idempotency checks —
 * still go to the database: only writes have to be the API's.
 *
 * Idempotent: each block checks first and skips what is already there, so a
 * second run is a no-op.
 *
 * Prerequisites: `npm run seed` + `npm run seed:demo`. The API must be running.
 *
 * Run: npm run seed:extras
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from './data-source';
import { call, login, uploadFile } from './seed-http';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Read-only existence check — the one thing a seed may ask the DB directly. */
async function exists(sql: string, params: unknown[] = []): Promise<boolean> {
  const rows = await AppDataSource.query(`SELECT EXISTS (${sql}) AS present`, params);
  return rows[0].present === true;
}

async function userId(email: string): Promise<string> {
  const rows = await AppDataSource.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!rows[0]) throw new Error(`no account ${email} — run npm run seed first`);
  return rows[0].id;
}

const ok = (r: { status: number }) => r.status < 400;

// --- Announcements: the public list and the manage screen --------------------

async function seedAnnouncements(token: string): Promise<void> {
  const rows: Array<{ title: string; excerpt: string; bodyHtml: string; status: 'published' | 'draft'; pinned?: boolean }> = [
    {
      title: 'Libreng Gamot at Check-up',
      excerpt: 'Free medicines and medical check-up for senior citizens, 8 AM to 4 PM at the MSWDO office.',
      bodyHtml: '<p>The MSWDO Norzagaray invites all senior citizens to the quarterly <strong>Libreng Gamot at Check-up</strong>. Bring your senior citizen ID and maintenance prescription.</p>',
      status: 'published', pinned: true,
    },
    {
      title: '4Ps Payout Schedule — Poblacion',
      excerpt: 'The next 4Ps payout for Poblacion beneficiaries is on the 15th, 8 AM to 3 PM.',
      bodyHtml: '<p>Bring your 4Ps ID and household booklet. Grantees who cannot attend may send an authorized representative with a letter.</p>',
      status: 'published',
    },
    {
      title: 'Senior Citizen Registration',
      excerpt: 'On-site registration for unregistered senior citizens, every weekday.',
      bodyHtml: '<p>For new senior citizen IDs and booklet updates. Bring a birth certificate or a barangay certification of age.</p>',
      status: 'published',
    },
    {
      title: 'Office Closure — Barangay Assembly',
      excerpt: 'The MSWDO office is closed in the afternoon for the barangay assembly.',
      bodyHtml: '<p>Business resumes the next working day at 8 AM.</p>',
      status: 'published',
    },
    {
      title: 'AICS Application Reminder',
      excerpt: 'Reminder on the documents needed for AICS applications.',
      bodyHtml: '<p>Draft copy pending the MSWDO head\'s review before publishing.</p>',
      status: 'draft',
    },
  ];

  let created = 0;
  for (const a of rows) {
    if (await exists('SELECT 1 FROM announcements WHERE title = $1', [a.title])) continue;
    const r = await call(token, 'POST', '/announcements', { title: a.title, excerpt: a.excerpt, bodyHtml: a.bodyHtml, status: a.status }, 'announcement');
    if (!ok(r)) continue;
    created++;
    // Pinning is its own action in the client too (PATCH /announcements/:id/pin).
    if (a.pinned) await call(token, 'PATCH', `/announcements/${r.json.id}/pin`, {}, 'announcement-pin');
  }
  console.log(`announcements: ${created} created (4 published + 1 draft after this run)`);
}

// --- Contact inbox: what the public contact form leaves behind ---------------

async function seedContactInbox(token: string): Promise<void> {
  const rows: Array<[string, string, string]> = [
    ['Marites Salvador', 'marites.salvador@example.com', 'Good day, my father passed away last week. What are the requirements for burial assistance? Thank you.'],
    ['Joel Bautista', 'joel.bautista@example.com', 'Ask ko lang po kung pwede mag-walk in for senior citizen ID registration? Wala po kasing schedule online.'],
    ['Grace Domingo', 'grace.domingo@example.com', 'A store in Poblacion refused my PWD discount. Saan po pwede mag-report?'],
  ];

  let created = 0;
  let answeredId: string | null = null;
  for (const [name, email, message] of rows) {
    if (await exists('SELECT 1 FROM contact_messages WHERE email = $1', [email])) {
      const existing = await AppDataSource.query('SELECT id FROM contact_messages WHERE email = $1 LIMIT 1', [email]);
      answeredId = existing[0]?.id ?? answeredId;
      continue;
    }
    // The public form's own endpoint — no token needed, but the admin's works.
    const r = await call(token, 'POST', '/contact-messages', { name, email, message }, 'contact-message');
    if (ok(r)) { created++; answeredId = r.json.id; }
  }

  // One answered thread, so the panel shows the reply state too.
  if (answeredId && !(await exists('SELECT 1 FROM contact_message_replies WHERE message_id = $1', [answeredId]))) {
    await call(token, 'POST', `/contact-messages/${answeredId}/reply`, {
      content: 'Thank you for reporting. Please file the complaint at the MSWDO office so we can document the establishment. Bring your PWD ID.',
    }, 'contact-reply');
  }
  console.log(`contact inbox: ${created} new message(s), 1 answered`);
}

// --- Messages: threads between the demo accounts ----------------------------

async function seedChat(tokens: Record<string, string>): Promise<void> {
  const ids = {
    admin: await userId('admin@mswdo.test'),
    worker: await userId('worker1@mswdo.test'),
    claimant: await userId('pedro.claimant@test.com'),
    coordinator: await userId('coordinator.bangkal@mswdo.test'),
  };

  // [who sends, who receives, content] — every message is sent by the account
  // that would send it, because /chat/send attributes the sender from the token.
  const threads: Array<Array<[keyof typeof ids, string, string]>> = [
    [
      ['claimant', ids.worker, 'Good morning po. Nakuha na po ba ang assessment result ng case ko?'],
      ['worker', ids.claimant, 'Good morning, Mr. Reyes. Nasa review pa po ang assessment. Sasabihan ko po kayo kapag approved na.'],
      ['claimant', ids.worker, 'Salamat po. Susundan ko na lang po dito.'],
    ],
    [
      ['coordinator', ids.worker, 'For scheduling po: meron tayong 4Ps payout sa 15th. Pwede po ba tayong mag-coordinate ng barangay list?'],
      ['worker', ids.coordinator, 'Yes po. Padala niyo na lang ang listahan at ipapa-validate ko sa MSWDO.'],
    ],
    [
      ['admin', ids.worker, 'Reminder: i-submit ang weekly case tracker summary bago mag-5 PM.'],
      ['worker', ids.admin, 'Noted po, I will send it after the home visit.'],
    ],
  ];

  let sent = 0;
  for (const thread of threads) {
    for (const [who, to, content] of thread) {
      const conversation = [ids[who], to].sort().join('_');
      if (await exists('SELECT 1 FROM chat_messages WHERE conversation_id = $1 AND content = $2', [conversation, content])) continue;
      const r = await call(tokens[who], 'POST', '/chat/send', { recipientId: to, content }, `chat-${who}`);
      if (ok(r)) sent++;
    }
  }
  console.log(`messages: 3 threads (${sent} message(s) sent)`);
}

// --- Team workspace: invites an admin would send -----------------------------

async function seedTeamInvites(tokens: Record<string, string>): Promise<void> {
  const admin = await userId('admin@mswdo.test');
  const worker1 = await userId('worker1@mswdo.test');
  const worker2 = await userId('worker2@mswdo.test');

  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const invites: Array<[string, string, string, string, boolean]> = [
    [admin, worker1, day(2), 'Bigte home visit for the senior citizen renewal', true],
    [admin, worker2, day(4), 'Matictic field day — validation of the 4Ps list', false],
  ];

  let accepted = 0;
  for (const [from, to, inviteDate, note, accept] of invites) {
    if (await exists('SELECT 1 FROM team_invites WHERE from_user_id = $1 AND to_user_id = $2 AND invite_date = $3', [from, to, inviteDate])) continue;
    const r = await call(tokens.admin, 'POST', '/team/invites', { toUserId: to, inviteDate, blockType: 'home_visit', note }, 'invite');
    if (!ok(r)) continue;
    // Accepting is the invitee's own action, and it materialises the block —
    // so the calendar shows a real, app-created schedule entry.
    if (accept) {
      const a = await call(tokens.worker, 'PATCH', `/team/invites/${r.json.id}/accept`, {}, 'invite-accept');
      if (ok(a)) accepted++;
    }
  }
  // Report the state rather than the delta: a re-run creates nothing.
  const state = await AppDataSource.query(
    `SELECT status, count(*)::int AS n FROM team_invites WHERE from_user_id = $1 AND note = ANY($2) GROUP BY status ORDER BY status`,
    [admin, invites.map(([, , , note]) => note)],
  );
  console.log(`team invites: ${state.map((r: any) => `${r.n} ${r.status}`).join(', ')}${accepted ? ` (${accepted} accepted just now → block created)` : ''}`);
}

// --- 4Ps: a payout schedule and compliance checklist, through the endpoints --

async function seedFourPs(token: string): Promise<void> {
  // Newest first: seed-demo's cases are created "now", the analytics seed's are
  // historical — the presenter opens one of the recent ones.
  const cases: Array<{ id: string; control_no: string }> = await AppDataSource.query(
    'SELECT id, control_no FROM cases ORDER BY created_at DESC LIMIT 2',
  );
  if (cases.length === 0) return console.log('4Ps: skipped — no cases (run npm run seed:demo first)');

  let scheduled = 0;
  let met = 0;
  for (const c of cases) {
    // Idempotent by itself (ON CONFLICT on case + member + type + due date).
    await call(token, 'POST', `/fourps/${c.id}/generate-compliance`, undefined, 'compliance');

    const payouts = await call(token, 'GET', `/fourps/${c.id}/payouts`);
    if (ok(payouts) && payouts.json.length === 0) {
      for (let cycle = 1; cycle <= 3; cycle++) {
        const when = new Date();
        when.setMonth(when.getMonth() + cycle, 15);
        const r = await call(token, 'POST', `/fourps/${c.id}/payouts`, {
          scheduledAt: when.toISOString().slice(0, 10),
          cycleNo: `CY${when.getFullYear()}-0${cycle}`,
          amount: 1200,
        }, `payout-c${cycle}`);
        if (ok(r)) scheduled++;
      }
      // The first tranche already paid out, so the schedule shows a real status.
      const after = await call(token, 'GET', `/fourps/${c.id}/payouts`);
      const first = after.json?.[0];
      if (first) await call(token, 'PATCH', `/fourps/payouts/${first.id}/status`, { status: 'completed', remarks: 'Paid at the barangay hall' }, 'payout-complete');
    }

    // Two compliance items met, the way the case worker ticks them off.
    const items = await call(token, 'GET', `/fourps/${c.id}/compliance`);
    const unmet = (items.json?.entries ?? []).filter((i: any) => !i.met).slice(0, 2);
    for (const item of unmet) {
      const r = await call(token, 'PATCH', `/fourps/compliance/${item.id}/meet`, {}, 'compliance-meet');
      if (ok(r)) met++;
    }
  }
  console.log(`4Ps: ${cases.length} case(s) with compliance + ${scheduled} tranche(s) scheduled, ${met} condition(s) met`);
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
  if (!ok(created)) throw new Error(`could not create ${source}: ${created.status}`);
  const id: string = created.json.id;
  await uploadFile(token, `/client-dedup/operations/${id}/upload`, {}, source, Buffer.from(csv), 'text/csv');
  return id;
}

async function seedDedup(token: string): Promise<void> {
  if (await exists(`SELECT 1 FROM client_import_operations WHERE source LIKE 'demo-%'`)) {
    return console.log('dedup: demo operations already exist');
  }

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
  for (let i = 0; i < 30 && ok(queued); i++) {
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
  // Best-effort: the image's /app may be read-only, and the demo data above is
  // already saved — a missing hand-upload copy must not fail the seed.
  let sampleAt = 'not written (read-only image)';
  try {
    const dir = join(__dirname, 'demo-data');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'dedup-demo.csv'), batchB + '\n');
    sampleAt = 'src/database/demo-data/dedup-demo.csv';
  } catch (e) {
    console.warn(`  WARN could not write the dedup sample file: ${(e as Error).message}`);
  }
  console.log(`dedup B: ${b} left in review (1 KAPWA match + 1 duplicate pair); sample at ${sampleAt}`);
}

// --- Run --------------------------------------------------------------------

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    throw new Error('refusing to seed demo data with NODE_ENV=production (pass --force to override)');
  }

  // One session per participant: /chat/send and the invite accept attribute the
  // actor from the token, so a thread must be sent by the accounts that send it.
  const tokens = {
    admin: await login('admin@mswdo.test', 'admin123'),
    worker: await login('worker1@mswdo.test', 'worker123'),
    claimant: await login('pedro.claimant@test.com', 'claimant123'),
    coordinator: await login('coordinator.bangkal@mswdo.test', 'coordinator123'),
  };

  await AppDataSource.initialize();
  try {
    await seedAnnouncements(tokens.admin);
    await seedContactInbox(tokens.admin);
    await seedChat(tokens);
    await seedTeamInvites(tokens);
    await seedFourPs(tokens.admin);
    await seedDedup(tokens.admin);
  } finally {
    await AppDataSource.destroy();
  }

  console.log('\n=== DONE ===');
  console.log('show: /announcements/manage · /messages (contact + chat) · /team · /cases/:id/payouts');
  console.log('      /analytics (clustering) · /client-dedup (one finished, one to review)');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
