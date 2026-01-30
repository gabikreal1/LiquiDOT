import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BlockchainEventListenerService } from '../blockchain/services/event-listener.service';
import { Position, PositionStatus } from './entities/position.entity';
import { PositionEventsService } from './position-events.service';

describe('PositionEventsService', () => {
  let service: PositionEventsService;
  let eventListener: { registerCallbacks: jest.Mock };
  let callbacks: any;

  const positionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<Position>;

  beforeEach(async () => {
    callbacks = undefined;

    eventListener = {
      registerCallbacks: jest.fn((c: any) => {
        callbacks = c;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PositionEventsService,
        { provide: BlockchainEventListenerService, useValue: eventListener },
        { provide: getRepositoryToken(Position), useValue: positionRepo },
      ],
    }).compile();

    service = moduleRef.get(PositionEventsService);
  });

  test('registers callbacks on init', () => {
    service.onModuleInit();
    expect(eventListener.registerCallbacks).toHaveBeenCalledTimes(1);
    expect(callbacks?.moonbeam?.onLiquidationCompleted).toBeDefined();
    expect(callbacks?.assetHub?.onLiquidationSettled).toBeDefined();
  });

  test('Moonbeam LiquidationCompleted updates returnedAmount and sets LIQUIDATION_PENDING', async () => {
    service.onModuleInit();

    const pos = {
      id: 'pos-1',
      assetHubPositionId: '0xah',
      moonbeamPositionId: null,
      status: PositionStatus.ACTIVE,
      returnedAmount: null,
    } as any as Position;

    (positionRepo.findOne as jest.Mock).mockResolvedValue(pos);
    (positionRepo.save as jest.Mock).mockImplementation(async (p: any) => p);

    await callbacks.moonbeam.onLiquidationCompleted({
      positionId: 123,
      assetHubPositionId: '0xah',
      user: '0xuser',
      baseAsset: '0xbase',
      totalReturned: '999',
      blockNumber: 1,
      transactionHash: '0xtx',
    });

    expect(positionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assetHubPositionId: '0xah',
        status: PositionStatus.LIQUIDATION_PENDING,
        returnedAmount: '999',
        moonbeamPositionId: '123',
      }),
    );
  });

  test('AssetHub LiquidationSettled marks LIQUIDATED and sets liquidatedAt + returnedAmount', async () => {
    service.onModuleInit();

    const pos = {
      id: 'pos-1',
      assetHubPositionId: '0xah',
      status: PositionStatus.LIQUIDATION_PENDING,
      liquidatedAt: null,
      returnedAmount: '10',
    } as any as Position;

    (positionRepo.findOne as jest.Mock).mockResolvedValue(pos);
    (positionRepo.save as jest.Mock).mockImplementation(async (p: any) => p);

    await callbacks.assetHub.onLiquidationSettled({
      positionId: '0xah',
      user: '0xuser',
      receivedAmount: '555',
      expectedAmount: '500',
      blockNumber: 2,
      transactionHash: '0xtx2',
    });

    expect(positionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assetHubPositionId: '0xah',
        status: PositionStatus.LIQUIDATED,
        returnedAmount: '555',
        liquidatedAt: expect.any(Date),
      }),
    );
  });
});
