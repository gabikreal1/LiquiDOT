import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MoonbeamService, LiquidateParams } from '../blockchain/services/moonbeam.service';
import { XcmBuilderService } from '../blockchain/services/xcm-builder.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StopLossWorkerService implements OnModuleInit {
  private readonly logger = new Logger(StopLossWorkerService.name);
  private isProcessing = false;

  constructor(
    private readonly moonbeamService: MoonbeamService,
    private readonly xcmBuilderService: XcmBuilderService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log('Stop-Loss Worker initialized');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkPositions() {
    if (this.isProcessing) {
      this.logger.debug('Previous stop-loss check still running, skipping...');
      return;
    }

    this.isProcessing = true;
    try {
      this.logger.debug('Starting stop-loss check...');
      
      // 1. Get all active positions from Moonbeam
      // In a production environment with thousands of positions, we should paginate
      // or use a subgraph. For MVP, fetching all active positions is acceptable.
      const activePositions = await this.moonbeamService.getActivePositions();
      this.logger.debug(`Found ${activePositions.length} active positions`);

      for (const position of activePositions) {
        try {
          // 2. Check if position is out of range
          // The contract handles the math: currentTick < bottomTick || currentTick >= topTick
          const { outOfRange, currentPrice } = await this.moonbeamService.isPositionOutOfRange(
            position.tokenId,
          );

          if (outOfRange) {
            this.logger.warn(
              `Position ${position.tokenId} (AssetHub: ${position.assetHubPositionId}) is OUT OF RANGE. Triggering liquidation...`,
            );

            // 3. Prepare liquidation
            // We need to return funds to the user on AssetHub (Chain 1000)
            const destination = await this.xcmBuilderService.buildReturnDestination({
              userAddress: position.owner,
              amount: 1n, // Placeholder amount for destination builder
            });

            // 4. Calculate min amounts (simplified for MVP: 0 slippage protection here, 
            // relying on contract or high slippage tolerance)
            // In a real prod environment, we would calculate minAmountOut based on oralce price.
            const liquidateParams: LiquidateParams = {
              positionId: position.tokenId,
              baseAsset: position.token0, // Assuming token0 is base for simplicity, need logic if token1
              destination,
              minAmountOut0: 0n,
              minAmountOut1: 0n,
              limitSqrtPrice: 0n,
              assetHubPositionId: position.assetHubPositionId,
            };

            // 5. Execute Liquidation
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
