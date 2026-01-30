import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RunDecisionDto {
  @IsOptional()
  @IsNumber()
  totalCapitalUsd?: number;

  @IsOptional()
  @IsString()
  totalCapitalBaseAssetWei?: string;

  @IsOptional()
  @IsBoolean()
  deriveTotalCapitalFromVault?: boolean;

  @IsOptional()
  @IsBoolean()
  deriveCurrentPositionsFromVault?: boolean;

  @IsInt()
  @Min(0)
  rebalancesToday: number;

  @IsString()
  baseAssetAddress: string;

  @IsOptional()
  @IsString()
  userWalletAddress?: string;
}
