import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InvestmentDecisionResult } from '../decision.types';

export class ExecuteDecisionDto {
  decision: InvestmentDecisionResult;

  @IsString()
  userWalletAddress: string;

  @IsString()
  baseAssetAddress: string;

  @IsString()
  amountWei: string;

  @IsInt()
  lowerRangePercent: number;

  @IsInt()
  upperRangePercent: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  chainId?: number;
}
