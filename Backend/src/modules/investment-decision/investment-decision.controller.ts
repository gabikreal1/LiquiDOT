import { Body, Controller, Param, Post } from '@nestjs/common';
import { InvestmentDecisionService } from './investment-decision.service';
import { RunDecisionDto } from './dto/run-decision.dto';
import { ExecuteDecisionDto } from './dto/execute-decision.dto';

@Controller('users/:userId/decision')
export class InvestmentDecisionController {
  constructor(private readonly decisionService: InvestmentDecisionService) {}

  @Post('run')
  async run(@Param('userId') userId: string, @Body() body: RunDecisionDto) {
    return this.decisionService.runDecision({
      userId,
      totalCapitalUsd: body.totalCapitalUsd,
      totalCapitalBaseAssetWei: body.totalCapitalBaseAssetWei
        ? BigInt(body.totalCapitalBaseAssetWei)
        : undefined,
      deriveTotalCapitalFromVault: body.deriveTotalCapitalFromVault,
      deriveCurrentPositionsFromVault: body.deriveCurrentPositionsFromVault,
      rebalancesToday: body.rebalancesToday,
      baseAssetAddress: body.baseAssetAddress,
      userWalletAddress: body.userWalletAddress,
    });
  }

  @Post('execute')
  async execute(@Body() body: ExecuteDecisionDto) {
    // Safety: keep execution env-gated so tests/dev don't accidentally dispatch XCM.
    if (process.env.ENABLE_DECISION_EXECUTION !== 'true') {
      return {
        dispatchedPositionIds: [],
        skipped: true,
        reason: 'ENABLE_DECISION_EXECUTION is not enabled',
      };
    }

    return this.decisionService.executeDecision({
      decision: body.decision,
      userWalletAddress: body.userWalletAddress,
      baseAssetAddress: body.baseAssetAddress,
      amountWei: BigInt(body.amountWei),
      lowerRangePercent: body.lowerRangePercent,
      upperRangePercent: body.upperRangePercent,
      chainId: body.chainId,
    });
  }
}
