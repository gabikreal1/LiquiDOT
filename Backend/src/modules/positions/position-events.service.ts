import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BlockchainEventListenerService } from '../blockchain/services/event-listener.service';
import { Position, PositionStatus } from './entities/position.entity';

/**
 * PositionEventsService
 *
 * Keeps Position rows up-to-date based on blockchain events.
 *
 * Design goals:
 * - Best-effort, idempotent updates (events may be replayed).
 * - Never crash the process on malformed events.
 * - Avoid making on-chain calls in event handlers (persist what we have).
 */
@Injectable()
export class PositionEventsService implements OnModuleInit {
  private readonly logger = new Logger(PositionEventsService.name);

  constructor(
    private readonly eventListener: BlockchainEventListenerService,
    @InjectRepository(Position) private readonly positionRepo: Repository<Position>,
  ) {}

  onModuleInit(): void {
    // Register callbacks; the BlockchainEventListenerService will merge callbacks
    // across all registerCallbacks() calls.
    this.eventListener.registerCallbacks({
      moonbeam: {
        onLiquidationCompleted: (event) => void this.handleMoonbeamLiquidationCompleted(event),
      },
      assetHub: {
        onLiquidationSettled: (event) => void this.handleAssetHubLiquidationSettled(event),
      },
    });

    this.logger.log('Position event callbacks registered');
  }

  private async handleMoonbeamLiquidationCompleted(event: {
    positionId: number;
    assetHubPositionId: string;
    user: string;
    baseAsset: string;
    totalReturned: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    try {
      const assetHubPositionId = String(event.assetHubPositionId);
      const totalReturned = String(event.totalReturned);

      const pos = await this.positionRepo.findOne({ where: { assetHubPositionId } });
      if (!pos) {
        this.logger.warn(`Moonbeam LiquidationCompleted for unknown assetHubPositionId=${assetHubPositionId}`);
        return;
      }

      // Record returned amount early (Moonbeam knows how much was returned),
      // but position is not fully "LIQUIDATED" until AssetHub settles.
      pos.returnedAmount = totalReturned;
      pos.status = PositionStatus.LIQUIDATION_PENDING;

      // Persist Moonbeam position id if missing; this helps later diagnostics.
      if (!pos.moonbeamPositionId && Number.isFinite(event.positionId)) {
        pos.moonbeamPositionId = String(event.positionId);
      }

      await this.positionRepo.save(pos);

      this.logger.log(
        `Position updated from Moonbeam LiquidationCompleted assetHubPositionId=${assetHubPositionId} returned=${totalReturned}`,
      );
    } catch (error) {
      this.logger.warn(`Failed handling Moonbeam LiquidationCompleted: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleAssetHubLiquidationSettled(event: {
    positionId: string;
    user: string;
    receivedAmount: string;
    expectedAmount: string;
    blockNumber: number;
    transactionHash: string;
  }): Promise<void> {
    try {
      const assetHubPositionId = String(event.positionId);
      const receivedAmount = String(event.receivedAmount);

      const pos = await this.positionRepo.findOne({ where: { assetHubPositionId } });
      if (!pos) {
        this.logger.warn(`AssetHub LiquidationSettled for unknown assetHubPositionId=${assetHubPositionId}`);
        return;
      }

      // Settlement is the terminal point on AssetHub.
      pos.status = PositionStatus.LIQUIDATED;
      pos.liquidatedAt = pos.liquidatedAt ?? new Date();

      // Prefer AssetHub received amount as the final ground-truth.
      pos.returnedAmount = receivedAmount;

      await this.positionRepo.save(pos);

      this.logger.log(
        `Position marked LIQUIDATED from AssetHub LiquidationSettled assetHubPositionId=${assetHubPositionId} received=${receivedAmount}`,
      );
    } catch (error) {
      this.logger.warn(`Failed handling AssetHub LiquidationSettled: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
