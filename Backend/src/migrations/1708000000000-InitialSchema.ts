import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration — creates all tables from the current entity state.
 * This is the baseline migration for production (dev uses synchronize: true).
 */
export class InitialSchema1708000000000 implements MigrationInterface {
  name = 'InitialSchema1708000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension (must come before tables using uuid_generate_v4)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Enums
    await queryRunner.query(`
      CREATE TYPE "position_status_enum" AS ENUM(
        'PENDING_EXECUTION', 'ACTIVE', 'OUT_OF_RANGE',
        'LIQUIDATION_PENDING', 'LIQUIDATED', 'FAILED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "activity_type_enum" AS ENUM(
        'INVESTMENT', 'WITHDRAWAL', 'LIQUIDATION', 'AUTO_REBALANCE', 'ERROR'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "activity_status_enum" AS ENUM(
        'PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'
      )
    `);

    // Users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "walletAddress" varchar(64) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_walletAddress" UNIQUE ("walletAddress"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // DEXes
    await queryRunner.query(`
      CREATE TABLE "dexes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(50) NOT NULL,
        "factoryAddress" varchar(42) NOT NULL,
        "routerAddress" varchar(42) NOT NULL,
        "nonfungiblePositionManagerAddress" varchar(42) NOT NULL,
        "chainId" int NOT NULL DEFAULT 2004,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_dexes_name" UNIQUE ("name"),
        CONSTRAINT "PK_dexes" PRIMARY KEY ("id")
      )
    `);

    // Pools
    await queryRunner.query(`
      CREATE TABLE "pools" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "poolAddress" varchar(42) NOT NULL,
        "dexId" uuid NOT NULL,
        "token0Address" varchar(42) NOT NULL,
        "token1Address" varchar(42) NOT NULL,
        "token0Symbol" varchar(10) NOT NULL,
        "token1Symbol" varchar(10) NOT NULL,
        "fee" int NOT NULL,
        "liquidity" decimal(78,0) NOT NULL,
        "sqrtPriceX96" decimal(78,0) NOT NULL,
        "tick" int NOT NULL,
        "volume24h" decimal(30,2) NOT NULL,
        "tvl" decimal(30,2) NOT NULL,
        "apr" decimal(10,4) NOT NULL,
        "lastFeeGrowth0" varchar,
        "lastFeeGrowth1" varchar,
        "chainId" int NOT NULL DEFAULT 2004,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastSyncedAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pools" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pools_dexId" FOREIGN KEY ("dexId")
          REFERENCES "dexes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // User Preferences
    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "minApy" decimal(10,2) NOT NULL DEFAULT 8.0,
        "maxPositions" int NOT NULL DEFAULT 6,
        "maxAllocPerPositionUsd" decimal(30,2) NOT NULL DEFAULT '25000',
        "dailyRebalanceLimit" int NOT NULL DEFAULT 8,
        "expectedGasUsd" decimal(10,2) NOT NULL DEFAULT '1.00',
        "lambdaRiskAversion" decimal(5,2) NOT NULL DEFAULT '0.5',
        "thetaMinBenefit" decimal(5,4) NOT NULL DEFAULT '0.0',
        "planningHorizonDays" int NOT NULL DEFAULT 7,
        "minTvlUsd" decimal(30,2) NOT NULL DEFAULT '1000000',
        "minPoolAgeDays" int NOT NULL DEFAULT 14,
        "allowedTokens" json,
        "preferredDexes" json,
        "defaultLowerRangePercent" int NOT NULL DEFAULT -5,
        "defaultUpperRangePercent" int NOT NULL DEFAULT 10,
        "maxIlLossPercent" decimal(5,2) NOT NULL DEFAULT '6.0',
        "minPositionSizeUsd" decimal(30,2) NOT NULL DEFAULT '45',
        "autoInvestEnabled" boolean NOT NULL DEFAULT true,
        "investmentCheckIntervalSeconds" int NOT NULL DEFAULT 14400,
        "lastRebalanceDate" date,
        "rebalanceCountToday" int NOT NULL DEFAULT 0,
        "minApr" int,
        "minTvl" decimal(30,2),
        "preferredTokens" json,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_preferences_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Positions
    await queryRunner.query(`
      CREATE TABLE "positions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assetHubPositionId" varchar(66) NOT NULL,
        "moonbeamPositionId" varchar(66),
        "userId" uuid NOT NULL,
        "poolId" uuid NOT NULL,
        "baseAsset" varchar(42) NOT NULL,
        "amount" decimal(78,0) NOT NULL,
        "liquidity" decimal(78,0),
        "lowerRangePercent" int NOT NULL,
        "upperRangePercent" int NOT NULL,
        "lowerTick" int,
        "upperTick" int,
        "entryPrice" decimal(78,0),
        "status" "position_status_enum" NOT NULL DEFAULT 'PENDING_EXECUTION',
        "lastWithdrawalPlanningKey" varchar(64),
        "chainId" int NOT NULL,
        "returnedAmount" decimal(78,0),
        "executedAt" TIMESTAMP,
        "liquidatedAt" TIMESTAMP,
        "retryCount" int NOT NULL DEFAULT 0,
        "lastFailedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_positions_assetHubPositionId" UNIQUE ("assetHubPositionId"),
        CONSTRAINT "PK_positions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_positions_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_positions_poolId" FOREIGN KEY ("poolId")
          REFERENCES "pools"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Activity Logs
    await queryRunner.query(`
      CREATE TABLE "activity_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "activity_type_enum" NOT NULL,
        "status" "activity_status_enum" NOT NULL DEFAULT 'PENDING',
        "txHash" varchar,
        "positionId" varchar,
        "details" json,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_logs_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_positions_userId" ON "positions" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_positions_status" ON "positions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_positions_poolId" ON "positions" ("poolId")`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_logs_userId" ON "activity_logs" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_preferences_userId" ON "user_preferences" ("userId")`);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(`DROP TABLE "positions"`);
    await queryRunner.query(`DROP TABLE "user_preferences"`);
    await queryRunner.query(`DROP TABLE "pools"`);
    await queryRunner.query(`DROP TABLE "dexes"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "activity_status_enum"`);
    await queryRunner.query(`DROP TYPE "activity_type_enum"`);
    await queryRunner.query(`DROP TYPE "position_status_enum"`);
  }
}
