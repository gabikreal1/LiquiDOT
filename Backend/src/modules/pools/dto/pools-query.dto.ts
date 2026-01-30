import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PoolsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTvl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minApr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minVolume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
