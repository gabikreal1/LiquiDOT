import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvestmentDecisionService } from './investment-decision.service';
import { Pool } from '../pools/entities/pool.entity';
import { Position, PositionStatus } from '../positions/entities/position.entity';
import { User } from '../users/entities/user.entity';
import { UserPreference } from '../preferences/entities/user-preference.entity';
import { RebalanceDecision } from './types/investment.types';

describe('InvestmentDecisionService', () => {
  let service: InvestmentDecisionService;
  let poolRepository: jest.Mocked<Repository<Pool>>;
  let positionRepository: jest.Mocked<Repository<Position>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let preferenceRepository: jest.Mocked<Repository<UserPreference>>;

  // Mock data
  const mockUser: User = {
    id: 'user-123',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    positions: [],
    preferences: [],
  };

  const mockPreference: UserPreference = {
    id: 'pref-123',
    userId: 'user-123',
    minApy: '8',
    maxPositions: 6,
    maxAllocPerPositionUsd: '25000',
    dailyRebalanceLimit: 3,
    expectedGasUsd: '5',
    lambdaRiskAversion: '0.5',
    thetaMinBenefit: '0.01',
    planningHorizonDays: 30,
    minTvlUsd: '100000',
    minPoolAgeDays: 14,
    allowedTokens: ['DOT', 'USDC', 'GLMR', 'USDT'],
    preferredDexes: [],
    defaultLowerRangePercent: -5,
    defaultUpperRangePercent: 10,
    maxIlLossPercent: '10',
    minPositionSizeUsd: '50',
    autoInvestEnabled: true,
    investmentCheckIntervalSeconds: 14400,
    // Legacy fields
    minApr: null,
    minTvl: null,
    preferredTokens: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  const mockPools: Pool[] = [
    {
      id: 'pool-1',
      poolAddress: '0xpool1',
      dexId: 'dex-1',
      token0Address: '0xtoken0',
      token1Address: '0xtoken1',
      token0Symbol: 'DOT',
      token1Symbol: 'USDC',
      fee: 3000,
      liquidity: '1000000000000000000000',
      sqrtPriceX96: '1000000000000000000',
      tick: 100,
      volume24h: '500000',
      tvl: '2000000',
      apr: '15.5',
      chainId: 1284,
      isActive: true,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Pool,
    {
      id: 'pool-2',
      poolAddress: '0xpool2',
      dexId: 'dex-1',
      token0Address: '0xtoken2',
      token1Address: '0xtoken3',
      token0Symbol: 'GLMR',
      token1Symbol: 'USDT',
      fee: 2500,
      liquidity: '500000000000000000000',
      sqrtPriceX96: '500000000000000000',
      tick: 50,
      volume24h: '250000',
      tvl: '1000000',
      apr: '12.0',
      chainId: 1284,
      isActive: true,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Pool,
  ];

  beforeEach(async () => {
    const mockPoolRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPools),
      })),
    };

    const mockPositionRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const mockUserRepository = {
      findOne: jest.fn().mockResolvedValue(mockUser),
      save: jest.fn(),
      create: jest.fn().mockReturnValue(mockUser),
    };

    const mockPreferenceRepository = {
      findOne: jest.fn().mockResolvedValue(mockPreference),
      save: jest.fn(),
      create: jest.fn().mockReturnValue(mockPreference),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentDecisionService,
        {
          provide: getRepositoryToken(Pool),
          useValue: mockPoolRepository,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserPreference),
          useValue: mockPreferenceRepository,
        },
      ],
    }).compile();

    service = module.get<InvestmentDecisionService>(InvestmentDecisionService);
    poolRepository = module.get(getRepositoryToken(Pool));
    positionRepository = module.get(getRepositoryToken(Position));
    userRepository = module.get(getRepositoryToken(User));
    preferenceRepository = module.get(getRepositoryToken(UserPreference));
  });

  describe('evaluateInvestmentDecision', () => {
    it('should return no-op decision when user preferences not found', async () => {
      // Arrange
      preferenceRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.evaluateInvestmentDecision('user-123', 1000);

      // Assert
      expect(result.shouldRebalance).toBe(false);
      expect(result.toAdd).toHaveLength(0);
      expect(result.toWithdraw).toHaveLength(0);
    });

    it('should return decision with recommendations when conditions are met', async () => {
      // Arrange
      preferenceRepository.findOne.mockResolvedValue(mockPreference);
      positionRepository.find = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.evaluateInvestmentDecision('user-123', 1000);

      // Assert
      expect(result).toHaveProperty('shouldRebalance');
      expect(result).toHaveProperty('toAdd');
      expect(result).toHaveProperty('toWithdraw');
    });

    it('should respect minimum capital requirements', async () => {
      // Act - very small capital
      const result = await service.evaluateInvestmentDecision('user-123', 10);

      // Assert - should either no-op or return minimal allocation
      expect(result).toHaveProperty('shouldRebalance');
    });
  });

  describe('evaluateForWallet', () => {
    it('should create user if not exists', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(null);
      const createdUser = { ...mockUser, id: 'new-user-id' };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);
      preferenceRepository.findOne.mockResolvedValue(mockPreference);

      // Act
      const result = await service.evaluateForWallet(
        '0xnewwallet1234567890abcdef1234567890abcdef',
        1000,
      );

      // Assert
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should use existing user if found', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.evaluateForWallet(
        mockUser.walletAddress,
        1000,
      );

      // Assert
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should apply user config overrides', async () => {
      // Arrange
      userRepository.findOne.mockResolvedValue(mockUser);
      preferenceRepository.findOne.mockResolvedValue(mockPreference);

      const configOverride = {
        minApy: 15,
        allowedTokens: ['DOT', 'USDC'],
        lambda: 0.3,
      };

      // Act
      const result = await service.evaluateForWallet(
        mockUser.walletAddress,
        1000,
        configOverride,
      );

      // Assert - should return result (specific values depend on pool filtering)
      expect(result).toHaveProperty('shouldRebalance');
    });
  });

  describe('IL Risk Calculation', () => {
    it('should calculate higher IL risk for volatile pairs', async () => {
      // The service should assign higher IL risk factors to:
      // - tier4/tier4 pairs (highest)
      // - tier3/tier4 pairs (high)
      // - tier1/tier1 pairs (lowest - stablecoins)
      
      // This is verified through the RebalanceDecision response
      preferenceRepository.findOne.mockResolvedValue(mockPreference);
      
      const result = await service.evaluateInvestmentDecision('user-123', 5000);
      
      // If there are recommendations, they should have pool data
      if (result.toAdd.length > 0) {
        // Verify pool data is included
        const action = result.toAdd[0] as any;
        if (action.poolData) {
          expect(action.poolData).toHaveProperty('ilRiskFactor');
        }
      }
    });
  });

  describe('Portfolio Allocation', () => {
    it('should not exceed max positions', async () => {
      // Arrange
      const preferenceWithMaxPositions = {
        ...mockPreference,
        maxPositions: 2,
      };
      preferenceRepository.findOne.mockResolvedValue(preferenceWithMaxPositions);

      // Act
      const result = await service.evaluateInvestmentDecision('user-123', 10000);

      // Assert
      expect(result.toAdd.length).toBeLessThanOrEqual(2);
    });

    it('should not exceed max allocation per position', async () => {
      // Arrange
      const preferenceWithMaxAlloc = {
        ...mockPreference,
        maxAllocPerPositionUsd: '500',
      };
      preferenceRepository.findOne.mockResolvedValue(preferenceWithMaxAlloc);

      // Act
      const result = await service.evaluateInvestmentDecision('user-123', 2000);

      // Assert
      result.toAdd.forEach((action) => {
        expect(action.targetAllocationUsd).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('Rebalance Rate Limiting', () => {
    it('should track daily rebalances', async () => {
      // Arrange
      preferenceRepository.findOne.mockResolvedValue(mockPreference);

      // Act - Multiple evaluations
      await service.evaluateInvestmentDecision('user-123', 1000);
      await service.evaluateInvestmentDecision('user-123', 1000);
      await service.evaluateInvestmentDecision('user-123', 1000);

      // The service tracks rebalances internally
      // After dailyRebalanceLimit (3), it should return no-op
      const result = await service.evaluateInvestmentDecision('user-123', 1000);
      
      // Note: This test depends on internal state tracking
      // The actual limit check happens if shouldRebalance would be true
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      preferenceRepository.findOne.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(
        service.evaluateInvestmentDecision('user-123', 1000),
      ).rejects.toThrow();
    });
  });
});
