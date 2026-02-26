import { z } from "zod/v4";

export interface UserPreference {
  // Investment Strategy
  minApy: number;
  maxPositions: number;
  maxAllocPerPositionUsd: number;
  minPositionSizeUsd: number;

  // Position Ranges
  defaultLowerRangePercent: number;
  defaultUpperRangePercent: number;

  // Pool Filters
  minTvlUsd: number;
  minPoolAgeDays: number;
  allowedTokens: string[] | null;
  preferredDexes: string[] | null;

  // Safety
  maxIlLossPercent: number;
  dailyRebalanceLimit: number;
  expectedGasUsd: number;

  // Automation
  autoInvestEnabled: boolean;
  investmentCheckIntervalSeconds: number;

  // Advanced
  lambdaRiskAversion: number;
  thetaMinBenefit: number;
  planningHorizonDays: number;
}

export const strategySchema = z.object({
  minApy: z.number().min(0),
  maxPositions: z.number().int().min(1).max(20),
  maxAllocPerPositionUsd: z.number().positive(),
  minPositionSizeUsd: z.number().positive(),
  defaultLowerRangePercent: z.number().min(-50).max(0),
  defaultUpperRangePercent: z.number().min(0).max(100),
  minTvlUsd: z.number().min(0),
  minPoolAgeDays: z.number().int().min(0),
  allowedTokens: z.array(z.string()).nullable(),
  preferredDexes: z.array(z.string()).nullable(),
  maxIlLossPercent: z.number().min(0).max(50),
  dailyRebalanceLimit: z.number().int().min(1).max(50),
  expectedGasUsd: z.number().positive(),
  autoInvestEnabled: z.boolean(),
  investmentCheckIntervalSeconds: z.number().int(),
  lambdaRiskAversion: z.number().min(0).max(1),
  thetaMinBenefit: z.number().min(0),
  planningHorizonDays: z.number().int().min(1).max(90),
});
