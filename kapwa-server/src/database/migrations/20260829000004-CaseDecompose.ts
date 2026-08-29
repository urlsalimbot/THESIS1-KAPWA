import { MigrationInterface, QueryRunner } from 'typeorm';

export class CaseDecompose20260829000004 implements MigrationInterface {
  name = 'CaseDecompose20260829000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE case_requirements
        ADD CONSTRAINT fk_case_requirements_case FOREIGN KEY (case_id)
        REFERENCES cases(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM case_requirements cr WHERE NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = cr.case_id);
      ALTER TABLE case_requirements VALIDATE CONSTRAINT fk_case_requirements_case;

      ALTER TABLE case_referrals
        ADD CONSTRAINT fk_case_referrals_case FOREIGN KEY (case_id)
        REFERENCES cases(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM case_referrals cr WHERE NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = cr.case_id);
      ALTER TABLE case_referrals VALIDATE CONSTRAINT fk_case_referrals_case;

      ALTER TABLE case_assistances
        ADD CONSTRAINT fk_case_assistances_case FOREIGN KEY (case_id)
        REFERENCES cases(id) ON DELETE CASCADE
        NOT VALID;
      DELETE FROM case_assistances ca WHERE NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = ca.case_id);
      ALTER TABLE case_assistances VALIDATE CONSTRAINT fk_case_assistances_case;

      -- Normalize Wave-1 backfilled 'other' assistance rows: the 20260828000003
      -- migration inserted each other_assistance entry as assistance_type='other'
      -- with details = jsonb_build_object(key, value). Promote the single key to
      -- assistance_type so the Case.otherAssistance getter reconstructs {key: value}.
      UPDATE case_assistances
        SET assistance_type = details->>0,
            details = details->0
        WHERE assistance_type = 'other'
          AND jsonb_typeof(details) = 'object'
          AND (SELECT count(*) FROM jsonb_object_keys(details)) = 1;

      -- Drop legacy JSONB/financial columns now owned by child tables.
      -- nature_of_service and service_requested intentionally remain columns.
      ALTER TABLE cases DROP COLUMN IF EXISTS requirements_checklist;
      ALTER TABLE cases DROP COLUMN IF EXISTS financial_subsidies;
      ALTER TABLE cases DROP COLUMN IF EXISTS amount_assistance;
      ALTER TABLE cases DROP COLUMN IF EXISTS mode_financial_assistance;
      ALTER TABLE cases DROP COLUMN IF EXISTS source_of_fund;
      ALTER TABLE cases DROP COLUMN IF EXISTS legislator_specify;
      ALTER TABLE cases DROP COLUMN IF EXISTS other_assistance;
      ALTER TABLE cases DROP COLUMN IF EXISTS referrals;
      ALTER TABLE cases DROP COLUMN IF EXISTS follow_up_visits;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS requirements_checklist JSONB;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS financial_subsidies JSONB;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_assistance DECIMAL(12,2);
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS mode_financial_assistance TEXT;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_of_fund TEXT;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS legislator_specify TEXT;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_assistance JSONB;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS referrals JSONB;
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS follow_up_visits JSONB;
      ALTER TABLE case_assistances DROP CONSTRAINT IF EXISTS fk_case_assistances_case;
      ALTER TABLE case_referrals DROP CONSTRAINT IF EXISTS fk_case_referrals_case;
      ALTER TABLE case_requirements DROP CONSTRAINT IF EXISTS fk_case_requirements_case;
    `);
  }
}