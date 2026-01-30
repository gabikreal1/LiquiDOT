import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  InvestmentDecisionController,
  InvestmentDecisionRequestDto,
  InvestmentDecisionResponse,
} from './investment-decision.controller';
import { InvestmentDecisionService } from './investment-decision.service';
import { RebalanceDecision, RebalanceAction } from './types/investment.types';

describe('InvestmentDecisionController', () => {
  let controller: InvestmentDecisionController;
  let investmentDecisionService: jest.Mocked<InvestmentDecisionService>;

  // Mock decision data
  const mockRebalanceDecision: RebalanceDecision = {
    shouldRebalance: true,
    reason: 'Portfolio optimization opportunity found with sufficient utility gain',
    rebalancesTodayBefore: 0,
    rebalancesTodayAfter: 1,
    currentWeightedApy: 12.5,
    idealWeightedApy: 18.3,
    apyImprovement: 5.8,
    estimatedGasTotalUsd: 5,
    profit30dUsd: 45,
    netProfit30dUsd: 40,
    currentUtility: 0.8,
    targetUtility: 0.95,
    grossUtilityImprovement: 0.18,
    netUtilityGain: 0.15,
    calculatedAt: new Date(),
    toWithdraw: [],
    toAdd: [
      {
        type: 'ADD' as const,
        poolId: 'pool-123',
        targetAllocationUsd: 500,
        poolData: {
          pair: 'DOT/USDC',
          token0Symbol: 'DOT',
          token1Symbol: 'USDC',
          token0Address: '0x1234',
          token1Address: '0x5678',
          apy30dAverage: 18.5,
          tvlUsd: 1000000,
          ilRiskFactor: 0.05,
          realApy: 17.5,
          effectiveApy: 16.8,
          utilityScore: 0.92,
          volume24hUsd: 50000,
          ageInDays: 120,
          dex: 'Algebra',
          fee: 3000,
        },
      },
      {
        type: 'ADD' as const,
        poolId: 'pool-456',
        targetAllocationUsd: 500,
        poolData: {
          pair: 'GLMR/USDT',
          token0Symbol: 'GLMR',
          token1Symbol: 'USDT',
          token0Address: '0xabcd',
          token1Address: '0xefgh',
          apy30dAverage: 15.0,
          tvlUsd: 500000,
          ilRiskFactor: 0.08,
          realApy: 14.0,
          effectiveApy: 13.5,
          utilityScore: 0.85,
          volume24hUsd: 25000,
          ageInDays: 90,
          dex: 'StellaSwap',
          fee: 2500,
        },
      },
    ] as unknown as RebalanceAction[],
    configUsed: {
      minApy: 8,
      allowedTokens: ['DOT', 'USDC', 'GLMR', 'USDT'],
      maxPositions: 6,
      maxAllocPerPositionUsd: 500,
      dailyRebalanceLimit: 3,
      expectedGasUsd: 5,
      lambda: 0.5,
      theta: 0.01,
      planningHorizonDays: 30,
      minTvlUsd: 100000,
      minPoolAgeDays: 30,
      maxIlLossPercent: 10,
      minPositionSizeUsd: 50,
    },
  };

  beforeEach(async () => {
    const mockInvestmentDecisionService = {
      evaluateForWallet: jest.fn(),
      evaluateInvestmentDecision: jest.fn(),
      getUserBalanceByWallet: jest.fn().mockResolvedValue(1000),
      getUserBalance: jest.fn().mockResolvedValue(1000),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvestmentDecisionController],
      providers: [
        {
          provide: InvestmentDecisionService,
          useValue: mockInvestmentDecisionService,
        },
      ],
    }).compile();

    controller = module.get<InvestmentDecisionController>(InvestmentDecisionController);
    investmentDecisionService = module.get(InvestmentDecisionService);
  });

  describe('POST /api/investmentDecisions', () => {
    it('should return investment decisions for valid request', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
        selectedDepositCoin: 'USDC',
        preferences: {
          minApy: 8,
          maxAllocation: 25,
          allowedTokens: ['DOT', 'USDC', 'GLMR', 'USDT'],
          riskStrategy: 'moderate',
          slTpRange: [-10, 20],
        },
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.decisions).toHaveLength(2);
      expect(result.decisions[0].poolId).toBe('pool-123');
      expect(result.decisions[0].pairName).toBe('DOT/USDC');
      expect(result.decisions[0].approximateAPR).toBe(18.5);
      expect(result.decisions[0].stopLoss).toBe(-10);
      expect(result.decisions[0].takeProfit).toBe(20);
      expect(result.metadata?.totalCapitalUsd).toBe(1000);
      expect(result.metadata?.shouldRebalance).toBe(true);
    });

    it('should throw BadRequestException when walletAddress is missing', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '',
        depositAmount: 1000,
      };

      // Act & Assert
      await expect(controller.getInvestmentDecisions(dto)).rejects.toThrow(BadRequestException);
    });

    it('should return error response when depositAmount is 0', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 0,
      };

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('No deposit amount');
      expect(result.decisions).toHaveLength(0);
    });

    it('should return error response when depositAmount is negative', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: -100,
      };

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      expect(result.success).toBe(false);
      expect(result.decisions).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
      };

      investmentDecisionService.evaluateForWallet.mockRejectedValue(
        new Error('Blockchain connection failed'),
      );

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Blockchain connection failed');
      expect(result.decisions).toHaveLength(0);
    });

    it('should use default slTpRange when preferences not provided', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      expect(result.success).toBe(true);
      expect(result.decisions[0].stopLoss).toBe(-5); // Default
      expect(result.decisions[0].takeProfit).toBe(10); // Default
    });

    it('should map conservative risk strategy correctly', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
        preferences: {
          riskStrategy: 'conservative',
        },
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      await controller.getInvestmentDecisions(dto);

      // Assert - verify service was called with correct lambda
      expect(investmentDecisionService.evaluateForWallet).toHaveBeenCalledWith(
        dto.walletAddress,
        1000,
        expect.objectContaining({
          lambdaRiskAversion: 0.8, // Conservative = higher risk aversion
        }),
      );
    });

    it('should map aggressive risk strategy correctly', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
        preferences: {
          riskStrategy: 'aggressive',
        },
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      await controller.getInvestmentDecisions(dto);

      // Assert
      expect(investmentDecisionService.evaluateForWallet).toHaveBeenCalledWith(
        dto.walletAddress,
        1000,
        expect.objectContaining({
          lambdaRiskAversion: 0.2, // Aggressive = lower risk aversion
        }),
      );
    });

    it('should include enhanced fields in response', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert - verify enhanced fields
      expect(result.decisions[0].ilRiskFactor).toBe(0.05);
      expect(result.decisions[0].utilityScore).toBe(0.92);
      expect(result.decisions[0].effectiveApy).toBe(16.8);
      expect(result.decisions[0].dex).toBe('Algebra');
      expect(result.decisions[0].volume24hUsd).toBe(50000);
      expect(result.decisions[0].poolAgeDays).toBe(120);
    });

    it('should calculate proportion correctly', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      // Each pool has 500 USD allocation out of 1000 = 50%
      expect(result.decisions[0].proportion).toBe(50);
      expect(result.decisions[1].proportion).toBe(50);
    });
  });

  describe('GET /api/investmentDecisions/wallet/:address', () => {
    it('should return decisions for a valid wallet address', async () => {
      // Arrange
      const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      const result = await controller.getDecisionsForWallet(walletAddress);

      // Assert
      expect(result.success).toBe(true);
      expect(result.decisions.length).toBeGreaterThan(0);
    });
  });

  describe('Response metadata', () => {
    it('should include all required metadata fields', async () => {
      // Arrange
      const dto: InvestmentDecisionRequestDto = {
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        depositAmount: 1000,
      };

      investmentDecisionService.evaluateForWallet.mockResolvedValue(mockRebalanceDecision);

      // Act
      const result = await controller.getInvestmentDecisions(dto);

      // Assert
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.currentWeightedApy).toBe(12.5);
      expect(result.metadata?.idealWeightedApy).toBe(18.3);
      expect(result.metadata?.apyImprovement).toBe(5.8);
      expect(result.metadata?.estimatedGasUsd).toBe(5);
      expect(result.metadata?.profit30dUsd).toBe(45);
      expect(result.metadata?.netProfit30dUsd).toBe(40);
      expect(result.metadata?.currentUtility).toBe(0.8);
      expect(result.metadata?.targetUtility).toBe(0.95);
      expect(result.metadata?.netUtilityGain).toBe(0.15);
      expect(result.metadata?.calculatedAt).toBeDefined();
    });
  });
});
