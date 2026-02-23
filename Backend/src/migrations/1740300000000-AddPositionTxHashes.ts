import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds txHash columns to positions table for tracking
 * Asset Hub (Phase 1 XCM) and Moonbeam (Phase 2 execution) transaction hashes.
 */
export class AddPositionTxHashes1740300000000 implements MigrationInterface {
  name = 'AddPositionTxHashes1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "positions" ADD "assetHubTxHash" varchar(66)`);
    await queryRunner.query(`ALTER TABLE "positions" ADD "moonbeamTxHash" varchar(66)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "positions" DROP COLUMN "moonbeamTxHash"`);
    await queryRunner.query(`ALTER TABLE "positions" DROP COLUMN "assetHubTxHash"`);
  }
}
