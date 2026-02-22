import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MoonbeamService, LiquidateParams } from '../blockchain/services/moonbeam.service';
import { XcmBuilderService } from '../blockchain/services/xcm-builder.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StopLossWorkerService implements OnModuleInit {
  private readonly logger = new Logger(StopLossWorkerService.name);
  private isProcessing = false;
  private readonly enabled: boolean;

  constructor(
    private readonly moonbeamService: MoonbeamService,
    private readonly xcmBuilderService: XcmBuilderService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('ENABLE_STOP_LOSS_SIMPLE_WORKER', false);
  }

  onModuleInit() {
    this.logger.log(`Stop-Loss Worker initialized (enabled: ${this.enabled})`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkPositions() {
    if (!this.enabled || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      this.logger.debug('Starting stop-loss check...');

      // Get all active positions — getActivePositions() now iterates
      // positionCounter + positions(id) since the unbounded view was removed
      const activePositions = await this.moonbeamService.getActivePositions();
      this.logger.debug(`Found ${activePositions.length} active positions`);

      for (const position of activePositions) {
        try {
          // Check if position is out of range
          const { outOfRange } = await this.moonbeamService.isPositionOutOfRange(
            position.tokenId,
          );

          if (outOfRange) {
            this.logger.warn(
              `Position ${position.tokenId} (AssetHub: ${position.assetHubPositionId}) is OUT OF RANGE. Triggering liquidation...`,
            );

            // minAmountOut 0 = let the contract's defaultSlippageBps handle it
            const liquidateParams: LiquidateParams = {
              positionId: position.tokenId,
              baseAsset: position.token0,
              beneficiary: position.owner,
              minAmountOut0: 0n,
              minAmountOut1: 0n,
              limitSqrtPrice: 0n,
              assetHubPositionId: position.assetHubPositionId,
            };

            await this.moonbeamService.liquidateSwapAndReturn(liquidateParams);
            this.logger.log(`Successfully liquidated position ${position.tokenId}`);
          }
        } catch (err) {
          this.logger.error(
            `Failed to process position ${position.tokenId}: ${err.message}`,
            err.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Stop-loss check failed: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }
}
