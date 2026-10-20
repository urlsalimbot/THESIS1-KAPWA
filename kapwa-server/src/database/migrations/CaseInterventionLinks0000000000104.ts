import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the two links on a delivered service real.
 *
 * `case_interventions.case_id` was TEXT (predating `cases.id` becoming uuid) and
 * had no foreign key, so an intervention could point at a case that never
 * existed — while `program_enrollments.case_id` has been a uuid + FK all along.
 * `program_id` had no foreign key either, and it duplicates the program its
 * enrollment already names: the service checks the two agree on write, but the
 * database could still hold a row where they disagree.
 *
 * Every existing row is a UUID and every link resolves (verified before writing
 * this: 637 rows, 0 non-UUID case ids, 0 orphans, 0 enrollment/program
 * mismatches), so the conversion and both constraints apply without repair.
 * Batch servings keep their NULL `case_id` — they carry `beneficiary_id`.
 */
export class CaseInterventionLinks0000000000104 implements MigrationInterface {
  name = 'CaseInterventionLinks0000000000104';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE case_interventions ALTER COLUMN case_id TYPE UUID USING case_id::uuid`);

    await q.query(`ALTER TABLE case_interventions
      ADD CONSTRAINT fk_case_interventions_case FOREIGN KEY (case_id) REFERENCES cases(id)`);

    // A deleted program leaves the delivered service on record (the row keeps
    // its service name/type); only the now-meaningless program id is cleared.
    await q.query(`ALTER TABLE case_interventions
      ADD CONSTRAINT fk_case_interventions_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL`);

    // The recorded program must be the one the enrollment belongs to. The
    // service enforces this too; the trigger closes the door for any other
    // writer (a script, a future endpoint) that forgets.
    await q.query(`CREATE OR REPLACE FUNCTION case_interventions_check_program() RETURNS trigger AS $$
      DECLARE enrolment_program UUID;
      BEGIN
        IF NEW.program_id IS NOT NULL AND NEW.program_enrollment_id IS NOT NULL THEN
          SELECT program_id INTO enrolment_program
            FROM program_enrollments WHERE id = NEW.program_enrollment_id;
          IF enrolment_program IS NOT NULL AND enrolment_program <> NEW.program_id THEN
            RAISE EXCEPTION
              'the intervention names program % but its enrollment belongs to program %',
              NEW.program_id, enrolment_program
              USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`);

    await q.query(`DROP TRIGGER IF EXISTS trg_case_interventions_program ON case_interventions`);
    await q.query(`CREATE TRIGGER trg_case_interventions_program
      BEFORE INSERT OR UPDATE ON case_interventions
      FOR EACH ROW EXECUTE FUNCTION case_interventions_check_program()`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_case_interventions_program ON case_interventions`);
    await q.query(`DROP FUNCTION IF EXISTS case_interventions_check_program()`);
    await q.query(`ALTER TABLE case_interventions DROP CONSTRAINT IF EXISTS fk_case_interventions_program`);
    await q.query(`ALTER TABLE case_interventions DROP CONSTRAINT IF EXISTS fk_case_interventions_case`);
    await q.query(`ALTER TABLE case_interventions ALTER COLUMN case_id TYPE TEXT USING case_id::text`);
  }
}
