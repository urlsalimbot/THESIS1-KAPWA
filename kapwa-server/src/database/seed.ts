import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa'
});

async function seed() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();

  await q.query('TRUNCATE TABLE consent_ledger, access_card_services, case_tracker_log, interventions, cases, family_members, households, beneficiaries, users, programs, sync_queue, chat_messages, csr_reports, irf_cases, notifications, version_vectors CASCADE');

  const adminPass = await bcrypt.hash('admin123', 12);
  const workerPass = await bcrypt.hash('worker123', 12);
  const coordPass = await bcrypt.hash('coordinator123', 12);
  const claimantPass = await bcrypt.hash('claimant123', 12);

  await q.query(`
    INSERT INTO users (id, email, password, role, full_name, assigned_barangay, permitted_barangays)
    VALUES 
      ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@mswdo.test', $1, 'admin', 'Admin User', NULL, '{}'),
      ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'worker@mswdo.test', $2, 'social_worker', 'Juan Dela Cruz', 'Bigte', '{"Bigte","Matictic"}'),
      ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'coordinator@mswdo.test', $3, 'coordinator', 'Maria Santos', 'Partida', '{"Partida"}'),
      ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'claimant@test.com', $4, 'claimant', 'Pedro Reyes', NULL, '{}')
  `, [adminPass, workerPass, coordPass, claimantPass]);

  await q.query(`
    INSERT INTO beneficiaries (id, philsys_number, surname, first_name, middle_name, gender, dob, address, phone, access_card_code)
    VALUES 
      ('f47ac10b-58cc-4372-a567-0e02b2c3d479', '1234-5678-9012', 'Dela Cruz', 'Juan', 'Santos', 'Male', '1985-06-15', '123 Poblacion, Bigte', '09171234567', 'NORZ-AC-2024-0001'),
      ('f47ac10b-58cc-4372-a567-0e02b2c3d480', '1234-5678-9013', 'Mendoza', 'Maria', 'Reyes', 'Female', '1990-03-22', '456 Purok 3, Matictic', '09179876543', 'NORZ-AC-2024-0002'),
      ('f47ac10b-58cc-4372-a567-0e02b2c3d481', '1234-5678-9014', 'Santos', 'Jose', 'Garcia', 'Male', '1978-11-08', '789 Purok 7, Partida', '09177654321', 'NORZ-AC-2024-0003')
  `);

  await q.query(`
    INSERT INTO households (id, primary_beneficiary_id, barangay, estimated_income, verified_by)
    VALUES 
      ('a1b2c3d4-1111-2222-3333-444455556666', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Bigte', 8500.00, 'Juan Dela Cruz'),
      ('a1b2c3d4-1111-2222-3333-444455556667', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', 'Matictic', 6200.00, 'Juan Dela Cruz')
  `);

  await q.query(`
    INSERT INTO family_members (id, household_id, full_name, relationship, age, status_income, is_primary)
    VALUES 
      ('b2c3d4e5-1111-2222-3333-444455556666', 'a1b2c3d4-1111-2222-3333-444455556666', 'Maria Dela Cruz', 'Spouse', 42, 'Employed', false),
      ('b2c3d4e5-1111-2222-3333-444455556667', 'a1b2c3d4-1111-2222-3333-444455556666', 'Jose Dela Cruz', 'Child', 16, 'Student', false),
      ('b2c3d4e5-1111-2222-3333-444455556668', 'a1b2c3d4-1111-2222-3333-444455556667', 'Ana Mendoza', 'Child', 8, 'Student', false)
  `);

  await q.query(`
    INSERT INTO programs (id, name, category, waiting_period_days, required_documents, fund_sources, approval_workflow, form_template, is_active)
    VALUES 
      ('p1', 'AKAP', 'Financial Assistance', 7, '["Medical Certificate", "Barangay Indigency", "Valid ID"]', '{Regular,PDAF}', '{SW Assessment,Head Approval,Mayor Approval,Disbursement}', '{"type":"object","title":"AKAP Application","properties":{"amount":{"type":"number","title":"Amount","minimum":0},"purpose":{"type":"string","title":"Purpose","enum":["Medical","Education","Burial","Food"]},"remarks":{"type":"string","title":"Remarks","format":"textarea"}},"required":["amount","purpose"]}', true),
      ('p2', 'Medical Assistance', 'Health', 3, '["Medical Certificate", "Prescription", "Valid ID"]', '{Regular,Legislative}', '{SW Assessment,Head Approval,Disbursement}', '{"type":"object","title":"Medical Assistance","properties":{"hospital":{"type":"string","title":"Hospital"},"diagnosis":{"type":"string","title":"Diagnosis"},"amount":{"type":"number","title":"Amount"},"date":{"type":"string","title":"Date","format":"date"}},"required":["hospital","diagnosis","amount"]}', true)
  `);

  await q.query(`
    INSERT INTO cases (id, control_no, beneficiary_id, service_requested, requirements_checklist, status, assigned_worker_id)
    VALUES 
      ('c1', 'NORZ-2024-0001', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '{Financial Aid}', '[{"key":"med_cert","checked":true},{"key":"indigency","checked":true}]', 'approved', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
      ('c2', 'NORZ-2024-0002', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', '{Medical Assistance}', '[{"key":"med_cert","checked":true}]', 'disbursed', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22')
  `);

  await q.query(`
    INSERT INTO consent_ledger (id, beneficiary_id, purpose, channel, status)
    VALUES 
      ('cl1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'GIS Intake & Case Processing', 'in_person', 'active'),
      ('cl2', 'f47ac10b-58cc-4372-a567-0e02b2c3d480', 'GIS Intake & Case Processing', 'in_person', 'active'),
      ('cl3', 'f47ac10b-58cc-4372-a567-0e02b2c3d481', 'GIS Intake & Case Processing', 'in_person', 'active')
  `);

  await q.query(`
    INSERT INTO case_tracker_log (id, daily_seq_num, transaction_date, surname, first_name, middle_name, gender, age_range, client_category, barangay, intervention_remarks)
    VALUES 
      ('t1', 1, NOW(), 'Dela Cruz', 'Juan', 'Santos', 'M', '18-59', 'Family', 'Bigte', 'FA'),
      ('t2', 2, NOW(), 'Mendoza', 'Maria', 'Reyes', 'F', '18-59', 'Women', 'Matictic', 'FA')
  `);

  console.log('Seed data inserted');
  await q.release();
  await dataSource.destroy();
}

seed().catch(console.error);
