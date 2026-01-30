import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class PreviewAllocationDto {
  /** Hypothetical total capital (USD-like) to size allocations. */
  @IsNumber()
  @IsPositive()
  totalCapitalUsd: number;

  /** Optional override of chain id used only for metadata/selection. */
  @IsOptional()
  @IsInt()
  chainId?: number;

  /** Optional user wallet used only for identity; preview does not read balances. */
  @IsOptional()
  @IsString()
  userWalletAddress?: string;

  /** If provided, limit number of positions implied by the preview. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPositions?: number;

  /** Include a breakdown with percent weights and implied amounts. */
  @IsOptional()
  includeBreakdown?: boolean;
}
