import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertPreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  minApr?: number;

  // Stored as string in DB (decimal) to keep precision.
  @IsOptional()
  @IsString()
  minTvl?: string;

  @IsOptional()
  @IsInt()
  defaultLowerRangePercent?: number;

  @IsOptional()
  @IsInt()
  defaultUpperRangePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  investmentCheckIntervalSeconds?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDexes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTokens?: string[];

  @IsOptional()
  @IsBoolean()
  autoInvestEnabled?: boolean;
}
