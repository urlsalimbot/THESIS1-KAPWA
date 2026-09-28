import { MigrationInterface, QueryRunner } from 'typeorm';

// 4Ps used to write its own category values ('4ps_compliance', '4ps_payout') to
// `access_card_services`. The card's category tabs filter on the shared vocabulary
// (`LogServiceSchema` sanctions case_service, referral, community_service, seminar,
// payout, compliance), so every auto-logged 4Ps row matched no tab and was visible
// only under "All".
//
// Fold the historic values onto the sanctioned ones. No information is lost: the
// "4Ps" attribution already leads `service_rendered` ("4Ps compliance — fds (Oct
// 2026)", "4Ps payout scheduled — CY2026-02"), so this only changes how the row is
// bucketed, not what it says.
//
// Idempotent: the WHERE clauses match nothing on a second run. Reversible: down()
// restores the original values, and it can do so unambiguously because the "4Ps"
// prefix in service_rendered identifies exactly the rows this migration rewrote.
export class ZRenormalizeFourPsCardCategories0000000000067 implements MigrationInterface {
  name = 'ZRenormalizeFourPsCardCategories0000000000067';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE access_card_services SET category = 'compliance' WHERE category = '4ps_compliance'`,
    );
    await queryRunner.query(
      `UPDATE access_card_services SET category = 'payout' WHERE category = '4ps_payout'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Scoped to rows this migration could have produced, so a payout or compliance
    // row logged by hand through /access-cards/log is never re-labelled on revert.
    await queryRunner.query(
      `UPDATE access_card_services SET category = '4ps_compliance'
       WHERE category = 'compliance' AND service_rendered LIKE '4Ps compliance%'`,
    );
    await queryRunner.query(
      `UPDATE access_card_services SET category = '4ps_payout'
       WHERE category = 'payout' AND service_rendered LIKE '4Ps payout%'`,
    );
  }
}
