import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HealthController } from '../src/health.controller';

import { PoolsController } from '../src/modules/pools/pools.controller';
import { PoolsService } from '../src/modules/pools/pools.service';
import { Pool } from '../src/modules/pools/entities/pool.entity';
import { Dex } from '../src/modules/pools/entities/dex.entity';
import { PoolScannerService } from '../src/modules/pools/pool-scanner.service';

import { PreferencesController } from '../src/modules/preferences/preferences.controller';
import { PreferencesService } from '../src/modules/preferences/preferences.service';
import { UserPreference } from '../src/modules/preferences/entities/user-preference.entity';

import { PositionsController } from '../src/modules/positions/positions.controller';
import { Position } from '../src/modules/positions/entities/position.entity';

import { InvestmentDecisionController } from '../src/modules/investment-decision/investment-decision.controller';
import { InvestmentDecisionService } from '../src/modules/investment-decision/investment-decision.service';
import { User } from '../src/modules/users/entities/user.entity';

import { AssetHubService } from '../src/modules/blockchain/services/asset-hub.service';
import { MoonbeamService } from '../src/modules/blockchain/services/moonbeam.service';
import { XcmBuilderService } from '../src/modules/blockchain/services/xcm-builder.service';

type RepoStub<T> = {
  find?: jest.Mock;
  findOne?: jest.Mock;
  createQueryBuilder?: jest.Mock;
  create?: jest.Mock;
  save?: jest.Mock;
  merge?: jest.Mock;
};

function createRepoStub<T>(): RepoStub<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
  };
}

/**
 * Shared in-memory fixtures for E2E
 */
const dexFixture = {
  id: 'dex-1',
  name: 'Algebra Dex',
  isActive: true,
} as any;

const poolFixtures = [
  {
    id: 'pool-1',
    poolAddress: '0xpool1',
    token0Symbol: 'USDC',
    token1Symbol: 'USDT',
    apr: '12.5',
    tvl: '2000000',
    volume24h: '100000',
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    dex: dexFixture,
  },
  {
    id: 'pool-2',
    poolAddress: '0xpool2',
    token0Symbol: 'DOT',
    token1Symbol: 'USDC',
    apr: '8.0',
    tvl: '1500000',
    volume24h: '50000',
    isActive: true,
    createdAt: new Date('2025-01-10T00:00:00.000Z'),
    dex: dexFixture,
  },
] as any[];

const userFixture = {
  id: 'user-1',
  walletAddress: '0x1111111111111111111111111111111111111111',
  isActive: true,
} as any;

let userPreferencesFixture: any = {
  id: 'pref-1',
  userId: userFixture.id,
  minApr: 500,
  minTvl: '1000000',
  defaultLowerRangePercent: -5,
  defaultUpperRangePercent: 10,
  investmentCheckIntervalSeconds: 3600,
  preferredDexes: ['Algebra Dex'],
  preferredTokens: ['USDC', 'USDT', 'DOT'],
  autoInvestEnabled: true,
};

const positionFixtures = [
  {
    id: 'pos-1',
    userId: userFixture.id,
    poolId: poolFixtures[0].id,
    pool: poolFixtures[0],
    status: 'ACTIVE',
    amount: '1000000000000000000',
    baseAsset: '0xbase',
    chainId: 2004,
    lowerRangePercent: -5,
    upperRangePercent: 10,
    createdAt: new Date('2025-01-20T00:00:00.000Z'),
  },
] as any[];

@Module({
  imports: [
    // Keep config available for any conditional code paths.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [
    HealthController,
    PoolsController,
    PreferencesController,
    PositionsController,
    InvestmentDecisionController,
  ],
  providers: [
    PoolsService,
    {
      provide: PoolScannerService,
      useValue: {
        syncPools: jest.fn(async () => undefined),
      },
    },
    PreferencesService,
    InvestmentDecisionService,

    // --- Mock repositories ---
    {
      provide: getRepositoryToken(Pool),
      useValue: (() => {
        const repo = createRepoStub<Pool>();

        // simulate query builder used in PoolsService.findAll
        repo.createQueryBuilder!.mockImplementation(() => {
          const qb: any = {
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(poolFixtures),
          };
          return qb;
        });

        repo.findOne!.mockImplementation(async ({ where }: any) => {
          const id = where?.id;
          return poolFixtures.find(p => p.id === id) ?? null;
        });

        repo.find!.mockImplementation(async () => poolFixtures);

        return repo;
      })(),
    },
    {
      provide: getRepositoryToken(Dex),
      useValue: createRepoStub<Dex>(),
    },
    {
      provide: getRepositoryToken(UserPreference),
      useValue: (() => {
        const repo = createRepoStub<UserPreference>();
        repo.findOne!.mockImplementation(async ({ where }: any) => {
          return userPreferencesFixture?.userId === where?.userId ? userPreferencesFixture : null;
        });
        repo.create!.mockImplementation((v: any) => ({ ...v, id: 'pref-new' }));
        repo.merge!.mockImplementation((target: any, src: any) => Object.assign(target, src));
        repo.save!.mockImplementation(async (v: any) => {
          userPreferencesFixture = { ...v };
          return userPreferencesFixture;
        });
        return repo;
      })(),
    },
    {
      provide: getRepositoryToken(Position),
      useValue: (() => {
        const repo = createRepoStub<Position>();
        repo.find!.mockImplementation(async ({ where }: any) => {
          const userId = where?.userId;
          const status = where?.status;
          return positionFixtures
            .filter(p => p.userId === userId)
            .filter(p => (status ? p.status === status : true));
        });
        return repo;
      })(),
    },
    {
      provide: getRepositoryToken(User),
      useValue: (() => {
        const repo = createRepoStub<User>();
        repo.findOne!.mockImplementation(async ({ where }: any) => {
          return where?.id === userFixture.id ? userFixture : null;
        });
        return repo;
      })(),
    },

    // --- Mock chain service ---
    {
      provide: AssetHubService,
      useValue: {
        isInitialized: jest.fn(() => false),
        getUserBalance: jest.fn(async () => 123n),
        getUserPositionsByStatus: jest.fn(async () => []),
        dispatchInvestmentWithXcm: jest.fn(async () => '0xposition'),
      },
    },

    // --- Mock Moonbeam + XCM builder (required by InvestmentDecisionService DI) ---
    {
      provide: MoonbeamService,
      useValue: {
        isInitialized: jest.fn(() => false),
        liquidateSwapAndReturn: jest.fn(async () => undefined),
      },
    },
    {
      provide: XcmBuilderService,
      useValue: {
        buildReturnDestination: jest.fn(async () => new Uint8Array([1, 2, 3])),
      },
    },
  ],
})
export class AppE2eModule {}
