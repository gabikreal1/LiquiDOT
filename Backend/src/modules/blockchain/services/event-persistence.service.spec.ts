import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPersistenceService } from './event-persistence.service';
import { BlockchainEventListenerService } from './event-listener.service';
import { User } from '../../users/entities/user.entity';
import { Position, PositionStatus } from '../../positions/entities/position.entity';
import { Pool } from '../../pools/entities/pool.entity';

describe('EventPersistenceService', () => {
  let service: EventPersistenceService;
  let eventListener: jest.Mocked<BlockchainEventListenerService>;
  let userRepository: jest.Mocked<Repository<User>>;
  let positionRepository: jest.Mocked<Repository<Position>>;
  let poolRepository: jest.Mocked<Repository<Pool>>;
  let registeredCallbacks: any;

  beforeEach(async () => {
    // Create mock repositories
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockPositionRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockPoolRepository = {
      findOne: jest.fn(),
    };

    // Create mock event listener that captures registered callbacks
    const mockEventListener = {
      registerCallbacks: jest.fn((callbacks) => {
        registeredCallbacks = callbacks;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPersistenceService,
        {
          provide: BlockchainEventListenerService,
          useValue: mockEventListener,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepository,
        },
        {
          provide: getRepositoryToken(Pool),
          useValue: mockPoolRepository,
        },
      ],
    }).compile();

    service = module.get<EventPersistenceService>(EventPersistenceService);
    eventListener = module.get(BlockchainEventListenerService);
    userRepository = module.get(getRepositoryToken(User));
    positionRepository = module.get(getRepositoryToken(Position));
    poolRepository = module.get(getRepositoryToken(Pool));

    // Trigger onModuleInit to register callbacks
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should register event handlers on initialization', () => {
      expect(eventListener.registerCallbacks).toHaveBeenCalledTimes(1);
      expect(registeredCallbacks).toBeDefined();
      expect(registeredCallbacks.assetHub).toBeDefined();
      expect(registeredCallbacks.moonbeam).toBeDefined();
    });

    it('should register all Asset Hub event handlers', () => {
      expect(registeredCallbacks.assetHub.onDeposit).toBeDefined();
      expect(registeredCallbacks.assetHub.onWithdrawal).toBeDefined();
      expect(registeredCallbacks.assetHub.onInvestmentInitiated).toBeDefined();
      expect(registeredCallbacks.assetHub.onExecutionConfirmed).toBeDefined();
      expect(registeredCallbacks.assetHub.onPositionLiquidated).toBeDefined();
      expect(registeredCallbacks.assetHub.onLiquidationSettled).toBeDefined();
      expect(registeredCallbacks.assetHub.onChainAdded).toBeDefined();
      expect(registeredCallbacks.assetHub.onXcmMessageSent).toBeDefined();
    });

    it('should register all Moonbeam event handlers', () => {
      expect(registeredCallbacks.moonbeam.onAssetsReceived).toBeDefined();
      expect(registeredCallbacks.moonbeam.onPendingPositionCreated).toBeDefined();
      expect(registeredCallbacks.moonbeam.onPositionExecuted).toBeDefined();
      expect(registeredCallbacks.moonbeam.onPositionLiquidated).toBeDefined();
      expect(registeredCallbacks.moonbeam.onAssetsReturned).toBeDefined();
      expect(registeredCallbacks.moonbeam.onPendingPositionCancelled).toBeDefined();
    });
  });

  describe('Asset Hub Event Handlers', () => {
    describe('handleDeposit', () => {
      const depositEvent = {
        user: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        blockNumber: 12345,
        transactionHash: '0xabc123',
      };

      it('should create new user on deposit if not exists', async () => {
        // Arrange
        userRepository.findOne.mockResolvedValue(null);
        userRepository.create.mockReturnValue({
          walletAddress: depositEvent.user.toLowerCase(),
          isActive: true,
        } as User);
        userRepository.save.mockResolvedValue({} as User);

        // Act
        await registeredCallbacks.assetHub.onDeposit(depositEvent);

        // Assert
        expect(userRepository.findOne).toHaveBeenCalledWith({
          where: { walletAddress: depositEvent.user.toLowerCase() },
        });
        expect(userRepository.create).toHaveBeenCalledWith({
          walletAddress: depositEvent.user.toLowerCase(),
          isActive: true,
        });
        expect(userRepository.save).toHaveBeenCalled();
      });

      it('should not create user if already exists', async () => {
        // Arrange
        const existingUser = {
          id: '1',
          walletAddress: depositEvent.user.toLowerCase(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          positions: [],
          preferences: [],
        } as User;
        userRepository.findOne.mockResolvedValue(existingUser);

        // Act
        await registeredCallbacks.assetHub.onDeposit(depositEvent);

        // Assert
        expect(userRepository.findOne).toHaveBeenCalled();
        expect(userRepository.create).not.toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        // Arrange
        userRepository.findOne.mockRejectedValue(new Error('DB connection failed'));

        // Act & Assert - should not throw
        await expect(
          registeredCallbacks.assetHub.onDeposit(depositEvent),
        ).resolves.not.toThrow();
      });
    });

    describe('handleInvestmentInitiated', () => {
      const investmentEvent = {
        positionId: 'pos-123',
        user: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1284,
        poolId: 'pool-abc',
        amount: '500000000000000000',
        blockNumber: 12346,
        transactionHash: '0xdef456',
      };

      it('should create new position with PENDING_EXECUTION status', async () => {
        // Arrange
        const mockUser = { 
          id: '1', 
          walletAddress: investmentEvent.user.toLowerCase(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          positions: [],
          preferences: [],
        } as User;
        const mockPool = { 
          id: '1', 
          poolAddress: investmentEvent.poolId,
        } as unknown as Pool;
        
        userRepository.findOne.mockResolvedValue(mockUser);
        poolRepository.findOne.mockResolvedValue(mockPool);
        positionRepository.create.mockReturnValue({
          assetHubPositionId: investmentEvent.positionId,
          userId: mockUser.id,
          poolId: mockPool.id,
          amount: investmentEvent.amount,
          chainId: investmentEvent.chainId,
          status: PositionStatus.PENDING_EXECUTION,
        } as unknown as Position);
        positionRepository.save.mockResolvedValue({} as Position);

        // Act
        await registeredCallbacks.assetHub.onInvestmentInitiated(investmentEvent);

        // Assert
        expect(positionRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            assetHubPositionId: investmentEvent.positionId,
            status: PositionStatus.PENDING_EXECUTION,
            amount: investmentEvent.amount,
          }),
        );
        expect(positionRepository.save).toHaveBeenCalled();
      });

      it('should handle missing user gracefully', async () => {
        // Arrange
        userRepository.findOne.mockResolvedValue(null);

        // Act
        await registeredCallbacks.assetHub.onInvestmentInitiated(investmentEvent);

        // Assert
        expect(positionRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('handleExecutionConfirmed', () => {
      const executionEvent = {
        positionId: 'pos-123',
        chainId: 1284,
        remotePositionId: 'mb-pos-456',
        liquidity: '1000000000000000000',
        blockNumber: 12347,
        transactionHash: '0xghi789',
      };

      it('should update position to ACTIVE status', async () => {
        // Arrange
        const existingPosition = {
          id: '1',
          assetHubPositionId: executionEvent.positionId,
          status: PositionStatus.PENDING_EXECUTION,
        } as unknown as Position;
        
        positionRepository.findOne.mockResolvedValue(existingPosition);
        positionRepository.save.mockResolvedValue({} as Position);

        // Act
        await registeredCallbacks.assetHub.onExecutionConfirmed(executionEvent);

        // Assert
        expect(positionRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: PositionStatus.ACTIVE,
            moonbeamPositionId: executionEvent.remotePositionId,
            liquidity: executionEvent.liquidity,
          }),
        );
      });

      it('should log warning if position not found', async () => {
        // Arrange
        positionRepository.findOne.mockResolvedValue(null);

        // Act - should not throw
        await expect(
          registeredCallbacks.assetHub.onExecutionConfirmed(executionEvent),
        ).resolves.not.toThrow();

        // Assert
        expect(positionRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('handlePositionLiquidated', () => {
      const liquidationEvent = {
        positionId: 'pos-123',
        user: '0x1234567890abcdef1234567890abcdef12345678',
        finalAmount: '1200000000000000000',
        blockNumber: 12348,
        transactionHash: '0xjkl012',
      };

      it('should update position to LIQUIDATED status', async () => {
        // Arrange
        const existingPosition = {
          id: '1',
          assetHubPositionId: liquidationEvent.positionId,
          status: PositionStatus.ACTIVE,
        } as unknown as Position;
        
        positionRepository.findOne.mockResolvedValue(existingPosition);
        positionRepository.save.mockResolvedValue({} as Position);

        // Act
        await registeredCallbacks.assetHub.onPositionLiquidated(liquidationEvent);

        // Assert
        expect(positionRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: PositionStatus.LIQUIDATED,
            returnedAmount: liquidationEvent.finalAmount,
          }),
        );
      });
    });
  });

  describe('Moonbeam Event Handlers', () => {
    describe('handlePendingPositionCreated', () => {
      const pendingEvent = {
        assetHubPositionId: 'pos-123',
        user: '0x1234567890abcdef1234567890abcdef12345678',
        token: '0xtoken123',
        amount: '500000000000000000',
        poolId: 'pool-abc',
        blockNumber: 12345,
        transactionHash: '0xmno345',
      };

      it('should log pending position creation (no DB updates)', async () => {
        // Act - handlePendingPositionCreated is primarily for logging
        // Position state is managed via AssetHub events
        await registeredCallbacks.moonbeam.onPendingPositionCreated(pendingEvent);

        // Assert - no DB operations should occur
        expect(positionRepository.findOne).not.toHaveBeenCalled();
        expect(positionRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('handlePendingPositionCancelled', () => {
      const cancelledEvent = {
        assetHubPositionId: 'pos-123',
        user: '0x1234567890abcdef1234567890abcdef12345678',
        refundAmount: '500000000000000000',
        blockNumber: 12346,
        transactionHash: '0xpqr678',
      };

      it('should update position to FAILED status', async () => {
        // Arrange
        const existingPosition = {
          id: '1',
          assetHubPositionId: cancelledEvent.assetHubPositionId,
          status: PositionStatus.PENDING_EXECUTION,
        } as unknown as Position;
        
        positionRepository.findOne.mockResolvedValue(existingPosition);
        positionRepository.save.mockResolvedValue({} as Position);

        // Act
        await registeredCallbacks.moonbeam.onPendingPositionCancelled(cancelledEvent);

        // Assert
        expect(positionRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: PositionStatus.FAILED,
          }),
        );
      });

      it('should not fail if position not found', async () => {
        // Arrange
        positionRepository.findOne.mockResolvedValue(null);

        // Act & Assert - should not throw
        await expect(
          registeredCallbacks.moonbeam.onPendingPositionCancelled(cancelledEvent),
        ).resolves.not.toThrow();
      });
    });

    describe('handleMoonbeamPositionExecuted', () => {
      const executedEvent = {
        positionId: 'mb-pos-456',
        user: '0x1234567890abcdef1234567890abcdef12345678',
        tokenId: '12345',
        liquidity: '1000000000000000000',
        blockNumber: 12347,
        transactionHash: '0xstu901',
      };

      it('should log execution event', async () => {
        // Act - should not throw
        await expect(
          registeredCallbacks.moonbeam.onPositionExecuted(executedEvent),
        ).resolves.not.toThrow();
      });
    });

    describe('handleMoonbeamPositionLiquidated', () => {
      const liquidatedEvent = {
        positionId: 'mb-pos-456',
        user: '0x1234567890abcdef1234567890abcdef12345678',
        amount0: '500000000000000000',
        amount1: '600000000000000000',
        blockNumber: 12348,
        transactionHash: '0xvwx234',
      };

      it('should log liquidation event', async () => {
        // Act - should not throw
        await expect(
          registeredCallbacks.moonbeam.onPositionLiquidated(liquidatedEvent),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should not crash service on database errors', async () => {
      // Arrange
      const depositEvent = {
        user: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '1000000000000000000',
        blockNumber: 12345,
        transactionHash: '0xabc123',
      };

      userRepository.findOne.mockRejectedValue(new Error('Database timeout'));

      // Act & Assert
      await expect(
        registeredCallbacks.assetHub.onDeposit(depositEvent),
      ).resolves.not.toThrow();
    });

    it('should handle concurrent events', async () => {
      // Arrange
      const events = Array.from({ length: 10 }, (_, i) => ({
        user: `0x${i.toString().padStart(40, '0')}`,
        amount: '1000000000000000000',
        blockNumber: 12345 + i,
        transactionHash: `0x${i.toString().padStart(64, 'a')}`,
      }));

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockImplementation((data) => data as User);
      userRepository.save.mockResolvedValue({} as User);

      // Act
      await Promise.all(
        events.map((event) => registeredCallbacks.assetHub.onDeposit(event)),
      );

      // Assert
      expect(userRepository.findOne).toHaveBeenCalledTimes(10);
    });
  });
});
